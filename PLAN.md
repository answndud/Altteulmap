# PLAN.md

## Goal

모바일 환경·모바일 브라우저·모바일 접근성은 품질 목표에서 제외한다. 데스크톱 웹과 서버 운영 품질을 중심으로 백엔드 신입 채용 리뷰에서 지적될 보안·설계·저장소 위생 결함을 제거한다.

Observable finish state:
- 운영 데모가 실제 데이터로 동작하고, 정기 smoke가 실패하면 알 수 있다.
- 관리자 대시보드와 화면에 가짜 지표·빈 화면이 없고, UI가 `.impeccable.md` 기준과 일치한다.
- 운영 인증 경로에 하드코딩 계정·mock 분기가 없고, 세션은 DB에서 폐기 가능하다.
- 익명 rate limit은 쿠키 없이 우회되지 않는다.
- route → service → repository 계층과 도메인 에러 타입이 있고, 도메인 규칙은 DB 없이 unit test된다.
- `npm run verify`, `npm run test:integration`, `npm run test:e2e:full`, `npm audit --omit=dev --audit-level=high`가 통과한다.

공통 integration 실행 명령(이하 `INTEGRATION`): `npm run test:integration:local`

## Active

문서 목표(observable finish state): 백엔드 리뷰어가 README 3분 안에 "무엇을·왜·어떻게 검증했는지"를 파악하고, 저장소 문서가 현재 코드(VPS Postgres·Hyperdrive·세션/rate limit/에러 계약)와 어긋나지 않으며, 면접용 자료(저장소 밖 `altteulmap-private-docs`)가 같은 사실과 수치를 쓴다. 문서 링크·코드 경로 검사가 `npm run verify:quality`에 포함된다.

### Phase D3. 면접 자료 (저장소 밖 `/Users/alec/project/altteulmap-private-docs/docs/`, 커밋 대상 아님)

#### D3-1. 프로젝트 원페이저와 문제 해결 사례
- Likely files: `resume/project-one-pager.md`(신규), `resume/README.md`, `resume/application-draft.md`
- Changes:
  - 원페이저: 30초 소개 / 2분 소개 / 아키텍처 그림 / 핵심 수치 5개 / 내가 내린 결정 5개.
  - STAR 사례 6개(각 상황·원인 분석·선택지·결과 수치·배운 점): ① Supabase → VPS Postgres 이전(Tunnel·VPC·TLS verify_full, 시드 대신 `pg_dump` 전환) ② 원격 DB 지연 분석(쿼리 수 비례, 병렬화 무효 → 단일 쿼리·SQL 집계·edge cache) ③ 서명 쿠키 → DB 세션(즉시 폐기) ④ 쿠키 삭제로 우회되던 rate limit → IP·계정 버킷 ⑤ OAuth callback 500(불변 헤더) 회귀 테스트 ⑥ 가격 검수 동시성(advisory lock·멱등 키).
  - 이력서 bullet을 수치 중심 3~4줄로 갱신.
- Verify: 원페이저·README·성능 문서의 수치가 같은지 `grep`으로 대조
- Done: 각 사례가 저장소 커밋 해시·ADR·테스트 파일로 증빙 링크됨

#### D3-2. 질문 은행·플레이북 갱신
- Likely files: `08-면접-복기/기술-질문-은행.md`, `08-면접-복기/현재-상태-검토.md`, `resume/interview-playbook.md`, `08-면접-복기/안내.md`
- Changes: 리팩터링 이전 경로·Supabase 전제 수정. ADR별 꼬리 질문(왜 Redis가 아닌가, 세션 테이블 정리 주기, Hyperdrive가 쿼리를 직렬화하는 이유, offset 페이지네이션 한계, 백업 RPO/RTO, 단일 VPS 장애 시나리오)과 약점 질문(단일 VPS, 원격 백업 미구현, 실사용 트래픽 없음, k6 미측정)에 대한 정직한 답변 초안 추가. 오래된 `audits/` 문서는 결론만 남기고 `archive/`로 이동.
- Verify: `grep -rn "src/worker/places-write-repository\|Supabase" /Users/alec/project/altteulmap-private-docs/docs/08-면접-복기 /Users/alec/project/altteulmap-private-docs/docs/resume` 결과가 회고 문맥 외에 없음
- Done: 질문 은행의 모든 답변이 현재 코드·수치와 일치하고 약점 질문 답변이 준비됨

## Backlog

- 한국 기준 지도 첫 화면 캐시 미스 p95(약 1.2초)를 더 줄이려면 목록 건수(100) 축소 또는 가까운 리전 Postgres로 Hyperdrive 대상 교체(`deploy/vps/README.md` §5)
- 개발 머신 백업 사본(월 1회 LaunchAgent로 자동화됨)을 맥 밖 원격 스토리지(예: R2)로도 보관하고, 새 서버 복구 리허설(role·Hyperdrive 포함) 증적 확보. 2026-11-24 04:17 UTC 이후 VPS 일 1회 백업 cron이 실제로 새 덤프를 만들었는지 확인
- zod 스키마 기반 OpenAPI 문서 생성과 `/api/docs` 제공
- k6 부하 테스트로 지도 조회·가격 제보 p95/처리량 측정 → 병목 개선 → 재측정 결과 기록
- staging OAuth 성공 callback, 실제 backup/PITR 복구, Cloudflare 알림 수신 증적 확보
- 장소 merge 대량 데이터 이전·중단 복구 정책
