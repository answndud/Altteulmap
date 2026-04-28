# PROGRESS.md

기준일: 2026-04-27

## 문서 규칙
- 이 문서는 active 상태, blocker, 최근 검증, 다음 액션만 유지한다.
- 작업이 완료되면 이 문서의 최종 상태, 검증, 결과를 정리해 [COMPLETED.md](./COMPLETED.md)로 이동하고, active 문서에서는 바로 삭제한다.
- active 문서 상한:
  - 완료된 작업 0건 유지
  - 진행 중이거나 아직 끝나지 않은 작업만 남김
  - 작업이 모두 끝나면 완료 항목을 archive로 넘긴 뒤 active 본문은 전부 삭제
  - 모든 active 작업이 끝난 최종 상태는 `현재 active 작업 없음`만 남김

## Active 작업

### 전체 개발 코드 동작 보존 리팩터링
- 상태:
  - 1차 코드 리팩터링 진행 중.
  - 전용 브랜치 `codex/refactor-development-code`에서 진행한다.
  - 기존 미커밋 배포 리팩터링 4개 파일은 체크포인트 커밋으로 분리했다.
  - 지도 패널 마커 시각화 로직과 장소 지도 미리보기 캐시 로직을 별도 모듈로 분리했다.
- 현재 범위:
  - 신규 기능, DB migration, API contract 변경, 배포 방식 변경은 제외한다.
  - 리팩터링 중 발견한 동작 변경 필요 버그는 후속 작업으로 분리한다.
- 최근 검증:
  - `npm run lint`
    - 통과
  - `npm run typecheck`
    - 통과
  - `WORKERS_CI=1 PATH="/opt/homebrew/opt/node@20/bin:$PATH" npm run cf:build:admin`
    - 체크포인트 배포 리팩터링 검증 통과
  - `npm run deploy:check:admin`
    - 체크포인트 배포 리팩터링 검증 통과
  - `git diff --check`
    - 체크포인트 배포 리팩터링 검증 통과
- 다음 액션:
  - 현재 1차 코드 리팩터링 배치를 커밋한다.
  - GoodPrice import 스크립트와 운영 스크립트의 pure helper 중복을 추가로 정리한다.
