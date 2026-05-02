# PLAN.md

## Active 작업

Vite React 프론트 디자인 시스템을 재정비한다.

## 배경
- Next.js에서 Vite + React로 이관한 뒤 기능 parity와 운영 자동 QA는 마감됐다.
- 이관 후 버튼, 카드, 배지, 필터, 지도 오버레이, 리스트 패널의 세부 디자인 품질이 Next 시절보다 낮아졌다.
- 외부 피드백은 “브라운 컬러 하나”보다 디자인 시스템 부재, 정보 위계 약화, 제품 인상 부족을 핵심 문제로 지적했다.
- 이 작업은 신규 기능 추가가 아니라 public/admin 주요 화면의 UI 품질과 일관성을 복구하는 프론트 디자인 작업이다.

## 디자인 판단
- Claude 피드백은 방향성은 타당하지만 제안 코드와 색상값을 그대로 적용하지 않는다.
- `#16A34A` 같은 기본 Tailwind green을 그대로 primary로 쓰면 흔한 절약 앱 템플릿처럼 보일 수 있으므로, repo token과 OKLCH 기반 palette로 재정의한다.
- 가격 정보는 서비스의 핵심 신호이므로 카드, 리스트, 상세, 지도 핀에서 가장 빠르게 읽히게 만든다.
- 브라운 감성 UI와 초록 primary는 줄이고, 흰 배경 위에 신뢰감 있는 블루 계열 primary와 발견/주의용 오렌지 포인트를 제한적으로 사용한다.
- 사용자용 화면에서 관리자/운영 정보가 과하게 노출되는지 확인하되, admin route와 E2E contract를 깨지 않는다.

## 목표
- Vite 앱의 디자인 token, 버튼, input, badge, card, panel, map overlay primitive를 일관된 체계로 정리한다.
- 지도/리스트 탐색 화면을 “페이지 위에 놓인 카드 더미”가 아니라 map-first 탐색 도구로 보이게 만든다.
- 가격 카드에서 대표 가격, 장소명, 위치, 검증 상태, 갱신일, 주요 action의 위계를 강화한다.
- 검색/범위 토글/필터 문구와 시각 상태를 더 명확하게 만든다.
- 추천/빠른 비교 섹션은 실제 기준이 모호한 copy를 피하고, 현재 데이터가 보장하는 범위 안에서 설명한다.
- admin 화면은 public token을 공유하되 운영자가 반복 작업을 빠르게 처리할 수 있는 밀도와 action hierarchy를 유지한다.

## 작업 순서
- Baseline 확정
  - `.impeccable.md`, PRD/TRD, 현재 `src/client/styles.css`, `MapRoute`, 주요 route를 기준으로 디자인 문제를 정리한다.
  - `npm run design:detect:json`과 주요 화면 screenshot/DOM smoke로 변경 전 상태를 남긴다.
  - public 주요 화면: `/`, `/map`, `/place/:id`, `/submit`, `/report`, `/bookmarks`, `/login`.
  - admin 주요 화면: `/admin`, `/admin/places`, `/admin/prices`, `/admin/reports`.
- Token과 component primitive 재정의
  - canvas/surface/subtle/text/border/primary/accent/success/warning/danger/info token을 재정의한다.
  - page canvas는 흰색에 가깝게 유지하고, primary action과 선택 상태는 초록이 아닌 블루 계열로 정리한다.
  - button은 primary, secondary, ghost, icon으로 정리하고 radius, height, focus, disabled, hover 상태를 통일한다.
  - badge는 검증 상태, 제보 상태, 갱신 상태, 가격 유형을 의미별 tone으로 나눈다.
  - card/panel은 반복 item에는 border 중심, floating map overlay에만 shadow를 사용한다.
- 지도 탐색 화면 개선
  - 상단 검색/필터를 더 강한 primary task로 정리하되 map first 구조를 유지한다.
  - `보이는 지도`/`전체 지역` 계열 문구는 `현재 지도 범위`/`전체 지역`처럼 더 명확하게 만든다.
  - desktop list rail은 명확한 side panel로 정리하되, 지도 영역이 화면의 주인공이 되도록 map/list 비율을 지도 쪽으로 크게 준다.
  - map overlay는 작고 정교한 control로 축소한다.
- 장소 카드와 추천 섹션 개선
  - 장소 카드의 첫 스캔 순서를 가격 -> 장소명 -> 위치/카테고리 -> 검증/갱신 -> action으로 정리한다.
  - 설명문은 리스트 카드에서 2줄 이하로 제한하고 상세 페이지에서 충분히 보여준다.
  - 추천/빠른 비교 섹션은 실제 정렬/선정 기준과 맞는 copy로 바꾼다.
- 상세/쓰기/인증/admin 확장
  - 상세 페이지의 가격 항목, 가격 제보, 코멘트 섹션에 같은 token과 버튼 체계를 적용한다.
  - 제출/신고/로그인/북마크 empty/error state를 새 token에 맞춘다.
  - admin은 과한 장식보다 scan density, status visibility, destructive action clarity를 우선한다.
- Final polish와 검증
  - spacing/radius/shadow/contrast/focus/hover/disabled/loading 상태를 점검한다.
  - E2E contract와 test id를 변경하지 않는다.
  - 완료 후 `PROGRESS.md` 내용을 `COMPLETED.md`에 archive하고 active 문서를 정리한다.

## 검증 계획
- 디자인/정적 검증:
  - `npm run design:detect:json`
  - `git diff --check`
- 기본 검증:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run verify`
- 회귀 검증:
  - `npm run test:e2e:full`
  - 필요 시 `node scripts/run-local-e2e.mjs smoke -- tests/e2e/map.spec.ts`
  - 필요 시 `npx playwright test tests/e2e/map.mobile.spec.ts --project mobile-chromium`
- 운영 전 검증:
  - `npm run deploy:check`
  - `npm run smoke:vite:local`
- 수동/시각 QA:
  - desktop/mobile viewport에서 홈 지도, 리스트, 상세 sheet, 장소 상세, 제출/신고/북마크/admin 화면을 확인한다.
  - 색상 대비, 터치 타겟, 텍스트 줄바꿈, 버튼 위계, 지도 overlay 가독성을 확인한다.

## 완료 기준
- Claude 피드백에서 타당한 핵심 문제인 브랜드 인상, 버튼 위계, 카드 위계, 지도/list 관계, 배지 의미 체계가 코드에 반영된다.
- public 주요 화면과 admin 주요 화면이 같은 token/component 문법을 공유한다.
- 가격 정보가 카드/list/detail에서 가장 강한 반복 신호로 읽힌다.
- admin/user route와 E2E DOM contract가 깨지지 않는다.
- `npm run design:detect:json`, `npm run verify`, `npm run test:e2e:full`, `npm run smoke:vite:local`이 통과한다.
- 운영 배포를 진행하는 경우 `npm run deploy`와 remote smoke가 통과한다.
