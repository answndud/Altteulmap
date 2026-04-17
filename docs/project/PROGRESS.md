# PROGRESS.md

기준일: 2026-04-17

## 문서 규칙
- 이 문서는 active 상태, blocker, 최근 검증, 다음 액션만 유지한다.
- 작업이 완료되면 이 문서의 최종 상태, 검증, 결과를 정리해 [COMPLETED.md](./COMPLETED.md)로 이동하고, active 문서에서는 바로 삭제한다.
- active 문서 상한:
  - 완료된 작업 0건 유지
  - 진행 중이거나 아직 끝나지 않은 작업만 남김
  - 작업이 모두 끝나면 완료 항목을 archive로 넘긴 뒤 active 본문은 전부 삭제
  - 모든 active 작업이 끝난 최종 상태는 `현재 active 작업 없음`만 남김

## 현재 상태 요약
- 운영 DB credential은 여전히 `Tenant or user not found` 상태라 blocked다.
- degraded fallback 기준 public/admin 흐름은 유지되고 있다. known demo/admin 로그인과 mock fallback 관리자 큐는 계속 열려 있어야 한다.
- public 지도 성능 보정은 최근 단계까지 live 반영돼 있으며, 첫 `/api/places/map` 호출은 1회 상태다.
- 실기기 QA는 아직 미완료지만, desktop/mobile emulation 기준 기본 지도 컨트롤 노출과 smoke는 확인된 상태다.

## Active Work Status

### 운영 DB 복구와 AI 검수 persisted live 반영
- 상태: `in_progress`
- 현재 blocker:
  - production `DATABASE_URL`/tenant credential 복구 필요
  - live DB에 `moderation_suggestions` migration 미적용
- 현재까지 확인된 사실:
  - degraded fallback public/admin은 usable 상태다.
  - live public은 `preview-first delayed boot`, 초기 viewport refetch 제거, `/api/places/map` 1회 호출 상태로 유지 중이다.
  - live admin은 fallback 로그인과 mock 관리자 큐 기준으로는 동작한다.
- 최근 검증:
  - `npm run db:check:production`
    - 실패, `Tenant or user not found`
  - `npm run verify:quick`
    - 통과
  - `npm run verify`
    - 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev SMOKE_ADMIN_URL=https://altteulmap-admin.altteul-lab.workers.dev npm run smoke:remote`
    - 통과
  - local/live Playwright 측정
    - 홈 첫 `/api/places/map` 호출 1회
    - live public total requests `43`, `fetch 1`, `image 22`
- 다음 액션:
  - credential source 복구
  - migration 적용
  - public/admin 재배포 후 AI 패널 persistence 재검증

### 모바일/운영 실기기 QA
- 상태: `pending`
- 선행 조건:
  - 운영 DB 복구와 persisted live 경로 확인이 우선
- 준비 상태:
  - [mobile-qa-checklist.md](/Users/alex/project/altteulmap/docs/project/mobile-qa-checklist.md) 존재
  - Chromium desktop/mobile emulation 기준 `현재 위치`, `이 지역 검색`, 모바일 `목록 보기` 노출 확인
- 아직 남은 확인:
  - iPhone Safari 실기기
  - Android Chrome 실기기
  - 관리자 AI 패널 실기기 확인
- 다음 액션:
  - 운영 DB 복구 작업 마감 직후 checklist 기준으로 public/admin 실사용 QA 수행
