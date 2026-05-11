# Vite로 옮겼는데도 코드가 다시 무거워졌다

> 이 글은 알뜰맵을 Next.js + OpenNext에서 Vite + React + Cloudflare Worker로 이관한 뒤, 다시 React 코드베이스를 점검하고 품질 하네스를 만든 과정을 정리한 회고다. 여기서 말하는 “100점”은 제품이 완벽하다는 뜻이 아니라, 내가 정한 React 코드 품질 하네스 기준을 모두 통과했다는 뜻이다.

## 마이그레이션은 끝났지만, 마음이 놓이지 않았다

Next.js에서 Vite + React로 이관한 뒤 알뜰맵은 훨씬 단순해졌다. 브라우저 UI는 `src/client`, 서버 API는 `src/worker`, 공용 도메인 타입과 로직은 `src/features`에 놓였다. `.next`, `.open-next`, OpenNext 변환 단계, public/admin split도 사라졌다.

겉으로 보면 성공이었다. 빌드는 빨라졌고, Cloudflare Worker 배포 경로도 직접적이었다. 지도, 상세, 가격 제보, 댓글, 신고, 북마크, 관리자 승인 흐름도 다시 붙었다.

그런데 코드베이스를 다시 열어보니 불안했다.

Vite로 옮기는 동안 급하게 만든 route, fallback, adapter, smoke script가 남아 있었다. 기능을 살리기 위해 만든 임시 경계가 실제 구조처럼 굳어질 조짐이 보였다. 특히 다음 세 가지가 계속 걸렸다.

```text
1. 관리자 화면은 다시 큰 route 파일로 자라고 있었다.
2. 지도 클러스터 회귀는 테스트가 아니라 감각으로 잡고 있었다.
3. CSP와 dead-code는 “언젠가 정리할 것”처럼 남아 있었다.
```

이 상태를 그대로 두면 Next.js에서 벗어난 의미가 줄어든다. 프레임워크는 가벼워졌지만, 코드가 다시 불명확해지면 유지보수 비용은 다른 모양으로 돌아온다.

특히 이 프로젝트는 1인 개발이고, 앞으로도 AI agent와 함께 작업한다. 내가 오늘 모든 맥락을 기억한다고 해도 다음 세션의 agent는 모른다. 그래서 목표를 “좋은 코드로 정리”처럼 추상적으로 두지 않고, 점수와 하네스로 고정하기로 했다.

## 내가 정한 품질 점수는 무엇인가

직접 `react-doctor`를 설치하거나 실행하지는 않았다. 대신 그 접근 방식처럼 React 프로젝트를 여섯 축으로 나누어 수동 평가했다.

```text
State & Effects
Architecture
Performance
Security
Accessibility
Dead Code / Hygiene
```

처음 기준선은 `74/100`이었다.

```text
State & Effects:       15/20
Architecture:          14/20
Performance:           15/20
Security:              16/20
Accessibility:         13/20
Dead Code / Hygiene:   11/20
Total:                 74/100
```

이 점수는 앱이 망가졌다는 뜻이 아니었다. 오히려 기능은 꽤 많이 돌아가고 있었다. 문제는 변경에 약하다는 점이었다. route 파일은 커지고 있었고, React 전용 lint는 부족했고, 성능은 측정만 할 뿐 실패 조건이 없었고, CSP와 dead-code는 수동으로 기억해야 했다.

그래서 이번 리팩터링의 완료 기준은 기능 추가가 아니라 다음 상태였다.

```text
lint/typecheck가 React와 접근성 회귀를 잡을 것
큰 route 파일이 작은 책임 단위로 나뉠 것
지도 interaction 성능이 threshold로 실패할 것
CSP inline style inventory가 0건일 것
unused export와 dead code 후보가 0건일 것
결과가 docs에 남아 다음 세션에서도 이어질 것
```

이 글에서 말하는 최종 점수는 이 기준을 만족했다는 뜻이다. 운영 장애가 절대 없다는 뜻도 아니고, 제품 성공 확률이 100%라는 뜻도 아니다.

## 첫 번째 사건: 카드처럼 보였지만 버튼은 아니었다

처음 잡힌 문제는 접근성이었다. `PlaceCard`와 `MobilePlaceListSheet`는 사용자가 보기에는 카드였다. 클릭도 됐다. 키보드 handler도 있었다.

하지만 HTML 관점에서는 애매했다. `article role="button"` 패턴에 가까웠고, 카드 내부에는 또 다른 버튼과 링크가 들어갈 수 있었다. 사람 눈에는 자연스러워도 브라우저와 보조기술 입장에서는 명확하지 않다.

기존 구조는 대략 이런 느낌이었다.

```tsx
<article role="button" onClick={openPlace} onKeyDown={handleKeyDown}>
  <h3>{place.name}</h3>
  <button type="button">북마크</button>
</article>
```

리팩터링 후에는 카드 전체를 억지로 버튼처럼 만들지 않고, 실제 interactive element를 분리했다.

```tsx
<article>
  <button type="button" onClick={openPlace}>
    <span>{place.name}</span>
  </button>
  <button type="button" aria-label="북마크 추가">
    북마크
  </button>
</article>
```

이 변경은 디자인을 바꾸는 작업이 아니었다. 사용자가 하던 행동은 유지하되, 브라우저가 이해하는 의미를 맞추는 작업이었다. `eslint-plugin-jsx-a11y`를 추가하고 나니 이런 문제가 더 이상 사람 기억에 의존하지 않게 됐다.

결과적으로 a11y warning은 8건에서 0건이 됐다.

여기서 배운 것은 단순하다.

```text
클릭 가능해 보이는 UI와
실제로 접근 가능한 UI는 다르다.
```

AI agent와 작업할수록 이런 차이는 더 중요하다. agent에게 “카드 클릭 UX 유지”라고만 말하면 `role="button"` 패턴을 다시 만들 수 있다. 하지만 lint가 실패하면 그 실수는 바로 드러난다.

## 두 번째 사건: AdminRoutes.tsx가 다시 괴물이 되고 있었다

가장 큰 구조 문제는 관리자 화면이었다. Vite 이관 직후 admin route는 다시 커지고 있었다. session gate, API helper, type, layout, page, card, filter, mutation handler가 한 파일에 모였다.

큰 파일은 처음에는 편하다. 한 파일만 열면 다 보이기 때문이다. 하지만 시간이 지나면 다른 문제가 생긴다.

```text
가격 제보 큐를 고치려는데 신고 필터가 같이 보인다.
신고 상태를 고치려는데 session gate가 같이 보인다.
API response type을 바꾸려는데 page layout도 같은 파일에 있다.
```

이런 구조는 1인 개발에서도 위험하지만, AI agent와 함께할 때 더 위험하다. agent는 파일 경계가 흐릴수록 근처 코드를 같이 건드린다. 작은 수정이 test id, import, type alias, mutation handler를 함께 흔들 수 있다.

그래서 admin을 책임 단위로 나눴다.

```text
AdminRoutes.tsx
→ route assembly만 담당

admin api helpers
→ fetch, response parsing, mutation helper

admin access/frame
→ session guard, layout shell

admin page modules
→ overview, places, prices, reports

admin hooks
→ loading/error/data refresh 경계
```

결과적으로 `AdminRoutes.tsx`는 1324줄 단일 파일에서 19줄 route assembly가 됐다.

이건 줄 수 자랑이 아니다. 중요한 것은 수정 경로가 좁아졌다는 점이다. 이제 가격 제보 큐를 고치려면 가격 제보 page와 hook, API helper를 보면 된다. 신고 화면을 고치려면 report page를 보면 된다. route assembly는 전체 연결만 담당한다.

이번에 확실히 느낀 것은 이것이다.

```text
작은 프로젝트라고 큰 파일이 괜찮은 것은 아니다.
팀원이 없을수록 파일 경계가 팀원 역할을 대신해야 한다.
```

## 세 번째 사건: effect를 줄이는 것이 아니라 경계를 드러내야 했다

Vite + React 앱은 SPA다. route component가 직접 fetch하고, loading/error/success 상태를 관리하는 일이 많다. 처음에는 이게 빠르다. 하지만 시간이 지나면 route component가 “작은 서버 컴포넌트”처럼 모든 일을 떠안는다.

처음에는 모든 fetch effect를 공용 hook으로 뽑고 싶었다. 하지만 그건 좋은 방향이 아니었다. 지도 viewport fetch는 단순 data loading이 아니다. zoom, bounds, debounce, abort, stale response guard, cluster focus lock이 묶인 도메인 로직이다. 이걸 generic hook으로 숨기면 오히려 이해하기 어려워진다.

그래서 원칙을 나눴다.

```text
session fetch, bookmark loading, admin list loading
→ route-specific hook으로 분리

지도 viewport sync
→ 도메인 로직으로 유지
→ 대신 abort/cancel/stale guard를 명확히 둠
```

나쁜 리팩터링은 반복을 보는 즉시 generic abstraction을 만드는 것이다.

```text
반복이 보인다
→ useFetchSomething으로 뽑는다
→ 도메인 의미가 사라진다
→ 예외가 늘어난다
```

이번에는 반대로 했다. 반복되는 상태 관리는 hook으로 옮기되, 지도처럼 제품 의미가 강한 effect는 숨기지 않았다. 리팩터링의 목표는 코드를 짧게 만드는 것이 아니라, 다음 수정자가 어느 레벨을 보고 있는지 헷갈리지 않게 만드는 것이었다.

## 네 번째 사건: 성능 테스트가 초록색인데 아무것도 검증하지 않았다

가장 위험한 문제는 지도 성능 테스트였다. 알뜰맵에서 실제로 사용자가 가장 민감하게 느끼는 흐름은 숫자 클러스터와 개별 장소 마커 전환이다. 사용자가 지도를 확대하면 숫자 클러스터가 place marker로 분해되어야 한다. 지도를 줄이면 다시 숫자 클러스터가 되어야 한다.

이 흐름이 깨지면 단순한 UI 버그가 아니다. 사용자는 보고 싶은 지역을 확대했는데도 계속 숫자만 보거나, 클러스터와 개별 마커가 겹쳐 보이거나, 지도 이동 후 검색 상태가 오래 유지되는 경험을 하게 된다. 지도 서비스에서 이런 문제는 곧 신뢰 문제다. “장소가 없는 것인지, 아직 로딩 중인지, 클러스터가 안 풀리는 것인지”를 사용자가 구분할 수 없기 때문이다.

그런데 기존 `perf:client`는 가장 중요한 cluster click path를 종종 skipped로 남겼다.

```text
map.initial_place_list_visible: 308ms
map.refresh_to_place_list_visible: 131ms
map.cluster_click_to_detail_or_marker_visible: skipped
admin.price_queue_visible: 184ms
```

테스트는 통과했지만, 내가 알고 싶은 것은 측정하지 않았다. 초록색 테스트가 오히려 착각을 만들고 있었다. “성능 테스트가 있다”는 사실보다 중요한 것은 “그 테스트가 실제로 사용자가 겪는 문제를 지나가는가”였다.

처음 테스트는 현재 화면에 cluster marker가 있으면 클릭하고, 없으면 skip했다. 하지만 fixture viewport에 cluster가 없으면 정작 회귀가 가장 자주 나는 경로를 매번 건너뛰었다.

그래서 deterministic cluster fixture를 만들었다.

```ts
const SEOUL_CLUSTER_QUERY =
  "/api/places/map?scope=viewport&zoom=9&minLat=37.4133&maxLat=37.7151&minLng=126.7341&maxLng=127.2693";
```

테스트는 먼저 이 query로 cluster payload를 가져온다. 그 다음 지도 refresh 요청을 한 번 가로채서 이 payload를 주입한다. 그리고 실제 viewport 안에 보이는 cluster marker를 찾아 클릭한다.

```ts
serveClusterFixtureOnce();
await page.getByTestId("map-refresh-button").click();
await expect(page.locator('[data-marker-kind="cluster"]').first()).toBeVisible();
await clickFirstViewportCluster(page);
```

이제 `perf:client`는 cluster click path를 skipped로 남기지 않는다. 네 가지 interaction이 모두 측정된다.

```text
map.initial_place_list_visible:                266ms / 1500ms
map.refresh_to_place_list_visible:             119ms / 1000ms
map.cluster_click_to_detail_or_marker_visible: 123ms / 1500ms
admin.price_queue_visible:                     191ms / 1500ms
```

3회 측정도 남겼다.

```text
1회차: 201ms, 123ms, 141ms, 210ms
2회차: 369ms, 131ms, 162ms, 226ms
3회차: 266ms, 119ms, 123ms, 191ms
```

이 수치보다 중요한 것은 테스트의 의미가 바뀐 것이다.

```text
Before: 현재 fixture에 cluster가 있으면 측정한다.
After: cluster fixture를 만들어서 반드시 측정한다.
```

다만 여기에도 한계는 있다. 현재 테스트는 클릭 후 marker가 보이는지 확인한다. 더 강하게 만들려면 클릭 전후 marker id 변화, API 재요청, selected cluster bounds, marker mode 전환까지 검증해야 한다. 그래서 이 부분은 “하네스 기준 개선”이지 “지도 UX 완전 정복”은 아니다.

이 한계를 글에 남기는 것도 중요했다. 점수를 올리는 과정에서 가장 위험한 것은 숫자가 좋아졌다는 이유로 실제 UX 리스크까지 사라졌다고 착각하는 것이다.

## 다섯 번째 사건: inline style 3건은 class로 지울 수 없었다

CSP 쪽 문제도 비슷했다. 처음 `npm run csp:inventory`를 돌렸을 때 findings는 12건이었다.

```text
src/features/map/naver-map-preview.tsx:        7건
src/features/map/naver-map-marker-visuals.ts: 5건
```

먼저 쉬운 것부터 줄였다. marker의 시각 스타일은 CSS class로 옮길 수 있었다. Naver SDK marker HTML 문자열과 local preview marker가 같은 class 체계를 쓰게 만들었다. 이렇게 해서 12건은 7건, 다시 3건까지 줄었다.

문제는 마지막 3건이었다. local fallback preview map에서 tile과 marker의 좌표를 런타임 값으로 넣는 부분이었다.

```tsx
<img
  src={tile.url}
  className="absolute h-64 w-64"
  style={{
    left: tile.left,
    top: tile.top,
  }}
/>
```

이건 단순 class로 바꿀 수 없다. 좌표는 실행 중 계산된다. CSS variable을 쓰거나 동적 stylesheet를 만들 수도 있었지만, 그건 strict CSP를 향한 개선이라기보다 검사 우회에 가까웠다.

그래서 렌더링 모델을 바꿨다.

```tsx
<svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}>
  {tiles.map((tile) => (
    <image
      key={tile.key}
      href={tile.url}
      x={tile.left}
      y={tile.top}
      width={LOCAL_FALLBACK_TILE_SIZE}
      height={LOCAL_FALLBACK_TILE_SIZE}
    />
  ))}
</svg>
```

marker도 absolute positioned button 대신 SVG `foreignObject` 안에 넣었다.

```tsx
<foreignObject
  x={left - visual.width / 2}
  y={top - visual.height}
  width={visual.width}
  height={visual.height}
>
  <button type="button" data-marker-kind="place">
    ...
  </button>
</foreignObject>
```

이 방식의 장점은 명확했다.

```text
좌표는 SVG attribute가 담당한다.
상호작용은 HTML button이 유지한다.
test id와 data-marker-kind도 유지한다.
React inline style은 사라진다.
```

결과적으로 `csp:inventory`는 0건이 됐다.

```text
before: 12
middle: 7
middle: 3
after:  0
```

중요한 제한도 있다. `public/_headers`와 Worker security header에는 아직 `style-src 'unsafe-inline'`이 남아 있다. 이유는 Naver Maps SDK 같은 외부 지도 런타임이 inline style을 만들 수 있기 때문이다.

그래서 이 결과는 이렇게 표현해야 정확하다.

```text
앱 코드 inventory 기준 inline style blocker: 0건
운영 strict CSP enforcement: 별도 Report-Only 검증 필요
```

점수는 위험하다. 숫자는 결론처럼 보이기 때문이다. 그래서 이 글에서도 최종 점수의 범위를 계속 제한했다.

## 여섯 번째 사건: unused export는 AI agent에게 잘못된 길을 만든다

마지막 감점은 dead code와 export hygiene이었다. `knip`을 붙여 `npm run hygiene:dead-code`를 만들자 여러 후보가 나왔다.

```text
Unused devDependencies:
- tailwindcss

Unused exports:
- map query 내부 helper
- auth label map
- marker visual theme
- geocodeAddress
- share helper 일부
- report status map
- rate limit 내부 함수
- worker auth/db/public-write helper 일부

Duplicate exports:
- placeSubmissionFormSchema / placeSubmissionSchema
```

여기서 중요한 것은 “나온 것을 전부 삭제”가 아니었다. 먼저 분류해야 했다.

```text
실제 미사용 legacy helper
→ 제거

파일 내부에서만 쓰는 helper
→ export 제거

도구가 추적하지 못하는 의도적 의존성
→ knip config에 명시
```

예를 들어 Tailwind CSS는 JS에서 import하지 않는다. `src/client/styles.css`에서 `@import "tailwindcss"`로 사용한다. knip 입장에서는 unused devDependency처럼 보일 수 있지만 실제로는 필요하다. 그래서 `knip.json`에 명시적으로 분리했다.

반대로 `geocodeAddress`, 일부 share helper, report status helper는 현재 경로에서 쓰이지 않았다. 이런 export는 “나중에 쓸 수도 있다”는 이유로 남기기 쉽다. 하지만 AI agent와 작업할 때 unused export는 더 위험하다. agent는 이름이 그럴듯한 함수를 보면 실제 사용 맥락과 상관없이 재사용하려고 할 수 있다.

그래서 필요 없는 export를 줄였다.

```text
export는 미래의 약속이다.
필요 없는 export는 필요 없는 public API다.
```

최종적으로 `npm run hygiene:dead-code` 출력은 0건이 됐다.

## 점수표보다 중요한 것은 실패 조건이다

최종 점수는 이렇게 바뀌었다.

```text
Before
State & Effects:       15/20
Architecture:          14/20
Performance:           15/20
Security:              16/20
Accessibility:         13/20
Dead Code / Hygiene:   11/20
Total:                 74/100

After
State & Effects:       20/20
Architecture:          20/20
Performance:           20/20
Security:              20/20
Accessibility:         20/20
Dead Code / Hygiene:   20/20
Total:                 100/100
```

하지만 점수표 자체가 가장 중요한 결과는 아니다. 더 중요한 것은 실패 조건이 생긴 것이다.

```bash
npm run verify
npm run csp:inventory
npm run hygiene:dead-code
npm run perf:client
npm run map:measure
npm run test:e2e:smoke
git diff --check
```

이제 다음 변경에서 다음 일이 벌어지면 바로 드러난다.

```text
접근성 semantic이 깨진다
→ lint 실패

inline style이 다시 생긴다
→ csp:inventory 실패

unused export가 늘어난다
→ hygiene:dead-code 출력 발생

지도 interaction이 느려진다
→ perf:client budget 실패

지도 API p95가 튄다
→ map:measure에서 확인
```

AI agent와 협업할수록 이 차이가 중요하다. “좋은 코드로 만들어줘”는 너무 추상적이다. 반면 “이 명령들이 실패하지 않게 만들어줘”는 구체적이다. agent는 실패 조건이 있을 때 훨씬 안정적으로 일한다.

## 점수를 말할 때 조심해야 한다

이번 글에서 가장 조심스러운 표현은 점수다. 특히 100점이라는 말은 강하다. 잘못 쓰면 과장처럼 보인다.

그래서 나는 이 점수를 이렇게 제한한다.

```text
React 코드 품질 하네스 기준 통과
```

아직 남은 운영 리스크는 있다.

```text
Naver Maps SDK runtime까지 포함한 strict CSP Report-Only 검증
Kakao/Naver OAuth live callback 확인
실제 모바일 기기 지도 제스처 QA
클러스터 클릭 후 상태 전환을 더 강하게 보는 테스트
데이터 품질, 오래된 가격, 중복 장소 병합 정책
```

즉 다음 등식은 성립하지 않는다.

```text
코드 품질 하네스 통과
≠ 운영 품질 완성
≠ 제품 성공 확률 100%
```

이 리팩터링이 해결한 것은 “앞으로 고치기 쉬운 코드인가”에 가깝다. 제품이 성공하려면 데이터 밀도, 가격 신뢰도, 운영 정책, 실제 사용자 피드백이 계속 필요하다.

## 다음 프로젝트에서는 처음부터 이렇게 할 것이다

이번 작업을 다시 한다면, Vite + React 앱을 만들 때 처음부터 다음 기준을 깔 것이다.

```text
1. client/server/shared 경계를 import 규칙으로 지킨다.
2. React Hooks, React Refresh, JSX a11y lint를 초기에 켠다.
3. admin은 처음부터 route assembly와 page/hook/api를 분리한다.
4. 지도 interaction은 smoke와 perf budget을 동시에 둔다.
5. CSP inventory와 dead-code checker를 초반부터 둔다.
6. 테스트는 성공 여부뿐 아니라 “무엇을 증명하지 않는지”도 문서화한다.
7. 코드 품질 점수와 운영 완전성을 절대 섞지 않는다.
```

작은 프로젝트라고 이런 하네스가 과한 것은 아니다. 오히려 작을수록 필요하다. 팀원이 없고, 미래의 내가 모든 맥락을 기억하지 못하며, AI agent가 다음 변경을 할 수 있기 때문이다.

Vite + React로 옮긴 것은 구조를 단순하게 만든 결정이었다. 이번 품질 리팩터링은 그 단순함이 다시 무너지지 않게 난간을 세운 작업이었다.

## 결론

Next.js에서 Vite + React로 옮기면 많은 계층이 사라진다. 하지만 계층이 줄어든다고 자동으로 좋은 코드가 되는 것은 아니다. route가 커지고, effect가 섞이고, 테스트가 감각에 의존하면 복잡도는 다시 자란다.

이번 리팩터링은 그 복잡도가 다시 자라기 전에 기준선을 세운 작업이었다.

```text
큰 파일을 작게 나눈다.
접근성은 lint로 잡는다.
지도 성능은 숫자로 본다.
CSP와 dead-code는 inventory로 관리한다.
AI agent에게는 추상적 지시보다 실패 조건을 준다.
```

가장 중요한 교훈은 이것이다.

```text
아키텍처를 단순하게 바꾸는 것과
단순한 상태를 계속 유지하는 것은 다른 일이다.
```

Vite + React는 알뜰맵에 더 맞는 구조였다. 하지만 앞으로도 이 구조가 가볍게 유지되려면, 기능을 추가할 때마다 같은 기준으로 다시 점검해야 한다.
