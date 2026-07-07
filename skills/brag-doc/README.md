# brag-doc

Centralized, cross-repo Brag Doc — passive session capture plus active GitHub/Jira backfill and promo-packet summarization.

## What it does

Maintains one Brag Doc per engineer, independent of any single project repo. A `Stop` hook (`hooks/brag-doc-stop.js`) fires at the end of every session and prompts Claude to synthesize loggable work (commits, PRs, decisions) and ask the user whether to record it. Two invokable commands round it out: `/brag-backfill <period>` searches GitHub and Jira for contributions missed by passive capture, and `/brag-summarize <period>` generates a theme-grouped narrative suitable for a promo packet or self-review.

## What problem it solves

Accomplishments get forgotten between review cycles because nobody writes them down in the moment, and reconstructing months of contributions from memory at promo time is unreliable and incomplete. This skill captures work as it happens, backfills gaps from GitHub/Jira history, and turns the raw timeline into a synthesized narrative — so the historical record and the promo case both come from the same source of truth.

## Who should use it

Any engineer who wants a running record of their own contributions across every repo they touch, not scoped to one project. Especially useful heading into a performance review or promotion cycle.

## The `brag-doc-stop` hook

`hooks/brag-doc-stop.js` wires passive capture into every session. Registered on the `Stop` event in `.claude-plugin/plugin.json` — no matcher needed, since `Stop` fires once per session regardless of which tools ran.

Mechanics:

1. On the first stop attempt, the hook reads stdin for the Stop event payload and checks `stop_hook_active`.
2. If `stop_hook_active` is falsy (this is the first attempt), the hook returns `{"decision": "block", "reason": "..."}`. The `reason` text is the passive-capture instruction block — it tells Claude to review the session for loggable work and, if any exists, run the passive-capture steps in [`SKILL.md`](./SKILL.md) before stopping again.
3. Blocking a Stop event causes Claude Code to re-invoke Claude with that reason as additional context, then re-attempt the stop. On that retry, `stop_hook_active` is true, so the hook writes plain `"OK"` and lets the stop through — guaranteeing the block fires exactly once per session, never a loop.
4. If stdin can't be parsed as JSON for any reason, the hook fails open (`"OK"`) rather than blocking a stop it can't reason about.

The hook itself never writes to the Brag Doc — it only forces Claude to consider whether the session had anything worth logging, then defers to the skill and `AskUserQuestion` for the actual decision and write.

### Configuration

Both variables are read from the process environment at hook invocation time — set them in your shell profile, session env, or `~/.claude/settings.json` `env` block.

| Variable | Applies to | Default | Effect |
|---|---|---|---|
| `BRAG_DOC_PATH` | Hook + all three skill behaviors (passive capture, `/brag-backfill`, `/brag-summarize`) | `~/.claude/brag-doc.md` | Overrides the Brag Doc file location. Use this to point at a synced/dotfiles-managed path, or to keep separate docs per machine. Must resolve to the same path everywhere the skill runs, since `links` dedup depends on reading the existing file. |
| `BRAG_DOC_STOP_OFF` | Hook only | unset (hook active) | Set to `1` to disable the Stop-event block entirely for the session — the hook writes `"OK"` immediately without reading stdin. Passive capture stops firing; `/brag-backfill` and `/brag-summarize` are unaffected since they don't go through this hook. |

## Markdownlint compliance

Every markdown write this skill makes — passive-capture entries, `/brag-backfill` entries, and `/brag-summarize` output files — is checked with `skills/brag-doc/markdownlint-check.js` before it's written. It's a dependency-free re-implementation of the specific markdownlint rules the entry template can violate: blank lines around headings, fenced code blocks, and lists (MD022, MD031, MD032); list-item indentation (MD007); no bare URLs (MD034); the document opens with a top-level heading (MD041); no trailing whitespace/hard tabs/doubled blank lines (MD009, MD010, MD012); exactly one trailing newline (MD047). MD013 (line-length) is intentionally exempted — narrative prose isn't hard-wrapped. No `markdownlint-cli` install required, matching this repo's no-npm-dependency convention.

Each entry's metadata is a fenced ` ```yaml ` block rather than a bare `---`/`---` delimiter — a bare `---` right after a text line parses as a CommonMark setext-heading underline, not a thematic break, which real `markdownlint` flags. Fencing it also means block-style YAML lists and bare URLs inside the metadata are never interpreted as markdown, so `links` stays a plain, readable YAML list. See the Entry Schema in [`SKILL.md`](./SKILL.md#entry-schema) for the exact format, and `hooks/tests/brag-doc-markdownlint.test.js` for coverage — verified against both the dependency-free checker and the real `markdownlint` CLI.

## Non-goals

Git-diff-summary synthesis across multiple commits, company-specific promo-packet templating, fuzzy/semantic dedup, and repo/project allowlist configuration are explicitly out of scope for this version — see [the design doc](../../docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md) for the full rationale.

See [`SKILL.md`](./SKILL.md) for the full behavior spec.
