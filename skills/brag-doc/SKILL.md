---
name: brag-doc
description: >
  Centralized, cross-repo record of an engineer's accomplishments and
  contributions — a living "Brag Doc" used both as a historical account of
  effectiveness and as source material for promotion packets. Covers three
  behaviors: passive capture (followed when the brag-doc-stop hook blocks a
  session's Stop event, synthesizing loggable work and asking the user
  whether to record it), active backfill via `/brag-backfill <period>`
  (searches GitHub and Jira for contributions missed by passive capture),
  and active summarize via `/brag-summarize <period>` (generates a
  theme-grouped promo-packet narrative from recorded entries). Use when the
  brag-doc-stop hook blocks a session's Stop event, or when the user invokes
  /brag-backfill, /brag-summarize, or says things like "log this to my brag
  doc", "backfill my contributions", "summarize my brag doc for promo".
---

Centralized record of engineering contributions. One document per engineer, independent of any single repo.

## Document Location

Resolve the Brag Doc path in this order:

1. `$BRAG_DOC_PATH` environment variable, if set.
2. Default: `~/.claude/brag-doc.md`.

Every behavior below (passive capture, backfill, summarize) uses this same resolution order. If the file doesn't exist yet, create it — with `# Brag Doc` as its first line (required, see Markdownlint Compliance), then its first `## <year>` / `### Q<n>` headers — when the first entry is appended.

## Document Structure

Single file, reverse-chronological. First line is a top-level `# Brag Doc` heading. Entries are grouped under `## <year>` headers, then `### Q<n>` headers within each year. Within a quarter, newest entries first.

## Entry Schema

Each entry: a `#### <date> — <short title>` heading, a fenced `yaml` metadata block, then a narrative paragraph.

```markdown
#### 2026-07-06 — Twelve-factor hook enforcement

​```yaml
date: 2026-07-06
repo: j0sh3rs/ai-skills
links:
  - https://github.com/j0sh3rs/ai-skills/pull/12
  - JIRA-4821
tags: [architecture, reliability, mentorship]
source: passive
​```

Shipped deterministic hook enforcement for two twelve-factor skills, closing
the gap between "rule stated" and "rule checked" for 4 of 18 rules.
```

The metadata block is a fenced ` ```yaml ` code block, not a bare `---`/`---` delimiter. A bare `---` immediately after a line of text (no blank line between them) parses as a CommonMark setext-heading underline for that line rather than a thematic break — real `markdownlint` flags this (MD022). Fencing the block sidesteps that trap and also means its content (block-style `links` list, bare URLs) is never interpreted as markdown, so no separate URL-wrapping or flow-style-array workaround is needed — `links` can stay a normal, readable block-style YAML list.

Field reference:

| Field | Meaning |
|---|---|
| `date` | ISO date (`YYYY-MM-DD`), used to sort into year/quarter sections |
| `repo` | Originating repo (`owner/name`) |
| `links` | Canonical PR URLs / Jira ticket keys, as a YAML list — also the dedup key between passive capture and backfill |
| `tags` | Freeform theme taxonomy, used by `/brag-summarize` to group entries |
| `source` | `passive` or `backfill` |

## Markdownlint Compliance

Every write to the Brag Doc (passive capture, backfill, and the summarize output file) must produce markdownlint-clean markdown:

- The document's first line is a top-level (`#`) heading (MD041) — required once, at document creation; entries never add another H1.
- Exactly one blank line before and after every heading, fenced code block, and list (MD022, MD031, MD032).
- List items are never indented unless nested under a parent item (MD007).
- No bare URLs outside a fence, autolink (`<...>`), inline code span, or markdown link (MD034).
- No trailing whitespace, no hard tabs, no multiple consecutive blank lines (MD009, MD010, MD012).
- File ends with exactly one trailing newline (MD047).
- MD013 (line-length) is intentionally not enforced — narrative prose is not hard-wrapped.

Before writing, run the **full resulting document content** (not just the appended fragment — MD041 is a whole-file check) through `skills/brag-doc/markdownlint-check.js`'s `lintMarkdown(content)` (dependency-free, no `markdownlint-cli` install required). If it returns any findings, fix the content and re-check — never write content with known findings. This is also covered by `hooks/tests/brag-doc-markdownlint.test.js`, which asserts real entry/summary output is clean against actual `markdownlint`.

## Passive Capture

Followed when the `brag-doc-stop` hook blocks a session's Stop event.

1. Review the session for loggable work: commits made, PRs opened, concrete decisions, bugs fixed, designs produced. Pure exploration or research with no commits or decisions is not loggable.
2. If nothing loggable happened, do nothing further — allow the next stop attempt to proceed.
3. If loggable work exists, synthesize one draft entry using the Entry Schema above: title, `date` (today), `repo` (current repo — e.g. from `git remote -v` or the working directory name), `links` (any PR/ticket URLs mentioned in the session or discoverable via `git log`), `tags` (your own judgment of theme), `source: passive`, and a narrative paragraph stating impact, not a bare list of actions taken.
4. Ask the user via `AskUserQuestion` whether to log it — options: log as-is, edit first, skip.
5. On "log as-is" or after edits, resolve the doc path (see Document Location) and append the entry under the correct `## <year>` / `### Q<n>` section, creating those headers if they don't exist yet. Sort entries within a quarter newest-first.
6. Allow the stop to proceed.

## Active Backfill: `/brag-backfill <period>`

Accepts `last-week`, `last-month`, `last-quarter`, or an explicit `<start-date>..<end-date>` range (`YYYY-MM-DD` on each side).

1. Resolve the period into a concrete date range.
2. Read the Brag Doc at the resolved path. Collect every `links` value from every metadata block into a known-links set. If the doc doesn't exist yet, the set is empty.
3. Search GitHub for the user's own authored work in range: prefer `mcp__github__search_pull_requests` / `mcp__github__search_issues` with an `author:@me` qualifier; if unavailable, fall back to `gh search prs --author=@me --merged` and `gh search commits --author=@me`, both scoped to the date range.
4. Search Jira via `mcp__atlassian-mcp__searchJiraIssuesUsingJql` with JQL: `assignee = currentUser() AND updated >= "<start>" AND updated <= "<end>"`.
5. For each result, extract its canonical link (PR URL, or Jira ticket key). Drop any result whose link is already in the known-links set.
6. For each remaining candidate, synthesize a draft entry (Entry Schema above, `source: backfill`).
7. Present the full candidate batch to the user in one message — not one `AskUserQuestion` per candidate — for approval, edit, or rejection as a set.
8. Append every approved entry into its correct year/quarter section.

## Active Summarize: `/brag-summarize <period>`

Accepts the same period formats as backfill, plus `all`.

1. Resolve the period into a date range (or the full document for `all`).
2. Read the Brag Doc, filter entries whose `date` falls in range.
3. If there are zero matching entries, say so plainly and stop — do not fabricate content.
4. Group the filtered entries by `tags` theme.
5. For each theme, write a rollup paragraph stating impact ("shipped X, reducing Y, enabling Z"), not a concatenation of raw entry text.
6. Display the full synthesized summary in chat.
7. Also save it to disk: same directory as the resolved Brag Doc path, filename `brag-doc-summary-<period>.md` (e.g. `brag-doc-summary-last-quarter.md`, or `brag-doc-summary-all.md`).
