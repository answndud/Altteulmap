# 알뜰맵(TRD) v1

## 1. 문서 정보
- 문서명: 알뜰맵 Technical Requirements Document
- 버전: v1.1
- 상태: Draft for build
- 기준 문서: `prd.md`
- 작성 목적: 1인 개발 환경에서 MVP를 실제 구현하기 위한 기술 설계 기준 수립

---

## 2. 문서 목적

본 문서는 PRD를 실제 제품으로 구현하기 위한 기술적 의사결정을 정의한다.  
핵심 목표는 다음과 같다.

- 1인 개발과 AI agent 보조 개발에 적합한 단순한 구조를 채택한다.
- 월 예산 5만원 내에서 운영 가능한 MVP 기술 스택을 선택한다.
- 전국 단위 확장을 염두에 두되, 초기에는 서울 중심 시드 데이터와 수동 운영에 최적화한다.
- 비회원 탐색, 비회원/회원 공개 쓰기, 회원 북마크, 가격 검증/이력이라는 PRD 핵심 요구를 우선 충족한다.

---

## 3. 기술 설계 원칙

### 3.1 핵심 원칙
- 모바일 웹 우선
- 저비용 SaaS 우선
- 서버 단순화
- 지도 탐색 성능 우선
- 데이터 이력 추적 가능성 확보
- 읽기 기능은 최대한 공개하고, 쓰기 기능은 위험도에 따라 공개/인증 제한을 구분한다

### 3.2 아키텍처 원칙
- 프론트엔드와 BFF(Backend for Frontend)를 하나의 Vite React SPA + Cloudflare Worker API로 통합한다.
- 데이터 접근은 서버 경유를 원칙으로 하며 클라이언트에서 DB에 직접 접근하지 않는다.
- 가격 검증 로직은 DB에 저장되는 원본 제보 데이터 기반으로 판정 가능해야 한다.
- 카테고리 확장, 가격 템플릿 확장, 운영자 검토 기능을 감안해 스키마를 설계한다.

### 3.3 비목표
- 마이크로서비스 분리
- 실시간 스트리밍 아키텍처
- 자동 크롤링/자동 가격 수집 파이프라인
- 복잡한 추천 엔진
- 네이티브 앱 전용 백엔드 설계

---

## 4. 권장 기술 스택

### 4.1 애플리케이션
- 프레임워크: Vite + React Router
- 언어: TypeScript
- 개발 런타임: Node.js LTS
- 배포 런타임: Cloudflare Workers(workerd)
- UI: React + Tailwind CSS
- 폼 처리: React Hook Form + Zod
- 데이터 검증: Zod
- ORM: Drizzle ORM

### 4.2 인프라
- 호스팅: Cloudflare Workers
- 배포 어댑터: Cloudflare Vite plugin
- 배포/운영 도구: Wrangler + Git 연동 배포
- 데이터베이스: Supabase PostgreSQL
- DB 연결 계층: Cloudflare Hyperdrive 권장
- 공간 검색: PostGIS extension
- 파일 저장소: Cloudflare R2(이미지 도입 시), MVP에서는 생략 가능
- 에러 추적: Sentry Free
- 이메일 발송: Resend

### 4.3 인증
- 인증 프레임워크: Worker signed session cookie + provider OAuth route
- 지원 로그인:
  - 로컬 credentials
  - 카카오 OAuth
  - 네이버 OAuth

### 4.4 외부 API
- 지도 렌더링: 네이버 지도 JavaScript API
- 지오코딩/역지오코딩: 네이버 지도 관련 API

- Vite React SPA는 지도 중심 UI와 클라이언트 상호작용을 단순하게 유지하기 좋다.
- Cloudflare Worker API는 public/admin/API를 하나의 런타임으로 묶어 1인 개발 운영 표면적을 줄인다.
- Cloudflare Workers는 전 세계 엣지 배포와 정적 자산 전달 측면에서 유리하다.
- Supabase PostgreSQL + PostGIS는 위치 기반 검색과 저비용 운영에 적합하다.
- Hyperdrive를 사용하면 Workers 환경에서 외부 PostgreSQL 연결을 더 안정적으로 구성하기 쉽다.
- Worker OAuth route는 카카오/네이버처럼 국내 OAuth 제공자를 직접 제어하기 쉽다.
- Cloudflare + Supabase 조합도 1인 개발 기준에서 충분히 단순한 운영 구성이 가능하다.

---

## 5. 시스템 구성

### 5.1 상위 구조
1. 웹 클라이언트
2. Cloudflare Worker API 레이어(BFF)
3. PostgreSQL/PostGIS
4. 외부 인증 제공자(카카오, 네이버, 이메일)
5. 네이버 지도 API
6. 운영자 내부 관리 화면

### 5.2 렌더링 전략
- 홈/지도 페이지: Vite SPA 렌더링
- 필터 변경/지도 이동: 클라이언트 fetch
- 장소 상세: SPA route + Worker API 조회
- 등록/신고/북마크: Worker API

### 5.3 Cloudflare 런타임 고려사항
- 애플리케이션은 Cloudflare Pages가 아니라 Workers 기준으로 설계한다.
- Node 전용 패키지, 장시간 연결, 네이티브 바이너리 의존 라이브러리는 도입 전 호환성 검증이 필요하다.
- 로컬 개발은 `vite`, 프로덕션 유사 검증은 Vite build 산출물의 Wrangler dev/workerd 기준으로 수행한다.

### 5.4 상태 관리 전략
- URL Search Params: 지역, 줌, 카테고리, 검색어/검색 범위
- 클라이언트 로컬 상태: 지도 인스턴스, 선택 핀, 바텀시트 상태
- 서버 상태 캐시: SWR 또는 TanStack Query 중 1개만 채택

권장안:
- 초기 MVP는 `URL + fetch + React 기본 상태` 중심으로 구현한다.
- 복잡한 캐시 무효화가 필요해지면 TanStack Query를 도입한다.

---

## 6. 기능 범위와 기술 구현 방안

### 6.1 비회원 지도 탐색
- 현재 위치 또는 지역 검색으로 지도 중심점을 설정한다.
- 지도 이동이 끝난 시점에 현재 viewport 기준 장소 목록을 조회한다.
- 목록과 지도는 동일한 조회 결과를 사용한다.
- 성능을 위해 상세 데이터 전체가 아니라 카드 렌더링용 요약 데이터만 우선 내려준다.

### 6.2 카테고리 필터
- 카테고리는 다중 선택 가능 구조로 설계한다.
- 대표 가격은 필터 대신 카드/상세의 요약 정보로 노출한다.

### 6.3 장소 상세
- 장소 기본 정보
- 카테고리
- 좌표 및 주소
- 가격 항목 목록
- 대표 가격
- 가격 이력
- 코멘트
- 검증 상태
- 신고 버튼
- 최근 수정일

### 6.4 장소 등록
- 비회원과 로그인 사용자 모두 가능
- 장소 신규 등록 가능
- 공개 등록 폼은 `name` 단일 필드만 노출하고, `business_name`은 운영 보강 또는 기존 데이터 호환용 nullable metadata로 유지한다
- 공개 등록 폼은 지도/좌표 UI와 링크 입력 UI를 노출하지 않고, 이름/주소/가격 같은 텍스트 정보만 접수한다
- 지도 표시 좌표 확인은 운영자 승인 단계에서 처리하고, 승인 시 확정한 좌표를 저장한다
- 가격 항목은 최소 1개 입력
- 인증 사용자가 아니면 `created_by_user_id`는 `null`로 저장하고, rate limit은 session user id가 없을 때 visitor cookie 또는 forwarded IP fallback 기준으로 적용한다

### 6.5 가격 검증
- 동일 장소 + 동일 가격 항목명 + 동일 금액 조합이 2회 이상 승인 저장되면 `verified` 처리
- 검증 판정은 배치가 아닌 write 시점에서 계산
- 현재 대표 가격은 가장 최신 승인 가격을 기준으로 유지

### 6.6 가격 이력
- 가격 변경을 덮어쓰지 않고 append-only 이력으로 저장
- 상세 페이지에서는 최신순 이력을 조회
- 검증 여부는 현재 가격 항목 기준으로만 노출하고, 과거 이력은 상태 스냅샷으로 보관한다

### 6.7 북마크
- 회원 전용
- 유저-장소 간 단순 다대다 구조
- 중복 삽입 방지 unique 제약 적용

### 6.8 신고/수정 요청
- 비회원과 로그인 사용자 모두 허용
- 신고 유형:
  - 가격 오류
  - 중복 장소
  - 폐업/정보 오류
  - 광고성/부적절 정보
  - 기타
- 신고는 즉시 삭제가 아니라 운영자 검토 큐로 적재한다.

### 6.8.1 익명 공개 쓰기 정책
- 댓글, 가격 제보, 신고는 비회원도 허용한다.
- 비회원 쓰기 actor는 visitor cookie 기준으로 식별하고, rate limit과 댓글 삭제 권한 판단에 같은 visitor id를 사용한다.
- 로그인 사용자는 기존 session user id 기준 추적을 유지한다.

### 6.9 운영자 관리
- 운영자 전용 라우트 제공
- 최소 기능:
  - overview 대시보드
  - 사용자 수, 현재 세션 수, 승인/검토 큐 수 집계
  - 최근 가입 사용자 목록
  - 신고 목록 조회
  - 장소 승인/수정
- `장소 등록`, `가격 제보`, `신고` 큐에는 AI 1차 검수 제안 레이어를 두고, 운영자는 최종 승인/반려/상태 변경만 확정한다.
- 댓글은 현재 관리자 검수 큐를 두지 않고 공개 표시 후 필요 시 숨김 처리한다.
- 중복 장소 병합
- 가격 항목 수정
- 숨김 처리
- 방문 지표는 `visit_activity` 적재를 기준으로 제공한다.
  - actor key는 로그인 user id 또는 visitor cookie id를 사용한다.
  - dedupe는 30분 bucket 단위로 적용한다.
  - 공유 링크 유입은 `entry_ref=share`, `entry_source=detail|detail_sheet|list|trending`로 bucket 단위 보존한다.
  - 현재 overview는 오늘/7일 방문 수, 고유 방문자 수, DAU/WAU, 7일 재방문율, 7일 공유 유입과 source breakdown을 노출한다.

---

## 7. 정보 구조와 화면 단위 설계

### 7.1 공개 화면
- `/`
- `/map`
- `/place/[id]`
- `/submit`
- `/login`
- `/signup`

### 7.2 회원/쓰기 화면
- `/bookmarks`
- `/mypage`

### 7.3 운영 화면
- `/admin`
- `/admin/reports`
- `/admin/places`
- `/admin/merge`

### 7.4 모바일 우선 UI 원칙
- 지도 하단 바텀시트 목록
- 필터는 상단 스티키 영역 또는 하단 시트
- 상세는 전체 페이지 또는 풀스크린 시트
- 주요 터치 타겟 최소 44px 이상

---

## 8. 데이터 모델

### 8.1 핵심 엔터티
- users
- auth_accounts
- places
- categories
- place_categories
- price_items
- price_reports
- comments
- bookmarks
- content_reports
- admin_actions

### 8.2 엔터티 상세

#### 8.2.1 users
- `id`
- `email`
- `nickname`
- `role` (`user`, `admin`)
- `created_at`
- `updated_at`

#### 8.2.2 places
- `id`
- `name`
- `business_name` nullable
- `description` nullable
- `road_address`
- `lot_address` nullable
- `latitude`
- `longitude`
- `geom` geography(Point, 4326)
- `status` (`active`, `hidden`, `closed`, `pending_review`)
- `representative_price_amount` nullable
- `representative_price_label` nullable
- `verified_price_item_count`
- `last_price_updated_at` nullable
- `created_by_user_id`
- `created_at`
- `updated_at`

#### 8.2.3 categories
- `id`
- `parent_id` nullable
- `slug`
- `name`
- `sort_order`
- `is_active`

#### 8.2.4 place_categories
- `place_id`
- `category_id`
- `is_primary`

제약:
- `unique(place_id, category_id)`

#### 8.2.5 price_items
- `id`
- `place_id`
- `label`
- `amount`
- `currency`
- `unit_label` nullable
- `is_representative`
- `verification_status` (`unverified`, `verified`)
- `verified_report_count`
- `latest_reported_at`
- `created_by_user_id`
- `created_at`
- `updated_at`

#### 8.2.6 price_reports
- `id`
- `place_id`
- `price_item_id` nullable
- `reporter_user_id`
- `label`
- `amount`
- `currency`
- `unit_label` nullable
- `comment` nullable
- `report_status` (`accepted`, `rejected`, `pending_review`)
- `snapshot_verification_status`
- `created_at`

설계 원칙:
- `price_reports`는 원본 제보 로그다.
- `price_items`는 현재 화면에 노출되는 최신 상태다.
- 이력 화면은 기본적으로 `price_reports`를 기반으로 구성한다.

#### 8.2.7 comments
- `id`
- `place_id`
- `user_id`
- `body`
- `status` (`visible`, `hidden`)
- `created_at`
- `updated_at`

#### 8.2.8 bookmarks
- `user_id`
- `place_id`
- `created_at`

제약:
- `unique(user_id, place_id)`

#### 8.2.9 content_reports
- `id`
- `reporter_user_id`
- `target_type` (`place`, `price_item`, `comment`)
- `target_id`
- `reason_type`
- `detail` nullable
- `status` (`open`, `reviewing`, `resolved`, `dismissed`)
- `created_at`
- `resolved_at` nullable

#### 8.2.10 admin_actions
- `id`
- `admin_user_id`
- `action_type`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

### 8.3 공간 인덱스
- `places.geom`에 GIST 인덱스 생성
- viewport 검색은 bbox intersects 조건을 우선 사용
- 반경 검색은 `ST_DWithin` 사용

### 8.4 필수 인덱스
- `places(status, updated_at desc)`
- `places(representative_price_amount)`
- `place_categories(category_id, place_id)`
- `price_items(place_id, is_representative)`
- `price_reports(place_id, label, amount, created_at desc)`
- `content_reports(status, created_at desc)`

---

## 9. 검증 로직 상세

### 9.1 가격 검증 규칙
- 같은 장소에서
- 같은 가격 항목명 정규화 값으로
- 같은 금액이
- 서로 다른 2건 이상의 `accepted` 제보로 누적되면 `verified`

### 9.2 항목명 정규화 규칙
- 공백 trim
- 연속 공백 축약
- 대소문자 차이 제거
- 특수문자 일부 제거

예시:
- `아메리카노`
- ` 아메리카노 `
- `아메리카노(ICE)`

위 사례는 완전 동일 항목으로 볼지 여부가 모호하므로 MVP에서는 보수적으로 운영한다.

권장안:
- MVP에서는 과도한 자동 정규화보다 운영자 수정/병합을 우선한다.

### 9.3 대표 가격 선정 규칙
1. `is_representative = true`인 최신 검증 가격 우선
2. 없으면 대표 가격 플래그가 있는 최신 미검증 가격
3. 그것도 없으면 해당 장소의 최저 최신 가격

### 9.4 가격 변경 처리
- 신규 제보가 기존 `price_item`의 금액과 다르면 새 이력으로 저장
- 현재값은 최신 accepted 제보 기준으로 갱신
- 과거값은 삭제하지 않는다

---

## 10. API 설계 초안

### 10.1 공개 조회 API
- `GET /api/categories`
- `GET /api/places/map`
- `GET /api/places/:id`
- `GET /api/places/:id/prices`
- `GET /api/places/:id/history`

### 10.2 공개 쓰기 API
- `POST /api/places`
- `POST /api/places/:id/prices`
- `POST /api/places/:id/comments`
- `DELETE /api/places/:id/comments/:commentId`
- `POST /api/reports`
- `POST /api/auth/signup`

### 10.3 인증 필요 API
- `POST /api/bookmarks`
- `DELETE /api/bookmarks/:placeId`

### 10.4 운영자 API
- `GET /api/admin/reports`
- `PATCH /api/admin/reports/:id`
- `PATCH /api/admin/places/:id`
- `POST /api/admin/places/merge`

### 10.5 지도 조회 API 예시
요청 파라미터:
- `bbox`
- `zoom`
- `categories`
- `query`
- `scope`

응답 필드:
- `id`
- `name`
- `primaryCategory`
- `latitude`
- `longitude`
- `representativePrice`
- `verificationStatus`
- `lastPriceUpdatedAt`

### 10.5 API 응답 원칙
- 목록 조회는 요약 응답만 반환
- 상세 정보는 별도 API 또는 상세 라우트에서 조회
- 에러 응답은 일관된 형식 사용

예시:
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Login required"
  }
}
```

---

## 11. 인증 및 권한 설계

### 11.1 인증 플로우
- 비회원: 읽기, 반응, 등록, 코멘트, 가격 제보, 신고 가능
- 회원: 비회원 기능 + 북마크 가능
- 운영자: 검토/병합/숨김 관리 가능

### 11.2 세션 처리
- Worker signed session cookie 기반
- 민감 작업은 서버에서 세션 재검증
- 운영자 권한은 DB role 컬럼 기준 판정

### 11.3 이메일 로그인
- 로컬 credentials 로그인 유지
- 공개 회원가입은 `POST /api/auth/signup` 기반 credentials 가입과 소셜 로그인 진입면을 함께 제공
- credentials 계정은 `auth_accounts.password_hash`에 scrypt 해시를 저장하고, 가입 직후 같은 credentials로 자동 로그인한다

### 11.4 보안 요구
- CSRF 보호
- 입력 검증(Zod)
- HTML 이스케이프
- Rate limit 적용
- 운영자 API 별도 권한 체크

권장안:
- 쓰기 API는 IP + user 기준 단순 rate limit을 적용한다.
- 현재 공개 쓰기/회원가입 기본 정책
  - 장소 등록: 30분에 4회
  - 댓글: 10분에 8회
  - 가격 제보: 10분에 8회
  - 신고: 30분에 6회
  - 좋아요/싫어요: 5분에 40회
  - 회원가입: 30분에 3회
- 공개 쓰기 응답 헤더
  - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  - `X-RateLimit-Window`, `X-RateLimit-Policy`
  - `429`일 때 `Retry-After`

---

## 12. 검색 및 지도 성능 설계

### 12.1 조회 전략
- 지도 이동 종료 시점에만 조회
- 줌 레벨이 너무 낮으면 조회 제한 또는 클러스터링 적용
- 결과 수가 많으면 서버에서 상한을 둔다

### 12.2 클러스터링
- 초기 MVP:
  - 프론트엔드 마커 클러스터링 사용
- 후속 최적화:
  - 서버 측 타일/그리드 집계 고려

### 12.3 기본 로딩 정책
- 첫 진입 시 서울 기본 중심점 제공
- 현재 위치 허용 시 사용자 위치로 재조회
- 빈 데이터 지역은 빈 상태 메시지와 제보 유도 UI 제공

### 12.4 캐싱 전략
- 카테고리 API: 장기 캐시
- 지도 조회 API: 짧은 캐시 또는 no-store
- 상세 페이지: 짧은 revalidate 허용

---

## 13. 운영자 도구 설계

### 13.1 운영자 대시보드 우선순위
1. overview 대시보드와 운영 진입 동선
2. 신고 처리
3. 중복 장소 병합
4. 장소 숨김/복구
5. 가격 항목 수정

### 13.2 중복 병합 규칙
- 병합 시 대표 장소 1건을 남긴다.
- 북마크, 가격 이력, 신고 이력은 가능한 한 대표 장소로 이전한다.
- 병합 기록은 `admin_actions`에 저장한다.

### 13.3 숨김 정책
- 사용자에게 삭제보다 `노출 중지`를 우선 적용한다.
- 완전 삭제는 운영 실수 복구를 어렵게 하므로 MVP에서는 최소화한다.

---

## 14. 배포 및 환경 구성

### 14.1 환경
- local
- preview
- production

### 14.2 필수 환경 변수 및 바인딩
- `DATABASE_URL`
- `HYPERDRIVE`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `AUTH_KAKAO_CLIENT_ID`
- `AUTH_KAKAO_CLIENT_SECRET`
- `AUTH_NAVER_CLIENT_ID`
- `AUTH_NAVER_CLIENT_SECRET`
- `EMAIL_FROM`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_NAVER_MAP_KEY_ID`
- `SENTRY_DSN`
- `CLOUDFLARE_API_TOKEN`

### 14.3 배포 전략
- Vite와 Cloudflare Vite plugin으로 Workers 번들을 생성한다.
- `wrangler.jsonc`에서 `nodejs_compat`와 assets 바인딩을 관리한다.
- `main` 기준 Cloudflare production 배포
- PR/브랜치 기준 preview 배포는 Git 연동 또는 CI 기반 `wrangler deploy`로 운영한다.
- DB 마이그레이션은 Drizzle migration으로 관리

### 14.4 초기 예산 가정
- Cloudflare Workers: 무료 또는 저비용 시작 가능
- Hyperdrive: 실제 DB 연결 패턴에 따라 사용량 확인 필요
- Supabase: 무료 플랜 시작
- Sentry: 무료 플랜
- 이메일 발송: 저빈도 무료 구간 활용
- 네이버 지도 사용량은 MVP 단계에서 모니터링 필수

---

## 15. 품질 보증 및 테스트 전략

### 15.1 테스트 범위
- 단위 테스트: 가격 검증 로직, 정규화 함수, 권한 함수
- 통합 테스트: API 입력 검증, DB write/read 흐름
- E2E 테스트: 지도 탐색, 익명 공개 쓰기, 북마크, 운영자 검토

### 15.2 권장 도구
- Vitest
- Testing Library
- Playwright

### 15.3 최소 필수 테스트
- 가격 2회 제보 시 검증 전환
- 비회원 공개 쓰기 API 성공
- 지도 bbox 조회 정상 동작
- 북마크 중복 방지
- 신고 생성 후 운영자 목록 노출

---

## 16. 로깅 및 모니터링

### 16.1 애플리케이션 로그
- 인증 실패
- 장소 등록 실패
- 지도 API 에러
- 신고 처리 실패

### 16.2 제품 지표 이벤트
- 지도 조회
- 상세 페이지 조회
- 장소 등록 성공
- 가격 제보 성공
- 북마크 추가
- 신고 제출

### 16.3 에러 모니터링
- 클라이언트/서버 에러는 Sentry로 수집
- 치명적 API 실패는 알림 채널 연동 고려

---

## 17. 개인정보 및 컴플라이언스 고려

### 17.1 저장 데이터 최소화
- 필수 회원 식별 정보만 저장
- 민감 개인정보 수집 최소화

### 17.2 정책 문서 필요
- 개인정보처리방침
- 이용약관
- 커뮤니티/제보 운영정책

### 17.3 삭제 요청 대응
- 회원 탈퇴 시 계정 비식별화 또는 soft delete 고려
- 장소/가격 데이터는 서비스 기록 보존 필요성에 따라 운영정책과 함께 확정

---

## 18. 단계별 구현 계획

### 18.1 Phase 1: 기반 구축
- Vite + React 프로젝트 세팅
- Cloudflare Vite plugin 구성
- Wrangler 설정 작성
- Tailwind, Worker auth route, Drizzle 구성
- Supabase PostgreSQL 연결
- Hyperdrive 연결 방식 확정
- 카테고리 시드 정의
- 기본 레이아웃/모바일 내비게이션 구축

### 18.2 Phase 2: 읽기 MVP
- 네이버 지도 연동
- 지도/목록 동기화
- 카테고리 필터
- 장소 상세

### 18.3 Phase 3: 쓰기 MVP
- 로그인
- 장소 등록
- 가격 항목 등록
- 코멘트
- 북마크
- 신고

### 18.4 Phase 4: 운영 기능
- 운영자 신고 큐
- 숨김 처리
- 중복 병합
- 가격 수정

### 18.5 Phase 5: 품질 보강
- 테스트 추가
- 성능 최적화
- 최근 수정일 노출
- 데이터 없음 지역 UX

---

## 19. 주요 기술 리스크와 대응

### 19.1 네이버 지도 비용/제약
- 리스크: 사용량 증가 시 비용 또는 호출 제한
- 대응: 초기 트래픽 모니터링, 지도 이동 후 디바운스 조회, 상세 API 분리

### 19.2 전국 데이터 부족
- 리스크: 빈 화면 경험 증가
- 대응: 기본 지역 시드 데이터 확보, 빈 상태에서 제보 유도

### 19.3 검증 로직의 한계
- 리스크: 동일 가격 2회가 실제 정확성을 완전히 보장하지 않음
- 대응: 신고 큐, 최근 수정일, 운영자 수동 검토 병행

### 19.4 소셜 로그인 설정 복잡도
- 리스크: 카카오/네이버 OAuth 설정 시간 증가
- 대응: 로컬 credentials 로그인/회원가입은 유지하되, 공개 진입면에서는 소셜 버튼도 병행 제공해 외부 provider 준비 전후 모두 가입 경로가 막히지 않게 한다

### 19.5 1인 개발 유지보수 부담
- 리스크: 기능 추가 시 복잡도 급증
- 대응: 단일 앱 구조 유지, ORM/스키마 명확화, 운영 도구 최소 범위 우선

### 19.6 Cloudflare 런타임 호환성
- 리스크: 일부 Node 의존 패키지가 Workers 런타임에서 바로 호환되지 않을 수 있음
- 대응: 도입 패키지는 호환성 우선 선정, 로컬 preview를 workerd 기준으로 검증, 필요 시 단순한 HTTP 기반 라이브러리로 대체

---

## 20. 최종 기술 결정 요약

알뜰맵 MVP의 권장 구현안은 `Vite + React + TypeScript + Tailwind + Hono Worker API + Supabase PostgreSQL(PostGIS) + Drizzle + Cloudflare Workers + 네이버 지도 API` 조합이다.

이 구조는 다음 조건을 만족한다.
- 1인 개발에 적합한 단일 코드베이스
- 지도 중심 탐색과 위치 기반 조회 지원
- 가격 이력 및 검증 로직 구현 가능
- 카카오/네이버/이메일 로그인 대응 가능
- 저비용으로 MVP 출시 가능

핵심 구현 우선순위는 다음과 같다.
1. 지도 탐색 읽기 경험 완성
2. 장소/가격 등록 플로우 완성
3. 가격 검증과 이력 저장 완성
4. 운영자 신고 처리 도구 최소 구축

---

## 21. 오픈 기술 이슈

1. 네이버 지도 Geocoding API 실제 요금/쿼터 확인
2. 이메일 로그인 공급자 확정(Resend 등)
3. 사진/이미지 업로드는 현재 범위에서 제외 유지
4. 장소 등록 시 주소 검색 UX 상세 설계
5. 장소 중복 탐지 자동화 수준 결정
6. 대표 가격 템플릿을 카테고리별 고정 입력으로 둘지 여부
7. 지도 클러스터링을 클라이언트만으로 충분히 처리할 수 있는지 검증
8. Hyperdrive를 필수로 둘지, 초기에는 직접 Postgres 연결로 시작할지 결정
9. Cloudflare Worker 직접 Postgres 연결과 Hyperdrive 도입 시점 결정

---

## 22. 구현 시작 체크리스트

- Vite + React 초기화
- Cloudflare Vite plugin 설치
- `wrangler.jsonc` 작성
- Tailwind 세팅
- Drizzle + PostgreSQL 연결
- Hyperdrive 바인딩 설정
- PostGIS 활성화
- Worker credentials/OAuth 로그인 연결
- 카테고리 시드 작성
- 지도 페이지 기본 뼈대 작성
- 장소/가격 스키마 마이그레이션 작성
- 지도 조회 API 작성
- 상세 페이지 조회 API 작성
