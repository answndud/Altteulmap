# PLAN.md

기준일: 2026-04-21
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

## Active Work
| 상태 | 우선순위 | 작업 | 완료 기준 | 의존성 |
|---|---|---|---|---|
| `in_progress` | `P1` | 운영 DB를 복구하고 `AI 1차 검수` persisted live 경로를 마감한다 | 운영 DB에 `moderation_suggestions` migration이 적용되고, public/admin worker 재배포 후 live 관리자 큐에서 장소 등록/가격 제보/신고 카드의 AI 패널이 persistence 기준으로 보이며, degraded fallback 로그인과 mock 관리자 큐도 유지된다 | `src/db/schema.ts`, `drizzle/0010_military_wildside.sql`, `src/features/admin/**`, 운영 DB credential |
| `pending` | `P1` | 모바일/운영 실기기 QA를 다시 수행한다 | iPhone Safari와 Android Chrome 기준으로 `현재 위치`, `이 지역 검색`, 목록/상세 시트 drag, cluster 확대/축소, 익명 쓰기 핵심 흐름, 관리자 AI 패널 확인 결과가 체크리스트 형태로 남고, 발견된 이슈가 후속 작업으로 분리된다 | live public/admin URL, 실기기 또는 동등한 검증 환경, `tests/e2e/**` |
| `pending` | `P1` | Impeccable 기반 public/admin 디자인 개선 workflow를 순차 적용한다 | 홈/지도, 장소 상세, 등록/신고/empty/error state, 관리자 큐의 P1/P2 디자인 이슈가 단계별로 정리되고, `npm run design:detect:json`, 주요 화면 screenshot 비교, `npm run verify:quick`, `npm run verify` 결과가 `PROGRESS.md`에 남는다 | `.impeccable.md`, `.agents/skills/**`, 최근 `critique` baseline, 운영 DB/실기기 QA gate |

## Impeccable 디자인 개선 Workflow

### 운영 원칙
- 모든 디자인 구현은 repo-local 자료만 사용한다. 전역 `~/.codex`, `~/.claude`, 사용자 홈 설정은 변경하지 않는다.
- 각 batch 시작 전에 `.impeccable.md`와 해당 skill의 `SKILL.md`를 다시 확인한다.
- 순서는 `critique/shape로 범위 고정 -> distill로 복잡도 제거 -> layout/adapt로 구조와 반응형 정리 -> harden/clarify로 상태와 copy 보강 -> polish/audit/verification-loop로 검증`이다.
- 한 batch는 한 화면군 또는 한 사용자 흐름만 다룬다. 홈/지도, 상세/쓰기, empty/error, admin을 한 커밋 단위에서 섞지 않는다.
- 구현 중 범위나 우선순위가 바뀌면 코드보다 먼저 이 문서와 `PROGRESS.md`를 갱신한다.
- 완료된 batch는 `PROGRESS.md`의 상태/검증/결과를 정리해 `COMPLETED.md`로 archive하고 active 문서에서는 제거한다.

### Phase 0. Baseline과 범위 고정
- 사용할 skill: `critique`, `audit`, 필요 시 `shape`
- 목적:
  - 최근 critique 결과를 구현 가능한 acceptance criteria로 고정한다.
  - 화면군별 우선순위를 `홈/지도 -> empty/error/copy -> 상세/쓰기 -> admin -> polish/audit` 순서로 유지한다.
  - 새 기능 설계가 필요할 때만 `shape`로 별도 brief를 작성한다. 단순 refactor/polish는 기존 `.impeccable.md`와 critique 기준으로 진행한다.
- 현재 baseline:
  - `npm run design:detect:json`: `[]`
  - Impeccable live detector: desktop home `92`, mobile home `11`, place detail `12`, submit `2`, admin reports `6`
  - 주요 원인: nested cards와 과한 surface depth
- 완료 기준:
  - batch별 대상 화면, 성공 기준, 검증 명령이 `PROGRESS.md`에 기록된다.
  - 구현 시작 전에 어떤 skill을 쓸지 명확히 적힌다.

### Phase 1. 홈/지도 탐색 단순화
- 사용할 skill: `distill -> layout -> adapt`
- 대상:
  - `/`, `/map`에 해당하는 공개 탐색 흐름
  - desktop map/list split
  - mobile search/filter/map/bottom sheet
- 목표:
  - 첫 화면에서 "가격이 보이는 지도"가 즉시 드러나게 한다.
  - 검색, 범위 선택, 카테고리, 위치, 목록 전환의 동시 선택 부담을 줄인다.
  - 상위 wrapper/card를 줄이고 반복 장소 항목만 카드로 유지한다.
  - 카테고리 chip wall은 compact trigger와 active token 중심으로 정리한다.
- 완료 기준:
  - mobile 첫 viewport에 지도와 주요 가격 신호가 함께 보인다.
  - desktop에서 map이 primary, list가 supporting rail로 읽힌다.
  - nested cards live detector count가 baseline 대비 명확히 감소한다.
  - 터치 대상은 44px 이상이고, keyboard/focus 흐름이 유지된다.

### Phase 2. Empty/Error/Copy hardening
- 사용할 skill: `harden -> clarify`
- 대상:
  - `/place/[id]` not-found
  - `/bookmarks` empty state
  - `/login`, `/signup`의 진입/실패 상태
  - `/report`의 대상 누락 상태
  - 홈의 `현재 지도`, `전체 검색`, 위치/필터 copy
- 목표:
  - stale place URL이 기본 영어 404로 떨어지지 않게 한다.
  - empty state가 막다른 화면이 아니라 다음 행동을 제공하게 한다.
  - "이름 없는 장소"처럼 신뢰를 떨어뜨리는 fallback copy를 제거한다.
  - 액션 label은 `제출`, `확인` 같은 일반어보다 `장소 등록`, `가격 제보`, `지도로 돌아가기`처럼 구체화한다.
- 완료 기준:
  - 404/empty/error state마다 한국어 설명, 복구 CTA, 다음 경로가 있다.
  - form validation과 disabled/loading 상태 copy가 사용자의 다음 행동을 설명한다.
  - 주요 copy 용어가 public/admin 사이에서 일관된다.

### Phase 3. 장소 상세와 쓰기 흐름 정리
- 사용할 skill: `distill -> clarify -> adapt`
- 대상:
  - `/place/[id]`
  - `/submit`
  - 가격 제보, 댓글, 신고 진입 흐름
- 목표:
  - 상세 첫 화면은 가격, 주소, 검증/수정일, 가격 항목을 우선한다.
  - 가격 제보/댓글 form은 primary read task를 방해하지 않도록 접힘 CTA나 단계형 entry로 낮춘다.
  - 등록 form의 기본값과 helper copy가 잘못된 입력을 유도하지 않게 한다.
  - 모바일에서는 긴 form과 보조 행동이 한 화면에 과밀하게 나오지 않게 한다.
- 완료 기준:
  - 상세 first viewport에서 대표 가격과 신뢰 정보가 가장 강하게 보인다.
  - 제보/댓글/신고는 명확한 entry와 복구 가능한 cancel/back path를 가진다.
  - 모바일과 desktop 모두 horizontal overflow 없이 주요 form이 동작한다.

### Phase 4. 관리자 큐 밀도와 반복 패턴 개선
- 사용할 skill: `layout -> distill -> clarify`
- 대상:
  - `/admin`
  - `/admin/reports`
  - `/admin/places`
  - `/admin/prices`
- 목표:
  - 운영자가 큐를 빠르게 훑고 처리할 수 있도록 반복 card layout을 줄인다.
  - AI 검수 패널은 모든 증거를 항상 펼치기보다 summary row와 expandable detail로 분리한다.
  - 승인/반려/보류 같은 primary action hierarchy를 명확히 한다.
  - 이 단계에서는 DB schema나 moderation contract를 바꾸지 않는다. 데이터 계약 변경이 필요하면 별도 backend 작업으로 분리한다.
- 완료 기준:
  - 큐 화면에서 한 viewport당 처리 가능한 항목 수가 늘어난다.
  - AI suggestion, risk, action이 한눈에 구분된다.
  - admin 주요 action이 keyboard/focus와 loading/disabled state를 가진다.

### Phase 5. Final polish, audit, verification
- 사용할 skill: `polish -> audit -> verification-loop`
- 대상:
  - public 핵심 흐름 전체
  - admin 핵심 큐 전체
  - mobile/desktop 주요 breakpoint
- 목표:
  - spacing, type hierarchy, focus state, hover/active/disabled/loading state를 최종 정리한다.
  - anti-pattern과 accessibility/performance/responsive risk를 측정한다.
  - 결과를 screenshot과 명령 로그로 남긴다.
- 완료 기준:
  - `npm run design:detect:json` 통과
  - Impeccable live detector에서 nested cards 관련 P1 수준 문제가 해소 또는 명시적으로 예외 처리됨
  - `npm run verify:quick` 통과
  - `npm run verify` 통과
  - desktop/mobile screenshot 비교 결과가 `PROGRESS.md`에 기록됨

## 다음 실행 순서
1. 운영 DB credential을 복구하고 `npm run db:check:production`으로 연결 상태를 다시 확인한다.
2. `moderation_suggestions` migration 적용 후 public/admin을 재배포하고 live 관리자 AI 패널 persistence를 확인한다.
3. iPhone Safari, Android Chrome 기준 실기기 QA를 수행한다.
4. 디자인 구현을 시작할 때는 Phase 0을 `PROGRESS.md`에 active로 올리고, Phase 1 홈/지도 탐색 단순화부터 진행한다.
5. 각 디자인 phase가 끝날 때마다 검증 결과를 `PROGRESS.md`에 남기고, 완료된 phase는 `COMPLETED.md`로 archive한 뒤 active 문서에서 제거한다.
