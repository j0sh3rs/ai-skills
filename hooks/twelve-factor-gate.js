#!/usr/bin/env node
// twelve-factor-gate — PreToolUse hook (Bash)
// Blocks destructive/irreversible commands, reinforcing the
// twelve-factor-agent skill's "Contact Humans With Tools" rule. Allows a
// retry through once the transcript shows the assistant justified the
// action. Escape hatch: TWELVE_FACTOR_GATE_OFF=1 disables the gate entirely.
// See: docs/superpowers/specs/2026-07-05-hook-enforcement-design.md

const fs = require("fs");

const DESTRUCTIVE_PATTERNS = [
  {
    re: /git\s+push\s+.*(--force|-f\b)/,
    label: "force-push (rewrites shared history)",
  },
  {
    re: /(?:^|\s)rm\s+-[a-z]*r[a-z]*f[a-z]*\b/i,
    label: "rm -rf (recursive forced delete)",
  },
  {
    re: /(?:^|\s)rm\s+-[a-z]*f[a-z]*r[a-z]*\b/i,
    label: "rm -fr (recursive forced delete)",
  },
  {
    re: /git\s+reset\s+--hard/,
    label: "git reset --hard (discards uncommitted work)",
  },
  {
    re: /git\s+clean\s+-[a-z]*f/,
    label: "git clean -f (deletes untracked files)",
  },
  { re: /\bDROP\s+TABLE\b/i, label: "DROP TABLE (irreversible schema change)" },
  {
    re: /\bDROP\s+DATABASE\b/i,
    label: "DROP DATABASE (irreversible data loss)",
  },
];

function matchesDestructivePattern(command) {
  for (const { re, label } of DESTRUCTIVE_PATTERNS) {
    if (re.test(command)) return label;
  }
  return null;
}

// Heuristic: the model is expected to have surfaced the risky action and its
// reasoning to the user in its immediately preceding assistant message
// before retrying. We look for common justification phrasing rather than
// requiring a fixed template, since assistant phrasing varies.
const JUSTIFICATION_MARKERS =
  /\b(confirmed with|user (approved|agreed|confirmed)|explicitly (asked|requested|confirmed)|intentional|per the user's|as (discussed|requested))\b/i;

function wasJustified(transcriptPath) {
  try {
    const raw = fs.readFileSync(transcriptPath, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch (e) {
        continue;
      }
      if (entry.type !== "assistant") continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join(" ");
      return JUSTIFICATION_MARKERS.test(text);
    }
    return false;
  } catch (e) {
    return false;
  }
}

module.exports = { matchesDestructivePattern, wasJustified };

// --- stdin/stdout wiring (skipped when required as a module by tests) ---
if (require.main === module) {
  if (process.env.TWELVE_FACTOR_GATE_OFF === "1") {
    process.stdout.write("OK");
  } else {
    let input = "";
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => {
      try {
        const data = JSON.parse(input);
        const command = data.tool_input && data.tool_input.command;
        if (!command) {
          process.stdout.write("OK");
          return;
        }
        const label = matchesDestructivePattern(command);
        if (!label) {
          process.stdout.write("OK");
          return;
        }
        if (data.transcript_path && wasJustified(data.transcript_path)) {
          process.stdout.write("OK");
          return;
        }
        process.stdout.write(
          JSON.stringify({
            decision: "block",
            reason:
              `twelve-factor-gate: this command matches a destructive/irreversible pattern (${label}): "${command}". ` +
              `Per the twelve-factor-agent skill's "Contact Humans With Tools" rule, surface this to the user and get ` +
              `explicit confirmation before retrying. If this session needs the gate off entirely, set TWELVE_FACTOR_GATE_OFF=1.`,
          }),
        );
      } catch (e) {
        process.stdout.write("OK");
      }
    });
  }
}
