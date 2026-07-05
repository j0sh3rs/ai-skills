## Summary

Two new skills that codify 12-Factor principles for AI-assisted ("vibe coding") development with Claude Code / opencode:

- `skills/twelve-factor-agent/SKILL.md` — governs how Claude Code itself should reason and act during a session, based on [humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents).
- `skills/twelve-factor-app/SKILL.md` — governs code Claude authors or reviews for the user, based on [12factor.net](https://12factor.net/).

Both follow the existing single-file `SKILL.md` pattern established by `skills/boston/SKILL.md` (frontmatter + rules body, no hooks/agents/commands subdirectories).

Source: [GitHub issue #1](https://github.com/j0sh3rs/ai-skills/issues/1)

## Research findings

`humanlayer/12-factor-agents` (confirmed via `gh api repos/humanlayer/12-factor-agents/git/trees/main`) has **no `skills/` or `agents/` directory** — it is pure guidance content (markdown factors, code examples, workshops), not a source of ready-made Claude Code skills. There is nothing to adopt wholesale; both skills below are drafted from scratch based on the factors' content.

## Scope decision

The issue asks for skills **and/or hooks** to "enforce or validate" adherence. Hooks can deterministically block/gate (PreToolUse/PostToolUse/Stop); skills can only request good behavior via prompt content, which a model can still drift from. This repo has no hook infrastructure today (no `.claude/hooks`, no `settings.json` hook config). Building real enforcement hooks is a separate, larger engineering lift (matchers, settings wiring, testing).

**Decision:** ship both skills only in this pass. File a **follow-up GitHub issue** scoped to hook-based enforcement on top of these two skills (e.g. a `PostToolUse` hook flagging hardcoded secrets or a missing `.env.example` on Write/Edit, tied to the Config rule below) — explicitly deferred, not built now.

## File layout

```
skills/twelve-factor-agent/SKILL.md
skills/twelve-factor-app/SKILL.md
```

Two files, no subdirectories, matching `skills/boston/SKILL.md`.

## `twelve-factor-agent` — rule selection

Of the 13 factors in `12-factor-agents` (12 factors + appendix), 7 are included as concrete session-behavior rules. The other 6 are excluded because they describe agent *architecture/infrastructure* (how to build a standalone LLM-agent product) rather than *session behavior* (how Claude Code should reason/act while pair-coding with a user) — they don't map onto anything an interactive coding session does.

**Included:**

| Rule | Source factor | Behavior |
|------|---------------|----------|
| Own Your Prompts | Factor 2 | Treat skills/prompts as reviewable, testable, first-class artifacts. Don't blindly trust a framework- or plugin-provided prompt without reading it. |
| Own Your Context Window | Factor 3 | Actively manage context density. Know what's loaded. Compact/prune deliberately (e.g. summarize long tool output) rather than letting context bloat unmanaged. |
| Contact Humans With Tools | Factor 7 | Ask before risky, ambiguous, or irreversible actions — surfaced as a structured checkpoint (e.g. `AskUserQuestion`), not folded silently into a normal response. |
| Own Your Control Flow | Factor 8 | Understand what a subagent or parallel dispatch will actually do before spawning it. Don't hand control flow to a framework or agent chain blindly. |
| Compact Errors | Factor 9 | On repeated tool/build failures, restructure and compact the error before retrying rather than dumping the same raw log each time. Cap consecutive retries (e.g. 3) before escalating to the human. |
| Small Focused Scope | Factor 10 | Keep tasks and subagent dispatches narrow (roughly 3-20 steps). Decompose large asks into smaller scoped units rather than running one sprawling session. |
| Pre-fetch Context | Appendix/Factor 13 | Gather needed context deterministically upfront (grep/read/gh) rather than guessing, asking, and looping round-trips to discover it. |

**Excluded** (with rationale):

| Factor | Why excluded |
|--------|-------------|
| 1. Natural Language to Tool Calls | Describes how any LLM agent already works; nothing to instruct. |
| 4. Tools Are Structured Outputs | Infra-level (tool-call plumbing), not a session behavior. |
| 5. Unify Execution/Business State | Architecture concern for building a standalone agent product, not for using Claude Code interactively. |
| 6. Launch/Pause/Resume | Infra concern (webhooks, durable execution) — not applicable to an interactive session. |
| 11. Trigger From Anywhere | App/architecture concern (Slack/email/cron triggers), not a coding-session behavior. |
| 12. Stateless Reducer | Restates factors 5+8 "mostly for fun" per the source itself; no independent content. |

## `twelve-factor-app` — rule selection

Of the 12 classic factors, 10 are included as code-review/scaffold rules Claude applies to code it authors or reviews. 2 are excluded as org-level/deploy-ops concerns outside a code-review pass.

**Included:**

| Rule | Source factor | Behavior |
|------|---------------|----------|
| Dependencies | Factor 2 | Explicitly declare and pin dependencies. Flag implicit or system-wide assumptions ("works on my machine"). |
| Config | Factor 3 | Config and secrets come from the environment, never hardcoded. Flag a committed `.env` without a corresponding `.env.example`. |
| Backing Services | Factor 4 | Treat databases, caches, queues as swappable attached resources. Flag hardcoded connection assumptions that couple code to one specific service instance. |
| Build, Release, Run | Factor 5 | Don't blend build-time and run-time logic. Flag scripts/code that conflate the two stages. |
| Processes | Factor 6 | Flag local or in-memory state (e.g. a global variable holding session data) that breaks statelessness and horizontal scaling. |
| Port Binding (modified) | Factor 7 | Services must never require running as root — all runtime behavior under a non-privileged user. By extension, bind only non-privileged ports (>=1024), never 80/443/etc. directly; a low port in production is a reverse-proxy/load-balancer concern, not the app's. |
| Concurrency | Factor 8 | Favor stateless, horizontally-scalable process design over vertical scaling or in-process threading hacks. |
| Disposability | Factor 9 | Fast startup, graceful shutdown — handle `SIGTERM` cleanly, avoid long blocking init. |
| Dev/Prod Parity | Factor 10 | Flag dependency or config divergence between dev and prod ("works in dev only" patterns). |
| Logs | Factor 11 | Logs are an event stream to stdout/stderr, not custom log-file management code. |

**Excluded** (with rationale):

| Factor | Why excluded |
|--------|-------------|
| 1. Codebase | Org-level git/repo-topology practice, not something to flag during code authoring/review. |
| 12. Admin Processes | Niche; rarely surfaces in a typical code-review pass. |

## Non-goals

- No hooks in this pass (tracked as a follow-up issue).
- No intensity levels or activation flags — both skills apply their rules whenever relevant work is in progress (writing/reviewing code for `twelve-factor-app`; general session conduct for `twelve-factor-agent`), same always-on posture as other discipline skills in this repo.
- No merging the two skills into one file — they address different audiences (Claude's own session behavior vs. code Claude produces) and should be triggerable/reviewable independently.
