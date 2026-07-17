const test = require("node:test");
const assert = require("node:assert");
const { lintMarkdown } = require("../../skills/brag-doc/markdownlint-check.js");

test("lintMarkdown flags trailing whitespace", () => {
  const findings = lintMarkdown("# Title\n\nSome text   \n");
  assert.ok(findings.some((f) => f.rule === "MD009"));
});

test("lintMarkdown flags hard tabs", () => {
  const findings = lintMarkdown("# Title\n\nSome\ttext\n");
  assert.ok(findings.some((f) => f.rule === "MD010"));
});

test("lintMarkdown flags multiple consecutive blank lines", () => {
  const findings = lintMarkdown("# Title\n\nText\n\n\nMore text\n");
  assert.ok(findings.some((f) => f.rule === "MD012"));
});

test("lintMarkdown flags a heading with no blank line before it", () => {
  const findings = lintMarkdown("Some text\n#### Heading\n\nBody\n");
  assert.ok(findings.some((f) => f.rule === "MD022"));
});

test("lintMarkdown flags a heading with no blank line after it", () => {
  const findings = lintMarkdown("\n#### Heading\nBody immediately after\n");
  assert.ok(findings.some((f) => f.rule === "MD022"));
});

test("lintMarkdown flags a fenced code block with no blank line before it", () => {
  const findings = lintMarkdown("Some text\n```\ncode\n```\n\nMore text\n");
  assert.ok(findings.some((f) => f.rule === "MD031"));
});

test("lintMarkdown flags a fenced code block with no blank line after it", () => {
  const findings = lintMarkdown("Some text\n\n```\ncode\n```\nMore text\n");
  assert.ok(findings.some((f) => f.rule === "MD031"));
});

test("lintMarkdown flags a missing trailing newline", () => {
  const findings = lintMarkdown("# Title\n\nBody");
  assert.ok(findings.some((f) => f.rule === "MD047"));
});

test("lintMarkdown flags more than one trailing newline", () => {
  const findings = lintMarkdown("# Title\n\nBody\n\n");
  assert.ok(findings.some((f) => f.rule === "MD047"));
});

test("lintMarkdown flags a 2-space-indented top-level list item outside a fence (block-style YAML sequence)", () => {
  const findings = lintMarkdown(
    ["links:", "  - https://example.com/pull/1", "  - JIRA-1", ""].join("\n"),
  );
  assert.ok(findings.some((f) => f.rule === "MD007"));
});

test("lintMarkdown does not flag a properly nested list item", () => {
  const findings = lintMarkdown(
    ["- top level", "  - nested under it", ""].join("\n"),
  );
  assert.ok(!findings.some((f) => f.rule === "MD007"));
});

test("lintMarkdown does not flag an indented list inside a fenced yaml block", () => {
  const findings = lintMarkdown(
    [
      "```yaml",
      "links:",
      "  - https://example.com/pull/1",
      "  - JIRA-1",
      "```",
      "",
    ].join("\n"),
  );
  assert.ok(!findings.some((f) => f.rule === "MD007"));
});

test("lintMarkdown flags a list with no blank line before it", () => {
  const findings = lintMarkdown(
    ["Some text", "- item one", "- item two", "", "More text", ""].join("\n"),
  );
  assert.ok(
    findings.some((f) => f.rule === "MD032" && f.message.includes("preceded")),
  );
});

test("lintMarkdown flags a list with no blank line after it", () => {
  const findings = lintMarkdown(
    ["Some text", "", "- item one", "- item two", "More text", ""].join("\n"),
  );
  assert.ok(
    findings.some((f) => f.rule === "MD032" && f.message.includes("followed")),
  );
});

test("lintMarkdown flags a bare URL", () => {
  const findings = lintMarkdown("See https://example.com/pull/1 for detail.\n");
  assert.ok(findings.some((f) => f.rule === "MD034"));
});

test("lintMarkdown does not flag a bare URL inside a fenced yaml block", () => {
  const findings = lintMarkdown(
    ["```yaml", "links:", "  - https://example.com/pull/1", "```", ""].join(
      "\n",
    ),
  );
  assert.ok(!findings.some((f) => f.rule === "MD034"));
});

test("lintMarkdown does not flag a URL wrapped in autolink syntax", () => {
  const findings = lintMarkdown(
    "See <https://example.com/pull/1> for detail.\n",
  );
  assert.ok(!findings.some((f) => f.rule === "MD034"));
});

test("lintMarkdown does not flag a URL inside a markdown link", () => {
  const findings = lintMarkdown("See [the PR](https://example.com/pull/1).\n");
  assert.ok(!findings.some((f) => f.rule === "MD034"));
});

test("lintMarkdown does not flag a URL inside inline code", () => {
  const findings = lintMarkdown("Run `curl https://example.com/pull/1`.\n");
  assert.ok(!findings.some((f) => f.rule === "MD034"));
});

test("lintMarkdown flags a document whose first line is not a top-level heading", () => {
  const findings = lintMarkdown("## Not an H1\n\nBody\n");
  assert.ok(findings.some((f) => f.rule === "MD041"));
});

test("lintMarkdown does not flag a document starting with a top-level heading", () => {
  const findings = lintMarkdown("# Brag Doc\n\nBody\n");
  assert.ok(!findings.some((f) => f.rule === "MD041"));
});

test("lintMarkdown ignores leading blank lines when checking MD041", () => {
  const findings = lintMarkdown("\n\n# Brag Doc\n\nBody\n");
  assert.ok(!findings.some((f) => f.rule === "MD041"));
});

test("lintMarkdown does not flag lines over 80 characters (MD013 exempted)", () => {
  const longLine = "x".repeat(120);
  const findings = lintMarkdown(`# Title\n\n${longLine}\n`);
  assert.ok(!findings.some((f) => f.rule === "MD013"));
});

test("lintMarkdown returns no findings for a clean full brag-doc document (fenced yaml metadata, block-style links)", () => {
  const clean = [
    "# Brag Doc",
    "",
    "## 2026",
    "",
    "### Q3",
    "",
    "#### 2026-07-06 — Twelve-factor hook enforcement",
    "",
    "```yaml",
    "date: 2026-07-06",
    "repo: j0sh3rs/ai-skills",
    "links:",
    "  - https://github.com/j0sh3rs/ai-skills/pull/12",
    "  - JIRA-4821",
    "tags: [architecture, reliability]",
    "source: passive",
    "```",
    "",
    "Shipped deterministic hook enforcement, closing the gap between rule",
    "stated and rule checked.",
    "",
  ].join("\n");
  assert.deepStrictEqual(lintMarkdown(clean), []);
});

test("lintMarkdown returns no findings for a well-formed entry with a fenced code block in the narrative", () => {
  const clean = [
    "# Brag Doc",
    "",
    "#### 2026-07-06 — Example",
    "",
    "Body text before a snippet.",
    "",
    "```markdown",
    "example content",
    "```",
    "",
    "Body text after.",
    "",
  ].join("\n");
  assert.deepStrictEqual(lintMarkdown(clean), []);
});
