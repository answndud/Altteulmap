# 작은 지도 서비스에 Next.js는 왜 무거워졌나

> 알뜰맵을 Next.js + OpenNext에서 Vite + React + Cloudflare Worker로 옮긴 이유를 정리한 첫 번째 글이다. 이 글은 Next.js를 비판하기 위한 글이 아니다. 처음 선택은 합리적이었지만, 제품의 실제 성격과 운영 조건이 선명해지면서 더 단순한 구조가 필요해진 과정을 다룬다.

## 왜 굳이 잘 돌아가던 구조를 갈아엎었나

마이그레이션을 결정할 때 가장 불편했던 질문은 이것이었다.

```text
서비스가 아직 작고, 기능도 이미 돌아가는데
왜 굳이 프레임워크를 바꾸는가?
```

답은 “Next.js가 싫어서”가 아니었다. 오히려 반대에 가깝다. Next.js는 많은 것을 대신 해줬고, 그래서 초기에는 빨랐다. 문제는 알뜰맵이 실제로 어떤 서비스인지 선명해질수록, 내가 유지해야 하는 계층이 제품 규모보다 커졌다는 점이었다.

이 글은 그 판단을 되짚는 글이다. 어떤 기술이 더 우월한지보다, 어떤 구조가 지금의 제품과 운영 방식에 더 맞는지를 다룬다.

## 처음에는 Next.js가 맞아 보였다

알뜰맵은 사용자가 지도에서 저렴한 장소를 찾고, 가격 제보와 댓글, 신고를 남기고, 운영자가 관리자 화면에서 이를 승인하는 서비스다. 처음에는 Next.js를 선택했다.

그 선택에는 이유가 있었다.

```text
페이지 라우팅
API route
인증
SEO
배포
```

이 다섯 가지를 한 프레임워크 안에서 처리할 수 있다는 점은 1인 개발자에게 매력적이다. 초기에는 제품보다 “만들어야 할 것”이 더 많다. 로그인도 있어야 하고, 장소 상세도 있어야 하고, API도 필요하고, sitemap도 있어야 하고, 관리자도 있어야 한다. 그런 상황에서 Next.js는 빠르게 앞으로 나아가게 해준다.

Auth.js를 붙이기 쉽고, route handler로 API를 만들 수 있고, App Router의 파일 기반 구조도 익숙했다. Vercel이 아니라 Cloudflare Workers로 배포하더라도 OpenNext adapter가 있으니 가능해 보였다.

문제는 “가능하다”와 “이 프로젝트에 맞다”가 같은 말이 아니라는 점이었다.

## 알뜰맵은 문서 사이트보다 지도 앱에 가까웠다

처음에는 웹 서비스라는 큰 범주로 봤다. 하지만 기능을 만들수록 알뜰맵의 실제 성격은 더 분명해졌다.

알뜰맵의 핵심 경험은 이런 흐름이다.

```text
지도 열기
현재 위치 또는 지역 탐색
카테고리 필터 변경
숫자 클러스터 클릭
개별 장소 마커 확인
상세 패널 열기
가격 제보
댓글 작성
신고 제출
북마크
관리자 승인
```

문서 중심 사이트와는 달랐다. 사용자는 서버가 렌더링한 HTML 문서를 차례대로 읽는 것이 아니라, 지도 위에서 상태를 계속 바꾼다. 중심 좌표, zoom, bounds, selected place, bottom sheet, marker mode, filter, pending request가 계속 움직인다.

물론 Next.js로도 이런 앱을 만들 수 있다. 실제로 만들었다. 하지만 이 제품의 중심은 SSR이 아니라 client interaction이었다. 지도 자체도 Naver Maps JavaScript SDK가 브라우저에서 그린다. 장소 상세 SEO가 아주 중요한 성장 채널이라면 SSR의 가치가 컸겠지만, MVP의 핵심은 지도 탐색과 제보 흐름을 빠르게 검증하는 것이었다.

이 지점에서 의문이 생겼다.

```text
내가 지금 필요한 것은 강한 SSR 프레임워크인가?
아니면 브라우저 앱과 Worker API의 선명한 경계인가?
```

## Cloudflare에 올리면서 계층이 늘어났다

Next.js 자체가 문제였던 것은 아니다. 복잡도는 Next.js를 Cloudflare Workers에 올리는 방식과 결합되면서 커졌다.

당시 구조는 대략 이랬다.

```text
Next.js source
→ next build
→ .next
→ OpenNext transform
→ .open-next
→ Cloudflare Worker output
→ public/admin split
→ Cloudflare deploy
```

이 구조는 동작한다. 하지만 작은 프로젝트치고 확인해야 할 계층이 많았다.

빌드가 실패하면 어느 층의 문제인지 봐야 했다.

```text
내 코드 문제인가?
Next build 문제인가?
OpenNext 변환 문제인가?
Cloudflare Worker runtime 문제인가?
Wrangler 설정 문제인가?
public/admin split 문제인가?
```

이 질문들이 매번 생겼다.

한 번은 배포 속도를 줄이기 위해 build 설정을 손봤고, 한 번은 OpenNext 산출물 경로가 맞지 않아 deploy command가 실패했다. `.next`와 `.open-next`가 동시에 존재하니 어떤 산출물이 실제 배포 대상인지도 계속 확인해야 했다.

이때 느낀 피로는 단순히 “빌드가 느리다”가 아니었다. 빌드가 실패했을 때 내가 봐야 하는 표면이 너무 많았다.

```text
source code
package install
Next build cache
OpenNext generated output
Cloudflare generated Worker
Dashboard build command
Dashboard deploy command
Wrangler config
Worker variables/secrets
```

작은 서비스에서는 이 표면이 곧 운영 비용이다. 빌드 시간이 몇 분 더 걸리는 것보다 더 큰 문제는 실패 지점을 바로 좁히기 어렵다는 점이었다.

Next.js 상태에서 실제로 배포 시간을 줄이는 작업도 했다. Cloudflare build cache를 켜고 exclude path를 조정하자 배포 시간은 `7분대`에서 `2분 44초` 수준까지 줄었다. 이건 분명 개선이었다. 하지만 그 다음 질문이 남았다.

```text
배포 시간을 줄인 것과
배포 구조가 단순해진 것은 같은가?
```

답은 아니었다. 캐시를 잘 잡으면 빨라질 수는 있다. 하지만 `next build → OpenNext 변환 → Worker 배포`라는 계층 자체는 그대로 남는다. 즉 성능 문제는 일부 완화됐지만, 구조적 복잡도는 그대로였다.

산출물만의 문제도 아니었다. 런타임 사고방식도 둘이었다.

Next.js에는 고유한 규칙이 있다. Server Component, Client Component, route handler, middleware, `server-only`, NextAuth callback, Next metadata가 있다.

Cloudflare Workers에도 별도 규칙이 있다. Web API runtime, request lifecycle, binding env, Node API 제약, workerd 호환성이 있다.

Next.js를 OpenNext로 Workers에 올리는 순간, 두 규칙을 동시에 고려해야 했다.

이 조합 자체가 나쁜 것은 아니다. 다만 내가 혼자 운영해야 하는 작은 지도 서비스에는 과했다. 문제가 생기면 “Next.js 지식”과 “Cloudflare Workers 지식”과 “OpenNext adapter 지식”을 동시에 꺼내야 했다. 하나의 프레임워크를 쓰고 있다고 생각했지만, 실제 운영에서는 세 개의 층을 디버깅하고 있었다.

## public/admin split이 작은 프로젝트를 더 크게 만들었다

초기에는 public 앱과 admin 앱을 나누는 것이 안전해 보였다. 사용자 서비스와 운영자 화면이 분리되면 보안과 배포가 더 깔끔할 것 같았다.

하지만 실제 운영 표면은 더 커졌다.

```text
public Worker
admin Worker
각각의 build command
각각의 deploy command
각각의 환경 변수
각각의 smoke check
각각의 Cloudflare Dashboard 설정
```

기능 규모에 비해 운영 단위가 많았다. 사용자 수가 많고 팀이 있다면 분리의 장점이 더 컸을 수 있다. 하지만 이 프로젝트는 1인 개발이고, 관리자 화면도 같은 DB와 같은 인증 경계를 보는 내부 운영 화면이다.

중요한 보안 경계는 `/admin` UI를 숨기는 것이 아니라 `/api/admin/*`에서 서버가 role을 검사하는 지점이다. admin 앱을 별도 Worker로 나누는 것보다, 단일 Worker 안에서 public UI와 admin UI를 통합하고 admin API에서 권한을 강제하는 편이 더 단순했다.

이 판단은 나중에 Vite 이관에서도 그대로 유지했다.

```text
/admin/*      → 운영자 UI route
/api/admin/*  → 실제 서버 보안 경계
```

UI route 보호는 UX다. API 권한 검사가 보안이다.

## AI agent와 작업할수록 경계가 더 중요해졌다

이 프로젝트는 혼자 개발하지만, 실제로는 AI agent와 많이 협업한다. 이 조건에서는 코드 구조가 더 중요해진다.

사람 개발자는 “이 파일은 Next server 전용이고, 이 helper는 Worker에서 쓰면 안 된다”는 맥락을 기억할 수 있다. 하지만 다음 세션의 agent는 그 맥락을 모른다. 파일 이름, import 경계, 테스트 실패 조건을 보고 판단한다.

Next.js + OpenNext + Cloudflare Workers 조합에서는 agent가 실수하기 쉬운 지점이 많았다.

```text
server-only 코드를 client route에서 import한다.
NextAuth helper를 Vite/Worker 쪽으로 끌고 온다.
window/document를 서버 경로에서 쓴다.
Worker runtime에서 Node 서버식 singleton을 만든다.
OpenNext 산출물을 실제 Worker 산출물처럼 착각한다.
public/admin split 설정을 잘못 연결한다.
```

이런 실수는 “AI가 부족해서”만 생기는 문제가 아니다. 구조가 애매하면 사람도 실수한다. AI는 그 애매함을 더 빨리 증폭시킬 뿐이다.

그래서 아키텍처 선택 기준이 바뀌었다.

```text
기능을 많이 제공하는가?
```

보다

```text
경계가 눈에 보이는가?
다음 세션의 agent가 잘못 건드리기 어려운가?
문제가 생겼을 때 어느 층을 봐야 하는지 바로 알 수 있는가?
```

가 더 중요해졌다.

## 바꾸려던 것은 프레임워크가 아니라 책임 경계였다

Vite + React로 옮긴다고 해서 기능이 갑자기 늘어나는 것은 아니다. Next.js로도 지도, 로그인, API, 관리자, sitemap은 모두 만들 수 있다.

내가 원했던 변화는 기능이 아니라 구조였다.

기존 구조는 이렇게 느껴졌다.

```text
Next page도 있고
Route handler도 있고
NextAuth도 있고
OpenNext도 있고
Cloudflare Worker도 있고
admin Worker도 있고
public Worker도 있다.
```

전환 후 목표는 더 단순했다.

```text
src/client   → 브라우저 UI
src/worker   → API, auth, admin, static route
src/features → 공용 도메인 타입과 로직
src/db       → schema와 DB 타입
```

브라우저는 브라우저 일을 한다. Worker는 서버 일을 한다. DB는 Worker에서만 접근한다. admin 보안은 `/api/admin/*`에서 검사한다.

이 정도로 단순하면, 문제가 생겼을 때 시작점이 보인다.

```text
화면이 깨졌다      → src/client
API shape이 바뀌었다 → src/worker route
DB 쿼리가 느리다    → src/worker repository 또는 src/db
권한이 뚫렸다      → /api/admin requireAdmin
배포가 실패했다    → Vite/Wrangler/Cloudflare 설정
```

이것이 Vite + React + Worker 구조를 선택한 핵심 이유다.

전환 후 산출물도 더 직접적으로 읽혔다.

```text
dist/client
→ 브라우저 정적 asset

dist/altteulmap/index.mjs
→ Worker entry

dist/altteulmap/wrangler.json
→ 배포 config
```

물론 Vite라고 산출물이 마법처럼 단순해지는 것은 아니다. Worker bundle, client bundle, assets directory는 여전히 이해해야 한다. 하지만 적어도 “Next가 만든 것인지, OpenNext가 바꾼 것인지, Cloudflare가 다시 감싼 것인지”를 추적하는 단계는 줄었다.

## Next.js를 버린 것이 아니라 과한 계층을 덜어냈다

마이그레이션을 말할 때 “Next.js를 버렸다”는 표현은 자극적이지만 정확하지 않다. 나는 Next.js가 틀렸다고 생각하지 않는다.

다만 알뜰맵의 현재 단계에서는 다음 조합이 과했다.

```text
지도 중심 SPA
+ Cloudflare Workers
+ OpenNext 변환
+ public/admin split
+ NextAuth
+ PostgreSQL
+ 1인 운영
+ AI agent 협업
```

이 조합은 만들 수는 있지만, 운영 중 이해하고 고치기에는 표면적이 넓었다.

반대로 전환 목표는 이랬다.

```text
Vite + React SPA
+ Cloudflare Worker API
+ PostgreSQL
+ signed session cookie
+ 단일 /admin
+ 명확한 smoke와 contract check
```

이건 더 화려한 구조가 아니다. 더 노골적인 구조다. 브라우저와 서버의 경계가 드러나고, API contract가 문서와 테스트로 고정되고, 배포 산출물이 단순해진다.

작은 프로젝트에서 내가 원한 것은 더 많은 프레임워크 기능이 아니라, 더 적은 추측이었다.

## 바꾸기로 했을 때 가장 먼저 정한 원칙

마이그레이션을 시작하기 전에 한 가지 원칙을 정했다.

```text
아키텍처는 바꾸지만, 제품 계약은 바꾸지 않는다.
```

구체적으로는 다음을 보존하기로 했다.

```text
API path
response JSON shape
DB schema
env variable 이름
사용자 route path
credentials/Kakao/Naver 인증 의미
public write 정책
bookmark 정책
admin moderation 정책
```

프레임워크를 바꾸면서 기능까지 바꾸면, 문제가 생겼을 때 원인을 분리할 수 없다.

```text
프레임워크 때문에 깨졌나?
API shape을 바꿔서 깨졌나?
DB schema를 바꿔서 깨졌나?
인증 정책을 바꿔서 깨졌나?
```

이 질문이 섞이면 마이그레이션은 위험해진다. 그래서 이번 작업은 기능 추가가 아니라 동작 보존형 이관으로 잡았다.

이 원칙은 나중에 여러 번 도움이 됐다. 예를 들어 Vite라면 public env 이름을 `VITE_` prefix로 바꾸는 것이 자연스럽다. 하지만 기존 운영 설정에는 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`가 있었다. 그래서 새 이름을 만들지 않았다. Vite build에서 기존 이름을 주입하도록 했다.

이 선택은 보기에는 덜 예쁘다. Next를 지웠는데 env 이름에는 `NEXT_PUBLIC_`이 남아 있기 때문이다. 하지만 마이그레이션 중 env 이름까지 바꾸면 운영 설정, 문서, Cloudflare variables, smoke script가 동시에 흔들린다. “깔끔한 이름”보다 “변경 축을 줄이는 것”이 더 중요했다.

같은 이유로 DB schema도 바꾸지 않았다. 인증 내부 구현은 바뀌었지만 session response shape는 유지했다. admin은 별도 앱에서 `/admin` route로 통합했지만 실제 권한 정책은 `/api/admin/*`에서 유지했다.

글로 보면 보수적인 결정들이다. 하지만 마이그레이션에서는 보수적인 결정이 안전한 결정인 경우가 많다.

## 1편의 결론

Next.js는 처음 선택지로 합리적이었다. 하지만 알뜰맵은 시간이 지날수록 SSR 중심 앱이 아니라 지도 중심 SPA라는 사실이 분명해졌다. 여기에 Cloudflare Workers와 OpenNext, public/admin split이 겹치면서 작은 서비스치고 운영 표면이 커졌다.

그래서 Vite + React + Worker로 옮기기로 했다.

이 선택의 핵심은 “Vite가 Next.js보다 우월하다”가 아니다.

```text
알뜰맵의 현재 요구에는
브라우저 UI와 Worker API의 명확한 경계가
Next.js + OpenNext 계층보다 더 잘 맞았다.
```

하지만 여기서 진짜 어려운 문제가 시작된다.

프레임워크를 바꾼다고 기존 사용자의 플로우, API 계약, 인증, 관리자 승인, DB 데이터까지 바뀌면 안 된다. 다음 글에서는 Vite + React + Worker로 옮기면서 기존 기능을 어떻게 보존했는지 다룬다.
