# PROGRESS.md

## Active 상태

Next.js 기능 parity 회귀 복구 구현은 1차 완료됐지만, 운영 수동 QA에서 숫자 클러스터 표시/클릭/줌인 후 개별 장소 분할이 제대로 동작하지 않는 추가 지도 회귀가 확인됐다. 현재 우선순위는 클러스터 클릭 시 새 viewport 기준으로 지도 데이터를 재조회하고, 충분히 확대된 영역에서는 개별 장소 마커로 전환되도록 복구하는 것이다.

## 최근 변경
- 숫자 클러스터 회귀를 복구했다.
  - `NaverMapPanel`에서 클러스터 클릭/fallback 활성화 시 클러스터 bounds와 zoom을 부모 route에 전달한다.
  - `MapRoute`는 클러스터 focus viewport를 받으면 즉시 `/api/places/map`을 재조회해 지도 마커와 목록을 새 영역 기준으로 갱신한다.
  - Worker map repository는 zoom 16 이상에서 클러스터 대신 개별 장소 마커를 반환하도록 marker mode 기준을 조정했다.
  - `tests/e2e/map.spec.ts`에 고줌 viewport에서 place marker가 반환되는 회귀 테스트를 추가했다.
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
| Public API | `/api/places/map`, `/api/places/:id`, price report, comments, reaction, submission, reports, bookmarks가 Worker route로 연결되어 E2E 통과했다. 가격 필터는 MVP 미노출로 확정했고, 고줌 map marker는 place mode로 전환된다. | 복구 완료 | 운영 Naver 지도 클릭 후 실제 분할 재확인 필요 |
| Admin API | `/api/admin/*`가 Worker route와 `requireAdmin` 보안 경계를 유지한다. | 복구 완료 | 비관리자 `403`, 비로그인 `401` 운영 smoke 재확인 필요 |
| Auth/session | credentials, signup, signout, session, providers, Kakao/Naver signin/callback route가 Worker에 있다. Provider redirect와 admin credentials remote smoke가 통과했다. | 부분 완료 | Kakao/Naver live callback은 실제 계정으로 수동 QA 필요 |
| SEO/static | `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`, `/api/config/public` Worker route가 있다. | 부분 완료 | 장소별 SSR/OG는 후속 분리. 기본 title/description/canonical 수동 확인 필요 |
| Mobile gesture | 모바일 목록 sheet와 상세 sheet drag close가 E2E 통과했다. | 복구 완료 | 실기기에서 Naver map + sheet 터치 충돌 수동 확인 필요 |
| 디자인 parity | 주요 UI는 Vite에서 기능 노출 복구됨. 운영 브라우저에서 지도 missing-key/preview 고착은 해소됨. | 부분 완료 | 실기기에서 시각 밀도와 터치 UX 수동 확인 필요 |
| Test isolation | seed가 `place_reactions`를 초기화해 반복 E2E 누적을 제거했다. | 복구 완료 | 없음 |

## 남은 이슈
- 숫자 클러스터 자동 검증과 운영 API 검증은 통과했다. 운영 Naver 지도에서 실제 클릭 후 시각적으로 분할되는지는 브라우저/실기기에서 재확인이 필요하다.
- Kakao/Naver OAuth live callback은 provider 실제 계정 로그인이 필요하므로 수동 QA가 필요하다.
- 실제 모바일 기기에서 Naver map + 목록 sheet 터치 충돌, 상세 sheet, 주요 화면 디자인 밀도는 최종 수동 확인이 필요하다.

## 다음 액션
- 운영 URL에서 숫자 클러스터 클릭 후 개별 장소 마커로 분할되는지 확인한다.
- 실제 Kakao/Naver 계정으로 운영 OAuth callback을 확인한다.
- 실제 모바일 기기에서 지도, 목록 바텀시트, 상세 시트, 제보/신고/댓글 흐름을 최종 확인한다.
