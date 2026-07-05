# Hook-Based Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two Claude Code hooks that add deterministic, best-effort enforcement on top of the existing `twelve-factor-app` and `twelve-factor-agent` skills, wired into the plugin so they activate automatically on install.

**Architecture:** Two standalone, dependency-free Node.js scripts under a new `hooks/` directory. Each reads a JSON payload from stdin (the shape Claude Code hooks receive), applies a small set of regex/heuristic checks, and writes a JSON decision to stdout. `twelve-factor-app-scan.js` is a `PostToolUse` hook on `Write|Edit` that never blocks — it only injects `additionalContext` when a rule-relevant pattern is found. `twelve-factor-gate.js` is a `PreToolUse` hook on `Bash` that blocks destructive/irreversible commands, but allows a retry through once the transcript shows the assistant explicitly justified the action to the user (mirroring the observed "Fact-Forcing Gate" pattern), with a hard `TWELVE_FACTOR_GATE_OFF=1` escape hatch as a documented fallback.

**Tech Stack:** Node.js (v18+ built-ins only — `node:test`, `node:assert`, `fs`, `path`; no npm dependencies, no `package.json` needed for the hooks themselves).

## Global Constraints

- Runtime: Node.js, dependency-free (per design doc "Runtime and distribution" section).
- File layout: `hooks/twelve-factor-app-scan.js`, `hooks/twelve-factor-gate.js` — new top-level `hooks/` dir, sibling to `skills/` (per design doc "File layout").
- Content-scan hook (`twelve-factor-app-scan.js`) posture is **warn-only** — must never return a `deny`/block decision, only `additionalContext` (per design doc "Hook 1" and this session's explicit approval of "Warn only — inject context, never block").
- Destructive-action gate (`twelve-factor-gate.js`) posture is **block with justification-aware retry** — denies on first match, allows through if the transcript shows prior justification, with a documented env var escape hatch (per this session's approval of "Transcript-aware retry").
- Wiring lives in the existing `.claude-plugin/plugin.json`'s `hooks` key (currently absent from that file) — no separate settings.json snippet (per design doc "Wiring").
- No changes to `skills/twelve-factor-app/SKILL.md` or `skills/twelve-factor-agent/SKILL.md` — this plan only adds deterministic backup, not skill content changes (per design doc "Non-goals").
- No hook framework, shared utility library, or external config file for pattern lists — two small standalone scripts (per design doc "Non-goals").
- Testing uses Node's built-in `node:test` module — no new dependency, matches the "no unnecessary abstraction" posture already established in this repo (this repo currently has zero code/test files).

---

## File Structure

```
hooks/
  twelve-factor-app-scan.js   — PostToolUse Write|Edit hook, warn-only content scan
  twelve-factor-gate.js       — PreToolUse Bash hook, block-with-retry destructive-action gate
hooks/tests/
  twelve-factor-app-scan.test.js
  twelve-factor-gate.test.js
.claude-plugin/plugin.json    — modified: add "hooks" key
```

Each hook script is self-contained: reads stdin, decides, writes stdout, exits. No shared module between them — the two problem domains (content patterns vs. command patterns) don't overlap enough to justify a shared abstraction, and each script is short enough (under ~120 lines) to stay in one file per the repo's "many small files" convention.

---

### Task 1: `twelve-factor-app-scan.js` — content-scan hook, core matching logic

**Files:**
- Create: `hooks/twelve-factor-app-scan.js`
- Test: `hooks/tests/twelve-factor-app-scan.test.js`

**Interfaces:**
- Produces: `scanContent(filePath, content) -> Array<{ rule: string, message: string }>` — pure function, exported via `module.exports.scanContent` for testing. Takes the file path (for `.env`/Dockerfile detection) and the file's new content (string); returns a list of findings, empty array if none.
- Produces: `hasEnvExample(dirPath) -> boolean` — exported via `module.exports.hasEnvExample`, checks for a sibling `.env.example` file next to a `.env` file being written.

This task builds the pure matching logic and its tests. Stdin/stdout wiring is Task 2.

- [ ] **Step 1: Write the failing tests**

Create `hooks/tests/twelve-factor-app-scan.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { scanContent, hasEnvExample } = require('../twelve-factor-app-scan.js');

test('scanContent flags a hardcoded API key', () => {
  const findings = scanContent('src/config.js', `const apiKey = "sk-live-abc123def456ghi789";`);
  assert.ok(findings.some(f => f.rule === 'Config'));
});

test('scanContent flags a hardcoded password assignment', () => {
  const findings = scanContent('src/db.js', `const password = "SuperSecret123!";`);
  assert.ok(findings.some(f => f.rule === 'Config'));
});

test('scanContent does not flag a password read from env', () => {
  const findings = scanContent('src/db.js', `const password = process.env.DB_PASSWORD;`);
  assert.strictEqual(findings.some(f => f.rule === 'Config'), false);
});

test('scanContent flags .env content unless .env.example exists next to it', () => {
  const fixtureDirWithout = path.join(__dirname, 'fixtures', 'no-example');
  const findings = scanContent(path.join(fixtureDirWithout, '.env'), 'API_KEY=abc123');
  assert.ok(findings.some(f => f.rule === 'Config' && f.message.includes('.env.example')));
});

test('scanContent does not flag .env when .env.example exists next to it', () => {
  const fixtureDirWith = path.join(__dirname, 'fixtures', 'with-example');
  const findings = scanContent(path.join(fixtureDirWith, '.env'), 'API_KEY=abc123');
  assert.strictEqual(findings.some(f => f.rule === 'Config' && f.message.includes('.env.example')), false);
});

test('scanContent flags .listen(80) as a privileged port', () => {
  const findings = scanContent('src/server.js', `app.listen(80, () => console.log('up'));`);
  assert.ok(findings.some(f => f.rule === 'Port Binding'));
});

test('scanContent flags .listen(443) as a privileged port', () => {
  const findings = scanContent('src/server.js', `server.listen(443);`);
  assert.ok(findings.some(f => f.rule === 'Port Binding'));
});

test('scanContent does not flag .listen(3000)', () => {
  const findings = scanContent('src/server.js', `app.listen(3000);`);
  assert.strictEqual(findings.some(f => f.rule === 'Port Binding'), false);
});

test('scanContent flags a Dockerfile with no USER directive', () => {
  const findings = scanContent('Dockerfile', `FROM node:20\nCOPY . .\nCMD ["node", "index.js"]`);
  assert.ok(findings.some(f => f.rule === 'Port Binding' && f.message.includes('USER')));
});

test('scanContent flags a Dockerfile with USER root', () => {
  const findings = scanContent('Dockerfile', `FROM node:20\nUSER root\nCMD ["node", "index.js"]`);
  assert.ok(findings.some(f => f.rule === 'Port Binding' && f.message.includes('root')));
});

test('scanContent does not flag a Dockerfile with a non-root USER', () => {
  const findings = scanContent('Dockerfile', `FROM node:20\nUSER node\nCMD ["node", "index.js"]`);
  assert.strictEqual(findings.some(f => f.rule === 'Port Binding'), false);
});

test('scanContent flags createWriteStream targeting a .log file', () => {
  const findings = scanContent('src/logger.js', `const stream = fs.createWriteStream('app.log');`);
  assert.ok(findings.some(f => f.rule === 'Logs'));
});

test('scanContent does not flag console.log usage', () => {
  const findings = scanContent('src/index.js', `console.log('starting up');`);
  assert.strictEqual(findings.some(f => f.rule === 'Logs'), false);
});

test('scanContent returns empty array for clean content', () => {
  const findings = scanContent('src/util.js', `function add(a, b) { return a + b; }`);
  assert.deepStrictEqual(findings, []);
});

test('hasEnvExample returns false when no .env.example sibling exists', () => {
  const fixtureDir = path.join(__dirname, 'fixtures', 'no-example');
  assert.strictEqual(hasEnvExample(fixtureDir), false);
});

test('hasEnvExample returns true when .env.example sibling exists', () => {
  const fixtureDir = path.join(__dirname, 'fixtures', 'with-example');
  assert.strictEqual(hasEnvExample(fixtureDir), true);
});
```

Create the two fixture directories the tests reference:

```bash
mkdir -p hooks/tests/fixtures/no-example
mkdir -p hooks/tests/fixtures/with-example
touch hooks/tests/fixtures/with-example/.env.example
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test hooks/tests/twelve-factor-app-scan.test.js`
Expected: FAIL — `Cannot find module '../twelve-factor-app-scan.js'`

- [ ] **Step 3: Write minimal implementation**

Create `hooks/twelve-factor-app-scan.js`:

```javascript
#!/usr/bin/env node
// twelve-factor-app-scan — PostToolUse hook (Write|Edit)
// Warn-only content scan for patterns that violate the twelve-factor-app
// skill's Config, Port Binding, and Logs rules. Never blocks — the write
// already happened by the time this hook runs. See:
// docs/superpowers/specs/2026-07-05-hook-enforcement-design.md

const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  { re: /\b(api[_-]?key|apikey)\s*=\s*["'][^"']{8,}["']/i, label: 'a hardcoded API key' },
  { re: /\b(password|passwd|pwd)\s*=\s*["'][^"']{4,}["']/i, label: 'a hardcoded password' },
  { re: /\b(secret|token)\s*=\s*["'][^"']{8,}["']/i, label: 'a hardcoded secret/token' },
];

// Values that read from the environment are the whole point of the Config
// rule — don't flag them even if they superficially match a SECRET_PATTERN
// keyword (e.g. "const password = process.env.DB_PASSWORD").
function isEnvRead(line) {
  return /process\.env\.|os\.environ|ENV\[/.test(line);
}

function scanForSecrets(content) {
  const findings = [];
  for (const line of content.split('\n')) {
    if (isEnvRead(line)) continue;
    for (const { re, label } of SECRET_PATTERNS) {
      if (re.test(line)) {
        findings.push({ rule: 'Config', message: `Line looks like it contains ${label}: "${line.trim()}"` });
      }
    }
  }
  return findings;
}

function hasEnvExample(dirPath) {
  try {
    return fs.existsSync(path.join(dirPath, '.env.example'));
  } catch (e) {
    return false;
  }
}

function scanEnvFile(filePath) {
  if (path.basename(filePath) !== '.env') return [];
  const dir = path.dirname(filePath);
  if (hasEnvExample(dir)) return [];
  return [{ rule: 'Config', message: `.env written without a sibling .env.example in ${dir}` }];
}

function scanPortBinding(filePath, content) {
  const findings = [];
  const listenMatch = content.match(/\.listen\s*\(\s*(\d+)/);
  if (listenMatch && Number(listenMatch[1]) < 1024) {
    findings.push({ rule: 'Port Binding', message: `.listen(${listenMatch[1]}) binds a privileged port (<1024)` });
  }

  if (path.basename(filePath) === 'Dockerfile' || filePath.endsWith('.dockerfile')) {
    const userMatch = content.match(/^\s*USER\s+(\S+)/im);
    if (!userMatch) {
      findings.push({ rule: 'Port Binding', message: 'Dockerfile has no USER directive — defaults to running as root' });
    } else if (userMatch[1] === 'root') {
      findings.push({ rule: 'Port Binding', message: 'Dockerfile explicitly sets USER root' });
    }
  }
  return findings;
}

function scanLogs(content) {
  const findings = [];
  if (/createWriteStream\s*\(\s*["'][^"']*\.log["']/.test(content)) {
    findings.push({ rule: 'Logs', message: 'createWriteStream targeting a .log file — logs should go to stdout/stderr' });
  }
  return findings;
}

function scanContent(filePath, content) {
  return [
    ...scanForSecrets(content),
    ...scanEnvFile(filePath),
    ...scanPortBinding(filePath, content),
    ...scanLogs(content),
  ];
}

module.exports = { scanContent, hasEnvExample };

// --- stdin/stdout wiring (skipped when required as a module by tests) ---
if (require.main === module) {
  let input = '';
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const filePath = data.tool_input && (data.tool_input.file_path || data.tool_input.path);
      const content = data.tool_input && (data.tool_input.content || data.tool_input.new_string || '');
      if (!filePath || !content) {
        process.stdout.write('OK');
        return;
      }
      const findings = scanContent(filePath, content);
      if (findings.length === 0) {
        process.stdout.write('OK');
        return;
      }
      const lines = findings.map(f => `[${f.rule}] ${f.message}`).join('\n');
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `twelve-factor-app: possible rule violation(s) in ${filePath}:\n${lines}\nSee skills/twelve-factor-app/SKILL.md. This is a heuristic warning, not a block — fix it or note why it's a false positive.`,
        },
      }));
    } catch (e) {
      process.stdout.write('OK');
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test hooks/tests/twelve-factor-app-scan.test.js`
Expected: PASS — all 15 tests green.

- [ ] **Step 5: Commit**

```bash
git add hooks/twelve-factor-app-scan.js hooks/tests/twelve-factor-app-scan.test.js hooks/tests/fixtures/
git commit -m "feat: add twelve-factor-app-scan content-scan hook

Warn-only PostToolUse hook flagging Config, Port Binding, and Logs
rule violations. Never blocks — injects additionalContext only."
```

---

### Task 2: `twelve-factor-gate.js` — destructive-action gate, core matching + retry logic

**Files:**
- Create: `hooks/twelve-factor-gate.js`
- Test: `hooks/tests/twelve-factor-gate.test.js`

**Interfaces:**
- Consumes: none (standalone).
- Produces: `matchesDestructivePattern(command) -> string | null` — exported via `module.exports.matchesDestructivePattern`. Returns a human-readable description of the matched pattern, or `null` if the command isn't destructive.
- Produces: `wasJustified(transcriptPath) -> boolean` — exported via `module.exports.wasJustified`. Reads the transcript file (JSONL, one message per line) and returns `true` if the most recent assistant message before this tool call contains a justification marker (see Step 3 for the exact heuristic).

- [ ] **Step 1: Write the failing tests**

Create `hooks/tests/twelve-factor-gate.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { matchesDestructivePattern, wasJustified } = require('../twelve-factor-gate.js');

test('matchesDestructivePattern flags git push --force', () => {
  assert.ok(matchesDestructivePattern('git push --force origin main'));
});

test('matchesDestructivePattern flags git push -f', () => {
  assert.ok(matchesDestructivePattern('git push -f'));
});

test('matchesDestructivePattern flags rm -rf', () => {
  assert.ok(matchesDestructivePattern('rm -rf /tmp/build'));
});

test('matchesDestructivePattern flags git reset --hard', () => {
  assert.ok(matchesDestructivePattern('git reset --hard HEAD~3'));
});

test('matchesDestructivePattern flags git clean -f', () => {
  assert.ok(matchesDestructivePattern('git clean -fd'));
});

test('matchesDestructivePattern flags DROP TABLE', () => {
  assert.ok(matchesDestructivePattern('psql -c "DROP TABLE users;"'));
});

test('matchesDestructivePattern does not flag a normal git push', () => {
  assert.strictEqual(matchesDestructivePattern('git push origin main'), null);
});

test('matchesDestructivePattern does not flag rm on a single file', () => {
  assert.strictEqual(matchesDestructivePattern('rm old-file.txt'), null);
});

test('matchesDestructivePattern does not flag ls -rf-looking but unrelated text', () => {
  assert.strictEqual(matchesDestructivePattern('echo "rm -rf is dangerous"'), null);
});

test('wasJustified returns false when transcript has no justification marker', () => {
  const tmpFile = path.join(os.tmpdir(), `transcript-${Date.now()}-nojust.jsonl`);
  fs.writeFileSync(tmpFile, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Running the command now.' }] } }) + '\n');
  assert.strictEqual(wasJustified(tmpFile), false);
  fs.unlinkSync(tmpFile);
});

test('wasJustified returns true when the last assistant message contains a justification marker', () => {
  const tmpFile = path.join(os.tmpdir(), `transcript-${Date.now()}-just.jsonl`);
  fs.writeFileSync(tmpFile, JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Confirmed with the user: force-push is intentional to fix the shared branch history.' }] } }) + '\n');
  assert.strictEqual(wasJustified(tmpFile), true);
  fs.unlinkSync(tmpFile);
});

test('wasJustified returns false for a missing transcript file', () => {
  assert.strictEqual(wasJustified('/nonexistent/path/transcript.jsonl'), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test hooks/tests/twelve-factor-gate.test.js`
Expected: FAIL — `Cannot find module '../twelve-factor-gate.js'`

- [ ] **Step 3: Write minimal implementation**

Create `hooks/twelve-factor-gate.js`:

```javascript
#!/usr/bin/env node
// twelve-factor-gate — PreToolUse hook (Bash)
// Blocks destructive/irreversible commands, reinforcing the
// twelve-factor-agent skill's "Contact Humans With Tools" rule. Allows a
// retry through once the transcript shows the assistant justified the
// action. Escape hatch: TWELVE_FACTOR_GATE_OFF=1 disables the gate entirely.
// See: docs/superpowers/specs/2026-07-05-hook-enforcement-design.md

const fs = require('fs');

const DESTRUCTIVE_PATTERNS = [
  { re: /git\s+push\s+.*(--force|-f\b)/, label: 'force-push (rewrites shared history)' },
  { re: /\brm\s+-[a-z]*r[a-z]*f[a-z]*\b/i, label: 'rm -rf (recursive forced delete)' },
  { re: /\brm\s+-[a-z]*f[a-z]*r[a-z]*\b/i, label: 'rm -fr (recursive forced delete)' },
  { re: /git\s+reset\s+--hard/, label: 'git reset --hard (discards uncommitted work)' },
  { re: /git\s+clean\s+-[a-z]*f/, label: 'git clean -f (deletes untracked files)' },
  { re: /\bDROP\s+TABLE\b/i, label: 'DROP TABLE (irreversible schema change)' },
  { re: /\bDROP\s+DATABASE\b/i, label: 'DROP DATABASE (irreversible data loss)' },
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
const JUSTIFICATION_MARKERS = /\b(confirmed with|user (approved|agreed|confirmed)|explicitly (asked|requested|confirmed)|intentional|per the user's|as (discussed|requested))\b/i;

function wasJustified(transcriptPath) {
  try {
    const raw = fs.readFileSync(transcriptPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try { entry = JSON.parse(lines[i]); } catch (e) { continue; }
      if (entry.type !== 'assistant') continue;
      const content = entry.message && entry.message.content;
      if (!Array.isArray(content)) continue;
      const text = content.filter(c => c.type === 'text').map(c => c.text).join(' ');
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
  if (process.env.TWELVE_FACTOR_GATE_OFF === '1') {
    process.stdout.write('OK');
  } else {
    let input = '';
    process.stdin.on('data', chunk => { input += chunk; });
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(input);
        const command = data.tool_input && data.tool_input.command;
        if (!command) {
          process.stdout.write('OK');
          return;
        }
        const label = matchesDestructivePattern(command);
        if (!label) {
          process.stdout.write('OK');
          return;
        }
        if (data.transcript_path && wasJustified(data.transcript_path)) {
          process.stdout.write('OK');
          return;
        }
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: `twelve-factor-gate: this command matches a destructive/irreversible pattern (${label}): "${command}". ` +
            `Per the twelve-factor-agent skill's "Contact Humans With Tools" rule, surface this to the user and get ` +
            `explicit confirmation before retrying. If this session needs the gate off entirely, set TWELVE_FACTOR_GATE_OFF=1.`,
        }));
      } catch (e) {
        process.stdout.write('OK');
      }
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test hooks/tests/twelve-factor-gate.test.js`
Expected: PASS — all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add hooks/twelve-factor-gate.js hooks/tests/twelve-factor-gate.test.js
git commit -m "feat: add twelve-factor-gate destructive-action hook

Block-with-justification PreToolUse hook on Bash, reinforcing the
twelve-factor-agent skill's Contact Humans With Tools rule. Allows
retry once the transcript shows prior justification; escape hatch
via TWELVE_FACTOR_GATE_OFF=1."
```

---

### Task 3: Wire both hooks into `.claude-plugin/plugin.json`

**Files:**
- Modify: `.claude-plugin/plugin.json`

**Interfaces:**
- Consumes: `hooks/twelve-factor-app-scan.js` and `hooks/twelve-factor-gate.js` from Tasks 1–2 (paths only, no code-level interface — hooks are invoked as subprocesses via `${CLAUDE_PLUGIN_ROOT}`).

Current file content (read before this task, verified in-session):

```json
{
  "name": "ai-skills",
  "version": "0.1.0",
  "description": "Boston accent mode plus 12-Factor App and 12-Factor Agent discipline skills for Claude Code.",
  "author": {
    "name": "j0sh3rs",
    "url": "https://github.com/j0sh3rs"
  },
  "homepage": "https://github.com/j0sh3rs/ai-skills",
  "repository": "https://github.com/j0sh3rs/ai-skills",
  "license": "MIT",
  "keywords": ["skills", "12-factor", "productivity"],
  "skills": "./skills/"
}
```

- [ ] **Step 1: No test to write first — this is a config change, not code.** Skip to implementation. (Verification happens in Task 4 via a manual JSON-schema/shape check.)

- [ ] **Step 2: Edit `plugin.json` to add the `hooks` key**

Add `"hooks"` after `"skills"`:

```json
{
  "name": "ai-skills",
  "version": "0.1.0",
  "description": "Boston accent mode plus 12-Factor App and 12-Factor Agent discipline skills for Claude Code.",
  "author": {
    "name": "j0sh3rs",
    "url": "https://github.com/j0sh3rs"
  },
  "homepage": "https://github.com/j0sh3rs/ai-skills",
  "repository": "https://github.com/j0sh3rs/ai-skills",
  "license": "MIT",
  "keywords": ["skills", "12-factor", "productivity"],
  "skills": "./skills/",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-app-scan.js\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/twelve-factor-gate.js\"",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json', 'utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "feat: wire twelve-factor hooks into plugin manifest

Adds PostToolUse (content scan) and PreToolUse (destructive-action
gate) hook entries so both activate automatically on plugin install."
```

---

### Task 4: End-to-end manual verification of stdin/stdout wiring

**Files:**
- None created/modified — this task exercises Tasks 1–3's output as installed, using shell-piped JSON payloads to simulate what Claude Code sends to a hook.

**Interfaces:**
- Consumes: `hooks/twelve-factor-app-scan.js` and `hooks/twelve-factor-gate.js` as standalone executables (their `require.main === module` stdin/stdout paths, untested by the unit tests in Tasks 1–2, which only exercise the exported pure functions).

The unit tests in Tasks 1–2 cover the pure logic (`scanContent`, `matchesDestructivePattern`, `wasJustified`) but never invoke the scripts as subprocesses, so the stdin-JSON-parsing and stdout-JSON-emitting code paths are unverified until this task.

- [ ] **Step 1: Verify the content-scan hook warns on a secret and never blocks**

Run:
```bash
echo '{"tool_input": {"file_path": "src/config.js", "content": "const apiKey = \"sk-live-abc123def456ghi789\";"}}' | node hooks/twelve-factor-app-scan.js
```
Expected: JSON output containing `"hookEventName": "PostToolUse"` and `"additionalContext"` mentioning `Config` — NOT a `"decision": "block"` (this hook must never emit that key).

- [ ] **Step 2: Verify the content-scan hook is silent on clean content**

Run:
```bash
echo '{"tool_input": {"file_path": "src/util.js", "content": "function add(a, b) { return a + b; }"}}' | node hooks/twelve-factor-app-scan.js
```
Expected: `OK`

- [ ] **Step 3: Verify the destructive-action gate blocks an unjustified force-push**

Run:
```bash
echo '{"tool_input": {"command": "git push --force origin main"}}' | node hooks/twelve-factor-gate.js
```
Expected: JSON output containing `"decision": "block"` and a `"reason"` mentioning `force-push`.

- [ ] **Step 4: Verify the destructive-action gate allows a normal command through**

Run:
```bash
echo '{"tool_input": {"command": "git push origin main"}}' | node hooks/twelve-factor-gate.js
```
Expected: `OK`

- [ ] **Step 5: Verify the escape hatch bypasses the gate entirely**

Run:
```bash
TWELVE_FACTOR_GATE_OFF=1 bash -c 'echo "{\"tool_input\": {\"command\": \"git push --force origin main\"}}" | node hooks/twelve-factor-gate.js'
```
Expected: `OK` (gate is bypassed even though the command matches a destructive pattern).

- [ ] **Step 6: Verify the transcript-justification retry path**

```bash
mkdir -p /tmp/twelve-factor-gate-verify
echo '{"type":"assistant","message":{"content":[{"type":"text","text":"Confirmed with the user: force-push is intentional to fix the shared branch history."}]}}' > /tmp/twelve-factor-gate-verify/transcript.jsonl
echo '{"tool_input": {"command": "git push --force origin main"}, "transcript_path": "/tmp/twelve-factor-gate-verify/transcript.jsonl"}' | node hooks/twelve-factor-gate.js
```
Expected: `OK` (transcript shows justification, so the retry is allowed through).

- [ ] **Step 7: Clean up verification artifacts**

```bash
rm -rf /tmp/twelve-factor-gate-verify
```

No commit for this task — it's manual verification of Tasks 1–3's output, produces no new files.

---

### Task 5: Update documentation to reflect the shipped hooks

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing new — references the file paths from Tasks 1–3 (`hooks/twelve-factor-app-scan.js`, `hooks/twelve-factor-gate.js`, the `plugin.json` `hooks` key).

- [ ] **Step 1: No test — documentation change.**

- [ ] **Step 2: Add a "Hooks" section to `README.md`**

Add this section after the "Skills" table (exact insertion point: after the paragraph ending "...what was deliberately left out) live in `docs/superpowers/specs/`." and before "## Installation"):

```markdown
## Hooks

Installing the plugin also installs two enforcement hooks that back the skills above with deterministic checks:

| Hook | Event | Posture |
|---|---|---|
| `hooks/twelve-factor-app-scan.js` | `PostToolUse` on Write/Edit | Warn-only — flags likely Config/Port-Binding/Logs rule violations via `additionalContext`, never blocks. |
| `hooks/twelve-factor-gate.js` | `PreToolUse` on Bash | Blocks destructive/irreversible commands (force-push, `rm -rf`, `git reset --hard`, etc.) until justification is shown in the transcript. Escape hatch: `TWELVE_FACTOR_GATE_OFF=1`. |

Only 4 of the 18 total rules across both skills have a hook — the rest require judgment a single tool-call event can't deterministically verify, and stay skill-only by design. See [`docs/superpowers/specs/2026-07-05-hook-enforcement-design.md`](./docs/superpowers/specs/2026-07-05-hook-enforcement-design.md) for the full scope rationale.
```

- [ ] **Step 3: Add hooks convention note to `CLAUDE.md`**

Add this paragraph after the existing "Design process for new skills" section and before "## Current skills":

```markdown
## Hooks

`hooks/twelve-factor-app-scan.js` and `hooks/twelve-factor-gate.js` are the only hooks in this repo, wired into `.claude-plugin/plugin.json`'s `hooks` key. Each is a standalone, dependency-free Node.js script — no shared hook utility module, no external pattern-config file. If adding another hook, check `docs/superpowers/specs/2026-07-05-hook-enforcement-design.md` first: most twelve-factor rules are explicitly scoped OUT of hook enforcement because a single tool-call event can't deterministically verify them (architectural/runtime concerns like Disposability or Dev/Prod Parity). Don't force-fit a hook onto those — that scope boundary is permanent, not a backlog item.
```

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document the two twelve-factor enforcement hooks"
```

---

## Self-Review Notes

**Spec coverage:** Design doc's Hook 1 (content scan, warn-only, Config/Port-Binding/Logs) → Task 1. Hook 2 (destructive gate, block-with-justification) → Task 2, using the retry mechanism approved in this session (transcript-aware, not the simpler env-var-only alternative). Runtime (Node.js, dependency-free) → both tasks. File layout (`hooks/` dir) → Tasks 1–2. Wiring into `plugin.json` → Task 3. Non-goals (no shared framework, no changes to SKILL.md files) → respected throughout; each hook is a standalone file, no skill content touched.

**Placeholder scan:** No TBD/TODO; every step has complete runnable code or exact commands with expected output.

**Type consistency:** `scanContent(filePath, content)` signature is identical across its definition (Task 1 Step 3) and all test call sites (Task 1 Step 1). `matchesDestructivePattern(command)` and `wasJustified(transcriptPath)` likewise consistent between Task 2's tests and implementation. The `{ rule, message }` finding shape from Task 1 matches what Task 4's manual verification expects in the JSON output.
