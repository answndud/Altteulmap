import process from "node:process";
import { spawnSync } from "node:child_process";

if (process.env.CONFIRM_RESET !== "1") {
  process.stderr.write(
    "Refusing to delete the local PostgreSQL volume. Set CONFIRM_RESET=1 to continue.\n",
  );
  process.exit(2);
}

const result = spawnSync("docker compose down -v", {
  cwd: process.cwd(),
  shell: true,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
