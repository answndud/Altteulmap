#!/usr/bin/env bash
# VPS의 최신 DB 백업을 이 저장소의 backups/vps/ 로 가져와 검증한다(VPS 밖 사본).
# 필요: .env.vps 의 VPS_SSH_HOST/USER/PORT/KEY_PATH. 백업 파일은 개인정보를 포함하므로 .gitignore 대상이다.
#   npm run backup:pull
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${BACKUP_PULL_DIR:-$ROOT/backups/vps}"
KEEP="${BACKUP_PULL_KEEP:-14}"
REMOTE_DIR="${VPS_BACKUP_DIR:-/opt/backups/altteulmap}"

set -a; . "$ROOT/.env.vps"; set +a
KEY="${VPS_SSH_KEY_PATH/#\~/$HOME}"
SSH_OPTS=(-i "$KEY" -p "${VPS_SSH_PORT:-22}" -o BatchMode=yes)
SCP_OPTS=(-i "$KEY" -P "${VPS_SSH_PORT:-22}" -o BatchMode=yes -q)
REMOTE="$VPS_SSH_USER@$VPS_SSH_HOST"

umask 077
mkdir -p "$DEST"
chmod 700 "$ROOT/backups" "$DEST"

latest="$(ssh "${SSH_OPTS[@]}" "$REMOTE" "ls -1t $REMOTE_DIR/altteulmap-*.dump 2>/dev/null | head -1")"
[ -n "$latest" ] || { echo "no backup found in $REMOTE_DIR" >&2; exit 1; }
name="$(basename "$latest")"

if [ -f "$DEST/$name" ]; then
  echo "already have $name"
else
  scp "${SCP_OPTS[@]}" "$REMOTE:$latest" "$REMOTE:$latest.sha256" "$DEST/"
fi

# 체크섬과 덤프 구조를 검증한다(실패하면 가져온 파일을 지우고 종료).
expected="$(cut -d' ' -f1 "$DEST/$name.sha256")"
actual="$(shasum -a 256 "$DEST/$name" | cut -d' ' -f1)"
if [ "$expected" != "$actual" ]; then
  rm -f "$DEST/$name" "$DEST/$name.sha256"
  echo "checksum mismatch for $name" >&2
  exit 1
fi
docker run --rm -i postgres:17-alpine pg_restore --list < "$DEST/$name" > /dev/null

# 오래된 사본 정리(최근 KEEP개 유지)
ls -1t "$DEST"/altteulmap-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
  rm -f "$old" "$old.sha256"
done

echo "backup pulled and verified: $DEST/$name ($(du -h "$DEST/$name" | cut -f1))"
