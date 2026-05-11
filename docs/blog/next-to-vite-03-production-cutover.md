# 로컬에서 되던 Vite 앱은 왜 배포에서 다시 깨졌나

> 알뜰맵의 Next.js → Vite + React 마이그레이션 세 번째 글이다. 이 글은 코드 이관 이후 실제 Cloudflare Worker 배포와 production cutover에서 깨진 것들을 다룬다. 마이그레이션은 merge가 아니라 cutover까지 끝나야 완료다.

이 편의 사건 순서는 대략 이렇다.

```text
Vite build는 성공
→ deploy command가 잘못된 generated config path를 봄
→ Dashboard 설정 저장도 실패
→ CLI direct deploy를 선택
→ GitHub 연결 상태와 production Worker 상태가 어긋남
→ 재연결 과정에서 variables/secrets가 초기화됨
→ auth/OAuth/Turnstile/DB smoke로 실제 상태를 다시 확인
→ Worker DB lifecycle 문제가 병렬 요청에서 드러남
→ request-local DB context로 수정
→ remote smoke 통과 후 Next/OpenNext 산출물을 정리
```

로컬 코드 이관보다 더 중요한 것은 이 순서였다. 운영 전환은 “한 번 배포”가 아니라, 실패한 가정을 하나씩 제거하는 과정이었다.

## 코드가 맞아도 배포는 실패할 수 있다

Vite + React + Worker 구조로 코드를 옮기고 나면 끝난 것처럼 보인다. 로컬에서 build가 통과하고, smoke도 통과하고, 관리자 화면도 뜬다.

하지만 production은 다른 문제다.

실제 전환 과정에서 깨진 것은 대부분 “React 코드”가 아니었다.

```text
Cloudflare Builds 설정
generated Wrangler config path
GitHub 연결 상태
Worker variables/secrets
OAuth callback URL
DB connection lifecycle
old admin Worker 처리
remote smoke 기준
```

즉 마이그레이션의 마지막 단계는 코드 이관이 아니라 운영 책임의 재배치였다.

## build는 성공했는데 deploy가 실패했다

Vite build 자체는 매우 빨랐다. 문제는 deploy command였다.

Cloudflare Builds 로그에서는 build가 성공했다. 하지만 deploy command가 존재하지 않는 config path를 보고 있었다.

```text
Build command:
npm run cf:build:vite

Deploy command:
npx wrangler deploy --config dist/altteulmap_vite_migration/wrangler.json --name altteulmap
```

실제 Vite build 산출물은 `dist/altteulmap/wrangler.json`이었다. deploy command는 과거 migration 이름이 남은 경로를 보고 있었다.

에러는 단순했다.

```text
Could not read file: dist/altteulmap_vite_migration/wrangler.json
ENOENT
```

이런 종류의 실패는 코드 리뷰만으로 잘 잡히지 않는다. build와 deploy가 바라보는 산출물 경로를 별도로 검증해야 한다.

그래서 deploy readiness check에서 generated config를 확인하도록 했다.

```js
const distWranglerConfigPath = path.join(
  cwd,
  "dist",
  "altteulmap",
  "wrangler.json",
);

printLine(
  `${fs.existsSync(distWranglerConfigPath) ? "OK  " : "WARN"} dist/altteulmap/wrangler.json`,
);
```

단순한 검사지만 효과가 있다. OpenNext 시절의 산출물 경로가 남아 있거나, Dashboard deploy command가 다른 path를 보고 있으면 바로 드러난다.

이 사건이 중요한 이유는 “빌드 성공”이라는 말의 범위가 생각보다 좁다는 점이다.

Cloudflare 로그에서 Vite build는 성공했다. Worker bundle도 만들어졌고, client asset도 만들어졌다. 하지만 deploy command가 다른 경로를 보고 있었기 때문에 최종 배포는 실패했다.

즉 pipeline은 최소 두 단계로 나눠 봐야 한다.

```text
build 성공
→ 산출물을 만들었다

deploy 성공
→ 올바른 산출물을 Cloudflare Worker에 업로드했다
```

이 둘은 다르다. 마이그레이션 중에는 특히 다르다. 과거 `altteulmap_vite_migration` 같은 임시 이름이 command에 남아 있을 수 있고, 실제 build output은 이미 `dist/altteulmap`으로 바뀌었을 수 있다.

그래서 deploy check는 “환경 변수가 있는가”만 보면 부족하다. 산출물 경로와 config path도 함께 확인해야 한다.

## Dashboard 설정은 항상 저장된다고 가정하면 안 된다

Cloudflare Dashboard에서 build 설정을 바꾸려 했을 때 form 저장이 실패했다.

```text
An internal error prevented the form from submitting.
Please try again.
```

이런 오류는 로컬 코드로 해결할 수 없다. 다시 시도하거나, disconnect/reconnect하거나, CLI deploy로 우회해야 한다.

당시 알뜰맵은 아직 실제 사용자가 없는 상태였다. 장애가 나도 직접 고치면 되는 상황이었다. 그래서 staging Worker를 따로 만들지 않고, 현재 production Worker에 직접 deploy하는 결정을 했다.

이 결정은 그 시점에서는 맞았다. 하지만 일반화하면 안 된다.

```text
사용자가 없는 MVP
→ direct production deploy 허용 가능

사용자가 있는 서비스
→ staging smoke, version rollback, DNS/cutover 기준 필요
```

운영 판단은 코드 품질과 별개다. 같은 배포 방식도 서비스 단계에 따라 안전하거나 위험할 수 있다.

이때 스스로에게 물어본 기준은 단순했다.

```text
지금 장애가 나면 누가 피해를 보는가?
장애를 고칠 권한과 시간이 나에게 있는가?
rollback 기준이 있는가?
이번 변경이 사용자의 데이터를 손상시킬 수 있는가?
```

당시에는 사용자가 없었고, DB migration을 동반하지 않았으며, 기존 데이터를 삭제하지도 않았다. 그래서 direct production deploy를 감수했다.

하지만 이 판단은 “앞으로도 이렇게 하자”가 아니다. 오히려 반대다. 이 경험을 통해 사용자가 생긴 뒤 필요한 기준이 더 분명해졌다.

```text
staging Worker
preview/staging variables
remote smoke
version rollback
admin smoke
OAuth live callback smoke
DB source guard
```

서비스 단계가 바뀌면 배포 전략도 바뀌어야 한다.

## GitHub 연결 오류가 latest build failed를 만들었다

한동안 실제 서비스에는 최신 코드가 적용되고 있었지만, Cloudflare Dashboard에는 latest build failed가 계속 보였다.

원인은 GitHub 연결과 Worker Builds 설정이 꼬인 상태였다. 사용자가 disconnect 후 재연결하자 `Error fetching GitHub User or Organization details`는 사라졌다. 하지만 그 과정에서 variables/secrets가 초기화되었다.

여기서 중요한 교훈이 있다.

```text
Cloudflare Worker 배포 상태
GitHub Builds 상태
실제 production에 올라간 Worker version
Worker variables/secrets 상태
```

이 네 가지는 서로 연결되어 있지만 같은 것이 아니다.

코드가 배포되어도 secret이 비어 있으면 인증은 실패한다. GitHub 연결이 실패해도 CLI deploy로 production에는 최신 코드가 올라갈 수 있다. Dashboard의 latest build failed는 사용자에게 보이는 서비스 상태와 다를 수 있다.

그래서 remote smoke가 필요하다.

```text
배포 성공 로그를 믿지 말고
실제 URL에서 health, API, auth, admin, static route를 확인한다.
```

이 문제는 특히 혼란스러웠다. 사용자가 보는 서비스는 최신 코드처럼 보이는데 Dashboard에는 failed가 남아 있었다. CLI deploy와 GitHub Builds가 같은 source를 바라보지 않는 순간, “latest build”라는 말은 실제 production version과 어긋날 수 있다.

그래서 상태를 네 가지로 분해해야 했다.

```text
1. GitHub repo의 최신 커밋
2. Cloudflare Builds가 마지막으로 시도한 빌드
3. CLI 또는 Dashboard로 실제 배포된 Worker version
4. 현재 Worker에 붙어 있는 variables/secrets
```

이 중 하나만 초록색이어도 서비스가 정상이라고 말할 수 없다. 반대로 하나가 빨간색이어도 사용자가 보는 서비스가 반드시 실패했다는 뜻도 아니다.

운영에서 필요한 질문은 “Dashboard가 초록색인가?”보다 구체적이어야 한다.

```text
현재 production URL이 기대한 commit의 동작을 하는가?
DB source는 database인가?
auth session이 발급되는가?
admin API가 401/403/200을 제대로 나누는가?
static route content-type이 맞는가?
```

## secret이 없으면 맞는 코드도 실패한다

Vite Worker로 이관한 뒤 로그인과 OAuth가 한 번에 안정화되지 않았다. 코드가 틀려서라기보다 Worker binding에 필요한 variables/secrets가 빠졌기 때문이다.

빠지기 쉬운 설정은 이런 것들이다.

```text
DATABASE_URL 또는 Hyperdrive binding
AUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_NAVER_MAP_KEY_ID
AUTH_KAKAO_CLIENT_ID
AUTH_KAKAO_CLIENT_SECRET
AUTH_NAVER_CLIENT_ID
AUTH_NAVER_CLIENT_SECRET
AUTH_ADMIN_PASSWORD
TURNSTILE_SECRET_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY
USE_MOCK_DATA=false
```

여기서 실제 값은 공개하면 안 된다. 중요한 것은 범주다.

인증 코드는 맞아도 `AUTH_SECRET`이 없으면 session 검증은 운영 기준으로 안전하지 않다. OAuth route가 있어도 provider client id/secret이 없으면 signin은 실패한다. Turnstile UI가 떠도 secret 검증이 없으면 bot 방어가 동작하지 않는다.

그래서 deploy check는 env 존재 여부를 검사한다.

```js
const requiredVars = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_NAVER_MAP_KEY_ID",
  "AUTH_KAKAO_CLIENT_ID",
  "AUTH_KAKAO_CLIENT_SECRET",
  "AUTH_NAVER_CLIENT_ID",
  "AUTH_NAVER_CLIENT_SECRET",
];
```

이 check는 secret 값이 올바른지까지 보장하지 않는다. 하지만 “아예 빠진 상태로 배포”하는 실수는 막는다.

Cloudflare GitHub 연결을 다시 하면서 variables/secrets가 초기화된 것도 중요한 사건이었다. 코드는 그대로였지만 로그인은 실패할 수 있었다. OAuth redirect도 실패할 수 있었다. Turnstile 검증도 실패할 수 있었다.

이 경험 이후로 secret을 코드와 같은 수준의 배포 입력으로 보게 됐다.

```text
code
build config
wrangler config
variables/secrets
external provider callback settings
database credential
```

이 중 하나라도 빠지면 production은 실패한다. 특히 OAuth는 코드와 secret만으로도 부족하다. provider console에 등록된 callback URL까지 맞아야 한다.

그래서 운영 문서에는 “어떤 값을 넣어야 하는가”뿐 아니라 “왜 필요한가”도 남겨야 한다. 예를 들어 Turnstile key는 UI 장식이 아니라 공개 쓰기 form의 bot 방어 입력이다. site key는 브라우저에 노출되는 값이고, secret key는 Worker가 검증할 값이다. 둘의 성격이 다르다.

## Worker DB lifecycle은 Node 서버와 달랐다

가장 중요한 런타임 이슈는 DB connection lifecycle이었다.

처음에는 Node 서버에서 흔히 하듯 DB client를 전역에 두고 재사용하려 했다. 로컬에서 한두 번 요청할 때는 괜찮아 보였다. 하지만 Worker에서 연속/병렬 요청을 보내자 문제가 드러났다.

```text
Cannot perform I/O on behalf of a different request
```

Cloudflare Workers에서는 request boundary를 넘어 I/O 객체를 재사용하면 안 된다. Node 서버식 singleton 최적화가 Worker runtime에서는 위험한 패턴이 될 수 있다.

해결은 request-local DB context였다.

```ts
export function getWorkerDb(env: WorkerDatabaseBindings) {
  const context = workerDatabaseStorage.getStore();

  if (!context) {
    throw new Error(
      "Worker database access must run inside withWorkerDatabaseConnection.",
    );
  }

  const state = createDbState(connection.connectionString);
  context.state = state;

  return state.db;
}

export async function withWorkerDatabaseConnection<T>(
  env: WorkerDatabaseBindings,
  load: () => Promise<T>,
) {
  const context: DatabaseContext = { env };

  return workerDatabaseStorage.run(context, async () => {
    try {
      return await load();
    } finally {
      const state = context.state;
      context.state = undefined;
      await closeDatabaseState(state);
    }
  });
}
```

이 구조는 일부러 불편하게 만들었다. `getWorkerDb`는 `withWorkerDatabaseConnection` 안에서만 동작한다. route가 DB 작업을 끝내면 해당 request의 client를 닫는다.

이 문제는 단일 request smoke만으로는 잡기 어렵다. 병렬 admin API smoke가 있었기 때문에 드러났다.

교훈은 명확하다.

```text
한 번의 요청만 성공하는 DB 연결은 운영 연결이 아니다.
연속 요청과 병렬 요청을 smoke에 포함해야 한다.
```

이 문제는 마이그레이션 전체에서 가장 값진 실패였다. 이유는 단순하다. Next.js에서 Vite로 옮긴다고 해도 JavaScript와 TypeScript는 그대로다. 그래서 무의식적으로 Node 서버의 습관을 가져오기 쉽다.

Node 서버에서는 DB client를 module-level singleton으로 두는 패턴이 흔하다. 서버 프로세스가 오래 살아 있고, connection pool을 재사용하는 것이 자연스럽다. 하지만 Cloudflare Worker는 request lifecycle과 isolate 모델이 다르다. 특히 workerd는 request 간 I/O 객체 재사용을 엄격하게 본다.

처음 DB-backed read만 확인했을 때는 문제가 보이지 않았다. 첫 요청은 성공했다. telemetry도 일부 성공했다. 문제는 다음 요청이나 병렬 요청에서 드러났다.

```text
첫 요청 성공
→ 같은 client 또는 socket이 남음
→ 다음 request에서 I/O 재사용
→ Worker runtime error
```

이 실패를 겪고 나서 DB helper의 기본값을 바꿨다. “편하게 어디서나 getDb”가 아니라 “request context 안에서만 DB 접근”이 되도록 했다.

이름도 중요하다. `getDb()`처럼 보이면 전역으로 언제든 호출해도 될 것 같다. 반면 `withWorkerDatabaseConnection()`은 lifecycle을 드러낸다. 코드가 조금 길어져도 안전한 사용법을 강제한다.

이건 단순 버그 수정이 아니라 런타임 모델을 코드 구조에 반영한 작업이었다.

## production smoke는 배포 성공과 별개다

배포가 성공해도 서비스가 정상이라는 뜻은 아니다. 그래서 remote smoke를 따로 둬야 했다.

확인해야 할 것은 단순 home page가 아니다.

```text
/api/health
/api/categories
/api/places/map
/api/places/:id
/api/auth/session
credentials login
signout
/api/admin/* unauth 401
admin session 200
/robots.txt
/sitemap.xml
/manifest.webmanifest
OAuth signin redirect
database source 여부
```

특히 `source:"database"` 검증은 중요했다. 운영에서 `source:"mock"`으로 응답하고 있는데 화면이 그럴듯하게 보이면 더 위험하다. 사용자는 서비스를 쓰는 것처럼 보지만 실제 데이터는 운영 DB가 아닐 수 있다.

remote smoke는 배포 성공 로그를 대체하지 않는다. 배포 성공 다음에 반드시 실행해야 하는 별도 검증이다.

remote smoke에서 특히 중요하게 본 것은 “성공 status”보다 “의미”였다.

예를 들어 `/api/places/map`이 `200`을 반환하는 것만으로는 부족하다.

```text
200인가?
JSON shape가 맞는가?
source가 database인가?
mock이 false인가?
count가 비정상적으로 0은 아닌가?
```

`/api/admin/places`도 마찬가지다.

```text
비로그인에서 401인가?
일반 사용자에서 403인가?
admin에서 200인가?
```

이 세 가지가 모두 필요하다. admin에서 200만 확인하면 보안 경계가 열린 것을 놓칠 수 있다. 비로그인에서 redirect HTML이 돌아와도 UI는 그럴듯해 보일 수 있다. API는 API답게 JSON status를 반환해야 한다.

OAuth도 단순히 버튼이 보이는 것으로 충분하지 않다.

```text
signin route가 provider로 redirect하는가?
redirect_uri가 production callback URL인가?
state가 포함되는가?
provider console 설정과 일치하는가?
```

이런 항목은 E2E 한두 개보다 운영 checklist에 가깝다.

## SPA fallback도 production에서 다시 봐야 한다

SPA fallback은 로컬에서 잘 보이다가 production에서 잘못 설정되기 쉽다. 모든 path가 `index.html`을 반환하면 `/robots.txt`도 HTML이 되고, `/sitemap.xml`도 HTML이 되고, `/api/*`도 이상한 응답이 될 수 있다.

그래서 production smoke에는 static route도 넣었다.

```text
/robots.txt
→ text/plain
→ Sitemap URL 포함

/sitemap.xml
→ application/xml

/manifest.webmanifest
→ application/manifest+json

/api/*
→ API route 또는 명시적 JSON error
```

SEO를 SPA 기반 생성 범위로 제한했더라도, 이 기본 contract는 지켜야 한다.

## old admin Worker는 삭제보다 redirect가 안전했다

admin을 단일 앱의 `/admin`으로 통합한 뒤 기존 `altteulmap-admin` Worker를 어떻게 할지 결정해야 했다.

삭제할 수도 있었다. 실제 사용자가 거의 없었기 때문이다. 하지만 바로 삭제하지 않고 redirect-only Worker로 남기는 편을 택했다.

이유는 단순하다.

```text
내가 저장해 둔 북마크가 있을 수 있다.
문서 어딘가에 old admin URL이 남아 있을 수 있다.
Cloudflare Dashboard에서 갑자기 서비스가 사라지는 것보다
새 위치로 명시적으로 보내는 편이 안전하다.
```

사용자가 많지 않아도 운영 URL은 한 번 퍼지면 흔적이 남는다. 삭제보다 redirect 후 관찰이 더 안전한 경우가 있다.

## Next/OpenNext 산출물은 마지막에 정리했다

production smoke가 통과한 뒤에야 Next/OpenNext 흔적을 정리했다.

제거 대상은 코드만이 아니었다.

```text
src/app
apps/admin
next.config
open-next config
OpenNext build scripts
.next
.open-next
apps/admin/.next
apps/admin/.open-next
CI의 Next cache restore
```

이 산출물들은 앱 구동에는 필요하지 않지만, 남아 있으면 다음 세션에서 혼란을 만든다.

```text
아직 Next 구조가 살아 있나?
이 .open-next가 실제 배포 대상인가?
admin은 아직 별도 앱인가?
```

마이그레이션은 코드만 바꾸는 일이 아니다. 개발자가 보는 작업 공간도 새 구조와 일치해야 한다.

용량 정리 과정에서도 같은 원칙이 적용됐다. `.next`, `.open-next`, `apps/admin/.next`, `apps/admin/.open-next`는 현재 Vite 구조에서는 재생성할 이유가 없는 과거 산출물이다. 지워도 앱 구동에는 영향이 없다.

반대로 `node_modules`는 크더라도 현재 개발/빌드에 필요하다. JavaScript 프로젝트의 `node_modules`가 Python이나 Spring Boot 프로젝트보다 커 보일 수 있지만, 지워도 되는지 여부는 크기가 아니라 현재 build path가 참조하는지로 판단해야 한다.

```text
크다
→ 지워도 된다
```

가 아니다.

```text
현재 Vite/Worker build가 참조하지 않는 재생성 산출물이다
→ 지워도 된다
```

가 맞다.

이 구분을 문서화하지 않으면 다음 세션에서 다시 `.open-next`를 보고 “아직 Next 구조가 남았나?”라고 오해할 수 있다.

## 3편의 결론

로컬에서 Vite 앱이 동작한다고 마이그레이션이 끝난 것은 아니었다. 실제로 깨진 것은 대부분 코드보다 운영 경계였다.

```text
build와 deploy command가 다른 산출물을 봤다.
Dashboard 설정 저장이 실패했다.
GitHub 연결과 production deploy 상태가 어긋났다.
Worker variables/secrets가 초기화되었다.
DB client lifecycle이 Worker request model과 충돌했다.
SPA fallback과 static route content-type을 다시 검증해야 했다.
old admin URL 처리도 운영 결정이었다.
```

이 경험을 지나고 나서야 마이그레이션의 의미가 분명해졌다.

```text
프레임워크를 바꾸는 것은 코드 이동이 아니라
운영 책임의 재배치다.
```

Vite + React + Worker 구조는 알뜰맵에 더 단순한 구조였다. 하지만 단순한 구조를 선택했다고 해서 운영이 자동으로 단순해지는 것은 아니다. 그 단순함을 유지하려면 smoke, deploy check, contract check, secret inventory, DB lifecycle guard 같은 실패 조건을 함께 가져가야 한다.

이 시리즈의 결론은 하나다.

```text
작은 프로젝트일수록 강력한 프레임워크보다
명확한 경계와 검증 가능한 운영 구조가 더 중요하다.
```

Next.js를 선택했던 것은 틀린 결정이 아니었다. 하지만 알뜰맵의 현재 단계에서는 Vite + React + Cloudflare Worker가 더 적합했다. 중요한 것은 유행하는 스택을 고르는 것이 아니라, 내가 실제로 운영할 수 있는 구조를 고르는 것이다.
