# ai-skills

A collection of standalone Claude Code Skills to play with.

## Skills

| Skill | What it does |
|---|---|
| [`boston`](./skills/boston/README.md) | Bostonian-accent conversational mode — r-dropping, Boston vocabulary, casual profanity as flavoring. Code, commits, and anything meant to ship stay in plain professional English. |
| [`twelve-factor-agent`](./skills/twelve-factor-agent/README.md) | Session-behavior discipline for Claude Code itself, based on [humanlayer/12-factor-agents](https://github.com/humanlayer/12-factor-agents) — own your prompts, manage context deliberately, ask before risky actions, keep task scope small. |
| [`twelve-factor-app`](./skills/twelve-factor-app/README.md) | Code-review and scaffolding discipline for services Claude writes or reviews, based on [12factor.net](https://12factor.net/) — config from environment, non-privileged port binding, stateless processes, logs as event streams. |

Each skill's README covers what it does, what problem it solves, and who should use it. Design decisions and rationale for each (including what was deliberately left out) live in [`docs/superpowers/specs/`](./docs/superpowers/specs/).

## Hooks

Installing the plugin also installs two enforcement hooks that back the skills above with deterministic checks:

| Hook | Event | Posture |
|---|---|---|
| `hooks/twelve-factor-app-scan.js` | `PostToolUse` on Write/Edit | Warn-only — flags likely Config/Port-Binding/Logs rule violations via `additionalContext`, never blocks. |
| `hooks/twelve-factor-gate.js` | `PreToolUse` on Bash | Blocks destructive/irreversible commands (force-push, `rm -rf`, `git reset --hard`, etc.) until justification is shown in the transcript. Escape hatch: `TWELVE_FACTOR_GATE_OFF=1`. |

Only 4 of the 18 total rules across both skills have a hook — the rest require judgment a single tool-call event can't deterministically verify, and stay skill-only by design. See [`docs/superpowers/specs/2026-07-05-hook-enforcement-design.md`](./docs/superpowers/specs/2026-07-05-hook-enforcement-design.md) for the full scope rationale.

## Installation

### Option A: Claude Code plugin marketplace (recommended)

Add this repo as a marketplace, then install the plugin — this pulls in every skill above at once and keeps them updatable via the marketplace:

```bash
claude plugin marketplace add j0sh3rs/ai-skills
claude plugin install ai-skills@ai-skills
```

To update later:

```bash
claude plugin marketplace update ai-skills
```

### Option B: Manual install (single skill)

If you only want one skill rather than the whole plugin, clone the repo and copy the skill you want into your skills directory — user-level (`~/.claude/skills/`) for use across every project, or project-level (`.claude/skills/` inside a specific repo) for just that project:

```bash
git clone https://github.com/j0sh3rs/ai-skills.git
cp -r ai-skills/skills/boston ~/.claude/skills/boston
```

Restart Claude Code (or start a new session) to pick up the new skill.

## Repo layout

```
skills/<name>/SKILL.md   — the skill itself (frontmatter + rules)
skills/<name>/README.md  — what it does, what problem it solves, who should use it
docs/superpowers/specs/  — design docs behind each skill's scope and rule choices
```

See [`CLAUDE.md`](./CLAUDE.md) for conventions to follow when adding a new skill.
