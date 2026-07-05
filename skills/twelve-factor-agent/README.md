# twelve-factor-agent

Session-behavior discipline for Claude Code, based on [humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents).

## What it does

Governs how Claude Code itself reasons and acts during a session — not the code it writes. Seven rules drawn from the 12-factor-agents guidance: own your prompts (treat skills as reviewable, not black boxes), own your context window (manage density deliberately, don't let it bloat), contact humans with tools (ask before risky/irreversible actions instead of assuming), own your control flow (understand what a subagent will do before spawning it), compact errors (restructure failures instead of re-dumping raw logs, cap retries), keep task/subagent scope small and focused, and pre-fetch context deterministically instead of guessing and looping.

## What problem it solves

Left unmanaged, an AI coding session can drift into bad habits: context bloats with unpruned tool output, subagents get spawned without understanding their scope, repeated errors get retried verbatim instead of diagnosed, and risky actions get taken without a checkpoint. This skill codifies the parts of the 12-factor-agents philosophy that are actually about session conduct — not agent-product architecture (webhooks, durable execution, multi-channel triggers) — so those habits are named and enforceable at the prompt level.

## Who should use it

Anyone running extended or complex Claude Code sessions — multi-file features, subagent-heavy workflows, long debugging loops — where session discipline matters more than for a quick one-off edit. Pairs with [`twelve-factor-app`](../twelve-factor-app/README.md), which covers the code being produced rather than the session producing it.

## Non-goals

Six factors from the source material are deliberately excluded because they describe standalone agent-product architecture (webhooks, durable pause/resume, multi-channel triggers, stateless-reducer modeling) rather than interactive session behavior. See [the design doc](../../docs/superpowers/specs/2026-07-05-twelve-factor-skills-design.md) for the full inclusion/exclusion rationale.

See [`SKILL.md`](./SKILL.md) for the full rule set.
