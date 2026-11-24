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

목표(observable finish state): 사용자 개입 없이 Backlog 4개를 닫는다. ① 서울 첫 화면 지도(zoom 11) 엣지 캐시 미스 p95가 한국 기준 1초 이하, ② 백업이 VPS·맥 밖 한 곳 이상에 암호화돼 남고 새 서버 복구 RTO가 측정돼 있다, ③ `/api/openapi.json`이 등록된 모든 `/api` route를 담고 누락 시 테스트가 실패한다, ④ k6 부하 측정 → 병목 개선 → 재측정 결과가 공개 문서에 있다.

사용자 개입 없이는 할 수 없어 범위에서 제외한다(이유를 문서에 명시): R2 활성화(Dashboard 약관·결제수단 동의 필요), 실제 Kakao/Naver 계정 로그인 callback, Cloudflare 알림 메일 수신 확인.

공통 원칙: 운영 VPS는 TownPet과 공유하므로 운영 대상 부하는 읽기 전용·저강도로 제한하고 중단 기준을 둔다. 운영 DB에 쓰기 테스트를 하지 않는다. 각 slice는 검증 후 커밋·push·CI 확인까지 한다.

### Phase E1. 백업·복구 증적

#### E1-1. 새 서버 복구 리허설과 RTO 측정
- Likely files: `scripts/restore-rehearsal.sh`(신규), `deploy/vps/README.md`, `package.json`
- Changes:
  - 2026-11-24 03:17 UTC 첫 자동 덤프(`backup ok`)는 확인됨. 이를 README 복구 증적에 기록한다.
  - 로컬 Docker(Docker Desktop 기동)에 **빈** `postgres:17` 컨테이너를 새 서버처럼 띄우고, 최신 덤프 `pg_restore` → `deploy/vps/grant-app-role.sh`로 `altteulmap_app` 재생성 → **앱 role로** 접속한 Worker(`vite dev`, `DATABASE_URL`=복원 DB)에서 `smoke:local` 수준의 읽기 확인까지 자동으로 실행한다.
  - 단계별 소요 시간과 합계(RTO), 행 수 대조 결과를 출력한다. Hyperdrive 재지정은 실행하지 않고 명령(`wrangler hyperdrive update --origin-host ...`)만 절차에 둔다(운영 연결을 바꾸지 않기 위해).
- Verify: `npm run db:rehearse:restore` 통과(행 수 일치, 앱 role로 지도·상세 조회 성공), 끝나면 컨테이너·볼륨 삭제 확인
- Done: `deploy/vps/README.md`에 RTO 수치와 날짜가 있고, 복구 절차의 role·권한 누락이 스크립트로 재현 가능하다

#### E1-2. 암호화한 오프사이트 사본 (R2 대체: Workers KV)
- Likely files: `scripts/pull-vps-backup.sh`, `scripts/offsite-backup.sh`(신규), `deploy/vps/README.md`, `.env.vps`(키 경로만, 커밋 안 함)
- Changes:
  - `age` 키쌍 생성: 개인키는 맥 `.env.vps` 옆(권한 600, gitignore)에만, 공개키로만 암호화한다.
  - 월 1회 `backup:pull`이 검증을 마치면 덤프를 `age`로 암호화해 전용 KV namespace(`altteulmap-offsite-backups`, 무료 범위)에 `wrangler kv key put`으로 올리고 최근 6개만 유지한다. 덤프 648KB는 KV 값 한도(25MiB) 안이다.
  - 복구 방향도 검증한다: KV에서 내려받아 복호화 → `pg_restore --list` 성공.
  - 문서에 "R2를 켜면 같은 스크립트의 업로드 대상만 바꾼다"를 적는다.
- Verify: `npm run backup:offsite -- --verify`(업로드 → 다운로드 → 복호화 → `pg_restore --list` → 체크섬 일치), KV에 평문 덤프가 없음을 확인
- Done: 백업 3단(VPS 일 1회 → 맥 월 1회 → KV 암호화 월 1회)이 문서와 실제 상태에 일치

### Phase E2. 첫 화면 지도 캐시 미스 지연

#### E2-1. Hyperdrive 쿼리 캐시 적중 여부 확인과 수정
- Likely files: `src/worker/db.ts`, `src/worker/places/places-read-map-repository.ts`, `docs/06-성능/결과/2026-11-24-한국-측정.md`
- Changes:
  - 가설: Hyperdrive 캐시는 켜져 있는데(`caching.disabled: false`) 미스가 0.9~1.2초라 지도 쿼리가 캐시를 못 타고 있다. 후보 원인은 세션 단위 `SET statement_timeout` 등 연결 설정, 트랜잭션, 휘발성 함수(`now()`) 사용이다.
  - 같은 URL을 엣지 캐시 우회(쿼리스트링 변경)로 연속 호출해 `Server-Timing: db` 변화를 본다. 적중하지 않으면 원인을 하나씩 제거한다(예: 타임아웃을 연결 옵션으로 이동, 읽기 쿼리에서 `now()` 제거나 파라미터화).
- Verify: 같은 쿼리 두 번째 호출의 `db` 구간이 왕복 시간(약 0.38초)보다 확실히 작아짐, `npm run verify`, `npm run test:integration:local`
- Done: 지도 읽기 쿼리가 Hyperdrive 캐시에 적중하는 것이 측정으로 확인되거나, 적중 불가 이유가 문서화됨

#### E2-2. 응답 축소와 stale-while-revalidate
- Likely files: `src/worker/routes/places-read.ts`, `src/worker/places/places-read-map-repository.ts`, `tests/integration/map-clusters.test.ts`
- Changes:
  - 엣지 캐시에 stale-while-revalidate 적용: 60초가 지나도 최대 10분까지는 캐시를 즉시 반환하고 `ctx.waitUntil`로 백그라운드 갱신한다. 승인 반영 지연 상한은 그대로 문서에 적는다.
  - E2-1로도 목표 미달이면 zoom 11 목록 100건과 previewPlaces의 컬럼을 화면이 쓰는 필드만 남겨 응답 크기를 줄인다(클라이언트 사용 필드 확인 후).
- Verify: 인앱 브라우저로 한국에서 캐시 미스(쿼리스트링 우회) n=30 p95 측정, 기존 클러스터 동등성 테스트 통과, `npm run test:e2e:full`
- Done: 캐시 미스 p95 1초 이하, 결과를 측정 문서에 전/후로 추가

### Phase E3. API 계약과 부하

#### E3-1. OpenAPI 생성과 `/api/docs`
- Likely files: `src/worker/http/openapi.ts`(신규), `src/worker/routes/*.ts`(스키마 export만), `tests/unit/openapi.test.ts`(신규), `src/worker/index.ts`
- Changes:
  - 새 의존성 없이 zod 4의 `z.toJSONSchema()`로 요청 스키마를 변환하고, route 목록(method·path·접근 권한·요청 스키마·에러 envelope)을 레지스트리로 모아 OpenAPI 3.1 문서를 만든다.
  - `GET /api/openapi.json`과, 스크립트 없이 서버가 그린 HTML 표 `GET /api/docs`를 제공한다(CSP 유지, 외부 CDN 없음).
  - 테스트: Hono 앱에 등록된 모든 `/api` route가 스펙에 있는지, 스펙이 OpenAPI 3.1 구조로 유효한지 검사한다.
- Verify: `npm run verify`, 운영 배포 후 `curl /api/openapi.json`의 path 수가 등록 route 수(현재 32)와 일치
- Done: route를 추가하고 스펙에 안 넣으면 unit test가 실패한다

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

- 사용자 작업이 필요한 운영 증적: R2 활성화 후 오프사이트 대상을 KV에서 R2로 전환, 실제 Kakao/Naver 로그인 callback 확인, Cloudflare 알림 수신 확인
