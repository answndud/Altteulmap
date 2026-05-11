# 프레임워크를 바꿔도 기능은 바꾸지 않는다

> 알뜰맵의 Next.js → Vite + React 마이그레이션 두 번째 글이다. 이 글은 실제 이관 전략을 다룬다. 핵심은 새 프레임워크를 붙이는 것이 아니라, 기존 API contract와 인증 의미, DB schema, 사용자 플로우를 깨지 않고 새 런타임에서 다시 세우는 일이었다.

이 글은 길다. 그래서 읽는 순서를 먼저 고정한다.

```text
1. 먼저 contract를 문서화한다.
2. 기존 production 경로를 살린 채 새 경로를 병렬로 붙인다.
3. 화면보다 API와 auth 의미를 먼저 맞춘다.
4. mock fallback과 database 검증을 분리한다.
5. admin은 UI보다 서버 권한 경계를 먼저 잠근다.
6. production smoke가 끝난 뒤에 Next/OpenNext를 지운다.
```

이 순서가 이관의 핵심이었다. 한 번에 옮기면 빨라 보이지만, 깨졌을 때 원인을 분리하기 어렵다.

## 마이그레이션에서 가장 위험한 말: “거의 똑같아요”

프레임워크를 바꿀 때 화면만 보면 착각하기 쉽다.

```text
지도 화면이 열린다.
장소 목록이 보인다.
로그인 폼이 있다.
관리자 페이지도 뜬다.
```

이러면 “거의 다 됐다”고 느껴진다. 하지만 실제로는 아닐 수 있다.

API status code가 바뀌었을 수 있다. validation error shape가 달라졌을 수도 있다. 비회원 visitor cookie가 안 심길 수도 있다. `/api/auth/session` 응답이 미묘하게 달라져 admin 권한 체크가 깨질 수도 있다. `source:"mock"` fallback이 성공처럼 보여 DB-backed 검증을 착각하게 만들 수도 있다.

그래서 이번 마이그레이션의 첫 단계는 코드 작성이 아니라 baseline 고정이었다.

```text
method
path
request body
success response
error response
auth requirement
cookie requirement
rate limit requirement
```

이 항목을 endpoint별로 문서화했다. 마이그레이션 문서에는 `/api/categories`, `/api/places/map`, `/api/places/:id`, 가격 제보, 댓글, 반응, 신고, 북마크, auth, admin API까지 기록했다.

이 작업은 지루하다. 하지만 이 작업 없이 이관을 시작하면 “동작 보존”이라는 말은 감각이 된다.

예를 들면 `/api/places/map`은 단순히 장소 배열을 반환하는 API가 아니었다. 지도 화면의 성능과 클러스터 UX를 위해 preview shape를 반환하고, marker mode, bounds, count, truncated 여부, `source`, `mock` 같은 메타 정보를 포함한다.

반대로 `/api/places/:id`는 상세 페이지용 데이터다. 가격 항목, 이력, 댓글, 반응 상태까지 포함한다.

두 API가 모두 “장소를 반환한다”는 이유로 같은 shape를 내려주면 안 된다. 실제로 마이그레이션 중 이 문제가 한 번 발생했다. Vite Worker의 mock fallback이 map preview item이 아니라 detail item shape를 내려주고 있었다. 화면에서는 당장 큰 문제가 없어 보였지만, API contract 관점에서는 drift였다.

```text
map API가 detail shape를 내려준다
→ 응답 크기가 커진다
→ client가 암묵적으로 detail field에 의존할 수 있다
→ DB-backed route에서는 그 field가 없어져 다시 깨질 수 있다
```

contract 문서와 비교 harness가 없었다면 이 차이는 뒤늦게 발견됐을 가능성이 높다.

## 먼저 production 경로를 보존했다

처음부터 Next 코드를 지우지 않았다. 기존 production 경로는 유지한 채 Vite client와 Worker API entry를 병렬로 추가했다.

이 순서가 중요했다.

```text
기존 Next production 경로 유지
→ Vite/Worker scaffold 추가
→ public route 이관
→ Worker API 이관
→ auth/admin 이관
→ smoke 통과
→ production cutover
→ Next/OpenNext 제거
```

마이그레이션에서 삭제는 마지막 작업이어야 한다. 삭제를 먼저 하면 비교 기준이 사라진다. 기존 Next route가 살아 있어야 새 Vite Worker route와 contract를 비교할 수 있다.

## React Router route는 새로 만들되, 사용자 path는 유지했다

Vite client는 React Router 기반으로 만들었다. 하지만 사용자가 보는 path는 바꾸지 않았다.

```text
/              지도
/place/:id     장소 상세
/submit        장소 등록
/report        신고
/login         로그인
/signup        회원가입
/bookmarks     북마크
/admin/*       관리자
```

여기서 중요한 것은 “라우터는 바뀌지만 URL contract는 유지한다”는 점이다. 사용자가 북마크한 링크, 공유 링크, smoke test, 운영 문서는 route path에 의존한다.

일부 컴포넌트는 그대로 재사용할 수 있었다. 예를 들어 지도 패널은 Next router에 직접 묶여 있지 않고 props로 동작했기 때문에 Vite route에서도 비교적 안전하게 가져올 수 있었다.

반면 auth form, reaction button, bookmark button은 Next 의존성이 있었다.

```text
next-auth/react
next/link
router.refresh()
router.push()
```

이런 컴포넌트는 억지로 재사용하지 않았다. Vite 전용의 작은 컴포넌트를 만들었다. 중복이 조금 생기더라도 런타임 경계를 선명하게 유지하는 편이 더 안전했다.

이때 배운 것은 이것이다.

```text
React 컴포넌트라고 해서 프레임워크 독립적인 것은 아니다.
```

public route 이관은 한 번에 끝내지 않았다. `/`, `/place/:id`, `/submit`, `/report`, `/login`, `/signup`, `/bookmarks`를 단계적으로 옮겼다.

이 과정에서 흥미로운 차이가 있었다.

`NaverMapPanel`은 비교적 안전하게 가져올 수 있었다. props로 `mapMarkers`, `selectedCategoryLabel`, `onSelectPlace`, `onViewportChange`를 받았고, Next router에 직접 묶여 있지 않았다.

반면 `MapExplorer` 전체를 통째로 가져오지는 않았다. 지도 패널뿐 아니라 북마크, 상세 시트, 모바일 sheet gesture, reaction update까지 묶여 있었기 때문이다. 통째로 가져오면 지도 이관, 북마크 인증, 상세 interaction, API write 이관이 한 배치에 섞인다.

마이그레이션에서 큰 컴포넌트를 그대로 가져오는 것은 빠를 수 있지만 위험하다.

```text
한 번에 많이 가져온다
→ 빨라 보인다
→ 깨졌을 때 원인이 넓어진다
→ 기능 parity를 감각으로 판단하게 된다
```

그래서 작은 단위로 가져왔다. 먼저 지도 패널, 그 다음 상세 interaction, 그 다음 북마크, 그 다음 admin으로 나눴다.

여기서 배운 것은 단순했다.

```text
마이그레이션에서 재사용의 단위는 파일이 아니라 책임이다.
```

파일 하나가 React 컴포넌트처럼 보여도 내부에 router, auth, mutation refresh, server helper가 섞여 있으면 독립적인 재사용 단위가 아니다.

## API contract 비교 harness를 만들었다

화면 E2E만으로는 API contract drift를 잡기 어렵다. 그래서 Next와 Vite Worker의 API response signature를 비교하는 harness를 만들었다.

핵심은 status와 body shape를 비교하고, Vite 응답이 진짜 DB-backed인지도 강제할 수 있게 한 것이다.

```js
function assertExpectedViteSource(contract, result) {
  if (!expectedViteSource || !result.body || typeof result.body !== "object") {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(result.body, "source")) {
    return;
  }

  assert(
    result.body.source === expectedViteSource,
    `${contract.name} expected Vite source '${expectedViteSource}' but received '${result.body.source}'`,
  );

  if (Object.prototype.hasOwnProperty.call(result.body, "mock")) {
    assert(
      result.body.mock === (expectedViteSource === "mock"),
      `${contract.name} mock flag does not match expected source '${expectedViteSource}'`,
    );
  }
}
```

이 옵션이 필요했던 이유가 있다. 로컬에서 `DATABASE_URL`을 잘못 넣어도 Worker가 mock fallback으로 응답하면 API shape는 맞아 보일 수 있다. 그러면 “DB-backed 검증 완료”라고 착각할 수 있다.

그래서 DB 검증에서는 이렇게 실행했다.

```bash
CONTRACT_EXPECT_VITE_SOURCE=database \
CONTRACT_VITE_BASE_URL=http://localhost:3121 \
npm run migration:contract
```

fallback은 사용자 보호에는 필요하다. 하지만 마이그레이션 검증에서는 fallback이 성공처럼 보이면 안 된다.

실제로 이 guard가 없었다면 잘못된 결론을 냈을 것이다. Vite Worker에 `DATABASE_URL`과 `USE_MOCK_DATA=false`를 넣고 DB-backed smoke를 시도했지만, 당시 로컬 Postgres가 떠 있지 않았다. Worker는 DB 접속에 실패했고 설계대로 mock fallback을 탔다.

응답은 `200`이었다.

```text
GET /api/places/map?scope=global&query=김밥
→ 200
→ source: "mock"
```

화면만 보면 성공처럼 보인다. 하지만 우리가 검증하려던 것은 mock fallback이 아니라 DB-backed Worker route였다.

그래서 `CONTRACT_EXPECT_VITE_SOURCE=database`를 붙였고, 테스트는 의도대로 실패했다.

```text
map search expected Vite source 'database' but received 'mock'
```

이 실패는 좋은 실패였다. 테스트가 “무엇을 증명하지 않는지”를 드러냈기 때문이다.

이 사건 이후로 contract check를 볼 때는 항상 두 가지를 분리했다.

```text
shape parity
→ 응답의 구조가 기존과 같은가

source parity
→ 지금 검증하려던 데이터 경로를 실제로 탔는가
```

둘 다 필요하다. shape만 맞으면 fallback이 성공처럼 보이고, source만 맞으면 JSON contract drift를 놓칠 수 있다.

## repository는 재사용보다 런타임 경계를 우선했다

처음에는 기존 repository를 Worker에 가져오면 빠를 것 같았다. 이미 장소 조회, 가격 제보, 관리자 승인 로직이 있었기 때문이다.

하지만 실제로는 위험했다. 기존 repository에는 Next 서버 전용 경계가 섞여 있었다.

```text
server-only
Next session helper
admin moderation logic
public read/write logic
mock fallback
DB query
```

이걸 Worker entry에 그대로 import하면 public read API 하나를 옮기다가 Next 서버 전용 코드와 admin logic까지 같이 끌고 들어온다.

그래서 Worker 전용 repository를 따로 만들었다.

```text
src/worker/places-read-repository.ts
src/worker/places-write-repository.ts
src/worker/admin-places-repository.ts
src/worker/admin-prices-repository.ts
src/worker/admin-reports-repository.ts
src/worker/auth-repository.ts
src/worker/telemetry-repository.ts
```

중복은 생겼다. 하지만 의도적인 중복이다. 마이그레이션 중에는 중복 제거보다 런타임 경계 보존이 먼저다.

처음부터 만들었다면 repository 이름도 더 노골적으로 지었을 것이다.

```text
public read
public write
admin moderation
auth/session
telemetry
mock fallback
```

작은 프로젝트에서는 파일 수를 줄이는 것이 단순함처럼 보인다. 하지만 런타임 경계가 섞이면 나중에 훨씬 더 복잡해진다.

public write API를 옮길 때 이 판단이 특히 중요했다. 장소 등록, 가격 제보, 댓글, 반응, 신고는 모두 “POST 하나 처리”처럼 보일 수 있다. 하지만 실제로는 다음 의미가 함께 있다.

```text
visitor cookie
session user id
rate limit key
validation error shape
404와 403 구분
댓글 삭제 권한
source/mock metadata
```

비회원 댓글 삭제가 실패할 때는 `403`이어야 한다. 존재하지 않는 댓글이면 `404`여야 한다. 가격 제보 validation 실패는 기존 Zod flattened error shape를 유지해야 한다. 이런 세부 계약이 바뀌면 화면은 비슷해도 운영 의미는 달라진다.

telemetry도 마찬가지였다. `POST /api/telemetry/visit`는 단순 로그 API가 아니었다.

```text
30분 bucket dedupe
/api path 무시
/_next path 무시
share ref 검증
visitor cookie
120일 retention prune
```

사용자가 바로 알아차리는 기능은 아니지만, 운영 판단에 쓰이는 데이터다. 조용히 틀어지면 더 위험하다. 그래서 telemetry도 Worker 전용 repository로 분리했다.

이 구간의 교훈은 이것이다.

```text
사용자에게 보이지 않는 API일수록 contract가 더 중요하다.
```

화면이 깨지면 바로 보인다. 하지만 telemetry, rate limit, visitor cookie, admin moderation 상태는 조용히 틀어진다. 조용히 틀어지는 기능은 더 늦게 발견된다.

## Auth.js를 그대로 복제하지 않았다

인증은 가장 조심해야 했다. 기존 앱은 NextAuth/Auth.js를 사용했다. Vite Worker에서는 NextAuth runtime을 그대로 얹는 대신, 앱이 실제로 의존하는 auth contract를 보존하는 방향으로 갔다.

보존한 것은 다음이다.

```text
cookie 이름
/api/auth/session shape
credentials 성공/실패 의미
Kakao/Naver OAuth callback route
admin role 판정
logout 후 session 비움
```

Worker에서는 signed session cookie를 만들었다. cookie 이름은 기존과 맞췄다.

```ts
export const AUTH_SESSION_COOKIE_NAME = "next-auth.session-token";
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
```

payload는 `AUTH_SECRET`으로 서명했다.

```ts
function signSessionPayload(payload: string, env: AuthSessionEnv) {
  return createHmac("sha256", getAuthSecret(env))
    .update(payload)
    .digest("base64url");
}

export function encodeSignedPayload(value: unknown, env: AuthSessionEnv) {
  const payload = toBase64Url(JSON.stringify(value));
  const signature = signSessionPayload(payload, env);

  return `v1.${payload}.${signature}`;
}
```

이건 NextAuth 내부 구현을 완벽히 복제한 것이 아니다. 중요한 것은 앱이 기대하는 외부 동작을 유지하는 일이었다.

```text
GET /api/auth/session
→ 비로그인: {}
→ 로그인: { user: { id, email, name, role }, expires }
```

마이그레이션에서는 내부 구현 호환성과 외부 동작 호환성을 구분해야 한다. 이 프로젝트에서 필요한 것은 NextAuth의 모든 내부를 재현하는 것이 아니라, 알뜰맵이 의존하는 session 의미를 유지하는 것이었다.

credentials login도 DB-backed로 바꿨다. 기존 `users`, `auth_accounts`, `password_hash` schema를 그대로 사용하고, demo/admin 계정의 password override 의미도 유지했다. 회원가입은 같은 table에 생성되도록 연결했다.

검증은 단순히 “로그인 화면에서 성공”이 아니었다.

```text
GET /api/auth/csrf
GET /api/auth/providers
invalid credentials → 401 + CredentialsSignin URL
valid credentials → 200 { url }
session cookie name 유지
GET /api/auth/session → user id/email/name/role/expires
authenticated GET /api/bookmarks → 200
signup unique email → 201
signup duplicate email → 409
```

이 목록이 중요한 이유는 인증이 화면보다 상태 계약에 더 가깝기 때문이다. 로그인 버튼을 눌러 다음 페이지로 이동하는 것만으로는 session, role, cookie, duplicate signup, logout, protected API가 모두 맞는지 알 수 없다.

## OAuth는 provider별 차이를 코드로 드러냈다

Kakao와 Naver는 둘 다 OAuth provider지만 profile shape가 다르다.

Kakao는 `kakao_account.email`, `properties.nickname`을 본다. Naver는 `response.email`, `response.id`, `response.name`을 본다.

NextAuth provider를 쓸 때는 이런 차이가 provider adapter 안에 숨어 있다. Worker route로 직접 옮기면 차이를 코드로 명시해야 한다.

OAuth 이관에서 중요한 것은 authorization redirect만 만드는 것이 아니었다.

```text
provider enable 조건
redirect URI
callbackUrl 보존
state 생성
state cookie
state 만료
token exchange
profile fetch
account sync
session 발급
실패 redirect
```

이 모든 것이 인증 contract다. 그래서 credentials/session을 먼저 안정화한 뒤 OAuth provider별 이관을 진행했다. 인증은 한 번에 다 붙이면 문제가 생겼을 때 원인을 나누기 어렵다.

OAuth는 특히 live callback을 무작정 로컬에서 끝낼 수 있는 영역이 아니었다. provider console에 등록된 redirect URI, 운영 URL, Worker secret, callbackUrl 처리까지 맞아야 의미가 있다.

그래서 먼저 로컬에서 확인할 수 있는 것을 분리했다.

```text
signin route가 provider authorization URL로 302를 보내는가
redirect_uri가 /api/auth/callback/:provider 인가
state가 생성되는가
missing code callback이 실패 redirect로 가는가
bad state callback이 실패 redirect로 가는가
synthetic account sync가 기존 schema에 맞게 동작하는가
```

실제 Kakao/Naver 계정으로 성공 callback을 확인하는 것은 production cutover 전후의 live smoke로 남겼다. 이건 회피가 아니라 검증 단계를 나눈 것이다. OAuth는 외부 콘솔 설정과 코드가 함께 맞아야 하기 때문에, 로컬에서 증명할 수 있는 것과 운영에서만 증명할 수 있는 것을 구분해야 한다.

## admin은 UI 통합보다 API 보안 경계가 먼저였다

admin을 별도 앱으로 유지하지 않고 `/admin/*`로 통합하기로 했다. 하지만 먼저 만든 것은 admin UI가 아니라 admin API의 서버 권한 검사였다.

핵심은 이 구분이다.

```text
/admin 접근 제한
→ UX 경계

/api/admin/* 권한 검사
→ 실제 보안 경계
```

Worker admin route에는 `requireAdminSession`을 두었다.

```ts
function requireAdminSession(
  request: Request,
  env: AdminBindings,
  noStoreHeaders: Record<string, string>,
) {
  const session = getSessionFromRequest(request, env);

  if (!session) {
    return {
      response: Response.json(
        { ok: false, message: "로그인이 필요합니다." },
        { status: 401, headers: noStoreHeaders },
      ),
    };
  }

  if (session.user.role !== "admin") {
    return {
      response: Response.json(
        { ok: false, message: "운영자 권한이 필요합니다." },
        { status: 403, headers: noStoreHeaders },
      ),
    };
  }

  return { user: session.user };
}
```

`401`과 `403`을 구분한 것도 중요했다. 로그인하지 않은 사용자와 권한이 없는 사용자는 다른 상태다. 이 차이를 유지해야 UI도 운영 로그도 정확해진다.

admin SPA는 그 다음에 붙였다. `/admin`, `/admin/places`, `/admin/prices`, `/admin/reports`는 모두 `/api/admin/*`를 호출한다. 화면에서 숨기는 것만으로는 보안이 되지 않는다.

admin API도 UI보다 먼저 검증했다. 비로그인, 일반 사용자, 운영자 session을 나눠 확인했다.

```text
session 없음
→ GET /api/admin/places
→ 401

일반 사용자 session
→ GET /api/admin/places
→ 403

admin session
→ GET /api/admin/places
→ 200
```

그 다음 pending 장소, 가격 제보, 신고를 로컬 DB에 만들고 reject/reviewing 처리를 확인했다. admin UI를 붙이기 전에 API 보안 경계와 mutation 경로를 먼저 잠근 것이다.

이 순서 덕분에 이후 admin SPA에서 문제가 생기면 원인을 UI state, fetch, rendering 쪽으로 좁힐 수 있었다.

admin 이관에서 가장 피하고 싶었던 것은 “관리자 화면이 보이니까 보안도 된 것 같다”는 착각이었다. 그래서 UI가 아니라 API status를 기준으로 완료를 판단했다.

## SPA fallback도 contract다

Vite SPA에서는 fallback을 잘못 만들면 모든 path가 `index.html`로 간다. 그러면 `/api/*`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` 같은 path도 잘못된 content-type을 반환할 수 있다.

그래서 Worker static route를 명시적으로 나눴다.

```ts
app.get("/robots.txt", (c) => {
  const origin = dependencies.getOrigin(c.req.raw, c.env.SITE_URL);

  return textResponse(
    ["User-agent: *", "Allow: /", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n"),
    "text/plain; charset=utf-8",
  );
});

app.get("/manifest.webmanifest", () =>
  new Response(JSON.stringify({ name: "알뜰맵", short_name: "알뜰맵" }), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
    },
  }),
);

app.get("/sitemap.xml", (c) => {
  return textResponse(xml, "application/xml; charset=utf-8");
});
```

그리고 API fallback은 index로 보내지 않는다.

```ts
app.all("/api/*", (c) =>
  c.json(
    {
      error: "Vite Worker API migration placeholder",
      path: c.req.path,
    },
    501,
  ),
);
```

마지막으로 그 외 public route만 assets fetch로 넘긴다.

```ts
app.notFound(async (c) =>
  applySecurityHeaders(await c.env.ASSETS.fetch(c.req.raw), c.req.raw),
);
```

이런 분기는 사소해 보이지만 운영에서는 중요하다. SPA fallback은 라우팅 편의를 위한 장치이지, 모든 HTTP contract를 무시해도 된다는 뜻이 아니다.

## Next/OpenNext 제거는 마지막에 했다

Vite route가 열리고, Worker API가 동작하고, admin이 보인다고 바로 Next 코드를 삭제하지 않았다.

삭제 순서는 보수적으로 잡았다.

```text
local smoke
contract comparison
DB-backed smoke
auth/admin boundary smoke
production deploy
remote smoke
old admin redirect
Next/OpenNext 제거
legacy 산출물 정리
```

마이그레이션에서 삭제는 구현보다 위험하다. 삭제 후에는 비교 기준이 줄어든다. 그래서 Next/OpenNext 제거는 production smoke가 끝난 뒤에 했다.

결과적으로 구조는 이렇게 정리됐다.

```text
src/client
→ Vite + React Router SPA

src/worker
→ Cloudflare Worker API, auth, admin, static route

src/features
→ 공용 도메인 타입과 로직

src/db
→ Drizzle schema
```

마이그레이션 중간 측정값도 계속 기록했다. 예를 들어 public write/telemetry 이관 시점의 산출물은 대략 이런 수준이었다.

```text
Worker entry: 약 508 kB
Worker fallback query chunk: 약 1.6 MB
client JS: 약 419 kB
client CSS: 약 51 kB
```

숫자를 남긴 이유는 “느낌상 커졌다/작아졌다”를 피하기 위해서다. Vite로 옮긴다고 자동으로 모든 bundle이 작아지는 것은 아니다. form 의존성, 지도 preview, admin route가 들어오면 client JS는 늘어난다. 중요한 것은 증가 이유가 설명 가능한가, 운영 경로와 fallback 경로가 분리되는가, smoke와 budget으로 추적 가능한가였다.

## 2편의 결론

프레임워크를 바꾸는 작업은 UI를 다시 그리는 작업이 아니었다. 가장 중요한 것은 기존 계약을 보존하는 일이었다.

```text
API path와 response shape
auth cookie와 session shape
DB schema
env 이름
admin 권한 정책
SPA fallback content-type
```

이것들을 먼저 고정했기 때문에 Vite + React + Worker로 옮겨도 기능 의미를 유지할 수 있었다.

하지만 코드를 옮겼다고 끝난 것은 아니었다. 실제 Cloudflare Worker 런타임과 production 배포에서는 로컬에서 보이지 않던 문제가 다시 나왔다. 다음 글에서는 배포 설정, secret 누락, Worker DB lifecycle, production cutover에서 무엇이 깨졌는지 다룬다.
