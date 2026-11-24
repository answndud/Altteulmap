#!/usr/bin/env bash
# backups/vps/ 의 최신 덤프를 age로 암호화해 Workers KV에 올리고(최근 KEEP개 유지), 선택적으로 복구까지 검증한다.
# 맥과 VPS가 둘 다 없어져도 KV 사본과 개인키(age-identity.txt)가 있으면 복구할 수 있다.
# R2를 켜면 업로드/다운로드 두 함수만 바꾸면 된다.
#   npm run backup:offsite            # 업로드
#   npm run backup:offsite -- --verify # 업로드 후 다시 내려받아 복호화·구조·체크섬 검증
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SRC="${BACKUP_PULL_DIR:-$ROOT/backups/vps}"
KEEP="${OFFSITE_KEEP:-6}"
VERIFY=0
[ "${1:-}" = "--verify" ] && VERIFY=1

set -a; . "$ROOT/.env.vps"; set +a
: "${OFFSITE_KV_NAMESPACE_ID:?OFFSITE_KV_NAMESPACE_ID is required in .env.vps}"
: "${OFFSITE_AGE_RECIPIENT:?OFFSITE_AGE_RECIPIENT is required in .env.vps}"
IDENTITY="$ROOT/${OFFSITE_AGE_IDENTITY_FILE:-backups/offsite/age-identity.txt}"
command -v age >/dev/null || { echo "age is required (brew install age)" >&2; exit 1; }

kv() { npx --no-install wrangler kv key "$@" --namespace-id "$OFFSITE_KV_NAMESPACE_ID" --remote; }

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

latest="$(ls -1t "$SRC"/altteulmap-*.dump 2>/dev/null | head -1)"
[ -n "$latest" ] || { echo "no dump in $SRC (run npm run backup:pull first)" >&2; exit 1; }
name="$(basename "$latest")"
key="$name.age"
sha_plain="$(shasum -a 256 "$latest" | cut -d' ' -f1)"

age -r "$OFFSITE_AGE_RECIPIENT" -o "$work/$key" "$latest"
kv put "$key" --path "$work/$key" >/dev/null
echo "uploaded $key ($(wc -c < "$work/$key" | tr -d ' ') bytes, encrypted)"

# 오래된 사본 정리(최근 KEEP개 유지). 키 이름에 UTC 시각이 들어 있어 정렬하면 시간순이다.
kv list | python3 -c 'import json,sys; [print(k["name"]) for k in json.load(sys.stdin)]' | sort \
  | awk -v keep="$KEEP" '{ names[NR] = $0 } END { for (i = 1; i <= NR - keep; i++) print names[i] }' \
  | while read -r old; do
      kv delete "$old" >/dev/null && echo "pruned $old"
    done

if [ "$VERIFY" = 1 ]; then
  [ -f "$IDENTITY" ] || { echo "identity file not found: $IDENTITY" >&2; exit 1; }
  kv get "$key" > "$work/downloaded.age"
  age -d -i "$IDENTITY" -o "$work/restored.dump" "$work/downloaded.age"
  sha_restored="$(shasum -a 256 "$work/restored.dump" | cut -d' ' -f1)"
  [ "$sha_plain" = "$sha_restored" ] || { echo "checksum mismatch after offsite round trip" >&2; exit 1; }
  if docker info >/dev/null 2>&1; then
    docker run --rm -i postgres:17-alpine pg_restore --list < "$work/restored.dump" >/dev/null
    echo "verified: download → decrypt → sha256 match → pg_restore --list ok"
  else
    echo "verified: download → decrypt → sha256 match (docker off: skipped pg_restore --list)"
  fi
  # KV에 저장된 값이 평문 덤프가 아니라 age 암호문인지 확인한다.
  head -c 22 "$work/downloaded.age" | grep -q "age-encryption.org" || { echo "stored object is not age ciphertext" >&2; exit 1; }
  echo "stored object is age ciphertext"
fi
