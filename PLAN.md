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

목표(observable finish state): k6 부하 측정 → 병목 개선 → 재측정 결과가 공개 문서에 있다. (앞선 백업 증적·지도 지연·OpenAPI는 끝났고, 진짜 캐시 미스 p95는 코드로 1초 아래로 못 내려 `docs/06-성능/결과/2026-11-24-한국-측정.md`에 한계로 기록했다.)

사용자 개입 없이는 할 수 없어 범위에서 제외한다(이유를 문서에 명시): R2 활성화(Dashboard 약관·결제수단 동의 필요), 실제 Kakao/Naver 계정 로그인 callback, Cloudflare 알림 메일 수신 확인.

공통 원칙: 운영 VPS는 TownPet과 공유하므로 운영 대상 부하는 읽기 전용·저강도로 제한하고 중단 기준을 둔다. 운영 DB에 쓰기 테스트를 하지 않는다. 각 slice는 검증 후 커밋·push·CI 확인까지 한다.

#### E3-2. k6 부하 측정 → 개선 → 재측정
- Likely files: `perf/k6/map-read.js`, `perf/k6/write-local.js`(신규), `package.json`, `docs/06-성능/결과/2026-11-24-부하-측정.md`(신규, 공개)
- Changes:
  - `brew install k6`.
  - **로컬**(Docker Postgres + 빌드한 Worker): 지도·상세 읽기와 가격 제보 쓰기를 VU 단계별로 올려 처리량·p95·에러율과 병목(DB 연결, rate limit, CPU)을 찾는다.
  - **운영**: 읽기 전용, 최대 10 VU·2분, 에러율 1% 또는 p95 3초 초과 시 즉시 중단. 캐시 적중·미스 URL을 나눠 측정한다. 쓰기는 운영에 보내지 않는다.
  - 찾은 병목 하나를 고치고 같은 시나리오로 재측정한다.
- Verify: `npm run perf:k6:local`, `npm run perf:k6:prod`(threshold 내장), 재측정 수치가 문서에 전/후로 있음
- Done: 공개 결과 문서에 환경·시나리오·전/후 수치·남은 한계가 있다

## Backlog

- 사용자 작업이 필요한 운영 증적: 오프사이트 백업 개인키(`backups/offsite/age-identity.txt`)를 비밀번호 관리자 등 맥 밖에 보관(분실 시 KV 사본 복호화 불가), R2 활성화 후 오프사이트 대상을 KV에서 R2로 전환, 실제 Kakao/Naver 로그인 callback 확인, Cloudflare 알림 수신 확인
