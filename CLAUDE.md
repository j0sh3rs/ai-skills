# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`ai-skills` is a marketplace of standalone Claude Code plugins, one per skill (`plugins/<name>/`), each independently installable — installing one does not pull in another. There is no build, lint, or test tooling beyond the hook test suite; every skill is a single markdown file with YAML frontmatter, discovered by Claude Code's skill loader via its path. Adding a skill means creating a new `plugins/<name>/` plugin (see below); there is no shared registry beyond the root `.claude-plugin/marketplace.json` listing.

## Repo layout

```
plugins/<name>/.claude-plugin/plugin.json   — per-plugin manifest (name, description, skills path, hooks if any)
plugins/<name>/skills/<name>/SKILL.md       — the skill itself (frontmatter + rules)
plugins/<name>/skills/<name>/README.md      — what it does, what problem it solves, who should use it
plugins/<name>/hooks/                       — the plugin's own hook(s) + hooks/tests/, only if the skill's design doc calls for one
.claude-plugin/marketplace.json             — lists all plugins, each with source: "./plugins/<name>"
docs/superpowers/specs/                     — design docs, repo-wide, referenced by whichever plugin(s) they cover
```

Each plugin is self-contained: its own manifest, its own skill, its own hook (if any). No plugin depends on another plugin's files. `docs/superpowers/specs/` is the one shared, repo-root location — design docs there apply to their named skill(s) but aren't duplicated per-plugin.

## Skill file conventions

Every skill in this repo follows the same one-file shape:

```markdown
---
name: <skill-name>
description: >
  What the skill does, and the trigger phrases/commands that should invoke it.
  Written for the skill loader, not for a human reading docs.
---

Body: rules and behavior the skill enforces, in imperative form.
```

- One skill = one file, no `agents/` or `commands/` subdirectories, unless a skill's design doc explicitly calls for them. A skill *may* have a sibling `hooks/` at its plugin root if the design doc calls for deterministic enforcement — see `plugins/brag-doc/hooks/` and `plugins/twelve-factor-app/hooks/` for the pattern.
- The `description` field must state concrete trigger phrases (e.g. "wicked mode", `/boston`) — this is what the loader matches against, not a general summary.
- Keep the body as direct behavioral rules, not narrative explanation. Look at `plugins/boston/skills/boston/SKILL.md` or `plugins/twelve-factor-agent/skills/twelve-factor-agent/SKILL.md` for the expected tone and structure.
- Skills that carry a "session behavior" vs "code being written" split should stay as separate plugins even if related (see `twelve-factor-agent` vs `twelve-factor-app`) — they have different audiences and should be installable/triggerable independently.

## Adding a new skill/plugin

1. Create `plugins/<name>/skills/<name>/SKILL.md` following the shape above.
2. Create `plugins/<name>/.claude-plugin/plugin.json` (copy an existing one as a template — `plugins/boston/.claude-plugin/plugin.json` for a hook-less skill, `plugins/brag-doc/.claude-plugin/plugin.json` for one with a hook).
3. If the skill needs a hook, add it under `plugins/<name>/hooks/` and wire it into that plugin's own `plugin.json` — never into another plugin's manifest.
4. Add an entry to the root `.claude-plugin/marketplace.json`'s `plugins` array with `"source": "./plugins/<name>"`.
5. Add a row to this repo's root `README.md` plugins table.

## Design process for new skills

New skills go through `superpowers:brainstorming` before any file is written — this is enforced by the harness (skills are creative/design work, not mechanical edits). The design doc lands in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` before implementation starts. When adding a skill, check that directory first — a spec may already exist covering scope decisions, rule selection, and explicit non-goals that the SKILL.md itself doesn't restate.

## Hooks

`plugins/twelve-factor-app/hooks/twelve-factor-app-scan.js`, `plugins/twelve-factor-agent/hooks/twelve-factor-gate.js`, and `plugins/brag-doc/hooks/brag-doc-stop.js` are the hooks in this repo, each wired into its own plugin's `.claude-plugin/plugin.json` `hooks` key — not shared, not cross-referenced between plugins. Each is a standalone, dependency-free Node.js script — no shared hook utility module, no external pattern-config file. The first two enforce specific twelve-factor rules — check `docs/superpowers/specs/2026-07-05-hook-enforcement-design.md` before adding another rule-enforcement hook, since most twelve-factor rules are explicitly scoped OUT of hook enforcement (architectural/runtime concerns a single tool-call event can't deterministically verify). `brag-doc-stop.js` is unrelated to the twelve-factor skills — see `docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md` for its own scope rationale.

## Current plugins

- `plugins/boston/` — Bostonian-accent conversational mode (accent transform rules, vocabulary, profanity-as-flavor, code/commit boundary). No hook.
- `plugins/twelve-factor-agent/` — session-behavior discipline for Claude Code itself, based on humanlayer/12-factor-agents (own your prompts, manage context window, ask before risky actions, small focused scope, etc). Ships `hooks/twelve-factor-gate.js`.
- `plugins/twelve-factor-app/` — code-review/scaffolding discipline for services Claude authors or reviews, based on 12factor.net (config in environment, non-privileged port binding, stateless processes, etc). Ships `hooks/twelve-factor-app-scan.js`.
- `plugins/brag-doc/` — centralized, cross-repo Brag Doc: `Stop`-hook-triggered passive capture, `/brag-backfill` GitHub/Jira contribution search, `/brag-summarize` promo-packet synthesis. Ships `hooks/brag-doc-stop.js`.

Each has a corresponding design doc in `docs/superpowers/specs/` explaining what was included/excluded from its source material and why.
