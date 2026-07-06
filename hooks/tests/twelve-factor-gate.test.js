const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {
  matchesDestructivePattern,
  wasJustified,
} = require("../twelve-factor-gate.js");

test("matchesDestructivePattern flags git push --force", () => {
  assert.ok(matchesDestructivePattern("git push --force origin main"));
});

test("matchesDestructivePattern flags git push -f", () => {
  assert.ok(matchesDestructivePattern("git push -f"));
});

test("matchesDestructivePattern flags rm -rf", () => {
  assert.ok(matchesDestructivePattern("rm -rf /tmp/build"));
});

test("matchesDestructivePattern flags git reset --hard", () => {
  assert.ok(matchesDestructivePattern("git reset --hard HEAD~3"));
});

test("matchesDestructivePattern flags git clean -f", () => {
  assert.ok(matchesDestructivePattern("git clean -fd"));
});

test("matchesDestructivePattern flags DROP TABLE", () => {
  assert.ok(matchesDestructivePattern('psql -c "DROP TABLE users;"'));
});

test("matchesDestructivePattern does not flag a normal git push", () => {
  assert.strictEqual(matchesDestructivePattern("git push origin main"), null);
});

test("matchesDestructivePattern does not flag rm on a single file", () => {
  assert.strictEqual(matchesDestructivePattern("rm old-file.txt"), null);
});

test("matchesDestructivePattern does not flag ls -rf-looking but unrelated text", () => {
  assert.strictEqual(
    matchesDestructivePattern('echo "rm -rf is dangerous"'),
    null,
  );
});

test("wasJustified returns false when transcript has no justification marker", () => {
  const tmpFile = path.join(
    os.tmpdir(),
    `transcript-${Date.now()}-nojust.jsonl`,
  );
  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "text", text: "Running the command now." }],
      },
    }) + "\n",
  );
  assert.strictEqual(wasJustified(tmpFile), false);
  fs.unlinkSync(tmpFile);
});

test("wasJustified returns true when the last assistant message contains a justification marker", () => {
  const tmpFile = path.join(os.tmpdir(), `transcript-${Date.now()}-just.jsonl`);
  fs.writeFileSync(
    tmpFile,
    JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "text",
            text: "Confirmed with the user: force-push is intentional to fix the shared branch history.",
          },
        ],
      },
    }) + "\n",
  );
  assert.strictEqual(wasJustified(tmpFile), true);
  fs.unlinkSync(tmpFile);
});

test("wasJustified returns false for a missing transcript file", () => {
  assert.strictEqual(wasJustified("/nonexistent/path/transcript.jsonl"), false);
});
