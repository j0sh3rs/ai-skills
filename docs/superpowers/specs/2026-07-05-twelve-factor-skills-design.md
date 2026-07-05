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

Of the 12 classic factors, 11 are included as code-review/scaffold rules Claude applies to code it authors or reviews. 1 is excluded as an org-level concern outside a code-review pass.

Rules are written as explicit Do/Don't pairs (revised 2026-07-05 — see Revision History) for unambiguous behavior and lower token cost than blended prose.

**Included:**

| Rule | Source factor | Behavior |
|------|---------------|----------|
| Dependencies | Factor 2 | Declare every dependency explicitly, pinned and isolated (lockfile/vendoring/venv). Flag ambient system-wide assumptions or missing isolation. |
| Config | Factor 3 | Anything that varies per-deploy comes from the environment. Flag hardcoded secrets, environment-named code blocks (`if env == "production"`), or a committed `.env` without `.env.example`. |
| Backing Services | Factor 4 | Treat databases, caches, queues, and third-party APIs as swappable attached resources. Flag hardcoded connection assumptions that couple code to one specific service instance. |
| Build, Release, Run | Factor 5 | Three strictly separate stages: build (artifact), release (artifact + config, unique ID), run (execute only — no compiling/fetching). Flag runtime compilation/dependency-fetching or in-place release patching. |
| Processes | Factor 6 | Stateless, share-nothing processes; state lives in a backing service. Flag in-memory/local-disk state and sticky sessions. |
| Port Binding (modified) | Factor 7 | App is self-contained, exports its service via its own bound port — not dependent on a runtime-injected external web server. By extension, never require root; bind only non-privileged ports (>=1024). A low port in production is a reverse-proxy/load-balancer's job, not the app's. |
| Concurrency | Factor 8 | Model distinct work as separate process types (web/worker/scheduler), each scaled independently by adding instances. Flag cron/worker logic folded into the request-handling process, or vertical-scaling hacks. |
| Disposability | Factor 9 | Fast startup, graceful `SIGTERM` shutdown, crash-only design (safe to `kill -9` with no manual cleanup on restart). Flag blocking init or ignored `SIGTERM`. |
| Dev/Prod Parity | Factor 10 | Same backing-service *type* in dev and prod (not SQLite-in-dev/Postgres-in-prod), aligned dependency versions. Flag lightweight dev substitutes for convenience. |
| Logs | Factor 11 | Logs are an unbuffered stdout/stderr event stream; execution environment routes/stores them. Flag custom log-file management, rotation, or shipping logic. |
| Admin Processes | Factor 12 | One-off admin/migration/backfill scripts reuse the app's own codebase, config-loading, and dependency environment. Flag standalone scripts that duplicate config/connection logic or drift from the app's dependency versions. |

**Excluded** (with rationale):

| Factor | Why excluded |
|--------|-------------|
| 1. Codebase | Org-level git/repo-topology practice, not something to flag during code authoring/review. |

## Revision History

**2026-07-05 (ultrathink pass):** Re-audited `twelve-factor-app` against the canonical 12factor.net text and found six fidelity gaps versus the source factors: Port Binding had fully dropped the "self-contained service export" half of Factor 7 in favor of the added security constraint (rather than including both); Build/Release/Run collapsed three stages into two; Disposability omitted crash-only design; Concurrency omitted process-type diversity; Dev/Prod Parity omitted the canonical backing-service-substitution example; Config framed the factor as secrets-only and omitted the environment-named-block anti-pattern; Dependencies omitted isolation (only covered declaration). Rewrote all ten included rules as explicit Do/Don't pairs to close these gaps while keeping the skill compact. Separately reversed the Admin Processes exclusion — on reflection it is a concrete, checkable, common AI-scaffolding failure mode (one-off scripts duplicating config instead of reusing the app's own), more actionable than several factors already included. Net: 10 → 11 included, 2 → 1 excluded.

## Non-goals

- No hooks in this pass (tracked as a follow-up issue).
- No intensity levels or activation flags — both skills apply their rules whenever relevant work is in progress (writing/reviewing code for `twelve-factor-app`; general session conduct for `twelve-factor-agent`), same always-on posture as other discipline skills in this repo.
- No merging the two skills into one file — they address different audiences (Claude's own session behavior vs. code Claude produces) and should be triggerable/reviewable independently.
