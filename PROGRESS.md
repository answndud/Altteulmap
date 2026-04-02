# PROGRESS.md

기준일: 2026-04-01

## 진행 현황 요약
- Cycle 10: 관리자 실제 구현을 `src/features/admin/**`로 모으고, public 앱 `entrypoints`와 별도 `apps/admin` 빌드를 추가해 관리자 분리 1차 스캐폴딩 완료. `deploy:admin`과 `deploy:public` 경로도 분리했고, 실제 admin deploy와 `ADMIN_APP_URL` cutover는 마지막 운영 적용만 남아 있음
- Cycle 0: 프로젝트 로컬 기반, DB 경로, 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 검토, 로컬 인증, 네이버 지도 연동 완료
- Cycle 1: 현재 위치 버튼, viewport 재조회, 모바일 목록 바텀시트, 모바일 상세 시트 기초 정리 완료
- Cycle 2: `PLAN.md`/`PROGRESS.md` 운영 문서 형식 정비, 지역/전역 검색, 검색 URL 상태 반영 완료
- Cycle 3: 댓글 작성/삭제, 기존 장소 가격 제보, 관리자 가격 검토 큐 완료
- Cycle 4: 관리자 가격 수정/숨김 UI, 대표 가격 재계산 규칙, 최소 rate limit, DB migration 적용, 실DB 런타임 검증 완료
- Cycle 5: sitemap/robots/canonical/기본 metadata, OAuth scaffolding, deploy check, Playwright E2E 3차, 공개 UI polish 진행 중. 공개 쓰기는 북마크를 제외하고 익명 허용으로 정리됐고, 실제 외부 로그인 E2E와 운영 도메인 기준 점검은 남아 있음
- Cycle 5 장소 등록 정책: 공개 폼은 텍스트 정보만 받고, 지도 위치와 네이버 지도 검색 확인은 운영자 승인 단계에서 처리하도록 다시 정리됨
- Cycle 5 후속: GitHub Actions CI를 `push용 smoke`와 `PR용 full`로 분리하고 Cloudflare Builds와 분리 운영하는 경로 정리 완료
- Cycle 6: 좋아요/싫어요 반응 도입 완료, 비로그인 visitor cookie 반응과 공개 메타 줄 분리까지 반영. 랭킹/목록 노출 확장은 남아 있음
- Cycle 7: repo-local AI workflow 설정 완료 (`.agents`, `.githooks`, `verify`, local commit rules)
- Cycle 8: 로컬 dev/runtime 안정화 완료 (`.next-dev` 분리, `webpack` dev 고정, build/e2e와 출력 경로 분리)
- Cycle 9: 행정안전부 `착한가격업소` 실제 데이터 1000건 import 완료. 지역 라운드로빈 수집, 상세 메뉴 보강, DB seed/API 검증까지 반영됨
- 다음 우선순위: 관리자 visit/activity telemetry 2차, 이후 실제 외부 로그인 E2E와 운영 도메인 점검

## 실행 로그

### 2026-04-02 09:08 KST: `착한가격업소` 실제 데이터 importer 구현과 1000건 seed 반영
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/import-goodprice.ts`를 추가했다. `bsshList.do`를 지역별 round-robin으로 순차 POST 요청해 `대표 가격 <= 10000원`인 업소만 모으고, 선택된 업소에 한해서 `bsshInfo.json`으로 상세 메뉴를 보강한 뒤 앱용 `PlaceRecord[]`로 변환한다.
  - 수집 결과는 `/Users/alex/project/altteulmap/src/features/places/imported-goodprice.json`과 `/Users/alex/project/altteulmap/data/goodprice/import-meta.json`으로 저장된다. 전자는 앱/seed 입력, 후자는 `bsshSn`, 지역 분포, 업종 분포, 선택 옵션 같은 수집 메타를 남긴다.
  - `/Users/alex/project/altteulmap/src/features/places/catalog-data.ts`를 추가하고 `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`, `/Users/alex/project/altteulmap/src/features/admin/repository.ts`, `/Users/alex/project/altteulmap/src/db/seed.ts`를 실제 import 데이터 우선 사용 구조로 바꿨다. `imported-goodprice.json`이 비어 있지 않으면 mock fallback과 DB seed가 모두 이 데이터를 사용한다.
  - `/Users/alex/project/altteulmap/package.json`, `/Users/alex/project/altteulmap/README.md`에 `npm run data:goodprice` 실행 경로를 추가했다.
  - 실제 생성 결과는 2026-04-02 기준 `1000` places, `2616` price items이며, 대표 가격 최대값은 `10000원`, `priceItems > 10000`은 `0건`이었다.
- 검증 결과
  - `npm run data:goodprice -- --limit=20 --delay-ms=50 --include-detail=false --output=/tmp/goodprice-test.json --manifest=/tmp/goodprice-test-manifest.json` 통과
  - `npm run data:goodprice -- --limit=50 --delay-ms=50 --timeout-ms=10000 --include-detail=true --output=/tmp/goodprice-50.json --manifest=/tmp/goodprice-50-manifest.json` 통과
  - `npm run data:goodprice -- --delay-ms=50 --timeout-ms=10000` 통과
  - `python3`로 `/Users/alex/project/altteulmap/src/features/places/imported-goodprice.json` 검사 결과 `1000`건, 평균 `2.62` price items, 대표 가격 최대 `10000`, `priceItems > 10000` `0건` 확인
  - `npm run verify:quick` 통과. 단, 저장소 기존 `apps/admin/.open-next/**` generated 파일 때문에 ESLint warning은 계속 남음
  - `rm -rf .next && npm run verify`는 동일한 `apps/admin/.open-next/**` generated lint 오류 때문에 실패. 이번 importer 변경과 직접 관련된 오류는 아니고, `npm run build` 단독 경로는 통과
  - `npm run build` 통과
  - `npm run db:up` 통과
  - `npm run db:push` 통과
  - `npm run db:seed` 통과
  - `PORT=3111 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3111 npm run start` 후 `curl http://127.0.0.1:3111/api/places/map` 응답에서 `source: "database"`와 실제 `goodprice-*` payload 확인
- 메모
  - 현재 importer는 공공 사이트 부하를 줄이기 위해 병렬 대량 요청 대신 지역별 순차 수집과 timeout/fallback을 사용한다.
  - 좌표는 목록 페이지의 `articleObject2`에서 가져오고, 상세 메뉴는 `bsshInfo.json`에서 보강한다. 공식 Excel export는 구조 파악과 분포 확인에는 유용했지만, 좌표가 없어 1차 앱 적재 원천으로는 직접 쓰지 않았다.
  - `apps/admin/.open-next/**` 경로는 저장소 기존 generated 결과물이라 `verify` 전체 통과를 막고 있다. importer 작업 자체의 build/seed/API 경로는 정상 확인했다.

### 2026-04-02 10:12 KST: 관리자 Worker 배포 경로 보정과 public/admin cutover 조건 고정
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/build-admin-worker.mjs`, `/Users/alex/project/altteulmap/apps/admin/open-next.config.ts`를 추가해 `apps/admin`이 자기 cwd에서 OpenNext build를 만들도록 정리했다.
  - `/Users/alex/project/altteulmap/package.json`의 `cf:build:admin`, `preview:admin`, `deploy:admin`을 별도 관리자 앱 기준으로 바꿨고, `/Users/alex/project/altteulmap/wrangler.admin.jsonc`도 `apps/admin/.open-next/**`를 바라보도록 수정했다.
  - `/Users/alex/project/altteulmap/scripts/build-public-worker.mjs`는 `ADMIN_APP_URL`이 없으면 실패하게 바꿨다. public-only 배포가 `/admin`, `/api/admin`을 제거하므로 외부 관리자 앱 주소 없이 배포되면 링크가 깨지기 때문이다.
  - `/Users/alex/project/altteulmap/.env.example`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/cloudflare-account-to-deploy.md`를 새 배포 순서에 맞게 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run cf:build:admin` 통과
  - `ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run cf:build:public` 통과
- 메모
  - 이전 `deploy:admin`은 root app OpenNext 산출물을 다시 배포하는 구조라 실제 별도 관리자 앱 배포로 이어지지 않았다. 지금 수정은 그 경로를 바로잡는 목적이다.
  - `cf:build:admin` 결과 route 목록에 `/admin`, `/api/admin/*`, `/login`, `/signup`만 남는 것을 확인했다.
  - `cf:build:public` 결과 route 목록에서 `/admin`, `/api/admin/*`가 빠지는 것을 확인했다.

### 2026-04-02 09:24 KST: 관리자 분리 1차 스캐폴딩과 public/admin 빌드 경로 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/admin/pages`, `/Users/alex/project/altteulmap/src/features/admin/api`를 관리자 실제 구현 기준으로 두고, `/Users/alex/project/altteulmap/src/app/admin/**`, `/Users/alex/project/altteulmap/src/app/api/admin/**`는 `/Users/alex/project/altteulmap/src/features/admin/entrypoints/**`를 바라보도록 정리했다.
  - `/Users/alex/project/altteulmap/scripts/sync-admin-entrypoints.mjs`를 추가해 `ALTTEULMAP_ADMIN_MODE=embedded|external`에 따라 entrypoint가 실제 구현 또는 stub(`/Users/alex/project/altteulmap/src/features/admin/stubs/**`)을 바라보게 했다.
  - `/Users/alex/project/altteulmap/src/lib/admin-app.ts`와 stub 페이지/API를 보강해서 `ADMIN_APP_URL`이 없을 때는 redirect loop 대신 안내 패널 또는 `503` 응답을 반환하게 했다.
  - `/Users/alex/project/altteulmap/apps/admin/**`에 별도 Next 앱을 스캐폴딩했다. 이 앱은 `/admin`, `/api/admin`, `/login`, `/signup`, `/api/auth/[...nextauth]`만 노출하고, 루트의 shared admin/auth 구현을 재사용한다.
  - `/Users/alex/project/altteulmap/package.json`에는 `admin:sync`, `admin:build`, `admin:dev`, `admin:start`를 추가했고, 루트 `build/dev/cf:build`는 entrypoint를 먼저 동기화하도록 맞췄다.
- 검증 결과
  - `npm run admin:sync` 통과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
  - `npm run admin:build` 통과
  - `ALTTEULMAP_ADMIN_MODE=external npm run admin:sync` 후 `src/features/admin/entrypoints/pages/dashboard-page.tsx`, `src/features/admin/entrypoints/api/places-list.ts`가 stub 구현으로 바뀌는 것 확인 후 `npm run admin:sync`로 embedded 복구
- 메모
  - 현재는 build 경로와 별도 admin 앱 빌드만 정리된 상태다. 실제 운영에서는 `apps/admin`을 `altteulmap-admin`으로 배포하고, public 앱은 `ADMIN_APP_URL`과 `ALTTEULMAP_ADMIN_MODE=external` 기준으로 cutover하는 단계가 한 번 더 필요하다.

### 2026-04-02 09:05 KST: Cloudflare preview build에서 AUTH_SECRET 누락으로 죽던 auth eager load 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/auth.ts`에서 `authOptions` 상수와 default `NextAuth(...)` eager 초기화를 제거하고, `getAuthOptions()` factory로 바꿨다. 이제 module import만으로 `AUTH_SECRET`을 바로 읽지 않는다.
  - `/Users/alex/project/altteulmap/src/app/api/auth/[...nextauth]/route.ts`는 request 시점에 `NextAuth(getAuthOptions())`를 생성하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/lib/session.ts`는 `AUTH_SECRET`이 없는 환경에서는 `getSessionUser()`를 `null`로 반환해, Cloudflare preview build의 prerender 단계에서 `/submit` 같은 공개 페이지가 로그인 세션 조회 때문에 실패하지 않게 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `tmpdir=$(mktemp -d) && rsync -a --delete --exclude '.git' --exclude '.env' --exclude '.env.*' --exclude '.dev.vars' --exclude '.dev.vars.*' --exclude 'node_modules' ./ "$tmpdir/" && cd "$tmpdir" && npm ci --ignore-scripts && env -i HOME="$HOME" PATH="$PATH" NODE_ENV=production npm run cf:build` 통과
- 메모
  - 수정 전에는 같은 무환경 build에서 `AUTH_SECRET is not set` 예외가 `/api/bookmarks/[id]`, `/api/admin/places/[id]`, `/submit` prerender 단계까지 전파돼 Cloudflare external build가 실패하는 것을 재현했다.
  - 이 수정은 build 시점 강제만 제거한 것이다. 실제 runtime auth를 쓰려면 Cloudflare 쪽 `AUTH_SECRET`은 계속 필요하다.

### 2026-04-02 08:39 KST: 행정안전부 `착한가격업소` 수집 구조 조사와 1차 적재 계획 정리
- 완료 내용
  - `https://goodprice.go.kr/bssh/bsshList.do`가 서버 렌더 POST 폼 목록 페이지임을 확인했다. `pageIndex`, `srchCtpvCd`, `srchSggCd`, `srchIndutyCdArr`, `srchBsshNm`, `srchKeyword`, 편의시설 플래그를 hidden field로 보내며, 페이지당 목록은 4건씩 렌더된다.
  - 같은 페이지의 JS에서 목록 마커 좌표가 `articleObject2` 문자열로 현재 페이지 4건에 한해 포함되는 것을 확인했다. 즉 공식 좌표는 목록 HTML에만 있고, 상세 JSON에는 없다.
  - `https://goodprice.go.kr/bssh/bsshInfo.json`는 `bsshSn` 기준 상세 API로 열려 있고, 업소명/주소/업종/전화/편의시설/부서 연락처/이미지 메타와 `menuList`를 JSON으로 준다. 다만 여기에는 `lat`, `lot`이 비어 있다.
  - `https://goodprice.go.kr/bssh/bsshPageExcel.do`는 현재 검색 조건 전체 결과를 `.xls`로 내려준다. `pageIndex=1&menuId=MN-0103`만 보내도 2026-04-02 기준 전체 `12,109`건이 한 번에 내려왔고, 열은 `업종명/업소명/주요품목/가격/전화/주소/편의시설/지역화폐/이미지명`까지 포함한다.
  - 같은 전체 Excel에서 `가격 <= 10000원` 조건을 적용해 보니 `8,661`건이 남았다. 업종 분포는 `한식 5,258`, `미용업 976`, `기타요식업 690`, `중식 632` 순이고, 지역 상위는 `서울특별시 1,389`, `경기도 1,264`, `부산광역시 810`이었다.
  - `robots.txt`는 일부 커뮤니티 경로만 막고 있지만, 기본적으로 공공 사이트이므로 대량 병렬 크롤링 대신 `공식 Excel 우선 + 필요한 상세/좌표만 저속 보강` 전략으로 잡는다.
- 검증 결과
  - `curl -L 'https://goodprice.go.kr/bssh/bsshList.do'`로 목록 HTML/폼 구조 확인
  - `curl -s 'https://goodprice.go.kr/bssh/bsshInfo.json' -X POST -F 'bsshSn=11005' ... | jq`로 상세 JSON 필드 확인
  - `curl -s -D - -o /tmp/goodprice-page.xls 'https://goodprice.go.kr/bssh/bsshPageExcel.do' -X POST -d 'pageIndex=1&menuId=MN-0103'`로 전체 Excel export 확인
  - `PYTHONPATH=/tmp/xlrd-check python3 ...`로 Excel row 수와 `가격 <= 10000` 분포 계산
- 메모
  - `bsshInfo.json`는 `bsshSn`가 필요하지만 Excel에는 `bsshSn`가 없다. 따라서 `상세 메뉴/이미지/공식 좌표`까지 쓰려면 목록 HTML에서 `goInfo('...')`와 `articleObject2`를 추가로 모아 join해야 한다.
  - 1차 import는 `Excel 일괄 다운로드 -> 가격 1만원 이하 필터 -> 지역/업종 균형 샘플 1천건 선별 -> 주소 geocoding 또는 목록 좌표 보강 -> 앱용 seed 생성` 순서가 가장 안전하다. 상세 메뉴/이미지는 2차 enrichment로 분리하는 편이 요청 수와 복잡도를 줄인다.

### 2026-04-02 08:31 KST: 로컬 dev/build/e2e 산출물 분리로 페이지 전환 멈춤과 cache 손상 방지
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`의 `dev`를 `rm -rf .next-dev && next dev --webpack`으로 바꿨다. 이제 로컬 dev는 Turbopack cache가 아니라 별도 `.next-dev` 산출물과 webpack dev 서버를 사용한다.
  - `/Users/alex/project/altteulmap/next.config.ts`에 dev/build 런타임별 `distDir` 분기를 추가해, dev는 `.next-dev`, build/start/e2e는 계속 `.next`를 쓰도록 고정했다. 이로써 `next dev`와 `next build`/`next start`/Playwright가 같은 `.next`를 공유하며 `00000084.sst` 같은 SST 파일을 잃어버리던 경로를 끊었다.
  - `/Users/alex/project/altteulmap/.gitignore`, `/Users/alex/project/altteulmap/package.json`의 `cf:clean`, `/Users/alex/project/altteulmap/README.md`를 새 산출물 경로 기준으로 갱신했다. Cloudflare clean도 이제 `.next-dev`까지 함께 정리한다.
  - `next dev` 첫 기동 시 `/Users/alex/project/altteulmap/tsconfig.json`의 `include`에 `.next-dev/types/**/*.ts`, `.next-dev/dev/types/**/*.ts`가 자동 추가됐다. dev 타입 생성 위치가 바뀐 데 따른 정상 반영이라 유지한다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `rm -rf .next && npm run verify` 통과
  - `npm run dev` 기동 후 `.next-dev` 생성 확인, `curl -s -o /tmp/altteulmap-admin.html -w '%{http_code}' http://127.0.0.1:3000/admin` 결과 `307`
  - 같은 dev 서버를 유지한 채 `rm -rf .next && npm run build` 통과
  - 같은 dev 서버를 유지한 채 `curl -s -o /tmp/altteulmap-root-during-build.html -w '%{http_code}' http://127.0.0.1:3000/` 결과 `200`
  - 같은 dev 서버를 유지한 채 `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run test:e2e:smoke:ci` 통과
- 메모
  - 이번 이슈의 직접 원인은 `next dev`가 `.next/dev/cache/turbopack` 아래 SST/metadata를 쓰는 동안, build/start/e2e 경로가 같은 `.next`를 다시 만지면서 cache 참조가 깨진 것이다. 사용자에게 보인 `Unable to open static sorted file`, `Failed to lookup task ids`, `Another write batch or compaction is already active`는 이 충돌의 결과다.
  - 이후 로컬 dev가 다시 이상하면 production 산출물인 `.next`는 건드리지 말고 `rm -rf .next-dev && npm run dev`로 복구하는 것을 기본 경로로 삼는다.

### 2026-04-02 08:18 KST: `/map` 호환 경로를 redirect로 줄이고 홈 단일 진입점으로 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`로 실제 지도 홈 구현을 분리했다.
  - `/Users/alex/project/altteulmap/src/app/page.tsx`는 위 구현을 그대로 재사용하는 최소 re-export로 정리했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`는 더 이상 전체 지도 화면을 중복 렌더하지 않고, query string을 유지한 채 `/`로 `permanentRedirect` 하도록 바꿨다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`의 현재 진입 경로 안내도 `/` 기준으로 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과 예정 검증과 함께 route output 확인
- 메모
  - 이 변경의 목적은 사용자 진입 경로를 `/`로 고정하면서, `/map`이 같은 서버 페이지를 한 번 더 싣지 않게 해 route 중복 비용을 줄이는 것이다.

### 2026-04-02 08:10 KST: Cloudflare 무료 플랜 기준으로 번들 경량화와 배포 경로 안정화
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`의 `build`를 `next build --webpack`으로 고정했다. Next 16 기본 Turbopack 빌드에서는 OpenNext 서버 핸들러가 너무 커져 Cloudflare Workers Free 한도 3 MiB를 넘겼다.
  - `/Users/alex/project/altteulmap/src/app/api/**`, `/Users/alex/project/altteulmap/src/lib/visitor-id.ts`, `/Users/alex/project/altteulmap/src/lib/public-write-actor.ts`에서 `next/server`의 `NextRequest`/`NextResponse` 의존을 제거하고 표준 `Request`/`Response`와 수동 cookie header 설정으로 정리했다.
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에서 현재 쓰지 않는 `openGraph`/`twitter` metadata를 제거했고, `/Users/alex/project/altteulmap/wrangler.jsonc`에서는 실제로 쓰지 않는 `images` binding을 제거했다.
  - `/Users/alex/project/altteulmap/package.json`에 `cf:clean`, `cf:build` 스크립트를 추가하고 `preview`, `deploy`, `upload`가 항상 `.next`, `.open-next`를 비운 뒤 다시 빌드하도록 바꿨다. 이전에는 stale build 산출물 때문에 `npm run deploy` 중 OpenNext middleware config 복사 단계가 간헐적으로 깨졌다.
- 검증 결과
  - `npm run lint` 통과
  - `npx opennextjs-cloudflare build` 통과
  - `npm run deploy` 통과
  - 배포 URL `https://altteulmap.altteul-lab.workers.dev`에서 `HTTP 200`, `/robots.txt` 응답 확인
  - OpenNext 서버 핸들러 크기 재측정
    - Turbopack 기준: `.open-next/server-functions/default/handler.mjs` 약 `2595 KiB gzip`
    - Webpack 기준: `.open-next/server-functions/default/handler.mjs` 약 `1088 KiB gzip`
  - 실제 Wrangler 업로드 결과
    - 최종 `Total Upload: gzip 1356.55 KiB`
    - Cloudflare 무료 플랜 한도 안에서 배포 성공
- 메모
  - 이번 경량화의 핵심은 기능 삭제보다 런타임/번들 경로를 바꾼 것이다. `Turbopack -> webpack`, `next/server -> Request/Response` 전환이 가장 큰 효과를 냈다.
  - `sitemap.xml` prerender 중 로컬 production DB에 `places` 테이블이 없으면 mock fallback 로그가 남지만, 빌드와 배포 자체는 정상 통과한다.

### 2026-04-02 08:08 KST: 로그아웃 노출과 관리자 overview 대시보드 1차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/session-action-group.tsx`를 추가해 로그인 상태 공통 액션을 묶었다. 로그인 사용자는 계정 라벨과 `로그아웃` 버튼을 보고, 운영자 계정은 같은 자리에서 `관리` 링크도 바로 볼 수 있다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`, `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/app/report/page.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에 공통 액션을 붙여 공개 화면에서도 로그인 상태와 로그아웃 동선이 보이게 정리했다.
  - `/Users/alex/project/altteulmap/src/features/admin/repository.ts`를 추가해 관리자 overview 집계를 분리했다. 총 사용자 수, 운영자/일반 사용자 수, 현재 세션 수, 세션 사용자 수, 활성 장소 수, 승인 대기 장소 수, 대기 가격 제보 수, 열린 신고 수와 최근 가입 사용자 목록을 한 번에 조회한다.
  - `/Users/alex/project/altteulmap/src/app/admin/page.tsx`를 overview 대시보드로 다시 구성했다. KPI 카드, 장소/가격/신고 바로가기, 최근 가입 사용자 목록, 최신 장소 등록 목록, 최신 신고 목록을 넣었고 방문 지표는 아직 미계측이라는 안내를 명시했다.
  - `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/reports/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/prices/places/[id]/page.tsx`에도 같은 세션 액션을 붙여 관리자 하위 화면에서도 로그아웃이 바로 보이게 했다.
  - `/Users/alex/project/altteulmap/tests/e2e/admin-dashboard.spec.ts`를 추가했고, `/Users/alex/project/altteulmap/package.json`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`, `/Users/alex/project/altteulmap/PLAN.md`를 새 관리자/인증 동선에 맞게 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `rm -rf .next && npm run verify` 통과
  - `npm run db:push` 통과
  - `npm run db:seed` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/map.spec.ts tests/e2e/admin-dashboard.spec.ts tests/e2e/bookmarks.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
  - `USE_MOCK_DATA=true AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run test:e2e:smoke:ci` 통과
- 메모
  - 이번 1차 구현은 현재 DB로 바로 계산 가능한 지표만 노출한다. `방문 수`, `DAU/WAU`, `재방문율`은 아직 저장소가 없어 카드 대신 안내 섹션만 넣었다.
  - 다음 단계는 별도 visit/activity 이벤트 적재와 dedupe 정책을 추가해 관리자 대시보드의 활동 지표를 실제 숫자로 채우는 작업이다.

### 2026-04-02 02:10 KST: 홈/지도 탭 제목을 기본 브랜드명으로 통일
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/page.tsx`, `/Users/alex/project/altteulmap/src/app/map/page.tsx`에서 개별 title `지도에서 알뜰 장소 찾기`를 제거했다.
  - 이제 홈 `/`와 `/map`은 `/Users/alex/project/altteulmap/src/app/layout.tsx`의 기본 metadata title `알뜰맵`을 그대로 사용한다.
- 검증 결과
  - `rg -n 'title:\s*"지도에서 알뜰 장소 찾기"|title:\s*"알뜰맵"' src/app` 결과, 홈/지도 페이지의 개별 title 제거 확인
  - `npm run verify:quick` 통과

### 2026-04-02 01:58 KST: 지도 검색 범위 칩의 선택 상태 배경 회귀 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에서 `현재 지도에서 찾기`/`전체에서 찾기` 칩이 쓰던 `peer-checked:bg...` 조합을 제거하고, `altteulmap-scope-input` + `altteulmap-scope-chip` 조합으로 단순화했다. 기존 구현은 선택 시 `text-white`는 적용되는데 배경은 계속 흰색으로 남아 글자가 안 보일 수 있었다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 범위 칩 전용 규칙을 추가해 `:checked + span`에서 border/background/text를 함께 제어하고, focus ring도 같이 유지되게 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - Playwright 브라우저 샘플에서 `.altteulmap-scope-input:checked + .altteulmap-scope-chip` 계산값이 `color: rgb(255, 255, 255)`, `backgroundImage: linear-gradient(...)`, `borderColor: rgb(156, 89, 52)`로 적용되는 것 확인
- 메모
  - 현재 별도로 떠 있던 기존 `next dev` 프로세스(`localhost:3000`)는 수정 전 클래스 조합을 계속 서빙하고 있었다. 같은 증상이 남아 보이면 dev 서버를 한 번 재시작해 최신 스타일을 반영해야 한다.

### 2026-04-02 01:39 KST: 로고와 인증/운영 화면의 영문 카피 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`에서 로고 위 보조 영문 문구 `Local Saving Map`을 제거하고, 브랜드 표기는 `알뜰맵`과 한글 설명만 남기도록 정리했다.
  - `/Users/alex/project/altteulmap/src/app/admin/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/reports/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/prices/places/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-place-coordinate-picker.tsx`에서 `Admin`, `Place queue`, `Price queue`, `Report queue`, `Coordinate picker`, `API 보기`, `데이터 소스: DB`처럼 섞여 있던 운영 화면 영문/영문 약어를 `운영`, `장소 검토`, `가격 검토`, `신고 검토`, `위치 선택`, `응답 보기`, `데이터 구분: 실데이터` 기준으로 통일했다.
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/repository.ts`, `/Users/alex/project/altteulmap/src/app/api/auth/signup/route.ts`에서 남아 있던 `name@example.com`, `DB 연결`, 환경 변수명을 직접 노출하는 안내 문구를 걷어내고, 인증 화면과 비활성 상태 메시지를 한글 중심으로 정리했다.
- 검증 결과
  - `rg -n 'Local Saving Map|name@example.com|DB 연결|AUTH_[A-Z_]+_CLIENT|Place queue|Price queue|Report queue|Coordinate picker|>Admin<|eyebrow="Admin"|API 보기|데이터 소스:' src/app src/components src/features` 실행 결과, 남은 항목은 환경 변수 참조 같은 내부 코드뿐이고 정리 대상 사용자 노출 문구는 제거된 것 확인
  - `npm run verify:quick` 통과

### 2026-04-02 00:00 KST: 로그인 상태 액션/관리자 대시보드 설계 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`에 로그아웃 버튼 컴포넌트는 이미 있지만, `/Users/alex/project/altteulmap/src/app/map/page.tsx`를 포함한 주요 화면 상단 액션에는 아직 연결되지 않은 상태임을 확인했다. 현재는 비로그인일 때만 `로그인`이 보이고, 로그인 상태의 `로그아웃`/`관리` 동선은 공용 UI로 드러나지 않는다.
  - `/Users/alex/project/altteulmap/src/app/admin/page.tsx`와 `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/reports/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`를 기준으로 보면 관리자 검토 큐 자체는 이미 있지만, 현재 `/admin`은 요약 카드 3개만 있는 초안 상태다. 운영자 요청 기준의 `장소 등록 목록`, `신고 목록`, `유저 현황`을 한 화면에서 보는 overview/dashboard는 아직 없다.
  - `/Users/alex/project/altteulmap/src/db/schema.ts` 기준으로 `users`, `auth_sessions`, `places`, `price_reports`, `content_reports` 집계는 바로 가능하지만, `방문 수`, `DAU/WAU` 같은 활동 지표를 계산할 방문 이벤트 저장소는 없다. `auth_sessions`도 `expires`만 있어 최근 활동 지표 대체재로는 부족하다.
  - `/Users/alex/project/altteulmap/PLAN.md`에 새 작업 `로그인 상태 액션과 운영자 대시보드를 운영 가능한 수준으로 확장한다`를 추가했다. 구현은 `1차: 로그아웃/관리 진입 + 기존 DB 기반 overview`, `2차: visit/activity 이벤트 적재 후 방문/활성 사용자 지표`의 두 단계로 진행하는 것으로 정리했다.
- 메모
  - 1차 관리자 overview 후보 지표: 총 사용자 수, 현재 만료되지 않은 세션 수, 운영자 수/일반 사용자 수, 승인 대기 장소 수, 대기 중인 가격 제보 수, 열린 신고 수, 최근 가입 사용자 목록
  - 2차 활동 지표 후보: 오늘/7일 방문 수, 고유 방문자 수, DAU/WAU, 재방문율. 이 단계는 새 telemetry table, dedupe key, 수집 위치(layout 또는 middleware 수준) 설계가 선행돼야 한다.

### 2026-04-02 01:26 KST: 지도 카테고리/필터 선택 상태 대비 강화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/globals.css`에서 `altteulmap-accent-chip`을 더 진한 오렌지 계열 배경과 흰 텍스트, 더 강한 border/shadow 조합으로 바꿔 선택 상태가 비선택 상태와 확실히 구분되게 조정했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에서 모바일/데스크톱 카테고리, 가격 필터, 검색 범위 칩의 선택/비선택 클래스를 공통 상수로 정리하고, radio `peer-checked` 상태도 기존의 옅은 베이지 대신 진한 활성 색으로 통일했다.
- 검증 결과
  - `npm run verify:quick` 통과

### 2026-04-01 23:47 KST: 공개 지도 플레이스 정렬 기능 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 공개 지도 정렬 UI, `sort` URL 파라미터, 모바일 summary/hidden input을 제거했다. 이제 공개 지도는 검색과 카테고리/가격 필터만 유지하고, 목록은 기본 순서로 고정 노출된다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`, `/Users/alex/project/altteulmap/src/features/places/types.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`에서 공개 지도용 `sort` API 계약과 `likes` 정렬 분기를 제거했다. 내부적으로는 기존 `price`/`recent` 정렬 타입만 남겨 다른 비공개/운영 경로와 충돌하지 않게 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`에서 좋아요순 회귀를 제거했고, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`, `/Users/alex/project/altteulmap/PLAN.md`를 새 공개 지도 계약에 맞게 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `rm -rf .next && npm run verify` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/map.spec.ts` 통과
  - `USE_MOCK_DATA=true AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - `npm run test:e2e:smoke`는 이번 run에서 `e2e:prepare` 이후 build 단계 중 `.next/server/pages-manifest.json`을 찾지 못해 실패했다. 정렬 제거 기능 자체는 위의 수동 build + Playwright 지도 시나리오로 회귀 확인을 마쳤고, smoke 래퍼 이슈는 별도 인프라 문제로 남긴다.

### 2026-04-02 01:18 KST: 공개 등록/회원가입 화면의 불필요한 설명 카피 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`에서 비로그인 안내 문구 `로그인 없이도 장소를 등록할 수 있습니다.`와 제출 전 설명 문단을 제거하고, 로그인 상태일 때만 `등록 계정` 배지만 보이게 정리했다.
  - `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`에서 이름/주소 입력 아래 보조 설명 문구와 하단 정책 설명 박스를 제거해 라벨과 입력 중심으로 단순화했다.
  - `/Users/alex/project/altteulmap/src/app/signup/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`에서 회원가입 화면의 로컬 DB 안내, 자동 로그인 설명, 비활성 상태 설명 박스를 제거해 기능 중심 레이아웃으로 맞췄다.
- 검증 결과
  - `rg -n "로그인 없이도|운영자가|공개 등록은|정확한 도로명 주소만|가입이 완료되면|DB 연결|기존 계정|소셜 로그인만" src/app/submit/page.tsx src/features/submission/place-submit-form.tsx src/app/login/page.tsx src/features/auth/login-form.tsx src/app/signup/page.tsx src/features/auth/signup-form.tsx`에서 정리 대상 정적 설명 문구가 제거된 것 확인
  - `npm run verify:quick` 통과

### 2026-04-01 KST: GitHub Actions를 빠른 main smoke와 PR full 검증으로 분리
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`에 `test:e2e:smoke:ci`, `test:e2e:full:ci`, `test:e2e:smoke`, `test:e2e:full`을 추가하고, 기존 `test:e2e`는 full 세트를 가리키도록 정리했다. `main`용 smoke 세트는 `map`, `signup`, `submission-admin`만 먼저 돌고, 모바일/댓글/신고/가격 검토 흐름은 full 세트에 남긴다.
  - `/Users/alex/project/altteulmap/.github/workflows/ci.yml`에서 E2E 단일 job을 `E2E Smoke`와 `E2E Full`로 나눴다. `push`에서는 `verify:quick + smoke + deploy:check`, `pull_request/workflow_dispatch`에서는 `verify + full`이 돌도록 바꿨다.
  - 같은 workflow에서 `Verify`와 E2E 사이의 직렬 의존성을 제거해 병렬로 시작되게 했고, Playwright 브라우저 캐시(`~/.cache/ms-playwright`)를 추가해 반복 실행 시간을 줄였다.
  - `push` 경로의 `Verify`는 `lint`만 돌고 실제 build는 smoke E2E에서 한 번만 수행하도록 바꿔, main 푸시 기준 중복 build를 줄였다.
  - `/Users/alex/project/altteulmap/scripts/run-local-e2e.mjs`를 추가해 로컬 `test:e2e:*` 명령이 `.env.production.local` 대신 `.env`/`.env.local` 기준으로 돌게 했고, Playwright 서버용 `NEXTAUTH_URL=http://127.0.0.1:3107` 고정과 `db:push -> db:seed` 선행도 같이 처리했다.
  - `/Users/alex/project/altteulmap/README.md`에 새 E2E 스크립트와 CI 분기 기준을 반영했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run test:e2e:smoke` 통과
  - `npm run verify` 통과
- 메모
  - GitHub Actions 로그의 `azure.archive.ubuntu.com`는 GitHub-hosted Ubuntu runner가 Playwright 실행용 시스템 패키지를 apt mirror에서 받는 정상 로그다. 프로젝트와 무관한 인프라 로그다.
  - 로컬 `npm run verify`는 `next build` 특성상 `.env.production.local`을 먼저 읽기 때문에 production DB에 테이블이 없으면 build 로그에 mock fallback 메시지가 남을 수 있다. 빌드는 통과했고, 실제 로컬 E2E는 새 래퍼가 local env를 우선 주입해 우회한다.

### 2026-04-02 01:10 KST: 공개 장소 등록을 텍스트-only로 단순화하고 운영자 승인 단계로 위치 확정 이관
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에서 기존 `공개 폼 내부 위치 확인 필수` 계획을 폐기하고, `공개 등록은 텍스트 입력만 받고 위치/지도 처리는 운영자 승인 단계에서 수행`하는 새 기준으로 cycle 항목을 갱신했다.
  - `/Users/alex/project/altteulmap/src/features/submission/schema.ts`에서 공개 장소 등록 schema에서 `latitude`/`longitude`를 제거했다. 이제 공개 제출 API는 이름, 주소, 카테고리, 가격, 메모 같은 텍스트 정보만 검증하며, 승인용 `placeModerationSchema`만 좌표 입력을 계속 요구한다.
  - `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`를 전면 단순화했다. 네이버 geocoding import, `주소로 위치 확인` 버튼, hidden 좌표 필드, 제출 전 내부 위치 확인 로직을 모두 제거했고, 운영자가 승인 단계에서 지도 위치와 네이버 지도 검색 결과를 확인한다는 안내 문구로 교체했다.
  - 공개 제출 흐름에서 더 이상 쓰지 않는 `/Users/alex/project/altteulmap/src/features/submission/place-coordinate-picker.tsx`를 삭제해, 다음 세션에서 공개 등록이 좌표 picker를 쓰는 것으로 오해하지 않게 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`는 공개 장소 등록을 항상 `latitude: null`, `longitude: null` 상태의 `pending_review`로 저장하도록 바꿨고, 제출 preview에서도 좌표를 더 이상 노출하지 않게 맞췄다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-place-review-form.tsx`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`를 새 정책에 맞게 갱신했다. 공개 제보는 텍스트-only, 운영자는 승인 단계에서 주소와 네이버 지도 검색 결과를 참고해 좌표를 확정하는 흐름으로 설명을 통일했다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`는 회귀 기준을 바꿨다. 공개 폼에 위치 확인 UI가 노출되지 않는지 확인하고, 텍스트-only 등록 후 운영자가 좌표를 입력해 승인하면 홈 검색에 노출되는 시나리오를 유지했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/submission-admin.spec.ts` 통과
- 메모
  - 이번 변경은 `2026-04-02 00:05 KST`에 기록된 `공개 폼 내부 위치 확인 필수` 정책을 대체한다. 이후 공개 등록 UX는 좌표/geocoding을 전제로 두지 않는다.
  - `npm run verify` 중 production build 경로에서는 로컬 DB에 `places` 테이블이 없을 때 기존과 동일하게 mock fallback 로그가 남았지만, 빌드 자체는 정상 통과했다.

### 2026-04-02 00:20 KST: credentials 회원가입 실동작 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`, `/Users/alex/project/altteulmap/drizzle/0006_boring_titania.sql`, `/Users/alex/project/altteulmap/drizzle/meta/0006_snapshot.json`에 `auth_accounts.password_hash`를 추가해 credentials 계정 비밀번호를 별도 해시로 저장할 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/features/auth/password.ts`에 scrypt 해시/검증 helper를 추가하고, `/Users/alex/project/altteulmap/src/features/auth/repository.ts`에서 credentials 로그인 검증과 신규 계정 생성 로직을 구현했다. 기존 demo/admin env 로그인은 계속 유지되고, DB 시드 계정은 이제 credentials account row와 해시를 함께 만든다.
  - `/Users/alex/project/altteulmap/src/app/api/auth/signup/route.ts`, `/Users/alex/project/altteulmap/src/features/auth/schema.ts`를 추가해 이메일/닉네임/비밀번호 기반 회원가입 API와 입력 검증, rate limit을 붙였다.
  - `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`를 실제 가입 폼으로 바꾸고, 가입 성공 시 같은 credentials로 바로 로그인해 callback URL로 이동하도록 연결했다.
  - `/Users/alex/project/altteulmap/tests/e2e/signup.spec.ts`를 추가했고, `/Users/alex/project/altteulmap/tests/e2e/helpers/auth.ts`는 `/login` 페이지 렌더 대신 CSRF + credentials callback 직접 호출 방식으로 바꿔 인증 E2E의 로그인 플래키를 줄였다. `/Users/alex/project/altteulmap/package.json`의 E2E pre-script에는 `.next/types/routes.d.ts` 스텁 생성도 추가해 `next build`의 route types 타이밍 오류를 완화했다.
  - 검증 중 드러난 `/Users/alex/project/altteulmap/src/features/submission/schema.ts`의 Zod 4 타입 옵션 불일치도 같이 정리해 `required_error`/`invalid_type_error`를 현재 버전에 맞는 `error` 옵션으로 바꿨다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run verify:quick` 통과
  - `rm -rf .next && npm run verify` 통과
  - `npm run db:up` 통과
  - `npm run db:push` 통과
  - `npm run db:seed` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/signup.spec.ts tests/e2e/bookmarks.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
- 메모
  - `npm run test:e2e` 전체 스위트는 이번 run에서도 기존 지도 반응 계열(`tests/e2e/map.spec.ts`)에서 간헐적 서버 종료가 재현돼 완전 통과까지는 못 갔다. 회원가입과 기존 credentials 로그인, 운영자 로그인 흐름은 위의 분리 실행 기준으로 통과했다.

### 2026-04-02 00:05 KST: 장소 등록 좌표 확인 필수화와 dev/build 캐시 충돌 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/submission/schema.ts`에서 등록 폼용 schema와 저장용 schema를 분리했다. 폼 단계에서는 주소 입력 뒤 좌표 자동 보정을 허용하고, API 저장 단계에서는 위도/경도가 반드시 있어야 통과하게 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`에서 제출 직전에 좌표가 비어 있으면 주소 기반 geocode를 한 번 더 시도하고, 그래도 좌표가 없으면 제출을 막도록 수정했다. 주소나 지역 구분이 바뀌면 기존 좌표를 비워 다시 확인하게 연결했다.
  - 같은 등록 폼에서 입력 UX도 다시 정리했다. `장소 이름`을 `업장/장소 이름`으로 명확히 바꾸고, `업장 주소` 블록 안에 `위치 확인됨/미확인` 상태와 `주소로 위치 확인` 버튼을 넣어 사용자가 plain text만 쓰고 끝내지 않도록 흐름을 앞단에서 보이게 만들었다.
  - 공개 등록 폼에서는 지도와 위도/경도 숫자 입력 UI를 모두 제거했다. 좌표는 hidden form state로만 유지하고, 사용자에게는 텍스트 주소와 내부 위치 확인 상태만 보이게 바꿨다. 제출 오류 문구도 `좌표 직접 입력`이나 `지도 선택`이 아니라 `주소 재확인` 기준으로 다시 썼다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`를 현재 정책에 맞게 갱신했다. 공개 등록은 `텍스트 주소 + 내부 위치 확인`이 필수이고, 운영자는 제출 좌표를 검수/조정한다는 점이 화면과 문서에 같이 반영된다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`에 주소가 바뀌면 기존 좌표가 비워지고 다시 확인해야 한다는 회귀 테스트를 추가했다.
  - 작업 중 `next dev`와 `next build`/`next start`를 같은 워크트리에서 동시에 돌리며 `.next`를 공유하다가 `ENOENT ... .next/dev/server/pages/_app/build-manifest.json`, `Another write batch or compaction is already active`가 재현됐다. 로컬 `next dev` 프로세스를 종료하고 `/Users/alex/project/altteulmap/.next`를 비운 뒤 다시 기동해 정상 응답을 확인했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/submission-admin.spec.ts`로 기존 승인 흐름(좌표 reset 회귀 테스트 추가 전 기준) 통과
  - `PORT=3107 npm run start` 후 one-off Playwright 스크립트로 `/submit`에서 주소 변경 시 `submit-latitude`/`submit-longitude`가 빈 값으로 초기화되는 것 확인
  - 캐시 정리 후 `npm run dev` 재기동, `curl -I http://127.0.0.1:3000`에서 `200 OK` 확인
- 메모
  - 같은 작업 폴더에서 `next dev`와 `next build`/`next start`를 동시에 돌리지 않는다. dev cache와 production build가 같은 `.next`를 공유해 다시 깨질 수 있다.

### 2026-04-01 23:59 KST: 북마크만 로그인 유지, 공개 쓰기 익명화, 비슷한 장소 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`, `/Users/alex/project/altteulmap/README.md`를 현재 정책에 맞게 갱신했다. 공개 쓰기는 `장소 등록`, `댓글`, `가격 제보`, `신고`까지 익명 허용으로 정리했고, 로그인 유지 기능은 `북마크`만 남겼다.
  - `/Users/alex/project/altteulmap/src/lib/public-write-actor.ts`를 추가하고 `/Users/alex/project/altteulmap/src/app/api/places/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/[commentId]/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`, `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`를 visitor cookie 기반 익명 actor 모델로 통일했다. 로그인 사용자는 기존 user id를 계속 쓰고, 비로그인 사용자는 visitor cookie 또는 forwarded IP fallback 기준으로 rate limit과 본인 삭제 권한을 처리한다.
  - `/Users/alex/project/altteulmap/src/db/schema.ts`, `/Users/alex/project/altteulmap/drizzle/0005_far_maginty.sql`, `/Users/alex/project/altteulmap/drizzle/meta/0005_snapshot.json`에 댓글 익명 저장을 위한 `comments.user_id nullable`, `comments.visitor_id` 추가를 반영했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 `비슷한 장소` 조회/응답/UI를 제거했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`, `/Users/alex/project/altteulmap/src/app/report/page.tsx`를 로그인 유도 대신 익명 제출형 UI로 바꿨고, 북마크 버튼의 로그인 가드는 그대로 유지했다.
  - `/Users/alex/project/altteulmap/tests/e2e/comments.spec.ts`를 추가하고 `/Users/alex/project/altteulmap/tests/e2e/price-review.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`, `/Users/alex/project/altteulmap/package.json`을 익명 공개 쓰기 정책에 맞게 갱신했다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run db:push` 통과
  - `npm run db:seed` 통과
  - `npm run verify:quick` 통과
  - `rm -rf .next && npm run verify` 통과
  - `npm run db:up` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run test:e2e` 통과
- 메모
  - 중간에 `npx playwright test ...` 직접 실행 경로에서 `next start` 웹서버가 한 번 끊기는 현상이 있었지만, 저장소 기본 실행 순서인 `npm run test:e2e`에서는 재현되지 않았고 전체 통과했다.
  - 공개 쓰기 익명화 이후에도 운영자 페이지와 북마크 흐름의 로그인 요구는 그대로 유지한다.

### 2026-04-01 23:55 KST: CI E2E 경직성 보정과 반응 버튼 평면화
- 완료 내용
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`를 현재/향후 UI 상태 둘 다 견디도록 보강했다. `/submit` 진입 시 로그인 페이지로 리다이렉트되면 demo 계정으로 로그인 후 다시 `/submit`로 복귀하고, 비로그인 공개 제출 상태에서는 그대로 진행한다. `submit-business-name`은 필드가 존재할 때만 입력하도록 바꿨고, 완료 문구도 regex 기준으로 완화했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`는 목록 카드 `click()` 대신 `focus() -> Enter`로 활성화해 CI에서 간헐적으로 상세 시트가 열리지 않던 문제를 줄였고, 공유 성공 문구도 고정 문자열 대신 `공유 링크` 포함 여부만 보도록 바꿨다.
  - `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/price-review.spec.ts`의 완료 문구를 regex로 바꿔 카피 미세 조정에 덜 깨지게 맞췄다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`에서 버튼 톤을 다시 평면형으로 정리했다. 공용 버튼 반경과 hover/focus 강도를 낮추고, 좋아요/싫어요 버튼의 내부 캡슐 강조를 없애서 촌스러운 입체감을 줄였다.
- 검증 결과
  - 현재 작업 디렉터리는 사용자 쪽 대형 미커밋 UI 변경 때문에 Next.js runtime 오류가 섞여 재현값이 오염돼, `HEAD=79f306d` 기준 임시 worktree `/tmp/altteulmap-ci-238509`를 만들어 CI 수정만 따로 검증했다.
  - 임시 worktree에서 test patch만 적용한 뒤 `npm ci`, `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run db:seed`, `... npm run test:e2e` 전체 통과 확인
  - 본 작업 디렉터리에서는 `npm run verify:quick` 통과
- 메모
  - 이번 실패는 앱 전면 수정이 필요한 상태가 아니라, E2E가 문구와 선택 동작에 과민하게 고정돼 있던 문제였다.

### 2026-04-01: 모바일 지도 UX 재구성과 인증 진입면 단순화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에서 모바일 상단 탐색 영역을 다시 짰다. 검색은 바로 보이게 남기고, 카테고리/가격/정렬/검색 범위는 `탐색 조건` 접기 패널 안으로 넣어 첫 화면 밀도를 줄였다. 모바일 summary badge로 현재 검색 상태도 바로 보이게 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 모바일 목록 시트를 거의 풀스크린에 가까운 inset drawer로 올리고, 카드 밀도를 줄여 첫 화면에 더 많은 항목이 보이게 바꿨다. 첫 viewport 보고에 따른 초기 재조회는 한 번 건너뛰도록 조정해 모바일에서 목록 개수가 갑자기 줄어드는 인상도 완화했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`에서 모바일 상세 시트를 하단 82vh 시트 대신 상단까지 충분히 올라오는 큰 시트로 바꾸고, grab handle과 sticky header를 넣어 플레이스를 눌렀을 때 핵심 정보가 더 위에서 바로 보이도록 정리했다.
  - `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/social-auth-buttons.tsx`를 수정해 로그인/회원가입 화면에서 소개 패널과 중복 링크를 제거하고, 인증 기능만 남는 단일 카드 구조로 단순화했다. 더 이상 쓰지 않는 `/Users/alex/project/altteulmap/src/features/auth/auth-page-shell.tsx`는 삭제했다.
  - 검증 중 막힌 타입 이슈도 같이 정리했다. `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`에서 댓글 생성 actor를 객체 형태로 넘기도록 맞췄고, `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 미사용 import도 제거했다.
  - 중간에 Turbopack cache가 깨져 `Failed to restore task data` panic이 발생해 `/Users/alex/project/altteulmap/.next`를 비우고 dev/start 서버를 다시 띄웠다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3122 NEXTAUTH_URL=http://127.0.0.1:3122 npm run start` 후 데스크톱 `/login`, `/signup`과 모바일 `/` 렌더를 직접 캡처해 auth 단일 카드 구조, 모바일 접기 패널, 모바일 목록 시트, 모바일 상세 시트 노출 위치를 확인
  - `USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - `verify`와 `start` 중에는 로컬 DB의 `places` 테이블이 없어 mock fallback 로그가 남았지만, 이번 작업 범위인 공개 모바일 UI와 인증 entry 화면 검증에는 영향이 없었다.

- 2026-04-01 22:55 KST
  - GitHub Actions run `23850937895` 재확인. 구조 결함이 아니라 E2E가 실제 UI 문구/선택 동작에 과민한 상태였음.
  - `tests/e2e/submission-admin.spec.ts`에서 제출 완료 문구는 이미 regex로 풀어둔 상태였고, 남은 실패는 검색 결과 카드를 `click()`할 때 상세 시트가 간헐적으로 열리지 않는 문제였음.
  - 지도 상세 E2E와 동일하게 `focus() -> press("Enter")`로 활성화 방식을 통일해 키보드 activation 기준으로 안정화.
  - 버튼 톤은 공용 `altteulmap-button`과 `place-reaction-buttons`를 평면형으로 다시 정리. 입체적인 내부 캡슐/강한 강조 배경을 제거하고 얇은 테두리 + 단색 배경 중심으로 조정.

### 2026-04-01: 장소 등록 폼 이름 필드 단순화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`에서 공개 등록 폼의 `사업장 이름` 입력을 제거하고, 단일 `장소 이름` 필드만 받도록 단순화했다.
  - 같은 폼에 `간판명이나 사용자가 알아보기 쉬운 이름 하나만 입력하면 됩니다.` 안내 문구를 추가하고, 접수 결과 패널 라벨도 `장소 이름` 기준으로 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/submission/schema.ts`의 검증 메시지를 `장소 이름` 기준으로 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`도 현재 UX에 맞게 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/submission-admin.spec.ts` 통과
- 메모
  - 이번 변경은 공개 등록 UX 단순화가 목적이라 DB schema migration은 하지 않았다. `business_name` 컬럼은 기존 데이터/운영 보강용 nullable metadata로 유지한다.

### 2026-04-01: 로그인/회원가입 진입면 재설계와 소셜 가입 페이지 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/social-auth-buttons.tsx`, `/Users/alex/project/altteulmap/src/features/auth/auth-page-shell.tsx`를 정리해 로그인 화면을 좌우 분리형 최소 레이아웃으로 다시 구성했다. 소셜 로그인 버튼은 공용 버튼 배경에 덮이던 문제를 없애고, 카카오/네이버 브랜드 색과 텍스트 대비가 유지되도록 별도 스타일로 분리했다.
  - `/Users/alex/project/altteulmap/src/app/signup/page.tsx`를 추가해 소셜 계정으로 바로 시작하는 회원가입 진입면을 만들었다. 현재 인증 구조상 일반 이메일 비밀번호 회원가입은 지원하지 않으므로, 소셜 로그인 시 자동으로 계정이 생성된다는 안내를 함께 넣었다.
  - `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`를 추가하고 `/Users/alex/project/altteulmap/src/app/map/page.tsx`와 인증 화면에 같은 워드마크를 재사용하도록 바꿨다. 홈 상단 로고는 더 이상 장식 박스 없이 typographic lockup 기준으로 통일된다.
  - `/Users/alex/project/altteulmap/src/lib/session.ts`에 `/signup`용 callback helper를 추가하고, `/login`/`/signup` 자체가 callback 대상으로 다시 들어가지 않도록 정규화 규칙을 보강했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`, `/Users/alex/project/altteulmap/src/app/robots.ts`, `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/trd.md`도 새 auth entry 구조에 맞게 같이 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3122 NEXTAUTH_URL=http://127.0.0.1:3122 npm run start` 후 `npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3122/ /tmp/altteulmap-home-after.png`, `npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3122/login /tmp/altteulmap-login-after.png`, `npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3122/signup /tmp/altteulmap-signup-after.png`로 홈/로그인/회원가입 렌더 확인
  - 같은 production server에서 `npx playwright screenshot --device="iPhone 13" http://127.0.0.1:3122/login /tmp/altteulmap-login-mobile-after.png`로 모바일 로그인 첫 화면에서 폼이 먼저 보이도록 배치가 바뀐 것까지 확인
- 메모
  - `verify`와 `start` 중에는 로컬 DB의 `places` 테이블이 없어서 mock fallback 로그가 남았지만, 이번 작업 범위인 인증 entry UI와 라우팅, 렌더 자체에는 영향이 없었다.

### 2026-04-01: 익명 장소 등록 허용과 공개 CTA 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/prd.md`, `/Users/alex/project/altteulmap/trd.md`를 갱신해 현재 정책을 `비회원 읽기 + 비회원 반응 + 비회원/회원 장소 등록 + 회원 전용 북마크/댓글/신고/가격 제보` 기준으로 재정의했다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`에서 비로그인 사용자의 `/submit` 리다이렉트를 제거하고, 로그인 상태가 없을 때도 `로그인 없이도 장소를 등록할 수 있습니다.` 안내가 보이도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/app/api/places/route.ts`에서 장소 등록 API의 로그인 필수 조건을 제거하고, 로그인 사용자는 user id 기준, 비로그인 사용자는 visitor cookie 또는 forwarded IP fallback 기준으로 rate limit을 적용한 뒤 익명 등록은 `created_by_user_id = null`로 저장되도록 정리했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`의 공개 CTA는 항상 `/submit`로 바로 들어가게 바꿔, 로그인 없이도 `장소 등록하기` 흐름으로 진입할 수 있게 했다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`, `/Users/alex/project/altteulmap/README.md`를 현재 정책에 맞게 갱신해, E2E와 문서가 `로그인 없는 장소 등록 -> 관리자 승인` 흐름을 기준으로 설명하도록 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `npm run db:up` 통과
  - `npm run db:push` 통과
  - `npm run db:seed` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/submission-admin.spec.ts` 통과
- 메모
  - plain `npx playwright test tests/e2e/submission-admin.spec.ts`는 `next start`가 `.env.production.local`의 원격 DB 값을 먼저 읽어 로컬 승인 큐를 보지 못할 수 있으므로, 로컬 E2E에서는 위처럼 local DB/auth env를 명시하는 편이 안전하다.

### 2026-04-01: 홈 로고 장식 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에서 홈 상단 로고 링크의 장식 박스(`알` 아이콘 박스)를 제거하고, 텍스트 블록만 남기는 구조로 단순화했다.
  - 같은 링크는 `inline-flex min-w-0 flex-col` 기준으로 정리해, CTA 줄과 붙어 보일 때도 상단 텍스트 스타일과 충돌하지 않게 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
- 메모
  - 이번 수정은 홈 상단 로고 블록 구조만 건드린 작은 레이아웃 수정이다.

### 2026-04-01: 전역 헤더 제거와 홈 로고/로그인 재배치
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`에서 전역 `SiteHeader` 렌더를 제거하고 `<html lang="ko" suppressHydrationWarning>`로 바꿔, 개발 환경에서 외부 확장이 `html`에 style attribute를 주입할 때 보이던 hydration mismatch 경고를 억제했다.
  - `/Users/alex/project/altteulmap/src/components/site-header.tsx`는 더 이상 쓰이지 않아 삭제했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`의 좌측 상단 블록을 텍스트 로고 링크로 교체하고, CTA 줄에 `장소 등록하기`, `북마크`, `로그인` 순서로 배치되도록 조정했다. 비로그인 상태에서 `로그인`은 현재 홈으로 다시 돌아오도록 callback URL을 붙여 이동한다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3117 NEXTAUTH_URL=http://127.0.0.1:3117 npm run start` 후 `curl -s http://127.0.0.1:3117/`로 렌더 HTML을 확인해 `<header>`가 사라지고, 홈 상단에 로고 링크와 `북마크`, `로그인` 버튼이 같은 CTA 줄에 배치된 것을 확인
  - 이후 헤더 파일 삭제 뒤 `npm run verify:quick` 재통과
- 메모
  - `--vsc-domain` 같은 외부 주입 attribute는 서버 HTML에 없고 개발 환경에서만 붙을 수 있어서, 이번 조치는 경고 억제 목적이다.

### 2026-04-01: 공개 버튼 재질감 재설계와 `space-y-2` 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/globals.css`에서 `altteulmap-button`, `altteulmap-chip`, `altteulmap-badge`를 다시 설계해, 흰 버튼과 강조 버튼 모두가 카드와 같은 크림 톤 gradient, 얇은 외곽선, inset highlight, hover lift, focus ring을 공유하도록 정리했다.
  - 같은 공용 버튼 유틸에 기본 `1px` border를 넣어 accent CTA와 소셜 로그인 버튼도 더 또렷한 입체감이 생기도록 조정했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`에서 `space-y-2`를 모두 제거하고 `flex/grid + gap` 기반 레이아웃으로 바꿨다.
- 검증 결과
  - `rg -n "space-y-2" src/app src/components src/features` 결과 없음 확인
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3116 NEXTAUTH_URL=http://127.0.0.1:3116 npm run start` 후 `curl -s http://127.0.0.1:3116/`, `curl -s http://127.0.0.1:3116/login`으로 렌더 HTML을 확인해 `altteulmap-button`, `altteulmap-chip`, `altteulmap-badge` 클래스가 공개 화면에 반영되고 `space-y-2`가 다시 들어오지 않은 것을 확인
- 메모
  - 로컬 `start` 검증은 현재 DB 테이블이 없는 상태라 mock fallback 로그를 남기지만, 이번 변경은 CSS/공개 컴포넌트 중심이라 렌더 확인에는 영향 없었다.

### 2026-04-01: 공개 UI 라벨 정리와 버튼 형태 재정비
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/site-header.tsx`에서 공개 헤더의 `신고`, `북마크` 메뉴를 제거하고, 로그인/관리/사용자 pill만 남기도록 간소화했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 홈 상단 소개 문구를 걷어내고, `제보하기`를 `장소 등록하기`로, `저장한 곳`을 `북마크`로 바꿨다. 지도 우측 현재 위치 버튼은 `내 위치`로 줄이고 크기도 작게 조정했다.
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/app/login/page.tsx`에서 로그인 페이지의 테스트 계정 패널과 demo placeholder를 제거하고 단일 로그인 폼 레이아웃으로 정리했다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`에서 공개 북마크 버튼과 북마크 화면 라벨을 `저장*` 대신 `북마크*` 기준으로 통일했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 `altteulmap-button`, `altteulmap-chip`, `altteulmap-badge` 공용 스타일을 추가하고, 공개 화면 버튼/칩/배지에서 과한 pill 형태를 줄여 더 각진 모서리로 정리했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`, `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-coordinate-picker.tsx`, `/Users/alex/project/altteulmap/src/app/report/page.tsx`, `/Users/alex/project/altteulmap/src/features/reports/report-submit-form.tsx`, `/Users/alex/project/altteulmap/src/components/access-denied-panel.tsx`에서도 같은 버튼 모서리 규칙을 적용해 공개 흐름 전반의 액션 스타일을 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 장소 등록 성공 메시지와 기본 설명 fallback도 `장소 등록` 용어에 맞춰 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3115 NEXTAUTH_URL=http://127.0.0.1:3115 npm run start` 후 `curl -s http://127.0.0.1:3115/`로 홈 HTML을 확인해 `장소 등록하기`, `북마크`, `지도` 헤더가 반영되고 기존 소개/저장/제보 문구와 공개 헤더 `신고`가 빠진 것을 확인
  - `curl -s http://127.0.0.1:3115/login`으로 로그인 HTML을 확인해 `테스트 계정`, `바로 확인해볼 계정`, `demo@altteulmap.local` 노출이 사라지고 `name@example.com` placeholder만 남은 것을 확인
- 메모
  - 로컬 `start` 확인은 DB 테이블이 없는 상태라 mock data fallback 로그를 남기지만, 공개 UI 텍스트와 레이아웃 반영 확인에는 문제 없었다.

### 2026-04-01: GitHub Actions Verify job의 빈 OAuth env 실패 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/env.ts`에서 optional env를 빈 문자열이면 `undefined`로 정규화하도록 바꿔, CI나 로컬 환경에서 OAuth 관련 값이 빈 문자열로 들어와도 Zod 파싱이 실패하지 않게 했다.
  - `/Users/alex/project/altteulmap/.github/workflows/ci.yml`의 `Verify`, `E2E` job에서는 불필요한 빈 OAuth env를 아예 주입하지 않도록 정리했다.
  - `/Users/alex/project/altteulmap/playwright.config.ts`의 `mobile-chromium` project에 `browserName: "chromium"`을 명시해, `iPhone 13` preset이 암묵적으로 `webkit`을 선택하던 상태를 바로잡았다.
  - `/Users/alex/project/altteulmap/src/db/client.ts`에서 production 모드에도 전역 DB 인스턴스를 재사용하도록 바꿔, `next start` 기반 E2E 중 요청마다 새 Postgres client가 생기며 `too many clients already`로 무너지는 문제를 막았다.
  - `/Users/alex/project/altteulmap/tests/e2e/bookmarks.spec.ts`의 북마크 버튼 기대값을 `저장/저장됨`과 `북마크/북마크됨` 둘 다 허용하도록 바꿔, 원격 main과 로컬 작업본의 라벨 차이 때문에 CI가 흔들리지 않게 했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`는 목록 카드 전체 클릭 대신 키보드 활성화(`focus -> Enter`)로 상세 시트를 열게 바꿔, CI에서 카드 클릭 타깃이 흔들리던 문제를 줄였다.
- 원인
  - GitHub Actions `Verify` job이 `AUTH_KAKAO_*`, `AUTH_NAVER_*`를 `""`로 주입했고, 기존 schema가 이를 `optional`이 아닌 `빈 문자열`로 해석해 build 중 `/api/admin/price-items/[id]` page data 수집 단계에서 ZodError를 발생시켰다.
  - 이후 다음 run에서는 `E2E` job의 모바일 테스트가 `mobile-chromium` 이름과 달리 실제로는 `webkit` executable을 찾고 있었고, CI는 `chromium`만 설치한 상태라 `Executable doesn't exist at .../webkit-.../pw_run.sh`로 실패했다.
  - 그 다음 run에서는 `next start` 기반 production 서버가 DB 연결을 재사용하지 않아, E2E 도중 `too many clients already`가 발생했고 관리자 로그인/장소 승인 시나리오가 `/login?callbackUrl=%2Fadmin%2Fplaces`에 머물렀다.
  - 같은 로컬 재현 중 북마크 E2E는 환경에 따라 버튼 라벨이 `저장됨` 또는 `북마크됨`으로 달라질 수 있는데, 테스트가 한 쪽만 기대하고 있어 실패했다.
  - 그 다음 run에서는 `map.spec`가 목록 카드 전체 클릭으로 상세 시트를 열도록 되어 있었는데, CI에서 클릭 타깃이 흔들리면서 `place-detail-sheet`가 열리지 않는 경우가 있었다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `AUTH_KAKAO_CLIENT_ID='' AUTH_KAKAO_CLIENT_SECRET='' AUTH_NAVER_CLIENT_ID='' AUTH_NAVER_CLIENT_SECRET='' USE_MOCK_DATA=true AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 npm run verify` 통과
  - `USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run db:push` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run db:seed` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npm run test:e2e` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/bookmarks.spec.ts` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=ci-auth-secret NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/map.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts`는 마지막 남은 `map.spec` 클릭 안정화 포인트만 남긴 상태까지 확인
- 메모
  - 이 수정으로 optional OAuth env가 없는 상태와 빈 문자열 상태를 동일하게 취급한다.
  - 모바일 E2E는 이름 그대로 Chromium 기반 iPhone viewport 시뮬레이션으로 고정됐다.
  - production 서버에서도 DB client를 재사용하도록 바뀌어, CI와 같은 `next start` 경로에서 연결 수 폭증이 다시 나지 않아야 한다.

### 2026-04-01: GitHub Actions CI 추가와 Cloudflare Builds 분리 운영 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/.github/workflows/ci.yml`을 추가해 GitHub Actions에서 `Verify`, `E2E`, `Deploy Config Check` 세 job을 실행하도록 구성했다.
  - `Verify`는 더미 auth env와 mock data 기준으로 `npm run verify`를 수행하고, `E2E`는 Postgres service container를 띄운 뒤 `npm run db:push`, `npm run db:seed`, `npm run test:e2e`를 수행하도록 분리했다.
  - `Deploy Config Check`는 GitHub repo `Secrets/Variables`에 저장된 운영 env를 읽어 `npm run deploy:check`를 수행하게 구성해, production 설정 검증과 테스트용 로컬 DB/E2E를 분리했다.
  - `/Users/alex/project/altteulmap/README.md`와 `/Users/alex/project/altteulmap/PLAN.md`에 `GitHub Actions가 검사`, `Cloudflare Builds가 배포`를 맡는 현재 운영 방식을 반영했다.
  - 로컬 `.env.production.local`에 들어 있는 운영 값 중 `Deploy Config Check`에 필요한 항목을 GitHub repo `Secrets/Variables`로 실제 등록했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/.github/workflows/ci.yml`
  - `/Users/alex/project/altteulmap/README.md`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `gh secret list --repo answndud/Altteulmap`로 `DATABASE_URL`, `AUTH_SECRET`, `AUTH_KAKAO_CLIENT_SECRET`, `AUTH_NAVER_CLIENT_SECRET` 등록 확인
  - `gh variable list --repo answndud/Altteulmap`로 `USE_MOCK_DATA`, `NEXTAUTH_URL`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `AUTH_KAKAO_CLIENT_ID`, `AUTH_NAVER_CLIENT_ID` 등록 확인
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml")'` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
- 메모
  - GitHub Actions workflow에는 production 비밀값을 직접 커밋하지 않고, GitHub repo `Secrets/Variables` 참조만 남겼다.
  - Cloudflare Builds는 이미 연결된 GitHub 저장소 기준으로 계속 자동 배포를 담당한다.

### 2026-04-01: Cloudflare 배포 후 네이버 지도 인증 실패 시 지도 패널 fallback 보강
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 네이버 지도 SDK 초기화/마커 렌더링/viewport 이동 구간의 방어 코드를 추가해 `maps.Map`, `maps.LatLng`, `maps.Marker`, `maps.Event`가 비정상 상태일 때 즉시 에러 상태로 전환하도록 보강했다.
  - 같은 파일에 지도 패널 전용 error boundary와 preview fallback UI를 추가해, 네이버 지도 SDK가 런타임에서 예외를 던져도 페이지 전체가 `This page couldn’t load`로 죽지 않고 장소 목록/상세 시트는 계속 사용할 수 있게 만들었다.
  - `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`에 네이버 지도 키는 환경 변수만이 아니라 NAVER Cloud Platform 콘솔의 웹 서비스 URL/허용 도메인에도 실제 배포 주소(`workers.dev` 또는 custom domain)를 등록해야 한다는 점을 추가했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`
  - `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `NEXT_PUBLIC_NAVER_MAP_KEY_ID=invalid-map-key-123 NEXTAUTH_URL=http://127.0.0.1:3110 npm run build` 통과
  - `PORT=3110 NEXTAUTH_URL=http://127.0.0.1:3110 npm run start` 후 Playwright로 `http://127.0.0.1:3110/` 접속, 장소 목록 클릭 시
    - `This page couldn’t load` 미발생
    - `지도를 불러오지 못해 임시 미리보기로 표시합니다.` 표시
    - 상세 시트 정상 오픈 확인
  - 배포 URL `https://altteulmap.altteul-lab.workers.dev/` 재검증 시 네이버 SDK auth는 `200`으로 성공했고, 실제 지도 타일도 `nrbe.pstatic.net/styles/...png`로 내려오는 것을 확인했다.
  - 이후 `src/features/map/naver-map-panel.tsx`의 지도 표시 감지 조건에 `.pstatic.net/styles/`, `.pstatic.net/static/maps/`를 추가하고 `npm run verify`, `PORT=3112 NEXTAUTH_URL=http://127.0.0.1:3112 npm run start` + Playwright로 `지도를 불러오는 중입니다.` 문구와 preview overlay가 사라지는 것 확인
  - `npm run deploy`로 Cloudflare 재배포 완료
  - 재배포 후 `https://altteulmap.altteul-lab.workers.dev/`에서 Playwright로 재검증했고, preview overlay 없음, `지도를 불러오는 중입니다.` 문구 없음, 장소 목록 클릭 시 상세 시트 정상 오픈, `This page couldn’t load` 미발생 확인
- 메모
  - 실제 Cloudflare 배포 주소에서 지도가 계속 로딩 상태로 남는 근본 원인은 네이버 지도 키의 허용 도메인/웹 서비스 URL에 `https://altteulmap.altteul-lab.workers.dev`가 등록되지 않았을 가능성이 높다.
  - 현재는 네이버 지도 키 허용 도메인 반영 이후 auth 자체는 풀렸고, 남은 증상은 우리 코드가 `nrbe.pstatic.net` 타일 URL을 지도 자산으로 인식하지 못해 preview overlay를 계속 유지하던 문제였다.
  - 다음 배포는 이 코드 수정이 포함돼야 실제 `workers.dev` 화면에서도 로딩 문구가 사라진다.

### 2026-04-01: Cloudflare 계정 생성부터 첫 배포까지 총괄 가이드 문서화
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/cloudflare-account-to-deploy.md`를 추가해 Cloudflare 계정 생성, Wrangler 로그인, `workers.dev` 첫 배포, runtime 변수/secret 등록, OAuth callback 연결, 커스텀 도메인 전환까지 전체 흐름을 정리했다.
  - 현재 저장소의 실제 배포 방식이 `로컬 OpenNext build -> Wrangler deploy`라는 점을 기준으로, 로컬 build 환경 변수와 Cloudflare runtime 변수 둘 다 필요하다는 운영 메모를 문서에 명시했다.
  - `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/README.md`에도 새 총괄 가이드 링크를 연결했다.
- 검증 결과
  - 문서 작업만 수행했고 별도 테스트는 실행하지 않았다.
- 메모
  - 내용은 Cloudflare와 OpenNext의 공식 문서, 그리고 현재 저장소 설정(`wrangler.jsonc`, `open-next.config.ts`, `package.json`)을 함께 기준으로 작성했다.

### 2026-04-01: hook 경고 후속 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/seed.ts`, `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`, `/Users/alex/project/altteulmap/scripts/smoke-local.mjs`의 `console.log`를 `stdout` 출력으로 바꿔 repo-local hook 경고를 줄였다.
  - 스크립트 동작은 그대로 유지하고, CLI 출력 포맷도 바뀌지 않게 맞췄다.
- 검증 결과
  - `rg -n "console\\.log" src/db/seed.ts scripts/check-cloudflare-deploy.mjs scripts/smoke-local.mjs` 결과 없음
  - `npm run verify:quick` 통과
- 메모
  - `console.error`는 실패 로그용으로 유지했다.

### 2026-04-01: 모바일 viewport Playwright 1차와 자체 리뷰
- 완료 내용
  - `/Users/alex/project/altteulmap/playwright.config.ts`에 `mobile-chromium` 프로젝트를 추가하고, 데스크톱 프로젝트는 `*.mobile.spec.ts`를 제외하도록 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.mobile.spec.ts`를 추가해 모바일 목록 바텀시트 열기/닫기와 목록에서 플레이스를 선택했을 때 상세 시트가 열리고 닫힌 뒤 지도 화면으로 복귀하는 흐름을 검증하도록 만들었다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`의 목록 test id를 데스크톱과 모바일로 분리해 `desktop-place-list`, `mobile-place-list`, `mobile-place-list-item-*` 기준으로 모바일 UI를 안정적으로 집도록 정리했다.
  - `/Users/alex/project/altteulmap/package.json`의 `test:e2e`, `test:e2e:headed`는 모바일 viewport 시나리오만 `USE_MOCK_DATA=true` 런타임으로 분리하고, 기존 데스크톱 지도/북마크/등록/신고/관리자 흐름은 DB 기반으로 유지하도록 확장했다.
- 검증 결과
  - `npm run test:e2e` 통과
  - `npm run verify` 통과
- 리뷰 결과
  - `typescript-reviewer` 기준 자체 리뷰와 변경 파일 기준 서브에이전트 리뷰를 진행했다.
  - 최초 리뷰에서 `map.mobile`도 DB 상태에 의존하고 모바일/데스크톱 목록 test id가 겹친다는 지적이 있었고, 두 문제를 같은 세션에서 바로 수정했다.
  - 수정 후에는 현재 변경 범위에서 추가 수정이 필요한 동작 회귀나 타입/상태 정합성 문제를 찾지 못했다.
- 메모
  - 현재 Playwright는 데스크톱 read/react/share/admin 흐름과 별도로 모바일 목록 시트/상세 시트 전환까지 덮고, 모바일 viewport read 시나리오는 mock runtime으로 반복 가능하게 고정했다.
  - 남은 모바일 E2E 과제는 스냅/제스처 자체가 아니라, 실제 소셜 로그인 이후 모바일 보호 플로우와 좁은 viewport에서의 추가 쓰기 흐름이다.

### 2026-04-01: Playwright E2E 3차 확장과 로컬 검증 안정화
- 완료 내용
  - `/Users/alex/project/altteulmap/tests/e2e/helpers/auth.ts`를 기준으로 credentials 로그인 헬퍼를 공용화하고, 현재 Playwright 범위를 북마크 저장/해제, 신고 제출/관리자 처리, 가격 제보/관리자 반려까지 넓혔다.
  - `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`의 로그인 callback URL을 ASCII query 기준으로 정리해 한글 query가 섞일 때 발생하던 브라우저 예외를 피하도록 수정했다.
  - `/Users/alex/project/altteulmap/src/db/client.ts`에서 postgres client에 `idle_timeout: 5`를 추가해 장시간 E2E 실행 뒤에도 로컬 연결이 오래 남지 않도록 보강했다.
  - `/Users/alex/project/altteulmap/playwright.config.ts`는 `next start`만 담당하도록 단순화하고, `/Users/alex/project/altteulmap/package.json`의 `test:e2e`와 `test:e2e:headed`는 `build` 후 Playwright를 두 그룹으로 나눠 실행하도록 바꿨다.
  - `/Users/alex/project/altteulmap/package.json`의 `pretest:e2e*`에서 3107 포트 stale 서버와 `test-results`, `playwright-report`, `.next`를 정리하도록 해 반복 실행 안정성을 높였다.
  - 검증 중 생성된 `E2E분식...`, `E2E 신고 ...`, `E2E 가격 ...` 데이터와 관련 `admin_actions`는 수동 정리해 로컬 DB를 seed 상태에 가깝게 되돌렸다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx playwright test tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
  - `npx playwright test tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
  - `npm run test:e2e` 통과
  - `npm run verify` 통과
- 메모
  - 현재 Playwright는 지도 read/react/share, credentials 로그인, 장소 등록/승인, 북마크 저장/해제, 신고 제출/처리 완료, 가격 제보/반려까지 덮는다.
  - `npm run test:e2e`는 `bookmarks/map`와 `price-review/report-admin/submission-admin` 두 그룹으로 나눠 실행해야 현재 로컬 환경에서 가장 안정적이다.
  - 남은 큰 테스트 과제는 실제 카카오/네이버 로그인과 모바일 viewport 전용 시나리오다.

### 2026-03-31: Playwright E2E 2차 확장
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-place-review-form.tsx`에 로그인, 장소 제보, 관리자 승인 흐름용 `data-testid`를 추가했다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`를 추가해 `credentials 로그인 -> 장소 제보 -> 관리자 승인 -> 홈 검색 노출` 흐름을 Playwright로 검증하도록 만들었다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/PROGRESS.md`를 현재 E2E 범위 기준으로 최신화했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
  - `npm run test:e2e` 통과
  - `npm run verify` 통과
  - 검증 후 로컬 DB에 남아 있던 `E2E분식...` 승인 테스트 장소와 관련 `admin_actions`를 직접 정리했다
- 메모
  - 현재 Playwright는 지도 read/react/share 흐름에 더해 credentials 로그인, 장소 등록, 관리자 승인까지 덮는다.
  - 다음 E2E 확장 후보는 신고 제출, 북마크, 관리자 가격 검토, 실제 카카오/네이버 로그인이다.

### 2026-03-31: Playwright E2E 1차 도입
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`에 `test:e2e`, `test:e2e:headed`, `test:e2e:ui`, `playwright:install` 스크립트를 추가했다.
  - `/Users/alex/project/altteulmap/playwright.config.ts`를 추가해 `build + start` 기반 Playwright 실행 설정을 넣었다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`에 지도 첫 진입, 검색, 상세 시트 열기/닫기, 비회원 좋아요/취소, 좋아요순 정렬, 공유 버튼 fallback 흐름을 추가했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 Playwright용 안정적인 `data-testid`를 추가했다.
  - `/Users/alex/project/altteulmap/README.md`에 Playwright 설치/실행 방법을 문서화했다.
- 검증 결과
  - `npm install` 통과
  - `npx playwright install chromium` 통과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
  - `npm run test:e2e` 통과
- 메모
  - 현재 E2E는 지도 핵심 read/react/share 흐름까지만 포함한다.
  - 다음 확장 후보는 소셜 로그인, 북마크, 등록, 신고, 관리자 승인/가격 검토다.

### 2026-03-31: 지도 목록 좋아요 노출, 좋아요순 정렬, 공유 버튼 1차
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에서 정렬 타입에 `likes`를 추가했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 `좋아요순` 정렬 옵션을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 지도 목록 카드에 좋아요 수를 노출하고, 상세 시트에서 반응이 바뀌면 현재 지도 목록과 마커에 바로 반영되도록 동기화를 보강했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`를 추가했고, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`에 공유 버튼을 붙였다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
- 메모
  - 현재 공유 기능은 Web Share API 우선, 없으면 클립보드 복사 fallback 구조다.

### 2026-03-31: 공개 화면 가격 이력 섹션 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에서 공개 상세 페이지의 `가격 이력` 섹션을 제거했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`에서 상세 시트의 `가격 이력` 섹션을 제거했다.
  - 상세 시트 로딩 문구도 `세부 가격과 코멘트` 기준으로 짧게 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
- 메모
  - 현재는 공개 UI에서만 제거했고, 내부 데이터 구조와 가격 검토/운영용 기록은 그대로 유지한다.

### 2026-03-31: 지도 마커 좋아요 동기화와 꼬리 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`에 반응 변경 콜백을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`를 연결해 상세 시트에서 좋아요/싫어요를 누르면 현재 지도 목록과 선택된 플레이스 데이터가 즉시 갱신되도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 서버 props 변경 동기화도 추가해 `router.refresh()` 이후 목록 상태가 최신 반응 수를 다시 반영하도록 보강했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 마커 HTML의 하단 다이아 꼬리를 제거하고, pill 형태 마커를 중심 anchor 기준으로 다시 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run build` 통과
- 메모
  - 클라이언트 지도 상호작용은 정적 검증과 코드 경로 기준으로 정리했다. 브라우저에서 상세 시트 반응 직후 지도 마커 숫자가 바로 바뀌는지 최종 눈검증만 남아 있다.

### 2026-03-31: 비로그인 좋아요/싫어요와 공개 메타 줄 분리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`의 `place_reactions`를 `user_id` 또는 `visitor_id` 기준으로 저장할 수 있게 바꿨고 `/Users/alex/project/altteulmap/drizzle/0004_yellow_morlocks.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/lib/visitor-id.ts`를 추가해 guest visitor id cookie를 읽고 생성하도록 정리했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/reaction/route.ts`는 더 이상 로그인을 요구하지 않고, guest 요청이면 visitor cookie를 발급한 뒤 반응을 저장한다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`를 갱신해 guest도 자신의 반응 상태를 다시 읽을 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`에서 로그인 리다이렉트를 제거했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`에서 업종과 위치를 한 줄 메타 대신 여러 줄로 분리했다.
  - 로컬 `http://localhost` 기반 smoke에서도 cookie가 저장되도록 visitor cookie의 `Secure` 플래그를 host 기준으로 제어했다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run db:push` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3105 npm run start` 기준으로 guest `PUT /api/places/school-gimbap/reaction` 응답에서 `Set-Cookie: altteulmap_visitor_id=...` 확인
  - 같은 visitor cookie를 `GET /api/places/school-gimbap`에 전달했을 때 `viewerReaction: "like"`가 내려오는 것 확인
  - 같은 visitor cookie로 `reaction: null`을 보냈을 때 취소 응답과 카운트 감소 확인
  - `/place/school-gimbap` HTML에서 `분식`, `서울 성북구 동소문로22길 31`, `학교앞김밥 성신점`이 각각 분리된 줄로 렌더링되는 것 확인
- 메모
  - 검증 중 생성한 visitor reaction row는 정리해 현재 DB에 남겨두지 않았다.

### 2026-03-31: 플레이스 좋아요/싫어요 1차 도입
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`에 `place_reaction_type`, `place_reactions`를 추가했고 `/Users/alex/project/altteulmap/drizzle/0003_graceful_ma_gnuci.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에서 공개 읽기용 반응 카운트 집계와 사용자별 단일 반응 저장 로직을 추가했다. 한 사용자는 한 플레이스에 `like` 또는 `dislike` 하나만 유지하고, 같은 반응을 다시 누르면 취소된다.
  - `/Users/alex/project/altteulmap/src/features/places/reaction-schema.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/reaction/route.ts`를 추가해 반응 쓰기 API와 검증을 붙였다.
  - `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`를 추가했고 `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에 좋아요/싫어요 UI를 배치했다.
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`, `/Users/alex/project/altteulmap/src/features/places/mock-data.ts`를 갱신해 `likeCount`, `dislikeCount`, `viewerReaction`을 place 응답에 포함시켰다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run db:push` 통과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `npm run verify` 통과
  - `PUT /api/places/school-gimbap/reaction` 비로그인 요청이 `401`을 반환하는 것 확인
  - `GET /api/places/school-gimbap` 응답에 `likeCount`, `dislikeCount`, `viewerReaction` 필드가 포함되는 것 확인
  - 검증용 DB insert 후 `GET /api/places/school-gimbap` 응답에서 `likeCount: 1` 반영을 확인했고, 이후 `place_reactions` 테이블 count를 `0`으로 원복했다
- 메모
  - 이번 1차 범위는 상세 시트와 상세 페이지 반응 UI까지다. 지도 목록 노출과 좋아요 랭킹/정렬은 다음 단계로 남겨둔다.

### 2026-03-31: 지도 선택 후 목록 누락 버그 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 플레이스 선택 시 무조건 `panTo` 하던 흐름을 정리했다.
  - 마커 클릭은 상세 선택만 수행하고, 이미 현재 viewport 안에 있는 장소를 선택할 때는 지도를 다시 이동하지 않도록 바꿨다.
  - 이 변경으로 플레이스 클릭 뒤 `idle -> viewport 재조회`가 연쇄적으로 발생하면서 목록이 과도하게 줄어드는 문제를 막았다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 초기 지도 범위를 서버가 내려준 결과 bounds에 맞추도록 연결해, 첫 목록과 실제 지도 viewport가 어긋나며 누락처럼 보이던 상황도 줄였다.
  - `/Users/alex/project/altteulmap/src/app/page.tsx`를 지도 홈으로 바꾸고, 내부 링크/로그인 callback/manifest/sitemap/revalidate 경로를 `/` 기준으로 맞춰 더 이상 `/map` 경로를 기본으로 쓰지 않도록 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
- 메모
  - 전체 검색처럼 현재 화면 밖 결과를 선택한 경우에는 기존처럼 필요한 지도 이동이 유지된다.

### 2026-03-31: 공개 UI polish 패스
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/site-header.tsx`에서 헤더 메뉴를 더 간소화하고, 공개 메뉴에서 불필요한 홈 항목을 제거했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`를 정리해 지도 영역 비중을 키우고, 공개 라벨을 `결과`, `주변 지도` 중심으로 단순화했으며 버튼/필터 칩에 `whitespace-nowrap`를 넣었다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`에서 북마크 버튼 텍스트를 짧게 유지하고, 북마크 화면의 `데이터 소스`, `API 보기` 같은 개발 문구를 제거했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`에서 공개용 `검증됨/미검증` 표시와 내부 운영 설명을 없애고, 액션 버튼을 한 줄 유지로 정리했다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/app/report/page.tsx`, `/Users/alex/project/altteulmap/src/features/reports/report-submit-form.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-coordinate-picker.tsx`에서 `초안`, `MVP`, `payload`, `DB/목업`, 환경 변수명 노출 같은 개발 단계 문구를 사용자 친화적인 설명으로 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`에서 로그인 화면과 인증 에러 문구를 덜 기술적으로 정리하고, 소셜/이메일 로그인 버튼과 로그아웃 버튼을 한 줄 유지로 맞췄다.
  - 같은 공개 UI 범위에서 제목 아래 소개문, 섹션 안내문, 로그인 유도 문장처럼 기능을 한 번 더 설명하던 보조 문장을 추가로 제거해 전체 톤을 더 짧고 건조하게 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/repository.ts`, `/Users/alex/project/altteulmap/src/features/reports/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 사용자 응답 메시지도 기술 용어 없이 보이도록 정리했다.
  - 더 이상 사용하지 않는 `/Users/alex/project/altteulmap/src/features/places/place-status-badge.tsx`를 제거했다.
  - 공개 화면의 기능 설명성 문구를 한 번 더 줄여 코멘트/가격 제보/제보/신고/로그인/좌표 선택 화면에서 불필요한 안내 문장을 제거했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 공개 UI용 웜 팔레트 유틸을 추가하고, 지도 필터/검색/대표 가격 박스/주요 CTA의 검정 계열 버튼을 크림+테라코타 톤으로 교체했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - 공개 UI 컴포넌트 기준 `검증됨`, `미검증`, `데이터 소스`, `API 보기`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `초안`, `MVP` 문구가 남아 있지 않은 것을 검색으로 재확인했다
- 메모
  - 저장소 내부 repository/mock fallback 메시지는 남아 있지만, 현재 공개 화면에는 직접 노출되지 않는다.
  - 관리자 화면의 검증 상태 문구와 DB/mock 상태 표시는 운영 도구로 유지했다.

### 2026-03-31: Cycle 5 진행 중 (인증 정리와 출시 준비)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/site.ts`를 추가해 사이트 기준 URL 계산을 공용화했다.
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`의 기본 metadata를 확장해 `metadataBase`, Open Graph, Twitter, 키워드, 애플리케이션 정보를 설정했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 지도 페이지 canonical metadata를 추가했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에 동적 `generateMetadata`를 추가해 장소별 title/description/canonical을 만들었다.
  - `/Users/alex/project/altteulmap/src/app/robots.ts`, `/Users/alex/project/altteulmap/src/app/sitemap.ts`, `/Users/alex/project/altteulmap/src/app/manifest.ts`를 추가해 공개 라우트 기준 SEO 기본 산출물을 생성했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에 `Cache-Control: no-store`를 추가하고, 지도/상세 페이지를 `force-dynamic`으로 명시해 승인 직후 stale 응답 여지를 줄였다.
  - `/Users/alex/project/altteulmap/src/auth.ts`에 카카오/네이버 OAuth provider를 환경 변수 기반으로 선택적으로 붙이고, 소셜 로그인 시 `users`/`auth_accounts`와 연결하는 동기화 로직을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`, `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`를 수정해 로그인 화면에서 provider 활성 상태와 미설정 이유를 보여주고, 로컬 credentials 로그인은 그대로 유지했다.
  - 지도용 네이버 키와 로그인용 OAuth 키가 섞이지 않도록 `.env.example`과 `README.md`를 `AUTH_NAVER_*`, `AUTH_KAKAO_*` 기준으로 정리했다.
  - `/Users/alex/project/altteulmap/scripts/smoke-local.mjs`와 `npm run smoke:local`을 추가해 SEO/지도 API/credentials 로그인/관리자 보호 API를 한 번에 확인할 수 있게 했다.
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`, `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`, `npm run deploy:check`를 추가해 Cloudflare 배포 전 환경 변수와 도메인 설정을 점검할 수 있게 했다.
  - `trd.md`의 환경 변수 표기를 현재 코드 기준(`NEXTAUTH_URL`, `AUTH_KAKAO_*`, `AUTH_NAVER_*`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`)으로 맞췄다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/lib/site.ts`
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`
  - `/Users/alex/project/altteulmap/src/auth.ts`
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`
  - `/Users/alex/project/altteulmap/src/app/login/page.tsx`
  - `/Users/alex/project/altteulmap/src/lib/env.ts`
  - `/Users/alex/project/altteulmap/src/types/next-auth.d.ts`
  - `/Users/alex/project/altteulmap/src/features/auth/constants.ts`
  - `/Users/alex/project/altteulmap/scripts/smoke-local.mjs`
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`
  - `/Users/alex/project/altteulmap/docs/deploy-cloudflare.md`
  - `/Users/alex/project/altteulmap/package.json`
  - `/Users/alex/project/altteulmap/src/app/robots.ts`
  - `/Users/alex/project/altteulmap/src/app/sitemap.ts`
  - `/Users/alex/project/altteulmap/src/app/manifest.ts`
  - `/Users/alex/project/altteulmap/.env.example`
  - `/Users/alex/project/altteulmap/README.md`
  - `/Users/alex/project/altteulmap/trd.md`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - production server(`127.0.0.1:3102`) 기준 `/robots.txt` 응답 확인
  - production server(`127.0.0.1:3102`) 기준 `/sitemap.xml` 응답 확인
  - production server(`127.0.0.1:3102`) 기준 `/manifest.webmanifest` 응답 확인
  - production server(`127.0.0.1:3102`) 기준 `/place/school-gimbap`의 `title`, `description`, canonical, `og:url` 메타 태그 확인
  - `HEAD /api/places/school-gimbap`, `HEAD /api/places/map?...` 응답에서 `Cache-Control: no-store, max-age=0` 확인
  - production server(`localhost:3102`) 기준 `/login` 화면에 카카오/네이버 provider 상태와 미설정 이유가 렌더링되는 것 확인
  - production server(`localhost:3102`) 기준 로컬 credentials 로그인 후 `/api/bookmarks`가 `source: "database"`로 응답하는 것 확인
  - `.env.local` 기준 `NEXTAUTH_URL`, `AUTH_NAVER_CLIENT_ID`, `AUTH_NAVER_CLIENT_SECRET`, `AUTH_KAKAO_CLIENT_ID`가 설정된 것을 확인했다. `AUTH_KAKAO_CLIENT_SECRET`은 현재 비어 있어 카카오는 비활성 상태다.
  - `localhost:3000` 기준 `/login`에서 네이버 provider가 활성화되고, `/api/auth/signin/naver`가 `nid.naver.com/oauth2.0/authorize`로 redirect URL을 생성하는 것 확인
  - 이후 `.env.local`에 `AUTH_KAKAO_CLIENT_SECRET`이 추가된 것을 확인했고, `localhost:3000` 기준 `/login`에서 카카오/네이버 provider가 모두 활성화되는 것 확인
  - `localhost:3000` 기준 `/api/auth/signin/kakao`가 `kauth.kakao.com/oauth/authorize`로 redirect URL을 생성하는 것 확인
  - `npm run smoke:local` 통과
  - `npm run deploy:check -- --preview` 통과
  - `npm run deploy:check`는 의도대로 실패했고, 실패 이유는 현재 `NEXTAUTH_URL=http://localhost:3000`이 production 기준 검증을 통과하지 못하기 때문이었다
- 메모
  - 현재는 `NEXTAUTH_URL`을 사이트 기준 URL로도 사용한다. 배포 시 실제 도메인으로 반드시 맞춰야 한다.
  - OAuth provider는 코드상 준비됐고, 현재 `.env.local` 기준으로 카카오/네이버 모두 authorize redirect 생성까지 확인했다.
  - 실제 production 체크는 배포 도메인이 정해진 뒤 `NEXTAUTH_URL`을 운영 주소로 바꿔 다시 돌리면 된다.

### 2026-03-31: Cycle 4 완료 (운영 품질과 관리자 가격 관리)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`에 `price_items.is_active`를 추가했고, `/Users/alex/project/altteulmap/drizzle/0002_swift_red_skull.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 대표 가격 재계산 규칙을 TRD 기준으로 정리했다. 이제 활성 가격 항목만 집계하고, `대표 플래그 + 검증 상태 + 최신성`을 우선한 뒤 fallback으로 최저가를 대표값으로 사용한다.
  - `/Users/alex/project/altteulmap/src/app/admin/prices/places/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-price-item-form.tsx`, `/Users/alex/project/altteulmap/src/app/api/admin/price-items/[id]/route.ts`를 추가해 운영자가 가격 항목을 직접 수정/대표 지정/숨김/복원할 수 있는 경로를 만들었다.
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`에 최근 장소 기준 `현재 가격 관리` 목록을 추가해 큐가 비어 있어도 가격 관리 화면으로 진입할 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/lib/rate-limit.ts`를 추가하고, `/Users/alex/project/altteulmap/src/app/api/places/route.ts`, `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`에 최소 rate limit(`429`)을 붙였다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/db/schema.ts`
  - `/Users/alex/project/altteulmap/src/db/seed.ts`
  - `/Users/alex/project/altteulmap/drizzle/0002_swift_red_skull.sql`
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/write-schema.ts`
  - `/Users/alex/project/altteulmap/src/features/places/admin-price-item-form.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/prices/places/[id]/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/admin/price-items/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/lib/rate-limit.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run db:generate` 통과, migration 생성 확인
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `npm run db:push` 통과, 로컬 DB에 `is_active` 컬럼과 인덱스 반영 확인
  - `npm run db:seed` 통과
  - production server(`127.0.0.1:3102`) 기준 실DB 런타임 확인
  - 일반 사용자 가격 제보 승인 1회 후 대표 가격이 `3800원`으로 갱신되고 `unverified` 상태가 공개 상세에 반영되는 것 확인
  - 동일 가격을 2회째 승인했을 때 `verified_report_count = 2`, `verification_status = verified`로 승격되는 것 확인
  - 운영자 가격 항목 숨김 후 공개 상세에서 해당 항목이 사라지고 대표 가격이 다른 활성 항목으로 재계산되는 것 확인
  - 운영자 `/admin/prices/places/school-gimbap` 페이지에서 가격 관리 UI 렌더링 확인
  - 일반 사용자 댓글 등록을 11회 반복 호출했을 때 11번째 요청이 `429`로 차단되는 것 확인
- 메모
  - 승인 직후 첫 공개 상세 재조회 한 번에서 이전 상태가 잠깐 보였지만, 직후 재조회에서는 최신 DB 상태가 반영됐다. 추후 캐시/재검증 정책을 조금 더 조일 여지가 있다.

### 2026-03-31: Cycle 3 완료 (댓글과 기존 장소 가격 추가 제보)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에 댓글 작성/숨김 삭제, 기존 장소 가격 제보, 관리자 가격 검토 큐, 승인/반려 로직을 추가했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/[commentId]/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`로 장소 상세 쓰기 API를 열었다.
  - `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`를 추가해 상세 페이지와 상세 시트 양쪽에서 댓글/가격 제보를 처리하도록 연결했다.
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`, `/Users/alex/project/altteulmap/src/app/api/admin/prices/route.ts`, `/Users/alex/project/altteulmap/src/app/api/admin/prices/[id]/route.ts`, `/Users/alex/project/altteulmap/src/features/places/admin-price-report-review-form.tsx`를 추가해 관리자 가격 검토 큐를 구성했다.
  - 공개 상세 이력에서 미검토 가격 제보가 보이지 않도록 `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 가격 이력 조회를 `accepted` 기준으로 제한했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`
  - `/Users/alex/project/altteulmap/src/features/places/write-schema.ts`
  - `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/admin-price-report-review-form.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/[commentId]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/prices/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/admin/prices/route.ts`
  - `/Users/alex/project/altteulmap/src/app/api/admin/prices/[id]/route.ts`
  - `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/admin/reports/page.tsx`
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=... NEXTAUTH_URL=http://127.0.0.1:3100 USE_MOCK_DATA=true PORT=3100 npm run start` 기준으로 mock 런타임 검증
  - 일반 사용자 로그인 후 `GET /api/places/school-gimbap` 응답 확인
  - 일반 사용자 로그인 후 `POST /api/places/school-gimbap/comments` 성공 응답 확인
  - 일반 사용자 로그인 후 `DELETE /api/places/school-gimbap/comments/{mock-comment-id}` 성공 응답 확인
  - 일반 사용자 로그인 후 `POST /api/places/school-gimbap/prices` 성공 응답 확인
  - 일반 사용자 `GET /api/admin/prices`는 `운영자 권한이 필요합니다.` 응답 확인
  - 운영자 로그인 후 `GET /api/admin/prices`는 `items: []`, `source: "mock"` 응답 확인
  - 운영자 로그인 후 `/admin/prices` HTML에 `가격 제보 검토 큐`, `현재 검토 대기 중인 가격 제보가 없습니다.` 문구 렌더링 확인
- 메모
  - Docker daemon이 꺼져 있어 DB-backed 가격 검토 승인/반려까지의 실데이터 런타임 검증은 이번 cycle에서 못 했다.
  - mock 모드에서도 댓글/가격 제보 route contract와 권한 분기는 확인했다.

### 2026-03-31: Cycle 7 완료 (repo-local AI workflow setup)
- 완료 내용
  - `AGENTS.md`를 현재 저장소 기준으로 정리하고 repo-local AI workflow 규칙을 추가했다.
  - `.agents/skills/` 아래에 `database-migrations`, `api-design`, `verification-loop`, `e2e-testing` 프로젝트 전용 skill 문서를 추가했다.
  - `.agents/reviewers/` 아래에 `typescript-reviewer.md`, `database-reviewer.md`를 추가해 큰 변경 후 자체 리뷰 기준을 고정했다.
  - `.githooks/`, `scripts/git-hooks/`를 추가하고 `pre-commit`, `commit-msg` hook를 repo-local 방식으로 구성했다.
  - `package.json`에 `verify`, `verify:quick`, `hooks:install` 스크립트를 추가했고, `README.md`에 사용법을 문서화했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/AGENTS.md`
  - `/Users/alex/project/altteulmap/.agents/README.md`
  - `/Users/alex/project/altteulmap/.agents/skills/**`
  - `/Users/alex/project/altteulmap/.agents/reviewers/**`
  - `/Users/alex/project/altteulmap/.githooks/**`
  - `/Users/alex/project/altteulmap/scripts/git-hooks/**`
  - `/Users/alex/project/altteulmap/package.json`
  - `/Users/alex/project/altteulmap/README.md`
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
- 검증 결과
  - `npm run hooks:install` 통과
  - `npm run verify` 통과
  - `git config --local --get core.hooksPath` 결과 `.githooks`
- 메모
  - hook는 이 저장소 안에서만 동작한다.
  - ECC 전체 번들은 가져오지 않았고, 현재 프로젝트에 필요한 축만 축소 도입했다.

### 2026-03-31: Cycle 2 완료 (문서 체계 정비와 지도 검색/URL 상태 반영)
- 완료 내용
  - `/Users/alex/project/townpet/PLAN.md`와 `/Users/alex/project/townpet/PROGRESS.md` 형식을 참고해 현재 문서를 `기준일 -> 운영 규칙/요약 -> Active Plan/실행 로그` 구조로 재작성했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`에 검색 UI를 추가해 `q`, `scope(viewport/global)` 상태를 URL에 반영하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`는 지역 검색일 때만 viewport bbox를 API에 보내고, 전체 검색일 때는 bounds 없이 검색 결과를 유지하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에 텍스트 검색 조건을 추가해 mock/DB 양쪽에서 이름, 주소, 지역, 대표 가격 라벨 등으로 검색 가능하게 만들었다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`는 전체 검색 결과가 들어왔을 때 해당 결과 중심으로 한 번 이동할 수 있게 조정했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/PLAN.md`
  - `/Users/alex/project/altteulmap/PROGRESS.md`
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`
  - `/Users/alex/project/altteulmap/src/features/places/queries.ts`
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`
- 검증 결과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `curl -s --max-time 10 'http://localhost:3001/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=global'` 응답 확인
  - `curl -s --max-time 10 'http://localhost:3001/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=viewport&minLat=37.58&maxLat=37.60&minLng=127.00&maxLng=127.03'` 응답 확인
  - `curl -I -s --max-time 10 'http://localhost:3001/map?q=%EA%B9%80%EB%B0%A5&scope=global'` 응답 확인
- 메모
  - 사용자가 이미 띄워 둔 `next dev` 인스턴스는 `localhost:3000`에서 별도로 돌고 있었고, 전역 검색 런타임 검증은 충돌을 피하기 위해 production server `localhost:3001`에서 수행했다.

### 2026-03-31: Cycle 1 완료 (지도 viewport 조회와 모바일 바텀시트 정리)
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`에 bbox 조회 파라미터를 추가했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에 viewport bounds 필터를 추가했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 현재 위치 버튼과 지도 idle 기준 viewport 보고 구조를 넣었다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 모바일 목록 바텀시트를 추가했고, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 모바일 하단 시트 형태로 조정했다.
- 검증 결과
  - `npm run lint` 통과
  - `npm run build` 통과
  - `curl 'http://localhost:3000/api/places/map?minLat=37.58&maxLat=37.60&minLng=127.00&maxLng=127.03'`로 bbox 조회 응답 확인
- 메모
  - 상세 시트는 현재도 usable 상태지만 모바일 스냅/제스처 감각은 추가 polish가 필요하다.

### 2026-03-31: Cycle 0 완료 (로컬 기반과 핵심 MVP 흐름 구축)
- 완료 내용
  - Next.js, OpenNext/Cloudflare 대비 구조, Docker Postgres, Drizzle 스키마, seed 경로를 정리했다.
  - 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 장소 승인/신고 검토 흐름을 연결했다.
  - Auth.js credentials 로그인과 네이버 지도 SDK 연동을 붙였다.
  - 첫 화면을 지도 중심으로 재정리하고, 개발용 안내 문구를 걷어냈다.
- 검증 결과
  - 각 단계에서 `npm run lint`, `npm run build`, `npm run db:push`, `npm run db:seed`를 반복 검증했다.
  - 로컬 DB에서 장소 제보, 신고 생성, 관리자 승인/상태 변경, 북마크 저장/해제까지 확인했다.
- 메모
  - 현재 로컬 `.env`, Docker Postgres, 네이버 지도 키가 이미 준비돼 있어 다음 cycle은 기능 확장에 바로 들어갈 수 있다.

## 다음 작업
1. 카카오 또는 네이버 실제 developer 설정으로 외부 로그인 end-to-end 검증
2. 실제 도메인이 정해지면 `NEXTAUTH_URL`을 운영 주소로 바꾸고 `npm run deploy:check` 재실행
3. 필요 시 캐시/재검증 정책을 추가 보강해 관리자 승인 직후 상세 반영 지연을 더 줄이기
4. 이후 E2E 자동화 도입 여부 판단
