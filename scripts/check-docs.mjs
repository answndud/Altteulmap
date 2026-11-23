// 문서가 가리키는 링크·코드 경로·npm script가 실제로 있는지 검사한다.
// 대상: git이 추적하는 README.md, docs/**/*.md, deploy/**/*.md (PLAN.md는 앞으로 만들 파일을 가리키므로 제외).
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import process from "node:process";

const cwd = process.cwd();
const scripts = new Set(
  Object.keys(JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")).scripts ?? {}),
);

const files = execFileSync("git", ["ls-files", "-z", "--", "README.md", "docs", "deploy"], {
  cwd,
  encoding: "utf8",
})
  .split("\0")
  .filter((file) => file.endsWith(".md") && existsSync(join(cwd, file)));

const codeRoots = "(?:src|scripts|tests|deploy|drizzle|docs|\\.github)";
const pathPattern = new RegExp(
  `(?<![\\w./@-])(${codeRoots}/[A-Za-z0-9_./\\-\\u3131-\\uD79D]+)`,
  "g",
);
const linkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const npmRunPattern = /npm run ([a-z0-9:_-]+)/gi;

const problems = [];

function report(file, line, message) {
  problems.push(`${file}:${line}  ${message}`);
}

function cleanPath(raw) {
  return raw
    .replace(/[.,;:)]+$/, "")
    .replace(/:\d+(?:-\d+)?$/, "")
    .replace(/\/$/, "");
}

// "src/worker/db.ts는"처럼 붙은 조사를 떼고, "routes/admin-"·"src/db/schema"처럼
// 여러 파일을 가리키는 접두어 표기는 그 접두어로 시작하는 파일이 있으면 인정한다.
function pathExists(path) {
  const candidates = [path, path.replace(/[\u3131-\uD79D]+$/, "").replace(/[.,;:)]+$/, "")];
  return candidates.some((candidate) => {
    if (!candidate) return false;
    if (existsSync(join(cwd, candidate))) return true;
    const dir = dirname(candidate);
    const prefix = candidate.slice(dir.length + 1);
    if (!prefix || !existsSync(join(cwd, dir))) return false;
    return readdirSync(join(cwd, dir)).some((name) => name.startsWith(prefix));
  });
}

for (const file of files) {
  const lines = readFileSync(join(cwd, file), "utf8").split("\n");
  let inFence = false;

  lines.forEach((text, index) => {
    const line = index + 1;
    if (/^\s*```/.test(text)) {
      inFence = !inFence;
    }

    for (const match of text.matchAll(linkPattern)) {
      const target = match[1];
      if (/^(?:[a-z]+:|#|\/\/)/i.test(target)) continue;
      const withoutAnchor = decodeURI(target.split("#")[0]);
      if (!withoutAnchor) continue;
      const resolved = withoutAnchor.startsWith("/")
        ? withoutAnchor
        : normalize(join(dirname(file), withoutAnchor));
      if (!existsSync(join(cwd, resolved)) && !existsSync(resolved)) {
        report(file, line, `깨진 링크: ${target}`);
      }
    }

    for (const match of text.matchAll(npmRunPattern)) {
      if (!scripts.has(match[1])) {
        report(file, line, `없는 npm script: npm run ${match[1]}`);
      }
    }

    // 코드 블록 안의 경로는 원격 서버(~/altteulmap 등) 기준일 수 있어 검사하지 않는다.
    if (inFence) return;
    const withoutLinks = text.replace(linkPattern, "");
    for (const match of withoutLinks.matchAll(pathPattern)) {
      const path = cleanPath(match[1]);
      if (/[*{}<>]/.test(path) || path.includes("...")) continue;
      if (!pathExists(path)) {
        report(file, line, `없는 경로: ${path}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error(`docs:check 실패 (${problems.length}건)\n${problems.join("\n")}`);
  process.exit(1);
}

console.log(`docs:check 통과 (${files.length}개 문서)`);
