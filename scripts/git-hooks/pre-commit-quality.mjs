import { execFileSync, spawnSync } from "node:child_process";

const codeFilePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const secretPatterns = [
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /AKIA[A-Z0-9]{16}/,
  /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/i,
];

function getStagedFiles() {
  const output = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );

  return output
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getStagedFileContent(filePath) {
  return execFileSync("git", ["show", `:${filePath}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

const stagedFiles = getStagedFiles();
const codeFiles = stagedFiles.filter(
  (filePath) =>
    codeFilePattern.test(filePath) && !filePath.startsWith("scripts/git-hooks/"),
);

if (codeFiles.length === 0) {
  process.exit(0);
}

let hasBlockingIssue = false;
let hasWarning = false;

for (const filePath of codeFiles) {
  const content = getStagedFileContent(filePath);
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();

    if (/^\s*debugger\b/.test(line) && !trimmed.startsWith("//")) {
      console.error(
        `[pre-commit] debugger statement found: ${filePath}:${lineNumber}`,
      );
      hasBlockingIssue = true;
    }

    if (
      /\bconsole\.log\s*\(/.test(line) &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("*")
    ) {
      console.error(
        `[pre-commit] warning: console.log found: ${filePath}:${lineNumber}`,
      );
      hasWarning = true;
    }

    if (secretPatterns.some((pattern) => pattern.test(line))) {
      console.error(
        `[pre-commit] possible secret found: ${filePath}:${lineNumber}`,
      );
      hasBlockingIssue = true;
    }
  });
}

if (hasBlockingIssue) {
  process.exit(2);
}

const lintResult = spawnSync("npm", ["run", "verify:quick"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (lintResult.status !== 0) {
  process.exit(lintResult.status ?? 1);
}

if (hasWarning) {
  console.error(
    "[pre-commit] warnings were found above. Commit is allowed, but clean them up when possible.",
  );
}
