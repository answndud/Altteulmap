# PLAN.md

기준일: 2026-04-17
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
- 이후 UI 작업은 ad-hoc polish가 아니라 `DESIGN.md` 기준으로만 진행한다.
- 별도 정책 결정 전 보류:
  - 커뮤니티 `bang`
  - 핫딜 `deal`

## Active Work
| 상태 | 우선순위 | 작업 | 완료 기준 | 의존성 |
|---|---|---|---|---|
| `in_progress` | `P1` | 운영 DB를 복구하고 `AI 1차 검수` persisted live 경로를 마감한다 | 운영 DB에 `moderation_suggestions` migration이 적용되고, public/admin worker 재배포 후 live 관리자 큐에서 장소 등록/가격 제보/신고 카드의 AI 패널이 persistence 기준으로 보이며, degraded fallback 로그인과 mock 관리자 큐도 유지된다 | `src/db/schema.ts`, `drizzle/0010_military_wildside.sql`, `src/features/admin/**`, 운영 DB credential |
| `pending` | `P1` | 모바일/운영 실기기 QA를 다시 수행한다 | iPhone Safari와 Android Chrome 기준으로 `현재 위치`, `이 지역 검색`, 목록/상세 시트 drag, cluster 확대/축소, 익명 쓰기 핵심 흐름, 관리자 AI 패널 확인 결과가 체크리스트 형태로 남고, 발견된 이슈가 후속 작업으로 분리된다 | live public/admin URL, 실기기 또는 동등한 검증 환경, `tests/e2e/**` |

## 다음 실행 순서
1. 운영 DB credential을 복구하고 `npm run db:check:production`으로 연결 상태를 다시 확인한다.
2. `moderation_suggestions` migration 적용 후 public/admin을 재배포하고 live 관리자 AI 패널 persistence를 확인한다.
3. iPhone Safari, Android Chrome 기준 실기기 QA를 수행한다.
4. 위 두 작업이 정리된 뒤에만 추가 지도 성능 보정이나 UI redesign follow-up을 다시 잡는다.
