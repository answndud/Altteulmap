# 운영 DB: netcup VPS PostgreSQL

altteulmap 운영 DB는 TownPet·kinderp와 같은 netcup VPS의 **전용 PostgreSQL 컨테이너**다(TownPet DB와 공유하지 않는다). Worker는 DB 포트를 인터넷에 열지 않고 `Workers → Hyperdrive → Cloudflare Tunnel → postgres:5432`로 접속한다.

| 파일 | 역할 |
| --- | --- |
| `postgres.yml` | postgres(512MB 제한, loopback `127.0.0.1:15432`만 게시) + cloudflared |
| `altteulmap.env.example` | VPS 비밀 파일 템플릿(커밋 금지) |
| `grant-app-role.sh` | migration 후 Worker용 최소 권한 role 생성(DML만, DDL 불가) |
| `backup.sh` | 일 1회 `pg_dump -Fc` + 검증 + 14일 보관 |

이 구성은 실제 VPS에 배포했다(2026-11-23: postgres 기동, migration, 데이터 복원, role 부여, 백업 cron). 로컬에서도 (migration → role 부여 → seed → 앱 통합 테스트 27개 → 백업)을 한 번 끝까지 검증했다.

> **운영 비밀 파일**: 이 구성에서 만든 DB 비밀번호·터널 토큰·운영 admin 비밀번호는 저장소 루트의 `.env.vps`(권한 600, `.gitignore`로 제외)에 있다. 항목: `POSTGRES_*`, `APP_DB_PASSWORD`, `ADMIN_PASSWORD`, `TUNNEL_TOKEN`, `TUNNEL_ID`, `CF_ACCOUNT_ID`, `CA_CERT_ID`. 이 파일은 로컬에만 있으므로 백업은 비밀번호 관리자에 따로 해 둔다.

## 0. VPS 여유 확인

```bash
free -h && df -h && docker stats --no-stream
```

전용 컨테이너 기준 메모리 512MB, 디스크 5GB 이상 여유가 있어야 한다. 부족하면 `postgres.yml`의 `mem_limit`·`shared_buffers`를 조정하기 전에 TownPet의 사용량부터 확인한다.

## 1. 배포

```bash
ssh <vps>
mkdir -p ~/altteulmap /opt/backups/altteulmap && cd ~/altteulmap   # 배포 계정은 /opt에 쓸 수 없으므로 홈에 둔다
# 이 저장소의 deploy/vps/{postgres.yml,backup.sh,grant-app-role.sh}를 복사한다.
cp altteulmap.env.example altteulmap.env && chmod 600 altteulmap.env   # 값을 채운다
docker compose --env-file altteulmap.env -f postgres.yml up -d postgres
```

비밀번호는 각각 32자 이상 무작위 값으로 만든다. 값은 저장소·채팅·CI 로그에 남기지 않는다.

## 2. migration·seed (SSH 터널)

DB는 공개 포트가 없으므로 개발 머신에서 SSH 터널로 loopback에 연결한다.

```bash
ssh -N -L 15432:127.0.0.1:15432 <vps> &

export PRODUCTION_VIA_SSH_TUNNEL=1   # 127.0.0.1이 운영 VPS임을 명시(없으면 스크립트가 거부한다)
export PRODUCTION_DATABASE_URL='postgresql://altteulmap_admin:<비밀번호>@127.0.0.1:15432/altteulmap'

npm run db:migrate
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run db:check:production   # 이 스크립트는 DATABASE_URL을 읽는다
```

**초기 데이터**: `db:seed:production`은 행 단위 insert라 지연이 큰 터널에서는 매우 느리다(수십 분). 이전 때는 로컬에서 seed한 DB를 `pg_dump --data-only -Fc -t users -t auth_accounts -t categories -t places -t place_categories -t price_items -t price_reports`로 떠서 `pg_restore --data-only --disable-triggers`로 넣었다(COPY라 수 초).

**seed 계정 정리(필수)**: seed가 만드는 `admin@altteulmap.local`·`demo@altteulmap.local`은 알려진 비밀번호를 가진다. 운영에 넣은 직후 바꾼다.

```bash
DATABASE_URL="$PRODUCTION_DATABASE_URL" TARGET_EMAIL=admin@altteulmap.local NEW_PASSWORD='<12자 이상 무작위>' npx tsx scripts/set-credentials-password.ts
DATABASE_URL="$PRODUCTION_DATABASE_URL" TARGET_EMAIL=demo@altteulmap.local DISABLE_LOGIN=1 npx tsx scripts/set-credentials-password.ts
```

그다음 VPS에서 Worker용 role을 만든다.

```bash
cd ~/altteulmap && ENV_FILE=$HOME/altteulmap/altteulmap.env COMPOSE_FILE=$HOME/altteulmap/postgres.yml ./grant-app-role.sh
```

## 3. Cloudflare Tunnel + Workers VPC + Hyperdrive (적용 완료)

Cloudflare 문서의 권장 방식(Access·service token 없이 VPC Service 사용)을 따랐다. Postgres가 TLS를 쓰므로 compose의 `pgcerts`가 사설 CA와 서버 인증서를 만든다.

1. **터널**: API로 원격 관리 터널을 만들고(`POST /accounts/$ACCOUNT_ID/cfd_tunnel`, `{"name":"altteulmap-db","config_src":"cloudflare"}`) 토큰(`GET .../cfd_tunnel/$TUNNEL_ID/token`)을 `altteulmap.env`의 `TUNNEL_TOKEN`에 넣는다. `cloudflared` 서비스가 연결한다.
2. **CA 업로드**: `pgcerts` 볼륨의 `ca.crt`(공개 인증서)를 mTLS 인증서(`ca: true`, `POST /accounts/$ACCOUNT_ID/mtls_certificates`)로 올린다. PEM 끝의 개행을 제거해야 파싱된다.
3. **VPC Service**: `POST /accounts/$ACCOUNT_ID/connectivity/directory/services`
   `{"type":"tcp","name":"altteulmap-db","tcp_port":5432,"app_protocol":"postgresql","host":{"hostname":"postgres","resolver_network":{"tunnel_id":"<id>"}},"tls_settings":{"certificate_authority":"<ca-id>","cert_verification_mode":"verify_full"}}`
4. **Hyperdrive**: `wrangler hyperdrive create altteulmap-db --service-id <vpc-service-id> --database altteulmap --user altteulmap_app --password <APP_DB_PASSWORD> --scheme postgresql`
5. `wrangler.jsonc`의 `hyperdrive` binding에 id를 넣는다(`localConnectionString`은 로컬 개발용). 앱은 `HYPERDRIVE`가 있으면 `DATABASE_URL`보다 우선 쓴다(`src/worker/db.ts`).
6. `npm run deploy` 후 `GET /api/health?deep=1`의 `database`가 `ok`(`source: hyperdrive`)인지 확인한다.

> wrangler 4.79(Node 20)는 `--certificate-authority`를 지원하지 않아 CA 업로드와 VPC Service 생성은 위처럼 API로 했다. wrangler 최신판은 Node 22.12 이상이 필요하다.

## 4. 백업

```bash
# crontab -e (VPS)
17 4 * * * ENV_FILE=$HOME/altteulmap/altteulmap.env $HOME/altteulmap/backup.sh >> /opt/backups/altteulmap/backup.log 2>&1
```

복구 리허설은 `npm run db:rehearse:backup`([백업·복구](../../docs/09-운영-가이드/백업-복구.md))을 쓴다. 백업 파일은 VPS 밖(다른 호스트 또는 오브젝트 스토리지)으로도 주기적으로 복사해야 VPS 장애에 대비된다.

## 5. 지연 (2026-11-23 측정)

VPS는 오스트리아에 있다. 같은 대륙(VPS에서 Worker 호출)에서는 지도 조회 0.43~0.63s, Worker 안의 `select 1`은 14ms였다. 엣지에서 먼 곳(미국 서부 경유로 보인 측정 머신)에서는 지도 조회와 상세가 약 1.9s였다(요청당 DB 왕복이 대륙을 건넌다). Worker를 `aws:eu-central-1`에 고정하면 DB 지연은 줄지만 호출자↔Worker 구간이 늘어 전체가 더 느려져(지도 약 5.6s) 고정하지 않고 `placement.mode: smart`만 켰다.

한국 사용자가 목표(지도 p95 1초)를 못 맞추면 선택지는 ① 공개 GET 응답의 엣지 캐시(짧은 `s-maxage`), ② 가까운 리전의 Postgres로 Hyperdrive 대상만 교체(코드 변경 없음)다. 결과는 [ADR 0004](../../docs/adr/0004-request-scoped-db-connection.md)에 기록한다.
