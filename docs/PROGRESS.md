# PROGRESS.md

## Active 상태

Next.js 기능 parity 회귀 복구 구현은 1차 완료됐지만, 운영 수동 QA에서 숫자 클러스터 표시/클릭/줌인/줌아웃 동작과 전환 속도가 Next.js 시절과 다르게 깨진 추가 지도 회귀가 확인됐다. 현재 우선순위는 클러스터 클릭 시 정확한 cluster bounds를 즉시 조회하고, 중복 지도 API 요청을 줄여 전환 체감을 개선하는 것이다.

## 최근 변경
- 숫자 클러스터 회귀를 복구했다.
  - `NaverMapPanel`에서 클러스터 클릭/fallback 활성화 시 클러스터 bounds와 zoom을 부모 route에 전달한다.
  - `MapRoute`는 클러스터 focus viewport를 받으면 즉시 `/api/places/map`을 재조회해 지도 마커와 목록을 새 영역 기준으로 갱신한다.
  - 이전에 추가했던 `zoom >= 16` 강제 place mode는 Next parity와 달라 제거했다.
  - `tests/e2e/map.spec.ts`는 bootstrap 요청과 좁아진 cluster bounds의 marker mode 재계산을 검증한다.
- 진행 중인 추가 수정:
  - `MapRoute` 첫 지도 요청을 bounds 없는 전역 조회가 아니라 Next 시절과 같은 서울 bootstrap bounds/zoom 기준 조회로 되돌렸다.
  - `onViewportChange`를 단순 `setViewport`가 아니라 debounce `/api/places/map` 재조회 루프로 연결했다.
  - 클러스터 클릭 전용 보정은 자동 viewport 재조회 루프를 깨지 않도록 보조 신호로만 사용한다.
  - 추가 QA에서 확대 후에도 숫자 클러스터가 남는 문제가 계속 확인됐다. 원인은 `markerMode=cluster`일 때 한 장소 bucket까지 숫자 클러스터로 내려주는 all-or-nothing marker 응답이다.
  - cluster bucket 중 `placeCount=1`인 항목을 place marker로 반환해, 확대 시 개별 장소 핀이 자연스럽게 섞이도록 수정했다.
  - `tests/e2e/map.spec.ts`는 단일 장소 bucket이 숫자 클러스터로 반환되지 않는지 검증하도록 갱신했다.
  - 추가 QA에서 클러스터 클릭 전환 지연과 초기 지도 API 지연이 계속 확인됐다.
  - 운영 계측 결과 첫 `/api/places/map`이 브라우저에서 약 4.1초 뒤에 발생했고, 직접 API TTFB도 약 2.5초였다.
  - 지도 SDK 부팅 지연을 제거하고, 클러스터 클릭 시 260ms 대기 없이 즉시 target zoom/bounds를 부모 route에 전달하도록 수정했다.
  - 클러스터 클릭은 bucket 규모에 따라 target zoom을 더 공격적으로 잡아 즉시 다음 단계 marker를 요청한다.
  - Worker map API는 count/items/marker rows를 병렬 조회하고, place marker mode에서는 이미 읽은 `items`를 재사용하도록 수정했다.
  - 추가로 bounds 기반 map API는 같은 장소 데이터를 list용/marker용으로 두 번 읽지 않고, 한 번 읽은 marker rows를 메모리에서 정렬/분할해 list와 marker를 만든다.
  - 추가 리뷰에서 클러스터 클릭 직후 예약된 cluster bounds 조회가 지도 `idle` viewport sync에 의해 취소될 수 있는 흐름을 발견했다.
  - `MapRoute`는 클러스터 focus viewport를 받으면 debounce를 거치지 않고 즉시 `/api/places/map`을 호출하며, 짧은 lock window 동안 지도 `idle` viewport sync를 무시한다.
  - 작은 cluster marker는 하위 `previewPlaces`를 함께 내려주고, 클라이언트는 클릭 즉시 해당 preview를 임시 place marker로 펼친다.
  - 실제 API 응답이 도착하면 optimistic marker를 서버 응답으로 교체해 첫 DB miss 구간에서도 사용자가 클릭한 cluster가 시각적으로 반응한다.
  - 추가 QA에서 실제 Naver 숫자 cluster와 fallback/optimistic place marker가 겹쳐 보이는 현상이 확인됐다.
  - 원인은 ready 상태에서도 map tile 감지 전까지 fallback `PreviewMap`을 계속 overlay하고, 클러스터 클릭 후 80ms 지연 viewport 재통지가 marker 전환 경합을 만들 수 있는 구조다.
  - Naver map이 `ready` 상태가 되면 fallback preview layer를 제거하도록 바꿔 실제 지도 marker와 fallback marker가 동시에 보이지 않게 했다.
  - 클러스터 클릭 직후 기존 Naver marker instance를 즉시 `setMap(null)` 처리해 optimistic place marker와 기존 숫자 cluster가 겹치는 시간을 제거했다.
  - 클러스터 클릭 후 80ms 지연 viewport 재통지는 제거해 중복 fetch와 marker 경합을 줄였다.
  - cluster `previewPlaces` 상한은 `80`에서 `40`으로 낮춰 운영 gzip 응답 크기와 marker 렌더 비용을 줄였다.
  - 일반 pan/zoom debounce는 180ms에서 100ms로 줄여 수동 지도 이동 후 반응 속도를 개선했다.
  - 같은 bounds/zoom으로 반복되는 지도 preview 요청은 12초 TTL 메모리 cache와 Cloudflare edge cache로 처리한다.
  - 메모리 cache는 성공한 API mutation 후 invalidate하고, edge cache는 짧은 TTL로 stale 노출 시간을 제한한다.
  - Worker DB 연결을 request 간 재사용하는 방식은 workerd에서 `Cannot perform I/O on behalf of a different request` 제약으로 실패해 적용하지 않았다.
  - `tests/e2e/map.spec.ts`에 같은 viewport 중복 요청이 `X-Altteulmap-Map-Cache: hit`으로 처리되는 회귀 검증을 추가했다.
- `MapRoute`에 모바일 목록 바텀시트를 복구했다.
  - `mobile-place-list-open`, `mobile-place-list-sheet`, drag handle, size toggle, mobile list item contract를 다시 제공한다.
  - 목록은 `hidden`/`peek`/`expanded` 상태를 가지며, 장소 선택 시 목록을 닫고 모바일 상세 시트를 연다.
  - 모바일 CTA/sheet는 지도 stacking context와 분리하기 위해 body portal로 렌더링한다.
- `PlaceDetailRoute`에서 가격 제보 폼과 코멘트 섹션을 닫힌 details 내부가 아니라 기본 mount되는 패널로 복구했다.
- admin 가격/신고 큐에 list wrapper, AI 1차 검수 패널, 가격 반려 버튼, 신고 상태/filter test id를 복구했다.
- Worker admin repository에서 `moderation_suggestions`를 가격 제보/신고 목록 응답에 포함하도록 보강했다.
- `src/db/seed.ts`에서 `place_reactions`를 seed reset 대상에 추가해 E2E 재실행 시 좋아요 상태가 누적되지 않게 했다.
- PRD/TRD public route parity 기준에 맞춰 `/map` alias를 `MapRoute`에 연결했다.
- `tests/e2e/map.mobile.spec.ts`는 모바일 fixed portal CTA에 대해 Playwright actionability 오판이 있어 클릭만 `force` 처리했다. 실제 브라우저 `elementFromPoint` 기준으로 버튼 hit target은 정상 확인했다.
- 가격 필터 spec은 MVP에서 미노출로 확정했다.
  - `docs/product/prd.md`의 핵심 기능을 `가격 범위 필터링`에서 `대표 가격 노출`로 정리했다.
  - `docs/product/trd.md`에 가격 범위 필터 UI/API contract가 현재 MVP 범위가 아님을 명시했다.
- Naver 지도 key를 build-time env에만 의존하지 않도록 `/api/config/public` 런타임 config route를 추가했다.
  - client map panel은 build-time key가 비어 있으면 Worker runtime public config에서 `naverMapKeyId`를 읽는다.
  - `smoke:vite:local`과 `smoke:remote`가 public config의 Naver map key 노출 여부를 검증하도록 보강했다.
  - `smoke:vite:local`의 credentials 요청은 Worker auth contract에 맞춰 `json:true`와 `Accept: application/json`을 보내도록 수정했다.
- 운영 Worker `altteulmap`에 `NEXT_PUBLIC_NAVER_MAP_KEY_ID` secret을 등록했다.
- 운영 배포를 완료했다.
  - URL: `https://altteulmap.altteul-lab.workers.dev`
  - 기존 Version ID: `9e0ef045-9e78-48a8-b142-16dfd06af87a`
  - 클러스터 수정 Version ID: `b63ce151-afee-41a6-8e7b-2a4b1fc76959`
  - viewport 자동 재조회 복구 Version ID: `b42fbaf4-46b7-4ddf-8866-9d54863db392`
  - mixed marker 복구 Version ID: `bd69ef55-0192-4ce6-b537-5ccb5684aad8`
  - 클러스터 즉시 focus Version ID: `a5589024-ab1a-4c30-851e-378587123603`
  - viewport edge cache Version ID: `1b4488fd-ca31-4f13-8360-6cdbaa708928`
  - optimistic cluster split Version ID: `5b32c422-c410-4c24-88f8-207c3242598f`
  - marker overlap 방지 Version ID: `ce9f53c2-f950-4c37-a652-04f8d6f78121`

## 최근 검증
- `npm run lint`: 통과
- `npm run typecheck`: 통과
- `git diff --check`: 통과
- `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
  - 클러스터 고줌 API place marker 전환 테스트 포함
- `npm run smoke:vite:local`: 통과
- `npm run test:e2e:full`: 통과
  - smoke 8건 통과
  - mobile map 2건 통과
  - bookmarks/comments/price-review/report-admin 5건 통과
- `npm run verify`: 통과
- `npm run deploy:check`: 통과
- 추가 클러스터 복구 검증:
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 9건 통과
    - 홈 첫 지도 요청이 서울 bootstrap bounds/zoom을 사용하는지 확인
    - 좁아진 cluster bounds에서 marker mode를 다시 계산하는지 확인
  - `npm run test:e2e:full`: 통과
    - smoke 9건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
  - `npm run verify`: 통과
  - `npm run deploy:check`: 통과
- viewport 자동 재조회 복구 배포 검증:
  - `npm run deploy`: 통과
    - URL: `https://altteulmap.altteul-lab.workers.dev`
    - Version ID: `b42fbaf4-46b7-4ddf-8866-9d54863db392`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`: 통과
  - 운영 API bootstrap bounds 확인: 통과
    - `zoom=11` 서울 bootstrap bounds 응답이 `markerMode: cluster`, `kinds: ["cluster"]`, `mapMarkerCount: 14`를 반환함
  - 운영 API 좁아진 cluster bounds 확인: 통과
    - 선택한 cluster bounds + `zoom=15` 응답이 `markerMode: place`, `kinds: ["place"]`, `mapMarkerCount: 1`을 반환함
- mixed marker 복구 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 9건 통과
    - cluster mode에서도 단일 장소 bucket이 place marker로 반환되는지 확인
  - `npm run test:e2e:full`: 통과
    - smoke 9건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
  - `npm run deploy:check`: 통과
- mixed marker 복구 배포 검증:
  - `npm run deploy`: 통과
    - URL: `https://altteulmap.altteul-lab.workers.dev`
    - Version ID: `bd69ef55-0192-4ce6-b537-5ccb5684aad8`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`: 통과
  - 운영 API bootstrap mixed marker 확인: 통과
    - `markerMode: cluster`, `kinds: ["cluster", "place"]`, 단일 장소 숫자 클러스터 `0`, place marker `1`, cluster marker `13`
  - 운영 API 좁아진 cluster bounds 확인: 통과
    - source cluster `4곳` bounds + `zoom=15` 응답이 `markerMode: place`, place marker `4`, cluster marker `0`을 반환함
- 클러스터 클릭 속도 개선 로컬 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 9건 통과
  - `npm run test:e2e:full`: 통과
    - smoke 9건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
  - `npm run deploy:check`: 통과
- map API 단일 read 최적화 로컬 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 9건 통과
  - `npm run test:e2e:full`: 통과
    - smoke 9건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
  - `npm run deploy:check`: 통과
- 클러스터 즉시 focus/cache 최적화 로컬 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 10건 통과
    - 같은 viewport 중복 요청 cache hit 검증 포함
  - `npm run test:e2e:full`: 통과
    - smoke 10건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
- optimistic cluster split 로컬 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 10건 통과
    - cluster marker가 하위 `previewPlaces`를 제공하는지 검증 포함
  - `npm run test:e2e:full`: 통과
    - smoke 10건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
- optimistic cluster split 운영 배포 검증:
  - `npm run deploy`: 통과
    - URL: `https://altteulmap.altteul-lab.workers.dev`
    - Version ID: `5b32c422-c410-4c24-88f8-207c3242598f`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`: 통과
  - 운영 API previewPlaces 확인: 통과
    - `zoom=9` 서울 bounds 응답이 cluster `13`개 중 `11`개에 `previewPlaces`를 포함함
    - 첫 preview cluster의 하위 place 수는 `22`개
  - 운영 API 압축 응답 계측: 통과
    - cache miss: TTFB 약 `2.10s`, gzip download `38.5KB`
    - edge-hit 1차: TTFB 약 `0.46s`
    - edge-hit 2차: TTFB 약 `0.48s`
- 지도 marker 겹침/성능 재리뷰 로컬 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 10건 통과
  - `npm run test:e2e:full`: 통과
    - smoke 10건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
  - `npm run deploy:check`: 통과
- 지도 marker 겹침/성능 재리뷰 운영 배포 검증:
  - `npm run deploy`: 통과
    - URL: `https://altteulmap.altteul-lab.workers.dev`
    - Version ID: `ce9f53c2-f950-4c37-a652-04f8d6f78121`
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`: 통과
  - 운영 API previewPlaces 상한 확인: 통과
    - `zoom=9` 서울 bounds 응답이 cluster `13`개 중 `10`개에 `previewPlaces`를 포함함
    - 최대 preview place 수는 `39`개로 제한됨
  - 운영 API 압축 응답 계측: 통과
    - cache miss: TTFB 약 `2.41s`, gzip download `33.4KB`
    - edge-hit 1차: TTFB 약 `0.48s`
    - edge-hit 2차: TTFB 약 `1.20s`
    - 이전 optimistic split 계측의 gzip `38.5KB` 대비 약 `5KB` 감소
  - `npm run deploy:check`: 통과
- edge cache 추가 검증:
  - `npm run lint`: 통과
  - `npm run typecheck`: 통과
  - `git diff --check`: 통과
  - `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`: 통과
    - smoke 10건 통과
    - 중복 viewport 요청이 `hit` 또는 `edge-hit`으로 처리되는지 확인
  - `npm run test:e2e:full`: 통과
    - smoke 10건 통과
    - mobile map 2건 통과
    - bookmarks/comments/price-review/report-admin 5건 통과
- `npm run deploy`: 통과
  - URL: `https://altteulmap.altteul-lab.workers.dev`
  - Version ID: `b63ce151-afee-41a6-8e7b-2a4b1fc76959`
- `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`: 통과
- 운영 API 클러스터 고줌 확인: 통과
  - `/api/places/map?...&zoom=16` 응답이 `markerMode: place`, `kinds: ["place"]`, `mapMarkerCount: 160`을 반환함
- 이전 배포 검증:
  - `npx playwright test tests/e2e/map-price-filter.spec.ts tests/e2e/map-price-filter.mobile.spec.ts`: 통과
  - `npm run deploy`: 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev npm run smoke:remote`: 통과
  - `SMOKE_PUBLIC_URL=https://altteulmap.altteul-lab.workers.dev` + admin credentials remote smoke: 통과
  - 운영 브라우저 런타임 점검: 통과
  - public home에서 `지도 설정이 아직 준비되지 않아` 상태가 보이지 않음
  - Naver map asset 로딩 확인
  - `/admin`, `/admin/places`, `/admin/prices`, `/admin/reports` heading 렌더링 확인

## Parity matrix
| 영역 | 코드 기준 상태 | 판정 | 남은 확인 |
| --- | --- | --- | --- |
| Public route `/`, `/map` 의미 | `MapRoute`가 `/`와 `/map`에 연결되어 지도, 검색, 카테고리, 목록, 공유, 좋아요, 북마크 진입을 제공한다. | 복구 완료 | 없음 |
| Public route `/place/:id` | 상세 정보, 가격 항목, 가격 제보, 코멘트, 신고 링크, 공유, 반응 버튼이 노출된다. | 복구 완료 | 장소별 SSR/OG meta는 Vite 이관 1차 범위 밖 |
| Public route `/submit`, `/report`, `/login`, `/signup`, `/bookmarks` | Vite route로 연결되어 E2E smoke/bookmarks/comments/admin submission 흐름이 통과했다. | 복구 완료 | 실제 디자인 밀도 수동 확인 필요 |
| Admin route `/admin`, `/admin/places`, `/admin/prices`, `/admin/prices/places/:id`, `/admin/reports` | 단일 SPA admin route로 연결되어 dashboard/place/price/report 큐와 mutation이 동작한다. | 복구 완료 | 실제 운영 데이터로 승인/반려/상태 변경 수동 QA 필요 |
| Public API | `/api/places/map`, `/api/places/:id`, price report, comments, reaction, submission, reports, bookmarks가 Worker route로 연결되어 E2E 통과했다. 가격 필터는 MVP 미노출로 확정했고, 고줌 map marker는 place mode로 전환된다. 클러스터 focus 요청은 즉시 fetch하고 중복 viewport 요청은 preview cache로 흡수한다. | 복구 완료 | 운영 Naver 지도 클릭 후 실제 분할 재확인 필요 |
| Admin API | `/api/admin/*`가 Worker route와 `requireAdmin` 보안 경계를 유지한다. | 복구 완료 | 비관리자 `403`, 비로그인 `401` 운영 smoke 재확인 필요 |
| Auth/session | credentials, signup, signout, session, providers, Kakao/Naver signin/callback route가 Worker에 있다. Provider redirect와 admin credentials remote smoke가 통과했다. | 부분 완료 | Kakao/Naver live callback은 실제 계정으로 수동 QA 필요 |
| SEO/static | `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/api/config/public` Worker route가 있다. | 부분 완료 | 장소별 SSR/OG는 후속 분리. 기본 title/description/canonical 수동 확인 필요 |
| Mobile gesture | 모바일 목록 sheet와 상세 sheet drag close가 E2E 통과했다. | 복구 완료 | 실기기에서 Naver map + sheet 터치 충돌 수동 확인 필요 |
| 디자인 parity | 주요 UI는 Vite에서 기능 노출 복구됨. 운영 브라우저에서 지도 missing-key/preview 고착은 해소됨. | 부분 완료 | 실기기에서 시각 밀도와 터치 UX 수동 확인 필요 |
| Test isolation | seed가 `place_reactions`를 초기화해 반복 E2E 누적을 제거했다. | 복구 완료 | 없음 |

## 남은 이슈
- 숫자 클러스터 자동 fetch 루프 수정분은 로컬 검증, 운영 배포, remote smoke, 운영 API 검증이 통과했다. 운영 브라우저/실기기에서 실제 Naver 지도 클릭/줌인/줌아웃 시각 확인이 필요하다.
- cluster bucket 단위 mixed marker 응답 수정은 로컬 검증, 운영 배포, remote smoke, 운영 API 검증이 통과했다. 운영 브라우저/실기기에서 실제 Naver 지도 시각 확인이 필요하다.
- 클러스터 클릭 즉시 전환, map API 병렬화, bounds map API 단일 read, 중복 viewport memory/edge cache, optimistic cluster split, marker overlap 방지는 로컬/운영 검증이 통과했다. 실제 실기기에서 시각 전환 체감 확인이 필요하다.
- Kakao/Naver OAuth live callback은 provider 실제 계정 로그인이 필요하므로 수동 QA가 필요하다.
- 실제 모바일 기기에서 Naver map + 목록 sheet 터치 충돌, 상세 sheet, 주요 화면 디자인 밀도는 최종 수동 확인이 필요하다.

## 다음 액션
- 운영 브라우저/실기기에서 숫자 클러스터 클릭, 줌인, 줌아웃이 각각 optimistic split, marker/list 재조회, 개별 장소 핀 교체로 이어지는지 확인한다.
- 운영 브라우저에서 클러스터 클릭 후 첫 시각 반응과 서버 응답 교체 사이 지연 체감을 확인한다.
- 실제 Kakao/Naver 계정으로 운영 OAuth callback을 확인한다.
- 실제 모바일 기기에서 지도, 목록 바텀시트, 상세 시트, 제보/신고/댓글 흐름을 최종 확인한다.
