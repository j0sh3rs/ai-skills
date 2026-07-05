# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`ai-skills` is a collection of standalone Claude Code Skills (`skills/<name>/SKILL.md`). There is no build, lint, or test tooling — every skill is a single markdown file with YAML frontmatter, discovered by Claude Code's skill loader via its path. Adding a skill means creating `skills/<name>/SKILL.md`; there is no other wiring required (no registry, no index file to update).

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

- One skill = one file, no `agents/`, `commands/`, `hooks/`, or `scripts/` subdirectories, unless a skill's design doc explicitly calls for them.
- The `description` field must state concrete trigger phrases (e.g. "wicked mode", `/boston`) — this is what the loader matches against, not a general summary.
- Keep the body as direct behavioral rules, not narrative explanation. Look at `skills/boston/SKILL.md` or `skills/twelve-factor-agent/SKILL.md` for the expected tone and structure.
- Skills that carry a "session behavior" vs "code being written" split should stay as separate files even if related (see `twelve-factor-agent` vs `twelve-factor-app`) — they have different audiences and should be triggerable independently.

## Design process for new skills

New skills go through `superpowers:brainstorming` before any file is written — this is enforced by the harness (skills are creative/design work, not mechanical edits). The design doc lands in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` before implementation starts. When adding a skill, check that directory first — a spec may already exist covering scope decisions, rule selection, and explicit non-goals that the SKILL.md itself doesn't restate.

## Current skills

- `skills/boston/SKILL.md` — Bostonian-accent conversational mode (accent transform rules, vocabulary, profanity-as-flavor, code/commit boundary).
- `skills/twelve-factor-agent/SKILL.md` — session-behavior discipline for Claude Code itself, based on humanlayer/12-factor-agents (own your prompts, manage context window, ask before risky actions, small focused scope, etc).
- `skills/twelve-factor-app/SKILL.md` — code-review/scaffolding discipline for services Claude authors or reviews, based on 12factor.net (config in environment, non-privileged port binding, stateless processes, etc).

Each has a corresponding design doc in `docs/superpowers/specs/` explaining what was included/excluded from its source material and why.
