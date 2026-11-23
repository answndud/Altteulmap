# 운영 DB: netcup VPS PostgreSQL

altteulmap 운영 DB는 TownPet·kinderp와 같은 netcup VPS의 **전용 PostgreSQL 컨테이너**다(TownPet DB와 공유하지 않는다). Worker는 DB 포트를 인터넷에 열지 않고 `Workers → Hyperdrive → Cloudflare Tunnel → postgres:5432`로 접속한다.

| 파일 | 역할 |
| --- | --- |
| `postgres.yml` | postgres(512MB 제한, loopback `127.0.0.1:15432`만 게시) + cloudflared |
| `altteulmap.env.example` | VPS 비밀 파일 템플릿(커밋 금지) |
| `grant-app-role.sh` | migration 후 Worker용 최소 권한 role 생성(DML만, DDL 불가) |
| `backup.sh` | 일 1회 `pg_dump -Fc` + 검증 + 14일 보관 |

이 구성은 실제 VPS에 배포했다(2026-11-23: postgres 기동, migration, 데이터 복원, role 부여, 백업 cron). 로컬에서도 (migration → role 부여 → seed → 앱 통합 테스트 27개 → 백업)을 한 번 끝까지 검증했다.

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

## 3. Cloudflare Tunnel + Hyperdrive

> 아래 절차는 구성 방식 요약이다. Cloudflare 대시보드·문서의 최신 화면과 명령을 따라 확인한다(이 저장소에서는 실행하지 않았다).

1. Zero Trust > Networks > Tunnels에서 터널을 만들고 토큰을 `altteulmap.env`의 `TUNNEL_TOKEN`에 넣은 뒤 `docker compose ... up -d cloudflared`.
2. 터널에 게시 경로를 추가한다: 호스트명 `db.<내 도메인>` → 서비스 `tcp://postgres:5432`. (도메인은 Cloudflare에 등록된 것이어야 한다.)
3. 그 호스트명에 Access 애플리케이션과 Service Auth 정책을 만들고 service token을 발급한다.
4. Hyperdrive 구성을 만든다(앱 role 사용, 비밀번호는 셸 기록에 남지 않게 입력).

   ```bash
   npx wrangler hyperdrive create altteulmap-db \
     --host=db.<내 도메인> --user=altteulmap_app --database=altteulmap \
     --password=<APP_DB_PASSWORD> \
     --access-client-id=<id> --access-client-secret=<secret>
   ```

5. 출력된 Hyperdrive `id`를 `wrangler.jsonc`에 binding으로 추가한다(id는 계정 고유 값이라 저장소에 없다).

   ```jsonc
   "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "<hyperdrive-id>" }]
   ```

   앱은 `HYPERDRIVE`가 있으면 `DATABASE_URL`보다 우선 사용한다(`src/worker/db.ts`). 기존 `DATABASE_URL` secret은 binding 확인 후 삭제한다.
6. `npm run deploy` 후 확인: `curl -s https://<worker>/api/health?deep=1` 의 `database`가 `ok`, 첫 화면에 장소 목록이 보인다.

## 4. 백업

```bash
# crontab -e (VPS)
17 4 * * * ENV_FILE=$HOME/altteulmap/altteulmap.env $HOME/altteulmap/backup.sh >> /opt/backups/altteulmap/backup.log 2>&1
```

복구 리허설은 `npm run db:rehearse:backup`([백업·복구](../../docs/09-운영-가이드/백업-복구.md))을 쓴다. 백업 파일은 VPS 밖(다른 호스트 또는 오브젝트 스토리지)으로도 주기적으로 복사해야 VPS 장애에 대비된다.

## 5. 지연 확인

Worker(엣지)와 VPS 사이 왕복이 이전 DB(Supabase 서울)보다 길 수 있다. 이전 후 `npm run map:measure`로 지도 조회 p95를 재고, 목표(1초) 안인지 [ADR 0004](../../docs/adr/0004-request-scoped-db-connection.md)에 기록한다. 초과하면 `DATABASE_URL`/Hyperdrive 대상만 바꿔 가까운 리전의 Postgres로 되돌릴 수 있다(코드 변경 없음).
