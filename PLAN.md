# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 백엔드 신입 채용 리뷰에서 지적될 보안·설계·저장소 위생 결함을 제거한다.

Observable finish state:
- 운영 데모가 실제 데이터로 동작하고, 정기 smoke가 실패하면 알 수 있다.
- 관리자 대시보드와 화면에 가짜 지표·빈 화면이 없고, UI가 `.impeccable.md` 기준과 일치한다.
- 운영 인증 경로에 하드코딩 계정·mock 분기가 없고, 세션은 DB에서 폐기 가능하다.
- 익명 rate limit은 쿠키 없이 우회되지 않는다.
- route → service → repository 계층과 도메인 에러 타입이 있고, 도메인 규칙은 DB 없이 unit test된다.
- `npm run verify`, `npm run test:integration`, `npm run test:e2e:full`, `npm audit --omit=dev --audit-level=high`가 통과한다.

공통 integration 실행 명령(이하 `INTEGRATION`): `npm run test:integration:local`

## Active

No active work

## Backlog
- 운영 쓰기·로그인 경로 지연은 운영 DB에 쓰기 테스트를 하지 않아 미측정이다. 별도 staging DB(VPS에 두 번째 DB 또는 격리 스키마)를 만들어 가격 제보·로그인의 k6 쓰기 부하를 재측정(`docs/06-성능/결과/2026-11-24-부하-측정.md` §4)
- 사용자 작업이 필요한 운영 증적: 오프사이트 백업 개인키(`backups/offsite/age-identity.txt`)를 비밀번호 관리자 등 맥 밖에 보관(분실 시 KV 사본 복호화 불가), R2 활성화 후 오프사이트 대상을 KV에서 R2로 전환, 실제 Kakao/Naver 로그인 callback 확인, Cloudflare 알림 수신 확인
