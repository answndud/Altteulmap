# 작은 지도 서비스에 Next.js는 왜 무거웠나

> 이 글은 알뜰맵을 Next.js + OpenNext에서 Vite + React + Cloudflare Worker로 이관하며 작성하는 작업 중 회고 초안이다. 최종 글은 마이그레이션 완료 후 다듬는다.

## 시작점
알뜰맵은 지도에서 저렴한 장소를 탐색하고, 가격 제보와 관리자 승인 흐름으로 데이터를 축적하는 작은 서비스다. 처음에는 Next.js를 선택했다. 페이지, API route, 인증, SEO, 배포까지 한 프레임워크 안에서 처리할 수 있다는 점이 매력적이었다.

하지만 서비스가 Cloudflare Workers 위에 올라가면서 구조가 예상보다 커졌다. Next.js 앱을 그대로 Workers에 배포하는 것이 아니라 OpenNext 변환 단계를 거쳐야 했고, public/admin split까지 겹치면서 빌드와 배포 표면적이 커졌다.

## 깨달은 점
작은 앱에서 가장 중요한 것은 "가능한가"보다 "운영 중 문제가 생겼을 때 빠르게 이해하고 고칠 수 있는가"였다. Next.js는 많은 기능을 제공했지만, 알뜰맵의 핵심 UX는 SSR 중심 문서 사이트보다 지도 중심 SPA에 가까웠다.

특히 다음 지점에서 복잡도가 커졌다.

- `.next`와 `.open-next`가 동시에 생기며 산출물 구조가 불명확해졌다.
- Cloudflare Worker runtime 제약과 Next runtime 제약을 동시에 신경 써야 했다.
- public/admin을 별도 Worker처럼 운용하면서 작은 프로젝트치고 배포 설정이 커졌다.
- AI agent와 작업할 때 server/client boundary, route handler, OpenNext 변환 계층을 동시에 고려해야 했다.

## 전환 방향
이번 이관은 Vite + React SPA, Cloudflare Worker API, Drizzle/PostgreSQL 구조로 단순화하는 것을 목표로 한다. 프론트엔드는 브라우저 앱, API는 Worker, DB 접근은 서버 전용이라는 경계를 명확하게 만든다.

다만 기능을 줄이지는 않는다. 기존 API path, 인증 의미, DB schema, 사용자 플로우는 보존한다. 장소 상세 SSR은 1차 범위에서 제외하고, sitemap/robots/canonical 같은 기본 SEO를 생성하거나 Worker route로 제공한다.

## 진행 중 기록

### 2026-05-01 Phase 0/1
마이그레이션 계획을 active 문서로 올리고, 기존 Next production 경로를 보존한 채 Vite/Worker 스캐폴드를 병렬로 추가하기 시작했다.

설치 중 최신 `@cloudflare/vite-plugin`이 최신 Wrangler를 끌고 오며 Node 22 이상을 요구한다는 점을 확인했다. 현재 프로젝트는 Node 20.20.2 기준이므로, 무리하게 런타임을 올리지 않고 Node 20 호환 범위의 Cloudflare plugin/Wrangler 조합으로 고정하기로 했다.

이 결정은 이번 마이그레이션의 핵심 원칙과 맞다. 아키텍처를 단순화하려는 작업에서 런타임 업그레이드까지 동시에 섞으면 장애 원인을 분리하기 어려워진다.

첫 번째 Vite build는 `vite.config.ts`에서 실패했다. Cloudflare Vite plugin이 ESM-only인데, 현재 package 설정에서는 Vite config가 CommonJS 로딩 경로를 탔기 때문이다. 설정 파일을 `vite.config.mts`로 바꾸니 빌드는 바로 통과했다.

또 하나의 작은 실수는 `dist/` 처리였다. Vite build가 만든 bundle을 ESLint가 검사하면서 generated code의 lint error가 대량으로 발생했다. 이건 소스 문제가 아니라 산출물 관리 문제였고, `dist/`를 git/lint ignore 대상에 추가해 해결했다.

이번 단계에서 바로 얻은 교훈은 명확하다. 프레임워크를 바꾸는 일은 UI 코드를 옮기기 전에 도구 체인과 산출물 경계를 먼저 안정화해야 한다. build output이 source처럼 취급되거나, production 설정과 migration 설정이 섞이면 이후 오류 원인을 추적하기 어려워진다.

Claude Code가 계획을 리뷰하면서 API contract와 Auth baseline을 먼저 고정하라고 지적했다. 맞는 지적이었다. 프레임워크 이관에서 가장 위험한 부분은 화면이 깨지는 것이 아니라, `401`과 `403`의 차이, cookie 이름, redirect URL, validation error shape 같은 작은 계약이 조용히 바뀌는 것이다.

그래서 UI를 옮기기 전에 현재 endpoint별 method, path, request body, success/error response, auth requirement를 문서에 고정했다. NextAuth도 CSRF cookie, callback-url cookie, session-token cookie, `/api/auth/session` shape, credentials callback 성공/실패 동작을 curl로 확인했다.

SPA fallback 검증에서도 작은 contract drift를 바로 발견했다. Vite Worker scaffold의 `/api/categories`가 `{ items }`를 반환하고 있었는데, 기존 Next API는 `{ groups, categories }`를 반환한다. placeholder라도 contract가 달라지면 이후 UI 이관이 잘못된 기준 위에서 진행되므로 즉시 맞췄다.

Phase 2에서는 `/`와 `/place/:id`를 React Router route로 연결했다. 아직 DB-backed Worker API가 아니라 mock query 기반이지만, 중요한 것은 route가 실제 `/api/places/map`, `/api/places/:id` contract를 fetch하도록 바뀌었다는 점이다.

이 과정에서 번들 크기 문제를 하나 더 발견했다. client route에서 단순 가격 포맷 함수 하나를 쓰려고 `features/places/queries`를 import했는데, 그 파일이 mock catalog까지 import하고 있어 첫 로드 JS가 1.7MB까지 커졌다. helper 하나를 잘못된 모듈에서 가져오는 것만으로도 전체 데이터가 client bundle에 들어갈 수 있다. Vite로 단순화하더라도 client/server 경계를 명확히 하지 않으면 같은 문제가 반복된다.

해결은 간단했다. client route에서는 local `formatKrw` helper를 사용하고, 데이터 catalog는 Worker 쪽에만 남겼다. 수정 후 첫 로드 JS는 251KB 수준으로 내려갔다. 앞으로는 공용 유틸을 둘 때도 "이 파일이 client bundle에 들어가도 되는가"를 먼저 확인해야 한다.

다음으로 `/submit`과 `/report`를 Vite route로 연결했다. 다행히 기존 public form component는 Next 전용 import가 없어서 거의 그대로 재사용할 수 있었다. 이건 프레임워크를 바꿀 때 중요한 힌트다. UI 컴포넌트가 라우터와 런타임에 덜 묶여 있을수록 이관 비용이 낮아진다.

Worker에는 아직 실제 DB write를 붙이지 않고, 기존 API contract에 맞춘 mock POST route를 먼저 추가했다. validation 실패 shape, 성공 preview shape, `altteulmap_visitor_id` cookie 설정을 smoke로 확인했다. 이 단계의 목적은 데이터를 저장하는 것이 아니라, route와 form과 API 계약이 같은 방향으로 맞물리는지 확인하는 것이다.

form 의존성이 들어오면서 client JS는 251KB에서 366KB로 늘었다. React Hook Form과 Zod resolver를 public bundle에 포함한 결과다. 당장 문제는 아니지만, 최종 산출물 비교에서 이 수치를 계속 추적해야 한다.

다음 배치에서 `/login`과 `/signup`을 옮기며 또 다른 경계 문제가 나왔다. 기존 auth form은 UI 컴포넌트처럼 보였지만 내부에서 `next-auth/react`와 `next/link`를 직접 import하고 있었다. 이걸 Vite client에 그대로 가져오면 Next.js를 걷어내는 마이그레이션에서 다시 Next runtime 의존성을 끌고 오는 셈이다.

그래서 auth form은 재사용하지 않고 Vite 전용 route form으로 얇게 다시 만들었다. 사용자에게 보이는 입력 필드, test id, 에러 문구, callbackUrl 의미는 유지하되, submit은 Worker의 `/api/auth/callback/credentials`와 `/api/auth/signup`을 직접 호출한다. 이 선택은 코드 중복을 조금 만들지만, 이번 단계에서는 런타임 경계를 선명하게 하는 쪽이 더 중요했다.

Worker auth route도 일부러 최종 구현으로 과장하지 않았다. local demo/admin credentials, `next-auth.csrf-token`, `next-auth.callback-url`, `next-auth.session-token`, `/api/auth/session` shape, credentials 실패 시 `CredentialsSignin` URL 정도만 smoke 가능하게 만들었다. Kakao/Naver OAuth와 실제 DB-backed signup/session 보존은 Phase 4로 남겼다.

이 배치에서 얻은 교훈은 "재사용 가능한 컴포넌트"와 "프레임워크 독립적인 컴포넌트"는 다르다는 것이다. 파일이 React 컴포넌트라고 해서 어디서나 쓸 수 있는 것은 아니다. 라우터, 인증 SDK, 서버 전용 helper를 직접 import하는 순간 그 컴포넌트는 특정 런타임에 묶인다. 다음에 처음부터 만든다면 UI component, API client, framework adapter를 더 엄격하게 나눌 것이다.

지도 패널을 붙일 때는 반대로 재사용의 이점이 있었다. `NaverMapPanel`은 Next router나 server session에 직접 묶여 있지 않고, `mapMarkers`, `selectedCategoryLabel`, `onSelectPlace`, `onViewportChange` 같은 props로 동작한다. 그래서 Vite route에서도 비교적 안전하게 가져올 수 있었다.

반면 `MapExplorer` 전체는 아직 가져오지 않았다. 이 컴포넌트는 지도뿐 아니라 북마크 버튼, 상세 시트, reaction update, mobile sheet gesture까지 묶고 있다. 지금 통째로 옮기면 지도 이관, 북마크 인증, 상세 상호작용, API write 이관이 한 배치에 섞인다. 이번 마이그레이션의 목적은 빠른 전환이 아니라 실패 지점을 작게 나누는 것이므로, `NaverMapPanel`만 먼저 연결했다.

이 과정에서 env 처리도 다시 확인했다. 기존 지도 SDK key 이름은 `NEXT_PUBLIC_NAVER_MAP_KEY_ID`, `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`다. Vite라면 보통 `VITE_` prefix를 쓰지만, 이번 작업의 규칙은 env 이름을 바꾸지 않는 것이다. 그래서 새 이름을 만들지 않고 Vite build에서 기존 public env 이름을 define으로 주입했다. 작은 편의 때문에 env contract를 바꾸면 배포 설정과 운영 문서가 같이 흔들린다.

지도 패널 연결 후 client JS는 374KB에서 397KB로 늘었다. 실제 Naver SDK는 런타임 외부 script로 지연 로드되지만, panel fallback과 marker visual 코드가 client bundle에 들어간 결과다. 이 정도 증가는 현재 단계에서는 수용 가능하다. 더 중요한 것은 지도 SDK key가 없어도 preview fallback으로 화면이 깨지지 않는다는 점이다.

상세 페이지 상호작용을 옮기며 컴포넌트 경계의 차이가 다시 드러났다. `PlacePriceReportForm`과 `PlaceCommentsSection`은 API path를 직접 호출하지만 Next router에는 묶여 있지 않았다. 그래서 Vite route에서 거의 그대로 재사용할 수 있었다. 반면 `PlaceReactionButtons`는 성공 후 `router.refresh()`를 호출한다. 이 한 줄 때문에 Vite client에서는 그대로 쓸 수 없었다.

해결은 Next 컴포넌트를 억지로 일반화하는 것이 아니라, Vite route 전용의 작은 `VitePlaceReactionButtons`를 만드는 것이었다. response contract, 버튼 UI, copy는 유지하고 Next의 refresh 의존성만 제거했다. 프레임워크 이관에서 "중복을 없애는 것"보다 "경계를 명확히 하는 것"이 우선인 순간이 있다.

Worker 쪽도 이번에는 DB write를 바로 붙이지 않았다. 가격 제보, 댓글, 반응 API는 기존 path와 response shape를 맞춘 mock route로 먼저 만들었다. 댓글 삭제와 반응은 `altteulmap_visitor_id` cookie를 기준으로 현재 isolate 안에서만 상태를 유지한다. 운영 기능은 아니지만 form, cookie, method, status, JSON shape가 같은 방향으로 맞는지 검증하기에는 충분하다.

이 배치 후 client JS는 397KB에서 411KB로 늘었다. 상세 interaction form과 Vite 반응 버튼이 들어간 증가분이다. 이제 public read/write UI의 상당 부분은 Vite 경로에서 클릭 가능한 상태가 됐다. 남은 큰 위험은 DB-backed Worker API, 진짜 Auth.js/OAuth, 그리고 admin 권한 경계다.

북마크 이관에서도 같은 패턴이 반복됐다. 기존 `BookmarkToggleButton`은 UI 컴포넌트지만 내부에서 Next router의 `push`와 `refresh`를 쓴다. 그래서 Vite에서는 `ViteBookmarkToggleButton`을 따로 만들었다. 중복이 늘어나는 것처럼 보이지만, 지금 단계에서 중요한 것은 "Next에 묶인 컴포넌트"와 "프레임워크 독립 컴포넌트"를 구분하는 것이다.

북마크 페이지는 기존 서버 page처럼 repository를 직접 호출할 수 없다. Vite SPA에서는 먼저 `/api/bookmarks`로 저장한 place id를 받고, 각 `/api/places/:id`를 다시 조회해 화면 데이터를 합친다. 이 방식은 요청 수가 늘어나는 단점이 있지만, contract를 보존하면서 Next 서버 page를 제거하는 중간 단계로는 명확하다. Phase 3에서 Worker API가 DB-backed가 되면 `/api/bookmarks`가 화면용 place summary까지 반환할지, 기존 contract를 유지하고 클라이언트 조합을 계속할지 다시 결정해야 한다.

이번 smoke에서는 비로그인 `401`, credentials login 후 목록 조회, 북마크 추가와 제거를 확인했다. 여기까지 오면 Phase 2의 핵심 public/client route는 대부분 Vite에서 클릭 가능한 상태다. 다음 단계부터는 더 어려운 작업이다. mock Worker API를 실제 DB-backed Worker API로 바꾸고, Auth.js/OAuth/session을 NextAuth 없이 보존해야 한다.

Phase 2를 닫으면서 일부러 gap table을 만들었다. 이관 작업은 "거의 됐다"라는 감각이 위험하다. `/`, `/place/:id`, `/submit`, `/report`, `/login`, `/signup`, `/bookmarks`가 모두 Vite에서 열린다고 해도 그것은 아직 운영 이관이 아니다. 지금은 mock Worker API와 local auth scaffold 위에서 클릭 가능성을 증명한 상태다.

다음 단계의 핵심은 UI가 아니라 데이터 경계다. `/api/places/map`과 `/api/places/:id`를 DB-backed Worker API로 옮기면 mock catalog가 Worker bundle에 들어가는 문제도 줄어들 수 있다. 그 다음 public write actor, 가격 제보, 댓글, 반응, 신고를 옮겨야 한다. OAuth와 admin은 더 위험하므로 뒤로 미뤘다. 위험한 것을 먼저 하는 게 항상 좋은 것은 아니다. 이번 경우에는 읽기 API를 먼저 실제 DB로 연결해야 나머지 write API의 검증 기준이 생긴다.

Phase 3를 시작하면서 첫 번째 판단은 "기존 repository를 그대로 Worker에 가져오지 않는다"였다. 겉으로 보면 `listMapPlaces`, `getPlaceDetail` 함수가 이미 있으니 재사용하면 빠를 것 같지만, 그 파일에는 `server-only`, admin moderation, write repository, Next 서버 session 경계가 한데 묶여 있었다. 이걸 Worker entry에 import하면 public read API를 옮기는 작은 작업이 Next/관리자/AI moderation 의존성까지 끌고 들어오는 작업으로 변한다.

그래서 Worker 전용 DB read repository를 따로 만들었다. 중복은 생겼지만 의도적인 중복이다. 마이그레이션 중에는 "중복을 줄이는 것"보다 "새 런타임 경계를 안전하게 세우는 것"이 먼저다. 특히 Cloudflare Worker는 env를 `process.env`가 아니라 binding으로 받는다. 기존 env 이름은 유지하되 읽는 방식은 Worker에 맞게 바꿔야 했다.

흥미로운 변화는 산출물에서도 보였다. DB read repository를 추가한 뒤 Worker entry는 480KB 수준으로 작아졌고, mock catalog는 별도 fallback chunk로 분리됐다. 아직 fallback chunk가 1.6MB 남아 있지만, 적어도 main Worker entry와 mock 데이터가 분리되기 시작했다. 이것이 이번 이관의 방향과 맞다. 운영 경로는 DB를 보고, mock은 개발/장애 fallback으로 격리한다.

다음에 처음부터 설계한다면 repository 파일을 이렇게 나눌 것이다.

- public read repository
- public write repository
- admin moderation repository
- auth/session adapter
- mock fallback data provider

이번 프로젝트에서 배운 점은 "큰 repository 하나에 기능을 계속 넣으면 프레임워크를 바꿀 때 가장 먼저 발목을 잡는다"는 것이다. 작은 프로젝트일수록 파일 수를 줄이는 것이 단순함처럼 보이지만, 실제 운영에서는 런타임 경계가 섞이지 않는 것이 더 중요하다.

public write API를 옮길 때는 또 다른 경계가 보였다. 비회원 쓰기는 단순히 request body를 DB에 넣는 일이 아니다. visitor cookie, rate limit key, session user id, 댓글 삭제 권한, 404/403 구분, validation error shape가 모두 API contract의 일부다. 이 중 하나라도 바뀌면 UI는 그대로 보여도 운영 동작은 달라진다.

그래서 `public-write-actor`를 Worker 전용으로 분리했다. 기존 Next helper는 `server-only`와 session helper에 묶여 있었고, Worker에서는 `process.env`나 Next session을 그대로 기대할 수 없다. 새 helper는 local session scaffold를 읽되, UUID가 아닌 임시 user id는 DB에 저장하지 않는다. 이건 기능 누락이 아니라 의도적인 제한이다. 진짜 Auth.js session 보존은 Phase 4에서 별도 기준선과 함께 처리해야 한다.

이번에도 "중복 제거"보다 "운영 경계 보존"을 우선했다. 장소 등록, 가격 제보, 댓글, 반응, 신고의 DB write helper를 Worker 아래에 따로 만들었다. 기존 repository와 비슷한 코드가 생겼지만, 덕분에 Next 서버 전용 import를 Worker entry에 끌고 오지 않았다. 작은 앱에서 중복은 나쁘지만, 런타임 경계가 흐려지는 것은 더 나쁘다.

또 하나 확인한 점은 fallback 정책이다. 로컬에서는 DB binding이 없으니 mock fallback이 계속 동작해야 한다. 반대로 운영 DB binding이 있는 환경에서는 DB helper를 우선 타야 한다. 이 두 조건을 명확히 나누지 않으면 "로컬에서는 됐는데 운영에서는 mock으로 저장되는" 위험한 상태가 된다. 다음 단계에서는 실제 DB binding 환경에서 read/write smoke를 반드시 확인해야 한다.

Telemetry는 작아 보이지만 운영 관점에서는 더 조심해야 했다. 화면이 깨지는 기능은 사용자가 바로 알아차리지만, 방문 지표는 조용히 틀어진다. `POST /api/telemetry/visit`는 단순히 이벤트를 받는 API가 아니라 30분 bucket dedupe, `/api` path 무시, 공유 링크 source 검증, visitor cookie, 120일 retention prune을 함께 가진다.

이 부분도 기존 repository를 그대로 가져오지 않았다. `server-only`와 Next helper에 묶인 로직을 Worker entry에 연결하면, 나중에 문제가 생겼을 때 "데이터가 안 쌓이는 이유"를 찾기 어려워진다. Worker 전용 telemetry repository를 만들고 DB schema는 그대로 사용했다.

이번 단계에서 얻은 기준은 분명하다. 이관은 "endpoint가 200을 반환한다"로 끝나지 않는다. 지표성 API는 특히 tracked 여부, ignored path, dedupe 기준, 실패 시 mock fallback까지 기존 의미가 같아야 한다. 작은 API일수록 테스트를 생략하기 쉬운데, 운영 품질은 이런 작은 API에서 많이 무너진다.

Phase 3의 endpoint를 모두 한 번씩 Worker에 연결한 뒤에는 구현보다 검증이 더 중요해졌다. 프레임워크 마이그레이션에서 위험한 말은 "대충 같은 JSON이 나온다"다. status code, key 이름, error shape, validation 실패 구조가 조금씩 달라지면 사용자는 같은 화면을 보고 있어도 클라이언트 코드와 운영 도구는 깨질 수 있다.

그래서 Next와 Vite Worker를 비교하는 contract harness를 만들었다. 이 스크립트는 성공 mutation을 기본으로 실행하지 않는다. 장소 등록이나 가격 제보 성공 케이스를 비교하려면 DB에 실제 데이터가 생긴다. 반복 가능한 검증과 운영 데이터 보호 중에서는 운영 데이터 보호가 먼저다. 기본 contract 검사는 read API, 인증 없는 북마크, validation 실패, telemetry처럼 안전한 케이스를 중심으로 둔다.

이것도 하나의 회고 지점이다. 처음부터 작은 프로젝트를 만들 때도 contract test를 너무 늦게 만들면 아키텍처를 바꾸는 순간 기준선이 흐려진다. 화면 E2E는 중요하지만, API migration에서는 더 낮은 레벨의 shape 비교가 필요하다. AI agent와 협업할수록 이런 자동 기준선이 있어야 "좋아 보이는 변경"과 "실제로 호환되는 변경"을 구분할 수 있다.

실제로 contract 비교를 돌리자마자 작은 drift가 잡혔다. Vite Worker의 `/api/places/map` mock fallback이 장소 상세용 데이터를 그대로 내려주고 있었다. 화면에서는 당장 문제처럼 보이지 않을 수 있지만, Next의 map API는 preview shape만 반환한다. Vite 쪽은 `priceItems`, `history`, `comments`까지 포함하고 있었고, 이는 API contract 변경이다.

이 사례가 중요한 이유는 "더 많은 데이터를 내려주면 괜찮지 않나?"라는 유혹 때문이다. 하지만 지도 목록 API는 가벼운 preview를 주는 것이 의도다. 불필요한 상세 데이터를 포함하면 응답 크기가 커지고, 클라이언트가 암묵적으로 그 필드에 의존하기 시작할 수 있다. 나중에 DB-backed route에서는 그 필드가 없어서 다시 깨질 가능성도 생긴다.

수정은 작았다. mock fallback도 `PlacePreviewRecord` shape로 좁혔다. 하지만 이 작은 수정이 마이그레이션의 성격을 잘 보여준다. 아키텍처를 바꾸는 일은 새 구조를 만드는 일이기도 하지만, 기존 구조의 숨은 의도를 다시 확인하는 일이기도 하다. 자동 contract 비교가 없었다면 이 차이는 한참 뒤에 발견됐을 가능성이 높다.

그 다음 DB-backed smoke를 시도하면서 또 다른 함정을 확인했다. Vite Worker에 `DATABASE_URL`과 `USE_MOCK_DATA=false`를 넣었다고 해서 곧바로 DB 경로를 검증한 것은 아니었다. 현재 로컬 env의 `DATABASE_URL`은 운영 Supabase가 아니라 `127.0.0.1:5432/altteulmap`이고, 로컬 Postgres가 떠 있지 않았다. Worker는 DB 연결에 실패한 뒤 설계대로 mock fallback을 탔다.

문제는 contract 비교가 그대로 통과할 수 있다는 점이었다. shape만 비교하면 `source:"mock"`이어도 API 구조는 맞다. 하지만 우리가 확인하려던 것은 DB-backed Worker route다. 이 둘을 구분하지 않으면 "DB 모드 검증 완료"라고 착각하기 쉽다. 그래서 contract harness에 `CONTRACT_EXPECT_VITE_SOURCE=database` guard를 추가했다. 이제 DB 검증을 요구하는 실행에서 mock fallback이 나오면 테스트가 실패한다.

이건 작은 테스트 옵션이지만 운영 사고를 막는 기준선이다. fallback은 사용자를 보호하기 위해 필요하지만, 마이그레이션 검증에서는 fallback이 성공처럼 보이면 안 된다. 다음에 처음부터 설계한다면 모든 API smoke에 "응답 shape"와 "데이터 source"를 별도 축으로 기록할 것이다. 특히 AI agent와 함께 작업할 때는 더 그렇다. agent는 초록색 테스트 결과를 보고 다음 단계로 넘어가려는 경향이 있으므로, 테스트가 무엇을 증명하지 않는지도 명확히 만들어야 한다.

로컬 Postgres를 다시 올리고 seed를 넣은 뒤에는 진짜 DB-backed path가 열렸다. `GET /api/places/map`, `GET /api/places/:id`, telemetry는 `source:"database"`와 함께 통과했다. 여기까지는 기대한 결과였다. 하지만 public write smoke를 돌리자 Cloudflare Worker 특유의 더 중요한 문제가 나왔다.

첫 번째 DB write는 성공했다. 그런데 바로 다음 request에서 `Cannot perform I/O on behalf of a different request`가 터졌다. 원인은 Postgres.js client를 전역 state에 남겨 둔 것이다. Node 서버라면 connection을 global로 재사용하는 것이 흔한 최적화처럼 보일 수 있다. 하지만 Cloudflare Workers에서는 request handler 간 I/O 객체를 재사용할 수 없다. 같은 "JavaScript 서버"라도 런타임 모델이 다르면 안전한 패턴이 달라진다.

해결은 connection pooling을 흉내 내는 것이 아니라, 현재 구조에서는 각 DB-backed route가 작업을 끝낸 뒤 client를 명확히 닫는 것이었다. read timeout helper, telemetry repository, public write route를 모두 DB 작업 후 close하도록 정리했다. 이 수정 후 `CONTRACT_EXPECT_VITE_SOURCE=database` contract 비교와 가격 제보, 댓글, 반응, 신고, 댓글 삭제 smoke가 모두 통과했다.

이 경험은 이번 마이그레이션의 핵심 이유를 다시 확인시켰다. Next.js에서 Cloudflare Workers로 변환하는 구조를 쓰면 이런 runtime 제약이 adapter 뒤에 숨어 있다가 배포나 smoke 시점에 드러난다. Vite + Worker API로 직접 옮기면 책임은 더 명시적이지만, 그만큼 어떤 코드가 Worker request lifecycle 안에서 실행되는지 더 선명하게 볼 수 있다.

처음부터 다시 만든다면 DB helper 이름부터 다르게 만들 것이다. `getDb()`처럼 전역 singleton을 암시하는 이름은 Node 서버에서는 편해도 Worker에서는 위험한 기본값이 된다. Worker용 API에서는 `withDatabaseRequest()`처럼 lifecycle을 드러내는 이름을 쓰고, 테스트도 "연속 두 request"를 반드시 포함할 것이다. 한 번의 요청만 성공하는 DB 연결은 운영 연결이 아니다.

인증 이관에 들어가면서 또 다른 현실적인 선택이 필요했다. 기존 앱은 NextAuth의 JWT session 전략을 사용한다. Vite Worker에서는 NextAuth runtime을 그대로 얹는 대신, 우선 같은 cookie 이름과 같은 `/api/auth/session` 응답 의미를 유지하는 signed session cookie를 만들었다. cookie 이름은 `next-auth.session-token`으로 유지하지만, 값은 Worker가 `AUTH_SECRET`으로 검증할 수 있는 `v1.<payload>.<signature>` 형식이다.

이 선택은 완벽한 NextAuth 내부 구현 복제가 아니라 운영 의미 보존에 가깝다. 사용자는 credentials로 로그인하고, 세션 조회는 `{ user, expires }`를 반환하고, 공개 쓰기/북마크/관리자 경계는 user id와 role을 읽을 수 있다. 마이그레이션에서는 내부 구현 호환성과 외부 동작 호환성을 구분해야 한다. 지금 필요한 것은 NextAuth의 모든 내부를 재현하는 것이 아니라, 앱이 의존하는 auth contract를 안정적으로 보존하는 것이다.

credentials login은 DB-backed로 바꿨다. 기존 `users`, `auth_accounts`, `password_hash` schema를 그대로 사용하고, demo/admin 계정의 env password override 의미도 유지했다. 회원가입도 Worker에서 같은 table에 생성하도록 연결했다. smoke에서는 유효한 credentials login, 잘못된 비밀번호, session 조회, 인증 후 북마크 조회, 회원가입, 중복 가입까지 확인했다.

이번 배치에서 OAuth는 일부러 분리했다. Kakao/Naver는 authorization redirect, state 검증, token exchange, profile fetch, account sync, 실패 redirect까지 한 세트다. credentials/session을 막 붙인 직후 OAuth까지 한 번에 넣으면 문제가 생겼을 때 원인을 나누기 어렵다. 작은 프로젝트라도 인증은 "한 번에 다 붙이기"보다 "credentials session 안정화 후 OAuth provider별 이관"이 더 안전하다.

OAuth를 Worker로 옮기면서는 "프레임워크가 대신 해주던 작은 보안 작업"이 얼마나 많은지 다시 보였다. authorization URL 하나를 만드는 것처럼 보이지만, 실제로는 provider enable 조건, redirect URI, callbackUrl 보존, state 생성, state cookie, 만료 시간, token 교환, profile shape 차이, email 필수 조건, account sync, session 발급, 실패 redirect가 모두 필요하다.

Kakao와 Naver는 같은 OAuth처럼 보이지만 profile shape가 다르다. Kakao는 `kakao_account.email`과 `properties.nickname`를 보고, Naver는 `response.email`, `response.id`, `response.name`을 본다. NextAuth provider를 쓸 때는 이 차이가 provider adapter 안에 숨어 있었다. 직접 Worker route로 옮기면 이 차이를 코드로 명시해야 한다.

이번 로컬 검증은 실제 외부 계정 로그인이 아니라 redirect/state/failure path와 synthetic account sync 중심으로 했다. 이것도 의도적인 선택이다. 외부 provider live callback은 redirect URI 등록과 운영 URL 설정이 맞아야 의미가 있다. 로컬에서 먼저 확인할 것은 "우리가 만드는 OAuth URL이 맞는가", "state mismatch가 실패하는가", "account sync가 기존 schema를 그대로 쓰는가"다. live provider smoke는 staging/production cutover 직전에 별도 체크리스트로 보는 게 맞다.

admin API를 옮기면서 다시 한 번 확인한 원칙은 "관리자 화면 보호와 관리자 API 보호는 다른 문제"라는 것이다. `/admin` 화면을 숨기는 것은 UX 경계이고, 실제 보안 경계는 `/api/admin/*`가 session과 role을 직접 검사하는 것이다. 그래서 Phase 5의 첫 작업은 UI가 아니라 Worker route의 `requireAdmin` 경계였다.

기존 admin API는 Next route handler에서 `getSessionUser()`를 호출하고, session 없음은 `401`, 일반 사용자는 `403`으로 분리한다. 이 작은 구분을 유지하는 것이 중요했다. 권한 문제를 모두 `401`로 뭉개면 사용자는 로그인 문제인지 권한 문제인지 알 수 없고, 운영자가 추적할 때도 원인이 흐려진다.

이번에도 기존 repository를 그대로 가져오지 않았다. admin repository에는 `server-only`, moderation suggestion, places repository의 큰 덩어리가 섞여 있었다. Worker entry에서 그 파일을 import하면 관리자 API 하나를 옮기다가 Next 서버 전용 경계까지 같이 끌려온다. 그래서 Worker 전용 admin repository를 새로 만들었다. 중복은 생겼지만, 어떤 쿼리가 Worker runtime에서 실행되는지 명확해졌다.

흥미로운 점은 admin API야말로 "화면이 없어도 먼저 검증할 수 있는 영역"이라는 것이다. pending 장소, 가격 제보, 신고를 로컬 DB에 만들고, admin session으로 각각 reject/reviewing 처리했다. 그런 다음 `db:seed`로 원복했다. UI를 옮기기 전에 API의 보안 경계와 mutation 경로를 먼저 검증하면, 이후 admin SPA는 API client와 화면 상태 문제로만 좁혀진다.

다음에 처음부터 만든다면 admin도 public과 같은 원칙으로 나눌 것이다. `admin-ui`, `admin-api`, `admin-repository`, `moderation-suggestion`을 처음부터 분리한다. 작은 프로젝트라고 하나의 repository 파일에 public read, public write, admin moderation, AI suggestion, cache invalidation을 계속 넣으면 나중에 아키텍처를 바꾸는 순간 모든 경계가 한꺼번에 흔들린다.

admin SPA를 붙일 때는 기존 Next admin 컴포넌트를 얼마나 재사용할지 다시 고민했다. 겉으로는 같은 React 컴포넌트지만, 내부에는 `next/link`, server page, repository type, `server-only` 경계가 섞여 있었다. 그대로 가져오면 Vite로 옮기는 과정에서 다시 Next 런타임 의존성을 끌고 오는 셈이다.

그래서 1차 admin SPA는 fetch 기반의 Vite 전용 route로 만들었다. 화면 완성도를 100% 복제하기보다 `/admin`, `/admin/places`, `/admin/prices`, `/admin/reports`가 실제 `/api/admin/*`와 맞물려 움직이는지를 먼저 봤다. 비로그인, 일반 사용자, 운영자 session을 Playwright로 확인했고, API 보안 경계는 앞서 만든 Worker route에 계속 둔다.

이 선택은 "재사용을 포기했다"기보다 "어떤 재사용이 안전한지 뒤로 미뤘다"에 가깝다. 마이그레이션 초반에 기존 컴포넌트를 무리하게 일반화하면 UI, 라우터, API, 인증, 타입 경계가 한 번에 흔들린다. 먼저 단순한 Vite route로 동작을 고정하고, 이후 중복된 카드나 form을 프레임워크 독립 컴포넌트로 다시 추출하는 편이 더 안전하다.

배포 설정에서는 더 보수적으로 움직였다. Vite 산출물이 만들어졌다고 바로 production `wrangler.jsonc`를 바꾸지 않았다. 현재 운영은 아직 Next/OpenNext split이고, 실제 cutover는 OAuth live callback, staging smoke, API parity가 모두 끝난 뒤에 해야 한다. 대신 `deploy:check:vite`를 추가해 generated Wrangler config가 `.next`나 `.open-next`를 참조하지 않는지, SPA fallback과 Worker entry가 배포 가능한 구조인지 자동으로 확인하게 했다.

이번에 배운 점은 배포 마이그레이션도 코드 마이그레이션처럼 "한 번에 전환"하면 안 된다는 것이다. 기존 production 경로를 유지한 채 새 산출물의 형태를 먼저 검증해야 한다. 특히 Cloudflare Workers Builds는 Dashboard 설정과 repo 설정이 함께 작동하므로, production config를 바꾸기 전에 산출물 검사를 로컬 명령으로 반복 가능하게 만드는 것이 먼저다.

마지막으로 admin 가격 항목 편집 화면까지 붙이면서 1차 admin parity의 뼈대가 생겼다. 여기서도 기존 Next form을 그대로 가져오지 않고 Vite 전용 작은 form을 만들었다. 기능은 단순하다. label, amount, unit, verification, 대표 가격 여부, 노출 여부를 수정하고 `/api/admin/price-items/:id`로 저장한다. 운영자가 쓰는 화면이므로 화려함보다 "어떤 API를 호출하고 어떤 상태가 바뀌는지"가 선명한 것이 우선이다.

여기서 로컬 개발 루프를 멈춰야 하는 선도 분명해졌다. Next/OpenNext 제거와 production cutover는 코드만 더 작성한다고 해결되는 단계가 아니다. 실제 OAuth provider redirect URI, Cloudflare Workers Builds 설정, staging URL, live callback smoke가 필요하다. AI agent가 코드를 계속 작성할 수 있다고 해서 production 경계를 추측하면 안 된다. 1인 개발일수록 "여기부터는 사람의 설정과 외부 콘솔 확인이 필요하다"는 선을 문서에 남기는 것이 안전하다.

그래도 멈추기 전에 하나 더 해야 할 일이 있었다. 지금까지의 smoke가 대부분 수동 Node snippet과 Playwright 실행으로 흩어져 있었기 때문이다. 이대로 두면 다음 세션에서 같은 검증을 재현하기 어렵다. 그래서 Vite build, Wrangler local dev, public API, auth/admin API boundary, admin SPA route를 한 번에 확인하는 `smoke:vite:local`을 만들었다.

이 자동화는 바로 값을 했다. admin API를 병렬로 호출하자 DB 연결이 실패했다. 원인은 다시 Worker DB lifecycle이었다. 전역 singleton DB client는 순차 요청에서는 괜찮아 보였지만, 동시 요청에서는 같은 client를 공유하거나 닫는 타이밍이 겹칠 수 있었다. 수동 smoke를 순차로만 돌렸다면 발견하지 못했을 문제다.

해결은 `AsyncLocalStorage` 기반 request-local DB context였다. 이제 Worker DB 접근은 `withWorkerDatabaseConnection` 또는 read timeout wrapper 안에서만 가능하고, 요청이 끝나면 그 요청의 client만 닫는다. 이 수정은 Vite 전환 과정에서 가장 중요한 운영 안정성 개선 중 하나다. 프레임워크를 바꾸는 이유가 단순히 빌드 시간을 줄이기 위해서가 아니라, 런타임 경계를 더 명확히 보기 위해서라는 점을 다시 확인했다.

production cutover에서는 코드보다 운영 설정이 먼저 문제를 만들었다. Cloudflare Dashboard의 Workers Builds form은 `An internal error prevented the form from submitting` 오류로 저장되지 않았다. 사용자가 없는 서비스였고 장애를 감수할 수 있었기 때문에 staging을 따로 만들지 않고 generated Wrangler config로 직접 production Worker를 배포했다. 이 결정은 빠르게 맞았지만, 앞으로 사용자가 생긴 뒤에는 같은 방식으로 하면 안 된다. 사용자 트래픽이 생긴 뒤에는 staging Worker, smoke, DNS cutover 또는 version rollback 기준이 필요하다.

첫 production smoke에서 OAuth와 credentials가 모두 작은 운영 설정 차이로 흔들렸다. Kakao/Naver signin은 Worker에 client id secret이 없어 `/login?error=kakao|naver`로 돌아왔고, admin/demo credentials는 password override secret이 없어 `401`을 반환했다. 코드는 맞아도 env binding이 빠지면 운영 기능은 실패한다. 이번 작업에서 env 이름을 바꾸지 않은 것은 맞는 결정이었지만, "기존 env 이름 유지"와 "새 Worker에 모든 secret이 실제로 연결됨"은 별개의 문제였다.

Next/OpenNext 제거는 마지막에 했다. 이 순서가 중요했다. Vite route가 열린 것, DB-backed API가 통과한 것, admin이 보이는 것만으로는 기존 구조를 지우면 안 된다. production smoke와 remote smoke가 통과한 뒤에야 `src/app`, `apps/admin`, `next.config.ts`, `open-next.config.ts`, OpenNext scripts, Next-only 컴포넌트를 제거했다. 마이그레이션에서 삭제는 구현보다 더 위험한 작업이다. 삭제 후에는 되돌릴 기준이 줄어들기 때문이다.

admin은 처음 계획대로 별도 앱이 아니라 통합 `/admin`으로 들어갔다. 여기서도 한 가지 운영 판단을 했다. 기존 `altteulmap-admin` Worker를 바로 삭제하지 않고 redirect-only Worker로 남겼다. 사용자가 거의 없더라도 내가 북마크하거나 문서에 남긴 old admin URL이 있을 수 있고, Cloudflare Dashboard에서 서비스가 갑자기 없어지는 것보다 명시적으로 새 위치로 보내는 편이 덜 위험하다. 작은 서비스에서도 "삭제"보다 "redirect 후 관찰"이 안전한 경우가 있다.

마지막 마감 정리에서 또 한 가지를 확인했다. 의존성에서 Next를 제거해도 로컬에는 `.next`, `.next-dev`, `.open-next`, `apps/admin/.next`, `apps/admin/.open-next` 같은 산출물이 그대로 남을 수 있다. 이 파일들은 앱 구동에 필요하지 않지만, 새로 프로젝트를 열었을 때 "아직 Next 구조가 살아 있나"라는 혼란을 만든다. 그래서 CI의 Next cache restore를 제거하고, legacy 산출물은 로컬에서 지웠다. 코드 마이그레이션은 dependency와 route만 바꾸는 일이 아니라, 개발자가 보는 작업 공간까지 새 구조와 일치시키는 일이다.

용량도 이 과정에서 현실적으로 봐야 한다. Next/OpenNext 산출물을 지워도 프로젝트 대부분은 `node_modules`가 차지한다. JavaScript 프로젝트에서 이 크기는 낯설 수 있지만, 현재 앱 구동에 필요한 dependency 묶음이다. 반대로 `.next`와 `.open-next`는 재생성 가능한 과거 빌드 결과다. 삭제해도 앱 실행 자체에는 영향이 없고, Vite 구조에서는 다시 만들 이유도 없다. "무엇을 지워도 되는가"는 파일 이름이 아니라 현재 build path가 무엇을 참조하는지로 판단해야 한다.

최종 구조는 처음보다 훨씬 직접적이다.

- 브라우저 UI는 Vite + React SPA다.
- 서버 기능은 Cloudflare Worker API다.
- DB 접근은 Worker request lifecycle 안에서만 열린다.
- admin 보안 경계는 `/api/admin/*`의 서버 권한 검사다.
- SEO는 1차 범위에서 sitemap, robots, manifest, 기본 meta로 제한한다.

이관을 마치고 나니 "Next.js가 나빴다"는 결론은 아니다. 문제는 용도와 규모에 비해 너무 많은 계층을 한 번에 가져온 것이었다. 알뜰맵은 지도 중심 SPA이고, 데이터는 API로 읽고 쓰며, 관리자도 같은 서비스의 운영 화면이다. 이런 서비스에는 Vite + React + Worker API처럼 경계가 노골적인 구조가 더 잘 맞는다.

처음부터 다시 만든다면 이렇게 시작할 것이다.

- `src/client`: React Router 기반 지도/상세/제보/admin UI
- `src/worker`: Hono API, auth, admin 권한, SEO route
- `src/worker/repositories`: public read/write, admin, auth, telemetry 분리
- `src/shared`: 브라우저에 들어가도 안전한 type과 schema만 배치
- `scripts`: contract smoke, deploy check, sitemap generation

가장 큰 교훈은 AI agent와 협업할수록 아키텍처를 단순하게 유지해야 한다는 점이다. agent는 많은 코드를 빠르게 바꿀 수 있지만, 런타임 경계가 흐릿하면 그 속도는 위험해진다. `client`, `worker`, `db`, `admin security boundary`가 명확하면 agent가 만든 변경도 검토하기 쉽고, 실패했을 때 원인을 좁히기 쉽다. 작은 프로젝트에서 단순한 구조는 취향이 아니라 운영 능력이다.
