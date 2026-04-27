# Public Share Checklist

기준일: 2026-04-27

## 목적
- 알뜰맵을 외부에 공유하기 직전에 public demo, admin demo, 운영 DB, QA, 문서 상태를 빠르게 확인한다.
- 공유 대상에게 보여줄 수 있는 URL과 아직 후속 작업으로 남길 항목을 구분한다.

## 공유 URL
- Public demo: `https://altteulmap.altteul-lab.workers.dev`
- Admin demo: `https://altteulmap-admin.altteul-lab.workers.dev`
- Repository README: [README.md](/Users/alex/project/altteulmap/README.md)

## 완료 상태
| 항목 | 상태 | 근거 |
| --- | --- | --- |
| Public home/canonical | pass | `npm run smoke:remote` 통과 |
| Robots/sitemap | pass | `npm run smoke:remote` 통과 |
| Sample place page | pass | `npm run smoke:remote` 통과 |
| Public/admin split redirect | pass | `npm run smoke:remote` 통과 |
| Admin login | pass | `npm run smoke:remote` 통과 |
| Production DB connection | pass | `npm run db:check:production` 통과 |
| Moderation schema | pass | `moderation_suggestions`, enum, drizzle migration table 확인 |
| Mobile real-device QA | pass | iPhone Safari, Android Chrome 사용자 QA 문제 없음 |
| Anonymous write flow | pass | 장소 등록, 가격 제보, 신고 운영 검증 완료 |
| Admin moderation flow | pass | 장소/가격/신고 큐와 AI 패널 운영 검증 완료 |

## 공유 전 확인
- Public URL 첫 화면이 바로 지도 중심 경험으로 열린다.
- README의 Demo 링크와 screenshot이 깨지지 않는다.
- Admin URL은 로그인 화면으로 진입한다.
- 운영자 계정 정보는 공개 글에 포함하지 않는다.
- 테스트 제보를 만들었다면 공유 전에 관리자 큐에서 반려 또는 처리 완료한다.
- Supabase project가 paused 상태가 아닌지 확인한다.

## 알려야 할 제약
- 현재 운영 URL은 custom domain이 아니라 `workers.dev` 주소다.
- OAuth callback은 운영 도메인 확정 뒤 provider console에서 다시 점검해야 한다.
- 이메일 발송은 현재 핵심 데모 범위가 아니며, 필요 시 Resend 설정을 별도 마감한다.
- 데이터는 초기 bootstrap seed 1,000곳을 기반으로 하며, 이후 운영 데이터는 사용자 제보와 관리자 검수로 확장한다.

## 후속 후보
- custom domain 연결
- OAuth 실제 provider 운영 callback 재확인
- Sentry 또는 동등한 에러 추적 연결
- 운영 데이터 추가 import/upsert 파이프라인
- 공개 공유 후 사용자 피드백을 `PLAN.md`의 새 active 작업으로 분리
