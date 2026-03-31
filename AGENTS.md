# AGENTS.md

## 목적
- 이 파일은 앞으로 이 저장소에서 작업하는 에이전트가 반드시 따라야 할 문서 운영 규칙을 적어 둔 것이다.
- 목표는 작업이 중간에 끊겨도 다음 세션에서 바로 이어갈 수 있게 만드는 것이다.

## 필수 규칙
1. 작업을 시작하기 전에 `PLAN.md`와 `PROGRESS.md`를 먼저 확인한다.
2. 구현 우선순위나 범위가 바뀌면 코드보다 먼저 `PLAN.md`를 갱신한다.
3. 의미 있는 구현, 수정, 검증이 끝나면 `PROGRESS.md`를 즉시 갱신한다.
4. 세션을 마칠 때는 다음 사람이 바로 이어서 작업할 수 있을 정도로 현재 상태를 남긴다.
5. 코드와 문서가 어긋나면 같은 작업 안에서 함께 수정한다.
6. 새 기능을 시작할 때는 현재 계획에 없는 기능인지 먼저 확인하고, 없으면 `PLAN.md`에 추가한 뒤 진행한다.
7. 검증을 했으면 `PROGRESS.md`에 어떤 명령을 돌렸는지 남긴다.
8. 작업 중단 시점에도 미완료 상태, 남은 이슈, 다음 액션을 `PROGRESS.md`에 적는다.

## 문서 역할
- `PLAN.md`
  - 앞으로 무엇을 만들지
  - 무엇이 먼저인지
  - 어떤 범위까지 확장할지
- `PROGRESS.md`
  - 지금까지 무엇을 했는지
  - 어디까지 검증했는지
  - 다음에 무엇부터 하면 되는지

## 작업 원칙
- 구현과 문서화는 분리하지 않는다.
- 문서는 나중에 정리하는 것이 아니라 작업하면서 계속 최신화한다.
- 작업이 끝났더라도 다음 세션을 위해 마지막 상태를 남긴다.

## 로컬 AI 워크플로우
- 이 저장소는 전역 설정이 아니라 repo-local 설정만 사용한다.
- 보조 자료는 아래 경로에서 찾는다.
  - `.agents/skills/database-migrations/SKILL.md`
  - `.agents/skills/api-design/SKILL.md`
  - `.agents/skills/verification-loop/SKILL.md`
  - `.agents/skills/e2e-testing/SKILL.md`
  - `.agents/reviewers/typescript-reviewer.md`
  - `.agents/reviewers/database-reviewer.md`
- 적용 규칙
  - DB schema 또는 migration 변경 전에는 `database-migrations`를 먼저 확인한다.
  - API route를 추가/수정할 때는 `api-design`을 먼저 확인한다.
  - 큰 변경 후에는 `verification-loop` 기준으로 검증한다.
  - Playwright나 브라우저 흐름을 추가할 때는 `e2e-testing`을 참고한다.
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
