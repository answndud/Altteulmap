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

### Phase E2. 첫 화면 지도 캐시 미스 지연

#### E2-1. 지도 캐시 미스 DB 구간 분석 (진행 중, 실험 결과 반영)
- Likely files: `src/worker/db.ts`, `src/worker/places/places-read-map-repository.ts`, `docs/06-성능/결과/2026-11-24-한국-측정.md`(공개)
- 2026-11-24 확인한 사실(재실험 불필요):
  - 인앱 브라우저 한국 측정, 엣지·isolate 캐시 우회(`refresh=1&_=랜덤`)한 진짜 미스는 zoom 11 p50 763ms · p95 1,044ms, DB 구간 p50 525ms. 캐시 적중은 p50 213ms. 측정용 `__measure`는 브라우저 콘솔 함수라 매번 다시 만든다(URL `...&refresh=1&_=랜덤` 반복 fetch, `Server-Timing` 파싱).
  - 이 Worker는 `cf-placement: local-DFW`로 실행된다(smart placement가 방문자 쪽에 둠).
  - Worker를 `aws:eu-central-1`에 고정하면 DB 구간 525 → 93ms지만 전체 763 → 797ms, DB 없는 요청은 189 → 320ms로 나빠져 **기각**(응답이 큰 구간이 FRA에서 방문자까지 길어짐).
  - 프로브 Worker(같은 Hyperdrive)로 측정: 쿼리 왕복 약 170ms, 파라미터 쿼리(확장 프로토콜)는 약 345ms(왕복 2번), 결과 크기 +140KB당 약 +130ms. Hyperdrive 쿼리 캐시는 파라미터 없는 쿼리와 `prepare: true`에서만 적중하며 앱의 drizzle(`unsafe`)은 `prepare` 옵션이 적용되지 않아 캐시를 타지 않는다.
  - 파라미터를 리터럴로 넣어 단순 프로토콜로 보내는 시도(`client.unsafe(text)`)는 동작·결과는 같았지만 지도 DB 구간이 525 → 582ms로 **이득이 없어** 되돌렸다. 지도 쿼리는 결과 약 140KB라 전송량이 지배적이다.
  - `prepare: true`만 켠 시도도 변화 없음. Hyperdrive 캐시를 켜면 세션·권한 읽기가 최대 60초 캐시될 수 있어(ADR 0001 위반) 파라미터 쿼리는 계속 캐시 밖에 둬야 한다. 운영 Hyperdrive 캐시 설정은 원래 값(enabled)으로 되돌려 두었다.
- Changes(남은 일): 위 사실로 볼 때 미스 시간을 줄이는 길은 ① 결과 크기 축소(목록 100건·previewPlaces 컬럼을 화면이 쓰는 필드만, `description`·`note` 제외 여부 확인) ② 사용자가 미스를 거의 겪지 않게 하는 SWR(E2-2). ①을 E2-2에서 함께 수행한다.
- Verify: 위 측정 방식으로 미스 n=30 p95
- Done: 원인이 문서에 있고(결과 문서 §3 "시도했다가 버린 것"에 EU 고정·단순 프로토콜·`prepare` 추가), E2-2가 크기 축소와 SWR로 목표를 닫는다

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

- 사용자 작업이 필요한 운영 증적: 오프사이트 백업 개인키(`backups/offsite/age-identity.txt`)를 비밀번호 관리자 등 맥 밖에 보관(분실 시 KV 사본 복호화 불가), R2 활성화 후 오프사이트 대상을 KV에서 R2로 전환, 실제 Kakao/Naver 로그인 callback 확인, Cloudflare 알림 수신 확인
