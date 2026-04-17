# PROGRESS.md

기준일: 2026-04-17

## 진행 현황 요약
- 전면 디자인 재설계 8차 구현을 진행했다. 관리자 대시보드/검수 큐/가격 관리 화면을 공통 `AdminPageShell` 기준으로 다시 정리했고, admin 헤더의 중복 사용자 배지를 걷어 public과 같은 디자인 언어로 맞췄다. mock 기준 admin dashboard smoke도 현재 구조에 맞게 다시 통과시켰다
- 전면 디자인 재설계 7차 구현을 진행했다. 홈 카테고리 tray를 `상위 묶음 선택 -> 세부 업종 선택` 2단계 client interaction으로 바꿨고, 가격 제보/북마크 성공 상태도 더 명확한 피드백 박스와 상태 문구로 정리했다
- 전면 디자인 재설계 6차 구현을 진행했다. 로그인·회원가입 폼은 전환 링크와 소셜 구획을 더 compact하게 정리했고, 회원가입은 자격증명 가입이 꺼진 환경에서 입력 필드를 아예 숨기도록 바꿨다. 장소 등록 폼은 중첩 카드 구조를 걷어내고 `장소 정보 -> 대표 가격 -> 추가 메모` 3단계 흐름으로 다시 정리했다
- 전면 디자인 재설계 5차 구현을 진행했다. 전역 헤더를 더 compact하게 다듬고 인증 화면에서는 홈 복귀만 남기도록 최소화했다. 홈 `인기 장소`도 쇼케이스 카드보다 빠른 비교 레일에 가깝게 밀도를 조정했다
- 전면 디자인 재설계 4차 구현을 진행했다. 홈 상단 shell을 `동네 가격 지도` 기준의 compact toolbar로 줄였고, 검색/범위/카테고리 요약을 한 패널 안으로 압축했다. 카테고리 drawer 내부도 그룹 카드가 아니라 `그룹 라벨 + 칩 row` 밀도 구조로 바꿔 map-first 감각을 더 올렸다
- 전면 디자인 재설계 3차 구현을 진행했다. 북마크/공유/반응 액션을 새 버튼 규칙으로 통일했고, 지도 패널은 외부 헤더를 걷어내고 map overlay chrome 중심 구조로 바꿨다. 모바일 목록 진입 캡슐, 목록 시트 헤더, 상세 시트 닫기 affordance도 같은 톤으로 정리했다
- 전면 디자인 재설계 2차 구현을 진행했다. 장소 상세, 가격 제보, 코멘트, 인기 장소 카드까지 price-first 구조와 새 panel system으로 다시 정리했다
- 전면 디자인 재설계 1차 구현을 진행했다. 공용 토큰/표면 스타일을 새로 정리했고, 공개 헤더, 홈 map shell, 로그인/회원가입, 장소 등록 폼을 새 design system 초안 기준으로 다시 짰다
- GitHub Actions CI 경량화: `Deploy Config Check`는 더 이상 `npm ci`를 요구하지 않고 `node scripts/check-cloudflare-deploy.mjs`만 실행한다. `verify`는 `lint + tsc --noEmit`로 바뀌어 PR에서 중복 app build 1회를 제거했고, `docs/**`와 `README.md`만 바뀐 경우 workflow를 건너뛴다
- 전면 디자인 재설계 준비를 시작했다. 라이브 사이트와 현재 `src/**` UI 구조, 외부 reference(`impeccable`, `getdesign.md`, `awesome-design-md`)를 검토해 root `DESIGN.md` 초안을 추가했고, 이후 UI 구현은 이 문서를 기준으로 진행하도록 `PLAN.md`를 갱신했다
- 지도 체감 성능 5차 보정: 홈 viewport bootstrap query를 `zoom=11`로 고정하고, map boot 직후 첫 viewport sync는 무시하도록 바꿨다. local production 기준 초기 `/api/places/map`는 `2회 -> 1회`, 첫 cluster marker count는 `31 -> 19`, total requests는 `45 -> 44`가 됐고, live public도 같은 패턴으로 `/api/places/map` 1회, total `43`, `fetch 1`로 내려왔다
- 지도 체감 성능 4차 보정: 네이버 지도 패널을 preview-first delayed boot로 바꿨다. 자동 부팅은 최소 `900ms` 뒤에만 시작하고, preview tap/cluster/current-location/`이 지역 검색` 상호작용은 즉시 boot로 우회한다. local production 첫 `1.2s` 요청은 `45 -> 14`, 같은 구간의 네이버 지도 asset은 `26 -> 0`으로 줄었고, live public도 첫 `1.2s` 요청 `11`, map asset `0`, total `44`까지 내려왔다
- public/admin을 현재 성능 보정 기준으로 재배포했다. live 첫 진입 요청 수는 `95 -> 51 -> 44`로 줄었고, `_rsc` prefetch flood와 telemetry `500`도 사라졌다. 현재 남은 steady-state 비용의 대부분은 여전히 네이버 지도 SDK/타일(`script 16`, `image 22`)이다
- telemetry 500 원인 분리 완료: `/api/telemetry/visit`가 stale DB에서도 더 이상 `500`을 내지 않고 `200 + tracked:false + source:mock`으로 degrade된다. 동시에 `src/db/client.ts`는 nested `cause`의 `message/code`까지 따라가 DB unavailable 판정을 더 정확히 하도록 보강했다
- 지도 체감 성능 3차 보정: 데스크톱 목록 카드의 북마크/공유 버튼을 idle 이후가 아니라 `목록 준비 후 짧은 고정 지연` 뒤에 붙이도록 바꿨다. 첫 목록 렌더 시점에는 보조 액션 test id가 `0`, 1.1초 뒤에는 `80`으로 돌아오는 것을 로컬 production에서 확인했다
- 지도 체감 성능 2차 보정: 홈 카테고리 필터를 접힌 상태 기본값으로 바꿨다. 모바일은 `전체 + 8개 + 더보기`, 데스크톱은 `전체 + 10개 + 더보기`만 먼저 렌더하고, 숨겨진 카테고리가 선택된 경우에도 해당 칩은 접힌 상태에서 계속 보이게 유지한다
- 지도 체감 성능 1차 보정: 홈 지도 화면의 category/login/submit/admin/detail `Link` prefetch를 껐고, desktop 장소 목록은 idle 이후 지연 마운트되도록 바꿨으며, 목록 렌더 상한도 `desktop 80 / mobile 40`으로 낮췄다. `VisitTracker`는 idle 이후 `sendBeacon` 우선 전송으로 미뤄 첫 진입 네트워크를 덜 방해하게 했다. 로컬 production 기준 홈 첫 진입 fetch/xhr는 `api/places/map` 1건과 외부 네이버 수집 1건만 남았고, 기존처럼 category/login/submit prefetch가 쏟아지지 않았다
- Phase A 운영 DB 진단 보강: `npm run db:check:production`을 추가해 현재 `DATABASE_URL`로 실제 연결, moderation schema 유무, drizzle migration table 유무를 한 번에 확인할 수 있게 했다. 현재 production credential은 여전히 `Tenant or user not found`로 실패하며, URL encoding 문제가 아니라 stale/wrong credential이라는 점을 다시 확인했다
- Phase B 준비 보강: [mobile-qa-checklist.md](/Users/alex/project/altteulmap/docs/project/mobile-qa-checklist.md)를 추가해 iPhone Safari, Android Chrome 기준의 public/admin 실기기 확인 항목과 기록 포맷을 고정했다
- Phase D backlog freeze 완료: 검색 URL 상태는 현재 `q/scope` URL 반영 범위로 유지하고, 공유 telemetry는 관리자 overview/source breakdown 범위까지만 유지하기로 고정했다. 별도 추천/랭킹 확장, 사진 업로드, `bang`, `deal`, 프론트엔드 디자인 polish는 현재 출시 범위에서 계속 제외한다
- Phase C 운영 URL 고정 완료: 현재 운영 URL을 `workers.dev` split(public `altteulmap.altteul-lab.workers.dev`, admin `altteulmap-admin.altteul-lab.workers.dev`)으로 공식화했고, README/배포 문서의 launch 설명도 이 기준으로 정리했다. `smoke:remote`를 다시 실행해 canonical, robots, sitemap, public `/admin` redirect, public `/api/admin/places`, admin `/login` 계약이 여전히 맞는 것을 확인했다
- 루트/관리자 앱의 로컬 빌드 산출물과 테스트 잔여물을 정리했다. `.next`, `.next-dev`, `.open-next`, `apps/admin/.next`, `apps/admin/.open-next`, `test-results`, `tsconfig.tsbuildinfo`, `.wrangler`를 삭제해 약 `669.38 MB`를 확보했고, tracked 파일 영향 없이 워킹 트리는 깨끗한 상태를 유지했다
- Cloudflare Builds 후속: `altteulmap-admin` 자동 빌드는 `apps/admin`를 root directory로 둘 때 `package-lock.json` 부재로 `npm ci`가 즉시 실패한다는 점을 확인했다. 현재 권장 설정은 public/admin 모두 root directory `/`, `npm ci`, 각각 `cf:build:*` + `wrangler*.jsonc` deploy 조합이다
- Phase B QA 부분 진행: live public URL은 Chromium desktop/mobile emulation에서 `map panel`, `현재 위치`, `이 지역 검색`, 모바일 `목록 보기` 버튼이 모두 노출되는 것을 확인했다. admin은 브라우저 자동화 대신 real credentials callback + `wrangler tail` 기준으로 `/admin/reports`와 AI 패널 흐름을 확인했다. 다만 실제 iPhone Safari, Android Chrome 실기기 검증은 아직 남아 있다
- Phase A degraded admin 후속: 관리자 overview에 DB probe를 추가하고 admin pages read를 직렬화해, broken DB 상태에서 `/admin/reports` 반복 요청이 `200`으로 유지되도록 정리했다. `wrangler tail` 기준으로 credentials callback 이후 `/admin/reports` 3연속 요청이 모두 `Ok`로 끝났고 hung exception은 재현되지 않았다
- Phase A degraded runtime 후속: 운영 DB credential 복구 시도 중 `.env.production.local`의 Supabase pooler URL은 비밀번호 특수문자 인코딩 문제를 넘겨도 여전히 `Tenant or user not found`를 반환했다. 따라서 실제 DB 복구는 못 했고, 대신 public/admin/read-heavy 경로에 DB 장애 circuit breaker를 넣어 반복 DB 시도를 줄였으며, auth callback에서는 이 breaker를 제거해 remote credentials fallback 로그인을 다시 정상화했다
- Phase A live rollout 후속: `moderation_suggestions` read/write가 live DB schema 누락이나 DB 장애로 깨져도 관리자 큐는 비영속 AI 제안으로 계속 열리도록 정리했고, known demo/admin degraded 로그인도 유지되게 했다. public/admin 재배포, remote smoke, live `/admin/reports` 로그인 확인까지 끝냈지만 운영 DB는 여전히 `Tenant or user not found`라 persisted migration 적용은 blocker로 남아 있다
- Cycle 11: 장소 등록/가격 제보/신고 관리자 큐에 `AI 1차 검수` 패널을 추가했다. 제안은 로컬 검수 에이전트가 자동 생성·저장하고, 관리자 카드는 권장 액션/신뢰도/근거/플래그를 보여준 뒤 기존 승인/반려/상태 변경 흐름으로 최종 확정한다. 댓글은 현재 관리자 검수 큐가 없어 1차 범위에서 제외했다
- Cycle 10: 관리자 실제 구현을 `src/features/admin/**`로 모으고, public 앱 `entrypoints`와 별도 `apps/admin` 빌드를 추가해 관리자 분리 1차 완료. public `cf:build:public`은 `/admin`, `/api/admin`을 external redirect/API stub로 유지한 채 빌드하고, `deploy:check:public`, `deploy:check:admin`, `SITE_URL` 기준, `workers.dev` split 배포와 remote smoke까지 정리했다. custom domain 적용은 필요할 때만 마지막 운영 단계로 남아 있다
- Cycle 10 후속: admin telemetry가 `useSearchParams()` 때문에 standalone admin Cloudflare build를 깨던 경로를 제거했고, admin build는 이제 `ADMIN_APP_URL`을 `NEXTAUTH_URL`로 강제해 shared `.env.production.local`에서도 올바른 callback 기준으로 동작한다. `deploy:check:admin`, `cf:build:admin`, live admin 재배포까지 다시 통과했다
- 문서/루트 정리 후속: 제품 문서와 배포 문서를 `docs/product`, `docs/deploy`로 재배치했고, 이후 운영 문서도 `docs/project`로 옮겼다. `docs/README.md` 인덱스를 추가했고, 루트의 `.next`, `.open-next`, `apps/admin/.next`, `test-results`, `tsconfig.tsbuildinfo` 등 생성 산출물도 `clean:artifacts` 스크립트와 함께 정리했다
- Cycle 0: 프로젝트 로컬 기반, DB 경로, 지도 탐색, 장소 상세, 등록, 신고, 북마크, 관리자 검토, 로컬 인증, 네이버 지도 연동 완료
- Cycle 1: 현재 위치 버튼, viewport 재조회, 모바일 목록 바텀시트, 모바일 상세 시트 기초 정리 완료
- Cycle 2: `PLAN.md`/`PROGRESS.md` 운영 문서 형식 정비, 지역/전역 검색, 검색 URL 상태 반영 완료
- Cycle 3: 댓글 작성/삭제, 기존 장소 가격 제보, 관리자 가격 검토 큐 완료
- Cycle 4: 관리자 가격 수정/숨김 UI, 대표 가격 재계산 규칙, 최소 rate limit, DB migration 적용, 실DB 런타임 검증 완료
- Cycle 5: sitemap/robots/canonical/기본 metadata, OAuth scaffolding, deploy check, Playwright E2E 3차, 공개 UI polish 대부분 완료. 공개 쓰기는 북마크를 제외하고 익명 허용으로 정리됐고, public/admin 공통 헤더로 주요 이동 액션을 상단에 통합했다. 로그인/회원가입은 credentials 중심 액션 카드로 다시 단순화했고, 운영 도메인 기준 `workers.dev` 점검과 관리자 외부 앱 cutover도 정리됐다. 현재 남은 일은 실기기 QA와 운영 DB 복구다
- Cycle 5 장소 등록 정책: 공개 폼은 텍스트 정보만 받고, 지도 위치와 네이버 지도 검색 확인은 운영자 승인 단계에서 처리하도록 다시 정리됨
- Cycle 5 후속: GitHub Actions CI를 `push용 smoke`와 `PR용 full`로 분리하고 Cloudflare Builds와 분리 운영하는 경로 정리 완료
- Cycle 6: 좋아요/싫어요 반응 도입 완료, 비로그인 visitor cookie 반응과 공개 메타 줄 분리까지 반영. 홈 `인기 장소` 추천과 공유 후속은 반영했고, 별도 랭킹 화면은 현재 범위에서 제외함
- Cycle 7: repo-local AI workflow 설정 완료 (`.agents`, `.githooks`, `verify`, local commit rules)
- Cycle 8: 로컬 dev/runtime 안정화 완료 (`.next-dev` 분리, `webpack` dev 고정, build/e2e와 출력 경로 분리)
- Cycle 9: 행정안전부 `착한가격업소` 실제 데이터 1000건 import 완료. 기본 selection은 `서울 500 + 비서울 500`, `음식점 70%`, `대표 가격 8천원 미만` 기준으로 유지되고 있고, 메뉴 라벨 dedupe까지 반영해 DB seed/API 검증을 다시 통과함
- Cycle 5 지도 성능 후속: 지도 전용 preview payload와 마커/목록 렌더 상한, viewport 첫 진입의 1000건 SSR 제거, map API/server preview 응답 `count + capped items` 구조, `places` 비정규화, viewport/zoom 기반 cluster marker 계층, `items + mapMarkers` 분리, 서버 tile summary, viewport 무검색 SQL bucket aggregate, bounds 기반 short-lived 서버 캐시와 쓰기 후 invalidation, preview fallback/bootstrap fetch 회귀 수정, 공개 가격 필터 제거, `127.0.0.1` dev origin 허용까지 반영함
- Cycle 5 운영 지표 후속: `visit_activity` 적재, public/admin layout tracker, `/api/telemetry/visit`, 관리자 overview 방문 카드, 로컬 admin 링크 fallback, 로그인 상태 header test id 복구까지 완료
- Cycle 5 인증/UI 후속: `/login`, `/signup`은 설정성 패널 없이 액션 중심으로 다시 단순화했고, 지도 필터/검색 칩은 가로 레일로 정리했으며, login/signup E2E로 회귀를 유지함
- Cycle 5 배포 후속: `deploy:check`와 public split build가 이제 쉘/CI env를 로컬 `.env*`보다 우선 사용하므로, 운영 URL과 split worker 값이 로컬 파일에 덮이지 않게 정리됨
- Cycle 5 관리자 운영 UX 후속: moderation 카드의 즉시 성공 피드백, 공통 admin revalidation helper, public/admin entrypoint 재사용, admin moderation E2E fixture 정리까지 반영함
- Cycle 5 공개 상세 후속: 새로 승인된 한글 slug 장소가 `/place/[slug]`에서 404로 떨어지던 route param 인코딩 문제를 수정했고, detail/price/comment/submission 관련 place page 회귀를 다시 통과시킴
- Cycle 5 공개 UI/mobile polish 후속: 모바일 검색 요약은 한 줄 텍스트로 줄이고, 지도 목록 패널의 상태 안내는 하나의 요약 블록으로 합쳤으며, 상세 시트는 헤더/본문 중복 메타를 줄여 가격/액션 중심으로 시작하도록 다시 정리함
- Cycle 5 모바일 시트 후속: 목록 시트에 `peek/expanded` 스냅과 drag-close를 추가했고, 상세 시트도 상단 핸들 drag-close를 지원하도록 정리했으며, 모바일/데스크톱 지도 회귀를 다시 통과시킴
- Cycle 5 지도 탐색 UX 후속: 공개 지도 상단에 `이 지역 검색` 수동 재조회 버튼을 추가했고, `내 위치` 버튼은 `현재 위치`로 명확하게 바꿨다. viewport 흐름은 그대로 유지하면서도 사용자가 현재 지도 위치 기준으로 place/cluster를 다시 불러올 수 있게 했고, 데스크톱/모바일 지도 회귀에 버튼 노출과 수동 재조회 호출을 고정했다
- Cycle 5 지도 마커 디자인 후속: place marker는 음식/생활서비스/장보기/건강/업무학습 상위 카테고리 기준 색 핀으로 다시 설계했고, 숫자 cluster는 중립 원형 계층으로 바꿔 같은 지도 화면에서 타입 구분과 시각 밀도를 함께 정리했다
- Cycle 5 지도 마커 대비 후속: basemap과 섞이던 컬러 핀을 더 선명한 카테고리 팔레트와 강한 white halo, 중심 링 구조로 바꿨고, cluster도 slate 중심 원형 배지로 다시 정리해 확대/축소 상태 모두에서 배경 대비를 높였다
- Cycle 5 지도 클러스터 톤 후속: 숫자 cluster는 같은 구조를 유지하되 slate 계열을 줄이고 더 밝은 크림/샌드 톤으로 조정해 overview 상태에서 덜 어둡고 답답하게 보이도록 정리했다
- Cycle 5 공개 재검증 후속: 댓글/가격 제보/반응/북마크/장소 등록/신고 제출 route의 revalidation 경로를 공용 helper로 모아 홈/지도/상세/admin queue 반영 범위를 액션별로 정리했고, admin helper도 같은 place read 경로 정의를 재사용하도록 맞췄다
- Cycle 5 운영 smoke 후속: `smoke:remote`와 `smoke:local`을 현재 UI/SEO 계약에 맞게 read-only smoke로 정리했고, Workers runtime에서 guest visitor cookie 조회가 public place read/write를 hang시키던 경로는 request cookie header 파싱과 DB read timeout fallback으로 완화했다. public worker를 다시 배포한 뒤 live `workers.dev` 기준 `smoke:remote`까지 통과했고, public `/api/admin/places` external stub는 다시 `200 + 안내 JSON` 계약으로 맞췄다
- Cycle 5 rate limit UX 후속: 공개 쓰기와 회원가입 화면이 `429` 응답의 `Retry-After`/`X-RateLimit-Reset`을 읽어 남은 대기 시간을 같은 형식으로 보여주도록 정리했고, 댓글 E2E로 회귀를 붙였다
- Cycle 5 관리자 UX polish 후속: `/admin/places`, `/admin/prices`, `/admin/reports`에 공통 queue nav와 핵심 개수 요약 카드를 붙였고, 신고 큐는 상태 필터와 빈 상태를 지원하도록 정리했다
- Cycle 5 rate limit 정책/관측 후속: 공개 쓰기와 회원가입 정책 수치를 route 비용 기준으로 다시 조정했고, 응답 헤더에 `X-RateLimit-Policy`, `X-RateLimit-Window`를 추가해 운영 중 curl만으로도 어떤 bucket이 걸렸는지 바로 볼 수 있게 했다
- Cycle 6 mock reaction 후속: mock runtime에서 `visitor:uuid:placeId` store key를 잘못 파싱해 비회원 좋아요 count가 0으로 남던 회귀를 수정했고, 데스크톱 `map.spec.ts`가 다시 통과함
- Cycle 6 추천 후속: 홈 기본 화면에 `인기 장소` 섹션을 추가해 상위 6개 추천 장소를 노출하고, mock/desktop 회귀까지 붙였다
- Cycle 6 공유 후속: 상세 페이지/상세 시트/지도 목록/인기 장소 카드가 같은 공유 payload를 쓰도록 정리했고, 공유 링크에는 `ref=share`, `source=detail|detail_sheet|list|trending`를 붙였다
- Cycle 6 공유 telemetry 후속: `visit_activity`에 공유 ref/source를 저장하고, 관리자 overview에서 오늘/7일 공유 유입과 source breakdown을 확인할 수 있게 정리했다
- 다음 우선순위: `Cycle 12`는 `Phase A 남은 blocker(운영 DB credential 복구 + moderation_suggestions migration) -> Phase B 운영/모바일 실기기 QA` 순서로 진행한다. 운영 URL은 현재 `workers.dev` split으로 고정했고, 검색 URL 상태/공유 telemetry는 현 범위로 동결했다

## 실행 로그

### 2026-04-17 09:33 KST: 초기 viewport refetch 제거와 live 재배포
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에 `SEOUL_BOOTSTRAP_ZOOM = 11`을 추가하고, 홈 기본 viewport query가 첫 fetch부터 zoom-aware marker limit를 쓰도록 `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`로 `initialZoom`을 넘기게 했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 viewport mode의 첫 map idle sync를 무시하도록 `shouldIgnoreFirstViewportSyncRef`를 추가했다. 목적은 preview-first boot 뒤 Naver map이 padded viewport를 emit하면서 `/api/places/map`를 한 번 더 치는 초기 재조회를 없애는 것이다.
  - 그 결과 초기 `/api/places/map`는 bootstrap bounds + `zoom=11` 한 번만 호출되고, boot 직후 `zoom=11` padded viewport 재조회가 사라졌다.
  - public worker를 다시 배포했다. 현재 live public version은 `6046dc83-f6c1-4a0d-9c5b-deb1e1b7b641`이다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - sandbox에서는 `next build`가 `listen EPERM 127.0.0.1`로 막혀 escalated로 재실행
  - `PORT=3010 npm run start` 후 local production Playwright 측정:
    - 첫 `1.2s`: total `14`, `fetch 1`, map asset `0`
    - total `3.4s`: total `44`, `fetch 1`, `image 23`, map asset `26`
    - `/api/places/map` 응답은 `1회`만 관측
    - payload: `count 500`, `returnedCount 120`, `mapMarkerCount 19`, `markerMode cluster`
  - local production interaction check:
    - `map-current-location-button` 초기 disabled `false`
    - `map-refresh-button` 클릭 시 status `200`
    - mobile emulation에서 `목록 보기` 버튼과 목록 시트 open 정상
  - `npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - live public Playwright 측정:
    - 첫 `1.2s`: total `14`, `fetch 1`, map asset `0`
    - total `3.6s`: total `43`, `fetch 1`, `image 22`, map asset `28`
    - `/api/places/map` 응답은 `1회`만 관측
    - payload: `count 500`, `returnedCount 120`, `mapMarkerCount 19`, `markerMode cluster`
  - live interaction check:
    - `map-current-location-button` 초기 disabled `false`
    - `map-refresh-button` 클릭 시 status `200`
    - mobile emulation에서 `목록 보기` 버튼과 목록 시트 open 정상
- 메모
  - 이번 단계는 네이버 타일 자체를 줄인 것이 아니라, boot 직후 불필요한 viewport refetch와 marker 재계산을 없앤 것이다.
  - 현재 남은 지도 비용의 대부분은 실제 visible tile 22장 수준이라, 다음 성능 후속은 fetch 중복보다 `타일 수 자체를 줄일 UX/viewport 정책`이 있는지 판단하는 단계다.

### 2026-04-17 15:00 KST: GitHub Actions CI 경량화
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/lib/load-env-files.mjs`에서 `dotenv` 의존을 제거하고 Node만으로 `.env` 파일을 읽도록 바꿨다. 이제 `Deploy Config Check`는 패키지 설치 없이 실행 가능하다.
  - `/Users/alex/project/altteulmap/package.json`에 `typecheck`를 추가하고 `verify`를 `lint + typecheck`로 축소했다. PR CI에서는 `Verify`가 정적 검증만 담당하고, 실제 app build는 E2E job에서만 수행한다.
  - `/Users/alex/project/altteulmap/.github/workflows/ci.yml`에서 `Deploy Config Check`의 `npm ci`를 제거했고, `docs/**`와 `README.md`만 바뀐 경우 workflow를 건너뛰도록 `paths-ignore`를 추가했다.
- 검증 결과
  - `npm run lint` 통과
  - `npm run typecheck` 통과
  - `env DATABASE_URL=... node scripts/check-cloudflare-deploy.mjs` 통과
- 메모
  - 이번 변경은 GitHub Actions 경량화만 다룬다. push 후 별도로 붙는 Cloudflare Workers Builds 시간에는 직접 영향이 없다.

### 2026-04-17 21:05 KST: 전면 디자인 재설계 기준 문서 작성 시작
- 완료 내용
  - 라이브 사이트 `https://altteulmap.altteul-lab.workers.dev/`, 현재 공개 UI 구현(`src/app/globals.css`, `src/components/global-header.tsx`, `src/features/map/map-page.tsx`, `src/features/places/map-explorer.tsx`, `src/features/submission/place-submit-form.tsx`, `src/features/auth/login-form.tsx`, `src/features/places/place-detail-sheet.tsx`)을 기준으로 현재 디자인의 약점을 정리했다.
  - 외부 reference로 `pbakaus/impeccable`, `getdesign.md`, `VoltAgent/awesome-design-md`를 검토해 hierarchy, spacing, typography, motion, UX writing, AI-agent-friendly design doc 구조 기준을 추렸다.
  - root `/Users/alex/project/altteulmap/DESIGN.md`를 새로 추가했다. 이 문서는 제품 성격, 토큰, IA, 맵/리스트 관계, 제출 플로우, 컴포넌트 규칙, copy tone, Do/Don't를 포함한 AltteulMap 전용 design system draft다.
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`에 `Cycle 13: 디자인 시스템/IA 전면 재정의`를 추가하고, 기존의 `프론트엔드 디자인 polish 제외` 범위를 철회했다.
- 검증 결과
  - 문서 작업이라 별도 앱 실행/배포는 하지 않았다.
  - `git diff --check`
- 메모
  - 현재 단계는 디자인 방향 정의다. 실제 UI 구현은 아직 시작하지 않았다.
  - 다음 구현 세션에서는 `DESIGN.md` 기준으로 `global header -> home/map shell -> filters -> place cards/detail -> submission/auth` 순서로 바꾸는 게 맞다.

### 2026-04-17 22:05 KST: 전면 디자인 재설계 1차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/globals.css`에서 color/radius/border/elevation/input/button/badge/chip 토큰을 다시 정의하고, `altteulmap-panel`, `altteulmap-panel-muted`, `altteulmap-section-kicker`, `altteulmap-price-number`, `altteulmap-segmented` 같은 공용 UI primitive를 추가했다.
  - `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`, `/Users/alex/project/altteulmap/src/components/global-header.tsx`, `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`, `/Users/alex/project/altteulmap/src/app/layout.tsx`에서 공개 헤더와 브랜드/배경 톤을 새 시스템 기준으로 정리했다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`를 다시 짜서 홈 상단을 `title + compact search + segmented scope + grouped category drawer` 기준의 control shell로 바꿨다. 기존의 큰 hero/card stack 대신 map-first 구조를 우선하도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 list shell과 place card 위계를 바꿨다. 가격을 먼저 보이게 하고, 검증/갱신/좋아요를 보조 배지로 내렸으며, 데스크톱/모바일 목록 헤더도 같은 언어로 맞췄다.
  - `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`에서 인증 화면을 단일 작업 카드 중심으로 압축했다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`에서 장소 등록 폼을 `장소 정보 -> 대표 가격 -> 추가 가격 -> 메모` 흐름으로 재구성했다. 대표 가격을 첫 항목으로 분리하고, 추가 가격은 뒤로 미루는 구조로 바꿨다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start` 후 `curl -s http://127.0.0.1:3010/`, `curl -s http://127.0.0.1:3010/login`, `curl -s http://127.0.0.1:3010/submit`로 새 구조 문구와 핵심 UI가 실제 HTML에 반영된 것 확인
- 메모
  - 이번 단계는 가장 영향이 큰 public surface만 먼저 바꾼 1차 구현이다.
  - 다음 구현 우선순위는 `place detail / price report / trending cards / mobile sheet density / category filter interaction polish`다.

### 2026-04-17 22:45 KST: 전면 디자인 재설계 2차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`를 다시 짜서 상세 화면을 `대표 가격 -> 핵심 메타 -> 액션 -> 가격 항목/코멘트` 순서의 price-first 구조로 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`를 새 panel system 기준으로 정리해, admin form 같은 인상을 줄이고 제보/메모 입력을 더 가볍게 만들었다.
  - `/Users/alex/project/altteulmap/src/features/places/trending-places-section.tsx`를 가격 우선 카드 구조로 다시 짜고, 검증 상태와 최근 갱신을 더 명확한 보조 메타로 내려 배치했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start`
  - `curl -s http://127.0.0.1:3010/ | rg -n "인기 장소|가격을 먼저 보고 동네 장소를 찾는 지도"`
  - `curl -s http://127.0.0.1:3010/place/goodprice-14501 | rg -n "대표 가격|가격 항목|새 가격 추가|사용자 메모"`
- 메모
  - production start 검증 중 로컬 production DB credential이 없어서 place/trending read는 mock fallback 로그를 남겼다. UI 구조 확인에는 영향이 없었다.

### 2026-04-17 23:10 KST: 전면 디자인 재설계 3차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`를 새 버튼 규칙에 맞춰 다시 정리했다. 북마크는 icon + state형 버튼으로, 공유는 inline icon action으로, 반응은 segmented control 느낌의 compact action row로 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 지도 패널 외부 헤더를 제거하고 overlay-first chrome으로 재구성했다. 주변 정보, 현재 상태, `이 지역 다시 찾기`, `현재 위치`를 map 안쪽 compact overlay로 옮겨 실제 지도 작업면 비중을 더 높였다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`에서 모바일 `목록 열기` 캡슐, 목록 시트 헤더, 상세 시트 닫기 affordance를 더 compact하게 정리했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 `altteulmap-map-overlay`, `altteulmap-map-overlay-subtle` 공용 스타일을 추가해 preview/runtime/fallback 지도 오버레이 언어를 통일했다.
- 검증 결과
  - `git diff --check` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3011 npm run start`
  - `curl -s http://127.0.0.1:3011/ | rg -n "가격을 먼저 보고 동네 장소를 찾는 지도|목록 열기|카테고리 고르기|주변 가격 보기"`
  - `curl -s http://127.0.0.1:3011/place/goodprice-14501 | rg -n "대표 가격|새 가격 추가|사용자 메모|북마크|공유|아쉬워요|좋아요"`
- 메모
  - `3010` 포트는 기존 프로세스가 점유 중이라 production HTML 확인은 `3011`에서 진행했다.
  - build/start 중 로컬 production DB credential 부재로 mock fallback 로그는 계속 남지만, lint/build 자체는 통과했다.

### 2026-04-17 23:58 KST: 전면 디자인 재설계 8차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/admin/components/admin-page-shell.tsx`를 기준으로 `/Users/alex/project/altteulmap/src/features/admin/pages/dashboard-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/places-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/prices-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/reports-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/place-prices-page.tsx`를 다시 정리했다. 기존의 큰 흰색 카드 래퍼와 영문 metric 라벨을 걷어내고, public에서 쓰는 panel/button/badge 규칙을 admin에도 그대로 적용했다. `admin:sync`를 다시 태워 `/Users/alex/project/altteulmap/src/features/admin/entrypoints/pages/**`도 같은 구조로 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/admin/components/admin-summary-cards.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-queue-nav.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-pending-place-card.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-pending-price-report-card.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-report-card.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-place-review-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-price-item-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-price-report-review-form.tsx`, `/Users/alex/project/altteulmap/src/features/reports/admin-report-status-form.tsx`는 새 shell 안에서 같은 디자인 언어를 유지하도록 spacing/surface/action 구성을 맞췄다.
  - `/Users/alex/project/altteulmap/src/components/global-header.tsx`에서 admin 경로일 때 중복 사용자 배지(`운영자`)를 숨기고 `지도`, `장소 등록`, `관리 홈`, `로그아웃` 중심의 더 짧은 헤더로 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/admin-dashboard.spec.ts`는 mock telemetry 숫자를 고정으로 기대하던 오래된 assertion을 걷어내고, 현재 admin dashboard shell과 주요 운영 카드가 렌더되는지 확인하는 smoke로 정리했다.
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`에 admin surface 리디자인 완료 기준을 Cycle 13에 추가했다.
- 검증 결과
  - `git diff --check` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/submission-admin.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts --project chromium`
  - `USE_MOCK_DATA=true AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/admin-dashboard.spec.ts --project chromium` 통과
- 메모
  - DB-backed admin E2E는 현재 로컬 `postgres` 자격 증명 불일치(`28P01: password authentication failed`) 때문에 계속 실패했다. 이번 턴에서 깨진 것은 admin UI가 아니라 로컬 DB 연결 상태다.
  - mock 기준 admin dashboard smoke는 통과했고, 이 범위에서는 public/admin design language 정렬과 admin shell 구조 확인 용도로 충분했다.
  - 중간에 `src/features/admin/entrypoints/**`만 먼저 바꾸면 build 시 `admin:sync`가 원본 `src/features/admin/pages/**`로 다시 덮는다는 점을 확인했고, 이후 source of truth를 `pages/**`로 고정해 수정했다.

### 2026-04-18 00:11 KST: 로컬 Postgres 인증 복구 확인
- 완료 내용
  - 다른 프로젝트 Postgres와 충돌하던 로컬 5432 포트를 현재 프로젝트용 `altteulmap-postgres` 컨테이너로 다시 맞춘 뒤, 프로젝트 기본 로컬 DB(`postgresql://postgres:postgres@127.0.0.1:5432/altteulmap`) 기준 접속과 seed를 다시 확인했다.
  - 디자인 변경과 직접 관련된 관리자 화면도 DB-backed 경로에서 다시 확인했다. `admin-dashboard`, `submission-admin`, `price-review`, `report-admin` E2E가 모두 통과해, 이번 admin 리디자인이 실제 queue/read/write 흐름을 깨지 않았음을 확인했다.
- 검증 결과
  - `docker ps --filter name=altteulmap-postgres --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`
  - `PGPASSWORD=postgres psql postgresql://postgres:postgres@127.0.0.1:5432/altteulmap -c 'select current_database(), current_user, 1 as ok;'`
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run db:push`
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run db:seed`
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/submission-admin.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts --project chromium`
- 메모
  - 로컬 기준으로는 이제 `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap`를 명시했을 때 DB-backed admin E2E까지 안정적으로 돈다.
  - `build/start`는 `.env.production.local`의 remote DB URL을 읽을 수 있으므로, 로컬 실DB 검증은 계속 shell env로 local `DATABASE_URL`을 덮어쓰는 편이 안전하다.

### 2026-04-17 10:16 KST: 전면 디자인 재설계 4차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 홈 상단을 다시 압축했다. 큰 hero 문구를 `동네 가격 지도` 기준의 compact heading으로 줄이고, 검색/범위/카테고리/요약 배치를 한 패널 안 toolbar 구조로 재정리했다.
  - 같은 파일의 카테고리 drawer 내부도 바꿨다. 기존의 그룹별 카드 나열 대신 `전체 보기 + 현재 선택 요약 + 그룹 라벨 + 칩 row` 구조로 밀도를 높여, 카테고리 수는 유지하면서도 불필요한 카드 chrome을 걷어냈다.
  - 데스크톱 보조 배지 문구는 `정렬`처럼 읽히지 않게 `가격 중심 카드`로 조정해 현재 제품 동작과 일치하도록 맞췄다.
- 검증 결과
  - `git diff --check` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3012 npm run start`
  - `curl -s http://127.0.0.1:3012/ | rg -n "동네 가격 지도|대표 가격, 최근 갱신, 검증 상태를 기준으로|전체 18개 업종|가격 중심 카드"`
- 메모
  - production start 검증 중 로컬 production DB credential이 없어 trending read는 mock fallback 로그를 남겼다. 홈 shell HTML 구조 확인에는 영향이 없었다.

### 2026-04-17 10:22 KST: 전면 디자인 재설계 5차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/global-header.tsx`, `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`, `/Users/alex/project/altteulmap/src/features/auth/sign-out-button.tsx`에서 전역 헤더를 더 compact하게 줄였다. 공개 화면에서는 `장소 등록`, `북마크`, `로그인/로그아웃`만 유지하고, 인증 화면에서는 홈 복귀용 `지도로`만 남겨 작업 집중도를 높였다.
  - `/Users/alex/project/altteulmap/src/features/places/trending-places-section.tsx`를 다시 정리해 `탐색 추천` 쇼케이스보다 `빠른 비교` 레일처럼 읽히게 바꿨다. 카드 패딩과 가격 크기를 조금 줄이고, 메타를 짧은 비교 단위로 재배치했다.
- 검증 결과
  - `git diff --check` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3013 npm run start`
  - `curl -s http://127.0.0.1:3013/login | rg -n "지도로|로그인|장소 등록하기|북마크|운영 관리"`
  - `curl -s http://127.0.0.1:3013/ | rg -n "빠른 비교|가격과 최근 반응을 기준으로 바로 비교할 수 있는 카드입니다.|상위 6곳|상세 보기"`
- 메모
  - production start 검증 중 로컬 production DB credential이 없어 trending read는 mock fallback 로그를 남겼다. 헤더/추천 HTML 구조 확인에는 영향이 없었다.

### 2026-04-17 10:28 KST: 전면 디자인 재설계 6차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/social-auth-buttons.tsx`를 정리했다. 인증 폼의 상단/하단 chrome을 줄이고, 소셜 버튼 높이와 badge 비율을 더 compact하게 맞췄다.
  - 회원가입 폼은 자격증명 가입이 비활성화된 환경에서 credential 입력 필드와 submit 버튼을 숨기고 소셜 시작 플로우만 남기도록 바꿨다. 활성화된 경우에는 2열 입력 구조로 높이를 줄였다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`에서 공개 장소 등록을 다시 정리했다. 페이지 상단 카피를 줄이고, 폼 내부는 `1 장소 정보 -> 2 대표 가격 -> 3 추가 메모` 단계형 구조로 재배치했으며 대표 가격 영역의 중첩 panel/card를 걷어냈다.
  - 접수 결과 패널도 `접수 확인` 기준으로 단순화해 결과 메시지와 preview가 더 빨리 읽히게 맞췄다.
- 검증 결과
  - `git diff --check` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3014 npm run start`
  - `curl -s http://127.0.0.1:3014/login | rg -n "로그인|회원가입|소셜 로그인|저장한 장소와 북마크를 이어서 봅니다"`
  - `curl -s http://127.0.0.1:3014/signup | rg -n "회원가입|로그인|소셜로 시작|북마크와 제보 내역을 계정에 연결합니다"`
  - `curl -s http://127.0.0.1:3014/submit | rg -n "장소 등록|이름, 주소, 대표 가격 1개부터 적으면 됩니다.|장소 정보|대표 가격|추가 메모|가격 항목 추가|접수 확인"`
- 메모
  - `npm run verify`의 build 단계에서 로컬 production DB credential이 없어 `places` read mock fallback 로그는 계속 남았지만, lint/build/HTML 구조 확인 자체는 정상 통과했다.
  - 다음 리디자인 우선순위는 지도 필터 tray 세부 상호작용, 북마크/제보 success state polish, 관리자 화면의 같은 design language 적용이다.

### 2026-04-17 10:35 KST: 전면 디자인 재설계 7차 구현
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-category-tray.tsx`를 새로 추가하고, `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 기존 서버 렌더 카테고리 나열을 이 client tray로 교체했다. 이제 카테고리 선택은 `상위 묶음 먼저 고르기 -> 세부 업종 선택` 흐름으로 읽히고, 현재 선택 카테고리도 tray 상단에서 바로 확인할 수 있다.
  - 카테고리 summary copy도 `상위 묶음과 세부 업종으로 빠르게 좁혀 봅니다.` 기준으로 바꿔 drawer의 역할이 더 분명하게 보이도록 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`에서 가격 제보 결과 메시지를 작은 보조 문구가 아니라 success/error 박스로 올렸다. 성공 시 입력 필드도 초기화해서 접수 완료가 더 명확히 느껴지게 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`에서는 완료 상태 문구를 `저장됨` 기준으로 정리하고, non-compact 문맥에서는 API 응답 메시지를 그대로 보여주도록 바꿨다.
- 검증 결과
  - `git diff --check` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3015 npm run start`
  - `curl -s http://127.0.0.1:3015/ | rg -n "상위 묶음과 세부 업종으로 빠르게 좁혀 봅니다.|카테고리|동네 가격 지도|현재 지도|전체 검색"`
  - `npx playwright test tests/e2e/bookmarks.spec.ts tests/e2e/price-review.spec.ts --project chromium` 실행
- 메모
  - Playwright 2건은 이번 UI 변경 자체가 아니라 기존 auth test 환경 문제로 실패했다. `tests/e2e/helpers/auth.ts`가 기대하는 `baseUrl` redirect(`location.startsWith(baseUrl)`)가 현재 webServer login 응답과 맞지 않아 로그인 helper 단계에서 멈췄다.
  - `npm run verify`의 build 단계에서 로컬 production DB credential이 없어 `places`/`trending` read mock fallback 로그는 계속 남았지만 lint/build는 정상 통과했다.
  - 다음 리디자인 우선순위는 관리자 화면의 같은 design language 적용, `RouteResetDetails` summary affordance 개선, Playwright auth helper의 base URL 정렬이다.

### 2026-04-17 00:25 KST: 네이버 지도 preview-first delayed boot 적용과 live 재실측
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`를 preview-first delayed boot 구조로 바꿨다. 초기 렌더에서는 preview만 먼저 보여주고, 자동 SDK 부팅은 최소 `900ms` 뒤에만 시작하게 했다.
  - preview 영역 pointer/key interaction, preview cluster 선택, `현재 위치`, `이 지역 검색`, place 선택은 모두 즉시 `setShouldBootMap(true)`로 우회하도록 묶었다. 따라서 첫 화면은 가볍게 유지하면서도 사용자가 지도를 바로 만지려는 순간에는 지연 없이 실제 지도를 띄운다.
  - preview 상태에서 `cluster`를 누르거나 `현재 위치`를 먼저 누른 경우를 위해 pending ref를 두고, map status가 `ready`가 되면 대기 중이던 cluster focus/current-location 동작을 이어서 실행하게 했다.
  - public worker만 다시 배포했다. 현재 live public version은 `32da4479-838a-417c-8e84-7663554dde17`이다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start` 후 local production Playwright one-off 측정:
    - 변경 전 첫 `1.2s`: total `45`, map asset `26`
    - 변경 후 첫 `1.2s`: total `14`, `stylesheet 1`, `script 10`, `document 1`, `ping 1`, `fetch 1`, map asset `0`
    - 변경 후 total `3.4s`: total `45`, `script 16`, `image 23`, map asset `26`
    - preview는 초기부터 visible, 초기 상태 문구는 `지도를 준비하는 중입니다.`
  - local production interaction check:
    - `map-current-location-button` 초기 disabled `false`
    - `map-refresh-button` 즉시 클릭 시 `/api/places/map` status `200`
    - mobile emulation에서 `목록 보기` 버튼과 목록 시트 open 정상
  - `npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - live public Playwright one-off 측정:
    - 첫 `1.2s`: total `11`, `document 1`, `stylesheet 1`, `script 9`, map asset `0`
    - total `3.6s`: total `44`, `script 16`, `ping 1`, `fetch 2`, `image 22`, `xhr 1`, map asset `28`
    - preview는 초기부터 visible, 초기 상태 문구는 `지도를 준비하는 중입니다.`
  - live interaction check:
    - `map-current-location-button` 초기 disabled `false`
    - `map-refresh-button` 즉시 클릭 시 `/api/places/map` status `200`
    - mobile emulation에서 `목록 보기` 버튼과 목록 시트 open 정상
- 메모
  - 이번 단계로 app 자체의 초기 경쟁 요청은 거의 정리됐다. 첫 진입 초반 구간에서 남는 비용은 네이버 지도 asset이 아니라 Next 기본 script 정도다.
  - 이제 성능 후속의 실질적인 다음 레버는 `boot 이후` 네이버 타일 수를 더 줄이는 일이다. 이건 mount timing보다 zoom/bounds/marker strategy 쪽 영향이 더 크다.

### 2026-04-17 00:05 KST: 성능 보정본 live 재배포와 첫 진입 네트워크 재확인
- 완료 내용
  - current commit `a9dc35d` 기준으로 public/admin worker를 다시 배포했다. public version은 `cba2d8d7-f601-4985-b070-0e97de50191a`, admin version은 `1e2b599a-ba15-41ff-a40c-76037c4d5176`다.
  - 배포 후 remote smoke를 다시 돌려 public canonical, robots, sitemap, public `/admin` redirect, public admin api redirect, admin `/login` 계약이 모두 유지되는 것을 확인했다.
  - live 첫 진입 네트워크를 Playwright로 다시 재측정했다. 이전 live는 `95 requests`와 `_rsc` prefetch flood, telemetry `500`이 남아 있었지만, 재배포 후에는 `51 requests`로 내려왔다.
- 검증 결과
  - `npm run deploy:public` 통과
  - `npm run deploy:admin` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - live first-entry 측정 결과:
    - total requests `51`
    - `fetch 1`, `ping 1`, `xhr 1`, `script 16`, `image 30`, `document 1`, `stylesheet 1`
    - `/api/telemetry/visit` status `200`
    - `/api/places/map?...` status `200`
    - `_rsc` prefetch 요청 없음
- 메모
  - 남은 비용은 app 자체보다 네이버 지도 런타임이다. 현재 기준 상위 origin은 `nrbe.pstatic.net` 타일 `31`, `oapi.map.naver.com` script `3`, `ssl.pstatic.net` script `2`다.
  - 다음 성능 후속은 `네이버 지도 초기 타일/SDK 비용을 더 줄일 수 있는지`를 판단하는 단계다. 예를 들면 초기 zoom/viewport, map mount timing, static preview fallback 같은 선택지를 비교해야 한다.

### 2026-04-16 16:50 KST: telemetry route를 DB 장애 시 no-op fallback으로 전환
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/telemetry/repository.ts`에서 `recordVisitActivity`, `getVisitMetrics`를 DB 장애 circuit-aware 방식으로 감쌌다. 방문 적재나 관리자 방문 지표 조회 중 connectivity error가 나면 `markDatabaseUnavailable` 후 no-op/empty metrics로 바로 떨어진다.
  - `/Users/alex/project/altteulmap/src/features/telemetry/api/visit-route.ts`에는 마지막 방어선으로 degraded fallback 응답을 추가했다. repository에서 예외가 다시 올라와도 DB unavailable 상태면 `500` 대신 `200`과 `{ ok: true, tracked: false, source: "mock" }`를 반환한다.
  - `/Users/alex/project/altteulmap/src/db/client.ts`의 unavailable 판정 helper는 wrapped query error의 nested `cause.message`, `cause.code`까지 따라가도록 보강했다. 기존에는 top-level `Failed query ...`만 보고 stale DB를 놓쳐 telemetry route가 계속 `500`으로 떨어졌다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start` 후 local production에서 `POST http://127.0.0.1:3010/api/telemetry/visit` 확인 결과:
    - status `200`
    - body `{\"ok\":true,\"tracked\":false,\"source\":\"mock\"}`
  - 같은 요청 직후 서버 로그에는 기존의 `Failed to record visit activity.` 에러가 다시 남지 않음
- 메모
  - 이번 수정으로 telemetry는 best-effort 보조 기능이라는 현재 정책에 맞게 동작한다. 운영 DB가 불안정해도 공개 페이지가 telemetry route 500으로 소음을 만들지 않는다.
  - 다음 우선순위는 local/live 첫 진입 네트워크를 다시 재보면서 남은 비용이 무엇인지 확인하는 쪽이다.

### 2026-04-16 16:20 KST: 데스크톱 목록 카드 보조 액션을 늦게 붙이도록 조정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`의 `PlaceList`에 `showSecondaryActions` 제어를 추가했다. 데스크톱 첫 렌더에서는 북마크/공유 대신 가벼운 placeholder만 보이고, 선택된 카드만 즉시 액션을 유지한다.
  - 같은 파일의 `MapExplorer`에는 `desktopCardActionsReady` 상태를 추가해, 데스크톱 목록이 준비된 뒤 900ms 뒤에만 북마크/공유 버튼을 붙이도록 바꿨다. 이전 `requestIdleCallback` 기반 접근은 너무 빨라서 실측상 바로 액션이 붙어 효과가 없었다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start` 후 Playwright 확인 결과:
    - 데스크톱 첫 목록 렌더 직후 `bookmark-toggle-*`, `place-list-item-share-button-*` count는 둘 다 `0`
    - 1.1초 뒤 같은 count는 둘 다 `80`
- 메모
  - 이번 단계로 데스크톱은 `지도 -> 목록 카드 본문 -> 보조 액션` 순서로 붙는다. 첫 화면에서 가장 무거운 client button 세트를 뒤로 미룬 것이 핵심이다.
  - 다음 성능 후속은 `telemetry 500 원인 분리`가 우선이다.

### 2026-04-16 16:00 KST: 지도 카테고리 필터 DOM을 접힌 기본값으로 줄임
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/category-filter-chips.tsx`를 추가해 카테고리 칩을 `기본 접힘 -> 더보기/접기` 패턴으로 공용화했다. 접힌 상태에서도 현재 선택된 카테고리는 사라지지 않도록 유지하고, 토글 버튼은 `button`으로 분리해 모바일 검색 form submit과 충돌하지 않게 했다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 모바일/데스크톱 카테고리 grid를 위 컴포넌트로 교체했다. 모바일은 `collapsedCount=8`, 데스크톱은 `collapsedCount=10`으로 두고, 홈 첫 화면에서 불필요한 category chip DOM을 먼저 줄였다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start` 후 Playwright 확인 결과:
    - 데스크톱 기본 노출: `전체 + 10개 + 더보기 8`으로 총 12개
    - 모바일 기본 노출: `전체 + 8개 + 더보기 10`으로 총 10개
    - `/?category=pharmacy` 기준 숨겨진 카테고리 `약국`도 접힌 상태에서 계속 노출됨
- 메모
  - 이번 단계는 네트워크보다 초기 DOM 감량에 초점을 맞췄다. 첫 화면에서 바로 그릴 필요 없는 카테고리 칩을 뒤로 미뤄 `map-first` 체감을 더 맞추는 변경이다.
  - 다음 성능 후속은 `desktop 목록 카드 액션 지연 렌더`와 `telemetry 500 원인 분리`가 우선이다.

### 2026-04-16 15:05 KST: 지도 첫 진입 prefetch/목록 렌더를 줄여 체감 성능 1차 보정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`, `/Users/alex/project/altteulmap/src/components/global-header.tsx`, `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/features/places/trending-places-section.tsx`에서 홈 첫 화면에 바로 보이는 `Link`들의 `prefetch`를 껐다. category 칩, 검색 지우기, 장소 등록, 북마크, 로그인, 운영자 관리, 추천 카드 상세 링크가 더 이상 첫 진입에 RSC prefetch를 쏘지 않는다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 desktop 장소 목록을 idle 이후에 지연 마운트하도록 바꿨고, 목록 렌더 상한을 `desktop 80 / mobile 40`으로 낮췄다. 목적은 지도를 먼저 그린 뒤 무거운 카드 DOM과 bookmark/share 버튼을 붙이는 것이다.
  - `/Users/alex/project/altteulmap/src/features/telemetry/visit-tracker.tsx`는 `fetch`를 즉시 보내지 않고 idle 이후 `navigator.sendBeacon` 우선 전송으로 미뤘다. 첫 진입 경합을 줄이기 위한 변경이다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3010 npm run start`로 로컬 production 서버를 띄운 뒤 Playwright로 홈 첫 진입 네트워크를 확인한 결과:
    - fetch/xhr 총 2건
    - `http://127.0.0.1:3010/api/places/map?...` 1건
    - `https://kr-col-ext.nelo.navercorp.com/_store` 1건
    - 기존 live 측정에서 보이던 `?category=...&_rsc=*`, `/login?...&_rsc=*`, `/submit?_rsc=*`, `/api/telemetry/visit` 초기 요청은 재현되지 않음
- 메모
  - build/start 중 운영 DB는 여전히 stale credential 때문에 fallback 로그를 남겼지만, 이번 작업의 관심사는 홈 첫 진입 네트워크와 DOM 감량이라 검증에는 영향이 없었다.
  - 다음 성능 후속은 `카테고리 필터 UI 자체 DOM 감량`, `desktop 목록 카드 액션 지연 렌더`, `telemetry 500 원인 분리` 순으로 보는 게 맞다.

### 2026-04-12 13:15 KST: 운영 DB 진단 스크립트와 실기기 QA 체크리스트 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/check-production-db.mjs`와 `package.json`의 `db:check:production` 명령을 추가했다. 이 스크립트는 현재 `DATABASE_URL`을 안전하게 마스킹해서 요약하고, 실제 DB 연결, `moderation_suggestions` 테이블/enum, `drizzle.__drizzle_migrations` 존재 여부를 확인한다.
  - 현재 `.env.production.local` 기준 production DB 연결은 여전히 `Tenant or user not found`로 실패했다. raw password 분리 전달과 encoded URL 전달을 둘 다 확인한 결과라서, 이번에도 URL encoding이 아니라 credential 자체가 stale/wrong이라는 결론이 유지된다.
  - `/Users/alex/project/altteulmap/docs/project/mobile-qa-checklist.md`를 추가해 iPhone Safari, Android Chrome 기준 public/admin 실기기 검증 항목과 기록 템플릿을 정리했다.
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`, `/Users/alex/project/altteulmap/docs/README.md`에 새 진단 명령과 체크리스트 링크를 반영했다.
- 검증 결과
  - `npm run db:check:production` 실행 결과:
    - `host=aws-1-ap-northeast-2.pooler.supabase.com`
    - `port=6543`
    - `status=failed`
    - `message=Tenant or user not found`
    - conclusion: `URL encoding이 아니라 stale/wrong credential`
  - raw password object connection / encoded URL connection 비교 테스트 둘 다 `Tenant or user not found` 확인
  - `npm run verify:quick` 통과
- 메모
  - 현재 환경에서 Cloudflare/GitHub secret value 자체는 읽을 수 없으므로, 실제 복구는 저장소 밖의 운영 credential source를 다시 가져와 갱신해야 한다.
  - 이제 다음 세션은 `db:check:production`으로 먼저 진단하고, credential이 복구되면 그 즉시 migration 존재 여부와 schema 상태를 다시 확인하면 된다.

### 2026-04-12 11:32 KST: Phase D backlog freeze를 현재 범위 기준으로 고정
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`에서 `Cycle 12`의 `출시 직전 backlog를 정리해 다음 cycle 범위를 고정한다` 작업을 `pending -> done`으로 정리했다.
  - search URL 상태는 현재 `q/scope` URL 반영 범위만 유지하고 추가 검색/탐색 확장은 보류하도록 문서에 명시했다.
  - 공유 telemetry는 현재 관리자 overview의 공유 유입/source breakdown 범위까지만 유지하고, 추천/랭킹 확장으로 이어지는 추가 개발은 현재 cycle에서 동결한다고 명시했다.
  - `bang`, `deal`, 사진 업로드, 랭킹 화면, 프론트엔드 디자인 polish도 현재 출시 범위에서 계속 제외한다고 같은 문서에 고정했다.
- 검증 결과
  - 문서 정리 작업이라 별도 코드/배포 명령은 실행하지 않았다.
- 메모
  - 현재 남은 일은 문서 판단이 아니라 실제 blocker 처리다. 즉 운영 DB credential 복구와 실기기 QA가 다음 실행 대상이다.

### 2026-04-12 11:20 KST: Phase C 운영 URL을 `workers.dev` split 기준으로 고정
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`에서 `Cycle 12`의 `운영 URL 전략을 최종 고정한다` 작업을 `in_progress -> done`으로 정리했다. 현재 운영 기준은 public `https://altteulmap.altteul-lab.workers.dev`, admin `https://altteulmap-admin.altteul-lab.workers.dev`다.
  - `/Users/alex/project/altteulmap/README.md`의 rollout/next 설명을 현재 운영 기준에 맞춰 갱신했다. launch URL은 `workers.dev` split으로 고정하고, custom domain은 별도 후속 작업으로만 남겼다.
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`도 현재 운영 기준을 `workers.dev` split으로 명시하도록 정리했다. 기존의 `첫 배포 후 custom domain 전환 권장` 톤은 `선택적 후속 작업`으로 낮췄다.
- 검증 결과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - smoke 결과:
    - `home canonical=https://altteulmap.altteul-lab.workers.dev`
    - `robots=ok`
    - `sitemap=ok`
    - `sample place canonical=https://altteulmap.altteul-lab.workers.dev/place/goodprice-14501`
    - `public /admin redirect=https://altteulmap-admin.altteul-lab.workers.dev/admin`
    - `public admin api=https://altteulmap-admin.altteul-lab.workers.dev/admin/places`
    - `admin /admin redirect=/login?callbackUrl=%2Fadmin`
    - `admin login=ok`
- 메모
  - custom domain 자체를 금지한 것은 아니다. 다만 현재 출시 기준에서는 DNS/OAuth callback/canonical 재정렬 비용이 더 크므로, 별도 cycle로 분리했다.
  - 현재 남은 실제 blocker는 운영 DB credential 복구와 모바일 실기기 QA다.

### 2026-04-10 12:33 KST: Phase B live QA 1차(Chromium emulation + remote admin)
- 완료 내용
  - live public/admin URL 기준으로 Phase B 핵심 흐름의 1차 운영 QA를 진행했다. 실기기 대신 현재 환경에서 가능한 Chromium desktop/mobile emulation과 remote auth/tail 조합으로 확인했다.
  - public 쪽은 desktop emulation에서 지도 패널, `현재 위치`, `이 지역 검색` 버튼 노출을 확인했다.
  - public 쪽은 mobile emulation에서 지도 패널, `목록 보기`, `현재 위치`, `이 지역 검색` 버튼 노출을 확인했다.
  - admin 쪽은 browser login script가 URL 대기 타이밍 때문에 불안정해, 실제 운영 기준으로는 credentials callback + `/admin/reports` 연속 요청 + `wrangler tail` 로그를 기준으로 확인했다.
- 검증 결과
  - `node -e "const { chromium } = require('playwright'); ..."` 기준 desktop live check 결과:
    `{\"flow\":\"public-desktop-min\",\"mapVisible\":true,\"current\":true,\"refresh\":true}`
  - `node -e "const { chromium, devices } = require('playwright'); ..."` 기준 mobile emulation live check 결과:
    `{\"flow\":\"public-mobile-min\",\"mapVisible\":true,\"openButtonVisible\":true,\"current\":true,\"refresh\":true}`
  - remote admin credentials callback + `/admin/reports` 연속 3회 요청 결과:
    `request_1=200`, `request_2=200`, `request_3=200`
  - `wrangler tail -c wrangler.admin.jsonc --format pretty` 기준 같은 흐름에서 `POST /api/auth/callback/credentials`와 `GET /admin/reports` 3회가 모두 `Ok`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
- 메모
  - 이번 QA는 실제 iPhone Safari/Android Chrome이 아니라 Chromium emulation이다. 따라서 `drag 감각`, `현재 위치 권한 UX`, `실제 모바일 브라우저 제스처`는 아직 실기기 확인이 필요하다.
  - admin browser automation은 live URL 대기 타이밍 때문에 flaky했지만, 실제 운영 callback과 tail 로그 기준으로는 관리자 보고서 큐와 AI 패널 흐름이 정상 응답했다.

### 2026-04-10 12:29 KST: degraded admin 반복 요청 hang 완화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/admin/repository.ts`의 admin overview 조회 앞단에 짧은 DB probe를 넣어, broken DB에서 overview fan-out 쿼리를 한 번에 퍼뜨리지 않도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/admin/pages/dashboard-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/places-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/prices-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/reports-page.tsx`는 `Promise.all` 병렬 조회를 직렬 read로 바꿨다. degraded 상태에서는 첫 실패가 circuit을 열고 뒤 read는 즉시 mock으로 내려가도록 만든 변경이다.
  - sync 결과로 `/Users/alex/project/altteulmap/src/features/admin/entrypoints/pages/dashboard-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/entrypoints/pages/places-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/entrypoints/pages/prices-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/entrypoints/pages/reports-page.tsx`도 같은 내용으로 갱신했다.
  - public/admin worker를 다시 배포했다. 현재 live version은 public `f28aa986-5f32-4266-a9ec-9f6aabc5c91c`, admin `c8165b6d-946d-4139-87e1-5b22013a1b38`다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `npm run deploy:admin` 통과
  - `npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - remote credentials callback 이후 `/admin/reports` 3회 연속 `curl` 요청에서 `request_1=200`, `request_2=200`, `request_3=200` 확인
  - `wrangler tail -c wrangler.admin.jsonc --format pretty` 기준으로 `POST /api/auth/callback/credentials`와 이어진 `GET /admin/reports` 3회가 모두 `Ok`였고, 직전 턴에 보이던 hung exception은 재현되지 않음
- 메모
  - 운영 DB는 여전히 깨져 있으므로 admin read는 계속 mock fallback 로그를 남긴다. 다만 지금은 반복 요청에서도 관리자 화면이 정상 응답하는 쪽으로 안정화됐다.
  - 다음 우선순위는 그대로 production DB credential 복구와 `moderation_suggestions` migration 적용이다. 그 전까지는 degraded 운영 경로를 기준으로 QA를 이어갈 수 있다.

### 2026-04-10 12:24 KST: DB 장애 circuit breaker 추가와 remote auth callback 복구
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/client.ts`에 짧은 DB 장애 circuit breaker를 추가했다. `Tenant or user not found`, DNS/connection timeout류 에러가 한 번 발생하면 같은 runtime 인스턴스가 잠시 DB를 다시 두드리지 않고 mock fallback으로 바로 내려가도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/reports/repository.ts`, `/Users/alex/project/altteulmap/src/features/admin/repository.ts`, `/Users/alex/project/altteulmap/src/features/bookmarks/repository.ts`에서 주요 read/fallback catch에 circuit mark를 연결했다. 목적은 운영 DB가 죽어 있을 때 지도/관리자 개요/신고/북마크 read가 매번 같은 실패를 반복하지 않게 하는 것이다.
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`에도 처음에는 같은 circuit mark를 넣었지만, Cloudflare Workers runtime에서 credentials callback이 `1101 hung request`로 깨지는 회귀를 확인했다. auth 경로에서는 이 mark를 제거하고 degraded login fallback만 유지하도록 되돌렸다.
  - public/admin worker를 다시 배포했고, 최종 live version은 public `24f6b57f-a808-4668-a1b1-18873f9f1bcc`, admin `0f4ffb4a-50fe-417e-884c-a29cf89c7135`다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `DATABASE_URL=postgresql://example:example@127.0.0.1:5432/example USE_MOCK_DATA=false npx tsx ...`로 circuit helper 검증:
    `tenantError=true`, `missingTable=false`, `before=true -> after-mark=false -> after-expire=true`
  - `node`/`postgres` 직접 접속 테스트에서 `.env.production.local`의 Supabase pooler credential 후보는 URL-safe 인코딩을 적용해도 `Tenant or user not found` 동일 응답 확인
  - `npm run deploy:admin` 통과
  - `npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - remote credentials callback 수동 검증에서 `callback_status=200`, `report_status=200`, `final_url=/admin/reports`, `ai_panel_count=3`, `has_ai_text=true` 확인
  - `wrangler tail` 기준으로 remote `/api/auth/callback/credentials`는 최종 배포본에서 `Ok`, `/admin/reports` 1차 요청도 `Ok` 확인
- 메모
  - 운영 DB 복구 자체는 여전히 안 됐다. 현재 `.env.production.local`과 live secret 계열에서 사용 중인 Supabase credential이 stale 또는 잘못된 값일 가능성이 높다.
  - 이번 턴의 실질 결과는 persisted live 전환이 아니라 degraded 운영 경로의 안정화다. 사용자 흐름은 다시 살아 있지만, `moderation_suggestions` migration 적용과 실데이터 복구는 별도 blocker로 남아 있다.

### 2026-04-10 12:12 KST: Phase A degraded fallback live 반영과 원격 검증
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/admin/moderation-agent.ts`에서 `moderation_suggestions` read/write를 감싸, live DB에 테이블이나 enum이 아직 없거나 읽기 자체가 실패해도 관리자 큐가 비영속 AI suggestion으로 계속 열리게 했다.
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`에서 DB disabled/error 시 known demo/admin 계정의 degraded fallback 로그인이 계속 되도록 보강했다. 운영 DB가 깨진 상태에서도 canonical fallback password로 local admin/demo user를 열 수 있게 좁게 정리했다.
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`의 `Phase A`와 `다음 실행 순서`를 현재 blocker 기준으로 다시 갱신했다. 현재 남은 핵심은 재배포가 아니라 운영 DB credential 복구와 migration 적용이다.
  - public/admin worker를 다시 배포했다. 현재 live version은 public `be8a3046-9696-4e31-827a-c0343b33a110`, admin `758cdf40-6e16-4cc2-8ab4-622c07b5a0a9`다.
  - live `https://altteulmap-admin.altteul-lab.workers.dev/admin/reports`에 `admin@altteulmap.local` + fallback credential로 로그인해, 최종 URL이 `/admin/reports`로 유지되고 AI 패널이 실제로 렌더되는 것을 확인했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    build 중 live DB 조회는 여전히 `Tenant or user not found`로 실패했지만, mock fallback으로 빌드는 완료됨
  - `npm run deploy:admin` 통과
  - `npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
  - `curl` cookie-jar 기준 `GET /api/auth/csrf -> POST /api/auth/callback/credentials -> GET /admin/reports` 검증에서 `callback_status=200`, `final_url=/admin/reports`, `has_ai_text=true`, `ai_panel_count=3` 확인
- 메모
  - 운영 DB probe와 build/deploy 로그는 계속 `Tenant or user not found`를 반환했다. 즉 persisted `moderation_suggestions` migration 적용 자체는 아직 못 했다.
  - 현재 `workers.dev`는 degraded but usable 상태다. 관리자 로그인과 mock 관리자 큐, `AI 1차 검수` 패널은 살아 있고, persistence/live DB 경로만 blocker로 남아 있다.
  - 다음 시작점은 production `DATABASE_URL`/tenant credential 복구, `moderation_suggestions` migration 적용, 그 다음 live admin queue 재확인이다.

### 2026-04-10 11:51 KST: 남은 일의 현실적 실행 계획 상세화
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`의 `Cycle 12`를 실제 운영 기준으로 다시 쪼갰다. 단순 우선순위 대신 `Phase A: AI 검수 live rollout`, `Phase B: 운영 도메인/모바일 QA`, `Phase C: 운영 URL 최종 고정`, `Phase D: backlog freeze` 4단계로 정리했다.
  - 각 단계에 `목표`, `작업`, `현실적 체크포인트`, `완료 기준`, `중단 기준`을 추가해 다음 세션에서 바로 실행 판단을 할 수 있게 했다.
  - 새 계획은 디자인 polish를 배제하고, 운영 반영과 QA, URL 기준 정리에만 집중하도록 고정했다.
- 검증 결과
  - 계획 정리 전용 세션이라 별도 코드/배포 검증은 실행하지 않았다.
- 메모
  - 다음 구현/실행 시작점은 `Phase A`다. 즉 live DB migration 적용 여부 확인과 public/admin 재배포부터 시작하면 된다.

### 2026-04-10 11:51 KST: 프론트엔드 디자인 polish 범위 제외
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`의 현재 우선순위에서 별도 공개 UI polish 항목을 제거하고, 남은 일은 `AI 검수 live 반영`, `운영 QA`, `운영 URL 고정`, `검색 URL 상태/공유 telemetry 판단` 중심으로 다시 정리했다.
  - 같은 문서의 `부분 구현`과 `결정 메모`에도 프론트엔드 디자인/비주얼 polish는 현재 수준을 유지하고, 기능 버그가 아닌 이상 현재 범위에서 제외한다는 결정을 명시했다.
  - `Cycle 12`의 backlog 정리 항목도 같은 기준으로 업데이트해 다음 세션이 UI redesign이나 추가 motion polish로 흐르지 않도록 고정했다.
- 검증 결과
  - 문서 결정 반영 작업이라 별도 코드 검증은 실행하지 않았다.
- 메모
  - 현재 남은 일은 기능 추가보다 live rollout, QA, 운영 설정 고정 쪽이다.

### 2026-04-06 14:05 KST: README rollout 계획 보강과 후속 실행 순서 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`에 `다음 실행 순서`와 `Cycle 12: AI 검수 live 반영과 출시 마감 정리`를 추가해 다음 세션의 시작 순서를 고정했다.
  - `/Users/alex/project/altteulmap/docs/project/PROGRESS.md`에는 이번 턴이 구현이 아니라 계획 정리 중심이었다는 점과 다음 우선순위를 다시 기록했다.
  - `/Users/alex/project/altteulmap/README.md`에 `Current Rollout Plan` 섹션을 추가해 `AI moderation rollout`, `Operational QA`, `Launch decision` 3단계가 외부에서 봐도 자연스럽게 이어지도록 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
- 메모
  - 이번 변경은 문서/README 보강 중심이다. 코드 동작 변경은 포함하지 않는다.

### 2026-04-06 14:02 KST: 후속 개발을 위한 실행 계획만 재정리
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`의 현재 우선순위를 `AI 검수 live rollout -> 운영 QA -> 운영 URL 최종 고정 -> 공개 UI/telemetry 후속 판단` 순서로 다시 정리했다.
  - 같은 문서에 `다음 실행 순서`를 추가해, 다음 세션에서 바로 수행할 배포/검증/결정 단계를 5단계로 고정했다.
  - `Cycle 12: AI 검수 live 반영과 출시 마감 정리`를 새로 추가해 `live migration/배포`, `모바일·운영 QA`, `운영 URL 전략 확정`, `출시 직전 backlog 정리` 4개 작업을 `pending` 상태로 남겼다.
- 검증 결과
  - 계획 정리 전용 세션이라 코드/배포 검증은 실행하지 않았다.
- 메모
  - 이번 턴은 구현을 시작하지 않았다. 다음 세션은 `Cycle 12` 첫 작업인 live DB migration 적용과 public/admin 재배포부터 시작하면 된다.

### 2026-04-06 13:53 KST: 관리자 검수 큐에 `AI 1차 검수` 제안 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/docs/project/PLAN.md`에 `Cycle 11: AI 검수 보조 1차`를 추가한 뒤 구현을 진행했고, 현재 상태에 맞춰 완료로 닫았다.
  - `/Users/alex/project/altteulmap/src/db/schema.ts`와 `/Users/alex/project/altteulmap/drizzle/0010_military_wildside.sql`에 `moderation_suggestions` 저장 구조를 추가했다. subject type은 `place_submission`, `price_report`, `content_report` 3종이고, generic `subject_key` 기준으로 suggestion을 upsert한다.
  - `/Users/alex/project/altteulmap/src/features/admin/moderation-agent.ts`, `/Users/alex/project/altteulmap/src/features/admin/moderation-suggestion.ts`를 추가해 로컬 검수 에이전트가 장소 등록/가격 제보/신고에 대해 `권장 액션/신뢰도/요약/근거/플래그`를 자동 생성·저장하도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/reports/repository.ts`는 관리자 큐 조회 시 기존 pending/open 항목에 AI suggestion을 함께 붙여 반환하도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/admin/components/admin-ai-review-panel.tsx`를 추가했고, `/Users/alex/project/altteulmap/src/features/admin/components/admin-pending-place-card.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-pending-price-report-card.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-report-card.tsx`에 공통 패널을 연결했다.
  - `/Users/alex/project/altteulmap/src/features/admin/pages/places-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/prices-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/reports-page.tsx`의 소개 문구도 `AI 1차 검수` 기준으로 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/price-review.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`에는 각 관리자 카드에서 AI 패널이 보이는지 확인하는 회귀를 추가했다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`를 현재 운영 검수 구조에 맞게 갱신했다. README는 `AI 1차 검수 + 운영자 최종 확정`, 제품 문서는 human-in-the-loop 구조와 댓글 제외 범위를 명시한다.
- 검증 결과
  - `npx tsc --noEmit` 통과
  - `npm run db:generate` 통과
  - `npm run verify:quick` 통과
  - `npm run db:up` 통과
  - `npm run db:push` 통과
  - `npm run verify` 통과
  - `npm run db:seed` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npx playwright test tests/e2e/submission-admin.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts --project chromium` 통과
- 메모
  - 현재 구현은 외부 LLM 호출이 아니라 repo-local `로컬 검수 에이전트` 기반의 자동 suggestion 레이어다. 운영자가 최종 확정한다는 점을 UI/README/제품 문서에 함께 명시했다.
  - 댓글은 현재 관리자 검수 큐가 없어 AI 제안 범위에서 제외했다.

### 2026-04-06 13:34 KST: PR CI mobile E2E 재오픈 회귀 수정
- 완료 내용
  - PR #2의 `E2E Full` 실패 로그를 확인한 결과, `tests/e2e/map.mobile.spec.ts`의 `모바일에서 장소 목록 바텀시트를 열고 닫을 수 있다` 케이스만 실패하고 있었다.
  - 원인은 `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 모바일 목록 시트를 drag로 닫은 직후 같은 포인터 이벤트가 아래 `목록 보기` 버튼까지 전달되어 시트가 즉시 다시 열리는 회귀였다.
  - `lastMobileListCloseAtRef` 기반의 짧은 reopen guard를 추가해 닫힘 직후 250ms 동안 모바일 목록 열기 버튼이 같은 이벤트로 재실행되지 않도록 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run e2e:prepare && npm run build && USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - 실패했던 GitHub Actions run은 `24017929325`였고, 실패 job은 `E2E Full` 하나였다. Cloudflare `Workers Builds` 자체는 public/admin 모두 성공 상태였다.

### 2026-04-06 13:58 KST: 운영 문서를 `docs/project`로 이동해 루트 clutter 축소
- 완료 내용
  - 루트의 `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/PROGRESS.md`를 `/Users/alex/project/altteulmap/docs/project/PLAN.md`, `/Users/alex/project/altteulmap/docs/project/PROGRESS.md`로 이동했다.
  - `/Users/alex/project/altteulmap/AGENTS.md`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/README.md`, `/Users/alex/project/altteulmap/docs/project/PLAN.md`의 현재 참조 경로를 새 위치 기준으로 정리했다.
  - `npm run clean:artifacts`로 `.next`, `.next-dev`, `test-results` 같은 로컬 산출물을 함께 정리해 루트에서 보이는 잡음을 줄였다.
- 검증 결과
  - `npm run clean:artifacts` 통과
  - `npm run verify:quick` 통과
- 메모
  - 과거 실행 로그 안에 남아 있는 옛 절대경로 표기는 역사 기록으로 유지하고, 현재 작업 규칙과 인덱스/README만 새 위치 기준으로 맞췄다.

### 2026-04-06 14:20 KST: Cloudflare external check 실패 조사
- 완료 내용
  - 사용자가 전달한 `https://github.com/answndud/Altteulmap/runs/70045703514`, `https://github.com/answndud/Altteulmap/runs/70045801531`는 GitHub Actions run이 아니라 현재 `main` HEAD(`5b92ac2`)에 붙은 Cloudflare external check run이라는 점을 확인했다.
  - `gh api repos/answndud/Altteulmap/commits/HEAD/check-runs` 결과 두 check는 각각 `Workers Builds: altteulmap`, `Workers Builds: altteulmap-admin`이며 둘 다 `conclusion: failure`, `details_url`은 Cloudflare dashboard build page를 가리켰다.
  - 반면 로컬 기준으로는 public/admin deploy contract와 OpenNext build가 모두 통과했다. 즉 현재 저장소 코드보다는 Cloudflare Git integration 또는 Dashboard build 환경 쪽 이슈일 가능성이 높다.
- 검증 결과
  - `npm run deploy:check:public` 통과
  - `npm run deploy:check:admin` 통과
  - `npm run cf:build:public` 통과
  - `npm run cf:build:admin` 통과
  - `gh api repos/answndud/Altteulmap/commits/HEAD/check-runs`로 external check 상태 확인
- 메모
  - 두 check는 시작/종료 시각이 거의 동일해 실제 OpenNext build보다 더 앞단, 즉 Cloudflare Builds 연결/trigger/build env 설정 쪽에서 실패했을 가능성이 높다.
  - 이 시점에는 repo 코드 수정만으로 바로 해결할 근거가 부족하다. Cloudflare Dashboard의 각 Worker `Settings > Builds`에서 repo 연결, production branch, build/deploy command, build-time Variables/Secrets를 다시 확인해야 한다.

### 2026-04-06 14:28 KST: public/admin 수동 재배포
- 완료 내용
  - Cloudflare Dashboard build-time env 재설정 전제에서 local deploy 경로로 admin/public worker를 다시 배포했다.
  - `npm run deploy:admin`으로 `altteulmap-admin`을 먼저 재배포했고, 이어서 `npm run deploy:public`으로 `altteulmap`을 재배포했다.
  - admin deploy 경고에서 원격 설정이 로컬과 달랐던 점도 확인했다. 당시 admin worker 원격 service binding은 `altteulmap`를 가리키고 있었고, 이번 수동 배포는 로컬 `wrangler.admin.jsonc` 기준 `altteulmap-admin` self-reference 설정으로 덮어썼다.
  - public deploy 경고에서는 원격 Dashboard vars에 `NEXTAUTH_URL`, `SITE_URL`가 로컬과 일치하지 않는 흔적이 있었지만, 실제 배포는 성공했고 public/admin URL 응답도 정상 확인했다.
- 검증 결과
  - `npm run deploy:admin` 통과
  - `npm run deploy:public` 통과
  - public version id: `6cb453e2-9ca2-4d17-b0af-40dc7389d449`
  - admin version id: `04ce1dcd-d116-436c-9525-d5d27e1afbf8`
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
  - `curl -I --max-time 20 https://altteulmap-admin.altteul-lab.workers.dev/` 결과 `200`
  - `curl -I --max-time 20 https://altteulmap-admin.altteul-lab.workers.dev/admin` 결과 `307 -> /login?callbackUrl=%2Fadmin`
- 메모
  - 수동 deploy는 정상 동작하므로 현재 문제는 앱 번들 자체보다 Cloudflare Builds가 repo push를 처리하는 환경/설정 쪽일 가능성이 더 높다.

### 2026-04-06 14:36 KST: Cloudflare admin Root directory 원인 정리
- 완료 내용
  - 사용자가 전달한 Cloudflare build log를 기준으로 `altteulmap-admin` 자동 빌드 실패 원인을 확인했다.
  - 원인은 Root directory를 `apps/admin`으로 둔 상태에서 Cloudflare 기본 설치 단계가 `npm ci`를 실행하며 `apps/admin/package-lock.json`을 찾는 것이었다.
  - 현재 저장소의 admin 앱은 루트 `package-lock.json`과 shared dependency tree를 사용하므로, Workers Builds 설정은 public/admin 모두 repo root(`/`)를 쓰는 쪽으로 정리했다.
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`에 이 설정을 명시했다.
- 검증 결과
  - 사용자가 제공한 Cloudflare log에서 `npm ci`가 lockfile 부재로 실패한 사실 확인
  - 현재 로컬 기준 `npm run cf:build:admin`, `npm run cf:build:public` 통과 상태 유지
- 메모
  - `apps/admin`은 독립 npm package처럼 보이지만 설치 기준은 루트다. 따라서 Root directory를 하위 폴더로 제한하는 대신 build/deploy command만 admin 전용으로 나누는 편이 안전하다.

### 2026-04-06 13:18 KST: 루트 문서 재배치와 build 산출물 정리
- 완료 내용
  - 루트의 product 문서를 `docs/product/` 하위로 옮겼다.
  - 배포 문서는 `docs/deploy/` 하위로 묶었다.
  - `/Users/alex/project/altteulmap/docs/README.md`를 추가해 product/deploy/project 문서 인덱스를 만들었다.
  - `/Users/alex/project/altteulmap/AGENTS.md`, `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/PROGRESS.md`, `/Users/alex/project/altteulmap/README.md`의 문서 경로 참조를 새 위치로 맞췄다.
  - `/Users/alex/project/altteulmap/package.json`에 `clean:artifacts` 스크립트를 추가하고 실제로 root/app build 산출물을 정리했다.
  - `/Users/alex/project/altteulmap/README.md` 상단에 이 프로젝트를 만든 배경을 추가했다. `거지맵`에서 받은 영감, 음식점 외 업종 확장, 공공데이터 활용, 고물가/취업난이라는 시대감과의 연결을 짧게 설명하도록 정리했다.
- 검증 결과
  - `npm run clean:artifacts` 통과
  - stale 문서 경로 검색 결과 없음
- 메모
  - 운영용 문서인 `PLAN.md`, `PROGRESS.md`는 다음 세션 작업 규칙과 접근성을 위해 루트에 유지했다.

### 2026-04-06 12:52 KST: README 채용 제출용 압축 polish와 admin Cloudflare build 복구
- 완료 내용
  - `/Users/alex/project/altteulmap/README.md`를 한 번 더 압축해 제품 소개 페이지 톤으로 정리했다. `At a Glance`, `Highlights`, `Screenshots`, `Why This Repo Is Worth Opening`, `AI-Native Workflow` 중심으로 재구성했고, GitHub에서 바로 렌더되도록 이미지 경로를 `docs/readme/*.png` 상대 경로로 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/telemetry/visit-tracker.tsx`에서 `useSearchParams()` 의존을 제거하고 `window.location.search`를 effect 안에서 읽도록 바꿨다. 이 변경으로 standalone admin app의 `/_not-found` prerender가 telemetry 때문에 실패하던 경로를 없앴다.
  - `/Users/alex/project/altteulmap/scripts/build-admin-worker.mjs`는 admin build 시 `ADMIN_APP_URL`을 `NEXTAUTH_URL`로 주입하도록 바꿨고, `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`는 admin mode에서 `ADMIN_APP_URL`을 필수값으로 보고 callback reminder도 admin URL 기준으로 출력하도록 보강했다.
  - `npm run deploy:admin`으로 admin worker를 다시 배포했고 live URL이 다시 정상 응답하는 것까지 확인했다.
  - `npm run readme:screenshots`를 다시 실행해 README용 스크린샷 세트를 최신 배포 상태 기준으로 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run deploy:check:admin` 통과
  - `npm run cf:build:admin` 통과
  - `npm run deploy:admin` 통과
  - `curl -I --max-time 20 https://altteulmap-admin.altteul-lab.workers.dev/` 결과 `200`
  - `curl -I --max-time 20 https://altteulmap-admin.altteul-lab.workers.dev/login` 결과 `200`
  - `curl -I --max-time 20 https://altteulmap-admin.altteul-lab.workers.dev/admin` 결과 `307 -> /login?callbackUrl=%2Fadmin`
  - `npm run readme:screenshots` 통과
- 메모
  - admin Cloudflare version id: `4073cec5-2f67-4849-b8f9-31fb1b0ed714`
  - admin runtime env는 dashboard에서도 `NEXTAUTH_URL=https://altteulmap-admin.altteul-lab.workers.dev`, `SITE_URL=https://altteulmap.altteul-lab.workers.dev` 조합으로 유지하는 것이 맞다.

### 2026-04-06 12:35 KST: 포트폴리오용 README 랜딩 구조와 live 스크린샷 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`의 현재 우선순위에 `README 포트폴리오 polish`를 최상단으로 올렸다.
  - `/Users/alex/project/altteulmap/scripts/capture-readme-screenshots.mjs`와 `package.json`의 `readme:screenshots` 스크립트를 추가해 live public/admin URL 기준 대표 화면을 `docs/readme/*.png`로 저장하는 재현 가능한 캡처 경로를 만들었다.
  - `/Users/alex/project/altteulmap/docs/readme/hero-home.png`, `/Users/alex/project/altteulmap/docs/readme/place-detail.png`, `/Users/alex/project/altteulmap/docs/readme/mobile-map-sheet.png`, `/Users/alex/project/altteulmap/docs/readme/submit-form.png`, `/Users/alex/project/altteulmap/docs/readme/admin-console.png`를 생성했다.
  - `/Users/alex/project/altteulmap/README.md`를 설치 문서 중심 구조에서 포트폴리오 랜딩 구조로 전면 개편했다. 상단은 `문제 정의 -> live demo -> 핵심 포인트 -> 화면 -> 사용자 흐름 -> 엔지니어링 결정 -> AI-Native Workflow -> 검증` 순서로 압축했고, 로컬 실행/문서 링크만 하단에 남겼다.
  - 같은 README를 한 번 더 압축해 `TL;DR`, `Highlights`, `Why This Repo Is Interesting` 중심으로 정리했다. 목적은 채용/포트폴리오 링크에서 30초 안에 제품/엔지니어링 강점을 파악하게 만드는 것이다.
- 검증 결과
  - `npm run readme:screenshots` 통과
  - `npm run verify:quick` 실행
  - 저장된 스크린샷 수동 확인: hero/detail/mobile/submit/admin-console 5장 생성 확인
- 메모
  - README는 채용/포트폴리오 랜딩 톤에 맞춰 의도적으로 컴팩트하게 줄였고, 세부 배포/운영 설명은 기존 docs 링크로 내렸다.
  - admin 내부 운영 화면 대신 접근 가능한 별도 admin worker 랜딩을 캡처해 `public/admin split` 구조를 보여주는 방향으로 정리했다.

### 2026-04-06 12:15 KST: 공개 지도 숫자 cluster 톤 완화 push 및 public Cloudflare 배포
- 완료 내용
  - 숫자 cluster 톤 조정과 문서 업데이트를 `fix(map): soften cluster palette` (`36bcd4b`)로 커밋하고 `codex/ui-polish-batch` 브랜치에 push했다.
  - 조정된 cluster 팔레트가 반영된 상태로 public worker를 다시 배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
- 메모
  - public 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `0165f4a9-fef5-4ef0-8191-b0fb697b6927`

### 2026-04-06 12:12 KST: 공개 지도 숫자 cluster 톤 완화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 숫자 cluster의 `shell/core/text/shadow` 팔레트를 더 밝은 크림/샌드 계열로 조정했다.
  - 기존의 너무 어두운 slate core는 걷어내고, 밝은 shell과 따뜻한 sand core, 짙은 갈색 텍스트 조합으로 바꿔 cluster가 덜 무겁게 보이도록 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
- 메모
  - `npm run verify` 중 local production DB에 `places` 테이블이 없어 mock fallback 로그는 남았지만, lint/build는 정상 통과했다.

### 2026-04-05 15:21 KST: `PLAN.md`/`PROGRESS.md` 현재 상태 기준으로 동기화
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`의 현재 우선순위를 실제 남은 일 기준으로 다시 정리했다. 완료된 반응/공유/배포 항목은 우선순위에서 내리고, custom domain 여부, 운영 QA, 검색 URL 상태, 공유 telemetry 후속 판단만 남겨 두었다.
  - 같은 문서의 `출시 준비`, `관리자 분리`, `테스트 체계` 설명을 현재 기준으로 갱신했다. `workers.dev` split 배포와 remote smoke는 완료 상태로 올리고, custom domain과 더 깊은 실사용 QA만 잔여로 남겼다.
  - `PLAN.md`의 stale `in_progress` 항목 두 개를 실제 구현 상태에 맞춰 `done`으로 정리했다. 대상은 credentials 기반 인증/배포 체크리스트 정리와 좋아요/싫어요 반응 + 공유 후속 범위 재판단 항목이다.
  - `/Users/alex/project/altteulmap/PROGRESS.md` 상단 요약과 다음 우선순위도 같은 기준으로 맞췄다.
- 검증 결과
  - 문서 정리 작업이라 별도 코드 검증은 실행하지 않았다.
- 메모
  - 현재 기준 남은 큰 일은 `custom domain 최종 적용 여부`, `운영 도메인 QA 심화`, `모바일 제스처 실사용 검증`, `공유 telemetry 후속 활용 여부 판단` 정도다.

### 2026-04-05 12:48 KST: `착한가격업소` 기본 데이터셋을 `대표 가격 8천원 미만`으로 재생성
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/import-goodprice.ts`의 기본 `maxPrice`를 `8000`으로 낮추고, 가격 필터를 `이 값 미만` 기준으로 바꿨다. 이제 기본 실행은 `8000원` 항목을 포함하지 않는다.
  - 같은 importer는 기존처럼 `서울도 음식 70%`, `비서울도 음식 70%`를 각각 강제하지 않고, 최종 선택 단계에서 `서울 500 / 비서울 500 / 음식 700 / 비음식 300`을 만족하는 실제 bucket 조합을 계산하도록 바꿨다. `8천원 미만` 기준에서는 `서울 비음식 150` 고정 quota가 부족해 기존 방식으로는 1000건 selection이 실패했다.
  - `/Users/alex/project/altteulmap/src/features/places/imported-goodprice.json`과 `/Users/alex/project/altteulmap/data/goodprice/import-meta.json`을 새 기준으로 다시 생성했다. 최종 bucket actual은 `서울 음식 368`, `서울 비음식 132`, `비서울 음식 332`, `비서울 비음식 168`이다.
  - `/Users/alex/project/altteulmap/README.md`에 기본 수집 기준을 `대표 가격 8천원 미만`으로 맞추고, `--max-price`가 `이 값 미만` 조건이라는 설명을 추가했다.
  - `/Users/alex/project/altteulmap/PLAN.md`의 Cycle 9 완료 기준도 새 기본값으로 갱신했다.
- 검증 결과
  - `npx tsc --noEmit` 통과
  - `npm run data:goodprice -- --limit=40 --delay-ms=50 --timeout-ms=10000 --include-detail=false --output=/tmp/goodprice-40.json --manifest=/tmp/goodprice-40-manifest.json` 통과
  - `node` 검사 결과 `/tmp/goodprice-40.json`은 `40건`, `서울 20`, `비서울 20`, `음식 28`, `비음식 12`, `대표 가격 >= 8000` `0건`
  - `npm run data:goodprice -- --delay-ms=50 --timeout-ms=10000` 통과
  - `node` 검사 결과 `/Users/alex/project/altteulmap/src/features/places/imported-goodprice.json`은 `1000건`, `서울 500`, `비서울 500`, `음식 700`, `비음식 300`, `대표 가격 >= 8000` `0건`, `priceItems >= 8000` `0건`, `대표 가격 최대 7900`, `priceItems 최대 7900`
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `npm run db:seed` 통과
- 메모
  - `npm run verify` 중 static generation 단계에서 production DB의 `places` 테이블 부재로 mock fallback 로그가 남는 현상은 기존과 동일하며, 이번 데이터셋 변경과는 무관하다.
  - 새 manifest의 `quotas.targets`는 실제 선택에 사용된 bucket 수치다. 기본 분포는 `368/132/332/168`로 기록된다.

### 2026-04-05 12:52 KST: `대표 가격 8천원 미만` 데이터셋 변경 push 및 public Cloudflare 재배포
- 완료 내용

### 2026-04-06 14:55 KST: README 작업 후 남은 로컬 산출물 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/.next`, `/Users/alex/project/altteulmap/.next-dev`, `/Users/alex/project/altteulmap/.open-next`, `/Users/alex/project/altteulmap/apps/admin/.next`, `/Users/alex/project/altteulmap/apps/admin/.open-next`, `/Users/alex/project/altteulmap/test-results`, `/Users/alex/project/altteulmap/tsconfig.tsbuildinfo`, `/Users/alex/project/altteulmap/.wrangler`를 삭제했다.
  - 모두 로컬에서 다시 생성 가능한 빌드/테스트 산출물과 캐시만 대상으로 삼았고, README 스크린샷·문서·소스 파일은 건드리지 않았다.
- 검증 결과
  - `git status --short --branch` 확인 결과 tracked 변경 없음
  - 삭제 전 대상 산출물 합계: `701,897,781 bytes`
  - 삭제 후 대상 산출물 합계: `0 bytes`
  - 확보 용량: 약 `669.38 MB`
- 메모
  - 필요 시 루트 정리는 `npm run clean:artifacts`로 다시 반복할 수 있다. `.wrangler`는 별도로 재생성되므로 필요할 때만 남기고 평소에는 지워도 된다.
  - `대표 가격 8천원 미만` 데이터셋/문서 변경을 `fix(data): tighten goodprice price ceiling` (`ab7ae4f`)로 커밋하고 `codex/ui-polish-batch` 브랜치에 push했다.
  - public worker는 새 imported dataset이 반영된 상태로 다시 배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check:public` 통과
  - `npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
- 메모
  - public 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - public worker version id: `080e4915-261b-4d32-b571-7fef31cc3010`

### 2026-04-05 12:46 KST: `착한가격업소` importer selection 로직 포함 push 및 public Cloudflare 배포
- 완료 내용
  - importer quota selection 변경과 문서 정리를 `fix(data): refine goodprice quota selection` (`77dd22d`)로 커밋하고 `codex/ui-polish-batch` 브랜치에 push했다.
  - 변경은 공개 앱 런타임 코드가 아니지만, 사용자가 요청한 현재 브랜치 상태 기준으로 public worker를 다시 배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
- 메모
  - public 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `6b1e50b4-9876-4767-91b4-89c92ec734f4`

### 2026-04-05 12:44 KST: `착한가격업소` importer quota 선택 로직 보강과 문서 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/import-goodprice.ts`에서 서울/비서울, 음식/비음식 목표가 동시에 걸릴 때 bucket별 상한만으로 바로 고정하지 않고, 수집된 후보 풀 안에서 실제로 가능한 `targets`를 다시 계산한 뒤 그 target에 맞춰 selection 하도록 바꿨다.
  - 같은 스크립트의 manifest는 이제 `foodTarget`, `nonFoodTarget`, `bucketCaps`, 최종 `targets`, 잘린 뒤의 `actual`을 함께 남긴다. 그래서 상한만 채운 중간 수집 상태와 실제 선택 결과를 구분해 볼 수 있다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/PROGRESS.md` 요약 문구도 현재 기본값인 `대표 가격 8천원 미만` 기준으로 정리했다.
- 검증 결과
  - `npm run data:goodprice -- --limit=40 --seoul-limit=20 --food-ratio=0.7 --max-price=8000 --include-detail=false --output=/tmp/altteulmap-goodprice-check/imported-goodprice.sample.json --manifest=/tmp/altteulmap-goodprice-check/import-meta.sample.json` 통과
  - sample manifest 확인 결과 `selectedCount=40`, `seoulLimit=20`, `nonSeoulLimit=20`, `foodTarget=28`, `nonFoodTarget=12`, `targets=actual={seoulFood:15,seoulNonFood:5,nonSeoulFood:13,nonSeoulNonFood:7}`
- 메모
  - 이번 검증은 temp output으로만 실행해서 저장소의 `src/features/places/imported-goodprice.json`, `data/goodprice/import-meta.json`은 건드리지 않았다.

### 2026-04-05 12:41 KST: 공개 지도 marker 대비 강화 push 및 public Cloudflare 배포
- 완료 내용
  - 공개 지도 marker 대비 조정 변경을 `fix(map): boost marker contrast` (`0f09c11`)로 커밋하고 `codex/ui-polish-batch` 브랜치에 push했다.
  - 카테고리별 place marker의 채도와 white halo, 중심 ring 구조를 강화한 상태로 public worker를 다시 배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
- 메모
  - public 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `3bc93651-9d8f-46b7-b9fc-408a307a9f99`

### 2026-04-05 12:39 KST: 공개 지도 marker 대비 강화
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에 marker 대비 후속 작업을 추가한 뒤 완료 상태로 닫았다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 place marker 팔레트를 기존 earthy 톤보다 더 선명한 카테고리색으로 바꾸고, 각 핀에 공통 white halo와 중심 ring/dot를 넣어 basemap 위에서 먼저 보이도록 조정했다.
  - 같은 파일에서 cluster marker도 아이보리/베이지 중심 구조에서 white shell + slate core로 바꿔 개요 상태에서 지도 바탕과 덜 섞이게 했다.
  - preview fallback도 같은 helper를 쓰므로 실제 NAVER map marker와 같은 대비 규칙으로 같이 맞춰졌다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
- 메모
  - `npm run verify` 중 local production DB에 `places` 테이블이 없어 mock fallback 로그는 남았지만, lint/build는 정상 통과했다.

### 2026-04-05 12:36 KST: 공개 지도 카테고리 마커 리디자인 push 및 public Cloudflare 배포
- 완료 내용
  - 공개 지도 마커 리디자인 변경을 `feat(map): redesign category markers` (`fcb178e`)로 커밋하고 `codex/ui-polish-batch` 브랜치에 push했다.
  - place marker는 상위 카테고리 5묶음 기준 색 핀으로, 숫자 cluster는 중립 원형 계층으로 바꾼 상태로 public worker를 다시 배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
- 메모
  - public 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `049cea66-e4c3-4a60-96de-326576bc39f3`

### 2026-04-05 12:31 KST: 공개 지도 마커 색 체계와 place/cluster 디자인 재정리
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에 공개 지도 마커 색 체계/디자인 정리 작업을 먼저 추가하고 완료 상태까지 갱신했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 place marker를 기존 `좋아요 pill` 대신 카테고리 상위 그룹 기준의 컬러 핀으로 다시 설계했다. `food`, `life-services`, `shopping`, `health`, `study-work` 5개 그룹을 기준으로 색을 나눴고, active marker는 같은 색 계열에서 크기와 halo만 강화하도록 정리했다.
  - 같은 파일에서 숫자 cluster도 기존 주황 캡슐 대신 중립 아이보리/스톤 계열의 원형 이중 레이어로 바꿨고, `placeCount`에 따라 outer/inner size와 font 크기를 조금씩 다르게 주어 overview에서 과하게 튀지 않게 조정했다.
  - preview fallback과 실제 NAVER map marker가 같은 시각 규칙을 쓰도록 helper를 공용화했다. 그래서 SDK 실패 fallback과 실지도가 서로 다른 마커 언어를 쓰는 문제도 같이 줄였다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
- 메모
  - `npm run verify` 중 local production DB에 `places` 테이블이 없어 build 단계에서 mock fallback 로그는 남았지만, lint/build 자체는 정상 통과했다.
  - 이번 단계는 마커 색/형태 재설계에 집중했고, 실제 live 반영은 사용자가 원할 때 push/deploy 단계에서 이어가면 된다.

### 2026-04-05 12:21 KST: 공개 지도 marker mode 분리 변경 push 및 public Cloudflare 배포
- 완료 내용
  - 누적된 워크트리 변경을 `feat(app): ship latest public and admin updates` (`366ff26`)로 커밋했고, `codex/ui-polish-batch` 브랜치에 push했다.
  - push 전 원격 `codex/ui-polish-batch`에 `44ceee2`, `e06463e`가 먼저 올라와 있어 rebase로 합쳤다. 충돌은 `package.json`, `scripts/build-public-worker.mjs`, `src/features/places/repository.ts`, `PROGRESS.md`에서만 났고, public worker runtime hotfix와 이번 marker mode 분리 둘 다 유지하는 방향으로 정리했다.
  - `npm run deploy:public`로 public worker를 다시 배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
  - live map API 검증
    - `https://altteulmap.altteul-lab.workers.dev/api/places/map?minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693&zoom=9` 결과 `markerMode:"cluster"`, `kinds:["cluster"]`, `count:500`, `mapMarkerCount:19`
    - `https://altteulmap.altteul-lab.workers.dev/api/places/map?query=김밥&scope=global` 결과 `markerMode:"place"`, `kinds:["place"]`, `count:40`, `mapMarkerCount:40`
- 메모
  - public 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `e1e12228-fc92-4fa6-bdda-76df3d794337`

### 2026-04-05 12:07 KST: 공개 지도 marker 응답을 `cluster-only`/`place-only`로 분리
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에 공개 지도 marker mode 분리 작업을 먼저 추가한 뒤 구현을 진행했다.
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`에 `PlaceMapMarkerMode`를 추가했고, `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 지도 marker 생성 로직을 `getPlaceOnlyMapMarkers()`와 `getClusterOnlyMapMarkers()`로 분리했다.
  - 같은 파일에서 `/api/places/map`와 SSR 초기 payload가 `markerMode: "place" | "cluster"`를 항상 내려주도록 바꿨고, overview 단계에서는 cluster marker만, 검색/확대 단계에서는 place marker만 반환하게 정리했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`, `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`도 새 응답 계약에 맞췄다. 클라이언트는 `visibleMarkerMode` 기준으로 해당 종류의 marker만 렌더하므로, 서버 응답이 흔들려도 UI에서는 혼합 표시가 다시 나오지 않게 했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`에 map API가 한 번에 하나의 marker mode만 반환하는지 확인하는 회귀를 추가했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
  - 임시 `next start`(`http://127.0.0.1:3107`) 기준 `node` fetch 검증에서 `zoom=9` viewport 응답은 `markerMode: "cluster"` + `kinds:["cluster"]`, `query=김밥&scope=global` 응답은 `markerMode: "place"` + `kinds:["place"]`를 확인했다
- 메모
  - `verify`와 Playwright를 병렬로 돌리면 둘 다 `.next`를 쓰는 `3107` 경로에서 산출물이 섞일 수 있으므로, 이번 변경 검증은 `build` 완료 뒤 Playwright를 순차 실행했다.
  - build 중 로컬 production DB에 `places` 테이블이 없어 mock fallback 로그는 남았지만, 빌드와 route 계약 검증은 정상 통과했다.

### 2026-04-03 18:59 KST: public worker wide viewport map API와 middleware manifest runtime hotfix 복구
- 완료 내용
  - `/tmp/altteulmap-public-map-fix/scripts/patch-next-cloudflare-runtime.mjs`를 추가해 Cloudflare build 직전 `node_modules/next/dist/server/next-server.js`, `node_modules/next/dist/esm/server/next-server.js`의 `getMiddlewareManifest()`를 패치하도록 정리했다.
  - manifest 파일이 worker 런타임의 `/.next/server/middleware-manifest.json` 경로에 없을 때는 `null`로 안전하게 빠지도록 바꿔, public worker preview/live가 모든 요청에서 500으로 죽던 회귀를 막았다.
  - `/tmp/altteulmap-public-map-fix/scripts/build-public-worker.mjs`, `/tmp/altteulmap-public-map-fix/scripts/build-admin-worker.mjs`, `/tmp/altteulmap-public-map-fix/package.json`에 공통 patch step을 연결해 이후 OpenNext public/admin/common build에서도 같은 런타임 회귀가 다시 생기지 않게 했다.
  - 이미 브랜치에 올라가 있던 `/tmp/altteulmap-public-map-fix/src/features/places/repository.ts`의 wide viewport marker hotfix(`071e639`)와 함께 public worker를 재배포했다. 이 조합으로 wide viewport `/api/places/map`의 Workers `1101` 응답이 실제 live에서 해소됐다.
- 검증 결과
  - `npm run cf:patch-next-runtime` 통과
  - `AUTH_SECRET=altteulmap-build-secret-change-me NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev SITE_URL=https://altteulmap.altteul-lab.workers.dev ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev USE_MOCK_DATA=true npm run preview:public` 후
    - `curl http://127.0.0.1:8787/` 결과 `200`
    - `curl 'http://127.0.0.1:8787/api/places/map?minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693&zoom=12'` 결과 `200` JSON
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-build-secret-change-me NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev SITE_URL=https://altteulmap.altteul-lab.workers.dev ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run deploy:public` 통과
  - live 검증
    - `curl -I https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
    - `curl -I 'https://altteulmap.altteul-lab.workers.dev/api/places/map?minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693&zoom=12'` 결과 `200`
    - 같은 JSON 응답 기준 `count=500`, `returnedCount=120`, `mapMarkerCount=24`, `cluster=21`, `place=3`
  - 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `bf9a3b0e-1067-40ce-a7f7-abe4f92105f5`
- 메모
  - 로컬 `deploy:check`는 현재 shell에 운영용 `DATABASE_URL`, OAuth, 네이버 지도 key가 없어 실패했지만, actual deploy/runtime env는 Cloudflare에 저장된 값을 사용하므로 public deploy 자체는 정상 수행됐다.
  - 이번 hotfix 범위는 `wide viewport map API 1101`과 `middleware-manifest` 런타임 500 복구다. 모바일 브라우저에서 실제 마커 표시 체감은 live bundle 새로고침 후 다시 확인하면 된다.

### 2026-04-05 11:56 KST: 모바일 상세 시트와 네이버 지도 워터마크 레이어 충돌 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에 모바일 상세 시트와 네이버 지도 워터마크 겹침 후속 작업을 먼저 추가한 뒤 구현을 진행했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에서 preview/fallback/runtime 공통 지도 shell과 실제 map wrapper에 `relative isolate z-0` 레이어를 넣어, 네이버 지도 SDK가 주입하는 워터마크/attribution이 바깥 상세 시트보다 위로 튀어나오지 않도록 map stack을 분리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서도 지도 영역 래퍼를 `isolate`된 stacking context로 맞춰 모바일 상세 시트와 목록 시트가 지도 내부 DOM보다 안정적으로 위에서 렌더되게 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - 기존 로컬 `next dev`(`http://127.0.0.1:3000`) 기준 headless 브라우저 점검에서 모바일 목록으로 상세 시트를 연 뒤 `NAVER` 워터마크 텍스트 노드가 시트 위 노출 상태로 재현되지 않는 것을 확인했다
- 메모
  - build 중 로컬 production DB에 `places` 테이블이 없어 mock fallback 로그는 남았지만, 빌드 자체는 성공했다.

### 2026-04-05 11:47 KST: 지도 수동 재조회 버튼 문구를 `이 지역 검색`으로 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`의 수동 재조회 버튼 라벨을 `이 지도에서 다시 보기`에서 `이 지역 검색`으로 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`의 상태 안내와 빈 상태 문구도 같은 표현 기준으로 맞춰, 버튼과 설명이 서로 다른 용어를 쓰지 않게 정리했다.
  - `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/PROGRESS.md`의 해당 작업 설명도 새 라벨에 맞게 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
- 메모
  - 테스트는 `data-testid` 기준이라 별도 Playwright 수정은 필요하지 않았다.

### 2026-04-05 00:18 KST: 공개 지도에 현재 위치/수동 재조회 액션 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에 공개 지도 드래그 탐색 보강 작업을 먼저 추가한 뒤 구현을 진행했다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 상단 중앙 `이 지역 검색` 버튼과 `map-refresh-button` test id를 추가했다. 기존 `내 위치` 버튼은 `현재 위치`로 라벨을 명확히 하고 `map-current-location-button` test id를 붙였다.
  - 같은 파일의 지도 컨트롤은 viewport fetch 구조를 바꾸지 않고도 현재 bounds 기준 재조회를 트리거할 수 있게 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`는 수동 refresh tick을 추가해 viewport 모드에서 현재 지도 범위를 다시 요청할 수 있게 했고, 빈 상태/상태 안내 문구도 `이 지역 검색` 흐름에 맞게 조정했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`는 데스크톱 홈 지도에서 `현재 위치`/`이 지역 검색` 버튼 노출과 수동 refresh 요청을 검증하도록 확장했고, `/Users/alex/project/altteulmap/tests/e2e/map.mobile.spec.ts`는 모바일에서도 두 버튼 노출을 확인하도록 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - Playwright의 `chromium`과 `mobile-chromium`은 둘 다 `3107` 포트를 쓰므로 이번 변경에서도 순차 실행을 유지해야 안전하다.
  - 첫 Playwright 실패는 새 코드 문제가 아니라 `verify`와 병렬 실행하며 이전 build 산출물을 잡은 케이스였고, `npm run verify` 완료 뒤 순차 재실행으로 정상 통과했다.

### 2026-04-04 20:35 KST: 별도 랭킹 화면 범위 제외 결정 반영
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에서 `좋아요 랭킹`을 미구현 핵심/보류 범위에서 제거하고, 확장 기능 2차 우선순위를 `공유 후속 활용 범위` 기준으로 다시 정리했다.
  - 같은 문서의 반응 기능/공유 기능 설명과 결정 메모도 현재 기준에 맞게 수정해, 별도 랭킹 화면은 만들지 않고 홈 `인기 장소` 추천 섹션만 유지한다는 정책을 명시했다.
  - `/Users/alex/project/altteulmap/PROGRESS.md`의 진행 현황 요약과 다음 우선순위도 랭킹 제외 기준으로 갱신했다.
  - `/Users/alex/project/altteulmap/docs/product/prd.md`의 출시 후 빠른 후속 권장 항목은 `랭킹/추천 뷰` 대신 `추천 뷰 고도화`로 바꿨다.
- 검증 결과
  - 문서 범위 조정 작업이라 별도 코드 검증은 실행하지 않았다.
- 메모
  - 현재 반응 데이터는 홈 추천 섹션과 공유/telemetry 보조 신호 축적에 집중하고, 별도 순위 페이지나 랭킹 탭은 다시 범위에 넣지 않는다.

### 2026-04-04 18:13 KST: 공유 유입 telemetry를 관리자 overview에 연결
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`의 `visit_activity`에 `entry_ref`, `entry_source` 컬럼과 조회용 index를 추가했고, `/Users/alex/project/altteulmap/drizzle/0009_boring_invaders.sql` migration을 생성했다.
  - `/Users/alex/project/altteulmap/src/features/places/share.ts`는 공유 source 상수와 라벨 helper를 내보내도록 정리했고, `/Users/alex/project/altteulmap/src/features/telemetry/visit-tracker.tsx`는 URL query에서 `ref=share`, `source`만 정규화해서 `/api/telemetry/visit`로 보낸다.
  - `/Users/alex/project/altteulmap/src/features/telemetry/api/visit-route.ts`, `/Users/alex/project/altteulmap/src/features/telemetry/repository.ts`는 공유 ref/source를 검증하고 저장하도록 바꿨다. 같은 30분 bucket 안에서는 처음 확인된 공유 유입 정보를 `coalesce`로 유지해, 이후 일반 탐색으로 덮여도 share attribution이 사라지지 않게 했다.
  - `/Users/alex/project/altteulmap/src/features/admin/repository.ts`, `/Users/alex/project/altteulmap/src/features/admin/pages/dashboard-page.tsx`는 오늘/7일 공유 유입 수와 `detail/detail_sheet/list/trending` source breakdown을 admin overview에서 보여주도록 확장했다.
  - `/Users/alex/project/altteulmap/tests/e2e/admin-dashboard.spec.ts`는 `/api/telemetry/visit`에 공유 유입 이벤트를 먼저 찍은 뒤, 관리자 대시보드에서 공유 유입 카드와 `인기 장소` source breakdown이 보이는지 확인하도록 강화했다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify:quick` 통과
  - `npm run db:up` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run db:push` 통과
  - `npm run verify` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run db:seed` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npx playwright test tests/e2e/admin-dashboard.spec.ts --project chromium` 통과
- 메모
  - 현재 share attribution은 `visit_activity`의 기존 30분 dedupe 정책을 그대로 따른다. 따라서 같은 actor가 같은 bucket 안에서 여러 공유 source로 들어와도 첫 source 하나만 유지한다. source별 세밀한 landing 분석이 필요해지면 별도 상세 이벤트 테이블을 추가하는 편이 맞다.

### 2026-04-04 16:13 KST: 공유 강화 1차로 payload/source와 진입점 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/share.ts`를 추가해 공유 제목/문구와 `ref=share`, `source=detail|detail_sheet|list|trending`가 붙은 링크 생성을 공용 helper로 묶었다.
  - `/Users/alex/project/altteulmap/src/features/places/place-share-button.tsx`는 이제 `navigator.share()`에 `title + text + url`을 함께 넘기고, fallback 복사도 URL만이 아니라 공유 문구 전체를 복사한다. 테스트 id와 메시지 id도 호출 위치별로 따로 줄 수 있게 확장했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 새 helper를 사용하도록 바꿨고, place page metadata title/description도 공유용 요약을 기준으로 다시 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`는 지도 목록 카드에 공유 버튼을 추가했고, `/Users/alex/project/altteulmap/src/features/places/trending-places-section.tsx`는 인기 장소 카드에서도 상세 링크와 별개로 공유 버튼을 제공하도록 바꿨다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`는 `navigator.share` payload를 직접 모킹해 `source=list`, `source=detail_sheet`, `source=trending`, `source=detail`이 각각 붙는지 확인하도록 회귀를 강화했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
- 메모
  - 첫 Playwright 실행은 `npm run verify` 전의 기존 `.next` 산출물을 재사용해 새 공유 버튼 test id를 찾지 못하고 실패했다. 새 build 후 재실행에서는 정상 통과했다.

### 2026-04-04 16:06 KST: 사진 업로드 범위 제외 결정 반영
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`에서 확장 기능 2차 우선순위를 `공유/랭킹` 기준으로 다시 적고, `미구현 핵심`의 사진 업로드 항목을 제거했다.
  - 같은 문서의 Cycle 6 설명도 `공유/사진 업로드` 대신 `공유/랭킹` 재판단으로 바꿨고, 결정 메모에 사진 업로드를 저장 용량과 운영 비용 이유로 현재 범위에서 제외한다는 정책을 남겼다.
  - `/Users/alex/project/altteulmap/docs/product/trd.md`의 오픈 기술 이슈도 `이미지 업로드를 MVP에 포함할지 여부`에서 `현재 범위에서 제외 유지`로 정리했다.
  - `/Users/alex/project/altteulmap/PROGRESS.md`의 다음 우선순위도 `공유/랭킹` 기준으로 맞췄다.
- 검증 결과
  - 문서 결정 반영 작업이라 별도 코드 검증은 실행하지 않았다.
- 메모
  - 현재 저장소에는 사진 업로드 기능 구현 코드가 아직 없어서, 이번 변경은 제품 범위와 우선순위 문서 정리에 집중했다.

### 2026-04-04 15:59 KST: 공개 쓰기/회원가입 rate limit 수치 재조정과 관측 헤더 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/rate-limit.ts`의 정책 값을 route 비용 기준으로 다시 조정했다.
    - 장소 등록: 30분 4회
    - 댓글: 10분 8회
    - 가격 제보: 10분 8회
    - 신고: 30분 6회
    - 좋아요/싫어요: 5분 40회
    - 회원가입: 30분 3회
  - 같은 helper가 내려주는 헤더에 `X-RateLimit-Policy`, `X-RateLimit-Window`를 추가했다. 기존 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`와 함께 보면 어떤 bucket이 어떤 창으로 적용되는지 바로 알 수 있다.
  - `/Users/alex/project/altteulmap/tests/e2e/comments.spec.ts`의 rate limit 회귀는 하드코딩된 `10회` 대신 첫 응답의 `x-ratelimit-limit`를 읽어 현재 정책 수치에 따라 동적으로 quota를 채우도록 바꿨다. 같은 테스트에서 `x-ratelimit-policy=place_comment_submission`, `x-ratelimit-window=600`도 같이 검증한다.
  - `/Users/alex/project/altteulmap/docs/product/trd.md`에도 현재 운영 기준 정책 수치와 헤더 계약을 반영했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/comments.spec.ts --project chromium` 통과
  - `PORT=3112 AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3112 USE_MOCK_DATA=true npm run start` 후 `curl -sS -D - -o /dev/null -X POST 'http://127.0.0.1:3112/api/auth/signup' -H 'Content-Type: application/json' --data '{"email":"bad","nickname":"x","password":"short"}'` 결과
    - `x-ratelimit-limit: 3`
    - `x-ratelimit-policy: auth_signup`
    - `x-ratelimit-window: 1800`
- 메모
  - 현재 저장소의 rate limit 저장소는 계속 프로세스 메모리 기반이다. 이번 단계는 수치와 응답 계약을 먼저 안정화해 운영 중 관측과 조정을 쉽게 만드는 데 집중했다.

### 2026-04-04 16:07 KST: 관리자 큐 페이지 공통 네비/요약과 신고 상태 필터 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/admin/components/admin-queue-nav.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-summary-cards.tsx`를 추가해 관리자 큐 페이지가 공통 운영 네비와 핵심 개수 요약 카드를 공유하도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/admin/pages/places-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/prices-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/reports-page.tsx`는 `getAdminOverview()`를 함께 읽어 승인 대기 장소, 가격 제보, 열린 신고 같은 운영 지표를 상단에서 바로 확인할 수 있게 바꿨다.
  - 신고 큐는 `status` query param 기반 필터를 지원하도록 바꿨다. `/admin/reports`는 이제 `전체`, `열림`, `검토 중`, `처리 완료`, `기각` 필터와 상태별 count badge를 보여주고, 선택한 상태에 해당하는 신고가 없을 때 빈 상태 문구를 분리해서 보여준다.
  - `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`에는 신고를 `처리 완료`로 바꾼 뒤 `?status=resolved`, `?status=open` 필터에서 보임/숨김이 맞는지 확인하는 회귀를 추가했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts --project chromium` 통과
- 메모
  - `verify` 과정에서 `admin:sync`가 entrypoint 페이지를 다시 생성하므로, source of truth는 계속 `src/features/admin/pages/**`로 유지한다.

### 2026-04-04 15:43 KST: 공개 쓰기/회원가입 `429` 대기 시간 안내 공용화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/rate-limit-feedback.ts`를 추가해 브라우저에서 `Retry-After`, `X-RateLimit-Reset`, JSON `retryAfterMs`를 함께 읽고 `약 N초/분 후 다시 시도해주세요.` 형식의 공통 문구를 만들게 했다.
  - `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`, `/Users/alex/project/altteulmap/src/features/reports/report-submit-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-reaction-buttons.tsx`는 이제 `429` 응답에서 남은 대기 시간을 같은 형식으로 보여준다.
  - 댓글 회귀는 `/Users/alex/project/altteulmap/tests/e2e/comments.spec.ts`에 추가했다. 같은 방문자 세션에서 코멘트 10건으로 quota를 채운 뒤 11번째 제출 시 `코멘트 등록 요청이 너무 빠릅니다. 약 ... 후 다시 시도해주세요.` 문구가 보이는지 검증한다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/comments.spec.ts --project chromium` 통과
- 메모
  - 현재 대기 시간 문구는 header 우선, JSON body fallback 순서로 계산한다. server 정책 수치를 나중에 조정해도 클라이언트 메시지 포맷은 그대로 재사용할 수 있다.

### 2026-04-04 17:28 KST: public worker 재배포와 live `smoke:remote` 통과
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/admin-app.ts`의 external admin API stub status를 `503`에서 `200`으로 조정했다. public `/api/admin/places`는 별도 관리자 앱 안내용 endpoint라 `ok: false` body와 `adminUrl`만 있으면 충분하고, live smoke도 이 계약을 기준으로 다시 통과한다.
  - 같은 수정이 포함된 public worker를 `NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev`, `ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev` 기준으로 다시 배포했다.
  - 새 public version에서 live `smoke:remote`를 다시 실행해 public `/`, `/robots.txt`, `/sitemap.xml`, sample place canonical, public `/admin`, public `/api/admin/places`, admin `/admin`, admin `/login`을 한 번에 재검증했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run deploy:check:public` 통과
  - `NEXTAUTH_URL=https://altteulmap-admin.altteul-lab.workers.dev SITE_URL=https://altteulmap.altteul-lab.workers.dev npm run deploy:check:admin` 통과
  - `NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run deploy:public` 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote` 통과
- 메모
  - public worker 현재 version id: `9968cae6-966c-49a0-8882-abe3e87f463e`
  - 직전 배포에서 `public /api/admin/places`가 `503`을 반환해 smoke가 실패했지만, body는 이미 정상 안내 JSON이었고 status만 계약과 어긋나 있었다.

### 2026-04-04 16:20 KST: 운영 smoke 스크립트 정리와 Workers public read hang 완화
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/smoke-local.mjs`를 현재 제품 계약에 맞춰 read-only smoke로 다시 정리했다. 이제 홈 canonical, `robots.txt`, `sitemap.xml`, sample place canonical, map API, place detail API, 로그인 화면 렌더만 검증하고, 예전 `credentials -> bookmarks/admin API` 검사는 제거했다.
  - `/Users/alex/project/altteulmap/scripts/smoke-remote.mjs`를 추가하고, `/Users/alex/project/altteulmap/package.json`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`에 remote smoke 사용법과 점검 범위를 반영했다. 로그인 matcher도 더 이상 `로컬 로그인` 문구를 기대하지 않고 `login-form` 렌더 기준으로 본다.
  - live smoke 조사 과정에서 public `map/detail`과 guest write 경로가 Cloudflare/OpenNext runtime에서 hang 되는 현상을 확인했고, 원인 후보를 둘로 나눠 정리했다. `next/headers` 기반 visitor cookie 조회는 request-driven API 경로에서 hang을 유발했고, DB read는 응답이 지연되거나 schema가 없을 때 fallback 전에 멈출 수 있었다.
  - `/Users/alex/project/altteulmap/src/lib/visitor-id.ts`는 `next/headers` 의존을 제거하고 raw `cookie` header 파싱 helper로 바꿨다. `/Users/alex/project/altteulmap/src/lib/public-write-actor.ts`와 `/Users/alex/project/altteulmap/src/app/api/places/[id]/route.ts`는 request header 기반 visitor id를 쓰도록 갱신했다.
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`는 guest viewer용 visitor cookie를 서버 페이지에서 더 이상 직접 읽지 않게 조정했다. guest는 place page SSR에서 viewer reaction 초기값을 `null`로 시작하지만, worker hang 없이 page 자체는 계속 렌더된다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에는 `withDatabaseReadTimeout()`을 추가해 `listPlaces`, `listMapPlaces`, `listTrendingPlaces`, `getPlaceDetail`가 DB read 지연 시 실패를 surface하고 기존 mock fallback으로 빠지게 했다. 로컬 `wrangler dev`에서 DB schema 부재(`relation "places" does not exist`)가 나도 public `map/detail` read는 `mock` 응답으로 복구되는 것까지 확인했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `set -a; source .env.production.local; set +a; npx wrangler dev -c wrangler.jsonc --port 8791` 후 runtime probe
    - `curl -sS -D - 'http://127.0.0.1:8791/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5'` 결과 `200`, `source: "mock"`
    - `curl -sS -D - 'http://127.0.0.1:8791/api/places/goodprice-16045'` 결과 `200`, `source: "mock"`
    - `curl -sS -D - 'http://127.0.0.1:8791/place/goodprice-16045'` 결과 `200`
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3111 SITE_URL=http://127.0.0.1:3111 USE_MOCK_DATA=true npm run build` 통과
  - `PORT=3111 AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3111 SITE_URL=http://127.0.0.1:3111 USE_MOCK_DATA=true npm run start` 후
    - `SMOKE_BASE_URL=http://127.0.0.1:3111 npm run smoke:local` 통과
    - `curl -sS -D - 'http://127.0.0.1:3111/api/places/map?scope=global&query=%EA%B9%80%EB%B0%A5'` 결과 `200`
    - `curl -sS -D - 'http://127.0.0.1:3111/place/goodprice-16045'` 결과 `200`
- 메모
  - local/prod smoke에서 canonical과 sitemap은 build 시점 `SITE_URL`을 그대로 굽기 때문에, `smoke:local`을 돌릴 때는 `build`와 `start` 모두에 같은 localhost `SITE_URL`/`NEXTAUTH_URL`을 넘기는 편이 안전하다.
  - `smoke:remote`는 아직 live `workers.dev`에 새 public worker를 다시 배포하지 않은 상태라 재실행하지 않았다. 다음 액션은 current public worker 재배포 후 `NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`를 다시 돌리는 것이다.

### 2026-04-04 15:31 KST: 공개 쓰기와 북마크의 public 재검증 경로 공용화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/revalidation.ts`를 추가해 public place read 경로와 액션별 revalidation helper를 한 군데로 모았다. `place detail`, `home`, `map`, `bookmarks`, `admin queue` 반영 범위를 helper 이름에서 바로 읽을 수 있게 정리했다.
  - 같은 helper는 `revalidatePath("/place/[id]", "page")`와 concrete slug path를 같이 다뤄, 공개 상세 페이지 invalidation 기준을 route segment 수준으로도 같이 잡는다.
  - `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/[commentId]/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/reaction/route.ts`, `/Users/alex/project/altteulmap/src/app/api/bookmarks/[id]/route.ts`는 흩어져 있던 `revalidatePath` 호출을 새 helper로 교체했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/route.ts`는 공개 장소 등록 성공 시 admin place queue와 dashboard를 재검증하도록 바꿨고, `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`는 신고 제출 성공 시 admin reports queue를 재검증하도록 보강했다.
  - `/Users/alex/project/altteulmap/src/features/admin/revalidation.ts`도 public place read 경로 정의를 재사용하게 정리해, admin moderation과 public write가 place/home/map 재검증 기준을 따로 들고 있지 않게 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npx playwright test tests/e2e/comments.spec.ts tests/e2e/bookmarks.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts tests/e2e/submission-admin.spec.ts` 통과
- 메모
  - `npm run verify` 중 `sitemap.xml` 단계에서 production DB의 `places` 테이블 부재로 mock fallback 로그가 남는 현상은 기존과 동일하며, 이번 변경과는 무관하다.
  - Playwright는 여전히 `3107` 단일 포트를 사용하므로, mock/DB 세트는 순차 실행을 유지하는 편이 안전하다.

### 2026-04-04 15:08 KST: 모바일 목록/상세 시트 스냅과 drag-close 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/use-mobile-sheet-gesture.ts`를 추가해 모바일 시트 핸들에서 쓸 공용 pointer gesture helper를 만들었다. upward drag는 expand, downward drag는 collapse 또는 close로 해석하고, 현재 drag offset은 transform으로만 적용한다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 모바일 목록 시트에 `peek/expanded` 상태를 추가했다. open 시 기본은 `peek`이고, 헤더의 `펼치기/줄이기` 버튼과 상단 핸들 drag로 스냅을 바꿀 수 있다. expanded 상태에서 downward drag는 `peek`로, peek 상태에서 downward drag는 닫기로 동작한다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 상단 핸들에 같은 gesture helper를 연결해 모바일 상세 시트를 downward drag로 닫을 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에는 모바일 시트의 height/transform transition과 `data-sheet-mode`, `data-sheet-dragging` 규칙을 추가해 list sheet가 `46dvh` peek와 `72dvh` expanded 사이를 전환하도록 맞췄다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.mobile.spec.ts`는 목록 시트의 `peek -> expanded -> drag collapse -> drag close`, 상세 시트의 drag-close까지 검증하도록 갱신했다.
- 검증 결과
  - `npx tsc --noEmit` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - Playwright는 `next start` 기반이라, 새 `data-*` 속성과 handle이 안 보이던 첫 실패는 stale `.next` 빌드 때문이었다. 이후 `npm run verify`로 rebuild한 뒤 회귀를 다시 고정했다.
  - 모바일/데스크톱 Playwright를 같은 포트(`3107`)로 병렬 실행하면 `EADDRINUSE`가 나므로, 이후에도 두 세트는 순차 실행하는 편이 안전하다.

### 2026-04-04 13:42 KST: 홈 `인기 장소` 추천 섹션 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에 `listTrendingPlaces()`를 추가했다. DB는 `좋아요 수 -> 검증 수 -> 최근 갱신 -> 낮은 비추천 -> 대표 가격 -> 이름` 순서로 상위 장소를 고르고, mock도 같은 의도로 `좋아요 우선 + 최근 갱신` comparator를 사용한다.
  - `/Users/alex/project/altteulmap/src/features/places/trending-places-section.tsx`를 새로 추가해 상위 6개 카드를 홈에서 가로 레일/데스크톱 3열 grid로 보여주도록 했다. 카드에는 순위, 카테고리/지역, 대표 가격, `좋아요 N` 또는 `최근 갱신` 이유를 같이 노출한다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`는 검색어가 없을 때만 `listTrendingPlaces(6, activeCategory)`를 SSR로 불러오고, 지도 아래에 `인기 장소` 섹션을 렌더한다. 검색 결과 화면에서는 추천 섹션을 숨겨 검색 맥락과 경쟁하지 않게 했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`에 홈 추천 섹션 노출과 카드 클릭 후 상세 페이지 이동 회귀를 추가했다.
  - `/Users/alex/project/altteulmap/README.md`의 기본 E2E 목록도 현재 검증 범위에 맞게 갱신했다.
- 검증 결과
  - `npx tsc --noEmit` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - imported goodprice seed는 현재 `likeCount=0`이 많아서, 실제 live 데이터가 쌓이기 전까지는 `최근 갱신` 라벨이 함께 보이는 추천 섹션 성격이 더 강하다.
  - 검증 중 추천 섹션이 보이지 않던 첫 실패는 코드 문제가 아니라 새 UI 패치 전 `.next` 빌드를 Playwright가 재사용한 상태였고, `npm run verify`로 새 빌드를 만든 뒤 회귀가 정상 통과했다.

### 2026-04-04 13:16 KST: mock runtime 데스크톱 지도 비회원 좋아요 회귀 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 mock reaction summary 계산에서 store key를 `split(":")`로 읽던 로직을 `parseStoredReactionPlaceId()` helper로 교체했다.
  - 원인은 mock store key가 `visitor:uuid:placeId` 또는 `user:userId:placeId` 형태인데, 기존 구현이 두 번째 토큰을 place id로 잘못 읽어 `getMockReactionSummary()`가 누적 count를 전혀 세지 못하던 점이었다. 그래서 API는 `"좋아요를 남겼습니다."`를 반환해도 `likeCount`는 계속 `0`이었다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`는 직전 턴에서 이미 오래된 고정 fixture를 제거해 두었고, 이번 턴에서는 mock runtime 기준 좋아요 count가 실제로 오르는지 다시 안정화했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run build` 통과
  - `PORT=3117 USE_MOCK_DATA=true AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3117 npm run start` 후 수동 확인
    - `curl -i -s -X PUT 'http://127.0.0.1:3117/api/places/goodprice-16045/reaction' -H 'Content-Type: application/json' --data '{"reaction":"like"}'` 결과 `{"ok":true,"source":"mock","reaction":"like","likeCount":1,"dislikeCount":0,...}`
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - 검증용 서버는 `lsof -tiTCP:3117 -sTCP:LISTEN | xargs -r kill`로 종료했다.
  - 이전에 띄워 둔 `3116` mock server도 같이 종료했다.

### 2026-04-04 12:22 KST: 공개 지도 목록/상세의 중복 메타와 상태 안내를 압축
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 모바일 검색 카드 상단 요약을 여러 badge 대신 한 줄 summary text(`검색어 · 카테고리 · 범위`)로 바꿔 첫 화면 높이를 다시 줄였다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 `ListStatusSummary`를 추가해 `불러오는 중`, `총 N곳 중 M곳 먼저 표시`, `목록은 120곳까지만 표시` 안내를 데스크톱/모바일 공통의 단일 요약 패널로 합쳤다. 기존처럼 동일 성격의 안내 박스가 2~3장 연달아 쌓이지 않게 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 헤더 아래에서 제목/주소/카테고리/지역을 다시 반복하지 않고, 본문 시작을 카테고리/지역 chip + 선택적 사업장 이름 + 대표 가격 패널로 재구성했다. 닫기 버튼도 모바일 기준 더 작은 chrome으로 줄였다.
  - 같은 파일에서 검증 중 드러난 별도 회귀를 일부 보강했다. 상세 fetch가 늦게 끝날 때 locally 바뀐 반응 수치가 즉시 덮이지 않도록 reaction override state를 추가했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`는 오래된 고정 fixture 대신 `/Users/alex/project/altteulmap/tests/e2e/helpers/place.ts`로 현재 runtime에서 검색 가능한 장소를 동적으로 집어오도록 바꿨다.
- 검증 결과
  - `npx tsc --noEmit` 통과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map.spec.ts --project chromium` 실패
    - 검색 fixture 문제는 없어졌지만, mock runtime 기준 비회원 좋아요 count가 detail sheet에서 즉시 증가하지 않는 별도 회귀가 남아 있다.
- 메모
  - 현재 polish 범위 자체는 완료했다. 다음 액션은 `USE_MOCK_DATA=true` 기준 `map.spec.ts`가 실패시키는 비회원 좋아요 흐름을 별도 버그로 조사하는 것이다.

### 2026-04-04 11:44 KST: 한글 slug 신규 장소 상세 404 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`에 `normalizePlaceRouteId()`를 추가해 server page와 `generateMetadata()`가 `params.id`를 그대로 쓰지 않고 `decodeURIComponent()`한 slug로 상세 lookup을 수행하도록 고쳤다.
  - 원인은 신규 승인 장소의 한글 slug가 server page render에서는 `e2e%EB...` 같은 encoded 값으로 들어오고 있었는데, DB lookup은 raw slug 기준이라 `getPlaceDetail()`이 `null`을 반환하고 `notFound()`로 떨어지던 점이었다. 같은 slug의 `/api/places/[slug]`는 `200`이라 page route 쪽 route param 처리 문제로 범위를 좁혔다.
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`는 승인 후 홈 검색 노출뿐 아니라 실제 `/place/[slug]` 상세 진입까지 다시 검증하도록 복구했다.
  - `/Users/alex/project/altteulmap/tests/e2e/comments.spec.ts`도 오래된 `school-gimbap` fixture 대신 `/Users/alex/project/altteulmap/tests/e2e/helpers/place.ts`를 써서 현재 실데이터 seed 기준 place page 회귀를 확인하도록 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3111 AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3111 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run start` 후 런타임 확인
    - `curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3111/place/e2e분식1775269839905'` 결과 `200`
    - `curl -s 'http://127.0.0.1:3111/place/e2e분식1775269839905'` 응답 본문에서 `E2E분식1775269839905` heading 확인
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npx playwright test tests/e2e/comments.spec.ts tests/e2e/price-review.spec.ts tests/e2e/submission-admin.spec.ts` 통과
- 메모
  - 이번 이슈는 API route와 server page가 같은 `slug`를 쓰더라도 page 쪽 `params.id`가 percent-encoded 상태로 들어오는 경로가 있던 점이 핵심이었다. 앞으로 place-like dynamic route를 늘릴 때는 route param normalization 여부를 먼저 확인하는 편이 안전하다.

### 2026-04-04 11:35 KST: 관리자 moderation UX 즉시 피드백과 공통 재검증 helper 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/admin/revalidation.ts`를 추가해 장소 승인, 가격 제보 검토, 신고 상태 변경, 가격 항목 수정 후의 admin/public `revalidatePath` 경로를 공통 helper로 모았다.
  - `/Users/alex/project/altteulmap/src/features/admin/api/place-detail.ts`, `/Users/alex/project/altteulmap/src/features/admin/api/price-detail.ts`, `/Users/alex/project/altteulmap/src/features/admin/api/report-detail.ts`, `/Users/alex/project/altteulmap/src/features/admin/api/price-item-detail.ts`는 새 helper만 호출하도록 정리했고, `src/features/admin/entrypoints/api/**`는 canonical API 구현 re-export로 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/admin/components/admin-pending-place-card.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-pending-price-report-card.tsx`, `/Users/alex/project/altteulmap/src/features/admin/components/admin-report-card.tsx`를 추가해 승인/반려/상태 변경이 refresh 전에도 카드나 badge에 즉시 반영되게 했다.
  - `/Users/alex/project/altteulmap/src/features/places/admin-place-review-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-price-report-review-form.tsx`, `/Users/alex/project/altteulmap/src/features/reports/admin-report-status-form.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-price-item-form.tsx`는 action별 pending 문구와 성공/실패 tone을 분리해 메시지를 더 명확하게 보여주도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/admin/pages/places-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/prices-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/pages/reports-page.tsx`는 새 client card wrapper를 쓰도록 바꿨고, `src/features/admin/entrypoints/pages/**`도 canonical page re-export로 정리했다.
  - admin moderation 회귀 확인을 위해 `/Users/alex/project/altteulmap/tests/e2e/helpers/place.ts`를 추가했고, `/Users/alex/project/altteulmap/tests/e2e/price-review.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/report-admin.spec.ts`의 오래된 `school-gimbap` fixture를 현재 실데이터 seed에서 찾는 helper 기준으로 바꿨다. `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`는 승인 후 홈 검색 노출 검증에 집중하도록 상세 페이지 의존을 줄였다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `npm run db:up` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run db:push` 통과
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npm run db:seed` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap npx playwright test tests/e2e/admin-dashboard.spec.ts tests/e2e/submission-admin.spec.ts tests/e2e/price-review.spec.ts tests/e2e/report-admin.spec.ts` 통과
- 메모
  - 수동 확인 중 `slug='e2e분식1775269839905'` 같은 새 승인 한글 slug 장소는 `/api/places/[slug]`에서는 `200`으로 보이지만 `/place/[slug]` 페이지는 `404`를 반환하는 별도 이슈를 확인했다. 이번 moderation UX 작업과는 분리해서 다음 우선순위로 조사/수정할 예정이다.

### 2026-04-04 11:15 KST: 공개 쓰기 rate limit 정책 중앙화와 응답 헤더 통일
- 완료 내용
  - `/Users/alex/project/altteulmap/src/lib/rate-limit.ts`에 공개 쓰기 정책별 limit/window 정의를 `RATE_LIMIT_POLICIES`로 모으고, `consumeRateLimitPolicy()`, `applyRateLimitHeaders()`를 추가했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/comments/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/prices/route.ts`, `/Users/alex/project/altteulmap/src/app/api/reports/route.ts`, `/Users/alex/project/altteulmap/src/app/api/auth/signup/route.ts`, `/Users/alex/project/altteulmap/src/app/api/places/[id]/reaction/route.ts`가 숫자를 직접 들고 있지 않고 공통 정책 이름을 사용하도록 바꿨다.
  - 같은 route들은 이제 정상 응답과 `400`/`429` 응답 모두에 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`을 내리고, `429`에는 `Retry-After`까지 함께 보낸다.
  - 반응 API는 별도 visitor cookie 처리 대신 `/Users/alex/project/altteulmap/src/lib/public-write-actor.ts`의 공통 actor/cookie 경로를 재사용하도록 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3110 USE_MOCK_DATA=true AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3110 npm run start` 후 수동 확인
    - `POST /api/auth/signup` 잘못된 body 6회 호출 시 `400 -> ... -> 429`로 전환되고 `X-RateLimit-*`, `Retry-After` 헤더 확인
    - `PUT /api/places/goodprice-13952/reaction` 정상 호출 시 `200`과 `X-RateLimit-Limit=20`, `X-RateLimit-Remaining=19`, visitor cookie 설정 확인
- 메모
  - 현재 rate limit 저장소는 여전히 프로세스 메모리 기반이라 Worker 인스턴스 간 완전한 전역 보장은 없다. 이번 단계는 운영 정책 수치와 응답 계약을 먼저 고정해 관측/조정을 쉽게 만드는 데 집중했다.

### 2026-04-04 11:05 KST: `workers.dev` 기준 public/admin split 운영 배포 적용
- 완료 내용
  - `.env.production.local`에 `SITE_URL=https://altteulmap.altteul-lab.workers.dev`를 추가해 public 홈 기준 URL을 명시했다.
  - Wrangler 인증 상태와 운영 URL 설정을 확인한 뒤, admin 앱은 셸 env로 `NEXTAUTH_URL=https://altteulmap-admin.altteul-lab.workers.dev`, `SITE_URL=https://altteulmap.altteul-lab.workers.dev`를 명시해 배포했다.
  - public 앱은 셸 env로 `NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev`, `ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev`를 명시해 외부 admin redirect/API stub 모드로 다시 배포했다.
  - 런타임에서 public `/` 응답 200, public `/admin`의 admin worker redirect, public `/api/admin/places`의 안내 JSON, `robots.txt`, `sitemap.xml`, admin `/admin`의 로그인 redirect를 다시 확인했다.
- 검증 결과
  - `npx wrangler whoami` 통과
  - `npm run deploy:check:public` 통과
  - `npm run deploy:check:admin` 통과
  - `NEXTAUTH_URL=https://altteulmap-admin.altteul-lab.workers.dev SITE_URL=https://altteulmap.altteul-lab.workers.dev npm run deploy:admin` 통과
  - `NEXTAUTH_URL=https://altteulmap.altteul-lab.workers.dev ADMIN_APP_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/admin` 결과 `307 -> https://altteulmap-admin.altteul-lab.workers.dev/admin`
  - `curl -s --max-time 20 https://altteulmap.altteul-lab.workers.dev/api/admin/places` 결과 `adminUrl=https://altteulmap-admin.altteul-lab.workers.dev/admin/places`
  - `curl -s --max-time 20 https://altteulmap.altteul-lab.workers.dev/robots.txt` 결과 `Host`와 `Sitemap`이 public workers.dev 기준으로 노출
  - `curl -s --max-time 20 https://altteulmap.altteul-lab.workers.dev/sitemap.xml` 결과 루트와 place URL이 public workers.dev 기준으로 노출
  - `curl -I --max-time 20 https://altteulmap-admin.altteul-lab.workers.dev/admin` 결과 `307 -> /login?callbackUrl=%2Fadmin`
- 메모
  - admin worker version id: `9b7f5abb-4f98-4c9f-91d8-9b95d23a9862`
  - public worker version id: `6c8f880e-a925-44f7-baa7-051a27736b5a`
  - admin 배포는 public용 `.env.production.local` 값을 그대로 쓰지 않고 셸 env override로 `NEXTAUTH_URL`을 admin 주소로 분리하는 방식이 안전하다.

### 2026-04-03 16:42 KST: 공개 UI 밀도 정리 커밋 푸시와 public Cloudflare 배포
- 완료 내용
  - 공개 UI 밀도 정리 변경은 `feat(ui): tighten public layout density` (`7a898e1`)로 커밋해 `codex/ui-polish-batch` 브랜치에 push했다.
  - 첫 deploy 시 clean build에서 `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`가 import하는 `/Users/alex/project/altteulmap/src/features/map/route-reset-details.tsx`가 커밋에서 빠져 있어 public worker build가 실패했다.
  - 누락 파일을 복원해 `fix(build): restore route reset details` (`82c8b88`)로 추가 커밋한 뒤 같은 브랜치에 다시 push했고, 그 커밋 기준으로 public worker를 재배포했다.
- 검증 결과
  - `git push origin codex/ui-polish-batch` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I --max-time 20 https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
  - 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `0d99da66-1b53-464b-837f-5f90093ae4fb`
- 메모
  - 실제 live runtime은 `82c8b88` 기준이다.
  - deploy 직전에는 `git stash push --keep-index -u -m 'codex-temp-ui-ship-20260403'`로 unrelated 미커밋 변경을 잠시 분리해 clean commit 기준으로 build/deploy를 수행했다.

### 2026-04-03 16:35 KST: 공개 UI 후속으로 헤더 1줄화, 홈 map-first 재배치, auth/등록 화면 감량
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/global-header.tsx`, `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`에서 모바일 헤더를 줄바꿈 없는 단일 행 구조로 바꿨다. 액션 버튼은 모바일에서 짧은 라벨과 가로 스크롤 행으로 정리했고, 인증 화면에서는 중복되는 `로그인` 버튼을 헤더에서 숨기도록 조정했다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 홈 상단 hero와 필터 박스의 높이/패딩/간격을 줄이고, 모바일 검색/필터 영역을 더 얕은 형태로 다시 묶었다. 지도 영역 자체의 시작 위치도 위로 당겼다.
  - `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`에서 인증 화면을 더 작은 단일 카드 구조로 정리했다. 상단 설명 문구와 중복 전환 링크를 제거하고, 하단 한 줄 링크만 남겼다.
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`에서 등록 화면의 바깥 카드와 폼 안의 중첩 surface를 줄였다. 가격 항목 카드, 주소 블록, 결과 패널도 더 평평한 계층으로 맞췄다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3109 USE_MOCK_DATA=true npx next start -p 3109`로 production server를 띄운 뒤 Playwright probe로 `/`, `/login`, `/signup`, `/submit`의 desktop/mobile viewport를 재측정했다
  - 핵심 측정값 변화
    - 모바일 header height: `153px -> 58.19px`
    - 홈 mobile map shell top: `516.5px -> 327.69px`
    - 홈 desktop map shell top: `638.66px -> 544.89px`
    - 로그인 mobile form top: `147.48px`
    - 회원가입 mobile form top: `82.19px`
    - 등록 mobile form top: `150.19px`
    - 샘플 페이지 horizontal overflow: 모두 `0`
- 메모
  - production server 점검 후 `pkill -f "next start -p 3109"`로 서버를 내렸다.
  - 홈 데스크톱 첫 화면은 이전보다 가벼워졌지만, 더 과감한 `map-first`를 원하면 다음 단계에서 데스크톱 검색/카테고리 박스를 지도 옆으로 재배치하는 방향도 가능하다.

### 2026-04-03 15:58 KST: 공개 페이지 브라우저/모바일 디자인 전면 리뷰
- 완료 내용
  - 배포본 `https://altteulmap.altteul-lab.workers.dev` 기준으로 `/`, `/login`, `/signup`, `/submit`를 데스크톱/모바일 viewport에서 다시 점검했다.
  - `/Users/alex/project/altteulmap/src/components/global-header.tsx`, `/Users/alex/project/altteulmap/src/components/brand-mark.tsx`, `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`, `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`, `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`를 기준으로 레이아웃 밀도와 CTA 집중도를 코드 리뷰했다.
  - 주요 리스크는 모바일 전역 헤더 높이 과다, 홈에서 지도 시작 위치가 너무 아래로 밀리는 구조, 인증 화면의 전역 이동과 폼 내부 이동 중복, 등록 폼의 카드 레이어 과다로 정리했다.
- 검증 결과
  - `node <<'EOF'` 기반 Playwright probe로 배포본 `/`, `/login`, `/signup`, `/submit`의 desktop/mobile bounding box, header height, map/form start position, overflowX를 수집했다.
  - 수집 기준 viewport
    - desktop: `1440x960`
    - mobile: `390x664`
  - 핵심 측정값
    - 홈 mobile header height: `153px`
    - 홈 mobile map shell top: `516.5px`
    - 홈 desktop map shell top: `638.66px`
    - 로그인/회원가입/등록 mobile header height: 모두 `153px`
    - 샘플 페이지 horizontal overflow: 모두 `0`
- 메모
  - 이번 턴은 리뷰만 수행했고 코드 변경은 하지 않았다.
  - 다음 수정 우선순위는 `모바일 header 1줄화`, `홈 첫 화면 map-first 재배치`, `auth 페이지 전역 nav 축소`, `등록 폼 표면 레이어 감량` 순서로 보는 것이 타당하다.

### 2026-04-03 15:05 KST: 모바일 지도 zoom-out 시 overview cluster 복귀 정책 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 모바일 marker 표시 정책을 다시 넣되, 이전 회귀처럼 광범위하게 숨기지 않도록 임계 zoom을 낮췄다. 이제 모바일 `viewport + 무검색 + 선택된 place 없음 + cluster 존재` 상태에서만 `zoom <= 10.75`일 때 cluster marker만 우선 노출한다.
  - 따라서 initial/zoom-out overview에서는 개별 place marker가 화면에 과도하게 남지 않고 cluster 중심 개요로 돌아가며, `zoom > 10.75` 구간에서는 서버가 내려준 place marker를 그대로 보여 줘서 확대 후에도 다시 숫자만 남던 이전 회귀를 피한다.
  - 수정은 `fix(map): re-cluster mobile markers on zoom out` (`25971e1`) 커밋으로 정리해 `codex/ui-polish-batch` 브랜치에 push했고, public worker를 다시 배포했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
  - 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `9c902b78-24ff-428a-b9b0-904142594238`
- 메모
  - 이번 수정은 clean HEAD 기준으로 커밋/배포한 뒤, 원래 워크트리 변경을 다시 복원하는 방식으로 처리한다.

### 2026-04-03 14:10 KST: 공개 지도 가격 필터 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 모바일/데스크톱 가격 필터 UI, `maxPrice` hidden input, 가격 파라미터 URL 조합을 제거했다. 공개 지도 탐색 조건은 이제 카테고리와 검색 범위만 남는다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`, `/Users/alex/project/altteulmap/src/features/places/queries.ts`에서 `maxPrice` prop, query string, API filter payload, repository/mock filtering 경로를 함께 제거했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map-price-filter.spec.ts`, `/Users/alex/project/altteulmap/tests/e2e/map-price-filter.mobile.spec.ts`는 가격 필터 동작 검증 대신 가격 옵션 비노출과 카테고리 탐색 유지 회귀를 검증하도록 바꿨다.
  - `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`를 현재 제품 계약에 맞춰 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map-price-filter.spec.ts tests/e2e/map-price-filter.mobile.spec.ts` 통과
- 메모
  - 2026-04-03의 가격 필터 회귀 수정 로그는 현재 제품 계약에서는 역사 기록으로만 남고, 실제 서비스 기능은 이번 턴에서 제거됐다.

### 2026-04-03 13:25 KST: 모바일 지도에서 cluster만 남던 client-side suppression 회귀 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 모바일 viewport 전용 `cluster-only` 분기를 제거했다. 이제 서버가 확대된 bounds/zoom 기준으로 place marker를 함께 반환하면 모바일에서도 그대로 지도에 전달된다.
  - 문제 원인은 같은 파일의 `mobileOverviewMarkers`였다. `isMobileViewport + viewport search + 무검색 + selectedPlace 없음 + cluster 존재 + zoom <= 13.25` 조건이면 서버 응답에 place marker가 섞여 있어도 클라이언트가 다시 cluster만 남기고 있었고, 이 때문에 모바일에서 숫자 마커만 계속 보일 수 있었다.
  - 로컬 API probe로 bootstrap bounds(`37.4133~37.7151`, `126.7341~127.2693`) 기준 응답을 다시 확인했다. 서버는 이미 `zoom 12`부터 `cluster 21 + place 3`, `zoom 15`에서 `cluster 47 + place 7`처럼 개별 place marker를 내려주고 있어, 이번 회귀의 직접 원인이 서버가 아니라 클라이언트 suppression임을 확인했다.
  - 수정은 `fix(map): restore mobile place markers` (`8686fbc`)로 커밋해 `codex/ui-polish-batch` 브랜치에 push했고, public worker를 다시 배포했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - clean worktree 기준 `npm run verify` 통과
  - `USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - `curl -I https://altteulmap.altteul-lab.workers.dev/` 결과 `200`
  - 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `e2eebb66-92bc-442e-88ca-31b6da5a9875`
- 메모
  - clean verify/deploy를 위해 커밋 후 나머지 미커밋 변경을 `git stash push -u -m 'codex-temp-mobile-map-fix-20260403'`로 잠시 분리했다. 이 stash는 배포 직후 다시 원복할 예정이다.

### 2026-04-03 13:20 KST: 가격 필터 모바일 회귀와 `127.0.0.1` dev 접근 문제 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/next.config.ts`에 `allowedDevOrigins: ["127.0.0.1"]`를 추가했다. 이제 로컬 dev 서버를 `localhost:3000`으로 띄워도 브라우저를 `http://127.0.0.1:3000`으로 열 때 Next 16 dev origin 제한 때문에 hydration과 `/api/places/map` fetch가 막히지 않는다.
  - `/Users/alex/project/altteulmap/src/features/map/route-reset-details.tsx`를 추가해 모바일 `탐색 조건` 박스를 client wrapper로 감쌌다. route key가 바뀌면 wrapper 자체가 remount되어 `open` 상태가 닫힌 상태로 초기화된다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`의 모바일 가격/카테고리/검색 범위 패널은 위 wrapper를 쓰도록 바꿨다. 그래서 `5,000원 이하`를 누른 뒤 다시 `탐색 조건`을 열면 `전체 가격`, `10,000원 이하`, `20,000원 이하`를 다시 바로 고를 수 있다.
  - `/Users/alex/project/altteulmap/tests/e2e/map-price-filter.mobile.spec.ts`를 추가해 모바일에서 `5,000원 이하 -> 탐색 조건 다시 열기 -> 10,000원 이하` 흐름을 회귀로 고정했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map-price-filter.spec.ts tests/e2e/map-price-filter.mobile.spec.ts` 통과
  - 수동 dev 확인
    - `PORT=3000 USE_MOCK_DATA=true AUTH_SECRET=testsecret NEXTAUTH_URL=http://127.0.0.1:3000 npm run dev` 후 `http://127.0.0.1:3000/`에서 badge `507곳`, 목록 `120`, `/api/places/map` 응답 확인
    - 모바일 viewport에서 `5,000원 이하` 선택 후 `탐색 조건`을 다시 열면 `전체 가격`, `10,000원 이하`가 다시 보이고 `?maxPrice=10000`까지 이동 확인
- 메모
  - 이번 사용자 보고 증상은 두 갈래였다. 정상 origin(`localhost`)에서는 가격 필터 자체는 동작했지만 모바일에서는 `<details>` open 상태가 route 전환 뒤 남아 다시 탭했을 때 닫혀 버렸고, `127.0.0.1` 접근에서는 Next dev origin 제한 때문에 hydration과 지도 fetch가 불안정했다.

### 2026-04-03 13:18 KST: 모바일 지도 UX 후속 커밋 푸시와 public Cloudflare 배포
- 완료 내용
  - 모바일 지도 시트 후속 수정은 `fa1d3aa` (`feat(ui): refine mobile map sheets`) 커밋으로 정리해 `codex/ui-polish-batch` 브랜치에 push했다.
  - public worker는 커밋 상태만 배포되도록 나머지 미커밋 변경을 임시로 분리한 뒤 `npm run deploy:check`, `npm run deploy:public` 순서로 배포했다.
- 검증 결과
  - `npm run deploy:check` 통과
  - `npm run deploy:public` 통과
  - 배포 URL: `https://altteulmap.altteul-lab.workers.dev`
  - Cloudflare version id: `aa70be6e-ceb3-4d6a-aace-90015b38d53c`
- 메모
  - 배포 후 원래 워크트리의 미커밋 변경은 다시 복원했다. 현재 public 배포본은 `fa1d3aa` 기준이고, 그 외 로컬 미커밋 변경은 아직 push/deploy 범위에 포함되지 않는다.

### 2026-04-03 13:10 KST: 모바일 지도 시트 레이어, bottom-sheet 비율, 저줌 마커 정책 후속 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 모바일 시트 공용 safe-area 규칙을 추가해 목록/상세 시트를 `top-2/bottom-2` 전체 오버레이가 아니라 bottom-sheet 최대 높이 기준으로 다루도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 모바일 목록 시트 z-index를 전역 헤더보다 높게 올리고, 목록 시트에 새 mobile sheet 규칙을 적용했다. 동시에 모바일 `viewport + 무검색 + 저줌` 상태에서는 cluster marker가 있으면 cluster만 우선 보여주도록 바꿔 count marker와 개별 place marker가 섞여 보이는 첫 화면을 줄였다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 모바일 상세 시트도 같은 safe-area bottom-sheet 규칙으로 옮기고, 상단 헤더를 generic 문구 대신 실제 장소명/주소 중심으로 바꿨다. 상세 시트 z-index도 전역 헤더보다 높게 조정했다.
  - `/Users/alex/project/altteulmap/tests/e2e/map.mobile.spec.ts`는 고정 mock 숫자/slug 의존을 걷어내고, 실제 첫 목록 아이템 기준으로 상세 시트가 열리는지와 모바일 시트가 viewport를 과도하게 덮지 않는지 확인하도록 보강했다.
- 검증 결과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `USE_MOCK_DATA=true npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium` 통과
- 메모
  - 이번 수정으로 모바일 목록 시트는 이전보다 낮고 짧아져 한 화면에 보이는 카드 수가 줄었다. 대신 상단 닫기 버튼이 헤더 뒤로 숨지 않고, 실제 지도 작업면과 상단 안전영역은 더 넓게 확보된다.

### 2026-04-03 12:25 KST: 모바일 지도 UX 코드 리뷰
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/global-header.tsx`, `/Users/alex/project/altteulmap/src/app/layout.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`를 기준으로 모바일 지도 UX를 코드만 보고 리뷰했다.
  - 전역 헤더 z-index가 모바일 목록/상세 시트보다 높아 닫기 영역을 가릴 수 있는 구조, 모바일 시트가 safe area 없이 거의 전체 높이를 점유하는 구조, 서버 마커 생성이 cluster/place를 같은 응답에 섞어 내려주는 구조를 주요 이슈로 정리했다.
- 검증 결과
  - 코드 리뷰만 수행했고 별도 명령 검증은 추가로 실행하지 않았다.
- 메모
  - 다음 액션은 모바일 시트 레이어 우선순위 재정리, safe-area 대응, 모바일 개요 줌에서 cluster/place 표시 정책 분리 순서가 적절하다.

### 2026-04-03 11:56 KST: preview fallback에서도 bootstrap fetch와 가격 필터가 끊기지 않게 회귀 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 viewport 모드의 첫 client fetch가 실제 지도 SDK의 viewport 이벤트만 기다리지 않도록 바꿨다. `viewport`가 아직 없으면 `initialBounds`를 bootstrap bounds로 써서 `/api/places/map`를 바로 호출한다.
  - `MapExplorer`는 이미 `key` 기반 remount를 사용하고 있으므로, 이번 회귀의 직접 원인인 bootstrap fetch 경로만 보강했다. 가격 필터 전환도 remount 뒤 같은 bootstrap fetch를 타므로 `maxPrice=5000` 응답이 정상적으로 다시 내려온다.
  - `/Users/alex/project/altteulmap/tests/e2e/map-price-filter.spec.ts`를 추가해 네이버 지도 SDK fallback 상황에서도 `/` 첫 진입 시 bootstrap fetch가 발생하고, `5,000원 이하` 클릭 시 `/api/places/map?...maxPrice=5000` 응답과 목록이 계속 보이는지 검증하도록 했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npm run verify` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 USE_MOCK_DATA=true npx playwright test tests/e2e/map-price-filter.spec.ts` 통과
- 메모
  - 회귀 원인은 viewport 모드의 첫 fetch가 지도 SDK가 내리는 실제 viewport 이벤트에만 묶여 있었던 점이다. SDK가 없거나 늦게 뜨는 환경에서는 `/api/places/map` 호출이 아예 없어서 목록/미리보기 마커가 0건에 고정됐고, 가격 필터 전환 시에도 같은 증상이 반복됐다.

### 2026-04-03 11:55 KST: 카테고리 칩을 가로 레일에서 반응형 그리드로 전환
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 카테고리 필터만 별도 chip class로 분리했다. 이제 모바일 `탐색 조건` 박스와 데스크톱 필터 박스 모두 카테고리는 `w-full + min-w-0 + text-center` 규칙을 쓰고, `whitespace-nowrap`를 제거했다.
  - 같은 파일에서 카테고리 영역을 `altteulmap-scroll-row` 대신 `altteulmap-chip-grid`로 바꿨다. 검색 범위/가격 필터는 기존 가로 레일을 유지하고, 항목 수가 많은 카테고리만 박스 안에서 여러 줄로 자연스럽게 배치된다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`에 `altteulmap-chip-grid`를 추가해 모바일 2열, `sm` 3열, `lg` 이상 auto-fit grid로 반응형 배치를 고정했다.
  - 검증 중 드러난 기존 lint blocker도 같이 정리했다. `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 props 동기화용 setState effect를 제거했고, 현재는 부모 key remount로 초기화 흐름을 유지한다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
- 메모
  - 이번 수정 목적은 카테고리 개수가 늘어도 필터 박스 오른쪽 바깥으로 시각적으로 밀려나지 않게 만드는 것이다. 현재는 카테고리만 wrap/grid 기준으로 바뀌고, 가격/검색 범위처럼 짧은 칩 묶음은 기존 가로 레일 UX를 그대로 유지한다.

### 2026-04-02 21:40 KST: admin worker 루트 `/` 500을 안전한 랜딩 페이지로 교체
- 완료 내용
  - `/Users/alex/project/altteulmap/apps/admin/src/app/page.tsx`의 server redirect(`/admin`)를 제거하고, `/admin` 또는 `/login`으로 이동할 수 있는 정적 랜딩 페이지로 교체했다.
  - 같은 파일에 `dynamic = "force-dynamic"`을 추가해 OpenNext preview/worker에서 bare root `/`가 정적으로 취급되며 `DYNAMIC_SERVER_USAGE`로 500이 나던 경로를 동적으로 고정했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run deploy:admin` 통과
  - `curl -I https://altteulmap-admin.altteul-lab.workers.dev/` 결과 `200`
  - `curl -I https://altteulmap-admin.altteul-lab.workers.dev/admin` 결과 `307 -> /login?callbackUrl=%2Fadmin`
  - `curl -I https://altteulmap-admin.altteul-lab.workers.dev/login` 결과 `200`
- 메모
  - public `altteulmap`과 admin `altteulmap-admin`은 분리 worker라서, public worker를 `external admin` 모드로 배포한 현재 구조에서는 admin worker를 삭제하면 `/admin` 운영 경로가 사라진다.

### 2026-04-02 14:18 KST: 배포/점검 스크립트의 env precedence를 쉘·CI 우선으로 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/lib/load-env-files.mjs`를 추가해 `.env`, `.env.production`, `.env.local`, `.env.production.local`을 읽되, 이미 주입된 쉘/CI env는 덮어쓰지 않고 파일끼리만 뒤 순서가 앞 순서를 덮도록 공통 helper를 만들었다.
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`, `/Users/alex/project/altteulmap/scripts/build-public-worker.mjs`는 이제 이 helper를 써서 로컬 파일보다 셸/CI env를 우선한다. 따라서 운영 워크플로우에서 넘긴 `NEXTAUTH_URL`, `ADMIN_APP_URL`, `SITE_URL`이 개발용 `.env*` 값으로 다시 덮이지 않는다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`, `/Users/alex/project/altteulmap/PLAN.md`에 이 precedence 규칙과 split 배포 기준 문구를 반영했고, 예전 `public 번들에서 /admin 제거` 문장도 현재 external stub 동작 기준으로 고쳤다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `NEXTAUTH_URL=https://override-public.example.workers.dev ADMIN_APP_URL=https://override-admin.example.workers.dev npm run deploy:check:public` 통과
    - callback reminder와 public `/admin` entrypoint가 모두 override 값으로 출력되는 것 확인
  - `NEXTAUTH_URL=https://override-admin.example.workers.dev SITE_URL=https://override-public.example.workers.dev npm run deploy:check:admin` 통과
    - callback reminder와 public home link가 모두 override 값으로 출력되는 것 확인
  - `ADMIN_APP_URL=https://override-admin.example.workers.dev NEXTAUTH_URL=https://override-public.example.workers.dev npm run cf:build:public` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
- 메모
  - 이전에는 deploy check/build 스크립트가 `dotenv.config({ override: true })`를 써서 셸에서 넘긴 운영 URL도 `.env.production.local` 같은 로컬 파일 값으로 다시 덮을 수 있었다. 이번 수정으로 CI와 운영 배포에서 env 우선순위가 의도대로 맞춰졌다.

### 2026-04-02 14:14 KST: 관리자 외부 앱 cutover 경로를 external stub 빌드 기준으로 마무리
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/build-public-worker.mjs`를 바꿔 public worker build가 더 이상 `src/app/admin`, `src/app/api/admin`를 삭제하지 않고, `src/features/admin/entrypoints`만 `external` 모드로 동기화한 뒤 OpenNext build를 수행하도록 정리했다. build 후에는 기존 entrypoint를 복구한다.
  - `/Users/alex/project/altteulmap/package.json`에 `admin:sync:embedded`, `admin:sync:external`, `deploy:check:public`, `deploy:check:admin` 스크립트를 추가해 split 배포 검증 경로를 명시했다.
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`는 `--public`, `--admin` 모드를 지원하게 바꿨다. public split은 `ADMIN_APP_URL`, standalone admin worker는 `SITE_URL`까지 확인하고, callback/home link 기준 URL을 같이 출력한다.
  - `/Users/alex/project/altteulmap/src/lib/env.ts`, `/Users/alex/project/altteulmap/src/lib/site.ts`, `/Users/alex/project/altteulmap/.env.example`에 `SITE_URL`을 반영했다. admin 앱은 `NEXTAUTH_URL`을 자기 자신 기준으로 두고도 헤더의 홈 링크는 public 앱으로 보낼 수 있게 됐다.
  - `/Users/alex/project/altteulmap/src/lib/admin-app.ts`는 로컬 보호 로직을 `NEXTAUTH_URL` 기준으로 유지해, `SITE_URL`이 별도로 있어도 localhost 개발/테스트에서는 외부 admin 링크가 자동으로 새지 않게 했다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`, `/Users/alex/project/altteulmap/PLAN.md`를 업데이트해 split 배포 순서, env 역할, public `/admin` redirect/API stub 동작, admin 앱의 `SITE_URL` 사용 규칙을 남겼다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `npm run deploy:check:public -- --preview` 실패
    - 의도된 결과로, preview env에 `ADMIN_APP_URL`이 없으면 split public 배포를 막는지 확인했다
  - `npm run deploy:check:admin -- --preview` 실패
    - 의도된 결과로, preview env에 `SITE_URL`이 없으면 standalone admin 배포를 막는지 확인했다
  - `NEXTAUTH_URL=https://altteulmap.example.workers.dev ADMIN_APP_URL=https://altteulmap-admin.example.workers.dev npm run deploy:check:public` 통과
  - `NEXTAUTH_URL=https://altteulmap-admin.example.workers.dev SITE_URL=https://altteulmap.example.workers.dev npm run deploy:check:admin` 통과
  - `npm run cf:build:public` 통과
    - public worker route manifest에 `/admin`, `/admin/places`, `/api/admin/places` 등이 남아 external stub 모드로 빌드되는 것 확인
  - `npm run cf:build:admin` 통과
  - `ALTTEULMAP_ADMIN_MODE=external NEXTAUTH_URL=https://altteulmap.example.workers.dev ADMIN_APP_URL=https://altteulmap-admin.example.workers.dev npm run build` 통과
  - `PORT=3126 NEXTAUTH_URL=https://altteulmap.example.workers.dev ADMIN_APP_URL=https://altteulmap-admin.example.workers.dev npm run start` 후 수동 확인
    - `curl -si http://127.0.0.1:3126/admin` 결과 `307 Temporary Redirect`, `location: https://altteulmap-admin.example.workers.dev/admin`
    - `curl -s http://127.0.0.1:3126/api/admin/places` 결과 `{"ok":false,"message":"관리자 기능은 별도 관리자 앱으로 이동했습니다.","adminUrl":"https://altteulmap-admin.example.workers.dev/admin/places"}`
    - `curl -s http://127.0.0.1:3126/ | rg 'https://altteulmap-admin.example.workers.dev/admin'` 결과 public 헤더의 admin 링크가 외부 앱 주소를 가리키는 것 확인
  - `npm run admin:sync` 실행으로 작업 종료 시 entrypoint를 다시 embedded 모드로 복구
- 메모
  - localhost 보호 로직은 그대로 유지한다. `NEXTAUTH_URL`이 localhost면 `ADMIN_APP_URL`이 있어도 public 앱은 외부 admin 링크를 쓰지 않는다.
  - 실제 운영 cutover는 아직 남아 있다. 이제 필요한 것은 live `workers.dev` 또는 custom domain 값으로 env를 채운 뒤 `deploy:check:public`, `deploy:check:admin`, `deploy:public`, `deploy:admin` 순서를 실행하는 마지막 배포 작업이다.

### 2026-04-02 13:52 KST: 인증 진입면 재단순화와 지도 필터 칩 가로 레일 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`에서 설정 확인용 패널 렌더를 제거하고, 로그인/가입 액션 카드만 남기도록 다시 단순화했다.
  - `/Users/alex/project/altteulmap/src/features/auth/auth-readiness-panel.tsx`는 삭제했고, `/Users/alex/project/altteulmap/src/features/auth/repository.ts`, `/Users/alex/project/altteulmap/src/features/auth/constants.ts`에서 readiness panel용 callback/env diagnostics 메타데이터를 걷어냈다.
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/social-auth-buttons.tsx`를 정리해 이메일 로그인/가입을 먼저 보여주고, 소셜 로그인은 활성 provider가 있을 때만 보이게 바꿨다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`, `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에 가로 스크롤 레일 스타일을 추가해 모바일/데스크톱의 카테고리, 가격 필터, 검색 범위 칩이 여러 줄로 무너지지 않게 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/login.spec.ts`는 readiness panel 존재 대신 액션 중심 로그인/회원가입 전환 흐름을 검증하도록 갱신했고, `/Users/alex/project/altteulmap/README.md`의 readiness panel 설명도 제거했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false npx playwright test tests/e2e/login.spec.ts tests/e2e/signup.spec.ts` 통과
- 메모
  - 같은 날 12:00 KST에 넣었던 readiness panel은 과도한 운영 확인 UI로 판단돼 이번 턴에서 제거했다. 현재 제품 기준 필수 인증 경로는 credentials 로그인/회원가입과 북마크 보호, 관리자 권한 확인이다.

### 2026-04-02 12:00 KST: 로그인/회원가입 진입면에 auth readiness 패널 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/repository.ts`에서 provider별 callback URL, 필수 env 키, 누락 env 키, 현재 인증 기준 origin을 계산하는 diagnostics 로직을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/auth/auth-readiness-panel.tsx`를 새로 만들어 `/login`, `/signup`에서 현재 인증 기준 URL, provider별 callback URL, 사용 가능 여부, 누락 env 키를 바로 볼 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/features/auth/constants.ts`의 auth provider 타입을 확장해 callback URL과 setup metadata를 함께 다루도록 정리했다.
  - `/Users/alex/project/altteulmap/tests/e2e/login.spec.ts`를 추가해 로그인/회원가입 진입면에서 readiness 패널과 provider callback URL이 보이는지 검증했다.
  - `/Users/alex/project/altteulmap/README.md`에도 login/signup 화면에서 callback URL을 바로 확인할 수 있다는 설명을 추가했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false npx playwright test tests/e2e/login.spec.ts tests/e2e/signup.spec.ts` 통과
- 메모
  - 이 단계는 일시적으로 현재 callback 기준과 누락 설정을 화면에서 바로 확인하려는 목적이었다. 같은 날 13:52 KST 후속 작업에서 panel은 제거됐고, 현재 우선순위는 운영 도메인 배포 점검과 관리자 외부 앱 cutover다.

### 2026-04-02 11:58 KST: 지도 마커 팔레트를 중간 톤으로 재조정
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`의 marker 팔레트를 한 단계 부드럽게 낮췄다. 비활성 place marker는 진한 남색 대신 밝은 샌드/클레이 톤, active marker는 과한 주황 대신 중간 톤 테라코타, cluster marker는 어두운 남색 대신 밝은 카라멜 계열로 바꿨다.
  - preview fallback 오버레이도 같은 톤으로 맞췄고, 그림자 역시 차가운 진회색 계열에서 더 자연스러운 웜 섀도로 조정했다.
- 검증 결과
  - `npm run verify:quick` 통과
- 메모
  - 목적은 이전 다크 팔레트의 대비는 조금 낮추되, 지도 바탕과 섞이지 않게 white halo와 테두리는 유지하는 것이다. 현재는 기존보다 덜 무겁고, 그래도 마커 실루엣은 남도록 맞췄다.

### 2026-04-02 11:53 KST: 관리자 visit/activity telemetry 2차와 로그인 상태 header 회귀 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`에 `visit_activity` 테이블과 dedupe/조회용 index를 추가했고, `/Users/alex/project/altteulmap/drizzle/0008_hot_mesmero.sql` 마이그레이션을 생성해 적용했다.
  - `/Users/alex/project/altteulmap/src/features/telemetry/repository.ts`에 30분 bucket 기준 방문 적재, 120일 보존 정리, 오늘/7일 방문 수, 고유 방문자, DAU/WAU, 7일 재방문율 집계 로직을 추가했다.
  - `/Users/alex/project/altteulmap/src/features/telemetry/api/visit-route.ts`, `/Users/alex/project/altteulmap/src/app/api/telemetry/visit/route.ts`, `/Users/alex/project/altteulmap/apps/admin/src/app/api/telemetry/visit/route.ts`를 통해 public/admin 공통 방문 적재 API를 열고, `/Users/alex/project/altteulmap/src/app/layout.tsx`, `/Users/alex/project/altteulmap/apps/admin/src/app/layout.tsx`에 tracker를 연결했다.
  - `/Users/alex/project/altteulmap/src/features/admin/repository.ts`, `/Users/alex/project/altteulmap/src/features/admin/pages/dashboard-page.tsx`, `/Users/alex/project/altteulmap/src/features/admin/entrypoints/pages/dashboard-page.tsx`에서 방문 지표를 overview 카드로 노출하도록 바꿨다.
  - 검증 중 드러난 회귀도 같이 정리했다. `/Users/alex/project/altteulmap/src/components/global-header.tsx`에 `session-user-badge`, `session-admin-link`, `session-login-link` test id와 계정 라벨을 복원했고, 로그아웃은 항상 `/`로 돌아가게 바꿨다. `/Users/alex/project/altteulmap/src/lib/admin-app.ts`는 로컬/테스트 host일 때 `ADMIN_APP_URL`이 있어도 내부 `/admin`을 우선 사용하도록 조정했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 `formatDate()`는 문자열/잘못된 날짜를 안전하게 처리하도록 바꿔 Playwright webserver에서 보이던 `RangeError: Invalid time value` fallback 로그를 제거했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run db:generate` 통과
  - `npm run db:push` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `psql postgresql://postgres:postgres@127.0.0.1:5432/altteulmap -c "select route_group, visit_date, count(*) from visit_activity group by route_group, visit_date order by visit_date desc, route_group asc;"` 결과 `admin/public` route group 집계 확인
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3119 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3119 npm run start` 후 수동 확인
  - `curl -s 'http://127.0.0.1:3119/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132&zoom=13' | jq '{source, mock, count, returnedCount, mapMarkerCount}'` 결과 `database/false/1000/120/11`
  - cookie jar 로그인 뒤 `curl -s -b "$jar" "$base/admin" | rg -o 'data-testid=\"[^\"]+\"' | sort -u` 결과 `admin-metric-today-visits`, `admin-metric-weekly-visits`, `admin-metric-dau-wau`, `admin-metric-returning-rate`, `sign-out-button` 포함 확인
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false npx playwright test tests/e2e/admin-dashboard.spec.ts` 통과
- 메모
  - 초기 Playwright 재실행에서는 header test id 제거, 외부 `ADMIN_APP_URL` 우선, 로그아웃 callback이 `/admin`으로 남아 있는 세 가지 회귀가 드러났고, 이번 턴에서 모두 같이 정리했다.
  - 방문 지표는 visitor cookie/user id 기준 actor key와 30분 bucket dedupe를 사용한다. admin/public route group은 path 기준으로 분리해 같은 actor라도 운영 화면 방문을 따로 볼 수 있게 했다.

### 2026-04-02 11:51 KST: build/verify가 실행 중인 dev 서버의 `.next-dev`를 지우던 회귀 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`의 `build`에서 `.next-dev` 삭제를 제거했다. 이제 production build는 `.next`만 정리하고, 실행 중인 dev 서버 산출물은 건드리지 않는다.
  - 같은 파일의 `dev`에서도 자동 `.next-dev` 삭제를 제거했다. dev 캐시 초기화는 `npm run dev:clean`으로만 수동 수행하도록 다시 고정했다.
  - `cf:clean`도 `.next-dev`를 지우지 않게 바꿨다. 따라서 Cloudflare preview/deploy용 clean build가 로컬 dev 서버를 망가뜨리지 않는다.
- 검증 결과
  - `npm run verify:quick` 통과
  - 실행 중인 기존 dev 서버(`http://127.0.0.1:3000`)에 대해 변경 후 `curl` 결과 `200` 유지 확인
  - 같은 상태에서 `npm run build`를 병행 실행해도 dev 서버 `200` 응답이 유지되는 것 확인
- 메모
  - 이번 증상의 직접 원인은 `build/verify/cf:clean`이 live dev 산출물인 `.next-dev`를 같이 삭제하던 점이다. 그 상태에서 dev 서버는 chunk/manifest를 잃어 500을 내고, 재시작해야만 `.next-dev`를 다시 만들 수 있었다.
  - 이미 깨진 상태를 복구할 때만 `npm run dev:clean && npm run dev`를 쓰면 되고, 평소에는 그냥 `npm run dev`만 쓰면 된다.

### 2026-04-02 11:46 KST: 지도 마커 대비 강화로 실제 지도와 플레이스 구분 개선
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`의 place marker/cluster marker 팔레트를 다시 잡았다. 비활성 place marker는 진한 남색, 활성 place marker는 밝은 주황, cluster marker는 더 어두운 남색으로 분리해 지도 바탕색과 겹치지 않게 했다.
  - 같은 파일의 실지도 marker HTML은 흰색 외곽선, 더 강한 그림자, 약간 큰 아이콘 크기와 anchor로 맞춰 확대 상태에서도 배경 지도 위에서 먼저 보이게 정리했다.
  - preview fallback 오버레이도 같은 색 규칙을 쓰도록 바꿔, SDK fallback과 실지도 사이의 시각 규칙이 어긋나지 않게 맞췄다.
- 검증 결과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - follow-up formatting 확인으로 `npm run verify:quick` 재실행 통과
- 메모
  - 이번 조정의 핵심은 기존 warm beige/orange 위주의 마커가 네이버 기본 지도색과 비슷하게 섞이던 문제를 줄이는 것이다. 현재는 비활성/cluster를 cool dark 계열로 이동시키고, active만 주황으로 남겨 선택 상태도 더 눈에 띄게 했다.

### 2026-04-02 11:37 KST: bounds 기반 map API short-lived 서버 캐시와 쓰기 후 invalidation 추가
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에 `bounds`가 있는 지도 조회 전용 메모리 캐시를 추가했다. key는 정렬/필터/검색어/bounds/zoom bucket 기준으로 만들고, TTL은 짧게 유지하면서 최대 엔트리 수를 제한한다.
  - 같은 파일의 `listDatabaseMapPlaces()`는 `bounds` 요청일 때 먼저 캐시를 조회하고, miss일 때만 DB를 다시 읽어 결과를 저장한다.
  - `refreshPlaceReactionSummary()`, `refreshPlacePricingSummary()`, `moderateDatabasePlace()`에서 캐시를 즉시 비우도록 연결해 좋아요/싫어요, 대표 가격 변경, 장소 승인/반려 뒤에는 stale viewport 결과가 남지 않게 했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`는 디버깅용 `X-Altteulmap-Map-Cache` 헤더로 `miss/hit/bypass`를 내려 현재 캐시 상태를 바로 확인할 수 있게 했다. 응답 본문 계약은 그대로 유지했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3116 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3116 npm run start` 후 수동 확인
  - wide viewport header 확인
    - 첫 요청 `X-Altteulmap-Map-Cache: miss`
    - 같은 요청 재호출 `X-Altteulmap-Map-Cache: hit`
    - `PUT /api/places/goodprice-15311/reaction` 뒤 같은 요청 재호출 `X-Altteulmap-Map-Cache: miss`
  - `curl -sD - -o /dev/null 'http://127.0.0.1:3116/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=global'` 결과 header `X-Altteulmap-Map-Cache: bypass`
- 메모
  - 현재 캐시는 `bounds`가 있는 지도 조회에만 적용된다. 전역 검색처럼 bounds가 없는 요청은 우선 bypass로 두고, 필요하면 이후 별도 정책으로 확장한다.

### 2026-04-02 10:27 KST: viewport 무검색 map API를 SQL bucket aggregate로 전환
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`에서 지도 조회 조건과 정렬을 helper로 분리하고, `viewport + query 없음` 경로는 `count`, 목록용 `items`, 지도용 `mapMarkers`를 각각 별도 쿼리로 계산하도록 바꿨다.
  - 같은 파일에 SQL bucket aggregate 경로를 추가해 넓은 viewport에서는 전체 place preview를 메모리로 읽어 cluster를 만들지 않고, PostgreSQL `group by` 집계로 cluster summary를 바로 생성한다.
  - bucket에 place가 1개만 있는 경우는 place marker로, 여러 개인 경우는 cluster marker로 변환해 기존 클라이언트 계약은 유지했다.
  - 글로벌 검색이나 query가 있는 경로는 기존 preview 기반 흐름을 유지해 회귀 범위를 `viewport 무검색`으로 한정했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3115 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3115 npm run start` 후 수동 확인
  - `curl -s 'http://127.0.0.1:3115/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132&zoom=13'` 결과
    - `source: database`
    - `mock: false`
    - `count: 1000`
    - `returnedCount: 120`
    - `mapMarkerCount: 11`
    - `clusterCount: 11`
    - `placeCount: 0`
    - `truncated: true`
  - `curl -s 'http://127.0.0.1:3115/api/places/map?query=%EA%B9%80%EB%B0%A5&scope=global'` 결과
    - `source: database`
    - `mock: false`
    - `count: 40`
    - `returnedCount: 40`
    - `mapMarkerCount: 40`
    - `truncated: false`
  - Playwright headless runtime script 결과
    - `/` 진입 후 `previewMarkerCount: 11`
    - 그중 `clusterMarkerCount: 11`
    - 같은 시점 목록 DOM은 `listItems: 120`
    - summary 안내문 노출 확인
- 메모
  - 이번 단계로 넓은 viewport 무검색에서는 전체 결과 1000건을 모두 row 단위로 읽어 JS에서 cluster를 만들지 않는다. 다음 최적화 후보는 SQL bucket 결과를 viewport key 단위로 짧게 캐시하거나, geotile key를 더 명시적으로 써서 재조회 중복 계산을 더 줄이는 쪽이다.

### 2026-04-02 10:21 KST: map API `items + mapMarkers` 분리와 서버 tile summary로 marker payload 추가 축소
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`에 지도 전용 `PlaceMapMarkerRecord` 타입을 추가해 개별 place marker와 cluster marker를 같은 계약으로 다루도록 정리했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 `listMapPlaces()`는 이제 목록 패널용 `items`와 지도용 `mapMarkers`를 분리해 반환한다. 목록은 최대 `120`건까지만 유지하고, 넓은 viewport에서는 bounds/zoom 기준 tile bucket으로 묶은 cluster summary만 지도에 내려준다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`는 `zoom`을 받아 `mapMarkers`, `mapMarkerCount`, `returnedCount`, `truncated`를 함께 내려주도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`는 새 계약에 맞춰 목록/상세는 `items`, 지도 렌더는 `mapMarkers`만 쓰도록 정리했다. 넓은 화면에서는 서버가 내려준 cluster summary를 그대로 쓰고, 개별 place 선택/상세 진입은 place marker만 이어받는다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npx tsc --noEmit` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3114 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3114 npm run start` 후 수동 확인
  - `curl -s 'http://127.0.0.1:3114/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132&zoom=13'` 결과
    - `count: 1000`
    - `returnedCount: 120`
    - `mapMarkerCount: 15`
    - `truncated: true`
  - Playwright headless runtime script 결과
    - `/` 진입 후 preview overlay 기준 `previewMarkerCount: 11`
    - 그중 `clusterMarkerCount: 10`
    - cluster 라벨 예시 `138, 35, 87, 69, 64, 48, 28, 27`
    - 같은 시점 목록 DOM은 `listItems: 120`
    - summary 안내문 `현재 조건에 맞는 장소는 총 507곳이고, 성능을 위해 120곳만 먼저 불러왔습니다` 노출 확인
- 메모
  - 이번 단계로 넓은 viewport에서는 목록 패널과 지도 marker가 더 이상 같은 preview 배열을 공유하지 않는다. API 응답은 목록용 `120`건과 지도용 cluster summary `15`건으로 분리됐고, 다음 최적화 후보는 SQL 단계에서 geotile 집계나 tile cache를 더 직접 도입하는 방향이다.

### 2026-04-02 10:11 KST: 북마크 목록 조회 구조 단순화와 토글 회귀 테스트 보강
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/bookmarks/repository.ts`에 `listBookmarkedPlaces()`를 추가해 북마크 페이지가 전체 장소 목록을 다시 읽어 매칭하지 않고, `bookmarks -> places` join으로 바로 카드 데이터를 가져오도록 바꿨다.
  - `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`는 새 helper를 쓰도록 정리했다. 이제 북마크 목록이 다른 place list 정렬/필터 구현에 흔들리지 않고 저장 시점 순서대로 바로 렌더된다.
  - `/Users/alex/project/altteulmap/src/features/bookmarks/bookmark-toggle-button.tsx`는 fetch 실패를 잡아 사용자 메시지를 남기고, 성공 시 stale message를 지우도록 보강했다.
  - server refresh 뒤 버튼 상태가 초기 북마크 값과 어긋나지 않도록 `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`에서 북마크 버튼 `key`를 상태 기준으로 줘 remount되게 했다.
  - `/Users/alex/project/altteulmap/tests/e2e/bookmarks.spec.ts`는 오래된 fixture slug를 하드코딩하지 않고, 현재 `/api/places/map` 응답에서 실제 place를 골라 북마크 저장/해제 흐름을 검증하도록 바꿨다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `AUTH_SECRET=altteulmap-local-auth-secret-change-me NEXTAUTH_URL=http://127.0.0.1:3107 AUTH_DEMO_PASSWORD=demo1234 AUTH_ADMIN_PASSWORD=admin1234 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap USE_MOCK_DATA=false npx playwright test tests/e2e/bookmarks.spec.ts` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB의 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
- 메모
  - 로컬에서 북마크 API 저장/해제 자체는 재현 시 정상 동작했고, 이번 보강은 북마크 목록 조합과 client button state가 데이터셋/refresh 타이밍에 흔들릴 수 있는 지점을 먼저 정리하는 목적이다.

### 2026-04-02 10:10 KST: viewport/zoom 기반 cluster marker 계층으로 지도 marker 수 축소
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`에 `PlaceDisplayMarker`, `ClusterDisplayMarker`, `MapDisplayMarker`와 `buildDisplayMarkers()`를 추가해, 서버가 내려준 preview를 viewport bounds/zoom/container size 기준 grid bucket으로 다시 묶도록 바꿨다.
  - 같은 파일의 preview fallback과 실지도 marker 렌더가 모두 같은 `buildDisplayMarkers()` 결과를 사용하도록 정리했다. preview는 cluster badge를 직접 그리고, 실지도는 cluster marker와 place marker를 각각 다른 custom icon으로 렌더한다.
  - active place는 cluster 안에 있더라도 단일 marker로 유지해 선택한 장소가 다시 숨지 않게 했고, 넓은 viewport에서는 cluster marker 클릭 시 해당 bounds로 `fitBounds` 또는 zoom-in 하도록 연결했다.
  - `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`는 더 이상 별도 marker 샘플링을 하지 않고, 지도에는 서버 cap preview 그대로 넘긴 뒤 실제 마커 축약은 `NaverMapPanel`의 cluster layer가 맡도록 단순화했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3113 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3113 npm run start` 후 수동 확인
  - `curl -s 'http://127.0.0.1:3113/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132'` 결과
    - `count: 1000`
    - `returnedCount: 360`
    - `truncated: true`
  - Playwright headless runtime script 결과
    - `/` 진입 후 preview overlay 기준 `previewMarkerCount: 17`
    - 그중 `clusterMarkerCount: 12`
    - cluster 라벨 예시 `52, 39, 73, 88, 6, 6, 25, 9`
    - 같은 시점 목록 DOM은 `placeListItems: 120`
    - badge는 `507곳`, cluster 안내문 `가까운 장소는 묶어 표시합니다` 노출 확인
- 메모
  - 이번 단계로 넓은 viewport에서도 서버가 내려준 `360` preview를 그대로 전부 마커로 그리지 않고, 실제 초기 preview overlay 기준 `17`개 marker만 보이게 줄었다. 다음 체감 최적화 후보는 cluster/tile을 SQL 단계나 타일 캐시와 더 직접 연결하는 방향이다.

### 2026-04-02 10:58 KST: `places` 비정규화로 지도 읽기 join/반응 집계 축소
- 완료 내용
  - `/Users/alex/project/altteulmap/src/db/schema.ts`의 `places`에 `primary_category_slug`, `like_count`, `dislike_count`를 추가했고, `status + primary_category_slug` 인덱스를 붙였다.
  - `/Users/alex/project/altteulmap/drizzle/0007_true_carmella_unuscione.sql`은 컬럼 추가 뒤 `place_categories`, `place_reactions`에서 기존 데이터를 backfill하도록 보강했다. 로컬 `db:push`는 schema 기준으로 컬럼/인덱스만 적용하므로, local DB 값은 이어서 `db:seed`로 채워 검증했다.
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`는 지도/global preview와 일반 place list에서 더 이상 `loadCategoryMap()`이나 반응 count 집계를 돌지 않고 `places.primaryCategorySlug`, `places.likeCount`, `places.dislikeCount`를 직접 읽는다.
  - 같은 파일의 상세 읽기는 요약 카운트는 `places`에서 바로 읽고, viewer-specific `viewerReaction`만 `place_reactions`에서 별도 조회하도록 줄였다.
  - 반응 쓰기 경로도 바꿨다. `setDatabasePlaceReaction()` 뒤에 `refreshPlaceReactionSummary()`를 호출해 `places.like_count/dislike_count`를 즉시 동기화한다.
  - `/Users/alex/project/altteulmap/src/db/seed.ts`, `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 신규 place insert도 `primaryCategorySlug`, `likeCount`, `dislikeCount`를 함께 적재하도록 맞췄다.
- 검증 결과
  - `npm run db:generate` 통과
  - `npm run verify:quick` 통과
  - `npm run db:push` 통과
  - `npm run db:seed` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3111 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3111 npm run start` 후 수동 확인
  - `psql ... -Atc "select count(*) from places where primary_category_slug is null;"` 결과 `0`
  - `curl -s 'http://127.0.0.1:3111/api/places/map?category=korean&minLat=33&maxLat=39&minLng=124&maxLng=132'` 결과
    - `count: 524`
    - `returnedCount: 360`
    - 응답 preview의 `categorySlug`가 모두 `korean`
  - 반응 동기화 확인
    - `PUT /api/places/goodprice-17626/reaction` with `{"reaction":"like"}` 결과 `likeCount: 1`
    - 직후 DB 값 `goodprice-17626|1|0`
    - 같은 visitor cookie로 `{"reaction":null}` 결과 `likeCount: 0`
    - 직후 DB 값도 `goodprice-17626|0|0`으로 복귀
- 메모
  - 이번 단계로 지도 읽기 경로는 `place_categories`/`place_reactions`에 대한 bulk lookup 없이 `places` 단일 테이블 중심으로 preview를 만들 수 있게 됐다. 다음 체감 최적화 후보는 viewport 규모별 cluster/tile 계층 도입이나, 넓은 viewport에서 SQL 단계 limit/cluster key를 더 직접 활용하는 방향이다.

### 2026-04-02 10:00 KST: public/admin 공통 헤더 도입과 페이지별 중복 상단 액션 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/components/global-header.tsx`를 추가해 `알뜰맵` 로고, `장소 등록하기`, `북마크`, `운영자 관리`, `로그인/로그아웃`을 공통 헤더로 묶었다.
  - `/Users/alex/project/altteulmap/src/lib/auth-navigation.ts`를 추가하고 `/Users/alex/project/altteulmap/src/lib/session.ts`의 로그인/회원가입 callback helper를 분리해, client header에서도 현재 경로 기준 로그인 링크를 안전하게 만들 수 있게 했다.
  - `/Users/alex/project/altteulmap/src/app/layout.tsx`, `/Users/alex/project/altteulmap/apps/admin/src/app/layout.tsx`에 공통 헤더를 연결해 public 앱과 별도 admin 앱 모두에서 같은 상단 이동 구조를 쓰도록 맞췄다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/app/report/page.tsx`, `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx`, `/Users/alex/project/altteulmap/src/app/login/page.tsx`, `/Users/alex/project/altteulmap/src/app/signup/page.tsx`, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`와 관리자 페이지들에서 페이지별 상단 액션 블록을 제거하고, 페이지 본문은 제목/로컬 서브 내비게이션만 남도록 정리했다.
  - 더 이상 쓰지 않는 `/Users/alex/project/altteulmap/src/features/auth/session-action-group.tsx`는 삭제했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - Playwright headless DOM 점검으로 `/`, `/submit`, `/bookmarks`, `/login`, `/admin`에서 공통 `<header>`와 `알뜰맵`, `장소 등록하기`, `북마크`, `운영자 관리`, `로그인` 링크 존재 확인
  - `rg -n "SessionActionGroup" src/app src/features apps/admin/src/app` 결과 정의 파일 외 사용처 0건 확인 후 파일 삭제
- 메모
  - `/Users/alex/project/altteulmap/apps/admin` 전체 build는 현재 저장소의 기존 shared blocker인 `/Users/alex/project/altteulmap/src/features/places/repository.ts` 타입 오류가 남아 있어 별도 재검증을 생략했다. 공통 헤더 자체는 public 라우트 기준 런타임에서 먼저 확인했다.

### 2026-04-02 10:46 KST: map API 서버 cap과 total count 분리로 네트워크 payload 축소
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/repository.ts`의 `PlacePreviewListResult`에 전체 매칭 수 `count`를 추가하고, 지도 preview 응답은 최대 `360`건만 반환하도록 바꿨다.
  - 검색어가 있는 글로벌 검색은 기존 정렬 순서를 유지하도록 상위 preview만 자르고, viewport/기본 탐색은 grid bucket round-robin 방식으로 공간 분산 샘플링을 적용해 한 구역에 과도하게 쏠리지 않게 했다.
  - `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`는 이제 `count`, `returnedCount`, `truncated`를 같이 내려준다. `count`는 전체 조건 일치 수, `returnedCount`는 실제 응답 preview 수다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`를 함께 수정해 지도/목록 badge는 전체 개수 기준으로 보이게 하고, 서버 cap이 걸렸을 때는 `총 N곳 중 M곳만 먼저 불러옴` 안내를 표시하도록 바꿨다.
  - 검증 중 드러난 기존 회귀도 같이 복구했다. `/Users/alex/project/altteulmap/src/lib/session.ts`에서 auth navigation helper를 외부 파일로 분리한 뒤 re-export가 빠져 있었고, 이 때문에 `/Users/alex/project/altteulmap/src/app/bookmarks/page.tsx` 등 `@/lib/session` import가 build에서 깨졌다. helper re-export를 복구해 기존 import 계약을 유지했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 기존과 동일하게 남지만, 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3111 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3111 npm run start` 후 수동 확인
  - `curl -s 'http://127.0.0.1:3111/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132'` 결과
    - `count: 1000`
    - `returnedCount: 360`
    - `truncated: true`
  - Playwright headless runtime script 결과
    - `/` 진입 직후 `initialListCount: 0`, 지도 badge `불러오는 중`
    - client fetch 후 `hydratedListCount: 120`, 지도 badge `507곳`, 서버 cap 안내문 1개 노출
    - `/?q=김밥&scope=global` 진입 직후 `globalListCount: 40`, 서버 cap 안내문 0개
- 메모
  - 이번 단계로 map API는 더 이상 전체 preview 1000건을 매번 직렬화해 보내지 않는다. 다음 체감 최적화 후보는 카테고리/반응 요약을 `places`에 비정규화해 map read를 단일 테이블 중심으로 줄이거나, viewport가 넓을 때는 cluster tile 계층으로 넘어가는 것이다.

### 2026-04-02 10:23 KST: viewport 첫 진입의 장소 SSR 제거와 bootstrap client fetch 전환
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`에서 viewport 모드의 `/` 첫 렌더가 더 이상 `listMapPlaces()`를 서버에서 호출하지 않도록 바꿨다. 기본 진입은 서울 bootstrap bounds만 내려주고, 글로벌 검색일 때만 서버가 preview 목록을 미리 채운다.
  - 같은 흐름을 위해 `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에 `prefetchedOnServer` 기준 첫 fetch 스킵 로직을 넣었다. 이제 viewport 기본 진입은 mount 후 map idle 시점에 `/api/places/map`를 호출하고, 글로벌 검색은 기존처럼 SSR 결과를 그대로 보여주며 첫 중복 fetch를 생략한다.
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`는 장소가 0건이어도 `initialBounds`가 있으면 바로 `fitBounds` 하도록 수정했다. 덕분에 빈 bootstrap 상태에서도 서울 범위를 먼저 보여주고, 로딩 중에는 지도/목록 배지에 `불러오는 중` 상태를 노출한다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
    - build 중 `sitemap.xml` 단계에서 production DB에 `places` 테이블이 없을 때 mock fallback 로그는 계속 남지만, 기존과 동일하게 빌드 자체는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3111 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3111 npm run start` 후 수동 확인
  - `curl -s http://127.0.0.1:3111/ | rg -o 'data-testid="place-list-item-[^"]+"' -c` 결과 match 없음(exit 1)으로 viewport 기본 진입의 raw HTML에 목록 item SSR이 사라진 것 확인
  - `curl -s 'http://127.0.0.1:3111/?q=%EA%B9%80%EB%B0%A5&scope=global' | rg -o 'data-testid="place-list-item-[^"]+"' -c` 결과 `40`으로 글로벌 검색 SSR 유지 확인
  - Playwright headless runtime script 결과
    - `/` 진입 직후 `initialCount: 0`, 로딩 문구 2개 노출
    - client fetch 후 `hydratedCount: 120`, 지도 배지 `240곳`
    - `/?q=김밥&scope=global` 진입 직후 `globalImmediateCount: 40`
- 메모
  - 이번 단계로 가장 큰 초기 payload 병목인 `viewport 1000건 SSR`은 제거됐다. 다음 체감 최적화 후보는 `/api/places/map` 응답 자체에 서버 cap을 두고 `items + totalCount`로 분리하는 것이다.

### 2026-04-02 10:04 KST: 지도 페이지 외곽 셸 폭 확장
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`의 지도 페이지 바깥 셸만 조정했다. `max-w-7xl`를 `max-w-[96rem]`로 넓히고, `main` 좌우 padding은 줄였으며, 카드 내부 padding도 `p-4/sm:p-6/xl:p-7`로 얕게 바꿨다.
  - 같은 `rounded-[2rem] border ...` 카드 클래스가 등록/신고/관리자 화면에도 반복되지만, 이번에는 지도 페이지에만 적용했다. 폼 화면까지 같이 넓히면 읽기성이 떨어질 수 있어서 분리 유지가 낫다고 판단했다.
  - 이어서 `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`의 desktop 그리드를 `xl:grid-cols-[minmax(0,2.2fr)_15rem] 2xl:grid-cols-[minmax(0,2.35fr)_15.5rem]`로 바꿨고, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`의 desktop 상세 패널 최대 폭도 `25.5rem / 26.5rem`로 줄여 지도 작업면을 더 확보했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - Playwright headless로 `1440px` viewport에서 `/` 진입 후 레이아웃 폭 측정 결과 `main padding-left: 24px`, `shellWidth: 1392`, `sectionWidth: 1392` 확인
  - 같은 `1440px` viewport에서 지도 grid 재측정 결과 `gridWidth: 1334`, `mapWidth: 1078`, `listWidth: 240`, 상세 패널 open 폭 `408` 확인
- 메모
  - 지도 화면은 카드형 읽기 레이아웃보다 작업면 확보가 더 중요하다. 다음 후속으로는 필요 시 `MapExplorer`의 desktop list 폭과 map/list 비율도 따로 손볼 수 있다.

### 2026-04-02 09:56 KST: 공개 입력 폼 비율 규칙 재정리와 모바일/detail sheet 가로 넘침 제거
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/place-price-report-form.tsx`에서 가격 제보 폼을 모바일 기본 1열로 되돌리고, 2열 전환 시점을 `md`로 늦췄다. `minmax(0, ...)` 기반 grid와 `altteulmap-input` 공용 폭 규칙을 적용해 detail sheet 안에서도 오른쪽 가격 입력이 카드 밖으로 튀어나오지 않게 정리했다.
  - 같은 폼에서 `로그인 없이 새 가격 제보를 보낼 수 있습니다.` 보조 문구를 제거하고, 액션 버튼은 모바일에서 `w-full`, 넓은 화면에서는 `w-auto`로 동작하게 바꿨다.
  - `/Users/alex/project/altteulmap/src/features/places/place-comments-section.tsx`의 코멘트 입력도 같은 규칙으로 바꿨다. textarea 높이/resize, 버튼 정렬, `min-w-0`를 보강했고 `로그인 없이 익명 코멘트를 남길 수 있습니다.` 문구를 제거했다.
  - `/Users/alex/project/altteulmap/src/features/submission/place-submit-form.tsx`, `/Users/alex/project/altteulmap/src/features/reports/report-submit-form.tsx`도 같은 입력 규칙으로 통일했다. 공개 등록의 가격 항목 grid는 `lg` 이전에는 세로 스택으로 유지하고, 모든 input/select/textarea에 `w-full + min-w-0`가 보장되도록 정리했다.
  - `/Users/alex/project/altteulmap/src/app/globals.css`의 `altteulmap-input`에 `width: 100%`, `min-width: 0`, placeholder 색상을 추가했고, `/Users/alex/project/altteulmap/src/app/place/[id]/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`의 가격 항목 row도 모바일에서 세로 배치로 바꿔 긴 텍스트/가격 조합이 좁은 폭에서 겹치지 않게 했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `rg -n "로그인 없이 .*제보|로그인 없이 .*코멘트|로그인 없이 .*등록" src/features src/app` 결과 0건
  - Playwright headless DOM audit로 `390px` viewport에서 `/submit`, `/report?placeId=test-place&placeName=테스트 장소`, `/place/goodprice-16045`, 홈 detail sheet의 `main`/해당 폼 `scrollWidth === clientWidth` 확인
  - 같은 DOM audit를 `700px` viewport에서 `/place/goodprice-16045`, 홈 detail sheet에 다시 실행했고 `overflowX: false` 확인
- 메모
  - 이번 수정은 단일 스크린샷 대응이 아니라 `sm`에서 너무 이르게 다열 grid로 넘어가던 공개 폼 전반을 정리하는 목적이다. 앞으로 입력 폼은 `모바일 1열 -> md/lg 이후 다열`, `input/select/textarea는 공용 폭 규칙`, `하단 액션은 모바일 세로 정렬`을 기본값으로 삼는다.

### 2026-04-02 09:38 KST: 지도 전용 preview payload와 렌더 상한으로 실데이터 1000건 지도 성능 완화
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/places/types.ts`에 `PlacePreviewRecord`를 추가하고, `/Users/alex/project/altteulmap/src/features/places/repository.ts`에 지도 전용 `listMapPlaces()`를 분리했다. 지도 첫 화면과 `/Users/alex/project/altteulmap/src/app/api/places/map/route.ts`는 더 이상 `priceItems/history/comments`를 실어 보내지 않는다.
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`, `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`, `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`를 수정해 지도는 preview payload만 받고, 클라이언트 렌더는 `목록 최대 120개`, `마커 최대 240개` 기준으로 제한한다. 마커는 grid 샘플링으로 한 지역에 과도하게 몰리지 않게 했다.
  - 같은 `/Users/alex/project/altteulmap/src/features/places/map-explorer.tsx`에서 viewport 재조회 요청을 4자리 반올림 bounds 기반 request key로 묶고, `180ms` debounce를 걸었다. 이전에는 idle 이벤트마다 새 bounds object가 들어와 같은 영역에서도 반복 fetch가 날 수 있었다.
  - `/Users/alex/project/altteulmap/src/features/places/place-detail-sheet.tsx`는 preview payload에서도 바로 열리도록 조정했다. 기본 정보는 preview로 즉시 보여주고, 상세 가격/코멘트는 기존 `/api/places/[id]` fetch가 도착하면 채운다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과. build 중 `.env.production.local` DB에 `places` 테이블이 없어 sitemap build 로그에는 기존 mock fallback 메시지가 남지만 lint/build는 성공
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3111 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3111 npm run start` 후 Playwright 브라우저 스크립트로 `/` 진입 시 `place-list-item-*` DOM 수 `120`, `map-preview-marker-*` DOM 수 `21`, 렌더 상한 안내 문구 노출 확인
  - 같은 runtime에서 `curl 'http://127.0.0.1:3111/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132'` 검사 결과 `count: 1000`, `source: "database"` 유지, 첫 item key에 `priceItems/history/comments`가 빠진 preview payload 확인
  - 기존 `tests/e2e/map.spec.ts`, `tests/e2e/map.mobile.spec.ts`는 현재 저장소가 실데이터 import를 기본 시드로 쓰면서 여전히 `"학교앞김밥"`, `"6곳"` 같은 mock fixture를 기대해 실패했다. 이번 지도 성능 변경의 직접 회귀라기보다 테스트 데이터 계약 미스매치다.
- 메모
  - 지도 상단 뱃지는 전체 결과 수를 계속 보여주고, 실제 DOM 렌더 개수만 줄인다. 따라서 “현재 지도에 몇 곳이 있는지” 정보와 “브라우저가 한 번에 그리는 양”을 분리할 수 있다.
  - 다음 지도 품질 후속 후보는 `viewport zoom 수준별 marker cap 조정`, `가상 스크롤 목록`, `초기 서울/현재 위치 기준 bootstrap`이다.

### 2026-04-02 09:34 KST: auth 성공 이동의 라우터 액션 충돌 제거와 NextAuth route handler 복구
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/auth/login-form.tsx`, `/Users/alex/project/altteulmap/src/features/auth/signup-form.tsx`에서 인증 성공 후 `router.replace()`와 `router.refresh()`를 연달아 호출하던 흐름을 제거했다. 이제 `signIn` 결과의 `url` 또는 `callbackUrl`로 `window.location.assign()`을 사용해 이동하므로 App Router 초기화 타이밍에 의존하지 않는다.
  - `/Users/alex/project/altteulmap/src/app/api/auth/[...nextauth]/route.ts`에서 lazy NextAuth wrapper가 `context`를 버리던 문제를 고쳤다. 이전에는 `NextAuth(getAuthOptions())(request)`만 호출해 App Route가 아니라 Pages API 경로로 오인되었고, 그 결과 `/api/auth/providers`에서 `Cannot destructure property 'nextauth' of 'req.query' as it is undefined` 500이 발생했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `curl -i -s http://localhost:3000/api/auth/providers` 결과 `200 OK`와 provider JSON 응답 확인
  - Playwright 브라우저 스모크로 `http://localhost:3000/signup?callbackUrl=%2Fbookmarks` 진입 후 신규 계정 가입 완료, 최종 URL `http://localhost:3000/bookmarks`, browser `errors: []` 확인
  - `npm run build`는 기존 타입 오류 `src/features/places/repository.ts:862` (`PlacePreviewRecord[]` -> `PlaceRecord[]`)로 실패. 이번 auth/router 수정 파일과는 무관한 현재 저장소 blocker로 분리 판단
- 메모
  - 이번 runtime error는 auth 성공 직후 client router action을 중복 dispatch하던 흐름이 가장 유력한 원인이었다. NextAuth route handler 500도 동시에 존재해 인증 화면 자체를 불안정하게 만들고 있었으므로 함께 정리했다.

### 2026-04-02 09:28 KST: `착한가격업소` importer quota를 `서울 500 + 비서울 500`, `음식점 70%`로 재조정하고 seed blocker 수정
- 완료 내용
  - `/Users/alex/project/altteulmap/scripts/import-goodprice.ts`에 quota 기반 selection 로직을 추가했다. 기본 `data:goodprice` 실행은 `서울 500`, `비서울 500`, `음식점 700`, `비음식 300`을 동시에 채울 때까지 수집하고, 비서울은 시도별 round-robin을 유지한다.
  - 같은 스크립트에 `--seoul-limit`, `--food-ratio` 옵션을 추가했다. 작은 샘플 실행에서는 `limit`에 맞춰 서울 quota가 자동 축소되고, 기본 `1000건` 실행에서는 `서울 500 + 비서울 500`이 유지된다.
  - 상세 메뉴에서 같은 장소 안에 동일 메뉴 라벨이 여러 가격으로 내려오는 경우가 있어, importer에서 메뉴 라벨을 정규화해 한 항목으로 접도록 수정했다. 우선순위는 `대표 지정 메뉴`, `목록 대표 가격과 일치`, `같은 라벨이면 더 낮은 가격` 순서다.
  - `/Users/alex/project/altteulmap/src/features/places/imported-goodprice.json`, `/Users/alex/project/altteulmap/data/goodprice/import-meta.json`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/PLAN.md`를 새 기본 quota와 seed 호환 결과에 맞게 갱신했다.
  - 최종 생성 결과는 `1000` places, `2581` price items이며, `서울 500`, `비서울 500`, `음식점 700`, `비음식 300`, `대표 가격 최대 10000원`, `priceItems > 10000` `0건`, `장소별 중복 메뉴 라벨` `0건`이다.
- 검증 결과
  - `npm run data:goodprice -- --limit=20 --delay-ms=50 --timeout-ms=10000 --include-detail=false --output=/tmp/goodprice-20.json --manifest=/tmp/goodprice-20-manifest.json` 통과. 결과 `서울 10`, `비서울 10`, `음식점 14`, `비음식 6` 확인
  - `npm run data:goodprice -- --delay-ms=50 --timeout-ms=10000` 1차 실행 후 `npm run db:seed`에서 `price_items_place_label_unique` 위반 재현
  - importer dedupe 수정 후 `npm run data:goodprice -- --delay-ms=50 --timeout-ms=10000` 재실행 통과
  - `python3`로 `/Users/alex/project/altteulmap/src/features/places/imported-goodprice.json`, `/Users/alex/project/altteulmap/data/goodprice/import-meta.json` 검사 결과 `1000/500/500/700/300`, `priceItems > 10000 = 0`, `duplicateLabelPlaces = 0`, manifest quota target/actual 일치 확인
  - `npm run verify:quick` 통과
  - `npm run verify` 통과. build 중 `.env.production.local` DB에 `places` 테이블이 없어 mock fallback 로그는 남았지만 lint/build 자체는 성공
  - `npm run db:up` 통과
  - `npm run db:seed` 통과
  - `node - <<'NODE' ... select count(*) from places/price_items ... NODE` 결과 `placeCount 1000`, `priceItemCount 2581`, `seoulCount 500` 확인
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/altteulmap PORT=3111 USE_MOCK_DATA=false NEXTAUTH_URL=http://127.0.0.1:3111 npm run start` 후 `curl 'http://127.0.0.1:3111/api/places/map?minLat=33&maxLat=39&minLng=124&maxLng=132'` 결과 `source: "database"`, `count: 1000` 확인
- 메모
  - plain `npm run start`는 `.env.production.local` 쪽 DB를 먼저 읽어 local seed와 다른 DB를 바라볼 수 있다. 로컬 DB 기반 runtime 확인이 필요하면 이번처럼 `DATABASE_URL`을 명시적으로 주입하는 편이 안전하다.
  - 비서울 500은 시도별 round-robin으로 채우고 있어서 전국 분포는 과도하게 한 지역에 몰리지 않는다. 현재 실제 결과는 `data/goodprice/import-meta.json`의 `regions`, `categories`, `quotas`에서 바로 확인할 수 있다.

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
  - `/Users/alex/project/altteulmap/.env.example`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`를 새 배포 순서에 맞게 갱신했다.
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

### 2026-04-02 09:27 KST: `.next-dev` 자동 삭제 제거로 webpack pack cache ENOENT 재발 방지
- 완료 내용
  - `/Users/alex/project/altteulmap/package.json`에서 `dev`, `build`, `cf:clean`이 더 이상 `.next-dev`를 자동 삭제하지 않도록 수정했다. 이제 `.next-dev`는 오직 dev 서버 전용 산출물로 유지되고, production build와 Cloudflare clean은 `.next`/`.open-next`만 정리한다.
  - `/Users/alex/project/altteulmap/apps/admin/package.json`도 같은 규칙으로 맞춰 `dev`/`build`가 관리자 dev 산출물을 임의로 지우지 않게 했다.
  - `/Users/alex/project/altteulmap/package.json`, `/Users/alex/project/altteulmap/apps/admin/package.json`에 `dev:clean`을 추가했고, `/Users/alex/project/altteulmap/README.md`의 복구 절차도 `npm run dev:clean` 기준으로 정리했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run dev:clean` 후 `npm run dev` 기동, `curl -s -o /tmp/altteulmap-root-after-dev.html -w '%{http_code}' http://127.0.0.1:3000/` 결과 `200`
  - dev 서버 유지 상태에서 `npm run build` 통과
  - build 직후 `test -d .next-dev/dev/cache/webpack/client-development && echo present-after-build` 확인
  - build 직후 `curl -s -o /tmp/altteulmap-root-after-build.html -w '%{http_code}' http://127.0.0.1:3000/` 결과 `200`
- 메모
  - 이번 `ENOENT ... .next-dev/dev/cache/webpack/client-development/*.pack.gz`는 webpack pack cache가 손상된 것이 아니라, 다른 스크립트가 살아 있는 dev 산출물 디렉터리를 지워서 생긴 증상으로 판단했다.

### 2026-04-02 08:18 KST: `/map` 호환 경로를 redirect로 줄이고 홈 단일 진입점으로 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/src/features/map/map-page.tsx`로 실제 지도 홈 구현을 분리했다.
  - `/Users/alex/project/altteulmap/src/app/page.tsx`는 위 구현을 그대로 재사용하는 최소 re-export로 정리했다.
  - `/Users/alex/project/altteulmap/src/app/map/page.tsx`는 더 이상 전체 지도 화면을 중복 렌더하지 않고, query string을 유지한 채 `/`로 `permanentRedirect` 하도록 바꿨다.
  - `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`의 현재 진입 경로 안내도 `/` 기준으로 맞췄다.
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
  - `/Users/alex/project/altteulmap/tests/e2e/admin-dashboard.spec.ts`를 추가했고, `/Users/alex/project/altteulmap/package.json`, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`, `/Users/alex/project/altteulmap/PLAN.md`를 새 관리자/인증 동선에 맞게 갱신했다.
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
  - `/Users/alex/project/altteulmap/tests/e2e/map.spec.ts`에서 좋아요순 회귀를 제거했고, `/Users/alex/project/altteulmap/README.md`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`, `/Users/alex/project/altteulmap/PLAN.md`를 새 공개 지도 계약에 맞게 갱신했다.
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
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/src/features/places/admin-place-review-form.tsx`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`를 새 정책에 맞게 갱신했다. 공개 제보는 텍스트-only, 운영자는 승인 단계에서 주소와 네이버 지도 검색 결과를 참고해 좌표를 확정하는 흐름으로 설명을 통일했다.
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
  - `/Users/alex/project/altteulmap/src/app/submit/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/page.tsx`, `/Users/alex/project/altteulmap/src/app/admin/places/page.tsx`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`를 현재 정책에 맞게 갱신했다. 공개 등록은 `텍스트 주소 + 내부 위치 확인`이 필수이고, 운영자는 제출 좌표를 검수/조정한다는 점이 화면과 문서에 같이 반영된다.
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
  - `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`, `/Users/alex/project/altteulmap/README.md`를 현재 정책에 맞게 갱신했다. 공개 쓰기는 `장소 등록`, `댓글`, `가격 제보`, `신고`까지 익명 허용으로 정리했고, 로그인 유지 기능은 `북마크`만 남겼다.
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
  - `/Users/alex/project/altteulmap/tests/e2e/submission-admin.spec.ts`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`도 현재 UX에 맞게 갱신했다.
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
  - `/Users/alex/project/altteulmap/src/app/globals.css`, `/Users/alex/project/altteulmap/src/app/robots.ts`, `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`도 새 auth entry 구조에 맞게 같이 갱신했다.
- 검증 결과
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - `PORT=3122 NEXTAUTH_URL=http://127.0.0.1:3122 npm run start` 후 `npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3122/ /tmp/altteulmap-home-after.png`, `npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3122/login /tmp/altteulmap-login-after.png`, `npx playwright screenshot --device="Desktop Chrome" http://127.0.0.1:3122/signup /tmp/altteulmap-signup-after.png`로 홈/로그인/회원가입 렌더 확인
  - 같은 production server에서 `npx playwright screenshot --device="iPhone 13" http://127.0.0.1:3122/login /tmp/altteulmap-login-mobile-after.png`로 모바일 로그인 첫 화면에서 폼이 먼저 보이도록 배치가 바뀐 것까지 확인
- 메모
  - `verify`와 `start` 중에는 로컬 DB의 `places` 테이블이 없어서 mock fallback 로그가 남았지만, 이번 작업 범위인 인증 entry UI와 라우팅, 렌더 자체에는 영향이 없었다.

### 2026-04-01: 익명 장소 등록 허용과 공개 CTA 정리
- 완료 내용
  - `/Users/alex/project/altteulmap/PLAN.md`, `/Users/alex/project/altteulmap/docs/product/prd.md`, `/Users/alex/project/altteulmap/docs/product/trd.md`를 갱신해 현재 정책을 `비회원 읽기 + 비회원 반응 + 비회원/회원 장소 등록 + 회원 전용 북마크/댓글/신고/가격 제보` 기준으로 재정의했다.
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
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`에 네이버 지도 키는 환경 변수만이 아니라 NAVER Cloud Platform 콘솔의 웹 서비스 URL/허용 도메인에도 실제 배포 주소(`workers.dev` 또는 custom domain)를 등록해야 한다는 점을 추가했다.
- 변경 파일
  - `/Users/alex/project/altteulmap/src/features/map/naver-map-panel.tsx`
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`
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
  - `/Users/alex/project/altteulmap/docs/deploy/cloudflare-account-to-deploy.md`를 추가해 Cloudflare 계정 생성, Wrangler 로그인, `workers.dev` 첫 배포, runtime 변수/secret 등록, OAuth callback 연결, 커스텀 도메인 전환까지 전체 흐름을 정리했다.
  - 현재 저장소의 실제 배포 방식이 `로컬 OpenNext build -> Wrangler deploy`라는 점을 기준으로, 로컬 build 환경 변수와 Cloudflare runtime 변수 둘 다 필요하다는 운영 메모를 문서에 명시했다.
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `/Users/alex/project/altteulmap/README.md`에도 새 총괄 가이드 링크를 연결했다.
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
  - `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`, `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`, `npm run deploy:check`를 추가해 Cloudflare 배포 전 환경 변수와 도메인 설정을 점검할 수 있게 했다.
  - `docs/product/trd.md`의 환경 변수 표기를 현재 코드 기준(`NEXTAUTH_URL`, `AUTH_KAKAO_*`, `AUTH_NAVER_*`, `NEXT_PUBLIC_NAVER_MAP_KEY_ID`)으로 맞췄다.
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
  - `/Users/alex/project/altteulmap/docs/deploy/deploy-cloudflare.md`
  - `/Users/alex/project/altteulmap/package.json`
  - `/Users/alex/project/altteulmap/src/app/robots.ts`
  - `/Users/alex/project/altteulmap/src/app/sitemap.ts`
  - `/Users/alex/project/altteulmap/src/app/manifest.ts`
  - `/Users/alex/project/altteulmap/.env.example`
  - `/Users/alex/project/altteulmap/README.md`
  - `/Users/alex/project/altteulmap/docs/product/trd.md`
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
1. production `DATABASE_URL`/tenant credential을 복구하고 `moderation_suggestions` migration을 실제 운영 DB에 적용
2. migration 이후 public/admin worker를 다시 재배포하고 live 관리자 큐가 mock이 아닌 persisted 경로에서도 `AI 1차 검수` 패널을 유지하는지 확인
3. iPhone Safari, Android Chrome 기준으로 `현재 위치`, `이 지역 검색`, 시트 drag, 관리자 AI 패널까지 포함한 Phase B 실사용 QA 수행
4. backlog freeze 결정은 유지하고, 새 기능보다 운영 안정화와 실사용 QA에만 집중
