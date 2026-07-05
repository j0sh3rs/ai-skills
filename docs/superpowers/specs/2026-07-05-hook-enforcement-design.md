## Summary

Two Claude Code hooks that add deterministic, best-effort enforcement on top of the existing `twelve-factor-app` and `twelve-factor-agent` skills — closing part of the gap between "the model was told the rule" and "the rule was actually checked." Distributed via the existing `.claude-plugin/plugin.json` so anyone who already installs the plugin for the skills gets the hooks automatically.

Source: [GitHub issue #3](https://github.com/j0sh3rs/ai-skills/issues/3), a follow-up filed when `twelve-factor-agent`/`twelve-factor-app` shipped as skill-only (see [2026-07-05-twelve-factor-skills-design.md](./2026-07-05-twelve-factor-skills-design.md)).

## Scope: hook-amenability audit

Issue #3 named three example enforcement points but explicitly called them "e.g." — not committed scope. Before designing anything, every rule across both skills (11 in `twelve-factor-app`, 7 in `twelve-factor-agent`, 18 total) was assessed against one test: **can a cheap, stateless, single-event regex/heuristic check actually catch this, without deep program analysis or whole-codebase context?**

**Hook-amenable (this design covers these 4):**

| Rule | Skill | Why it's checkable |
|------|-------|---------------------|
| Config | twelve-factor-app | Hardcoded secret patterns, `.env` without `.env.example` — classic secret-scanning signal |
| Port Binding | twelve-factor-app | `.listen(80)`, low-port bind calls, Dockerfile missing `USER`/`USER root` — concrete string/pattern matches |
| Logs | twelve-factor-app | Custom log-file/rotation library usage (`createWriteStream(*.log)`, `FileHandler`) — decent signal |
| Contact Humans With Tools | twelve-factor-agent | Destructive/irreversible Bash command patterns — same class of check as this repo's own local "Fact-Forcing Gate" precedent |

**Not hook-amenable — permanent skill-only, not a future TODO:**

- twelve-factor-app: Dependencies (isolation isn't checkable, only pinning is, and even that's weak), Backing Services, Build/Release/Run, Processes, Concurrency, Disposability, Dev/Prod Parity, Admin Processes — all require architectural/runtime knowledge no single Write/Edit diff carries.
- twelve-factor-agent: Own Your Prompts, Own Your Context Window, Own Your Control Flow, Compact Errors, Small Focused Scope, Pre-fetch Context — all describe reasoning quality over a session, not a single tool call's content.

This is a hard boundary, not a starting point: no future pass should try to force-fit a hook onto these. They stay governed by the skill text alone.

## Hook 1: `twelve-factor-app-scan.js` — content scanning

**Event:** `PostToolUse`, matcher `Write|Edit`.

**Behavior:** runs after the file write already succeeded. Scans the new content for:
- Hardcoded secret patterns (API key / token / password-like strings)
- A committed `.env` file with no sibling `.env.example`
- Privileged port binding (`.listen(80)`, `bind(...)` with a port literal <1024, Dockerfile `EXPOSE` below 1024)
- Dockerfile missing a `USER` directive, or explicit `USER root`
- Custom log-file handling (`createWriteStream` targeting a `.log` path, common rotation library imports)

**Posture: warn-only.** Returns `additionalContext` describing what matched and which rule it maps to. Never blocks — the write already happened by the time this hook runs, and these are heuristic string matches prone to false positives (test fixtures, comments, example strings in documentation). The goal is to put the flag in front of the model so it can self-correct or explain why the match is a false positive, not to gate the action.

## Hook 2: `twelve-factor-gate.js` — destructive-action gate

**Event:** `PreToolUse`, matcher `Bash`.

**Behavior:** matches the command against a pattern list of destructive/irreversible operations — force-push, `rm -rf`, `git reset --hard`, `git clean -f`, `DROP TABLE`, and similar. Reinforces `twelve-factor-agent`'s "Contact Humans With Tools" rule at the one point a hook can actually catch it: immediately before an irreversible command executes.

**Posture: block, require justification.** Denies the command outright with a message demanding the model state intent/confirm before retrying — mirroring this session's own observed "Fact-Forcing Gate" pattern (a real, working local precedent for exactly this shape of enforcement). Unlike the content-scan hook, the asymmetry here favors blocking: the cost of a false positive is re-explaining once; the cost of a false negative is an unconfirmed irreversible action.

## Runtime and distribution

**Runtime:** Node.js, matching the only real precedent examined this session ([caveman](https://github.com/JuliusBrussee/caveman)'s hook scripts). Both scripts are dependency-free — built-in `process.stdin`, `JSON.parse`, and regex are sufficient; no `package.json` needed.

**File layout:**
```
hooks/twelve-factor-app-scan.js
hooks/twelve-factor-gate.js
```
New top-level `hooks/` directory, sibling to `skills/` — these hooks serve both skills together rather than belonging to one, so they don't live inside either skill's own directory.

**Wiring:** added to the existing `.claude-plugin/plugin.json`'s `hooks` key (currently absent from that file), same shape as caveman's:

```json
"hooks": {
  "PostToolUse": [
    { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-app-scan.js\"", "timeout": 5 }] }
  ],
  "PreToolUse": [
    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-gate.js\"", "timeout": 5 }] }
  ]
}
```

Anyone who runs `claude plugin install ai-skills@ai-skills` gets both hooks automatically alongside the three skills — no separate settings.json snippet or second install step, consistent with the "install once, get everything" experience the plugin manifest already provides for skills.

## Non-goals

- No hooks for the 14 non-amenable rules listed above, now or in any planned future pass — this is a permanent scope boundary, not deferred work.
- No hook framework, no shared hook-utility library, no config file for customizing pattern lists — two small standalone scripts, matching the "no unnecessary abstraction" posture of the rest of this repo.
- No test suite beyond what the implementation plan specifies for these two scripts — this repo has no existing test tooling to extend.
- No changes to the two existing SKILL.md files — this design only adds deterministic backup, it does not change what the skills themselves say.
