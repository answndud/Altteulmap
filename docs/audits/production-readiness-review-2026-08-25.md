# 프로덕션 준비 상태 검토 보고서 — 2026-08-25

## 최종 판정

**Production readiness: READY WITH RISKS**

코드와 CI의 핵심 인증·권한·데이터 정합성·요청 제한·장애 응답 제어는 배포 가능한 수준이다. 다만 실제 Cloudflare 바인딩, OAuth 제공자, 운영 DB, 백업 복구 및 외부 장애 전환을 이 환경에서 증명하지 못했으므로 무조건적인 승인으로 표시하지 않는다.

## 판정 기준

- **BLOCKER**: 현재 배포하면 핵심 기능 또는 데이터 안전성이 거의 확실히 깨지는 증거가 있는 문제.
- **HIGH**: 현실적인 운영 조건에서 큰 보안·데이터·가용성 피해가 발생하며 배포 전 조치가 필요한 문제.
- **MEDIUM**: 운영 중 장애 대응·복구·성능·검증 범위에 유의미한 공백이 있는 문제.
- **LOW**: 즉시 배포를 막지는 않지만 품질·운영 비용을 높이는 문제.

## BLOCKER

없음.

## HIGH

현재 미해결 HIGH는 없음.

### 조치 완료: 배포 설정 검증 공백

- 증거: 기존 `scripts/check-cloudflare-deploy.mjs`는 Turnstile 사이트 키·비밀 키를 필수 항목으로 검사하지 않았고, production의 `http://` `NEXTAUTH_URL`을 경고만 출력했다.
- 영향 경로: 배포 검사 → Worker 인증 콜백·공개 쓰기 → OAuth 리디렉션·Turnstile 검증.
- 현실적 실패: 잘못된 설정으로 배포 검사가 통과한 뒤 로그인 리디렉션이 비보안 주소를 사용하거나 공개 쓰기가 모두 503이 된다.
- 조치: 두 Turnstile 키를 필수 설정으로 추가하고 production `NEXTAUTH_URL`이 HTTPS가 아니면 검사에 실패하도록 변경했다.
- 검증: 유효한 더미 설정은 0, HTTP URL은 1로 종료하는 것을 확인했다.

### 조치 완료: health 응답의 DB 오류 상세 노출

- 증거: `src/worker/routes/health.ts`의 deep health 경로가 DB 예외 메시지를 그대로 JSON으로 반환할 수 있었다.
- 현실적 실패: 공개 health 호출자가 연결 문자열·호스트·드라이버 내부 정보를 오류 메시지로 수집한다.
- 조치: 운영 로그에는 오류 종류와 원문을 남기되 공개 응답은 일반화된 메시지만 반환하도록 변경했다.

## MEDIUM

### PR-001 — 실제 운영 자격 증명과 원격 장애 검증 미완료

- 증거: 저장소에서 실제 OAuth callback 성공, Cloudflare secret/binding, production DB migration, Turnstile/Naver 장애 전환을 실행하지 않았다. CI는 테스트용 자격 증명과 로컬 Postgres를 사용한다.
- 영향 경로: OAuth 로그인, DB 읽기·쓰기, 지도 SDK, 공개 제보, 관리자 검수.
- 현실적 실패: 로컬·CI에서는 통과하지만 운영 secret 이름 오류, provider 응답 차이 또는 원격 DB 연결 정책으로 로그인·쓰기·관리자 기능이 첫 배포에서 실패한다.
- 권고: 배포 전 staging에서 실제 provider sandbox callback, `GET /api/health?deep=1`, 읽기 전용 관리자 smoke, 공개 쓰기·실패 응답을 실행한다.

### PR-002 — 실제 백업 복구 리허설은 운영 권한이 필요함

- 증거: 저장소에는 공급자 백업을 직접 생성·복구할 권한이 없으며, `scripts/migrate-production.mjs`는 마이그레이션 전제조건을 검사하고 복구 절차는 런북으로 고정한다.
- 영향 경로: PostgreSQL 데이터, 가격 이력, 댓글·신고·관리자 감사 기록.
- 현실적 실패: 잘못된 운영자 mutation이나 migration 후 데이터 손상이 발생해도 검증된 복구 지점과 복구 시간 목표를 확인할 수 없다.
- 권고: Supabase PITR/백업 보존 기간을 확인하고, 별도 staging 복구 리허설과 RPO/RTO를 배포 승인 항목으로 기록한다.

### PR-003 — 운영 오류 알림·SLO 연동은 외부 설정이 필요함

- 증거: 애플리케이션은 `requestId`와 구조화된 `console.error`를 남기고 런북에 임계치·담당자를 기록하지만, Cloudflare 로그 수집기와 실제 알림 규칙은 저장소 밖 설정이다.
- 영향 경로: 전역 예외, DB 503, 외부 provider timeout, 요청 제한 저장소 장애.
- 현실적 실패: 사용자는 503을 받고 운영자는 로그를 수동 검색하기 전까지 장애를 인지하지 못해 복구가 지연된다.
- 권고: Cloudflare 로그 또는 오류 수집기에 `requestId`, route, status, latency를 연결하고 런북 임계치에 맞는 5xx·DB unavailable·timeout 알림을 설정한다.

## LOW

- production 빌드에서 500KB를 초과하는 클라이언트 청크 경고가 남아 초기 로딩 비용을 높일 수 있다. 기능·보안 차단 사유는 아니며 데스크톱 Chromium p95와 bundle 분석을 기준으로 코드 분할을 결정한다.
- 실제 screen reader, Naver SDK 장애 및 위치 권한 거부 검증은 실행하지 않았다.
- 운영 DB·Hyperdrive 연결 수, 광범위 지도 검색 p95, 프로세스 재시작·배포 중단 후 복구는 부하·운영 환경 검증으로 남아 있다.

## 확인된 보호 장치

- 인증과 권한을 분리하고 관리자 요청마다 현재 DB 역할을 재확인한다.
- 세션 비밀값·CSRF·OAuth state·방문자 쿠키·Turnstile·본문 크기·요청 제한을 fail-closed로 처리한다.
- 가격 제보 멱등성, 반응 집계 트랜잭션, 관리자 CAS, DB 제약, 지도 범위·결과 상한을 적용한다.
- 오류 응답은 `requestId`를 제공하고 민감한 stack trace를 응답하지 않는다.
- CI는 Node 버전 파일, fresh migration, 단위·E2E·동시성 smoke, dependency audit을 사용한다.

## 변경 사항

- `/Users/alex/project/altteulmap/scripts/check-cloudflare-deploy.mjs`
  - production HTTPS URL 강제
  - Turnstile 사이트 키·비밀 키 필수화
- `/Users/alex/project/altteulmap/src/worker/routes/health.ts`
  - 공개 health 응답에서 DB 오류 상세 제거
- `/Users/alex/project/altteulmap/src/db/seed.ts`, `/Users/alex/project/altteulmap/scripts/seed-production.mjs`
  - 비로컬 destructive seed 이중 확인과 빈 DB preflight 강제
- `/Users/alex/project/altteulmap/scripts/check-production-db.mjs`
  - read-only 애플리케이션 테이블별 행 수 출력

## 검증 결과

- `npm run verify:quality` 통과
- `npm run verify` 통과
- `npm run build` 통과(Node `20.20.2`)
- `npm audit --offline --omit=dev --audit-level=moderate` — 취약점 0건
- `npm ci --dry-run` 통과
- 배포 검사 유효 설정 통과, production HTTP URL 차단 확인
- `git diff --check` 통과
- CI에 PostgreSQL 통합 게이트, migration·seed·동시성 순서, 실패 시 Playwright artifact 업로드를 추가했다.
- 지도 API 측정 결과에 p99·응답 bytes·timeout 예산을 포함하도록 고정했다.
- 실제 배포 버전 `02c4126a-9b98-40fa-a1d7-e885e123f94a`에서 deep health와 원격 smoke를 통과했다.
- 원격 smoke는 공개 홈·지도·상세·OAuth redirect·관리자 미인증 401·공개 쓰기 검증 400을 확인했고, 관리자 credentials smoke는 계정 미제공으로 실행하지 않았다.
- P5 `pg_trgm` migration을 production에 seed 없이 적용했고, 최신 Worker `5ac57223-4273-43a0-9558-3ae006ee551e`에서 위 smoke를 재실행해 통과했다.

## 배포 전 잔여 조건

P1~P3 코드·CI·로컬 PostgreSQL 증거는 추가되었지만, 실제 운영 secret/binding 확인, staging OAuth 성공·일반 사용자 권한 smoke, 백업 복구 리허설, 5xx·DB 장애 알림 수신 확인이 완료되기 전에는 `READY`로 승격하지 않는다. 현재 판정은 **READY WITH RISKS**다.

## P1~P3 검증 추가 기록

- `npm run search:benchmark`를 Docker PostgreSQL 1,000개 데이터에서 실행했고, global search p95 7ms, 지도 p95 2ms, 관리자 큐 p95 1ms를 기록했다.
- `npm run db:check:contract`가 핵심 table, constraint/index, statement/lock/idle timeout, invalid 데이터 0건을 확인했다.
- PostgreSQL integration은 12개, Chromium 핵심 E2E는 24개를 통과했다.
- authorization matrix는 익명 401, 일반 사용자 403, DB role 강등 403, bookmark ownership 격리를 확인했다.
- `npm run hygiene:dead-code` 0건과 `npm audit --omit=dev --audit-level=moderate` 취약점 0건을 확인했다.
- 실제 운영 provider 성공 callback·PITR·외부 alert delivery는 자격 증명과 운영 계정이 없어 실행하지 않았다.
