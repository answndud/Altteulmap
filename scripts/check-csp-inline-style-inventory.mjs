import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const cwd = process.cwd();
const patterns = [
  "style=\\{\\{",
  "style=\\\"",
  "dangerouslySetInnerHTML",
  "innerHTML",
  "<style",
  "createElement\\([^)]*style",
  "setAttribute\\([^)]*style",
];
const includeRoots = ["src", "public"];

function runRipgrep(pattern) {
  try {
    return execFileSync(
      "rg",
      [
        "-n",
        "--glob",
        "!**/*.md",
        "--glob",
        "!**/dist/**",
        pattern,
        ...includeRoots,
      ],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    )
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

const findings = patterns.flatMap((pattern) =>
  runRipgrep(pattern).map((line) => {
    const [filePath, lineNumber, ...rest] = line.split(":");

    return {
      pattern,
      filePath,
      lineNumber: Number(lineNumber),
      snippet: rest.join(":").trim(),
    };
  }),
);

const grouped = new Map();

for (const finding of findings) {
  const key = finding.filePath;
  const item = grouped.get(key) ?? [];
  item.push(finding);
  grouped.set(key, item);
}

const cspSources = [
  join(cwd, "src/worker/index.ts"),
  join(cwd, "public/_headers"),
];
const cspStatus = cspSources.map((filePath) => {
  const content = readFileSync(filePath, "utf8");

  return {
    filePath: filePath.replace(`${cwd}/`, ""),
    hasUnsafeInline: content.includes("'unsafe-inline'"),
  };
});

process.stdout.write(
  `${JSON.stringify(
    {
      ok: true,
      checkedRoots: includeRoots,
      totalFindings: findings.length,
      files: [...grouped.entries()].map(([filePath, items]) => ({
        filePath,
        count: items.length,
        items: items.map(({ lineNumber, pattern, snippet }) => ({
          lineNumber,
          pattern,
          snippet,
        })),
      })),
      cspStatus,
    },
    null,
    2,
  )}\n`,
);
