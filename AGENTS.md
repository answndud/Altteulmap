# AGENTS.md

## 목적
- 이 파일은 앞으로 이 저장소에서 작업하는 에이전트가 반드시 따라야 할 문서 운영 규칙을 적어 둔 것이다.
- 목표는 작업이 중간에 끊겨도 다음 세션에서 바로 이어갈 수 있게 만드는 것이다.

## 필수 규칙
1. 작업을 시작하기 전에 `docs/PLAN.md`, `docs/PROGRESS.md`, `docs/product/prd.md`, `docs/product/trd.md`를 먼저 확인한다.
2. `docs/COMPLETED.md`는 archive 문서다. 과거 맥락이 필요할 때만 읽고, 세션 시작 필수 읽기 대상으로 취급하지 않는다.
3. active 문서인 `PLAN.md`, `PROGRESS.md`는 번호 없이 현재 작업 자체를 설명한다. 완료된 작업은 `COMPLETED.md`에만 append 순서 기준 연속 archive 번호를 부여한다.
4. 구현 우선순위나 범위가 바뀌면 코드보다 먼저 `docs/PLAN.md`를 갱신한다.
5. 의미 있는 구현, 수정, 검증이 끝나면 `docs/PROGRESS.md`를 즉시 갱신한다.
6. 작업이 완료되어 active 상태를 벗어나면 `docs/PROGRESS.md`의 최종 상태, 검증, 결과를 정리해 `docs/COMPLETED.md`로 archive한다.
7. archive는 raw copy/paste snapshot이 아니라 다시 읽기 좋은 요약형 포맷으로 작성한다.
8. `docs/COMPLETED.md`는 시간 오름차순으로 유지한다. 가장 최근에 끝난 작업이 문서 맨 아래에 오도록 append한다.
9. `docs/COMPLETED.md`의 각 항목에는 최소한 `배경`, `변경 내용`, `코드/문서`, `검증`, `결과`가 들어가야 한다. active 문서보다 훨씬 자세해야 한다.
10. `PLAN.md`에는 active 계획만 남기고, `PROGRESS.md`에는 진행 중인 상태만 남긴다. 완료된 작업은 active 문서에 1건도 남기지 않는다.
11. active 작업이 모두 끝나면 `PLAN.md`, `PROGRESS.md`의 작업 본문은 전부 비우고 `현재 active 작업 없음`만 남긴다.
12. 세션을 마칠 때는 다음 사람이 바로 이어서 작업할 수 있을 정도로 현재 상태를 남긴다.
13. 코드와 문서가 어긋나면 같은 작업 안에서 함께 수정한다.
14. 새 기능을 시작할 때는 현재 계획에 없는 기능인지 먼저 확인하고, 없으면 `docs/PLAN.md`에 추가한 뒤 진행한다.
15. 검증을 했으면 `docs/PROGRESS.md`에 어떤 명령을 돌렸는지 남긴다.
16. 작업 중단 시점에도 미완료 상태, 남은 이슈, 다음 액션을 `docs/PROGRESS.md`에 적는다.

## 문서 역할
- `docs/PLAN.md`
  - 앞으로 무엇을 만들지
  - 무엇이 먼저인지
  - 지금 active인 작업과 완료 기준
- `docs/PROGRESS.md`
  - 지금 active 상태가 어떤지
  - 현재 blocker와 최근 검증이 무엇인지
  - 작업별 다음 액션이 무엇인지
- `docs/COMPLETED.md`
  - 완료된 작업의 상세 archive
  - append 순서 기준 archive 번호
  - `PROGRESS.md`에서 정리해 옮긴 종료된 실행 로그와 배포/측정 이력의 요약
  - 더 이상 active 문서에 둘 필요가 없는 과거 결정
- `docs/product/prd.md`
  - 제품 목표와 사용자 가치
  - MVP 범위와 우선 기능
- `docs/product/trd.md`
  - 기술 설계와 배포/운영 제약
  - 구현 시 지켜야 할 기술 기준

## 작업 원칙
- 구현과 문서화는 분리하지 않는다.
- active 문서는 항상 짧게 유지하고, 완료된 긴 이력은 `COMPLETED.md`로 보낸다.
- archive는 읽기 좋은 상세형으로 정리하고, 번호는 `COMPLETED.md` 안에서만 append 순서대로 사용한다.
- 완료 archive는 `PLAN.md`가 아니라 작업 종료 시점의 `PROGRESS.md` 내용을 기준으로 정리한다.
- `COMPLETED.md`는 오래된 작업이 위, 최신 작업이 아래에 오도록 유지한다.
- `COMPLETED.md`는 active 문서의 축약본이 아니라, 나중에 다시 읽어도 작업 복기가 가능한 상세 문서여야 한다.
- 문서는 나중에 정리하는 것이 아니라 작업하면서 계속 최신화한다.
- 작업이 끝났더라도 다음 세션을 위해 마지막 active 상태를 남긴다.

## 로컬 AI 워크플로우
- 이 저장소는 전역 설정이 아니라 repo-local 설정만 사용한다.
- 보조 자료는 아래 경로에서 찾는다.
  - `.agents/skills/database-migrations/SKILL.md`
  - `.agents/skills/api-design/SKILL.md`
  - `.agents/skills/verification-loop/SKILL.md`
  - `.agents/skills/e2e-testing/SKILL.md`
  - `.agents/skills/impeccable/SKILL.md`
  - `.impeccable.md`
  - `.agents/reviewers/typescript-reviewer.md`
  - `.agents/reviewers/database-reviewer.md`
- 적용 규칙
  - DB schema 또는 migration 변경 전에는 `database-migrations`를 먼저 확인한다.
  - API route를 추가/수정할 때는 `api-design`을 먼저 확인한다.
  - 큰 변경 후에는 `verification-loop` 기준으로 검증한다.
  - Playwright나 브라우저 흐름을 추가할 때는 `e2e-testing`을 참고한다.
  - 디자인/프론트엔드 UI 작업은 `.impeccable.md`를 먼저 확인하고, 필요하면 Impeccable skill(`impeccable`, `audit`, `critique`, `polish`, `typeset`, `layout`, `colorize`, `adapt` 등)을 사용한다.
  - Impeccable CLI 검사는 전역 설치 대신 `npm run design:detect` 또는 `npm run design:detect:json`으로 실행한다.
  - TypeScript/Next.js 변경은 `typescript-reviewer` 기준으로 자체 점검한다.
  - DB 쿼리/인덱스/마이그레이션 변경은 `database-reviewer` 기준으로 자체 점검한다.

## 로컬 Hook 규칙
- git hook은 이 저장소의 `.githooks/`만 사용한다.
- 설치 명령: `npm run hooks:install`
- 기본 hook 동작
  - `pre-commit`: lint 실행, staged 파일의 `debugger`/secret 패턴 검사, lint 설정 파일 수정 차단
  - `commit-msg`: conventional commit 형식 검사
- lint/formatter 설정을 약하게 만들어 검사를 우회하지 않는다.
- 설정 파일 수정이 정말 필요하면 이유를 문서나 커밋 메시지에 남긴다.
