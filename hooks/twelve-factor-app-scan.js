#!/usr/bin/env node
// twelve-factor-app-scan — PostToolUse hook (Write|Edit)
// Warn-only content scan for patterns that violate the twelve-factor-app
// skill's Config, Port Binding, and Logs rules. Never blocks — the write
// already happened by the time this hook runs. See:
// docs/superpowers/specs/2026-07-05-hook-enforcement-design.md

const fs = require("node:fs");
const path = require("node:path");

const SECRET_PATTERNS = [
  {
    re: /\b(api[_-]?key|apikey)\s*=\s*["'][^"']{8,}["']/i,
    label: "a hardcoded API key",
  },
  {
    re: /\b(password|passwd|pwd)\s*=\s*["'][^"']{4,}["']/i,
    label: "a hardcoded password",
  },
  {
    re: /\b(secret|token)\s*=\s*["'][^"']{8,}["']/i,
    label: "a hardcoded secret/token",
  },
];

// Values that read from the environment are the whole point of the Config
// rule — don't flag them even if they superficially match a SECRET_PATTERN
// keyword (e.g. "const password = process.env.DB_PASSWORD").
function isEnvRead(line) {
  return /process\.env\.|os\.environ|ENV\[/.test(line);
}

function scanForSecrets(content) {
  const findings = [];
  for (const line of content.split("\n")) {
    if (isEnvRead(line)) continue;
    for (const { re, label } of SECRET_PATTERNS) {
      if (re.test(line)) {
        findings.push({
          rule: "Config",
          message: `Line looks like it contains ${label}: "${line.trim()}"`,
        });
      }
    }
  }
  return findings;
}

function hasEnvExample(dirPath) {
  try {
    return fs.existsSync(path.join(dirPath, ".env.example"));
  } catch (e) {
    return false;
  }
}

function scanEnvFile(filePath) {
  if (!/^\.env(\.|$)/.test(path.basename(filePath))) return [];
  const dir = path.dirname(filePath);
  if (hasEnvExample(dir)) return [];
  return [
    {
      rule: "Config",
      message: `.env written without a sibling .env.example in ${dir}`,
    },
  ];
}

function scanPortBinding(filePath, content) {
  const findings = [];
  const listenMatch = content.match(/\.listen\s*\(\s*(\d+)/);
  if (listenMatch && Number(listenMatch[1]) < 1024) {
    findings.push({
      rule: "Port Binding",
      message: `.listen(${listenMatch[1]}) binds a privileged port (<1024)`,
    });
  }

  if (
    path.basename(filePath) === "Dockerfile" ||
    filePath.endsWith(".dockerfile")
  ) {
    const userMatch = content.match(/^\s*USER\s+(\S+)/im);
    if (!userMatch) {
      findings.push({
        rule: "Port Binding",
        message:
          "Dockerfile has no USER directive — defaults to running as root",
      });
    } else if (userMatch[1] === "root") {
      findings.push({
        rule: "Port Binding",
        message: "Dockerfile explicitly sets USER root",
      });
    }
  }
  return findings;
}

function scanLogs(content) {
  const findings = [];
  if (/createWriteStream\s*\(\s*["'][^"']*\.log["']/.test(content)) {
    findings.push({
      rule: "Logs",
      message:
        "createWriteStream targeting a .log file — logs should go to stdout/stderr",
    });
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
  let input = "";
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    try {
      const data = JSON.parse(input);
      const filePath =
        data.tool_input && (data.tool_input.file_path || data.tool_input.path);
      const content =
        data.tool_input &&
        (data.tool_input.content || data.tool_input.new_string || "");
      if (!filePath || !content) {
        process.stdout.write("OK");
        return;
      }
      const findings = scanContent(filePath, content);
      if (findings.length === 0) {
        process.stdout.write("OK");
        return;
      }
      const lines = findings.map((f) => `[${f.rule}] ${f.message}`).join("\n");
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: `twelve-factor-app: possible rule violation(s) in ${filePath}:\n${lines}\nSee skills/twelve-factor-app/SKILL.md. This is a heuristic warning, not a block — fix it or note why it's a false positive.`,
          },
        }),
      );
    } catch (e) {
      process.stdout.write("OK");
    }
  });
}
