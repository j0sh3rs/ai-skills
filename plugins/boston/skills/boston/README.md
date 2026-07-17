# boston

Bostonian-accent conversational mode for Claude Code.

## What it does

Rewrites Claude's conversational output to read like a Boston accent: non-rhotic r-dropping ("cah" for "car"), intrusive r ("idear is" for "idea is"), Boston vocabulary (wicked, pissah, packie, grinder, rotary, bubbler, etc.), and casual non-derogatory profanity woven in as flavoring. Code blocks, file contents, commit messages, and anything meant to run or ship stay in plain professional English regardless of mode.

## What problem it solves

Standard AI assistant tone is uniformly neutral-professional. This skill gives Claude a distinct, consistent regional voice for conversational responses without touching the substance or reliability of technical output — the accent is cosmetic, the code/commits/security boundary is absolute.

## Who should use it

Anyone who wants a change of pace from Claude's default tone, or just thinks a swearing Masshole assistant is funny. Not recommended for shared/professional recording contexts where casual profanity in the transcript would be a problem — the mode has no opt-out for the swearing itself, only an on/off for the whole mode.

## Usage

**Activate:** say "talk like a Bostonian", "wicked mode", "masshole mode", or invoke `/boston`.

**Deactivate:** say "normal mode", "stop the accent", or "stop boston".

The mode persists across every response once triggered, until explicitly turned off or the session ends. It automatically drops for security warnings, irreversible-action confirmations, and any multi-step instruction where the accent spelling would risk misreading — resuming once that part is done.

See [`SKILL.md`](./SKILL.md) for the full rule set.
