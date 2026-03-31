import { execFileSync } from "node:child_process";
import path from "node:path";

const allowConfigEdit = process.env.ALTTEULMAP_ALLOW_CONFIG_EDIT === "1";

if (allowConfigEdit) {
  process.exit(0);
}

const protectedFiles = new Set([
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.cjs",
  ".prettierrc.json",
  ".prettierrc.yml",
  ".prettierrc.yaml",
  "prettier.config.js",
  "prettier.config.cjs",
  "prettier.config.mjs",
  "biome.json",
  "biome.jsonc",
]);

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

const blockedFiles = getStagedFiles().filter((filePath) =>
  protectedFiles.has(path.basename(filePath)),
);

if (blockedFiles.length > 0) {
  console.error("[config-protection] Lint/formatter 설정 파일 수정은 기본적으로 차단됩니다.");
  console.error(
    `[config-protection] Blocked files: ${blockedFiles.join(", ")}`,
  );
  console.error(
    "[config-protection] 규칙을 약하게 만드는 대신 원본 코드를 수정하세요. 정말 필요한 경우 ALTTEULMAP_ALLOW_CONFIG_EDIT=1 로 일시 해제할 수 있습니다.",
  );
  process.exit(2);
}
