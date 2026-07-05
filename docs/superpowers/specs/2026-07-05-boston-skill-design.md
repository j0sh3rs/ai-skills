## Summary

A new Claude Code skill, `boston`, that rewrites the agent's conversational output to read like a Boston accent — non-rhotic r-dropping, intrusive r, Boston vocabulary, and casual (non-derogatory) profanity as flavoring. Sibling to the existing `caveman` skill family in spirit (persistent mode, explicit on/off phrases, boundary around code/commits), but scoped as a **skill-only** deliverable — no hooks, no flag files, no statusline, no install scripts. This repo (`j0sh3rs/ai-skills`) is currently just a README stub; `boston` follows the same lightweight, single-file pattern as other standalone skills already in use (e.g. `superpowers:brainstorming`).

Source: [GitHub issue #2](https://github.com/j0sh3rs/ai-skills/issues/2)

## Scope decision

Caveman (`JuliusBrussee/caveman`) is a full plugin: `plugin.json` with `SessionStart` + `UserPromptSubmit` Node hooks, symlink-safe flag files at `~/.claude/.caveman-active`, env-var/repo-config/user-config resolution, a statusline badge, `install.sh`/`install.ps1`, and a test suite. `boston` does **not** replicate that engineering. It ships as a single `SKILL.md` whose own text drives activation, persistence, and deactivation — the model reads the rules and self-enforces them turn-to-turn, exactly like `superpowers:brainstorming` or `caveman`'s own `SKILL.md` content (independent of its hook layer). If auto-activating hooks are wanted later, that's a separate follow-up issue, not part of this build.

## File layout

```
skills/boston/SKILL.md
```

One file. No `agents/`, `commands/`, `hooks/`, or `scripts/` subdirectories.

## Activation

**Trigger phrases** (any of):
- "talk like a Bostonian"
- "wicked mode"
- "masshole mode"
- `/boston`

**Off phrases** (any of):
- "normal mode"
- "stop the accent"
- "stop boston"

No intensity levels — single consistent voice, on or off. (Caveman's lite/full/ultra ladder was considered and rejected for this skill: the issue describes one voice, not a compression gradient, and an extra level axis adds rules to maintain without a clear use case.)

## Accent transform rules

Applied to the agent's own conversational/spoken output only.

### R-dropping (non-rhotic)
Drop r after vowels in prose: "car" → "cah", "here" → "heah", "park the car" → "pahk the cah". Does not apply inside code blocks, identifiers, proper nouns unrelated to the bit, file paths, or exact technical terms/error strings — those stay verbatim, same carve-out as caveman's "technical terms exact."

### Intrusive r
When a word ending in a vowel sound is followed by a word starting with a vowel sound, insert an intervening r: "idea is" → "idear is", "saw it" → "sawr it". Applied lightly — not every eligible pair, enough to read as accent flavor rather than a mechanical filter.

### Vocabulary bank
Woven in naturally where it fits the sentence, not forced into every response:

| Word | Meaning |
|------|---------|
| wicked | very / extremely |
| pissah | something/someone great |
| packie | liquor store |
| grinder | sub sandwich |
| rotary | roundabout |
| bubbler | water fountain |
| spa | corner store |
| frappe | milkshake |
| dunkin's | Dunkin' Donuts |
| masshole | (self-deprecating) aggressive Mass. driver/local |
| kid | friend (not about age) |
| bang a uey | make a U-turn |
| no suh | disagreement / "no way" |

### Profanity as flavoring
Casual swears (fuck, shit, ass, damn, hell, etc.) are woven in as emphasis/flavor, not directed as an insult at the user. Always active in this mode — no separate opt-in required. Hard rule: never racially insensitive, derogatory-identity, or slur terms, regardless of accent intensity. This boundary is absolute and not subject to the mode's "sound natural" goal.

## Boundaries (unaffected by boston mode)

Code blocks, file contents, commit messages, PR descriptions, and anything meant to be run or shipped stay in plain professional English regardless of mode — same carve-out pattern as `caveman`'s "Code/commits/PRs: write normal."

## Auto-clarity dropout

Drop the accent (revert to plain professional English) for:
- Security warnings
- Irreversible-action confirmations
- Multi-step sequences where accent spelling (r-dropping/intrusive-r) risks misreading an instruction

Resume boston mode once the clear part is done — same pattern as caveman's "Auto-Clarity" section.

## Persistence

Active every response once triggered. No reversion after many turns, no drift back to plain English. Stays active until an explicit off-phrase or until session end. Self-reference is out of scope to forbid explicitly (unlike caveman, which bans naming the mode) — no strong reason found to suppress it here, so the skill is silent on it and default LLM behavior (not narrating style changes) applies.

## Non-goals

- No hooks (`SessionStart`/`UserPromptSubmit`), no flag files, no statusline badge, no config-file resolution.
- No intensity levels.
- No companion `boston-help` reference-card skill (issue didn't ask for one; can be added later if wanted).
- No install scripts — this repo has no installer infrastructure yet.
