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

## Active Work
| 상태 | 우선순위 | 작업 | 완료 기준 | 의존성 |
|---|---|---|---|---|
| `in_progress` | `P1` | 출시 전 마감 정리를 수행한다 | QA 문제 없음 결과가 문서화되고, 변경분이 커밋/푸시되며, 운영 smoke가 통과하고, README/배포 문서와 공개 공유 체크리스트가 최신 운영 상태를 반영한다 | live public/admin URL, 운영 DB, GitHub/Cloudflare 배포 상태 |

## 다음 실행 순서
1. QA 결과와 현재 변경분을 커밋/푸시한다.
2. 운영 URL 기준 smoke를 다시 확인한다.
3. README와 배포 문서가 최신 완료 상태를 반영하는지 정리한다.
4. 공개 공유용 체크리스트를 작성한다.
5. 완료 결과를 archive하고 active 문서를 비운다.
