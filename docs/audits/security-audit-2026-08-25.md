# Production Security Audit — 2026-08-25

## Scope and method

요청 진입점부터 Hono route, session/actor 판정, Drizzle repository, 응답·쿠키까지 추적했다. 인증 여부와 권한 여부를 별도로 확인하고, 관리자·댓글·북마크의 resource ownership 조건을 코드에서 대조했다. 정적 검색과 `npm audit`를 실행했으며, 일반적인 checklist 차이는 finding으로 올리지 않았다.

## Findings

### SEC-001 — 세션의 관리자 role이 DB 변경 뒤에도 유지됨

- Severity: High
- Confidence: High
- Status: Fixed
- Vulnerable path: `getSessionFromRequest`가 서명된 30일 세션의 `user.role`을 복원하고, 기존 `requireAdminSession`이 그 값을 DB 조회 없이 신뢰해 모든 `/api/admin/*` route를 허용했다.
- Attacker prerequisite: 관리자 계정에 로그인한 뒤 role을 user로 강등하거나 계정을 삭제해야 한다. 공격자는 기존 세션을 보유해야 한다.
- Exploit path: 강등/삭제 후에도 기존 세션 cookie로 관리자 목록 조회·moderation PATCH를 요청한다.
- Impact: 인증(authentication)은 유효하지만 현재 인가(authorization)는 취소되지 않아 관리자 데이터 조회·운영 데이터 변경이 가능하다.
- Remediation: DB-backed 환경의 공통 guard가 매 요청 `users.id`의 현재 role을 재조회하고, user/deleted/DB error를 각각 403/503으로 fail closed 처리한다. mock 환경은 기존 local fixture 동작을 유지한다.

### SEC-002 — credentials login이 CSRF token을 검증하지 않음

- Severity: Medium
- Confidence: High
- Status: Fixed
- Vulnerable path: `GET /api/auth/csrf`가 cookie와 token을 발급했지만 `POST /api/auth/callback/credentials`는 token 없이도 session cookie를 발급했다.
- Attacker prerequisite: 피해자가 공격자 계정으로 로그인된 세션을 만들도록 유도할 수 있는 cross-site form/navigation이 필요하다.
- Exploit path: 피해자 브라우저가 공격자 credentials로 credentials callback POST를 수행하면 피해자가 자신의 계정이 아닌 공격자 계정으로 로그인될 수 있다.
- Impact: login CSRF, 사용자 행동·저장 대상 혼동, 공격자 계정으로의 데이터 저장 유도. 직접적인 피해자 계정 탈취는 아니다.
- Remediation: HttpOnly CSRF cookie와 요청 token을 constant-time double-submit 비교하고, Login/Signup 자동 로그인 클라이언트가 먼저 token을 요청한다.

### SEC-003 — 로그인·회원가입 rate limit이 실제 route에 연결되지 않음

- Severity: Medium
- Confidence: High
- Status: Fixed
- Vulnerable path: `authSignup` policy만 선언되어 있고 credentials login/signup route에서 소비하지 않았다.
- Attacker prerequisite: 공개 auth endpoint에 반복 요청할 수 있으면 된다.
- Exploit path: password guessing, signup abuse, email/account enumeration 시도를 무제한으로 반복한다.
- Impact: brute-force 비용 증가, 계정 생성·메일/DB 리소스 남용, 서비스 운영 부담.
- Remediation: Cloudflare `CF-Connecting-IP`와 normalized email을 결합한 login/signup key를 사용하고, DB 환경에서는 persistent atomic bucket, mock/local에서는 in-process fallback을 사용한다. 429와 `Retry-After`를 반환한다.
- Residual risk: Cloudflare 외부에서 직접 Worker에 노출하거나 `CF-Connecting-IP`를 신뢰할 수 없는 프록시가 덮어쓰는 배포는 별도 네트워크 제약이 필요하다.

### SEC-004 — 검증되지 않은 Kakao 이메일로 기존 계정 자동 연결 가능

- Severity: High
- Confidence: High
- Status: Fixed
- Vulnerable path: OAuth callback이 provider account ID가 처음 보이는 경우 provider가 반환한 email의 기존 local `users` row를 자동 선택해 account를 연결했다. Kakao `is_email_valid`/`is_email_verified`를 확인하지 않았다.
- Attacker prerequisite: provider가 검증되지 않은 이메일 claim을 반환하는 OAuth 계정을 확보하고, 해당 이메일이 기존 local 계정과 일치해야 한다.
- Exploit path: OAuth login → token exchange → profile email → 기존 user row 자동 연결 → 공격자 provider identity로 피해자 계정 session 발급.
- Impact: 계정 takeover 및 피해자 데이터 접근 가능성.
- Remediation: Kakao profile을 `is_email_valid === true && is_email_verified === true`일 때만 허용한다. 검증 실패는 계정 sync 전 OAuth login error로 종료한다. Naver identity email은 provider API 특성상 trusted profile로 유지했다.

## Verified authorization boundaries

- Admin endpoints all call the common admin guard; non-admin sessions receive 403 and DB-backed role changes are rechecked per request.
- Bookmark reads/writes use the authenticated session user ID; the request does not accept a caller-supplied user ID.
- Comment deletion checks either the authenticated comment owner or the signed visitor owner; another user's comment ID alone is insufficient.
- Public place writes resolve the place server-side and use validated schemas; client-supplied ownership or role fields are not accepted by write schemas.
- Public detail reads expose only active places and visible comments; admin moderation routes are separately guarded.

## Areas checked with no confirmed vulnerability

- SQL injection: repository queries use Drizzle expressions/parameterized `sql` fragments; no user-controlled raw SQL or shell execution path was found.
- SSRF/path traversal/file upload/deserialization: no user-controlled URL fetch, filesystem path, upload, or unsafe deserialization path was found. OAuth fetch URLs are provider constants.
- XSS and sensitive caching: no `dangerouslySetInnerHTML`/`innerHTML` sink was found; mutation and auth responses use `no-store`, and CSP/security headers are applied globally.
- Cookies/CORS/redirects: auth cookies are HttpOnly, SameSite=Lax, Secure on HTTPS; callback URLs are normalized to same-origin paths; no permissive CORS handler was found.
- Secrets: environment files are ignored and no tracked `.env` file was found. Defaults such as local demo passwords remain test/local fixtures and must not be configured in production.
- Dependency scan: `npm audit --offline --omit=dev --audit-level=moderate` reported 0 vulnerabilities. Online audit could not reach the npm registry in this environment, so registry freshness is not independently confirmed.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm audit --offline --omit=dev --audit-level=moderate`
- `git diff --check`

Full E2E/remote OAuth and production binding verification require the configured deployment and provider credentials; they were not inferred from local mock behavior.
