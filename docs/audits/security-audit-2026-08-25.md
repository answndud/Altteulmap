# 운영 보안 감사 보고서 — 2026-08-25

## 범위와 방법

요청 진입점부터 Hono 라우트, 세션/행위자 판정, Drizzle 저장소, 응답·쿠키까지 추적했다. 인증 여부와 권한 여부를 별도로 확인하고, 관리자·댓글·북마크의 자원 소유권 조건을 코드에서 대조했다. 정적 검색과 `npm audit`를 실행했으며 일반적인 점검표 차이는 발견사항으로 올리지 않았다.

## 발견사항

### SEC-001 — DB 변경 뒤에도 세션의 관리자 역할이 유지됨

- 심각도: 높음
- 신뢰도: 높음
- 상태: 수정 완료
- 취약 경로: `getSessionFromRequest`가 서명된 30일 세션의 `user.role`을 복원하고 기존 `requireAdminSession`이 DB 조회 없이 이를 신뢰해 모든 `/api/admin/*` 라우트를 허용했다.
- 공격자 전제: 관리자 계정에 로그인한 뒤 역할을 일반 사용자로 강등하거나 계정을 삭제해야 한다. 공격자는 기존 세션을 보유해야 한다.
- 악용 경로: 강등/삭제 후에도 기존 세션 쿠키로 관리자 목록 조회·검수 변경 요청을 보낸다.
- 영향: 인증은 유효하지만 현재 권한이 취소되지 않아 관리자 데이터 조회·운영 데이터 변경이 가능하다.
- 조치: DB 환경의 공통 guard가 매 요청 `users.id`의 현재 역할을 재조회하고 사용자 삭제·권한 변경·DB 오류를 각각 403/503으로 fail-closed 처리한다. mock 환경의 기존 local fixture 동작은 유지한다.

### SEC-002 — 자격 증명 로그인에서 CSRF 토큰을 검증하지 않음

- 심각도: 중간
- 신뢰도: 높음
- 상태: 수정 완료
- 취약 경로: `GET /api/auth/csrf`가 쿠키와 토큰을 발급했지만 `POST /api/auth/callback/credentials`는 토큰 없이도 세션 쿠키를 발급했다.
- 공격자 전제: 피해자가 공격자 계정으로 로그인된 세션을 만들도록 유도할 수 있는 교차 사이트 요청이 필요하다.
- 악용 경로: 피해자 브라우저가 공격자 credentials로 로그인 callback POST를 수행하면 공격자 계정으로 로그인될 수 있다.
- 영향: 로그인 CSRF, 사용자 행동·저장 대상 혼동, 공격자 계정으로의 데이터 저장 유도. 직접적인 피해자 계정 탈취는 아니다.
- 조치: HttpOnly CSRF 쿠키와 요청 토큰을 constant-time double-submit 비교하고 로그인·회원가입 자동 로그인 클라이언트가 먼저 토큰을 요청한다.

### SEC-003 — 로그인·회원가입 요청 제한이 실제 라우트에 연결되지 않음

- 심각도: 중간
- 신뢰도: 높음
- 상태: 수정 완료
- 취약 경로: `authSignup` 정책만 선언되어 있고 credentials 로그인/회원가입 라우트에서 사용하지 않았다.
- 공격자 전제: 공개 인증 API에 반복 요청할 수 있으면 된다.
- 악용 경로: 비밀번호 추측, 회원가입 남용, 이메일/계정 존재 여부 추측을 무제한 반복한다.
- 영향: 무차별 대입 비용 증가, 계정 생성·메일/DB 자원 남용, 운영 부담.
- 조치: Cloudflare `CF-Connecting-IP`와 정규화 이메일을 결합한 키를 사용하고 DB 환경에서는 영속 원자 버킷, mock/local에서는 프로세스 내 대체 제한을 사용한다. 429와 `Retry-After`를 반환한다.
- 잔여 위험: Cloudflare 외부에 Worker를 직접 노출하거나 신뢰할 수 없는 프록시가 `CF-Connecting-IP`를 덮어쓰는 배포에는 별도 네트워크 제약이 필요하다.

### SEC-004 — 검증되지 않은 Kakao 이메일로 기존 계정 자동 연결 가능

- 심각도: 높음
- 신뢰도: 높음
- 상태: 수정 완료
- 취약 경로: OAuth callback이 provider 계정 ID를 처음 보는 경우 provider가 반환한 이메일의 기존 local `users` 행을 자동 선택해 계정을 연결했다. Kakao의 `is_email_valid`/`is_email_verified`를 확인하지 않았다.
- 공격자 전제: provider가 검증되지 않은 이메일 주장을 반환하는 OAuth 계정을 확보하고 해당 이메일이 기존 local 계정과 일치해야 한다.
- 악용 경로: OAuth 로그인 → 토큰 교환 → 프로필 이메일 확인 → 기존 사용자 행 자동 연결 → 공격자 provider identity로 피해자 세션 발급.
- 영향: 계정 탈취 및 피해자 데이터 접근 가능성.
- 조치: Kakao 프로필은 `is_email_valid === true && is_email_verified === true`인 경우에만 허용한다. 검증 실패는 계정 동기화 전에 OAuth 로그인 오류로 종료한다. Naver 이메일은 provider API 특성상 신뢰된 프로필로 유지했다.

## 확인된 권한 경계

- 관리자 API는 모두 공통 관리자 guard를 호출하고, 일반 사용자 세션에는 403을 반환하며 DB 기반 역할 변경은 매 요청 재확인한다.
- 북마크 읽기·쓰기는 인증 세션의 사용자 ID를 사용하며 요청자가 사용자 ID를 직접 지정할 수 없다.
- 댓글 삭제는 인증된 댓글 소유자 또는 서명된 방문자 소유자만 허용하며 다른 사용자의 댓글 ID만으로는 부족하다.
- 공개 장소 쓰기는 서버에서 장소를 확인하고 검증된 스키마를 사용하며 클라이언트가 소유권·역할 필드를 지정할 수 없다.
- 공개 상세 조회는 활성 장소와 공개 댓글만 노출하고 관리자 검수 라우트는 별도로 보호한다.

## 확인했으나 취약점이 확정되지 않은 영역

- SQL injection: 저장소 조회는 Drizzle 표현식과 매개변수화된 `sql` 조각을 사용하며 사용자 제어 raw SQL이나 셸 실행 경로는 발견되지 않았다.
- SSRF/경로 조작/파일 업로드/역직렬화: 사용자 제어 URL 조회, 파일 경로, 업로드, 안전하지 않은 역직렬화 경로는 발견되지 않았다. OAuth 조회 URL은 provider 상수다.
- XSS와 민감 데이터 캐싱: `dangerouslySetInnerHTML`/`innerHTML` 싱크는 발견되지 않았고 변경·인증 응답은 `no-store`이며 CSP/보안 헤더가 전역 적용된다.
- 쿠키/CORS/리디렉션: 인증 쿠키는 HttpOnly, SameSite=Lax, HTTPS에서는 Secure이며 callback URL은 동일 출처 경로로 정규화된다. 허용 범위가 넓은 CORS 처리기는 발견되지 않았다.
- 비밀값: 환경 파일은 무시되고 추적 중인 `.env` 파일은 발견되지 않았다. local demo 비밀번호 같은 기본값은 테스트/local fixture로 남아 있으므로 운영에 설정하면 안 된다.
- 의존성 점검: `npm audit --offline --omit=dev --audit-level=moderate`는 취약점 0건을 보고했다. 온라인 점검은 현재 환경에서 npm registry에 연결할 수 없어 최신성은 독립 확인하지 못했다.

## 검증

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm audit --offline --omit=dev --audit-level=moderate`
- `git diff --check`

전체 E2E/원격 OAuth와 운영 binding 검증은 실제 배포 및 provider 자격 증명이 필요하므로 local mock 동작만으로 추정하지 않았다.
