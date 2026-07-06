# Brag Doc Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `brag-doc` skill plus a `Stop` hook that together give an engineer a centralized, cross-repo record of their contributions — captured passively at session end and backfillable/summarizable on demand from GitHub and Jira.

**Architecture:** One skill file (`skills/brag-doc/SKILL.md`) holds the shared entry schema and all three behaviors: passive-capture instructions (followed when the hook blocks), `/brag-backfill <period>`, and `/brag-summarize <period>`. One standalone, dependency-free Node.js `Stop` hook (`hooks/brag-doc-stop.js`) fires at the end of every session, uses `stop_hook_active` to block exactly once per session, and hands off to Claude via its `reason` text to do the actual synthesis and ask the user. The document itself lives outside any project repo, at a path resolved from `$BRAG_DOC_PATH` or a default under `~/.claude/`.

**Tech Stack:** Node.js (v18+ built-ins only — `node:test`, `node:assert`, `node:path`, `node:os`; no npm dependencies, no `package.json`).

## Global Constraints

- Storage path resolution order: `$BRAG_DOC_PATH` env var, else `~/.claude/brag-doc.md` (per design doc "Storage").
- Entry frontmatter fields, exact names: `date`, `repo`, `links`, `tags`, `source` (`passive` | `backfill`) (per design doc "Entry Schema").
- Document format: single markdown file, reverse-chronological, grouped under `## <year>` then `### Q<n>` headers (per design doc "Document Structure").
- Dedup between passive capture and backfill is exact-match on `links` values only — no fuzzy/semantic matching (per design doc "Active Backfill", Non-goals).
- Backfill scope is identity-based (`@me` / `currentUser()`) — no maintained repo/project allowlist (per design doc "Active Backfill").
- `/brag-summarize` output is grouped by `tags` theme, shown in chat, AND saved to disk (per design doc "Active Summarize" + this session's explicit approval to save to disk).
- Stop hook is a standalone, dependency-free Node.js script — no shared hook utility module, matching this repo's existing two hooks (per design doc Non-goals, and repo convention in `hooks/twelve-factor-*.js`).
- Git-diff-summary generation across multiple commits is explicitly out of scope for this plan — deferred future enhancement (per design doc Non-goals, reaffirmed this session).
- No company-specific promo-packet templating, no auto-write into external promo-doc systems (per design doc Non-goals).

---

## File Structure

```
skills/brag-doc/SKILL.md         — schema + all three behaviors (passive-capture instructions, /brag-backfill, /brag-summarize)
skills/brag-doc/README.md        — what it does, what problem it solves, who should use it, non-goals
hooks/brag-doc-stop.js           — Stop hook: one-shot block via stop_hook_active, hands synthesis off to Claude via reason text
hooks/tests/brag-doc-stop.test.js
.claude-plugin/plugin.json       — modified: add "Stop" hook entry
README.md                        — modified: add brag-doc to skills table, add brag-doc-stop.js to hooks table
CLAUDE.md                        — modified: add brag-doc to "Current skills" list, update "Hooks" section to mention 3 hooks
```

`skills/brag-doc/SKILL.md` holds all three behaviors in one file rather than three separate skills — they share one audience (the engineer) and one schema, so splitting would duplicate the frontmatter spec three times for no benefit (this mirrors the "one skill = one file" convention already established by `boston`, `twelve-factor-agent`, `twelve-factor-app`).

---

### Task 1: `skills/brag-doc/SKILL.md` — schema and behavior spec

**Files:**
- Create: `skills/brag-doc/SKILL.md`

**Interfaces:**
- Produces: the entry schema (frontmatter field names `date`, `repo`, `links`, `tags`, `source`) and document path resolution rule that Tasks 3 and 6 reference by name.

This is a content file, not code — no test-first cycle applies. Verification is a deterministic structural check (frontmatter closes correctly, required sections exist).

- [ ] **Step 1: Write the file**

Create `skills/brag-doc/SKILL.md`:

```markdown
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

Every behavior below (passive capture, backfill, summarize) uses this same resolution order. If the file doesn't exist yet, create it — including its first `## <year>` / `### Q<n>` headers — when the first entry is appended.

## Document Structure

Single file, reverse-chronological. Entries are grouped under `## <year>` headers, then `### Q<n>` headers within each year. Within a quarter, newest entries first.

## Entry Schema

Each entry: a `#### <date> — <short title>` heading, a YAML frontmatter block, then a narrative paragraph.

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
the gap between "rule stated" and "rule checked" for 4 of 18 rules.
```

Field reference:

| Field | Meaning |
|---|---|
| `date` | ISO date (`YYYY-MM-DD`), used to sort into year/quarter sections |
| `repo` | Originating repo (`owner/name`) |
| `links` | Canonical PR URLs / Jira ticket keys — also the dedup key between passive capture and backfill |
| `tags` | Freeform theme taxonomy, used by `/brag-summarize` to group entries |
| `source` | `passive` or `backfill` |

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
2. Read the Brag Doc at the resolved path. Collect every `links` value from every frontmatter block into a known-links set. If the doc doesn't exist yet, the set is empty.
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
```

- [ ] **Step 2: Verify the frontmatter is well-formed**

Run: `head -n 20 skills/brag-doc/SKILL.md | grep -c '^---$'`
Expected: `2`

- [ ] **Step 3: Verify the skill name and required sections are present**

Run: `grep -c '^name: brag-doc$' skills/brag-doc/SKILL.md && grep -c '^## Passive Capture$' skills/brag-doc/SKILL.md && grep -c '^## Active Backfill: /brag-backfill <period>$' skills/brag-doc/SKILL.md && grep -c '^## Active Summarize: /brag-summarize <period>$' skills/brag-doc/SKILL.md`
Expected: `1` printed four times (once per command).

- [ ] **Step 4: Commit**

```bash
mkdir -p skills/brag-doc
git add skills/brag-doc/SKILL.md
git commit -m "feat: add brag-doc skill schema and behaviors"
```

---

### Task 2: `skills/brag-doc/README.md` — skill overview

**Files:**
- Create: `skills/brag-doc/README.md`

**Interfaces:**
- Consumes: nothing new — references `skills/brag-doc/SKILL.md` (Task 1) and the design doc.

- [ ] **Step 1: Write the file**

Create `skills/brag-doc/README.md`:

```markdown
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
```

- [ ] **Step 2: Verify required sections are present**

Run: `grep -c '^## Non-goals$' skills/brag-doc/README.md && grep -c 'brag-doc-skill-design.md' skills/brag-doc/README.md`
Expected: `1` printed twice.

- [ ] **Step 3: Commit**

```bash
git add skills/brag-doc/README.md
git commit -m "docs: add brag-doc skill README"
```

---

### Task 3: `hooks/brag-doc-stop.js` — Stop hook, path resolution and block-reason logic

**Files:**
- Create: `hooks/brag-doc-stop.js`
- Test: `hooks/tests/brag-doc-stop.test.js`

**Interfaces:**
- Produces: `resolveBragDocPath(env) -> string` — exported via `module.exports.resolveBragDocPath`. Takes an env-like object (e.g. `process.env`); returns `env.BRAG_DOC_PATH` if set, else `path.join(os.homedir(), '.claude', 'brag-doc.md')`.
- Produces: `buildBlockReason(docPath) -> string` — exported via `module.exports.buildBlockReason`. Takes the resolved doc path; returns the `reason` string sent back to Claude Code on block, referencing the doc path, `AskUserQuestion`, `skills/brag-doc/SKILL.md`, and the `BRAG_DOC_STOP_OFF` escape hatch.

- [ ] **Step 1: Write the failing tests**

Create `hooks/tests/brag-doc-stop.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const os = require("node:os");
const {
  resolveBragDocPath,
  buildBlockReason,
} = require("../brag-doc-stop.js");

test("resolveBragDocPath returns BRAG_DOC_PATH when set", () => {
  const result = resolveBragDocPath({ BRAG_DOC_PATH: "/tmp/custom-brag.md" });
  assert.strictEqual(result, "/tmp/custom-brag.md");
});

test("resolveBragDocPath falls back to ~/.claude/brag-doc.md when unset", () => {
  const result = resolveBragDocPath({});
  assert.strictEqual(
    result,
    path.join(os.homedir(), ".claude", "brag-doc.md"),
  );
});

test("buildBlockReason includes the resolved doc path", () => {
  const reason = buildBlockReason("/tmp/custom-brag.md");
  assert.ok(reason.includes("/tmp/custom-brag.md"));
});

test("buildBlockReason references AskUserQuestion", () => {
  const reason = buildBlockReason("/tmp/custom-brag.md");
  assert.ok(reason.includes("AskUserQuestion"));
});

test("buildBlockReason references the brag-doc SKILL.md", () => {
  const reason = buildBlockReason("/tmp/custom-brag.md");
  assert.ok(reason.includes("skills/brag-doc/SKILL.md"));
});

test("buildBlockReason documents the BRAG_DOC_STOP_OFF escape hatch", () => {
  const reason = buildBlockReason("/tmp/custom-brag.md");
  assert.ok(reason.includes("BRAG_DOC_STOP_OFF"));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test hooks/tests/brag-doc-stop.test.js`
Expected: FAIL with `Cannot find module '../brag-doc-stop.js'`

- [ ] **Step 3: Write minimal implementation**

Create `hooks/brag-doc-stop.js`:

```javascript
#!/usr/bin/env node
// brag-doc-stop — Stop hook
// Prompts Claude, at the end of every session, to synthesize loggable work
// and ask the user whether to record it in their centralized Brag Doc.
// Uses stop_hook_active to fire the block exactly once per session, then
// allows the retry stop through. Escape hatch: BRAG_DOC_STOP_OFF=1 disables
// the hook entirely. See: docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md

const path = require("node:path");
const os = require("node:os");

function resolveBragDocPath(env) {
  if (env.BRAG_DOC_PATH) return env.BRAG_DOC_PATH;
  return path.join(os.homedir(), ".claude", "brag-doc.md");
}

function buildBlockReason(docPath) {
  return (
    "brag-doc: session ending. Before stopping, check this session for loggable " +
    "engineering work (commits made, PRs opened, concrete decisions or fixes) — " +
    "pure exploration or research with no commits or decisions is not loggable. " +
    "If nothing loggable happened, allow this stop silently. If loggable work exists, " +
    "follow the passive-capture instructions in skills/brag-doc/SKILL.md: synthesize a " +
    `draft entry and ask the user via AskUserQuestion whether to log it to ${docPath}. ` +
    "Escape hatch: set BRAG_DOC_STOP_OFF=1 to disable this check for the session."
  );
}

module.exports = { resolveBragDocPath, buildBlockReason };

// --- stdin/stdout wiring (skipped when required as a module by tests) ---
if (require.main === module) {
  if (process.env.BRAG_DOC_STOP_OFF === "1") {
    process.stdout.write("OK");
  } else {
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        if (data.stop_hook_active) {
          process.stdout.write("OK");
          return;
        }
        const docPath = resolveBragDocPath(process.env);
        process.stdout.write(
          JSON.stringify({
            decision: "block",
            reason: buildBlockReason(docPath),
          }),
        );
      } catch (e) {
        process.stdout.write("OK");
      }
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test hooks/tests/brag-doc-stop.test.js`
Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add hooks/brag-doc-stop.js hooks/tests/brag-doc-stop.test.js
git commit -m "feat: add brag-doc-stop Stop hook

One-shot block-then-allow hook (via stop_hook_active) that prompts
Claude to synthesize loggable session work and ask the user whether
to log it. Escape hatch via BRAG_DOC_STOP_OFF=1."
```

---

### Task 4: Wire the Stop hook into `.claude-plugin/plugin.json`

**Files:**
- Modify: `.claude-plugin/plugin.json`

**Interfaces:**
- Consumes: `hooks/brag-doc-stop.js` from Task 3 (path only, invoked as a subprocess via `${CLAUDE_PLUGIN_ROOT}`).

Current file content (read before this task, verified in-session):

```json
{
  "name": "ai-skills",
  "version": "0.1.0",
  "description": "Boston accent mode plus 12-Factor App and 12-Factor Agent discipline skills for Claude Code.",
  "author": {
    "name": "j0sh3rs",
    "url": "https://github.com/j0sh3rs"
  },
  "homepage": "https://github.com/j0sh3rs/ai-skills",
  "repository": "https://github.com/j0sh3rs/ai-skills",
  "license": "MIT",
  "keywords": ["skills", "12-factor", "productivity"],
  "skills": "./skills/",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-app-scan.js\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-gate.js\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 1: No test to write first — this is a config change, not code.** Skip to implementation. (Verification happens in Task 5 via manual stdin/stdout checks, and in this task's Step 3 via a JSON-validity check.)

- [ ] **Step 2: Edit `plugin.json` to add the `Stop` hook entry**

Add a `"Stop"` key inside `"hooks"`, after `"PreToolUse"`:

```json
{
  "name": "ai-skills",
  "version": "0.1.0",
  "description": "Boston accent mode plus 12-Factor App and 12-Factor Agent discipline skills for Claude Code.",
  "author": {
    "name": "j0sh3rs",
    "url": "https://github.com/j0sh3rs"
  },
  "homepage": "https://github.com/j0sh3rs/ai-skills",
  "repository": "https://github.com/j0sh3rs/ai-skills",
  "license": "MIT",
  "keywords": ["skills", "12-factor", "productivity"],
  "skills": "./skills/",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-app-scan.js\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-gate.js\"",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/brag-doc-stop.js\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat: wire brag-doc-stop hook into plugin manifest"
```

---

### Task 5: End-to-end manual verification of the Stop hook's stdin/stdout wiring

**Files:**
- None created/modified — this task exercises Task 3's output as installed, using shell-piped JSON payloads to simulate what Claude Code sends to a `Stop` hook.

**Interfaces:**
- Consumes: `hooks/brag-doc-stop.js` as a standalone executable (its `require.main === module` stdin/stdout path, untested by Task 3's unit tests, which only exercise the exported pure functions).

- [ ] **Step 1: Verify the hook blocks when `stop_hook_active` is absent/false**

Run:
```bash
echo '{"session_id": "test", "transcript_path": "/tmp/fake.jsonl", "hook_event_name": "Stop"}' | node hooks/brag-doc-stop.js
```
Expected: JSON output containing `"decision":"block"` and a `"reason"` mentioning `AskUserQuestion` and `skills/brag-doc/SKILL.md`.

- [ ] **Step 2: Verify the hook allows through when `stop_hook_active` is true**

Run:
```bash
echo '{"session_id": "test", "stop_hook_active": true}' | node hooks/brag-doc-stop.js
```
Expected: `OK`

- [ ] **Step 3: Verify the escape hatch bypasses the hook entirely**

Run:
```bash
BRAG_DOC_STOP_OFF=1 bash -c 'echo "{\"stop_hook_active\": false}" | node hooks/brag-doc-stop.js'
```
Expected: `OK` (hook is bypassed even though `stop_hook_active` is false).

- [ ] **Step 4: Verify a custom `BRAG_DOC_PATH` is reflected in the block reason**

Run:
```bash
BRAG_DOC_PATH=/tmp/my-brag.md bash -c 'echo "{\"stop_hook_active\": false}" | node hooks/brag-doc-stop.js'
```
Expected: JSON output whose `"reason"` includes `/tmp/my-brag.md`.

No commit for this task — it's manual verification of Tasks 3–4's output, produces no new files.

---

### Task 6: Update repo-level documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing new — references file paths from Tasks 1–4 (`skills/brag-doc/SKILL.md`, `skills/brag-doc/README.md`, `hooks/brag-doc-stop.js`, the `plugin.json` `Stop` hook entry).

- [ ] **Step 1: No test — documentation change.**

- [ ] **Step 2: Add `brag-doc` to the skills table in `README.md`**

Current table row block (read before this task, verified in-session) ends with the `twelve-factor-app` row. Add a new row immediately after it:

```markdown
| [`brag-doc`](./skills/brag-doc/README.md) | Centralized, cross-repo Brag Doc — passive session capture (Stop hook) plus active `/brag-backfill` and `/brag-summarize` for GitHub/Jira-sourced contribution tracking and promo-packet synthesis. |
```

- [ ] **Step 3: Add `brag-doc-stop.js` to the hooks table in `README.md`**

Add a new row to the existing hooks table, after the `twelve-factor-gate.js` row:

```markdown
| `hooks/brag-doc-stop.js` | `Stop` (session end) | Blocks the first stop attempt per session to prompt Claude to synthesize loggable work and ask the user whether to log it; allows the retry through via `stop_hook_active`. Escape hatch: `BRAG_DOC_STOP_OFF=1`. |
```

- [ ] **Step 4: Add `brag-doc` to the "Current skills" list in `CLAUDE.md`**

Add a new bullet to the existing "Current skills" list, after the `twelve-factor-app` bullet:

```markdown
- `skills/brag-doc/SKILL.md` — centralized, cross-repo Brag Doc: `Stop`-hook-triggered passive capture, `/brag-backfill` GitHub/Jira contribution search, `/brag-summarize` promo-packet synthesis.
```

- [ ] **Step 5: Update the "Hooks" section in `CLAUDE.md` to mention all three hooks**

Replace the current "Hooks" section paragraph:

```markdown
`hooks/twelve-factor-app-scan.js` and `hooks/twelve-factor-gate.js` are the only hooks in this repo, wired into `.claude-plugin/plugin.json`'s `hooks` key. Each is a standalone, dependency-free Node.js script — no shared hook utility module, no external pattern-config file. If adding another hook, check `docs/superpowers/specs/2026-07-05-hook-enforcement-design.md` first: most twelve-factor rules are explicitly scoped OUT of hook enforcement because a single tool-call event can't deterministically verify them (architectural/runtime concerns like Disposability or Dev/Prod Parity). Don't force-fit a hook onto those — that scope boundary is permanent, not a backlog item.
```

with:

```markdown
`hooks/twelve-factor-app-scan.js`, `hooks/twelve-factor-gate.js`, and `hooks/brag-doc-stop.js` are the hooks in this repo, wired into `.claude-plugin/plugin.json`'s `hooks` key. Each is a standalone, dependency-free Node.js script — no shared hook utility module, no external pattern-config file. The first two enforce specific twelve-factor rules — check `docs/superpowers/specs/2026-07-05-hook-enforcement-design.md` before adding another rule-enforcement hook, since most twelve-factor rules are explicitly scoped OUT of hook enforcement (architectural/runtime concerns a single tool-call event can't deterministically verify). `brag-doc-stop.js` is unrelated to the twelve-factor skills — see `docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md` for its own scope rationale.
```

- [ ] **Step 6: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document the brag-doc skill and its Stop hook"
```

---

## Self-Review Notes

**Spec coverage:** Storage/path resolution → Task 3 (`resolveBragDocPath`) and Task 1 (Document Location section). Document structure and entry schema → Task 1. Passive capture flow → Task 1 (Passive Capture section) + Task 3 (hook mechanics) + Task 4 (wiring) + Task 5 (verification). Active backfill → Task 1 (Active Backfill section). Active summarize, including save-to-disk → Task 1 (Active Summarize section, Step 7). Non-goals (no git-diff synthesis, no shared hook utility, no promo templating, no fuzzy dedup, no allowlist) → respected throughout; called out explicitly in Global Constraints and in Task 1/2's non-goals references.

**Placeholder scan:** No TBD/TODO; every step has complete file content or exact commands with expected output.

**Type consistency:** `resolveBragDocPath(env)` and `buildBlockReason(docPath)` signatures are identical between Task 3's test file (Step 1) and implementation (Step 3). The doc path returned by `resolveBragDocPath` is the same value threaded into `buildBlockReason` in the hook's stdin/stdout wiring. Entry frontmatter field names (`date`, `repo`, `links`, `tags`, `source`) are used identically across Task 1's schema definition, Passive Capture section, and Active Backfill/Summarize sections — no drift.
