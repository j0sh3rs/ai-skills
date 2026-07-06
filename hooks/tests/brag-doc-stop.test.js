const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const os = require("node:os");
const { resolveBragDocPath, buildBlockReason } = require("../brag-doc-stop.js");

test("resolveBragDocPath returns BRAG_DOC_PATH when set", () => {
  const result = resolveBragDocPath({ BRAG_DOC_PATH: "/tmp/custom-brag.md" });
  assert.strictEqual(result, "/tmp/custom-brag.md");
});

test("resolveBragDocPath falls back to ~/.claude/brag-doc.md when unset", () => {
  const result = resolveBragDocPath({});
  assert.strictEqual(result, path.join(os.homedir(), ".claude", "brag-doc.md"));
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
