#!/bin/bash
# Stage 3: bind OmniRoute to loopback only, then restart it via its LaunchAgent.
# The macOS firewall is a system security setting - turn it on yourself:
#   System Settings -> Network -> Firewall -> On
set -euo pipefail

ENV_FILE="$HOME/.omniroute/.env"
LABEL="${OMNIROUTE_LABEL:-com.omeredgar.omniroute}"

if grep -q '^OMNIROUTE_SERVER_HOST=' "$ENV_FILE"; then
  sed -i '' 's/^OMNIROUTE_SERVER_HOST=.*/OMNIROUTE_SERVER_HOST=127.0.0.1/' "$ENV_FILE"
else
  printf '\nOMNIROUTE_SERVER_HOST=127.0.0.1\n' >> "$ENV_FILE"
fi
grep '^OMNIROUTE_SERVER_HOST=' "$ENV_FILE"

launchctl kickstart -k "gui/$(id -u)/$LABEL"
for _ in $(seq 1 30); do
  lsof -iTCP:20128 -sTCP:LISTEN -n -P >/dev/null 2>&1 && break
  sleep 1
done
lsof -iTCP:20128 -sTCP:LISTEN -n -P
echo "Expected 127.0.0.1:20128 (not *:20128). Firewall: $(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo unknown)"
