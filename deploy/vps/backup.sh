#!/usr/bin/env bash
# 일 1회 논리 백업(pg_dump -Fc). cron 예: 17 4 * * * ENV_FILE=$HOME/altteulmap/altteulmap.env $HOME/altteulmap/backup.sh
set -Eeuo pipefail

ENV_FILE="${ENV_FILE:?set ENV_FILE}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd "$(dirname "$0")" && pwd)/postgres.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/altteulmap}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/altteulmap-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$file"

# 비어 있거나 깨진 덤프는 실패로 처리한다.
test -s "$file"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_restore --list < "$file" > /dev/null

sha256sum "$file" > "$file.sha256"
find "$BACKUP_DIR" -name 'altteulmap-*.dump*' -mtime +"$KEEP_DAYS" -delete
echo "backup ok: $file ($(du -h "$file" | cut -f1))"
