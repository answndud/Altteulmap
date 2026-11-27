# 0006. 운영 DB는 VPS 전용 Postgres를 Tunnel·Workers VPC·Hyperdrive로 연결한다

상태: 채택(2026-11-23) · 관련 코드: `src/worker/db.ts`, `wrangler.jsonc`, `deploy/vps/` · 관련 문서: [VPS 구성](../../deploy/vps/README.md), [성능 측정](../06-성능/결과/2026-11-24-한국-측정.md)

## 맥락
- 운영 DB는 Supabase 무료 프로젝트였다. 비활성 정지, 외부 서비스 의존, 연결 수 제한이 있었고 더 이상 쓰지 않기로 했다.
- 이미 운영 중인 netcup VPS(오스트리아, 다른 서비스와 공유)에 여유 자원이 있었다.
- Workers는 TCP로 DB에 붙지만 DB 포트를 인터넷에 열고 싶지 않았다.

## 결정
- VPS에 **전용** Postgres 17 컨테이너(512MB 제한, `127.0.0.1:15432`에만 게시)를 띄운다. 다른 서비스의 DB와 공유하지 않는다.
- Worker 경로: `Worker → Hyperdrive → Workers VPC(TCP 서비스) → Cloudflare Tunnel(cloudflared) → postgres:5432`. 공개 포트는 없다.
- 터널 구간도 TLS를 쓴다. compose의 `pgcerts`가 사설 CA·서버 인증서를 만들고, VPC 서비스는 이 CA로 `verify_full` 검증한다.
- Worker는 DML만 가능한 `altteulmap_app` role로 접속하고, migration은 SSH 터널로 관리자 role이 한다(`PRODUCTION_VIA_SSH_TUNNEL=1`이 없으면 스크립트가 거부).
- Worker 배치는 `placement.mode: smart`.
- 백업: VPS에서 일 1회 `pg_dump -Fc`(14일 보관) → 개발 머신으로 월 1회 사본(`npm run backup:pull`, macOS LaunchAgent).

## 대안과 버린 이유
- **Supabase 유지**: 비용은 없지만 비활성 정지·외부 의존이 남는다. 운영 경험을 보여 주는 데도 직접 운영이 낫다.
- **DB 포트 공개 + IP 허용 목록**: Workers 출구 IP가 고정되지 않아 허용 목록을 만들 수 없고, 포트가 인터넷에 노출된다.
- **Cloudflare Access + service token**: 동작하지만 토큰 관리가 늘어난다. Workers VPC 서비스가 Cloudflare 권장 방식이다.
- **Worker를 EU 리전에 고정(`aws:eu-central-1`)**: DB 왕복은 줄지만 호출자↔Worker 구간이 늘어 지도 조회가 약 5.6초로 더 느려졌다.

## 결과와 한계
- Worker 안에서 `select 1`은 14ms지만, 먼 호출자에게는 쿼리 1개 왕복이 약 0.35~0.4초다. 그래서 요청당 쿼리 수를 줄이는 것이 성능의 핵심이 됐다(상세 1쿼리화, 지도 SQL 집계, 엣지 캐시).
- 단일 VPS라 VPS 장애 시 서비스 전체가 멈춘다. 이중화·PITR은 없고 RPO는 일 1회 백업 기준 최대 24시간이다.
- 원격 스토리지 백업과 새 서버 복구 리허설(role·Hyperdrive 포함)은 아직 하지 않았다(`TRACK.md` Backlog).
- 한국 사용자 지연을 더 줄이려면 가까운 리전 Postgres로 Hyperdrive 대상만 바꾸면 된다(코드 변경 없음).
