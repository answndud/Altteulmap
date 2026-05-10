# PROGRESS.md

## Active 상태

### 작업명
React Doctor식 코드베이스 품질 개선 계획

### 현재 상태
- `millionco/react-doctor`는 설치/실행하지 않고, 공개 README 기준 평가 축만 참고해 현재 프로젝트를 수동 진단했다.
- 기준 점수는 `74/100`으로 기록했다.
- 카테고리별 기준 점수:
  - State & Effects: `15/20`
  - Architecture: `14/20`
  - Performance: `15/20`
  - Security: `16/20`
  - Accessibility: `13/20`
  - Dead Code / Hygiene: `11/20`
- `docs/PLAN.md`를 React Doctor식 코드 품질 개선 active 계획으로 갱신했다.
- 계획에는 P0 기준선 문서화, P1 React lint/a11y/hook 검사 도입, P1 Admin UI 큰 파일 분리, P1 async data 패턴 정리, P2 accessibility semantic cleanup, P2 CSP blocker 축소, P2 dead-code/hygiene 검사, P3 performance 측정 하네스가 포함된다.
- 자체 리뷰 결과, 가장 큰 리스크는 ESLint plugin 도입 시 warning 대량 발생, Admin UI 분리 중 E2E contract 손상, semantic element 전환 중 nested interactive 충돌, Naver marker CSP 개선 중 hitbox/anchor 회귀다.
- P0 기준선 문서 `docs/project/react-quality-audit-2026-05-10.md`를 작성했다.
- P1 React 전용 lint/a11y/hook 검사 도입을 완료했다.
  - `eslint-plugin-react-hooks`
  - `eslint-plugin-jsx-a11y`
  - `eslint-plugin-react-refresh`
- React Hooks 위반은 error, JSX a11y와 React Refresh는 초기 감시망으로 warning 중심 적용했다.
- 초기 lint warning 16건 중 Hook dependency와 label 경고를 수정해 8건으로 줄였다.
- 남은 8건은 `PlaceCard`, `MobilePlaceListSheet`의 `article role="button"` 및 stop-propagation wrapper에 대한 a11y warning이며, P2 semantic cleanup에서 처리한다.
- P1 Admin UI 큰 파일 분리 일부를 진행했다.
  - `src/client/routes/admin/types.ts`
  - `src/client/routes/admin/api.ts`
  - `src/client/routes/admin/useAdminData.ts`
  - `src/client/routes/admin/AdminAccessGate.tsx`
  - `src/client/routes/admin/AdminFrame.tsx`
- `src/client/routes/admin/AdminRoutes.tsx`는 1324줄에서 1033줄로 감소했다.
- 남은 Admin UI 분리 작업은 page/card/filter component 분리와 `AdminRoutes.tsx` route assembly 축소다.

### 최근 검증
- 문서 계획 작성 전 필수 문서 확인:
  - `docs/PLAN.md`
  - `docs/PROGRESS.md`
  - `docs/product/prd.md`
  - `docs/product/trd.md`
- `docs/PLAN.md` 자체 리뷰 완료.
- `git diff -- docs/PLAN.md`로 변경 범위 확인 완료.
- P0/P1 기준선 검증 통과:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run deploy:check:vite`
  - `npm run csp:inventory`
- React lint 도입 후 검증 통과:
  - `npm run lint` 통과, warning 8건
  - `npm run typecheck` 통과
  - `git diff --check` 통과
- Admin UI type/API/hook/access/frame 분리 후 검증 통과:
  - `npm run typecheck`
  - `npm run lint` 통과, warning 8건
  - `npm run deploy:check:vite`
  - `npm run test:e2e:smoke` 통과, 10 passed
- 참고:
  - admin targeted spec을 seed/rate-limit 초기화 없이 직접 실행했을 때 fixture/rate-limit 실패가 발생했다.
  - 정식 래퍼 `npm run test:e2e:smoke`는 DB push/seed/build를 포함해 통과했다.

### 다음 액션
- P1. Admin UI page/card/filter component 분리를 이어서 진행한다.
- 목표는 `AdminRoutes.tsx`를 route assembly 중심으로 줄이고, 각 page/card 파일을 350줄 이하로 유지하는 것이다.
- Admin split 다음 검증은 `npm run typecheck`, `npm run lint`, `npm run test:e2e:smoke`, 필요 시 admin targeted E2E를 정식 seed 래퍼 기준으로 실행한다.
