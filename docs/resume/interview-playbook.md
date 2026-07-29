# 면접 플레이북

## 30초 자기소개
안녕하세요. 저는 문제를 제품 구조, 코드, 운영 검증까지 연결해서 구현하는 풀스택 개발자 [이름]입니다. 최근에는 저렴한 식당과 생활 서비스 정보를 지도 기반으로 탐색하고 제보할 수 있는 알뜰맵을 만들었습니다. Vite React, Cloudflare Worker, PostgreSQL, NAVER Maps, 관리자 화면, AI 1차 검수, E2E와 remote smoke까지 포함해 운영 가능한 MVP로 닫았습니다. AI는 코드 자동완성보다 요구사항 구조화, 구현 속도 향상, 검증 루프 설계에 활용하고, 최종 품질은 제가 테스트와 운영 문서로 책임지는 방식으로 일합니다.

## 3분 프로젝트 설명
알뜰맵은 고물가 상황에서 사용자가 주변의 저렴한 식당과 생활 서비스를 빠르게 찾도록 만든 지도 기반 웹 서비스입니다.

처음 문제는 “저렴한 장소 정보가 커뮤니티나 SNS에 흩어져 있고 가격 최신성과 신뢰도가 낮다”였습니다. 저는 이 문제를 단순 목록 앱이 아니라 가격 중심 지도, 가격 항목, 제보, 검증, 이력, 신고, 관리자 승인 흐름으로 다시 정의했습니다.

사용자는 첫 화면에서 지도를 보고, 카테고리나 검색어로 장소를 찾고, 가격표형 marker와 목록에서 대표 가격을 확인합니다. 상세 시트에서는 가격 항목, 이력, 댓글, 반응, 공유를 확인할 수 있습니다. 비회원도 장소 등록, 가격 제보, 댓글, 신고를 남길 수 있지만 visitor cookie, rate limit, Turnstile, 관리자 승인으로 운영 리스크를 분리했습니다.

관리자는 `/admin`에서 장소 등록, 가격 제보, 신고를 검토합니다. 이때 AI 1차 검수 패널이 suggested action, confidence, summary, checks, flags를 보여주지만, 최종 승인/반려는 운영자가 합니다. AI를 자동 결정자로 두지 않고 운영자 판단을 돕는 레이어로 제한한 것이 의도입니다.

기술적으로는 Next.js/OpenNext에서 Vite React SPA + Cloudflare Worker API로 이관했습니다. 이관 전에는 API path, response shape, auth boundary, admin contract를 문서로 고정했고, 이관 후에는 local smoke, E2E, remote smoke, deploy check로 동작을 확인했습니다. 현재는 Cloudflare Workers에 배포되어 있고 Supabase PostgreSQL 운영 DB를 사용합니다.

이 프로젝트에서 가장 보여주고 싶은 점은 “AI를 사용했다”가 아니라 “AI와 함께 빠르게 만들되, 결과에 대한 책임을 검증 루프로 닫았다”는 점입니다. `npm run verify`, unit test, Playwright E2E, smoke, CI, production hardening report가 그 근거입니다.

## AI 활용 방식 답변
저는 AI를 세 단계에서 씁니다.

첫째, 문제 구조화입니다. 처음부터 정답이 없는 요구를 PRD/TRD로 나누고, 기능 범위, 데이터 모델, public write 정책, admin moderation 흐름, 배포/검증 기준으로 쪼갭니다. AI는 빠른 초안과 반례 질문을 만드는 데 도움을 줍니다.

둘째, 구현 가속입니다. 예를 들어 UI 개선에서는 critique와 design skill을 사용해 화면 문제를 찾고, 마이그레이션에서는 API contract 보존 항목을 체크리스트화했습니다. 다만 AI가 낸 코드를 그대로 반영하지 않고, 기존 코드 스타일, 타입, 테스트, 운영 리스크에 맞게 줄입니다.

셋째, 검증 자동화입니다. AI가 만든 결과도 결국 제 책임이므로 verify, E2E, smoke, remote smoke, deploy check, production hardening 문서로 닫습니다. 특히 운영 URL에서 DB source와 auth boundary를 확인하는 remote smoke를 둔 이유는, 화면이 정상처럼 보여도 운영 DB가 죽은 상태를 놓치지 않기 위해서입니다.

## 복잡한 요구사항 구조화 답변
저는 복잡한 요구가 들어오면 바로 구현하지 않고 네 가지로 나눕니다.

첫째, 사용자 가치입니다. 알뜰맵에서는 “싼 곳을 찾는다”가 아니라 “가격을 믿고 빠르게 비교한다”가 핵심이었습니다.

둘째, 데이터와 상태입니다. 장소, 가격 항목, 가격 이력, 제보, 신고, 북마크, 방문 telemetry를 각각 독립된 엔터티로 보고, 어떤 값이 append-only인지, 어떤 값이 현재 summary인지 나눴습니다.

셋째, 운영 정책입니다. 비회원도 쓰기 가능하게 하되 visitor cookie와 rate limit을 두고, AI는 1차 제안만 하며, 최종 반영은 운영자가 하도록 했습니다.

넷째, 검증 기준입니다. 기능별로 “어떤 테스트가 통과해야 끝난 것인지”를 정했습니다. 장소 등록은 제출 화면만 보는 것이 아니라 관리자 승인 후 홈 검색에 노출되는 E2E까지 확인합니다.

## AI 한계와 검증 방식 답변
AI는 빠르게 그럴듯한 코드를 만들지만, 세 가지 한계가 있다고 봅니다.

첫째, 기존 시스템 맥락을 놓칠 수 있습니다. 그래서 저는 먼저 PRD/TRD, PLAN, 기존 코드 구조를 읽고, 변경 범위를 문서화한 뒤 작업합니다.

둘째, 작동하지 않는 edge case를 놓칠 수 있습니다. 그래서 타입 검사와 E2E만이 아니라 smoke script로 실제 Worker runtime과 운영 URL을 확인합니다.

셋째, 제품 판단을 대신할 수 없습니다. 예를 들어 AI 1차 검수도 자동 승인으로 만들지 않았습니다. 가격 정보는 잘못 반영되면 신뢰를 잃기 때문에, AI는 summary와 flags를 만들고 운영자가 최종 결정합니다.

제가 보는 AI-native는 “AI에게 맡긴다”가 아니라 “AI로 생산성을 올리되 책임 경계를 더 명확히 한다”입니다.

## 예상 공격 질문과 방어 답변

### Q. 실제 사용자가 많은 서비스인가요?
A. 아직 대규모 사용자를 받은 서비스라고 말하지는 않습니다. 대신 운영 가능한 MVP와 성장 대비 기준을 만들었습니다. 운영 DB, Cloudflare Worker 배포, remote smoke, DB timeout, health check, map API p95 측정, bbox index, Hyperdrive 도입 trigger까지 준비했습니다. 트래픽 경험을 과장하기보다, 트래픽이 늘 때 무엇을 봐야 하는지 설계한 상태입니다.

### Q. AI 1차 검수가 실제로 얼마나 의미 있나요?
A. 자동 결정을 맡길 수준이라고 보지 않았습니다. 그래서 AI를 최종 판단자가 아니라 운영자의 검토 시간을 줄이는 보조 레이어로 뒀습니다. 패널은 suggested action, confidence, summary, checks, flags를 보여주고, 승인/반려는 운영자가 합니다. 이 구조가 초기 MVP에서는 더 책임 있는 선택이라고 봤습니다.

### Q. 개인 프로젝트인데 협업 역량을 어떻게 증명하나요?
A. 협업은 사람 수만으로 증명되는 것은 아니라고 봅니다. 다음 사람이 이어받을 수 있는 구조와 설명력이 중요합니다. 이 저장소에는 README, PRD/TRD, deploy guide, migration 문서, production hardening report, 루트 PLAN 단일 상태 운영 규칙, CI와 E2E가 있습니다. 제가 혼자 만든 프로젝트지만, 작업을 설명 가능한 단위로 남기는 습관을 보여줄 수 있습니다.

### Q. 왜 Next.js를 버리고 Vite React로 갔나요?
A. 기능 추가가 목적이 아니었습니다. 1인 개발과 AI agent 보조 개발에서 유지보수 경계를 줄이기 위해 public/admin/API를 단일 Worker runtime으로 정리했습니다. 이관 전에는 API contract와 auth/admin boundary를 먼저 고정했고, 이관 후에는 local smoke와 E2E, deploy check로 보존 여부를 확인했습니다.

### Q. 테스트가 과한 것 아닌가요?
A. 개인 프로젝트라면 화면만 보여줘도 되지만, 이 전형에서는 결과 검증 책임이 중요하다고 봅니다. 특히 AI를 쓰면 빠르게 만드는 만큼 회귀를 놓칠 수 있습니다. 그래서 핵심 user flow와 운영 smoke를 자동화했습니다. 모든 것을 테스트하려는 게 아니라, 사용자 제출, 관리자 승인, 가격 제보, 인증 boundary, 운영 배포처럼 깨지면 신뢰를 잃는 지점을 우선 테스트했습니다.

### Q. 가장 아쉬운 점은 무엇인가요?
A. 큰 파일이 남아 있는 점입니다. `MapRoute.tsx`, `naver-map-panel.tsx`, Worker entry 일부가 아직 큽니다. 다만 이 문제를 숨기지 않고 `docs/refactoring-large-files.md`에 hotspot과 분리 순서, 보호 테스트를 문서화했습니다. 무리하게 한 번에 분리하기보다 운영 기능을 안정화한 뒤 작은 단위로 줄이는 것이 맞다고 판단했습니다.

## 면접 데모 순서

1. 운영 서비스 첫 화면을 연다.
   - URL: https://altteulmap.altteul-lab.workers.dev
   - 설명: 첫 화면이 지도이며 가격표 marker와 목록이 같이 작동한다.
2. 검색/카테고리/지도 refresh를 보여준다.
   - 설명: 지도 viewport와 API가 연결되어 있고, 장소 목록과 marker가 같은 결과를 공유한다.
3. 장소 상세 시트를 연다.
   - 설명: 페이지 이동 없이 가격 항목, 이력, 댓글, 반응, 공유를 확인한다.
4. 제출 흐름을 설명한다.
   - 실제 제출은 면접 상황에 따라 생략하거나 staging/local에서 보여준다.
   - E2E 증거: `tests/e2e/submission-admin.spec.ts`
5. 관리자 화면을 보여준다.
   - 관리자 credential 공개가 안전하지 않으면 README 스크린샷과 E2E 파일로 대체한다.
   - 설명: AI 1차 검수 패널은 최종 결정자가 아니라 운영자 보조다.
6. 저장소 검증 증거를 보여준다.
   - `package.json` scripts
   - `.github/workflows/ci.yml`
   - `scripts/smoke-remote.mjs`
   - `docs/project/production-hardening-report-2026-05-08.md`
7. 마이그레이션 문서를 보여준다.
   - `docs/migration-next-to-vite-react.md`
   - 설명: 복잡한 기술 전환을 contract inventory와 smoke로 통제했다.
