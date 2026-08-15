# 지원 전략

## 공고 평가 기준 분석

### 회사가 직접 보는 기준
공고의 핵심 문장은 “학위가 아니라 실제 문제에 대한 집요한 해결력”, “AI를 협력자로 삼아 더 높은 수준의 문제를 해결”, “결과에 대해 끝까지 책임지는 사람”이다. 따라서 제출 전략은 기술 스택 나열이 아니라 아래 기준을 증명하는 구조여야 한다.

| 평가 기준 | 공고의 의도 | 알뜰맵에서 보여줄 증거 |
| --- | --- | --- |
| 문제 재정의 | 주어진 일을 구현하는 사람이 아니라 요구를 다시 정의하는 사람인지 본다. | PRD에서 저가 장소 정보를 “가격 중심 지도 + 제보 + 검증 + 이력” 문제로 정의했다. |
| 복잡한 요구사항 구조화 | 고객 요구를 기능/데이터/운영 정책으로 번역할 수 있는지 본다. | PRD/TRD, 공개 쓰기 정책, 관리자 검수 큐, 가격 이력, 북마크, 신고, telemetry를 문서와 코드로 분해했다. |
| AI-native 작업 방식 | AI를 자동완성 수준이 아니라 사고/생산성 증폭 도구로 쓰는지 본다. | repo-local skill, 루트 PLAN 단일 상태 문서, UI critique 반영, moderation suggestion 계약/패널, migration/검증 문서화 흐름이 있다. 외부 AI 생성 pipeline은 미구현이다. |
| 빠른 학습과 적용 | 낯선 기술을 익혀 실제 서비스에 적용했는지 본다. | Next.js/OpenNext에서 Vite React SPA + Cloudflare Worker API로 이관했다. |
| 실제 작동 결과 | 데모용 화면이 아니라 운영 가능한 결과인지 본다. | 운영 URL, Cloudflare deploy guide, Supabase DB, NAVER Maps, admin route, smoke:remote가 있다. |
| 검증 책임 | AI가 만든 결과까지 본인이 검증하고 품질을 닫는지 본다. | `npm run verify`, unit/E2E/smoke/remote smoke, CI, deploy check, production hardening report가 있다. |
| 협업 설명력 | 복잡한 작업을 다음 사람이 이어받게 정리할 수 있는지 본다. | README, PRD/TRD, migration 문서, deploy 문서, 루트 PLAN, refactoring plan이 있다. |

## 프로젝트 강점 매핑

### 강점 1. 문제를 제품과 운영 흐름으로 다시 정의했다
- 증거:
  - [`../product/prd.md`](../product/prd.md): 저가 장소 정보를 가격 중심 지도, 제보, 검증, 이력 문제로 정의했다.
  - [`../product/trd.md`](../product/trd.md): Vite React SPA + Worker API, 공개/인증 쓰기 정책, DB 기반 가격 검증, 관리자 검토를 기술 구조로 번역했다.
  - [`../../README.md`](../../README.md): 공공 데이터 1,000건, 공개 앱, 관리자 화면, API, 검증 흐름을 운영 가능한 MVP로 소개한다.
- 제출에서 말할 방식:
  - “저렴한 장소 목록을 보여주는 앱”이 아니라, “가격 정보의 최신성/신뢰성/운영 반영 문제를 지도 탐색과 moderation loop로 푼 프로젝트”라고 설명한다.

### 강점 2. 실제 운영 가능한 full-stack MVP를 만들었다
- 증거:
  - [`../../src/client/routes/MapRoute.tsx`](../../src/client/routes/MapRoute.tsx): 지도 중심 탐색 route.
  - [`../../src/worker/index.ts`](../../src/worker/index.ts): Worker API entry.
  - [`../../src/db/schema.ts`](../../src/db/schema.ts): Drizzle 기반 DB schema export.
  - [`../deploy/deploy-cloudflare.md`](../deploy/deploy-cloudflare.md): 운영 URL, env/secret, DB migration, Worker deploy, smoke 기준.
  - [`../project/production-hardening-report-2026-05-08.md`](../project/production-hardening-report-2026-05-08.md): DB timeout, transaction, rate limit, security header, health check, smoke 결과.
- 제출에서 말할 방식:
  - “프론트만 만든 개인 프로젝트”가 아니라 “public/admin/API/DB/deploy/smoke까지 닫은 1인 운영 MVP”라고 말한다.

### 강점 3. AI를 쓰되 최종 책임을 검증으로 닫았다
- 증거:
  - [`../../AGENTS.md`](../../AGENTS.md): repo-local agent 작업 규칙, 루트 PLAN 단일 상태 운영, 로컬 AI 워크플로우.
  - [`../../.agents/skills/impeccable/SKILL.md`](../../.agents/skills/impeccable/SKILL.md): 디자인/프론트엔드 개선을 repo-local skill로 운영.
  - [`../../src/client/routes/admin/AdminShared.tsx`](../../src/client/routes/admin/AdminShared.tsx): moderation suggestion을 표시하는 관리자 패널.
  - [`../../tests/e2e/submission-admin.spec.ts`](../../tests/e2e/submission-admin.spec.ts): 공개 장소 등록, AI 1차 검수 패널, 관리자 승인, 검색 노출까지 확인.
  - [`../../tests/e2e/price-review.spec.ts`](../../tests/e2e/price-review.spec.ts): 가격 제보와 검수 패널 흐름 확인.
  - [`../../package.json`](../../package.json): verify, quality, E2E, smoke, remote smoke, deploy check scripts.
- 제출에서 말할 방식:
  - “AI를 사용했다”가 아니라 “AI가 빠르게 만든 결과를 PRD/TRD, E2E, smoke, 운영 문서로 검증해 최종 품질 책임을 내 쪽에 남겼다”고 설명한다.

## 제출에서 밀어야 할 핵심 사례 3개

### 사례 1. Next.js에서 Vite React + Cloudflare Worker로 아키텍처 이관
- 왜 중요한가:
  - Fellowship은 빠른 학습과 적용, 복잡한 요구사항의 구조화를 본다.
  - 단순 프레임워크 교체가 아니라 API contract, auth, admin, deploy path, runtime smoke를 보존해야 하는 작업이었다.
- 증거:
  - [`../migration-next-to-vite-react.md`](../migration-next-to-vite-react.md)
  - [`../../scripts/compare-vite-contract.mjs`](../../scripts/compare-vite-contract.mjs)
  - [`../../scripts/smoke-vite-local.mjs`](../../scripts/smoke-vite-local.mjs)
  - [`../deploy/deploy-cloudflare.md`](../deploy/deploy-cloudflare.md)
- 말할 포인트:
  - “기능 추가보다 유지보수 경계 단순화를 목표로 했다.”
  - “API path/response shape/auth 의미를 먼저 inventory로 고정했다.”
  - “로컬 workerd smoke와 deploy output check로 runtime 차이를 검증했다.”

### 사례 2. 공개 제보에서 관리자 승인까지 닫힌 moderation loop
- 왜 중요한가:
  - Sionic이 보는 “복잡한 고객 요구사항 구조화”와 가장 맞다.
  - 사용자 입력, abuse 방어, 운영자 판단, 데이터 반영, 사용자 검색 노출이 하나의 업무 흐름으로 닫힌다.
- 증거:
  - [`../../tests/e2e/submission-admin.spec.ts`](../../tests/e2e/submission-admin.spec.ts)
  - [`../../tests/e2e/price-review.spec.ts`](../../tests/e2e/price-review.spec.ts)
  - [`../../src/worker/routes/public-write-submissions.ts`](../../src/worker/routes/public-write-submissions.ts)
  - [`../../src/worker/routes/admin-places.ts`](../../src/worker/routes/admin-places.ts)
  - [`../../src/client/routes/admin/AdminPlacesRoute.tsx`](../../src/client/routes/admin/AdminPlacesRoute.tsx)
- 말할 포인트:
  - “비회원도 제출할 수 있게 했지만 visitor cookie, rate limit, Turnstile, 관리자 승인으로 운영 리스크를 나눴다.”
  - “moderation suggestion은 최종 결정자가 아니라 운영자의 판단을 돕는 보조 레이어로 뒀고, 외부 AI 생성 pipeline은 아직 분리된 backlog다.”
  - “E2E에서 제출, 검수 패널, 승인, 검색 노출까지 확인한다.”

### 사례 3. 운영 하드닝과 검증 자동화
- 왜 중요한가:
  - 공고는 “그럴듯한 결과”보다 “실제로 작동하는 결과물”과 “결과 검증”을 본다.
  - 개인 프로젝트라도 운영 실패를 숨기지 않고 pre-mortem으로 막은 경험은 강한 차별점이다.
- 증거:
  - [`../project/production-hardening-report-2026-05-08.md`](../project/production-hardening-report-2026-05-08.md)
  - [`../../scripts/smoke-remote.mjs`](../../scripts/smoke-remote.mjs)
  - [`../../scripts/measure-map-api.mjs`](../../scripts/measure-map-api.mjs)
  - [`../../scripts/check-csp-inline-style-inventory.mjs`](../../scripts/check-csp-inline-style-inventory.mjs)
  - [`../../.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- 말할 포인트:
  - “운영 DB 장애가 mock fallback으로 정상처럼 보이는 리스크를 제거했다.”
  - “remote smoke가 database source, auth boundary, OAuth redirect, admin boundary를 확인한다.”
  - “성능은 감으로 말하지 않고 map API p95 측정 스크립트와 목표를 뒀다.”

## 약점과 방어 논리

### 약점 1. 대규모 사용자 트래픽 경험은 아직 없다
- 숨기지 말 것:
  - 실제 운영 사용자 규모가 큰 서비스는 아니다.
- 방어:
  - “대규모 트래픽을 경험했다고 말하지 않는다. 대신 데이터 증가와 운영 장애에 대비해 bbox index, map API 측정, DB timeout, health check, Hyperdrive 도입 trigger를 문서화했다.”
  - 증거: [`../deploy/deploy-cloudflare.md`](../deploy/deploy-cloudflare.md), [`../project/production-hardening-report-2026-05-08.md`](../project/production-hardening-report-2026-05-08.md)

### 약점 2. AI 검수는 완전 자동 운영이 아니다
- 숨기지 말 것:
  - AI가 자동 승인/반려를 최종 결정하는 구조는 아니다.
- 방어:
  - “초기 MVP에서 자동 결정은 위험하다고 봤고, AI는 운영자 판단을 돕는 1차 검수 레이어로 제한했다. 최종 책임은 admin mutation과 audit action, E2E 검증으로 사람이 지는 구조다.”
  - 이 방어는 공고의 “AI 결과물까지 포함한 최종 품질 책임”과 잘 맞다.

### 약점 3. 큰 파일이 남아 있다
- 숨기지 말 것:
  - `src/worker/index.ts`, `MapRoute.tsx`, `naver-map-panel.tsx` 같은 hotspot이 있다.
- 방어:
  - “무리한 리팩터링보다 회귀 위험을 먼저 통제했다. 큰 파일은 [`../refactoring-large-files.md`](../refactoring-large-files.md)에 분리 순서와 보호 테스트를 문서화했다.”
  - “Fellowship에서 팀 환경에 들어가면 이 기준으로 작게 분리할 수 있다.”

### 약점 4. 채용 공고의 기업 솔루션 도메인과 알뜰맵 도메인이 다르다
- 숨기지 말 것:
  - 알뜰맵은 B2B SaaS가 아니라 생활 정보 서비스다.
- 방어:
  - “도메인은 다르지만 복잡한 입력을 구조화하고, 운영자 workflow를 설계하고, AI 검수 보조를 붙이고, 배포/검증 책임을 지는 방식은 기업 솔루션 문제와 유사하다.”
  - “특히 관리자 큐와 구조화된 moderation suggestion 계약은 고객 운영 workflow를 제품화하는 연습이다.”

## 제출 전 보강하면 좋은 포인트

1. GitHub README 상단에 “Sionic 제출용 읽는 순서” 링크를 짧게 추가한다.
2. 운영 URL에서 테스트 계정/관리자 계정 공개 범위를 결정한다. 관리자 credential을 공개하지 않을 경우, admin 화면 캡처와 E2E 링크로 대체한다.
3. `docs/readme/` 스크린샷이 최신 디자인과 맞는지 다시 캡처한다.
4. 외부 AI provider를 실제 연결할 때 summary/check/flag 생성 기준, 비용·재시도·개인정보 정책을 별도 설계하고 provider sandbox에서 검증한다. 현재는 [주요 도메인 설계](../02-설계/주요-도메인-설계.md)에 미구현 경계가 기록돼 있다.
5. 큰 파일 hotspot에 대한 후속 PR 1개를 작게 분리해두면 “약점을 알고 줄이는 사람”으로 보이기 좋다.
