# Next.js에서 Vite + React로 옮긴 이유와 과정: 블로그 시리즈 outline

> 이 문서는 알뜰맵의 Next.js + OpenNext → Vite + React + Cloudflare Worker 마이그레이션 회고를 3편 시리즈로 작성하기 위한 기준 문서다. 실제 글을 쓰기 전에 각 편의 역할, 포함 범위, 코드 예시, 공개 금지선을 고정해 중복과 누락을 줄인다.

## 시리즈 전체 방향

### 최종 메시지

```text
작은 프로젝트일수록 강력한 프레임워크보다
명확한 경계와 검증 가능한 운영 구조가 더 중요하다.
```

이 시리즈는 “Next.js가 나쁘다”는 글이 아니다. 처음 Next.js를 선택한 이유는 합리적이었다. 페이지, API route, 인증, SEO, 배포를 한 프레임워크 안에서 처리할 수 있었고, 초기 MVP를 빠르게 만들기 좋았다.

하지만 알뜰맵의 실제 성격은 SSR 중심 문서 사이트보다 지도 중심 SPA에 가까웠다. 여기에 Cloudflare Workers, OpenNext, public/admin split, Auth.js, PostgreSQL, 관리자 운영 흐름이 겹치면서 작은 프로젝트치고 운영 표면이 커졌다.

핵심은 프레임워크 우열이 아니라 요구와 구조의 적합성이다.

### 독자에게 남겨야 할 것

- 프레임워크 선택은 “무엇을 할 수 있는가”보다 “운영 중 문제가 생겼을 때 이해하고 고칠 수 있는가”로 판단해야 한다.
- 마이그레이션은 UI를 새로 그리는 일이 아니라 API contract, auth, DB lifecycle, 배포 경계, 운영 검증을 보존하는 일이다.
- 1인 개발자가 AI agent와 협업할수록 구조를 단순하게 유지하고, 실패 조건을 자동화해야 한다.

### 전체 시리즈 구성

```text
1편: 왜 Next.js + OpenNext가 알뜰맵에 과해졌는가
2편: Vite + React + Worker로 어떻게 기능 보존 이관했는가
3편: Cloudflare 배포, Auth, DB lifecycle, production cutover에서 무엇이 깨졌는가
```

## 공통 작성 원칙

### 톤

- Next.js 비난 금지.
- “당시 선택은 합리적이었지만, 서비스 성격과 운영 조건이 선명해지면서 더 단순한 구조가 맞았다”는 톤을 유지한다.
- 성공담보다 의사결정과 시행착오를 중심으로 쓴다.
- AI agent와의 협업은 과장하지 않고, “명확한 경계와 검증 루프가 있어야 agent도 안정적으로 일한다”는 실무 교훈으로 다룬다.

### 코드 공개 기준

글에 보여줄 코드는 다음 기준을 통과해야 한다.

```text
마이그레이션에서 실제 사고를 막았거나
아키텍처 경계를 바꾼 코드인가?
```

보여줄 가치가 높은 코드:

- API contract 비교 harness
- Worker request-local DB lifecycle
- signed session cookie 구조
- SPA fallback에서 `/api/*`와 static asset을 `index.html`로 보내지 않는 route 분기
- admin UI 보호와 `/api/admin/*` 서버 권한 검사 분리
- deterministic map cluster/performance fixture

생략할 코드:

- 단순 form JSX
- 카드 UI와 CSS
- 일반 fetch wrapper
- 반복적인 route registration
- 단순 type alias
- 문맥 없이 긴 repository 전체 코드

### 민감정보 금지선

절대 공개하지 않는다.

- 실제 DB URL
- Cloudflare account id 전체값
- Supabase project credential
- Kakao/Naver client secret
- Turnstile secret
- Auth secret
- 운영 admin 계정 비밀번호
- 실제 cookie/token/session 값
- 배포 로그에 포함된 민감 경로 또는 계정 식별 정보

공개 가능:

- 설정 항목 이름
- 빠졌던 env/secret의 범주
- 잘못된 deploy command path 형태
- 실패한 status code와 error class
- 민감값을 제거한 로그 요약

## 1편: 왜 Next.js + OpenNext가 알뜰맵에 과해졌는가

### 가제

```text
작은 지도 서비스에 Next.js는 왜 무거워졌나
```

### 역할

1편은 기술 선택의 반성과 문제 정의를 담당한다. 여기서 Vite로 옮기는 구체적 구현을 깊게 다루지 않는다. 독자가 “왜 굳이 마이그레이션을 했는가”를 납득하게 만드는 글이다.

### 핵심 메시지

```text
Next.js는 틀린 선택이 아니었다.
하지만 알뜰맵의 핵심 UX와 Cloudflare 운영 조건에는
Next.js + OpenNext + public/admin split이 점점 과해졌다.
```

### 반드시 포함할 내용

- 처음 Next.js를 선택한 이유:
  - 페이지, API route, 인증, SEO, 배포를 한 프레임워크에서 처리 가능
  - MVP 개발 속도
  - Auth.js와 route handler의 편의성
- 알뜰맵의 실제 제품 성격:
  - 지도 중심 SPA
  - 지도 이동, 클러스터, 바텀시트, 상세 패널, 제보/댓글 같은 client interaction 중심
  - SSR보다 빠른 상호작용과 명확한 API 경계가 중요
- 복잡도가 커진 지점:
  - `.next`와 `.open-next`가 동시에 생김
  - Next build → OpenNext transform → Cloudflare Worker deploy 흐름
  - public/admin Worker split
  - Next runtime 제약과 Worker runtime 제약을 동시에 고려
  - server/client boundary와 OpenNext adapter 계층을 AI agent가 혼동하기 쉬움
- 전환을 결심한 기준:
  - “가능한가”가 아니라 “문제가 생겼을 때 빠르게 이해하고 고칠 수 있는가”
  - 혼자 운영해야 하므로 장애 표면이 작아야 함

### 보여줄 코드/자료

- 코드보다는 구조 diagram 중심.
- 기존 구조와 전환 후 구조 비교.

```text
Before:
Next.js App Router
→ next build
→ .next
→ OpenNext
→ .open-next
→ Cloudflare Worker
→ public/admin split

After:
Vite React SPA
→ dist/client
Cloudflare Worker API
→ dist/altteulmap
→ single Worker
```

### 제외할 내용

- API contract 상세
- Auth/OAuth 구현
- Worker DB lifecycle
- Cloudflare Dashboard 실패담
- React Doctor식 품질 리팩터링

이 내용은 2편, 3편, 별도 품질 리팩터링 글로 넘긴다.

### 결말

1편은 다음 질문으로 끝낸다.

```text
그렇다면 프레임워크를 바꾸면서 기존 기능과 운영 계약을 어떻게 깨지 않게 옮길 것인가?
```

이 질문이 2편으로 이어진다.

## 2편: Vite + React + Worker로 어떻게 기능 보존 이관했는가

### 가제

```text
프레임워크를 바꿔도 기능은 바꾸지 않는다
```

### 역할

2편은 실제 마이그레이션의 핵심 기술 전략을 다룬다. UI만 다시 만든 것이 아니라 API contract, route path, DB schema, env 이름, 사용자 플로우를 보존하면서 구조를 바꾼 과정을 설명한다.

### 핵심 메시지

```text
마이그레이션의 본질은 새 프레임워크를 붙이는 일이 아니라
기존 contract를 문서화하고, 새 런타임에서 같은 의미로 재구현하는 일이다.
```

### 반드시 포함할 내용

- Phase 0: API/Auth baseline 고정
  - endpoint별 method, path, request, success/error response, auth requirement 기록
  - cookie 이름, `/api/auth/session` shape, credentials 실패 동작 기록
- Phase 1/2: Vite client와 Worker scaffold 병렬 추가
  - 기존 production Next 경로 보존
  - React Router route 추가
  - public page, place detail, submit/report/login/signup/bookmarks 이관
- Phase 3: Worker DB-backed API 이관
  - public read repository와 public write repository 분리
  - Next `server-only` repository를 그대로 가져오지 않은 이유
  - mock fallback과 database source guard
- Phase 4: Auth 이관
  - NextAuth 내부 복제가 아니라 앱이 의존하는 auth contract 보존
  - signed session cookie
  - credentials, signup, Kakao/Naver OAuth route
- Phase 5: admin 통합
  - 별도 admin 앱이 아니라 `/admin/*` 통합
  - 실제 보안 경계는 `/api/admin/*`의 `requireAdmin`
- Phase 6/7: Vite/Worker build 전환과 Next/OpenNext 제거
  - staging 또는 production smoke 통과 전 삭제 금지
  - 제거는 마지막에 수행

### 반드시 보여줄 코드

#### API contract 비교 harness

목적:

```text
화면이 비슷하게 보이는 것이 아니라
status/body/auth/source 의미가 같은지 비교한다.
```

보여줄 포인트:

- success mutation은 기본 실행하지 않음
- `CONTRACT_EXPECT_VITE_SOURCE=database` guard
- mock fallback이 DB 검증처럼 보이는 착각 방지

#### Worker repository 경계

목적:

```text
기존 Next repository를 그대로 import하지 않고
Worker runtime용 public read/write/admin repository를 분리한 이유를 보여준다.
```

보여줄 포인트:

- `server-only` import 제거
- Worker env binding 사용
- public read/write/admin/auth/telemetry를 분리

#### signed session cookie

목적:

```text
NextAuth의 모든 내부를 복제한 것이 아니라
앱이 의존하는 session contract를 보존했다는 점을 보여준다.
```

보여줄 포인트:

- cookie name 유지
- payload + signature
- `/api/auth/session` response shape 유지
- role 기반 admin 판정

#### admin 권한 경계

목적:

```text
/admin UI 보호와 /api/admin 서버 권한 검사는 다르다.
```

보여줄 포인트:

- UI route gate는 UX
- `requireAdmin`은 실제 보안 경계
- unauth `401`, non-admin `403` 구분

### 제외할 내용

- Cloudflare Dashboard UI 오류와 deploy command 실패 상세
- Worker DB request lifecycle 장애 상세
- production secret 누락 사건

이 내용은 3편에서 다룬다.

### 결말

2편은 다음 질문으로 끝낸다.

```text
코드가 이관됐다고 끝난 것이 아니다.
실제 Worker 런타임과 Cloudflare 배포에서는 무엇이 깨졌을까?
```

이 질문이 3편으로 이어진다.

## 3편: Cloudflare 배포, Auth, DB lifecycle, production cutover에서 무엇이 깨졌는가

### 가제

```text
로컬에서 되던 Vite 앱은 왜 배포에서 다시 깨졌나
```

### 역할

3편은 운영 전환과 production cutover에서 깨진 것들을 다룬다. 이 편은 가장 실전적인 글이어야 한다. 코드보다 런타임, 배포 설정, secret, smoke, rollback 관점을 중심으로 쓴다.

### 핵심 메시지

```text
마이그레이션은 merge가 아니라 cutover까지 끝나야 완료다.
Cloudflare Worker에서는 코드보다 runtime lifecycle과 배포 설정이 더 먼저 깨질 수 있다.
```

### 반드시 포함할 내용

- Cloudflare Builds 설정 문제:
  - build command와 deploy command mismatch
  - generated Wrangler config path 불일치
  - Dashboard form 저장 실패
  - GitHub 연결 오류
- production direct deploy 판단:
  - 사용자가 없는 서비스였기 때문에 장애 감수 가능
  - 사용자가 생긴 뒤에는 staging/rollback 없이 반복하면 안 됨
- env/secrets 누락:
  - 코드가 맞아도 Worker binding에 secret이 없으면 auth가 실패
  - credentials/admin password override, OAuth client secret, Turnstile secret 같은 운영 설정 범주
- Worker DB lifecycle:
  - Node 서버식 global singleton DB client가 Worker에서 위험한 이유
  - `Cannot perform I/O on behalf of a different request`
  - request-local DB context로 수정
- smoke automation:
  - `smoke:vite:local`
  - remote smoke
  - auth/admin/API boundary smoke
  - production smoke는 배포 성공과 별도
- Next/OpenNext 제거:
  - production smoke 통과 뒤에 삭제
  - `.next`, `.open-next`, `apps/admin` 산출물 정리
  - old admin Worker는 바로 삭제보다 redirect-only가 안전했던 이유

### 반드시 보여줄 코드

#### Worker request-local DB lifecycle

목적:

```text
Worker에서는 DB client lifecycle이 request boundary를 넘어가면 안 된다는 점을 보여준다.
```

보여줄 포인트:

- 전역 singleton이 왜 위험했는지
- request-local context
- route 실행 후 close
- 연속/병렬 request smoke가 왜 필요했는지

#### SPA fallback route 분기

목적:

```text
SPA fallback이 모든 path를 index.html로 보내면 API와 정적 asset contract가 깨진다.
```

보여줄 포인트:

- `/api/*`는 API
- `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`는 올바른 content-type
- 그 외 public route만 `index.html`

#### deploy check

목적:

```text
빌드 산출물이 더 이상 .next/.open-next를 참조하지 않는지 자동으로 확인한다.
```

보여줄 포인트:

- generated Wrangler config path
- assets directory
- OpenNext 참조 금지

### 공개 가능한 실패 사례

- Cloudflare Dashboard가 build 설정 저장을 실패했다.
- deploy command가 존재하지 않는 generated config path를 참조했다.
- GitHub 연결 오류가 latest build failed로 남았다.
- Worker 변수/secret이 재연결 후 초기화되어 auth가 실패했다.
- 로컬에서 DB fallback이 성공처럼 보일 수 있었다.
- 병렬 admin API smoke에서 Worker DB lifecycle 문제가 드러났다.

### 공개 금지 또는 익명화할 내용

- 실제 secret 값
- 실제 DB URL
- 전체 Cloudflare account id
- admin credential
- OAuth client secret
- 운영 provider callback URL에 포함된 민감 query
- 특정 개인 계정 이메일

### 결말

3편은 다음 메시지로 끝낸다.

```text
프레임워크를 바꾸는 것은 코드 이동이 아니라 운영 책임의 재배치다.
단순한 구조를 선택했다면, 그 단순함을 검증하는 smoke와 실패 조건도 같이 가져가야 한다.
```

## 시리즈 간 중복 방지표

| 주제 | 1편 | 2편 | 3편 |
| --- | --- | --- | --- |
| Next.js 선택 이유 | 깊게 다룸 | 언급만 | 제외 |
| OpenNext 복잡도 | 깊게 다룸 | 배경으로만 | deploy 관점에서만 |
| API contract | 문제 제기만 | 깊게 다룸 | smoke 관점에서만 |
| React Router 이관 | 제외 | 깊게 다룸 | 제외 |
| Auth/OAuth | 문제 제기만 | 구현 전략 | 운영 secret/live callback |
| Worker DB | repository 경계만 언급 | DB-backed API 전략 | lifecycle 장애와 해결 |
| Admin 통합 | 구조 변화로 언급 | UI/API 보안 경계 | old admin Worker redirect |
| Cloudflare Dashboard | 제외 | 제외 | 깊게 다룸 |
| Next/OpenNext 제거 | 결론에서 언급 | 순서 설명 | cutover/cleanup 상세 |
| 품질 리팩터링 100점 | 제외 | 제외 | 별도 글 링크만 |

## 실제 작성 순서

1. 기존 `docs/blog/next-to-vite-migration-retrospective.md`를 그대로 확장하지 말고, 이 outline 기준으로 1편부터 다시 쓴다.
2. 1편 작성 후 기존 초안에서 1편에 맞는 문단만 흡수한다.
3. 2편 작성 전 `docs/migration-next-to-vite-react.md`에서 contract/auth/admin 관련 근거를 다시 확인한다.
4. 3편 작성 전 배포 로그와 `docs/COMPLETED.md` archive에서 production cutover 관련 항목을 다시 확인한다.
5. 각 편 마지막에 다음 편으로 이어지는 질문을 남긴다.
6. 최종적으로 기존 초안 `next-to-vite-migration-retrospective.md`는 시리즈 index 또는 1편으로 대체할지 결정한다.

## 완료 기준

시리즈 전체가 완성됐다고 판단하려면 다음을 만족해야 한다.

- 1편은 “왜 바꿨는가”만으로 독립적으로 읽힌다.
- 2편은 “어떻게 기능을 깨지 않고 옮겼는가”를 contract 중심으로 설명한다.
- 3편은 “왜 배포와 운영 검증이 별도 문제인가”를 실제 실패 사례로 설명한다.
- 세 편 모두 Next.js 비난이 아니라 적합성 판단으로 읽힌다.
- 코드 예시는 짧지만 핵심 경계를 보여준다.
- 민감정보는 모두 제거되어 있다.
- 각 편은 작업 로그가 아니라 공개 가능한 회고 글로 읽힌다.
