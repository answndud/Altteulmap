#!/usr/bin/env bash
# VPS 백업 사본 가져오기를 매월 자동 실행하도록 macOS LaunchAgent를 설치/제거한다.
#   bash scripts/install-backup-launchd.sh install
#   bash scripts/install-backup-launchd.sh uninstall
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.altteulmap.backup-pull"
TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"

case "${1:-}" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$ROOT/backups/vps"
    sed "s#__PROJECT_DIR__#$ROOT#g" "$ROOT/deploy/macos/$LABEL.plist.template" > "$TARGET"
    plutil -lint "$TARGET" >/dev/null
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$TARGET"
    echo "installed: $TARGET (매월 1일 10:00)"
    ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$TARGET"
    echo "removed: $TARGET"
    ;;
  *)
    echo "usage: $0 install|uninstall" >&2
    exit 1
    ;;
esac
