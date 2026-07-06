const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { scanContent, hasEnvExample } = require("../twelve-factor-app-scan.js");

test("scanContent flags a hardcoded API key", () => {
  const findings = scanContent(
    "src/config.js",
    `const apiKey = "sk-live-abc123def456ghi789";`,
  );
  assert.ok(findings.some((f) => f.rule === "Config"));
});

test("scanContent flags a hardcoded password assignment", () => {
  const findings = scanContent(
    "src/db.js",
    `const password = "SuperSecret123!";`,
  );
  assert.ok(findings.some((f) => f.rule === "Config"));
});

test("scanContent does not flag a password read from env", () => {
  const findings = scanContent(
    "src/db.js",
    `const password = process.env.DB_PASSWORD;`,
  );
  assert.strictEqual(
    findings.some((f) => f.rule === "Config"),
    false,
  );
});

test("scanContent flags .env content unless .env.example exists next to it", () => {
  const fixtureDirWithout = path.join(__dirname, "fixtures", "no-example");
  const findings = scanContent(
    path.join(fixtureDirWithout, ".env"),
    "API_KEY=abc123",
  );
  assert.ok(
    findings.some(
      (f) => f.rule === "Config" && f.message.includes(".env.example"),
    ),
  );
});

test("scanContent does not flag .env when .env.example exists next to it", () => {
  const fixtureDirWith = path.join(__dirname, "fixtures", "with-example");
  const findings = scanContent(
    path.join(fixtureDirWith, ".env"),
    "API_KEY=abc123",
  );
  assert.strictEqual(
    findings.some(
      (f) => f.rule === "Config" && f.message.includes(".env.example"),
    ),
    false,
  );
});

test("scanContent flags .listen(80) as a privileged port", () => {
  const findings = scanContent(
    "src/server.js",
    `app.listen(80, () => console.log('up'));`,
  );
  assert.ok(findings.some((f) => f.rule === "Port Binding"));
});

test("scanContent flags .listen(443) as a privileged port", () => {
  const findings = scanContent("src/server.js", `server.listen(443);`);
  assert.ok(findings.some((f) => f.rule === "Port Binding"));
});

test("scanContent does not flag .listen(3000)", () => {
  const findings = scanContent("src/server.js", `app.listen(3000);`);
  assert.strictEqual(
    findings.some((f) => f.rule === "Port Binding"),
    false,
  );
});

test("scanContent flags a Dockerfile with no USER directive", () => {
  const findings = scanContent(
    "Dockerfile",
    `FROM node:20\nCOPY . .\nCMD ["node", "index.js"]`,
  );
  assert.ok(
    findings.some(
      (f) => f.rule === "Port Binding" && f.message.includes("USER"),
    ),
  );
});

test("scanContent flags a Dockerfile with USER root", () => {
  const findings = scanContent(
    "Dockerfile",
    `FROM node:20\nUSER root\nCMD ["node", "index.js"]`,
  );
  assert.ok(
    findings.some(
      (f) => f.rule === "Port Binding" && f.message.includes("root"),
    ),
  );
});

test("scanContent does not flag a Dockerfile with a non-root USER", () => {
  const findings = scanContent(
    "Dockerfile",
    `FROM node:20\nUSER node\nCMD ["node", "index.js"]`,
  );
  assert.strictEqual(
    findings.some((f) => f.rule === "Port Binding"),
    false,
  );
});

test("scanContent flags createWriteStream targeting a .log file", () => {
  const findings = scanContent(
    "src/logger.js",
    `const stream = fs.createWriteStream('app.log');`,
  );
  assert.ok(findings.some((f) => f.rule === "Logs"));
});

test("scanContent does not flag console.log usage", () => {
  const findings = scanContent("src/index.js", `console.log('starting up');`);
  assert.strictEqual(
    findings.some((f) => f.rule === "Logs"),
    false,
  );
});

test("scanContent returns empty array for clean content", () => {
  const findings = scanContent(
    "src/util.js",
    `function add(a, b) { return a + b; }`,
  );
  assert.deepStrictEqual(findings, []);
});

test("hasEnvExample returns false when no .env.example sibling exists", () => {
  const fixtureDir = path.join(__dirname, "fixtures", "no-example");
  assert.strictEqual(hasEnvExample(fixtureDir), false);
});

test("hasEnvExample returns true when .env.example sibling exists", () => {
  const fixtureDir = path.join(__dirname, "fixtures", "with-example");
  assert.strictEqual(hasEnvExample(fixtureDir), true);
});
