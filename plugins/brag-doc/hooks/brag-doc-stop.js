#!/usr/bin/env node
// brag-doc-stop — Stop hook
// Prompts Claude, at the end of every session, to synthesize loggable work
// and ask the user whether to record it in their centralized Brag Doc.
// Uses stop_hook_active to fire the block exactly once per session, then
// allows the retry stop through. Escape hatch: BRAG_DOC_STOP_OFF=1 disables
// the hook entirely. See design doc (repo root):
// docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md

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
