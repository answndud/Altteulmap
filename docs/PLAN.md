# PLAN.md

기준일: 2026-04-27
목표: Altteulmap를 `지도 기반 절약 장소 탐색 + 가격 제보` 서비스 기준에서 MVP 완성도와 출시 준비 수준까지 끌어올린다.

## 문서 규칙
- 이 문서는 active roadmap만 유지한다.
- 완료된 작업은 [COMPLETED.md](./COMPLETED.md)에 archive한 뒤 여기서 바로 삭제한다.
- 세션 시작 시 기본으로 읽는 문서는 `PLAN.md`, `PROGRESS.md`, `docs/product/prd.md`, `docs/product/trd.md`다.
- active 문서에 완료된 작업을 1건도 남기지 않는다.
- 모든 active 작업이 끝나면 작업 본문은 전부 삭제하고 `현재 active 작업 없음`만 남긴다.

## 범위 원칙
- 우선순위: `지도 Read MVP -> 쓰기 데이터 축적 -> 운영 품질 -> 인증/출시 -> 확장 기능`
- 현재 정책: `비회원 읽기, 비회원 반응, 비회원/회원 공개 쓰기(장소 등록/댓글/신고/가격 제보), 회원 전용 북마크`
- 현재 운영 URL은 `workers.dev` split(public `altteulmap.altteul-lab.workers.dev`, admin `altteulmap-admin.altteul-lab.workers.dev`) 기준으로 유지한다.
- 기본 운영 배포는 Cloudflare Workers Builds가 맡고, 로컬 `deploy:public`/`deploy:admin`은 fallback으로만 사용한다.
- 이후 UI 작업은 ad-hoc polish가 아니라 `.impeccable.md`와 repo-local Impeccable skill 기준으로만 진행한다.
- 별도 정책 결정 전 보류:
  - 커뮤니티 `bang`
  - 핫딜 `deal`

## Active 작업

### 전체 개발 코드 동작 보존 리팩터링
- 목표:
  - API 응답, DB schema, route path, auth policy, Cloudflare 설정, 사용자 플로우를 바꾸지 않고 유지보수성을 개선한다.
  - 큰 파일, 중복 구조, 운영 스크립트, 폼/상태 메시지를 작은 배치로 나눠 정리한다.
- 우선순위:
  - 현재 미커밋 배포 리팩터링을 먼저 재검증하고 별도 체크포인트로 분리한다.
  - `src/features/places/repository.ts`, `src/features/map/naver-map-panel.tsx`, `scripts/import-goodprice.ts`처럼 큰 파일을 안전한 내부 helper 단위로 줄인다.
  - public/admin route entrypoint와 admin page/stub 중복을 줄인다.
  - 제보, 신고, 관리자 승인 폼의 validation/error/loading/success copy를 의미 변경 없이 명확하게 통일한다.
  - build/smoke/deploy check 스크립트의 중복 helper를 Cloudflare Worker-safe 제약 안에서 정리한다.
- 완료 기준:
  - 각 배치 후 `npm run lint`, `npm run typecheck`를 통과한다.
  - admin/build 관련 변경 후 `WORKERS_CI=1 PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin`와 `npm run deploy:check:admin`을 통과한다.
  - public/map/place/report 흐름을 건드린 경우 관련 smoke 또는 Playwright 검증을 통과한다.
  - 최종적으로 active 문서를 정리하고 `docs/COMPLETED.md`에 archive한다.
