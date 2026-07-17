// brag-doc markdownlint compliance check
// Dependency-free re-implementation of the subset of markdownlint rules
// relevant to the Brag Doc entry template (heading/frontmatter/list/code-fence
// blocks appended by passive capture and /brag-backfill). Not a general
// markdownlint replacement — scoped to what this skill's output can violate.
// MD013 (line-length) is intentionally not checked — narrative prose is not
// hard-wrapped. See: docs/superpowers/specs/2026-07-06-brag-doc-skill-design.md

const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^```/;
const UL_ITEM_RE = /^(\s*)[-*+]\s+/;
const BARE_URL_RE = /https?:\/\/[^\s<>()\]]+/g;

function checkTrailingWhitespace(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    if (/[ \t]+$/.test(line)) {
      findings.push({
        rule: "MD009",
        line: i + 1,
        message: "Line has trailing whitespace",
      });
    }
  });
  return findings;
}

function checkHardTabs(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    if (line.includes("\t")) {
      findings.push({
        rule: "MD010",
        line: i + 1,
        message: "Line contains a hard tab",
      });
    }
  });
  return findings;
}

function checkMultipleBlankLines(lines) {
  const findings = [];
  let blankRun = 0;
  lines.forEach((line, i) => {
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun === 2) {
        findings.push({
          rule: "MD012",
          line: i + 1,
          message: "Multiple consecutive blank lines",
        });
      }
    } else {
      blankRun = 0;
    }
  });
  return findings;
}

function checkHeadingsSurroundedByBlankLines(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    if (!HEADING_RE.test(line)) return;
    const prev = i > 0 ? lines[i - 1] : null;
    const next = i < lines.length - 1 ? lines[i + 1] : null;
    if (prev !== null && prev.trim() !== "") {
      findings.push({
        rule: "MD022",
        line: i + 1,
        message: "Heading is not preceded by a blank line",
      });
    }
    if (next !== null && next.trim() !== "") {
      findings.push({
        rule: "MD022",
        line: i + 1,
        message: "Heading is not followed by a blank line",
      });
    }
  });
  return findings;
}

function checkFencedCodeBlockBlankLines(lines) {
  const findings = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (!FENCE_RE.test(line)) return;
    if (!inFence) {
      const prev = i > 0 ? lines[i - 1] : null;
      if (prev !== null && prev.trim() !== "") {
        findings.push({
          rule: "MD031",
          line: i + 1,
          message: "Fenced code block is not preceded by a blank line",
        });
      }
      inFence = true;
    } else {
      const next = i < lines.length - 1 ? lines[i + 1] : null;
      if (next !== null && next.trim() !== "") {
        findings.push({
          rule: "MD031",
          line: i + 1,
          message: "Fenced code block is not followed by a blank line",
        });
      }
      inFence = false;
    }
  });
  return findings;
}

// MD007 (ul-indent): a list item is "rooted" (not a nested continuation of a
// parent item) when the nearest preceding non-blank line isn't itself a list
// item at a strictly smaller indent. Rooted items must start at column 0.
function checkListIndentation(lines) {
  const findings = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = line.match(UL_ITEM_RE);
    if (!match) return;
    const indent = match[1].length;
    if (indent === 0) return;

    let prevIdx = i - 1;
    while (prevIdx >= 0 && lines[prevIdx].trim() === "") prevIdx -= 1;
    const prevMatch = prevIdx >= 0 ? lines[prevIdx].match(UL_ITEM_RE) : null;
    const isNested = prevMatch !== null && prevMatch[1].length < indent;
    if (!isNested) {
      findings.push({
        rule: "MD007",
        line: i + 1,
        message: `Unordered list indentation (expected 0, got ${indent})`,
      });
    }
  });
  return findings;
}

// MD032 (blanks-around-lists): each contiguous run of list-item lines needs a
// blank line immediately before and after it.
function checkBlanksAroundLists(lines) {
  const findings = [];
  let inFence = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      i += 1;
      continue;
    }
    if (inFence || !UL_ITEM_RE.test(line)) {
      i += 1;
      continue;
    }
    const start = i;
    let end = i;
    while (end + 1 < lines.length && UL_ITEM_RE.test(lines[end + 1])) {
      end += 1;
    }
    const prev = start > 0 ? lines[start - 1] : null;
    const next = end < lines.length - 1 ? lines[end + 1] : null;
    if (prev !== null && prev.trim() !== "") {
      findings.push({
        rule: "MD032",
        line: start + 1,
        message: "List should be preceded by a blank line",
      });
    }
    if (next !== null && next.trim() !== "") {
      findings.push({
        rule: "MD032",
        line: end + 1,
        message: "List should be followed by a blank line",
      });
    }
    i = end + 1;
  }
  return findings;
}

// MD034 (no-bare-urls): a bare http(s) URL outside an autolink (<...>),
// markdown link ([text](url)), or inline code span.
function checkBareUrls(lines) {
  const findings = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const stripped = line
      .replace(/`[^`]*`/g, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\[[^\]]*\]\([^)]*\)/g, "");
    const matches = stripped.match(BARE_URL_RE);
    if (matches) {
      matches.forEach(() => {
        findings.push({
          rule: "MD034",
          line: i + 1,
          message: "Bare URL used",
        });
      });
    }
  });
  return findings;
}

const H1_RE = /^#\s/;

// MD041 (first-line-heading): the document's first non-blank line must be a
// top-level (H1) heading, or markdownlint treats the whole file as headingless.
function checkFirstLineHeading(lines) {
  const firstNonBlank = lines.find((line) => line.trim() !== "");
  if (firstNonBlank === undefined) return [];
  if (!H1_RE.test(firstNonBlank)) {
    return [
      {
        rule: "MD041",
        line: 1,
        message: "First line in a file should be a top-level heading",
      },
    ];
  }
  return [];
}

function checkFinalNewline(content) {
  if (content.length === 0) return [];
  if (!content.endsWith("\n")) {
    return [
      {
        rule: "MD047",
        line: content.split("\n").length,
        message: "File does not end with a single newline character",
      },
    ];
  }
  if (content.endsWith("\n\n")) {
    return [
      {
        rule: "MD047",
        line: content.split("\n").length,
        message: "File ends with more than one newline character",
      },
    ];
  }
  return [];
}

function lintMarkdown(content) {
  const lines = content.split("\n");
  return [
    ...checkTrailingWhitespace(lines),
    ...checkHardTabs(lines),
    ...checkMultipleBlankLines(lines),
    ...checkHeadingsSurroundedByBlankLines(lines),
    ...checkFencedCodeBlockBlankLines(lines),
    ...checkListIndentation(lines),
    ...checkBlanksAroundLists(lines),
    ...checkBareUrls(lines),
    ...checkFirstLineHeading(lines),
    ...checkFinalNewline(content),
  ];
}

module.exports = { lintMarkdown };
