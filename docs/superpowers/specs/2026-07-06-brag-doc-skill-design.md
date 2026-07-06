## Summary

A new skill + hook pair that automates discovery and documentation of an engineer's work across sessions and repos, synthesizing it into a centralized, cross-repo "Brag Doc" — a living record of accomplishments intended both as a historical account of effectiveness and as source material for promotion packets.

Two components:

- **Passive capture**: a `Stop` hook that fires at the end of every Claude Code session, prompting Claude to synthesize loggable work from the session and ask the user whether to record it.
- **Active backfill + summarize**: an invokable skill (`skills/brag-doc/SKILL.md`) that searches GitHub and Jira for a given period to backfill missed entries, and that generates theme-grouped promo-packet narratives on demand.

The document is centralized — one file per engineer, independent of any single repo — so it produces a coherent cross-project timeline rather than fragmenting across every repo the engineer touches.

## Storage

The Brag Doc lives outside any project repo. Path resolution order:

1. `$BRAG_DOC_PATH` environment variable, if set.
2. Default: `~/.claude/brag-doc.md`.

The skill states this resolution rule directly in its body — no separate config file to create or maintain.

## Document Structure

Single file, reverse-chronological, grouped under `## <year>` / `### Q<n>` headers for scannability. Newest entries at the top of their quarter section.

## Entry Schema

Each entry is an H4 heading with a short title, followed by a YAML frontmatter block, followed by a synthesized narrative paragraph:

```markdown
#### 2026-07-06 — Twelve-factor hook enforcement

---
date: 2026-07-06
repo: j0sh3rs/ai-skills
links:
  - https://github.com/j0sh3rs/ai-skills/pull/12
  - JIRA-4821
tags: [architecture, reliability, mentorship]
source: passive
---

Shipped deterministic hook enforcement for two twelve-factor skills, closing
the gap between "rule stated" and "rule checked" for 4 of 18 rules. Scoped
the remaining 14 as permanently skill-only after auditing hook-amenability —
prevented future force-fit attempts.
```

Fields:

| Field | Purpose |
|---|---|
| `date` | ISO date, used for sorting into year/quarter sections |
| `repo` | Originating repo, for cross-project context |
| `links` | Canonical PR URLs / Jira ticket keys — also the dedup key between passive capture and backfill |
| `tags` | Freeform taxonomy (the engineer's own categories), used by `/brag-summarize` to group entries by theme |
| `source` | `passive` or `backfill` — lets summarize attribute/weight appropriately |

Markdown-with-YAML-frontmatter was chosen over a JSON-source-plus-rendered-markdown split because it stays both human-editable and regex/frontmatter-parseable in one artifact, avoiding a two-file sync problem.

## Passive Capture (Stop hook)

**File:** `hooks/brag-doc-stop.js` — `Stop` event, no matcher (fires on every session end), dependency-free Node.js, matching this repo's existing hook style (`twelve-factor-app-scan.js`, `twelve-factor-gate.js`).

**Flow:**

1. Hook receives stop-hook input JSON on stdin and checks `stop_hook_active`.
2. If `true` (Claude already ran once this stop cycle) → exit 0, allow the stop. This prevents an infinite block loop.
3. If `false` → hook responds with `decision: "block"` and a `reason` instructing Claude to:
   - Review the session for loggable work (commits, PRs opened, decisions made, problems solved — not merely "files were edited").
   - If nothing loggable is found (pure exploration/research, no commits or concrete decisions), skip silently and allow the stop.
   - If loggable work is found, synthesize a draft entry (frontmatter + narrative) and ask the user via `AskUserQuestion` whether to log it (yes / edit / skip).
   - On yes/edit, resolve the doc path and append the entry to the correct year/quarter section, then allow the stop.
4. The second stop attempt (after Claude's response to the block) has `stop_hook_active: true`, so the hook allows exit cleanly.

The hook itself makes no judgment about content — it only gates the one-shot block/allow cycle. All synthesis and "is this loggable" reasoning happens in Claude, per `skills/brag-doc/SKILL.md`'s instructions, matching the passive/deterministic split used by the existing twelve-factor hooks.

Git-diff-summary generation (auto-extracting a per-commit summary across the session) is an explicitly deferred future enhancement, not part of this design — see Non-goals.

## Active Backfill (`/brag-backfill <period>`)

Part of `skills/brag-doc/SKILL.md`. Accepts `last-week`, `last-month`, `last-quarter`, or an explicit `YYYY-MM-DD..YYYY-MM-DD` range.

**Flow:**

1. Parse the period argument into a concrete date range.
2. Read the existing Brag Doc and extract every `links` value from every entry's frontmatter into a known-links set.
3. Query GitHub for the engineer's own authored work in that range — via `mcp__github__search_pull_requests` / `search_issues` (or `gh search prs/commits --author=@me` as a CLI fallback, stated in the skill for sessions where the MCP tool isn't available).
4. Query Jira via `mcp__atlassian-mcp__searchJiraIssuesUsingJql` with `assignee = currentUser() AND updated >= "<start>" AND updated <= "<end>"`.
5. Extract each result's canonical link (PR URL or ticket key) and drop any already present in the known-links set — this is the full dedup strategy, exact-match on link, no fuzzy matching.
6. Synthesize draft entries for the remaining candidates (`source: backfill`).
7. Present the complete candidate batch to the user in one pass — not one `AskUserQuestion` per candidate — since a full quarter's backfill could be dozens of items.
8. On approval, append entries into the correct year/quarter sections.

Scope for "whose work counts" is identity-based (`@me` / `currentUser()`), not a maintained repo/project allowlist — this avoids upkeep as the engineer moves between projects and teams.

## Active Summarize (`/brag-summarize <period>`)

Also part of `skills/brag-doc/SKILL.md`. Accepts the same period formats as backfill, plus `all`.

**Flow:**

1. Parse the period, filter the Brag Doc's entries to that range.
2. Group filtered entries by `tags` theme rather than strict chronology — promo packets read better organized by impact area (architecture, reliability, mentorship, etc.) than as a raw timeline.
3. For each theme, synthesize a rollup paragraph that states impact, not a bare concatenation of entries — e.g. "shipped X, reducing Y, enabling Z" rather than listing raw entry text back-to-back.
4. Display the synthesized summary in chat AND save it to disk at `~/.claude/brag-doc-summary-<period>.md` (or alongside `$BRAG_DOC_PATH`'s directory if that's set), so the user has a durable copy without needing to re-run the command.
5. If the filtered range has zero entries, say so plainly — no fabricated filler content.

The skill does not target any specific company's promo-packet template; output is a plain synthesized markdown narrative the user adapts to their own process.

## Non-goals

- **Git-diff-summary synthesis** across multiple commits in a session is deferred to a future enhancement. This design's passive capture relies on Claude's own session-transcript review (commits, PRs, decisions) rather than a dedicated diff-summarization step.
- **No shared hook utility module.** `hooks/brag-doc-stop.js` is a standalone, dependency-free script, matching the no-abstraction posture of the existing two hooks in this repo.
- **No company-specific promo-packet templating.** `/brag-summarize` produces a generic themed narrative; adapting it to a specific org's format is left to the user.
- **No fuzzy/semantic dedup** between passive and backfilled entries — dedup is exact-match on canonical links only.
- **No repo/project allowlist configuration** — backfill scope is identity-based (`@me` / `currentUser()`) across everything the user's GitHub/Jira credentials can see.
- **No auto-write of the summarize output into any promo-doc system** (Notion, Confluence, etc.) — output is markdown, saved locally and shown in chat.
