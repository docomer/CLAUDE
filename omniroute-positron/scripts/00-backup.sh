#!/bin/bash
# Stage 0a: back up everything the plan touches. Safe to re-run.
set -euo pipefail

B="${BACKUP_DIR:-$HOME/omniroute-backup-$(date +%Y-%m-%d)}"
mkdir -p "$B"

/usr/bin/sqlite3 "$HOME/.omniroute/storage.sqlite" ".backup '$B/storage.sqlite'"
cp "$HOME/.omniroute/.env" "$B/omniroute.env"
cp "$HOME/.claude/settings.json" "$B/claude-settings.json"
cp "$HOME/Library/Application Support/Positron/User/settings.json" "$B/positron-settings.json"
for p in com.user.claude-proxy com.user.claude-desktop-proxy com.omniroute.autostart; do
  f="$HOME/Library/LaunchAgents/$p.plist"
  if [ -f "$f" ]; then cp "$f" "$B/"; else echo "note: $f not found (skipped)"; fi
done

echo "Backup in $B:"
ls -1 "$B"
echo "files: $(ls -1 "$B" | wc -l | tr -d ' ') (expected 7)"
