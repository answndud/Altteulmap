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

### Cloudflare admin Worker 빌드 속도 개선
- 대상: Cloudflare Workers Builds `altteulmap-admin`
- 목표: dashboard command 우회 없이 repo 구조와 build script를 정리해 admin 자동 배포 시간을 줄인다.
- 우선순위:
  - 현재 느린 구간과 중복 설치 경로 확인
  - `apps/admin` root 기준 Cloudflare build가 루트 의존성을 반복 설치하지 않도록 스크립트 개선
  - Cloudflare Build cache와 watch paths를 적용해 retry build와 문서-only build 비용을 줄인다.
  - Workers CI 환경에서 admin deploy build가 불필요한 타입 검증을 반복하지 않도록 조정한다.
  - 기존 successful dashboard 설정(`Path=apps/admin`, `Install=npm ci`, `Build=npm run build`, `Deploy=npx wrangler deploy`)과 호환 유지
  - 로컬 검증 및 원격 check duration 재확인
- 완료 기준:
  - admin Worker build/deploy 경로가 통과한다.
  - 원격 `Workers Builds: altteulmap-admin`가 성공한다.
  - 개선 전/후 duration 또는 병목 차이를 `PROGRESS.md`에 남긴다.
