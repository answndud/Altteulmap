# Local AI Workflow

이 디렉터리는 이 저장소에서만 쓰는 repo-local AI 작업 규칙과 보조 자료를 모아둔 공간입니다.

## 구성
- `skills/`
  - 기능 구현 전 확인할 프로젝트 전용 지침
- `reviewers/`
  - PR 전이나 큰 변경 후 자체 점검용 체크리스트

## 현재 포함된 자료
- `skills/database-migrations`
- `skills/api-design`
- `skills/verification-loop`
- `skills/e2e-testing`
- `skills/impeccable`
- Impeccable 디자인 commands: `audit`, `critique`, `polish`, `typeset`, `layout`, `colorize`, `adapt`, `animate`, `bolder`, `quieter`, `delight`, `distill`, `clarify`, `harden`, `optimize`, `overdrive`, `shape`
- `reviewers/typescript-reviewer.md`
- `reviewers/database-reviewer.md`

## 원칙
- 전역 `~/.codex`, `~/.claude`를 건드리지 않는다.
- 이 저장소에 필요한 것만 유지한다.
- 새 규칙을 추가하면 `AGENTS.md`, `PLAN.md`, `PROGRESS.md`도 같이 갱신한다.
- 디자인/프론트엔드 작업은 `.impeccable.md`를 기준으로 Impeccable skill을 사용한다.
- Impeccable CLI 검사는 전역 설치 대신 `npm run design:detect` 또는 `npm run design:detect:json`으로 실행한다.
