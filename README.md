# ai-skills

A collection of standalone Claude Code Skills to play with, distributed as independently-installable plugins from one marketplace — install just the one you want, no bundling.

## Plugins

| Plugin | What it does |
|---|---|
| [`boston`](./plugins/boston/skills/boston/README.md) | Bostonian-accent conversational mode — r-dropping, Boston vocabulary, casual profanity as flavoring. Code, commits, and anything meant to ship stay in plain professional English. |
| [`twelve-factor-agent`](./plugins/twelve-factor-agent/skills/twelve-factor-agent/README.md) | Session-behavior discipline for Claude Code itself, based on [humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents) — own your prompts, manage context deliberately, ask before risky actions, keep task scope small. Ships with `hooks/twelve-factor-gate.js`. |
| [`twelve-factor-app`](./plugins/twelve-factor-app/skills/twelve-factor-app/README.md) | Code-review and scaffolding discipline for services Claude writes or reviews, based on [12factor.net](https://12factor.net/) — config from environment, non-privileged port binding, stateless processes, logs as event streams. Ships with `hooks/twelve-factor-app-scan.js`. |
| [`brag-doc`](./plugins/brag-doc/skills/brag-doc/README.md) | Centralized, cross-repo Brag Doc — passive session capture (Stop hook) plus active `/brag-backfill` and `/brag-summarize` for GitHub/Jira-sourced contribution tracking and promo-packet synthesis. Ships with `hooks/brag-doc-stop.js`. |

Each plugin's README covers what it does, what problem it solves, and who should use it. Design decisions and rationale for each (including what was deliberately left out) live in [`docs/superpowers/specs/`](./docs/superpowers/specs/).

## Hooks

Each plugin above owns and ships its own hook(s) — installing one plugin does **not** pull in another plugin's hook.

| Hook | Plugin | Event | Posture |
|---|---|---|---|
| `hooks/twelve-factor-app-scan.js` | `twelve-factor-app` | `PostToolUse` on Write/Edit | Warn-only — flags likely Config/Port-Binding/Logs rule violations via `additionalContext`, never blocks. |
| `hooks/twelve-factor-gate.js` | `twelve-factor-agent` | `PreToolUse` on Bash | Blocks destructive/irreversible commands (force-push, `rm -rf`, `git reset --hard`, etc.) until justification is shown in the transcript. Escape hatch: `TWELVE_FACTOR_GATE_OFF=1`. |
| `hooks/brag-doc-stop.js` | `brag-doc` | `Stop` (session end) | Blocks the first stop attempt per session to prompt Claude to synthesize loggable work and ask the user whether to log it; allows the retry through via `stop_hook_active`. Escape hatch: `BRAG_DOC_STOP_OFF=1`. |

The twelve-factor hooks cover 4 of the 18 total rules across both twelve-factor skills — the rest require judgment a single tool-call event can't deterministically verify, and stay skill-only by design. See [`docs/superpowers/specs/2026-07-05-hook-enforcement-design.md`](./docs/superpowers/specs/2026-07-05-hook-enforcement-design.md) for the full scope rationale. `brag-doc-stop.js` is unrelated to the twelve-factor rule set — see [`docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md`](./docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md) for its own rationale.

## Installation

### Option A: Claude Code plugin marketplace (recommended)

Add this repo as a marketplace once, then install only the plugin(s) you want:

```bash
claude plugin marketplace add j0sh3rs/ai-skills
claude plugin install boston@ai-skills
claude plugin install brag-doc@ai-skills
claude plugin install twelve-factor-agent@ai-skills
claude plugin install twelve-factor-app@ai-skills
```

Install any subset — none of the four depend on each other. To update later:

```bash
claude plugin marketplace update ai-skills
```

### Option B: Manual install (single skill, no plugin machinery)

If you just want the skill file itself with no hook, clone the repo and copy the skill into your skills directory — user-level (`~/.claude/skills/`) for use across every project, or project-level (`.claude/skills/` inside a specific repo) for just that project:

```bash
git clone https://github.com/j0sh3rs/ai-skills.git
cp -r ai-skills/plugins/boston/skills/boston ~/.claude/skills/boston
```

Restart Claude Code (or start a new session) to pick up the new skill. Note: this manual route skips any hook a plugin would otherwise install (e.g. `brag-doc`'s Stop hook, `twelve-factor-app`'s scan hook) — for that, use Option A.

## Repo layout

```
plugins/<name>/.claude-plugin/plugin.json   — per-plugin manifest (independently installable)
plugins/<name>/skills/<name>/SKILL.md       — the skill itself (frontmatter + rules)
plugins/<name>/skills/<name>/README.md      — what it does, what problem it solves, who should use it
plugins/<name>/hooks/                       — the plugin's own hook(s) and tests, if any
docs/superpowers/specs/                     — design docs behind each skill's scope and rule choices (repo-wide, referenced by all plugins)
```

See [`CLAUDE.md`](./CLAUDE.md) for conventions to follow when adding a new skill/plugin.
