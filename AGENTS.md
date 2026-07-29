# AGENTS.md

## 목적
- 이 파일은 앞으로 이 저장소에서 작업하는 에이전트가 반드시 따라야 할 문서 운영 규칙을 적어 둔 것이다.
- 목표는 작업이 중간에 끊겨도 다음 세션에서 바로 이어갈 수 있게 만드는 것이다.

## 필수 규칙

1. 작업을 시작하기 전에 루트 `PLAN.md`, `docs/product/prd.md`, `docs/product/trd.md`를 먼저 확인한다.
2. 계획을 만들거나 갱신하거나 재개할 때는 `plan` skill 규칙을 따른다.
3. `PLAN.md`는 루트 `AGENTS.md`와 같은 위치에 두고 현재와 미래의 구현 작업만 기록한다.
4. 구현 우선순위나 범위가 바뀌면 코드보다 먼저 `PLAN.md`를 갱신한다.
5. 계획이 필요한 신규 기능이나 여러 단계 작업은 실행 가능한 slice로 `PLAN.md`에 추가한 뒤 진행한다.
6. 각 slice에는 likely files, 구체적 변경, 정확한 검증 명령, observable finish state를 적는다.
7. 다음 실행 작업을 가장 먼저 배치하고, 완료된 slice와 phase는 즉시 제거한다.
8. active 작업이 없으면 `No active work`만 남기고 완료 이력이나 실행 로그를 기록하지 않는다.
9. 작업을 중단할 때는 남은 작업, 구체적 blocker, 다음 실행 action만 `PLAN.md`에 남긴다.
10. 코드와 문서가 어긋나면 같은 작업 안에서 함께 수정한다.

## 문서 역할

- `PLAN.md`
  - 현재 목표와 observable finish state
  - 실행 순서대로 정렬한 active slice
  - likely files, concrete changes, verification command, done condition
  - 필요할 때만 최대 5개의 구체적인 backlog
- `docs/product/prd.md`
  - 제품 목표와 사용자 가치
  - MVP 범위와 우선 기능
- `docs/product/trd.md`
  - 기술 설계와 배포/운영 제약
  - 구현 시 지켜야 할 기술 기준

## 작업 원칙

- `PLAN.md`는 실행 문서이며 정책, 철학, 튜토리얼, 코드 덤프, 명령 출력, 완료 이력을 넣지 않는다.
- active 계획은 최대 3개 phase로 유지하고, 각 slice는 보통 1~4개 파일 범위로 제한한다.
- 완료 이력은 별도 상태 문서로 옮기지 않고 Git history, PR, 목적별 문서에서 확인한다.
- `DONE.md`, `PROGRESS.md`, `COMPLETED.md`를 프로젝트 상태 문서로 사용하지 않는다.
- 문서는 나중에 정리하는 것이 아니라 작업하면서 현재 상태로 계속 갱신한다.

## 로컬 AI 워크플로우
- 저장소 고유 규칙과 보조 자료는 repo-local 설정을 우선한다.
- 프로젝트 계획 문서는 `plan` skill과 루트 `PLAN.md`를 사용한다.
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
