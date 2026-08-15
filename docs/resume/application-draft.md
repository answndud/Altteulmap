# 지원서 초안

아래 문장은 바로 제출 가능한 톤으로 작성했다. 제출 전 `[이름]`, `[GitHub URL]`, `[개인 사이트 또는 블로그]`만 채우면 된다.

## 자기소개
안녕하세요. 저는 실제 문제를 제품 흐름, 데이터 구조, 운영 검증까지 연결해 구현하는 풀스택 개발자 [이름]입니다.

최근에는 고물가 상황에서 저렴한 식당과 생활 서비스 정보를 지도 기반으로 찾고 제보할 수 있는 서비스인 알뜰맵을 개발했습니다. 단순히 장소 목록을 보여주는 데서 끝내지 않고, 공공 데이터 import, 지도 탐색, 가격 항목, 사용자 제보, 신고, 북마크, 관리자 승인, 구조화된 moderation suggestion 패널, 운영 배포와 smoke 검증까지 하나의 MVP로 닫았습니다. 외부 AI provider가 suggestion을 자동 생성하는 pipeline은 아직 구현하지 않았습니다.

이 프로젝트에서 가장 신경 쓴 부분은 “AI로 빠르게 만들기”가 아니라 “AI와 함께 만든 결과를 어떻게 검증하고 책임질 것인가”였습니다. PRD/TRD로 문제를 쪼개고, Next.js에서 Vite React + Cloudflare Worker 구조로 이관하면서 API contract와 auth/admin 동작을 보존했으며, lint/typecheck/unit/E2E/local smoke/remote smoke/CI/deploy check로 결과를 확인했습니다.

## 지원 이유
Sionic AI Native Engineer Fellowship에 지원하는 이유는 공고에서 강조한 기준이 제가 프로젝트를 만들며 중요하게 본 기준과 맞기 때문입니다.

저는 학습 이력보다 “무엇을 만들었고, 어떤 방식으로 문제를 해결했는가”가 더 중요하다고 생각합니다. 알뜰맵에서도 처음부터 완성된 요구사항이 있었던 것이 아니라, 흩어진 저가 장소 정보를 어떻게 신뢰 가능한 가격 중심 지도 서비스로 만들지부터 다시 정의했습니다. 이후 사용자 탐색, 공개 제보, abuse 방어, 운영자 승인, AI 검수 보조, 운영 배포까지 필요한 문제를 나누고 하나씩 닫았습니다.

Sionic이 찾는 “AI를 협력자로 삼아 더 높은 수준의 문제를 해결하고 결과에 책임지는 사람”이라는 기준도 제 작업 방식과 맞습니다. 저는 AI를 코드 자동완성 도구로만 쓰지 않고, 요구사항 구조화, UI critique, 마이그레이션 계획, 구현 검토, 문서화에 활용합니다. 다만 최종 판단은 테스트와 운영 검증으로 제가 책임지는 방식으로 일합니다.

## AI 활용 경험
알뜰맵에서 AI를 활용한 방식은 크게 세 가지입니다.

첫째, 요구사항을 구조화하는 데 사용했습니다. “가성비 장소 지도”라는 막연한 아이디어를 PRD/TRD로 나누고, 지도 탐색, 가격 제보, 가격 이력, 공개 쓰기, 관리자 승인, AI 1차 검수, 운영 배포라는 단위로 분해했습니다. AI는 빠르게 초안을 만들고 빠진 관점을 질문하는 파트너로 쓰되, 최종 범위와 우선순위는 실제 구현 가능성과 운영 리스크를 기준으로 정했습니다.

둘째, 구현 속도와 품질 피드백을 높이는 데 사용했습니다. 디자인 개선에서는 repo-local Impeccable skill과 critique workflow를 사용해 화면 단위 문제를 찾았고, Next.js에서 Vite React + Worker API로 이관할 때는 API contract를 먼저 고정한 뒤 단계별로 검증했습니다. AI가 제안한 코드를 그대로 붙이는 방식이 아니라, 기존 코드 구조와 테스트가 받아들일 수 있는 형태로 조정했습니다.

셋째, 검증 책임을 자동화했습니다. 알뜰맵에는 `npm run verify`, unit test, Playwright E2E, local smoke, remote smoke, deploy output check, CSP inventory, production hardening report가 있습니다. 특히 공개 장소 등록에서 관리자 승인 후 검색 노출까지 확인하는 E2E와, 운영 URL에서 DB source/auth boundary/OAuth redirect를 확인하는 smoke를 통해 “작동해 보이는 화면”이 아니라 실제 흐름을 확인했습니다.

또한 제품 내부에는 운영자 판단 보조를 위한 moderation suggestion 계약과 패널이 있습니다. 장소 등록, 가격 제보, 신고 큐에서 suggested action, confidence, summary, checks, flags를 구조화해 표시할 수 있습니다. 현재 외부 AI provider가 새 제안을 생성하는 pipeline은 없으며, 운영자는 제안이 있더라도 승인/반려/상태 변경을 직접 확정합니다.

## 포트폴리오 설명
알뜰맵은 한국의 저렴한 식당과 생활 서비스 정보를 지도 기반으로 탐색하고 제보할 수 있는 웹 서비스입니다.

기술적으로는 Vite 8, React 19, React Router, Tailwind CSS 4, Hono, Cloudflare Workers, Supabase PostgreSQL, Drizzle ORM, NAVER Maps JavaScript API, Playwright로 구성했습니다. 공개 앱과 관리자 앱, API를 단일 Worker로 통합해 운영 표면적을 줄였고, 공공 데이터 1,000건을 정제해 초기 지도 데이터로 사용했습니다.

제품 흐름은 다음과 같습니다. 사용자는 지도에서 저렴한 장소를 찾고, 가격과 상세 정보를 확인하고, 비회원 상태에서도 장소/가격/댓글/신고를 제출할 수 있습니다. 운영자는 관리자 화면에서 제출 내용을 확인하고, 저장된 moderation suggestion이 있으면 참고해 승인/반려를 확정합니다. 승인된 데이터는 다시 지도 검색과 상세 화면에 반영됩니다.

이 프로젝트에서 보여주고 싶은 역량은 특정 라이브러리 사용 경험보다, 실제 서비스를 끝까지 닫는 방식입니다. PRD/TRD 작성, 데이터 import, DB schema, public/admin API, 인증, 운영 배포, smoke 검증, production hardening, CI까지 한 저장소 안에 연결했습니다.

주요 링크:
- 운영 서비스: https://altteulmap.altteul-lab.workers.dev
- GitHub: [GitHub URL]
- 프로젝트 README: `README.md`
- 배포/운영 문서: `docs/deploy/deploy-cloudflare.md`
- 운영 하드닝 문서: `docs/project/production-hardening-report-2026-05-08.md`

## 짧은 제출 버전
저는 실제 문제를 제품 구조, 코드, 운영 검증까지 연결하는 풀스택 개발자입니다. 최근에는 저렴한 식당과 생활 서비스 정보를 지도 기반으로 탐색하고 제보할 수 있는 알뜰맵을 개발했습니다. 이 프로젝트는 Vite React SPA, Cloudflare Worker API, Supabase PostgreSQL, NAVER Maps, 관리자 화면, moderation suggestion 계약, Playwright E2E, local/remote smoke, CI/deploy check까지 포함한 운영 가능한 MVP입니다. 외부 AI 자동 검수는 미완료 범위로 분리했습니다.

제가 AI를 활용하는 방식은 단순 코드 생성이 아니라 문제 구조화, 구현 속도 향상, 설계 검토, UI critique, 문서화, 검증 자동화에 가깝습니다. 다만 AI가 만든 결과를 그대로 신뢰하지 않고, PRD/TRD, 테스트, smoke, 운영 문서로 최종 품질 책임을 제 쪽에 남깁니다. Sionic이 말하는 “AI와 함께 더 큰 문제를 풀 수 있는 사람”이라는 기준에 맞춰, 실제 결과물과 검증 방식으로 역량을 보여드리고 싶습니다.

## 아주 짧은 소개 문장
AI를 단순 자동완성이 아니라 문제 구조화와 생산성 증폭 도구로 쓰고, 최종 결과는 테스트와 운영 검증으로 책임지는 풀스택 개발자입니다.
