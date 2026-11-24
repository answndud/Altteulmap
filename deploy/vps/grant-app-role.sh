#!/usr/bin/env bash
# migration 적용 후 실행한다. Worker가 쓰는 최소 권한 role(altteulmap_app)을 만들고 DML만 허용한다.
# 사용: ENV_FILE=/opt/altteulmap/altteulmap.env deploy/vps/grant-app-role.sh
set -Eeuo pipefail

ENV_FILE="${ENV_FILE:?set ENV_FILE}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/vps/postgres.yml}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# 복구 리허설처럼 compose 밖 컨테이너에 적용할 때는 DOCKER_CONTAINER를 지정한다.
if [ -n "${DOCKER_CONTAINER:-}" ]; then
  PSQL_EXEC=(docker exec -i "$DOCKER_CONTAINER")
else
  PSQL_EXEC=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres)
fi

"${PSQL_EXEC[@]}" \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE altteulmap_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'altteulmap_app') \gexec
ALTER ROLE altteulmap_app PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
SELECT format('GRANT CONNECT ON DATABASE %I TO altteulmap_app', :'db') \gexec
GRANT USAGE ON SCHEMA public TO altteulmap_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO altteulmap_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO altteulmap_app;
-- 이후 migration이 만드는 테이블에도 같은 권한을 준다.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO altteulmap_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO altteulmap_app;
SQL
echo "altteulmap_app role granted"
