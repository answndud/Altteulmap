# PLAN.md

기준일: 2026-04-01  
목표: Altteulmap를 `지도 기반 절약 장소 탐색 + 가격 제보` 서비스 기준에서 MVP 완성도와 출시 준비 수준까지 끌어올린다.

## 운영 규칙
- 세션 시작: `PLAN.md` -> `PROGRESS.md` -> `prd.md` -> `trd.md` 순서로 먼저 확인
- 작업 시작: 대상 cycle 또는 작업 상태를 `in_progress`로 바꾼 뒤 구현 시작
- 작업 종료: `PROGRESS.md`에 결과/검증/블로커 기록 후 `PLAN.md` 상태 갱신
- cycle 내 모든 작업이 끝나면 제목에 `(완료)` 표시
- 블로커 발생 시 두 문서를 즉시 같이 수정
  - `PLAN.md`: 계획/우선순위/의존성 수정
  - `PROGRESS.md`: 실제 이슈와 우회 경로 기록

## 범위 원칙
- 우선순위: `지도 Read MVP -> 쓰기 데이터 축적 -> 운영 품질 -> 인증/출시 -> 확장 기능`
- MVP 원칙: 지도 탐색과 가격 데이터 축적이 흔들리면 확장 기능은 뒤로 미룬다
- 현재 정책: `비회원 읽기, 비회원 반응, 회원 쓰기`를 기본값으로 유지한다
- 별도 정책 결정 전 보류:
  - 익명 제보/익명 댓글
  - 커뮤니티 `bang`
  - 핫딜 `deal`
  - 좋아요 랭킹

## 현재 우선순위
1. 인증 정리와 출시 준비: 실제 로그인 경로, 반복 가능한 검증 절차, Cloudflare 배포 체크리스트
2. 공개 UI polish: 헤더 간소화, 개발 문구 제거, 버튼/칩 줄바꿈 방지, 지도/상세 밀도 정리
3. 운영 품질 후속 정리: rate limit 수치 조정, 관리자 UX polish, 캐시/재검증 보강
4. 확장 기능 1차: 플레이스 좋아요/싫어요 반응 모델과 UI 우선 도입
5. 확장 기능 2차: 공유/사진 업로드 범위와 우선순위 재결정
6. repo-local 개발 워크플로우 유지: `.agents` skills/reviewers, `.githooks`, `verify` 스크립트

## 현재 제품 상태

### 구현 완료
- `/` 진입 시 지도 첫 화면 제공
- 네이버 지도 연동과 preview fallback
- 현재 위치 버튼
- viewport 기반 장소 재조회
- 카테고리/가격/정렬 필터
- 지역/전역 검색
- 장소 상세 시트와 개별 상세 페이지
- 북마크
- 장소 등록/신고
- 관리자 장소 승인/반려
- 관리자 신고 검토
- 댓글 작성/삭제
- 기존 장소 가격 제보
- 관리자 가격 제보 검토 큐
- 관리자 가격 직접 수정/대표 지정/숨김
- 플레이스 좋아요/싫어요 반응
- 비로그인 visitor cookie 기반 좋아요/싫어요
- 지도 목록 좋아요 노출과 좋아요순 정렬
- 대표 가격 재계산과 동일 가격 2회 검증 처리
- 쓰기 API 최소 rate limit
- 로컬 Auth.js credentials 로그인
- Docker + Drizzle + PostgreSQL 로컬 개발 경로
- sitemap/robots/canonical/기본 metadata

### 부분 구현
- 모바일 바텀시트 UX
  - 목록은 usable 상태지만 상세 시트 전환 감각과 스냅 동작은 더 다듬어야 함
- 검색 URL 상태
  - 검색어/검색 범위는 반영되지만 지도 중심/줌 상태까지는 아직 URL에 싣지 않음
- 출시 준비
  - robots, sitemap, canonical, `smoke:local`, `deploy:check`, Playwright E2E 기본 흐름, credentials 로그인/등록/북마크/신고/관리자 승인/관리자 가격 검토 E2E, GitHub Actions CI, Cloudflare Builds 기준 배포 체크 문서는 정리했고, 현재 E2E는 세 그룹 실행 기준으로 반복 가능하다. 실제 OAuth와 실제 운영 도메인 기준 end-to-end 점검은 남아 있다
- 인증
  - 로컬 credentials와 카카오/네이버 OAuth scaffolding은 준비됐다. 현재 `.env.local` 기준으로 네이버는 활성화 가능 상태이고, 카카오는 client secret 누락 시 비활성화된다. 실제 provider credential과 callback URL로 끝까지 검증한 외부 로그인 경로는 아직 없다
- 반응 기능
  - 상세/상세 시트/지도 마커/지도 목록과 좋아요순 정렬까지 반영됐다. 별도 랭킹 화면은 아직 없다
- 공유 기능
  - 상세 페이지와 상세 시트에서 링크 공유는 가능하지만, 목록 단위 공유나 공유 유입 추적은 아직 없다

### 미구현 핵심
- 좋아요 랭킹
- 사진 업로드
- 테스트 체계
  - 지도/상세/비회원 좋아요/좋아요순/공유, 모바일 목록 시트/상세 시트, credentials 로그인, 장소 등록, 북마크, 신고 제출/관리자 상태 변경, 관리자 장소 승인, 관리자 가격 검토 기준 Playwright E2E는 들어갔다. 현재는 DB 기반 `bookmarks/map`, mock runtime의 `map.mobile`, DB 기반 `price-review/report-admin/submission-admin` 세 그룹으로 반복 실행한다. 실제 소셜 로그인 E2E와 더 깊은 모바일 제스처 검증은 더 필요하다
- 커뮤니티 `bang`
- 핫딜 `deal`

## Active Plan

### Cycle 7: repo-local AI workflow setup (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| ECC에서 필요한 부분만 가져와 altteulmap 저장소 하위에 repo-local skills, reviewer guides, verify script, git hooks를 구성하고 전역 설정 없이 활성화한다 | Codex | P2 | `done` | `.agents/skills`, `.agents/reviewers`, `.githooks`, `scripts/git-hooks`가 추가되고, `npm run hooks:install`, `npm run verify`가 동작하며, `AGENTS.md`/`README.md`/`PLAN.md`/`PROGRESS.md`에 사용 규칙과 검증 결과가 반영된다 | `AGENTS.md`, `README.md`, `package.json`, `.githooks/**`, `scripts/git-hooks/**` |

### Cycle 2: 문서 체계 정비와 지도 검색/URL 상태 반영 (완료)
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| `townpet`의 문서 형식을 참고해 `PLAN.md`/`PROGRESS.md`를 운영 문서 형태로 재정리하고, `/map`에 지역/전역 검색과 URL 상태 반영을 추가한다 | Codex | P1 | `done` | 문서는 `운영 규칙/현재 우선순위/Active Plan/실행 로그` 구조를 갖고, 지도는 `q/scope` 기반 검색을 지원하며, `/api/places/map`가 지역/전역 검색을 모두 처리하고, lint/build/runtime 검증 결과가 `PROGRESS.md`에 남는다 | `PLAN.md`, `PROGRESS.md`, `prd.md`, `trd.md`, `src/app/map/page.tsx`, `src/features/places/map-explorer.tsx`, `src/features/places/repository.ts`, `src/app/api/places/map/route.ts` |

### Cycle 3: 댓글과 기존 장소 가격 추가 제보
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 장소 상세 시트 안에서 댓글 작성/삭제와 기존 장소 가격 추가 제보 흐름을 구현하고, 관리자 검토와 연결한다 | Codex | P1 | `done` | 로그인 사용자가 상세 시트에서 댓글을 작성/삭제할 수 있고, 기존 장소에 새 가격 항목을 제보할 수 있으며, 관리자 화면에서 새 가격 제보를 검토할 수 있고, 기본 검증 결과가 `PROGRESS.md`에 기록된다 | `src/app/place/[id]/page.tsx`, `src/features/places/place-detail-sheet.tsx`, `src/features/places/repository.ts`, `src/features/submission/**`, `src/app/admin/**`, DB schema |

### Cycle 4: 운영 품질과 관리자 가격 관리
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 가격 검증/대표 가격 산정과 관리자 가격 수정 흐름을 정리하고, 쓰기 API에 최소 rate limit을 추가한다 | Codex | P1 | `done` | 가격 대표값 산정 규칙이 코드와 화면에서 일치하고, 운영자가 가격 항목을 수정/비활성화할 수 있으며, 장소 등록/신고/댓글/가격 제보 API에 최소 rate limit이 들어가고, 관련 검증이 `PROGRESS.md`에 남는다 | `trd.md`, `src/features/places/repository.ts`, `src/app/api/places/**`, `src/app/api/reports/**`, 관리자 페이지, DB schema |

### Cycle 5: 인증 정리와 출시 준비
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 로컬 credentials 중심 인증을 실제 로그인 경로로 확장하고, 핵심 사용자 흐름 테스트/SEO/배포 체크리스트를 정리한다 | Codex | P2 | `in_progress` | 로컬 credentials 로그인과 지도 탐색/모바일 시트/등록/북마크/신고/관리자 승인/관리자 가격 검토 E2E가 반복 가능하게 정리되고, 이후 실제 OAuth 1개 이상이 end-to-end로 확인되며, sitemap/canonical/metadata와 Cloudflare 배포 체크리스트가 최신 상태가 된다 | `src/auth.ts`, `src/app/login/page.tsx`, 테스트 코드, `README.md`, `trd.md` |

### Cycle 6: 반복 방문 기능 확장
| 작업명 | 담당 에이전트 | 우선순위 | 상태 | 완료기준(DoD) | 의존성 |
|---|---|---|---|---|---|
| 플레이스별 좋아요/싫어요를 먼저 붙여 공개 카운트와 사용자 반응 저장을 제공하고, 이후 공유/사진 업로드 순서를 재판단한다 | Codex | P2 | `in_progress` | 공개 상세와 상세 시트에 좋아요/싫어요 UI가 생기고, visitor cookie 또는 로그인 사용자 기준으로 한 플레이스에 한 반응만 저장되며, 공개 읽기에는 카운트가 노출되고, route/schema/repository/DB migration/검증 결과가 `PROGRESS.md`에 남는다 | 벤치마크 분석 메모, `prd.md`, `trd.md`, `src/db/schema.ts`, `src/features/places/repository.ts`, `src/app/api/places/**` |

## 결정 메모
- 현재 계획 기준의 핵심 서비스는 여전히 `지도 + 가격 데이터`다.
- 벤치마크 사이트에서 영감을 받은 기능은 확장 후보로 유지하되, core loop를 약하게 만들 정도로 범위를 넓히지 않는다.
- 현재 익명 허용 범위는 `좋아요/싫어요` 같은 가벼운 반응까지다.
- 익명 제보/익명 댓글까지 넓히려면 `prd.md`, `trd.md`, 인증/신고 정책을 같이 수정해야 한다.
