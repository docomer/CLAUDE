#!/bin/bash
# Stage 0b: remove leftovers of the old proxy setup.
# Dry run by default; pass --apply to act. Everything removed is moved into the
# backup folder, never deleted.
#
#   KEEP_DESKTOP_PROXY=1 scripts/04-cleanup.sh --apply   keep 9100 if Claude Desktop uses it
set -euo pipefail

APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
B="${BACKUP_DIR:-$HOME/omniroute-backup-$(date +%Y-%m-%d)}"
POS="$HOME/Library/Application Support/Positron/User/settings.json"
UID_GUI="gui/$(id -u)"
run() { if [ "$APPLY" = 1 ]; then echo "+ $*"; "$@"; else echo "[dry-run] $*"; fi; }

[ -f "$B/positron-settings.json" ] || { echo "Run scripts/00-backup.sh first ($B)"; exit 1; }

echo "== 1. Positron settings: drop claudeCode.environmentVariables (old 9099 proxy)"
if grep -q '"claudeCode.environmentVariables"' "$POS"; then
  if [ "$APPLY" = 1 ]; then
    # settings.json is JSONC (comments allowed) - parse leniently, drop the key and proxy comments.
    POS="$POS" node -e '
      const fs = require("fs"); const f = process.env.POS;
      const src = fs.readFileSync(f, "utf8");
      const stripped = src.replace(/^\s*\/\/.*(proxy|9099|9100).*$/gim, "");
      const obj = new Function("return (" + stripped.replace(/,(\s*[}\]])/g, "$1") + ")")();
      delete obj["claudeCode.environmentVariables"];
      fs.writeFileSync(f, JSON.stringify(obj, null, 2) + "\n");
      console.log("removed claudeCode.environmentVariables");'
  else
    echo "[dry-run] remove claudeCode.environmentVariables from $POS"
  fi
else
  echo "already clean"
fi

echo "== 2. Uninstall the Claude Proxy Status extension"
EXT_DIR="$HOME/.positron/extensions"
for d in "$EXT_DIR"/*claude-proxy-status*; do
  [ -e "$d" ] && run mv "$d" "$B/"
done

echo "== 3. Orphan OmniRoute Status 1.0.1"
[ -e "$EXT_DIR/omeredgar.omniroute-positron-status-1.0.1" ] && run mv "$EXT_DIR/omeredgar.omniroute-positron-status-1.0.1" "$B/"

echo "== 4. Old LaunchAgents"
AGENTS="com.user.claude-proxy com.omniroute.autostart"
[ "${KEEP_DESKTOP_PROXY:-0}" = 1 ] || AGENTS="$AGENTS com.user.claude-desktop-proxy"
for a in $AGENTS; do
  launchctl print "$UID_GUI/$a" >/dev/null 2>&1 && run launchctl bootout "$UID_GUI/$a" || true
  f="$HOME/Library/LaunchAgents/$a.plist"
  [ -f "$f" ] && run mv "$f" "$B/$a.plist.removed"
done

echo
lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -E ':(9099|9100) ' || echo "9099/9100: nothing listening"
[ "$APPLY" = 1 ] || echo "(dry run - re-run with --apply)"
echo "Rollback: copy files back from $B and 'launchctl bootstrap $UID_GUI ~/Library/LaunchAgents/<name>.plist'"
