// 운영 URL에 읽기 전용 저강도 부하를 건다(쓰기 없음, 에러율·지연 임계값을 넘으면 k6가 즉시 중단한다).
//   npm run perf:k6:prod
//   BASE_URL=https://example.test npm run perf:k6:prod
import { execFileSync } from "node:child_process";
import process from "node:process";

try {
  execFileSync("k6", ["run", "perf/k6/prod-read.js"], { cwd: process.cwd(), stdio: "inherit", env: process.env });
} catch {
  process.exitCode = 1;
}
