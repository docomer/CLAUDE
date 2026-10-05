#!/bin/bash
# Stage 4: install the upgraded status bar extension into Positron (no vsce needed).
set -euo pipefail

SRC="$(cd "$(dirname "$0")/../extension" && pwd)"
VER="$(node -p "require('$SRC/package.json').version")"
EXT_DIR="$HOME/.positron/extensions"
DEST="$EXT_DIR/omeredgar.omniroute-positron-status-$VER"
B="${BACKUP_DIR:-$HOME/omniroute-backup-$(date +%Y-%m-%d)}"
mkdir -p "$B"

# Move older copies aside so only one status item shows.
for d in "$EXT_DIR"/omeredgar.omniroute-positron-status-*; do
  [ -e "$d" ] && [ "$d" != "$DEST" ] && { echo "moving old $d -> $B/"; mv "$d" "$B/"; }
done

rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
echo "Installed $DEST"
echo "In Positron: Cmd+Shift+P -> 'Developer: Reload Window'"
