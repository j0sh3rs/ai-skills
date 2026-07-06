# brag-doc

Centralized, cross-repo Brag Doc — passive session capture plus active GitHub/Jira backfill and promo-packet summarization.

## What it does

Maintains one Brag Doc per engineer, independent of any single project repo. A `Stop` hook (`hooks/brag-doc-stop.js`) fires at the end of every session and prompts Claude to synthesize loggable work (commits, PRs, decisions) and ask the user whether to record it. Two invokable commands round it out: `/brag-backfill <period>` searches GitHub and Jira for contributions missed by passive capture, and `/brag-summarize <period>` generates a theme-grouped narrative suitable for a promo packet or self-review.

## What problem it solves

Accomplishments get forgotten between review cycles because nobody writes them down in the moment, and reconstructing months of contributions from memory at promo time is unreliable and incomplete. This skill captures work as it happens, backfills gaps from GitHub/Jira history, and turns the raw timeline into a synthesized narrative — so the historical record and the promo case both come from the same source of truth.

## Who should use it

Any engineer who wants a running record of their own contributions across every repo they touch, not scoped to one project. Especially useful heading into a performance review or promotion cycle.

## Non-goals

Git-diff-summary synthesis across multiple commits, company-specific promo-packet templating, fuzzy/semantic dedup, and repo/project allowlist configuration are explicitly out of scope for this version — see [the design doc](../../docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md) for the full rationale.

See [`SKILL.md`](./SKILL.md) for the full behavior spec.
