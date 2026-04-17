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
  - `docs/project/PLAN.md`
  - `docs/project/PROGRESS.md`
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
  - `docs/project/PLAN.md`
  - `docs/project/PROGRESS.md`
  - `docs/project/COMPLETED.md`
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
