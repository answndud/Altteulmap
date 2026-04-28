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

### Cloudflare admin Worker 빌드 속도 개선
- 상태: 조사 및 구현 중
- 대상 build: `https://dash.cloudflare.com/09ffaff2ee2810549ebc107c3a6784d8/workers/services/view/altteulmap-admin/production/builds/8b5f7e0c-8dea-4515-b262-32ad49e26491`
- 현재 기준:
  - `altteulmap-admin` 자동 배포는 성공했지만 dashboard duration이 약 `4m 50s`로 길다.
  - 현재 successful dashboard 설정은 `Path=apps/admin`, `Install=npm ci`, `Build=npm run build`, `Deploy=npx wrangler deploy`다.
  - 실패한 빠른 설정(`cd ../.. && npm ci`, `cd ../.. && npm run cf:build:admin`)은 Cloudflare build 환경에서 루트 `node_modules`를 보장하지 못했다.
- 확인된 사실:
  - 해당 run은 GitHub Actions가 아니라 Cloudflare 외부 check `Workers Builds: altteulmap-admin`이다.
  - 실패한 check run id는 `73128434508`, Cloudflare build id는 `80587ccc-e1a3-4127-8a4c-6e3c37cfeb81`이다.
  - 같은 커밋의 public Worker check `Workers Builds: altteulmap`은 성공했다.
  - Cloudflare 공식 Workers Builds 문서 기준, 연결된 Worker 이름은 지정된 root directory의 Wrangler config `name`과 일치해야 한다.
  - public은 루트 `wrangler.jsonc` 이름이 `altteulmap`이라 root `/`가 맞지만, admin은 `apps/admin/wrangler.jsonc` 이름이 `altteulmap-admin`이라 root `apps/admin`이 맞다.
  - Cloudflare 공식 API/문서 기준 이 설정은 `root_directory`, `build_command`, `deploy_command` trigger 필드다.
  - 현재 `apps/admin/scripts/build.mjs`는 외부 build 단계에서 루트 `npm ci`를 다시 실행하므로 Cloudflare install 단계와 build 단계가 분리되어 duration이 커진다.
- 변경:
  - `apps/admin` root에서 Cloudflare 기본 `npm ci`가 통과하도록 `apps/admin/package-lock.json`을 추가했다.
  - `apps/admin npm run build`가 루트 의존성을 설치한 뒤 `npm run cf:build:admin`을 실행하도록 bootstrap 스크립트를 추가했다.
  - Dashboard build command가 기존 값으로 남아 있어도 동작하도록 `apps/admin`에 `cf:build`, `cf:build:admin` script alias를 추가했다.
  - Dashboard deploy command가 `npx opennextjs-cloudflare deploy -c wrangler.admin.jsonc`로 남아 있어도 config를 찾도록 `apps/admin/wrangler.admin.jsonc` alias를 추가했다.
  - OpenNext 내부 Next build 호출과 외부 Cloudflare build 호출이 재귀되지 않도록 `ALTTEULMAP_OPENNEXT_ADMIN_BUILD` marker를 추가했다.
  - OpenNext monorepo 감지가 `apps/admin/package-lock.json` 때문에 깨지지 않도록 admin Worker build 중 lockfile을 임시로 숨겼다가 복원한다.
  - Cloudflare Build image와 로컬 root/app root가 같은 Node 계열을 쓰도록 `.node-version`을 추가했다.
  - 배포 문서의 admin Workers Builds root/build/deploy command 안내를 `apps/admin` 기준으로 수정했다.
  - 빌드 속도 개선을 위해 `apps/admin/package.json`에 실제 admin build 의존성을 추가하고 `apps/admin/package-lock.json`을 self-contained lockfile로 갱신했다.
  - `apps/admin/scripts/build.mjs`는 root `node_modules`가 없고 `apps/admin/node_modules`가 있는 Cloudflare 환경에서 build 동안 루트 `node_modules` symlink를 만들었다가 제거한다.
  - 이 방식으로 기존 루트 admin build/OpenNext monorepo 경로는 유지하면서 build 단계의 루트 `npm ci` 재실행을 제거했다.
  - `scripts/build-admin-worker.mjs`는 실행 cwd와 무관하게 repo root를 계산하고, root/admin dependency 위치를 모두 지원하도록 수정했다.
- 최근 검증:
  - `gh run view 73128434508 --repo answndud/Altteulmap` 실패: GitHub Actions run이 아니라 조회 불가.
  - `gh api repos/answndud/Altteulmap/commits/7bf8dfe/check-runs`로 external Cloudflare check 메타데이터 확인.
  - `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin`
    - 통과
  - `cd apps/admin && PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm ci && PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build`
    - 통과
  - `cd apps/admin && PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin`
    - 통과
  - `npm run deploy:check:admin`
    - 통과
  - `npm run lint`
    - 통과
  - `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm ci && npm run lint && PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin && git diff --check`
    - 통과
  - `git diff --check`
    - 통과
  - `git push origin main` 후 commit `8b72417` 원격 check 확인
    - public `Workers Builds: altteulmap` 성공
    - admin `Workers Builds: altteulmap-admin` 실패, build id `95f8889e-6612-4a13-91c8-21e751db5a0a`
    - 실패가 시작/종료 같은 초에 기록되어 Dashboard build/deploy command 호환 문제 가능성이 높음
  - `git push origin main` 후 commit `074cb46` 원격 check 확인
    - public `Workers Builds: altteulmap` 성공
    - admin `Workers Builds: altteulmap-admin` 실패, build id `e49748e7-4028-4365-9f08-7cd100af28c3`
    - 실패가 시작/종료 같은 초에 기록되어 repo command 실행 전 Cloudflare trigger 설정 mismatch 가능성이 높음
  - `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run deploy:admin`
    - 통과, `https://altteulmap-admin.altteul-lab.workers.dev`, version `5e189228-c36c-4b57-8825-26ad98b402e5`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
    - 통과
  - `npx wrangler deployments list --config wrangler.admin.jsonc`
    - 최신 admin deployment 확인, version `5e189228-c36c-4b57-8825-26ad98b402e5`
  - 루트 `node_modules`를 임시로 숨긴 뒤 `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build --prefix apps/admin`
    - 통과, `apps/admin` install만으로 admin OpenNext build 가능 확인
  - `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm ci && npm run lint && PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin && npm run deploy:check:admin && git diff --check`
    - 통과
- 다음 액션:
  - 변경분을 push해 Cloudflare `altteulmap-admin` 자동 build를 트리거한다.
  - 원격 check success와 duration을 확인한다.
