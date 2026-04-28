# PROGRESS.md

기준일: 2026-04-27

## 문서 규칙
- 이 문서는 active 상태, blocker, 최근 검증, 다음 액션만 유지한다.
- 작업이 완료되면 이 문서의 최종 상태, 검증, 결과를 정리해 [COMPLETED.md](./COMPLETED.md)로 이동하고, active 문서에서는 바로 삭제한다.
- active 문서 상한:
  - 완료된 작업 0건 유지
  - 진행 중이거나 아직 끝나지 않은 작업만 남김
  - 작업이 모두 끝나면 완료 항목을 archive로 넘긴 뒤 active 본문은 전부 삭제
  - 모든 active 작업이 끝난 최종 상태는 `현재 active 작업 없음`만 남김

## Active 작업

### Admin 배포 1분 이내 가능성 검토
- 상태: 검토 중
- 기준:
  - Cloudflare Dashboard retry build `7e58dde3-8812-4cfd-8cfc-f1401a3132ee`는 `2m 44s`까지 개선됐다.
  - 목표는 admin production deploy duration `1m` 이내다.
- 확인된 사실:
  - 현재 경로는 `apps/admin` root에서 `npm ci` 후 `npm run build`, `npx wrangler deploy`를 수행한다.
  - `WORKERS_CI=1` local admin OpenNext build는 20초 안팎으로 통과한다.
  - Cloudflare 공식 Workers Builds 문서 기준 build cache는 dependency와 build output을 재사용하지만, build job 자체의 provisioning, checkout, deploy upload 단계는 남는다.
  - Cloudflare 공식 Build image 문서 기준 `SKIP_DEPENDENCY_INSTALL=1`로 자동 install을 끌 수 있지만, Next/OpenNext build를 하려면 build command에서 dependency install을 직접 수행해야 한다.
- 판단:
  - 현재 Next/OpenNext + Workers Builds 자동 배포 구조를 유지하면서 모든 code change 배포를 1분 이내로 안정화하는 것은 현실적으로 어렵다.
  - 1분 이내가 반드시 필요하면 Cloudflare Workers Builds에서 매번 Next/OpenNext를 빌드하는 구조를 버리고, prebuilt artifact를 업로드하거나 admin 앱을 더 가벼운 Worker/SPA 구조로 분리해야 한다.
- 다음 액션:
  - 사용자가 1분 이내를 필수 목표로 확정하면 `GitHub Actions cached/prebuilt deploy` 또는 `admin lightweight rewrite` 중 하나를 새 active 작업으로 잡는다.
