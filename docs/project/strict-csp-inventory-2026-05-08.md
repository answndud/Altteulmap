# Strict CSP 전환 준비 리포트

기준일: 2026-05-08

## 결론
- 지금 바로 `style-src 'unsafe-inline'`을 제거하면 지도 fallback marker와 Naver Maps marker가 깨질 가능성이 높다.
- 단순 inline style 4건은 `MapRoute`에서 class 기반으로 제거했다.
- 남은 blocker는 모두 `src/features/map/naver-map-panel.tsx`와 `src/features/map/naver-map-marker-visuals.ts`의 지도 marker/preview 동적 style이다.
- strict CSP 전환은 marker 렌더링 방식을 먼저 바꾼 뒤 `Content-Security-Policy-Report-Only`로 검증하고, 마지막에 enforcement로 전환해야 한다.

## 현재 CSP
현재 적용 위치:
- `src/worker/index.ts`
- `public/_headers`

현재 style 정책:

```text
style-src 'self' 'unsafe-inline'
```

Turnstile/Naver Maps 때문에 유지해야 하는 외부 출처:
- `script-src`: Naver Maps SDK, PStatic, Turnstile
- `connect-src`: Naver/Carto/Turnstile
- `frame-src`: Turnstile
- `img-src`: `https:`, `data:`, `blob:`

## Inventory
명령:

```bash
npm run csp:inventory
```

결과:
- 총 12건
- `src/features/map/naver-map-panel.tsx`: 7건
- `src/features/map/naver-map-marker-visuals.ts`: 5건
- `src/worker/index.ts`, `public/_headers`: 둘 다 `unsafe-inline` 유지 중

## 제거 완료
`src/client/routes/MapRoute.tsx`의 단순 inline style은 class로 치환했다.

제거한 항목:
- 모바일 목록 open button wrapper `zIndex`
- 모바일 목록 sheet `zIndex`
- 모바일 목록 크기 toggle `pointerEvents`
- 모바일 장소 list item `pointerEvents`

이 항목들은 Tailwind arbitrary class와 기존 `pointer-events-auto`로 대체 가능했고, 동작 의미가 바뀌지 않는다.

## 남은 Blocker
### Local fallback map preview
파일: `src/features/map/naver-map-panel.tsx`

남은 style 유형:
- fallback tile `left/top`
- preview cluster marker `top/left/width/height`
- preview place marker `top/left/zIndex/transform`
- marker 내부 badge/tail 크기, 색상, shadow, font size

판단:
- fallback preview는 실제 Naver SDK가 없거나 실패할 때의 안전 장치다.
- marker 좌표와 크기가 데이터/viewport/zoom에 따라 바뀌므로 단순 class 치환만으로는 부족하다.
- 완전 제거하려면 CSS variable style도 금지해야 하므로, HTML/CSS layout marker 대신 SVG/data URL 또는 canvas 기반 렌더링으로 바꾸는 편이 더 안전하다.

### Naver Marker HTML
파일: `src/features/map/naver-map-marker-visuals.ts`

남은 style 유형:
- `createPlaceMarkerIconHtml`
- `createClusterIconHtml`
- Naver `Marker` icon `content` 문자열 내부 inline style

판단:
- 이 영역이 strict CSP의 핵심 blocker다.
- Naver marker icon `content`가 HTML 문자열이라 inline style을 제거하지 않으면 `style-src 'unsafe-inline'` 제거가 불가능하다.
- class 기반 HTML 문자열로 바꾸려면 marker CSS가 Naver marker overlay DOM까지 확실히 적용되는지 live 지도에서 검증해야 한다.
- 더 안정적인 방향은 marker HTML 문자열을 SVG data URL 기반 icon으로 바꾸는 것이다. 현재 `img-src data:`는 이미 허용되어 있다.

## 권장 전환 전략
### Phase 1. 자동 inventory 유지
- `npm run csp:inventory`를 수동 검증 루틴에 포함한다.
- 신규 inline style이 지도 marker 외 영역에 생기면 PR/커밋 전 제거한다.

### Phase 2. Marker icon SVG 전환 PoC
- `createPlaceMarkerIconHtml`과 `createClusterIconHtml`을 SVG string/data URL icon 생성 함수로 대체한다.
- Naver marker는 HTML `content` 대신 image icon URL 또는 SVG data URL을 사용한다.
- local fallback preview도 동일한 marker visual helper를 SVG 또는 CSS class 최소 구조로 재사용한다.
- 목표는 marker 시각/클릭/anchor/cluster 전환 parity 유지다.

### Phase 3. Report-only CSP
Worker response에 `Content-Security-Policy-Report-Only`를 추가해 실제 운영 흐름에서 위반을 수집한다.

초기 report-only 후보:

```text
style-src 'self'
```

주의:
- report endpoint를 Worker API로 직접 받을지, Cloudflare Logs/Sentry로 받을지 먼저 정해야 한다.
- 사용자 유입 전에는 로컬/운영 수동 QA + browser console 위반 확인으로 시작해도 된다.

### Phase 4. Enforcement 전환
다음 조건을 만족할 때만 `style-src 'unsafe-inline'`을 제거한다.

- `npm run csp:inventory` 결과가 0건이거나 허용된 false positive만 남는다.
- Naver live map에서 place marker, cluster marker, current location marker가 정상 표시된다.
- local fallback map preview에서 tile/marker 위치가 정상이다.
- Turnstile widget이 정상 표시된다.
- OAuth redirect/login/logout 흐름이 정상이다.
- `npm run smoke:vite:local`, targeted map E2E, live mobile QA가 통과한다.

## 검증 계획
자동:

```bash
npm run csp:inventory
npm run typecheck
npm run lint
npm run smoke:vite:local
npm run deploy:check:vite
git diff --check
```

수동:
- 실제 Naver 지도 로딩
- 숫자 cluster 표시/클릭/줌 전환
- place marker 표시/클릭
- current location marker
- Turnstile widget 표시
- Kakao/Naver OAuth redirect
- 모바일 Safari/Chrome 지도 조작

## 다음 액션
- strict CSP enforcement는 이번 단계에서 적용하지 않는다.
- 다음 구현 작업으로는 `naver-map-marker-visuals.ts`의 HTML inline style marker를 SVG data URL icon으로 바꾸는 PoC를 진행한다.
- PoC가 성공하면 local fallback preview style 제거와 CSP report-only를 이어서 진행한다.
