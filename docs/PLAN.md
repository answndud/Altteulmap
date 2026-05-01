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

Next.js 기반 앱을 Vite + React + Cloudflare Worker 구조로 동작 보존형 이관한다.

현재 active 단계는 external staging/cutover 대기다. Phase 5 admin UI/API 이관, Phase 6 Vite/Worker 산출물 점검, Vite local smoke 자동화는 로컬에서 통과했다. 다음 작업은 Cloudflare Vite staging/preview Worker URL과 Kakao/Naver OAuth redirect URI 등록이 완료된 뒤 live callback과 staging smoke를 진행하는 것이다.

## 목표
- 사용자 플로우, API path/response shape, DB schema, env 이름, 운영 데이터는 바꾸지 않는다.
- public/admin/API를 단일 Cloudflare Worker와 단일 React SPA로 통합한다.
- 기존 credentials, Kakao, Naver 인증 의미를 보존한다.
- 장소 상세 SSR과 장소별 OG meta는 1차 범위에서 제외하고, sitemap/robots/manifest/기본 title/description/canonical만 유지한다.
- 마이그레이션 중 깨달은 점은 `docs/blog/next-to-vite-migration-retrospective.md`에 회고 글 형식으로 누적한다.

## 우선순위
1. Phase 0: 기준선 문서화, API contract inventory, Auth baseline 고정
2. Phase 1: 기존 Next production 경로를 보존한 Vite/Worker 스캐폴드와 SPA fallback 검증 추가
3. Phase 2: public UI를 React Router SPA로 이관 완료, mock Worker API 기준 parity gap 정리
4. Phase 3: Next route handler를 Worker API로 이관하고 API contract 비교
5. Phase 4: credentials, Kakao, Naver 인증과 세션을 Worker에서 보존 구현
6. Phase 5: admin UI/API를 단일 앱의 `/admin/*`, `/api/admin/*`로 통합
7. Phase 6: Cloudflare Vite/Worker 배포 설정 전환
8. Phase 7: parity 검증 후 Next/OpenNext/admin duplicate 제거
9. Phase 8: 완료 archive와 active 문서 정리

## 완료 기준
- `npm run lint`, `npm run typecheck`, `git diff --check` 통과
- public/admin 핵심 Playwright smoke 통과
- 기존 API path와 response contract 유지 확인
- NextAuth/Auth.js cookie, session, callback, redirect baseline 대비 인증 동작 유지 확인
- `/api/*`, `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`, client route SPA fallback 검증 통과
- `/admin/*` UI 보호와 `/api/admin/*` 서버 권한 검사를 별도 테스트로 확인
- Cloudflare staging smoke 후 production cutover 가능 상태 확인
- 기존 `.next`/`.open-next`와 새 `dist`/Worker bundle 크기, build 시간, 첫 로드 JS 크기 비교 기록
- `docs/migration-next-to-vite-react.md`, `docs/blog/next-to-vite-migration-retrospective.md`, `docs/PROGRESS.md`, `docs/COMPLETED.md`가 작업 결과와 일치
