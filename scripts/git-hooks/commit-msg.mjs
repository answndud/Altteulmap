import { readFileSync } from "node:fs";

const commitMessageFile = process.argv[2];

if (!commitMessageFile) {
  console.error("[commit-msg] Missing commit message file path.");
  process.exit(1);
}

const firstLine = readFileSync(commitMessageFile, "utf8")
  .split("\n")[0]
  .trim();

if (
  firstLine.startsWith("Merge ") ||
  firstLine.startsWith("Revert ")
) {
  process.exit(0);
}

const conventionalCommitPattern =
  /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(\([^)]+\))?: .+/;

if (!conventionalCommitPattern.test(firstLine)) {
  console.error(
    "[commit-msg] Conventional commit 형식을 사용하세요. 예: feat(map): add inline place comments",
  );
  process.exit(2);
}

if (firstLine.length > 72) {
  console.error(
    `[commit-msg] 첫 줄이 너무 깁니다 (${firstLine.length}/72).`,
  );
  process.exit(2);
}

if (firstLine.endsWith(".")) {
  console.error("[commit-msg] 첫 줄 끝에 마침표를 붙이지 마세요.");
  process.exit(2);
}
