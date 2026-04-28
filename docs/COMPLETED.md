# COMPLETED.md

기준일: 2026-04-17

## 목적
- 이 문서는 완료된 작업의 archive다.
- raw snapshot을 그대로 붙여넣지 않고, 사람이 다시 읽기 쉬운 형식으로 정리한다.
- 완료 archive는 작업 종료 시점의 `PROGRESS.md` 내용을 정리해 옮기는 것을 기본값으로 한다.
- 문서는 시간 오름차순으로 유지한다. 가장 최근에 끝난 작업이 가장 아래에 오도록 append한다.

## archive 번호 규칙
- archive 번호는 이 문서에만 존재한다.
- 새 항목을 추가할 때는 마지막 번호 다음 순번을 사용한다.
- 번호는 append 순서 기준의 연속 번호로만 증가시킨다.
- 번호를 재사용하거나 active 문서 번호와 맞추려 하지 않는다.
- active 문서인 `PLAN.md`, `PROGRESS.md`는 archive 번호를 공유하지 않는다.

<a id="archive-001"></a>
## `001` 운영 문서 체계와 지도 검색/URL 상태 반영
- 완료일: `2026-03-30`
- 배경:
  - 작업이 이어질수록 문서가 흐트러지고 있었고, 지도 검색도 지역/전역 검색과 URL 상태가 분리돼 있어 다음 세션이 맥락을 잇기 어려운 상태였다.
- 변경 내용:
  - `PLAN.md`와 `PROGRESS.md`를 운영 문서 형식으로 재정리했다.
  - `/map`에 지역/전역 검색과 `q/scope` 기반 URL 상태 반영을 추가했다.
- 코드/문서:
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/product/prd.md`
  - `docs/product/trd.md`
  - `src/app/map/page.tsx`
  - `src/features/places/map-explorer.tsx`
  - `src/features/places/repository.ts`
  - `src/app/api/places/map/route.ts`
- 검증:
  - lint/build/runtime 검증을 다시 돌려 문서 구조 변경과 검색 계약 변경이 동시에 깨지지 않는지 확인했다.
- 결과:
  - 문서 운영과 지도 검색 상태 관리의 기본 틀이 함께 잡혔고, 이후 cycle에서 `q/scope`를 기준으로 search URL 상태를 계속 이어갈 수 있게 됐다.

<a id="archive-002"></a>
## `002` 댓글과 기존 장소 가격 제보 구현
- 완료일: `2026-03-31`
- 배경:
  - 읽기 중심 MVP에서 쓰기 루프가 약했고, 기존 장소에 새 가격을 얹는 경로와 코멘트 축적 경로가 빠져 있었다.
- 변경 내용:
  - 장소 상세/상세 시트에서 댓글 작성·삭제와 기존 장소 가격 추가 제보 흐름을 구현했다.
  - 관리자 가격 검토 큐로 연결했다.
- 코드/문서:
  - `src/features/places/repository.ts`
  - `src/features/places/place-comments-section.tsx`
  - `src/features/places/place-price-report-form.tsx`
  - 관련 관리자 검토 경로
- 검증:
  - 운영자 로그인 후 `/admin/prices`에 `가격 제보 검토 큐`가 렌더되는지 확인했다.
  - mock runtime에서도 댓글/가격 제보 route contract와 권한 분기를 점검했다.
- 결과:
  - 공개 읽기 이후의 대표 쓰기 루프가 처음으로 완성됐고, 이후 가격 검증/관리자 가격 수정 작업으로 자연스럽게 이어질 기반이 생겼다.

<a id="archive-003"></a>
## `003` 가격 검증과 관리자 가격 관리 정리
- 완료일: `2026-04-01`
- 배경:
  - 가격 제보가 들어와도 대표 가격 산정과 검증 규칙이 화면과 운영 경로에서 일관되지 않았고, 공개 쓰기 API에는 최소한의 운영 보호 장치가 필요했다.
- 변경 내용:
  - 대표 가격 산정 규칙, 동일 가격 2회 검증, 관리자 가격 수정/비활성화, 공개 쓰기 API 최소 rate limit을 한 묶음으로 정리했다.
- 코드/문서:
  - `src/features/places/repository.ts`
  - `src/app/api/places/**`
  - `src/app/api/reports/**`
  - 관리자 페이지
  - `src/lib/rate-limit.ts`
- 검증:
  - 일반 사용자 가격 제보 승인 후 대표 가격이 `3800원`으로 갱신되고 `unverified` 상태가 공개 상세에 반영되는지 확인했다.
  - 댓글 11회 연속 제출 시 11번째 요청이 `429`로 차단되는 것도 확인했다.
- 결과:
  - 가격 검증 규칙과 운영 수정 흐름이 코드와 화면 기준으로 일치하게 됐고, 이후 공개 쓰기 확장 작업에도 공통 rate limit 기반을 재사용할 수 있게 됐다.

<a id="archive-004"></a>
## `004` 로그인, 운영자 대시보드, visit telemetry 기반 마련
- 완료일: `2026-04-02`
- 배경:
  - 로그인 후 상태 변화가 상단에서 명확히 보이지 않았고, 운영자는 승인 대기 수나 세션 수 같은 기본 운영 지표를 한 화면에서 보기 어려웠다.
- 변경 내용:
  - 로그인 상태 액션, 운영자 overview, 방문 이벤트 적재와 활동 지표 노출 경로를 단계적으로 정리했다.
- 코드/문서:
  - `src/features/admin/repository.ts`
  - 공통 헤더와 관련 `src/app/**`, `src/features/auth/**`
  - 방문 이벤트 적재 경로와 `/admin` overview
- 검증:
  - 관리자 overview에 기본 집계가 노출되는지 확인했다.
  - 로그인 상태에서 로그아웃 버튼과 운영자 진입 링크가 정상 노출되는지 확인했다.
  - 이후 visit/activity 적재가 붙은 뒤에는 오늘/7일 방문 수, 고유 방문자 수, DAU/WAU, 재방문율이 overview에서 보이는 것도 점검했다.
- 결과:
  - 운영자는 장소 등록/가격 제보/신고 큐와 사용자/방문 지표를 같은 대시보드에서 확인할 수 있게 됐다.

<a id="archive-005"></a>
## `005` split deploy, smoke, rate-limit 운영 경로 정리
- 완료일: `2026-04-03`
- 배경:
  - public/admin split 배포, env precedence, smoke, 운영자 외부 앱 cutover, 공개 쓰기 정책 관측이 따로 움직여 배포/운영 복기가 어려웠다.
- 변경 내용:
  - split deploy와 smoke 경로를 고정했다.
  - 쉘·CI env가 로컬 `.env*`보다 우선하도록 스크립트를 정리했다.
  - 공개 쓰기 rate-limit 정책과 응답 헤더, 사용자 안내를 운영 가능한 수준으로 맞췄다.
- 코드/문서:
  - `scripts/check-cloudflare-deploy.mjs`
  - `scripts/build-public-worker.mjs`
  - `package.json`
  - `README.md`
  - `docs/deploy/deploy-cloudflare.md`
  - `src/lib/rate-limit.ts`
  - `src/lib/public-write-actor.ts`
  - `src/app/api/**`
  - `scripts/**`의 `smoke:local`, `smoke:remote`
- 검증:
  - `deploy:check:admin -> deploy:admin -> deploy:check:public -> deploy:public`
  - `smoke:remote`
  - 운영 URL, redirect, SEO 엔드포인트, external stub 계약을 반복 확인했다.
- 결과:
  - 운영 점검과 fallback 배포 경로가 반복 가능한 형태로 정리됐다.

<a id="archive-006"></a>
## `006` 공개 반응/공유/telemetry 1차 완료
- 완료일: `2026-04-03`
- 배경:
  - 공개 사용자의 반복 방문 신호를 모을 장치가 약했고, 좋아요/공유가 생겨도 운영자가 어떤 source에서 유입됐는지 확인할 수 없었다.
- 변경 내용:
  - 플레이스 좋아요/싫어요, visitor cookie 기반 반응 저장, 홈 `인기 장소` 추천, 공유 링크 payload/source, 공유 유입 telemetry를 한 흐름으로 묶어 정리했다.
- 코드/문서:
  - `src/db/schema.ts`
  - `drizzle/**`
  - `src/features/places/repository.ts`
  - `src/app/api/places/**`
  - `src/features/places/place-share-button.tsx`
  - `src/features/places/map-explorer.tsx`
  - `src/features/places/trending-places-section.tsx`
  - `src/app/place/[id]/page.tsx`
  - `src/features/telemetry/**`
  - `src/app/api/telemetry/visit/route.ts`
  - `src/features/admin/**`
- 검증:
  - mock runtime 기준 비회원 좋아요 회귀를 수정해 `map.spec.ts`를 다시 통과시켰다.
  - admin dashboard에서 공유 source breakdown이 노출되는지 확인했다.
- 결과:
  - 상세/상세 시트/목록/추천 카드에서 공유 source를 추적할 수 있고, 운영자는 어떤 entry point가 공유 유입을 만드는지 확인할 수 있게 됐다.

<a id="archive-007"></a>
## `007` repo-local AI workflow 도입
- 완료일: `2026-04-03`
- 배경:
  - 전역 AI 설정에 의존하면 저장소별 문서/검증 기준이 흐려지고, 다음 세션에서 같은 기준을 재현하기 어려웠다.
- 변경 내용:
  - repo-local 기준의 skills, reviewers, hook, verify 스크립트를 저장소 안으로 옮겨 일관된 AI workflow를 만들었다.
- 코드/문서:
  - `.agents/skills`
  - `.agents/reviewers`
  - `.githooks`
  - `scripts/git-hooks/**`
  - `AGENTS.md`
  - `README.md`
  - `package.json`
- 검증:
  - `npm run hooks:install`
  - `npm run verify`
- 결과:
  - 전역 설정 없이도 repo-local 기준으로 migration/API/testing/review 루프를 재사용할 수 있게 됐다.

<a id="archive-008"></a>
## `008` 로컬 dev/build/e2e 캐시 안정화
- 완료일: `2026-04-04`
- 배경:
  - `next dev`, `next build`, `next start`, Playwright가 같은 `.next`를 공유하면서 `.sst/.meta` 손상, `Failed to lookup task ids`, `Another write batch or compaction is already active`가 반복됐다.
- 변경 내용:
  - dev 산출물과 production build/e2e 산출물을 분리하고, Turbopack cache 손상 경로를 끊었다.
- 코드/문서:
  - `package.json`
  - `next.config.ts`
  - `README.md`
- 검증:
  - `next dev`와 build/start/e2e를 같은 워크트리에서 다시 돌려도 기존 SST/meta 충돌이 재현되지 않는지 확인했다.
- 결과:
  - dev 서버를 켠 상태에서 build/e2e를 돌리다가 페이지 전환이 멈추던 문제가 구조적으로 줄었다.

<a id="archive-009"></a>
## `009` 착한가격업소 원천 구조 분석
- 완료일: `2026-04-04`
- 배경:
  - 더미 데이터 대신 실제 데이터로 전환하려면 공식 원천의 구조, 다운로드 경로, 좌표/가격 정보 분포를 먼저 파악해야 했다.
- 변경 내용:
  - 행정안전부 `착한가격업소`의 목록, 엑셀, 상세 응답 구조를 조사하고 수집 기준을 확정했다.
- 코드/문서:
  - `https://goodprice.go.kr/bssh/bsshList.do`
  - `https://goodprice.go.kr/bssh/bsshPageExcel.do`
  - `https://goodprice.go.kr/bssh/bsshInfo.json`
- 검증:
  - `bsshPageExcel.do`가 검색 조건 전체 결과를 `.xls`로 내려주며 2026-04-02 기준 전체 `12,109`건이 한 번에 내려오는 것을 확인했다.
  - 주요 열(`업종명/업소명/주요품목/가격/전화/주소/편의시설/지역화폐/이미지명`)도 같이 점검했다.
- 결과:
  - 이후 importer 구현과 quota 재조정의 기준이 되는 수집 전략, 필터 기준, 적재 우선순위를 먼저 잠갔다.

<a id="archive-010"></a>
## `010` 착한가격업소 import pipeline 구현
- 완료일: `2026-04-05`
- 배경:
  - 원천 구조 파악만으로는 더미 데이터를 대체할 수 없어서, 실제 수집 스크립트와 정규화 경로가 필요했다.
- 변경 내용:
  - 수집 스크립트, 정규화 매핑, 좌표 확보 전략, import seed 경로를 구현해 실제 데이터를 앱에서 읽을 수 있게 만들었다.
- 코드/문서:
  - importer 스크립트
  - 정규화 로직
  - seed 데이터
  - meta 파일
- 검증:
  - 초기 생성 기준으로 `1000` places, `2616` price items가 생성되고, 대표 가격 최대값이 `10000원`, `priceItems > 10000`이 `0건`인 것을 확인했다.
- 결과:
  - 더미 데이터 대신 실제 착한가격업소 데이터를 앱에서 조회 가능한 상태로 바꿨다.

<a id="archive-011"></a>
## `011` 착한가격업소 quota 재조정
- 완료일: `2026-04-05`
- 배경:
  - 전체 import는 됐지만 제품 방향과 맞추려면 `서울 500 + 비서울 500`, `음식점 70%`, `대표 가격 8천원 미만` 기준으로 selection을 다시 조정할 필요가 있었다.
- 변경 내용:
  - importer selection 로직을 quota 기준으로 다시 설계하고, 기본 dataset을 `대표 가격 8천원 미만` 기준으로 재생성했다.
- 코드/문서:
  - importer quota 선택 로직
  - selection 메타
  - seed 결과
  - `PLAN.md` 기준
- 검증:
  - public Cloudflare 재배포까지 포함해 새 dataset이 실제 앱에서 동작하는지 확인했다.
  - 기본 selection이 `서울 500 + 비서울 500`, `음식점 70%`, `대표 가격 8천원 미만` 기준으로 유지되는 것도 점검했다.
- 결과:
  - 총 1000건 유지 조건과 가격/지역/업종 quota가 문서와 데이터에 같이 반영됐다.

<a id="archive-012"></a>
## `012` 관리자 앱 분리 1차 완료
- 완료일: `2026-04-06`
- 배경:
  - 관리자 실제 구현이 public 앱 경로 안에 흩어져 있었고, standalone admin 빌드와 public external mode를 동시에 관리하기 어려웠다.
- 변경 내용:
  - 관리자 실제 구현을 `src/features/admin/**`에 모으고, public 앱 `entrypoints`와 별도 `apps/admin` 빌드가 같은 구현을 재사용하도록 정리했다.
- 코드/문서:
  - `src/features/admin/pages`
  - `src/features/admin/api`
  - `src/lib/admin-app.ts`
  - `src/app/admin/**`
  - `src/app/api/admin/**`
  - `apps/admin/**`
  - `package.json`
  - 배포 문서
- 검증:
  - `deploy:check:public`
  - `deploy:check:admin`
  - `cf:build:admin`
  - live admin 재배포
  - `workers.dev` split 배포
  - remote smoke
- 결과:
  - public은 external redirect/API stub 모드, admin은 standalone build 경로를 갖게 됐다.

<a id="archive-013"></a>
## `013` 관리자 큐 `AI 1차 검수` 도입
- 완료일: `2026-04-06`
- 배경:
  - 공개 쓰기 큐가 늘어나면서 운영자가 장소 등록, 가격 제보, 신고를 같은 강도로 수동 읽는 비용이 커졌다.
- 변경 내용:
  - 관리자 큐에 AI 제안 레이어를 추가해 권장 액션, 신뢰도, 요약, 근거, 플래그를 자동 생성·저장하고, 운영자는 최종 승인/반려만 확정하도록 했다.
- 코드/문서:
  - `src/features/admin/moderation-agent.ts`
  - `src/features/admin/moderation-suggestion.ts`
  - `src/features/admin/pages/places-page.tsx`
  - `src/features/admin/pages/prices-page.tsx`
  - `src/features/admin/pages/reports-page.tsx`
  - `README.md`
  - `docs/product/prd.md`
  - `docs/product/trd.md`
- 검증:
  - 관리자 큐에서 `장소 등록`, `가격 제보`, `신고` 대기 항목에 AI 패널이 붙는지 확인했다.
  - 댓글은 관리자 검수 큐가 없어 1차 범위에서 제외된 상태를 문서와 구현에서 일치시켰다.
- 결과:
  - 운영자는 `권장 액션`, `신뢰도`, `근거`, `플래그`를 참고하되 최종 승인/반려는 직접 확정하는 구조를 갖게 됐다.

<a id="archive-014"></a>
## `014` 운영 URL `workers.dev` split 고정
- 완료일: `2026-04-17`
- 배경:
  - 운영 URL 기준이 문서, env, smoke, README 사이에서 흔들리면 이후 배포와 QA가 계속 꼬인다.
- 변경 내용:
  - 운영 URL 기준을 public `altteulmap.altteul-lab.workers.dev`, admin `altteulmap-admin.altteul-lab.workers.dev`로 통일하고, custom domain은 별도 후속 작업으로 분리했다.
- 코드/문서:
  - `README.md`
  - 배포 문서
  - canonical, robots, sitemap, admin redirect 기준
- 검증:
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
- 결과:
  - 문서, 배포 설정, 운영 기준 URL이 하나로 맞춰졌다.

<a id="archive-015"></a>
## `015` 출시 직전 backlog freeze
- 완료일: `2026-04-17`
- 배경:
  - 출시 직전에는 기능을 더 넣는 것보다 범위를 다시 넓히지 않는 게 더 중요했다.
- 변경 내용:
  - 검색 URL 상태는 현재 `q/scope` 범위로 유지하고, 공유 telemetry는 관리자 overview/source breakdown 범위까지만 유지하는 것으로 고정했다.
- 코드/문서:
  - `PLAN.md`
  - 운영 메모
- 검증:
  - 문서 기준과 현재 구현 범위가 충돌하지 않는지 다시 맞췄고, 다음 cycle이 redesign이나 추가 확장으로 흐르지 않도록 active 계획도 같이 잠갔다.
- 결과:
  - 출시 직전 범위가 다시 넓어지지 않도록 문서 기준을 잠갔고, 남은 우선순위를 `운영 DB 복구 -> 실기기 QA`로 명확히 고정했다.

<a id="archive-016"></a>
## `016` root `DESIGN.md` 수립
- 완료일: `2026-04-17`
- 배경:
  - 사용자가 전면 디자인 재설계를 명시적으로 요청했고, ad-hoc UI tweak로는 일관성을 회복하기 어려운 상태였다.
- 변경 내용:
  - 라이브 사이트와 현재 `src/**` UI 구조, 외부 reference를 검토해 AltteulMap 전용 `DESIGN.md` 초안을 만들었다.
- 코드/문서:
  - `DESIGN.md`
  - `PLAN.md`
- 검증:
  - 다음 구현 세션이 `DESIGN.md`만 읽고도 `global header -> home/map shell -> filters -> place cards/detail -> submission/auth` 순서로 일관된 UI 변경을 시작할 수 있는지 기준을 점검했다.
- 결과:
  - 이후 UI 변경은 ad-hoc tweak가 아니라 `DESIGN.md`를 기준으로 진행하게 됐다.

<a id="archive-017"></a>
## `017` 관리자 화면 디자인 시스템 확장
- 완료일: `2026-04-17`
- 배경:
  - 공개 앱 쪽 디자인 언어가 정리돼도 관리자 화면은 별도 톤으로 남아 있어 public/admin 간 언어 차이가 컸다.
- 변경 내용:
  - 공개 앱에서 먼저 정리한 디자인 시스템을 `/admin`, `/admin/places`, `/admin/prices`, `/admin/reports`, `/admin/prices/places/[id]`까지 확장했다.
- 코드/문서:
  - 공통 `AdminPageShell`
  - 버튼/패널/배지 규칙
  - 관리자 헤더 중복 사용자 배지 제거
- 검증:
  - mock 기준 admin dashboard smoke를 다시 통과시켰다.
- 결과:
  - 관리자 헤더, 패널, 배지, 페이지 shell 규칙이 통일됐다.

<a id="archive-018"></a>
## `018` active/archive 문서 구조 재정리
- 완료일: `2026-04-17`
- 배경:
  - `PLAN.md`와 `PROGRESS.md`가 너무 커져 세션 시작 비용이 커졌고, 완료 로그와 active 상태가 한 문서에 섞여 있었다.
- 변경 내용:
  - `PLAN.md`는 active roadmap만, `PROGRESS.md`는 진행 상태와 blocker만 남기고, 완료 이력은 `COMPLETED.md`로 분리하는 구조로 다시 정리했다.
- 코드/문서:
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
  - `AGENTS.md`
- 검증:
  - slimmed active 문서가 현재 blocker와 다음 액션을 바로 드러내는지, archive가 별도 문서로 분리돼도 운영 맥락이 끊기지 않는지 확인했다.
- 결과:
  - active 문서는 짧게 유지되고, 완료 이력은 archive에서 관리하게 됐다.

<a id="archive-019"></a>
## `019` active/archive 번호 체계 단순화
- 완료일: `2026-04-17`
- 배경:
  - 별도 archive id와 active 작업 id를 같이 유지하면 추적 기준이 오히려 복잡해질 수 있었다.
- 변경 내용:
  - active 문서는 별도 번호를 유지하지 않고, `COMPLETED.md`에만 append 순서 기준 archive 번호를 두도록 정리했다.
- 코드/문서:
  - `PLAN.md`
  - `PROGRESS.md`
  - `COMPLETED.md`
  - `AGENTS.md`
- 검증:
  - active 문서에서 번호 의존 없이 현재 작업을 이해할 수 있는지, archive는 `001 -> 019` 순서로 자연스럽게 append되는지 확인했다.
- 결과:
  - active 문서는 더 가벼워졌고, archive는 append 순서만으로도 흐름을 복기할 수 있게 됐다.

<a id="archive-020"></a>
## `020` 운영 문서 경로를 `docs/` 루트로 정리
- 완료일: `2026-04-18`
- 배경:
  - 운영 핵심 문서인 `PLAN.md`, `PROGRESS.md`, `COMPLETED.md`가 `docs/project/` 아래에 있고 일부 보조 문서만 같은 디렉터리에 남아 있어, 실제 진입 문서와 보조 체크리스트의 위계가 덜 분명했다.
- 변경 내용:
  - 운영 핵심 문서 3개를 `docs/` 루트로 이동했다.
  - `AGENTS.md`, `README.md`, `docs/README.md`의 참조 경로를 새 위치 기준으로 갱신했다.
  - archive 문서 안에 남아 있던 구 경로 표기도 현재 구조 기준으로 정리했다.
- 코드/문서:
  - `AGENTS.md`
  - `README.md`
  - `docs/README.md`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `rg -n "docs/project/(PLAN|PROGRESS|COMPLETED)\\.md|project/(PLAN|PROGRESS|COMPLETED)\\.md" -S .`
  - `ls -la docs docs/project`
- 결과:
  - 운영 핵심 문서는 `docs/` 루트에서 바로 찾을 수 있게 됐고, `docs/project/`에는 `mobile-qa-checklist.md` 같은 보조 문서만 남는 구조로 정리됐다.

<a id="archive-021"></a>
## `021` Impeccable repo-local Codex App 적용
- 완료일: `2026-04-21`
- 배경:
  - 앞으로 디자인과 프론트엔드 개선을 Impeccable 기준으로 진행하되, Codex App 개발 환경에서 전역 `~/.codex`나 `npm i -g` 같은 사용자 전체 설정을 바꾸지 않아야 했다.
  - 공식 문서의 설치 안내는 `npx skills add pbakaus/impeccable`, manual ZIP, `npx impeccable detect src/`를 제시하지만, 이 저장소는 기존에도 repo-local `.agents/skills`를 사용하고 있어 Codex App 기준으로 프로젝트 안에만 배치하는 방식이 가장 안전했다.
- 변경 내용:
  - Impeccable v2.1.7 원본을 임시 경로로 내려받아 `.agents/skills` provider의 18개 skill만 repo-local로 추가했다.
  - 공식 cleanup 스크립트를 1회 실행했고 deprecated skill은 없었다.
  - 설치된 `impeccable` skill의 일회성 post-update 안내는 반복 실행되지 않도록 제거했다.
  - cleanup 스크립트의 미사용 import를 정리해 프로젝트 lint 기준을 통과하도록 맞췄다.
  - `.impeccable.md`를 추가해 AltteulMap의 대상 사용자, 사용 맥락, 브랜드 성격, map-first/price-first UI 원칙, 색상/타이포/레이아웃 기준을 Codex App이 바로 읽을 수 있게 했다.
  - `npm run design:detect`, `npm run design:detect:json`을 추가해 전역 설치 없이 Impeccable detector를 실행할 수 있게 했다.
  - detector가 발견한 `bg-black/8` anti-pattern을 카카오 브랜드에 맞는 tinted dark brown badge 색으로 교체했다.
- 코드/문서:
  - `.agents/skills/{adapt,animate,audit,bolder,clarify,colorize,critique,delight,distill,harden,impeccable,layout,optimize,overdrive,polish,quieter,shape,typeset}/**`
  - `.impeccable.md`
  - `.agents/README.md`
  - `AGENTS.md`
  - `package.json`
  - `src/features/auth/social-auth-buttons.tsx`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `node .agents/skills/impeccable/scripts/cleanup-deprecated.mjs`
    - 통과, `No deprecated Impeccable skills found. Nothing to clean up.`
  - `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`
    - 통과
  - `npm run design:detect`
    - 1차: 네트워크 sandbox에서 `registry.npmjs.org` DNS 실패
    - 승인 후 재실행: `social-auth-buttons.tsx`의 `bg-black/8` 1건 발견
    - 색상 수정 후 재실행: 통과
  - `npm run lint`
    - 1차: Impeccable cleanup 스크립트 미사용 import warning 2건
    - import 정리 후 재실행: 통과
  - `npm run typecheck`
    - 통과
- 결과:
  - Codex App에서 사용할 Impeccable skill과 디자인 컨텍스트가 저장소 내부에만 추가됐다.
  - 전역 agent 설정과 전역 npm 설치는 변경하지 않았다.
  - 앞으로 디자인 작업은 `DESIGN.md`와 `.impeccable.md`를 함께 읽고, 필요한 경우 repo-local Impeccable skill과 `npm run design:detect`로 검증할 수 있다.

<a id="archive-022"></a>
## `022` 디자인 기준을 `.impeccable.md`로 단일화
- 완료일: `2026-04-21`
- 배경:
  - Impeccable repo-local 설정 이후에는 Codex App이 실제로 읽는 디자인 컨텍스트가 `.impeccable.md`에 모여 있다.
  - 기존 `DESIGN.md`는 장문 디자인 기준으로 남아 있었지만, `.impeccable.md`와 역할이 겹쳐 다음 디자인 작업에서 기준 문서가 둘로 갈라질 수 있었다.
- 변경 내용:
  - `DESIGN.md`를 삭제했다.
  - active roadmap의 UI 기준을 `.impeccable.md`와 repo-local Impeccable skill 기준으로 바꿨다.
  - `AGENTS.md`, `.agents/README.md`, `.impeccable.md`에서 현재 워크플로우 기준의 `DESIGN.md` 참조를 제거했다.
  - `.impeccable.md`의 `Existing Design Source` 섹션을 `Existing Product Sources`로 바꿔, 이 파일이 Codex App과 Impeccable skill의 canonical local design context임을 명확히 했다.
- 코드/문서:
  - 삭제: `DESIGN.md`
  - 수정: `.impeccable.md`
  - 수정: `.agents/README.md`
  - 수정: `AGENTS.md`
  - 수정: `docs/PLAN.md`
  - 수정: `docs/PROGRESS.md`
  - 수정: `docs/COMPLETED.md`
- 검증:
  - `test ! -e DESIGN.md && echo 'DESIGN.md removed'`
  - `rg -n "DESIGN\\.md" AGENTS.md .agents/README.md .impeccable.md docs/PLAN.md docs/PROGRESS.md README.md package.json src || true`
  - `npm run design:detect`
  - `npm run lint`
- 결과:
  - 앞으로 디자인/프론트엔드 작업의 현재 기준은 `.impeccable.md` 하나로 단일화됐다.
  - 과거 archive에는 기존 `DESIGN.md` 수립 이력이 남지만, active workflow에서는 더 이상 참조하지 않는다.

<a id="archive-023"></a>
## `023` Impeccable Phase 1 홈/지도 탐색 단순화
- 완료일: `2026-04-21`
- 배경:
  - Impeccable critique 결과에서 홈/지도 화면의 가장 큰 P1 이슈는 nested cards와 과한 surface depth였다.
  - baseline live detector는 desktop home `92`, mobile home `11` anti-pattern을 보고했고, 모바일 첫 화면에서 검색/필터가 지도를 밀어내는 문제가 있었다.
  - 사용자는 마음에 들지 않을 경우 되돌릴 수 있도록 checkpoint commit을 push한 뒤 디자인 개선 개발에 착수해 달라고 요청했다.
- 변경 내용:
  - checkpoint commit `6c114b2`를 `origin/main`에 push해 디자인 변경 전 기준점을 만들었다.
  - `distill -> layout -> adapt` 순서로 Phase 1을 진행했다.
  - 홈 상단의 큰 `altteulmap-panel` wrapper를 제거하고, 검색/필터를 unframed toolbar로 낮췄다.
  - 검색 input과 `검색` CTA를 같은 row에 두고, 검색 범위 label을 `보이는 지도`/`전체 지역`으로 정리했다.
  - 카테고리 control은 compact trigger로 유지하되 중첩 panel 스타일을 줄였다.
  - desktop list rail의 상위 card wrapper를 제거해 map/list split에서 map이 primary, list가 supporting rail로 읽히게 했다.
  - trending section의 상위 panel wrapper를 제거하고 반복 장소 card만 유지했다.
  - mobile map 위 `목록 열기` CTA를 viewport 안에 들어오도록 조정했다.
  - price number와 section kicker의 letter spacing을 `0`으로 맞췄다.
- 코드/문서:
  - `src/features/map/map-page.tsx`
  - `src/features/map/naver-map-panel.tsx`
  - `src/features/places/map-explorer.tsx`
  - `src/features/places/trending-places-section.tsx`
  - `src/app/globals.css`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
- 검증:
  - `npm run design:detect:json`
    - 통과, `[]`
  - `npm run verify:quick`
    - 통과
  - `npm run verify`
    - 통과
  - Playwright screenshot:
    - `/tmp/altteulmap-phase1-desktop-home-after.png`
    - `/tmp/altteulmap-phase1-mobile-home-after.png`
  - Impeccable live detector:
    - desktop home `92 -> 4`
    - mobile home `11 -> 4`
  - mobile metric:
    - map shell `y=321`, `height=546`
    - `목록 열기` CTA `bottom=794`, viewport `844`
- 결과:
  - 홈 첫 화면의 card nesting이 크게 줄었고, 모바일에서는 지도와 목록 CTA가 첫 viewport 안에서 함께 보인다.
  - 디자인 workflow의 다음 active 대상은 Phase 2 Empty/Error/Copy hardening으로 넘어갔다.

<a id="archive-024"></a>
## `024` Impeccable Phase 2 Empty/Error/Copy hardening
- 완료일: `2026-04-21`
- 배경:
  - critique 결과에서 stale place URL이 기본 Next.js 영어 404로 떨어지고, `/report` 단독 진입 시 `이름 없는 장소` fallback이 노출되는 문제가 확인됐다.
  - 북마크 empty state도 다음 행동 없이 끝나 사용자가 다시 가격 지도로 돌아갈 경로가 약했다.
- 변경 내용:
  - `harden -> clarify` 순서로 Phase 2를 진행했다.
  - `src/app/place/[id]/not-found.tsx`를 추가해 장소 상세 stale route 전용 404 화면을 만들었다.
  - 장소 not-found 화면에 한국어 설명, `지도로 돌아가기`, `장소 등록하기` CTA를 제공했다.
  - `/report`에서 `placeId` 또는 `placeName`이 없으면 신고 form 대신 대상 선택 안내와 복구 CTA를 보여주게 했다.
  - `/report`의 `이름 없는 장소` fallback을 제거했다.
  - 신고 제출 버튼 copy를 `정보 수정 요청 보내기`로 구체화했다.
  - `/bookmarks` empty state에 `가격 지도 열기`, `장소 등록하기` CTA를 추가했다.
  - 북마크 목록 action copy를 `상세`/`지도`에서 `가격 보기`/`지도에서 찾기`로 바꿨다.
  - 로그인/회원가입 heading과 divider의 letter spacing을 정리했다.
- 코드/문서:
  - `src/app/place/[id]/not-found.tsx`
  - `src/app/report/page.tsx`
  - `src/features/reports/report-submit-form.tsx`
  - `src/app/bookmarks/page.tsx`
  - `src/features/auth/login-form.tsx`
  - `src/features/auth/signup-form.tsx`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `npm run design:detect:json`
    - 통과, `[]`
  - `npm run verify`
    - 통과
  - Playwright route smoke:
    - `/place/school-gimbap` status `404`, H1 `이 장소를 찾을 수 없어요`
    - `/report` status `200`, H1 `신고할 장소를 먼저 선택해 주세요`
    - `/report?placeId=goodprice-14501&placeName=...` status `200`, H1 `정보 수정 요청`
  - Playwright screenshot:
    - `/tmp/altteulmap-phase2-place-not-found.png`
    - `/tmp/altteulmap-phase2-report-missing-target-after.png`
- 결과:
  - stale route와 대상 없는 신고 흐름이 막다른 화면 대신 한국어 설명과 복구 CTA를 제공한다.
  - 디자인 workflow의 다음 active 대상은 Phase 3 장소 상세/쓰기 흐름 정리로 넘어갔다.

<a id="archive-025"></a>
## `025` Impeccable Phase 3 장소 상세와 쓰기 흐름 정리
- 완료일: `2026-04-21`
- 배경:
  - critique 결과에서 장소 상세는 대표 가격과 신뢰 정보보다 가격 제보/댓글 form이 지나치게 빨리 크게 노출되는 문제가 있었다.
  - `/submit`은 대표 가격 입력에 기본값 `0`이 보여 잘못된 입력을 유도할 수 있었고, `가격 항목 추가` 버튼이 대표 가격 입력보다 먼저 시선을 끌었다.
- 변경 내용:
  - `distill -> clarify -> adapt` 순서로 Phase 3을 진행했다.
  - 장소 상세의 전체 outer `altteulmap-panel` wrapper를 제거해 상위 nested card 구조를 줄였다.
  - 상세 제목의 negative letter spacing을 제거하고 `break-keep`을 적용했다.
  - 가격 항목은 card 반복 대신 divider row로 정리해 가격 리스트를 더 읽기 좋게 만들었다.
  - 가격 제보와 댓글 form은 `RouteResetDetails`로 접어, 사용자가 열기 전에는 form component가 렌더되지 않게 했다.
  - `PlacePriceReportForm`, `PlaceCommentsSection`에 `surface="plain"`과 `showHeader={false}` 옵션을 추가해 disclosure 내부에서 중복 header와 중첩 panel을 줄였다.
  - `/submit` 대표 가격 amount 기본값을 `0`에서 빈 값으로 바꿨다.
  - `/submit`의 `가격 항목 추가` 버튼을 대표 가격 입력 아래로 내려 primary input을 먼저 작성하게 했다.
  - `/submit` heading의 negative letter spacing을 제거했다.
- 코드/문서:
  - `src/app/place/[id]/page.tsx`
  - `src/features/places/place-price-report-form.tsx`
  - `src/features/places/place-comments-section.tsx`
  - `src/features/submission/place-submit-form.tsx`
  - `src/app/submit/page.tsx`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `npm run design:detect:json`
    - 통과, `[]`
  - `npm run verify`
    - 통과
  - Playwright screenshot:
    - `/tmp/altteulmap-phase3-desktop-place-detail.png`
    - `/tmp/altteulmap-phase3-mobile-place-detail.png`
    - `/tmp/altteulmap-phase3-desktop-submit.png`
    - `/tmp/altteulmap-phase3-mobile-submit.png`
  - Impeccable live detector:
    - desktop place detail `2`
    - mobile place detail `2`
    - desktop submit `2`
    - mobile submit `2`
  - behavior check:
    - 장소 상세 초기 렌더에서 `place-price-report-form`, `place-comments-section`이 열기 전 렌더되지 않음
    - `/submit` 첫 가격 amount input이 빈 값으로 표시됨
- 결과:
  - 장소 상세 첫 화면은 가격, 주소, 메모, 가격 항목을 먼저 읽는 구조가 됐다.
  - 제보/댓글은 명확한 entry를 통해 필요할 때만 열리며, 쓰기 form이 읽기 task를 방해하지 않는다.
  - 디자인 workflow의 다음 active 대상은 Phase 4 관리자 큐 밀도와 반복 패턴 개선으로 넘어갔다.

<a id="archive-026"></a>
## `026` Impeccable Phase 4 관리자 큐 밀도와 반복 패턴 개선
- 완료일: `2026-04-21`
- 배경:
  - 관리자 큐는 운영자가 반복 카드와 AI 검수 패널을 빠르게 훑고 승인/반려/보류를 결정해야 하는 화면이다.
  - 기존 화면은 outer panel과 반복 card surface가 겹쳐 밀도가 낮았고, AI 검수 근거가 항상 펼쳐져 큐 처리 속도를 떨어뜨렸다.
  - 이 단계는 UI 밀도와 정보 위계를 조정하는 범위로 제한하고, DB schema나 moderation contract는 변경하지 않았다.
- 변경 내용:
  - `layout -> distill -> clarify` 순서로 Phase 4를 진행했다.
  - 관리자 공통 shell의 outer `altteulmap-panel` wrapper를 제거해 페이지 자체가 또 하나의 카드처럼 보이지 않게 했다.
  - 관리자 페이지 heading과 요약 수치의 letter spacing utility를 정리했다.
  - AI 검수 패널을 summary-first 구조로 바꾸고, 권장 조치/신뢰도/flag 요약을 먼저 보이게 했다.
  - AI evidence, checks, flags 상세는 `근거 보기`/`근거 접기` 토글 뒤에 두어 기본 큐 화면의 반복 노출을 줄였다.
  - 신고/장소/가격 제보 카드의 보조 label letter spacing을 정리해 화면 전반의 타이포 리듬을 맞췄다.
  - 가격 관리자 화면의 `현재 가격 관리` 섹션은 card 안 card 구조 대신 unframed border-top section으로 낮췄다.
- 코드/문서:
  - `src/features/admin/components/admin-page-shell.tsx`
  - `src/features/admin/components/admin-summary-cards.tsx`
  - `src/features/admin/components/admin-ai-review-panel.tsx`
  - `src/features/admin/components/admin-report-card.tsx`
  - `src/features/admin/components/admin-pending-place-card.tsx`
  - `src/features/admin/components/admin-pending-price-report-card.tsx`
  - `src/features/admin/pages/prices-page.tsx`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `npm run design:detect:json`
    - 통과, `[]`
  - `npm run verify`
    - 통과
  - Playwright screenshot:
    - `/tmp/altteulmap-phase4-admin-reports.png`
    - `/tmp/altteulmap-phase4-admin-prices.png`
    - `/tmp/altteulmap-phase4-admin-places.png`
  - Playwright admin metric:
    - `/admin/reports`: H1 `신고 검토 큐`, AI panel `3`, open evidence `0`, cards `3`, scrollHeight `1709`
    - `/admin/prices`: H1 `가격 제보 검토 큐`, AI panel `0`, open evidence `0`, cards `0`, scrollHeight `1451`
    - `/admin/places`: H1 `신규 장소 승인 큐`, AI panel `0`, open evidence `0`, cards `0`, scrollHeight `1000`
  - Impeccable live detector:
    - `/admin/reports`: `6`
    - `/admin/prices`: `3`
    - `/admin/places`: `3`
- 결과:
  - 관리자 큐는 기본 화면에서 AI 근거를 모두 펼치지 않고, 요약과 조치를 먼저 보는 구조가 됐다.
  - live detector의 admin residual count는 남아 있지만, 대부분 실제 반복 검토 카드 구조에서 발생하는 낮은 우선순위 항목으로 판단해 이번 P1 범위에서는 예외로 기록한다.
  - 디자인 workflow의 다음 active 대상은 Phase 5 final polish, audit, verification으로 넘어갔다.

<a id="archive-027"></a>
## `027` Impeccable 디자인 개선 최종 검증과 active 문서 정리
- 완료일: `2026-04-21`
- 배경:
  - 사용자는 디자인 변경 전 checkpoint commit을 push한 뒤, Impeccable workflow 기준으로 public/admin 디자인 개선을 순차 진행하길 요청했다.
  - Phase 1부터 Phase 4까지 홈/지도, empty/error/copy, 장소 상세/쓰기, 관리자 큐 개선을 완료했으므로 active 문서에 완료된 디자인 계획이 남지 않도록 정리해야 했다.
- 변경 내용:
  - `polish -> audit -> verification-loop` 기준으로 최종 검증을 수행했다.
  - Phase 1-4 결과를 전체 흐름 기준으로 재검토했다.
  - 최종 polish에서 `src` 전체에 남아 있던 Tailwind `tracking-*` letter-spacing 유틸을 제거해 새 디자인 기준과 맞췄다.
  - `PLAN.md`에서 완료된 Impeccable workflow 항목과 phase 상세를 제거하고, 현재 active roadmap은 운영 DB 복구와 실기기 QA만 남겼다.
  - `PROGRESS.md`에서 완료된 디자인 workflow 실행 로그를 제거하고, 최근 전체 로컬 검증 결과만 현재 상태 요약에 남겼다.
  - 디자인 workflow 상세 이력은 이 archive 문서의 `023`부터 `027`까지 시간순으로 보존했다.
- 코드/문서:
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
  - Phase 1-4에서 수정한 public/admin UI 파일 전체
  - `src` 내 남아 있던 `tracking-*` 유틸 사용 UI 파일
- 검증:
  - `npm run design:detect:json`
    - 통과, `[]`
  - `git diff --check`
    - 통과
  - `rg -n "tracking-(?:tight|\[|-)" src || true`
    - 통과, 남은 `tracking-*` 유틸 없음
  - `npm run verify:quick`
    - 통과
  - `npm run verify`
    - 통과
  - `npm run build`
    - 통과, 빌드 중 기존 production DB tenant credential 문제로 mock fallback 로그가 출력됨
  - 최종 Impeccable live detector 확인:
    - home `4`
    - place detail `2`
    - submit `2`
    - report missing target: detector output 없음
    - admin reports `6`
    - admin prices `3`
    - admin places `3`
  - 최종 screenshot 세트:
    - `/tmp/altteulmap-phase1-desktop-home-after.png`
    - `/tmp/altteulmap-phase1-mobile-home-after.png`
    - `/tmp/altteulmap-phase2-place-not-found.png`
    - `/tmp/altteulmap-phase2-report-missing-target-after.png`
    - `/tmp/altteulmap-phase3-desktop-place-detail.png`
    - `/tmp/altteulmap-phase3-mobile-place-detail.png`
    - `/tmp/altteulmap-phase3-desktop-submit.png`
    - `/tmp/altteulmap-phase3-mobile-submit.png`
    - `/tmp/altteulmap-phase4-admin-reports.png`
    - `/tmp/altteulmap-phase4-admin-prices.png`
    - `/tmp/altteulmap-phase4-admin-places.png`
- 결과:
  - Impeccable 기반 디자인 개선 workflow는 완료 상태로 archive됐다.
  - active 문서에는 완료된 디자인 작업을 남기지 않고, 다음 작업 순서를 운영 DB 복구와 모바일/운영 실기기 QA로 되돌렸다.
  - checkpoint commit `6c114b2`는 `origin/main`에 push되어 있어, 현재 디자인 변경이 마음에 들지 않으면 해당 커밋 기준으로 되돌릴 수 있다.

<a id="archive-028"></a>
## `028` Impeccable 디자인 개선 운영 public 배포 확인
- 완료일: `2026-04-21`
- 배경:
  - 사용자는 Impeccable 디자인 개선 결과를 `https://altteulmap.altteul-lab.workers.dev/`에서 확인할 수 있도록 push 후 배포까지 확인해 달라고 요청했다.
  - 운영 배포는 Cloudflare Workers Builds가 기본 경로이고, 로컬 deploy는 fallback으로만 사용한다.
- 변경 내용:
  - 디자인 개선 전체 변경분을 `feat: refine impeccable design workflow` commit으로 묶었다.
  - commit `3f2fc72`를 `origin/main`에 push했다.
  - Cloudflare Workers Builds 반영을 기다린 뒤 public 운영 URL에서 새 코드 marker를 확인했다.
  - 기존 remote smoke로 public home, robots, sitemap, map API, sample place, login, public/admin redirect, admin login을 검증했다.
- 코드/문서:
  - commit `3f2fc72`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `git push origin main`
    - 성공, `6c114b2..3f2fc72 main -> main`
  - `npm run deploy:check:public`
    - 통과
    - optional `EMAIL_FROM`, `RESEND_API_KEY`는 warn 상태
  - post-push deployment marker polling:
    - `https://altteulmap.altteul-lab.workers.dev/?deployCheck=3f2fc72`: status `200`, `가격이 보이는 동네 지도` 확인
    - `https://altteulmap.altteul-lab.workers.dev/report?deployCheck=3f2fc72`: status `200`, `신고할 장소를 먼저 선택해 주세요` 확인
    - `https://altteulmap.altteul-lab.workers.dev/place/school-gimbap?deployCheck=3f2fc72`: status `404`, `이 장소를 찾을 수 없어요` 확인
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
    - 통과
- 결과:
  - 운영 public URL에서 Impeccable 디자인 개선 결과가 보이는 상태를 확인했다.
  - 운영 DB credential blocker는 별도 active 작업으로 남아 있으며, 현재 배포 확인은 degraded fallback과 mock fallback이 유지되는 조건에서 완료했다.

<a id="archive-029"></a>
## `029` 운영 DB 복구와 AI 검수 persisted live 경로 마감
- 완료일: `2026-04-21`
- 배경:
  - Supabase 운영 project `altteulmap-prod`가 pause 상태였고, 운영 `DATABASE_URL` 확인 명령은 `Tenant or user not found`로 실패했다.
  - 사용자가 Supabase dashboard에서 project restore를 완료한 뒤 운영 DB 연결, schema migration, 초기 seed, public/admin Worker 런타임 반영까지 이어서 검증해야 했다.
  - 목표는 live 관리자 큐에서 장소 등록, 가격 제보, 신고의 AI 1차 검수 제안이 `moderation_suggestions`에 persisted 되는지 확인하고, 실제 처리 후 pending 테스트 데이터가 남지 않게 하는 것이었다.
- 변경 내용:
  - `db:check:production`이 Drizzle migration timestamp의 `bigint` 값을 안전하게 출력하도록 보정했다.
  - 운영 DB가 완전히 비어 있을 때만 실행되는 guarded bootstrap seed 스크립트 `db:seed:production`을 추가했다.
  - 운영 DB에 Drizzle migration 전체를 적용하고, `moderation_suggestions` table과 관련 enum, `drizzle.__drizzle_migrations` 존재를 확인했다.
  - 운영 DB에 초기 카테고리, 운영자/데모 계정, 착한가격업소 기반 장소/가격 seed를 적재했다.
  - Cloudflare public/admin Worker runtime secret에 운영 `DATABASE_URL`과 `USE_MOCK_DATA=false`를 반영하고 public/admin을 재배포했다.
  - Cloudflare Workers에서 `postgres` client를 요청 간 재사용하면 다음 DB 호출이 timeout/hung 상태로 이어질 수 있어, read/auth/write 주요 경로가 Worker runtime에서 DB 연결을 release하도록 수정했다.
  - known demo/admin credentials는 운영 DB hash 검증의 `scrypt` 경로보다 env password 확인을 먼저 거치고, DB lookup timeout 시 local fallback으로 로그인 가능하도록 했다.
  - local fallback admin id가 UUID FK 컬럼에 들어가지 않도록 admin action user id를 UUID일 때만 저장하도록 정규화했다.
  - 관리자 overview와 pending 장소 큐의 DB 조회를 순차화하고, 관리자 장소/가격/신고 list에 read timeout을 적용했다.
- 코드/문서:
  - `package.json`
  - `scripts/check-production-db.mjs`
  - `scripts/seed-production.mjs`
  - `src/db/client.ts`
  - `src/features/auth/repository.ts`
  - `src/features/admin/admin-action.ts`
  - `src/features/admin/repository.ts`
  - `src/features/places/repository.ts`
  - `src/features/reports/repository.ts`
  - `docs/deploy/deploy-cloudflare.md`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `npm run db:check:production`
    - restore 전 실패, `Tenant or user not found`
  - `npm run db:check:production`
    - restore 후 연결 성공, `moderation_suggestions: missing`, `moderation enums: 0/2 present`, `drizzle migrations table: missing`
  - `npx drizzle-kit migrate`
    - 운영 DB 전체 migration 적용 성공
  - `npm run db:check:production`
    - 통과, `moderation_suggestions: present`, `moderation enums: 2/2 present`, `drizzle migrations table: present`
  - `npm run db:seed:production`
    - 운영 DB 앱 테이블 empty guard 통과 후 초기 seed 적용, `Seed complete.`
  - 운영 DB count 확인
    - seed 전 `categories=0`, `places=0`, `price_items=0`, `users=0`, `moderation_suggestions=0`
    - seed 후 `categories=23`, `places=1000`, `price_items=2493`, `price_reports=4986`, `users=2`, `content_reports=0`, `moderation_suggestions=0`
  - `npm run verify:quick`
    - 통과
  - `npm run verify`
    - 통과
  - `npm run deploy:admin`
    - 통과, `https://altteulmap-admin.altteul-lab.workers.dev`
  - `npm run deploy:public`
    - 통과, `https://altteulmap.altteul-lab.workers.dev`
  - live public map API 반복 확인
    - 3회 연속 `source=database`, `mock=false`, `count=1000`, `items=120`
  - live admin API 확인
    - `/api/admin/places`, `/api/admin/prices`, `/api/admin/reports` 모두 `source=database`, `mock=false`
  - 운영 테스트 pending 제보 생성/처리
    - public API로 테스트 장소 `운영검증-mo8elzxp-g46m-분식`, 가격 제보 `08c99a3f-f890-434d-826c-642d5d2d4af0`, 신고 `0c1922f4-4b76-4b67-8a8c-22dcdfbd1a67` 생성
    - 이전 직접 삽입 검증 데이터까지 포함해 장소 2건, 가격 제보 2건, 신고 2건이 관리자 큐에 표시됨
    - 6건 모두 `moderationSuggestion` 존재 확인
    - admin API로 장소 2건 반려, 가격 제보 2건 반려, 신고 2건 `resolved` 처리 성공
    - DB 요약: `pending_test_places=0`, `pending_test_prices=0`, `unresolved_test_reports=0`, `suggestion_count=6`
  - `npm run db:check:production`
    - 최종 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
    - 최종 통과
  - `git diff --check`
    - 통과
- 결과:
  - 운영 DB credential blocker는 해소됐다.
  - 운영 DB는 migration과 bootstrap seed가 적용된 상태이며, public map/read 경로가 DB source로 안정 응답한다.
  - live 관리자 큐의 AI 1차 검수 제안은 장소 등록, 가격 제보, 신고 모두 persisted storage 기준으로 생성/조회된다.
  - 테스트 pending 데이터는 모두 처리되어 운영 DB에 미처리 `운영검증` pending/open 데이터가 남아 있지 않다.
  - 다음 active 작업은 모바일/운영 실기기 QA다.

<a id="archive-030"></a>
## `030` 모바일/운영 실기기 QA 범위 제외와 active 문서 정리
- 완료일: `2026-04-24`
- 배경:
  - 운영 DB 복구와 AI 검수 persisted live 경로가 마감된 뒤 active 작업으로는 모바일/운영 실기기 QA만 남아 있었다.
  - 사용자는 해당 실기기 QA를 더 이상 진행하지 않아도 된다고 결정했고, 현재 변경분을 먼저 커밋해 두길 요청했다.
- 변경 내용:
  - `PLAN.md`에서 남아 있던 모바일/운영 실기기 QA active 항목을 제거했다.
  - `PROGRESS.md`에서 pending 상태로 남아 있던 실기기 QA 항목과 관련 요약을 제거했다.
  - active 작업이 모두 비었으므로 두 문서를 규칙에 맞게 `현재 active 작업 없음` 상태로 정리했다.
- 코드/문서:
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `git diff --check`
    - 통과
- 결과:
  - 현재 roadmap 기준 active 작업은 남아 있지 않다.
  - 이후 작업이 필요해지면 새 active 작업을 먼저 정의한 뒤 진행하면 된다.

<a id="archive-031"></a>
## `031` 모바일/운영 실기기 QA 문제 없음 확인
- 완료일: `2026-04-27`
- 배경:
  - 이전에는 모바일/운영 실기기 QA를 별도 진행하지 않는 것으로 active 문서를 정리했지만, 이후 사용자가 실제 실기기 QA를 수행했다.
  - 운영 public/admin URL은 이미 운영 DB 기반으로 동작하며, 익명 쓰기와 관리자 큐 처리까지 검증된 상태였다.
- 변경 내용:
  - 사용자 실기기 QA 결과를 `docs/project/mobile-qa-checklist.md`에 반영했다.
  - iPhone Safari와 Android Chrome device matrix를 `pass` 상태로 갱신했다.
  - 체크리스트 항목은 사용자 보고 기준으로 전체 `pass` 처리했다.
  - OS version은 전달받지 못했으므로 `미기록`으로 남겼다.
- 코드/문서:
  - `docs/project/mobile-qa-checklist.md`
  - `docs/COMPLETED.md`
- 검증:
  - 사용자 실기기 QA 결과:
    - iPhone Safari 문제 없음
    - Android Chrome 문제 없음
    - public 지도/현재 위치/지역 재검색/목록과 상세 시트/익명 쓰기 흐름 문제 없음
    - admin 로그인/관리자 큐/AI 패널 문제 없음
- 결과:
  - 모바일/운영 실기기 QA 기준으로 발견된 blocker는 없다.
  - 현재 active 작업은 계속 없는 상태이며, 다음 작업은 출시 전 마감 또는 새 기능/운영 개선을 선택해 새 active 작업으로 정의하면 된다.

<a id="archive-032"></a>
## `032` 출시 전 마감 문서와 운영 smoke 정리
- 완료일: `2026-04-27`
- 배경:
  - 모바일/운영 실기기 QA가 문제 없음으로 확인됐고, 사용자는 출시 전 마감 순서대로 진행하길 요청했다.
  - 마감 순서는 `커밋/푸시 정리 -> 운영 smoke 재확인 -> README/배포 문서 최종 확인 -> 공개 공유용 체크리스트 정리`로 정했다.
- 변경 내용:
  - QA 결과와 active 문서 변경분을 `docs: record mobile qa completion` 커밋으로 정리하고 `origin/main`에 push했다.
  - 운영 URL 기준 remote smoke를 다시 실행했다.
  - production DB 연결과 moderation schema 상태를 다시 확인했다.
  - README의 완료된 `AI moderation rollout`, `Operational QA` 항목을 현재 완료 상태로 갱신했다.
  - Cloudflare 배포 가이드에 운영 DB/실기기 QA 완료 상태와 공개 공유 체크리스트 링크를 반영했다.
  - 공개 공유 전 점검용 `docs/project/public-share-checklist.md`를 추가했다.
  - active 문서인 `PLAN.md`, `PROGRESS.md`를 다시 `현재 active 작업 없음` 상태로 정리했다.
- 코드/문서:
  - `README.md`
  - `docs/deploy/deploy-cloudflare.md`
  - `docs/project/public-share-checklist.md`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `git diff --check`
    - 통과
  - `git commit -m "docs: record mobile qa completion"`
    - 성공, commit `16767e2`
  - `git push origin main`
    - 성공, `763d03e..16767e2 main -> main`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
    - 통과
  - `npm run db:check:production`
    - 통과, production DB connection과 moderation schema ready
- 결과:
  - 현재 README와 운영 문서는 live DB, AI moderation persistence, 모바일 실기기 QA 완료 상태를 반영한다.
  - 공개 공유 전에 확인할 URL, 완료 상태, 알려야 할 제약, 후속 후보가 checklist로 분리됐다.
  - 현재 roadmap 기준 active 작업은 남아 있지 않다.

<a id="archive-033"></a>
## `033` Cloudflare admin Worker 빌드 속도 개선
- 완료일: `2026-04-28`
- 배경:
  - `altteulmap-admin` Workers Builds는 성공하고 있었지만 dashboard duration이 약 `4m 50s`로 길었다.
  - 루트 기준 fast command로 돌리는 방식은 Cloudflare build 환경에서 루트 `node_modules`를 보장하지 못해 실패했다.
  - 이후 admin self-contained install/build 경로를 만들었지만, retry build `8c01bd68-65a2-428d-bdd1-eba7e108b4a3`가 `7m 4s`로 확인되어 코드 변경만으로는 병목이 해소되지 않았다.
- 변경 내용:
  - `apps/admin` root에서 Cloudflare 기본 build가 동작하도록 admin package dependency와 lockfile을 self-contained로 정리했다.
  - `apps/admin/scripts/build.mjs`가 root `node_modules`가 없는 Cloudflare 환경에서 build 동안 루트 `node_modules` symlink를 임시 생성/삭제하도록 했다.
  - `scripts/build-admin-worker.mjs`는 실행 cwd와 무관하게 repo root를 계산하고 root/admin dependency 위치를 모두 지원하도록 수정했다.
  - root/admin `.npmrc`에 `audit=false`, `fund=false`, `progress=false`, `prefer-offline=true`를 추가해 Cloudflare 자동 `npm ci`의 부가 작업을 줄였다.
  - `apps/admin/next.config.ts`는 Cloudflare `WORKERS_CI=1` 환경에서 Next type validation을 생략하도록 조정했다.
  - Cloudflare Dashboard에서 Build cache를 enable하고, Build watch paths에 `docs/*`, `README.md` exclude를 추가했다.
  - 배포 문서에 현재 UI 기준으로 가능한 설정과 Build cache/watch paths 운영 방식을 반영했다.
- 코드/문서:
  - `apps/admin/package.json`
  - `apps/admin/package-lock.json`
  - `apps/admin/scripts/build.mjs`
  - `apps/admin/next.config.ts`
  - `scripts/build-admin-worker.mjs`
  - `.npmrc`
  - `apps/admin/.npmrc`
  - `docs/deploy/deploy-cloudflare.md`
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/COMPLETED.md`
- 검증:
  - `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin`
    - 통과
  - `WORKERS_CI=1 PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin`
    - 통과, Next build에서 `Skipping validation of types` 확인
  - 루트 `node_modules`를 임시로 숨긴 뒤 `PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm ci --prefix apps/admin && WORKERS_CI=1 PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run build --prefix apps/admin`
    - 통과, Cloudflare 유사 조건에서 admin 단독 설치/빌드 가능 확인
  - `npm run lint`
    - 통과
  - `npm run typecheck`
    - 통과
  - `npm run deploy:check:admin`
    - 통과
  - `git diff --check`
    - 통과
  - `git push origin main` 후 commit `d57f10a` 원격 check 확인
    - public `Workers Builds: altteulmap` 성공, build id `db5280a8-f832-40f0-b194-e8d258db4fa9`
    - admin `Workers Builds: altteulmap-admin` 성공, build id `550f1f05-50e0-4d68-a378-084b05b44b87`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
    - 통과
  - Cloudflare Dashboard retry build
    - admin build id `7e58dde3-8812-4cfd-8cfc-f1401a3132ee`
    - dashboard duration `2m 44s`
- 결과:
  - admin Workers Builds duration은 확인된 최악값 `7m 4s`에서 `2m 44s`로 줄었다.
  - 최초 기준 `4m 50s`와 비교해도 약 `2m 6s` 단축됐다.
  - Cloudflare UI에 별도 Install command가 없는 상태에서도 `.npmrc`, Build cache, Build watch paths로 설치/캐시/문서-only trigger 비용을 줄이는 운영 기준이 정리됐다.
  - 현재 active 작업은 남아 있지 않다.
