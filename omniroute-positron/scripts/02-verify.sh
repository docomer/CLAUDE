#!/bin/bash
# Verify the fallback setup end to end, using only what OmniRoute already exposes:
#   - combos / call_logs tables (read-only)
#   - X-OmniRoute-Model / X-OmniRoute-Provider / X-OmniRoute-Fallback-Attempts response headers
#
#   scripts/02-verify.sh            config checks + one live request through the combo
#   scripts/02-verify.sh --no-live  config checks only (no tokens spent)
#   scripts/02-verify.sh --regression  also send max_tokens=128000 (the old Claude Code value)
#                                      to show whether the fallbacks would be filtered
set -uo pipefail

COMBO="${COMBO:-my-pro-fallback}"
DB="$HOME/.omniroute/storage.sqlite"
SQL="${SQLITE:-/usr/bin/sqlite3} -readonly"
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0; FAIL=0
ok()   { echo "  ✅ $*"; PASS=$((PASS+1)); }
bad()  { echo "  ❌ $*"; FAIL=$((FAIL+1)); }
info() { echo "  ·  $*"; }

LIVE=1; REGRESSION=0
for a in "$@"; do
  case "$a" in
    --no-live) LIVE=0 ;;
    --regression) REGRESSION=1 ;;
  esac
done

read_env() {
  node -e '
    const s = JSON.parse(require("fs").readFileSync(process.env.HOME + "/.claude/settings.json", "utf8"));
    const v = (s.env || {})[process.argv[1]];
    if (v !== undefined) process.stdout.write(String(v));
  ' "$1"
}

echo "1. Claude Code settings (~/.claude/settings.json)"
MAX_OUT="$(read_env CLAUDE_CODE_MAX_OUTPUT_TOKENS)"
if [ -n "$MAX_OUT" ] && [ "$MAX_OUT" -le 65535 ]; then ok "CLAUDE_CODE_MAX_OUTPUT_TOKENS=$MAX_OUT (<= 65535, fallbacks stay eligible)"
else bad "CLAUDE_CODE_MAX_OUTPUT_TOKENS='${MAX_OUT:-unset}' -> run scripts/01-fix-fallback.sh"; fi
BASE="$(read_env ANTHROPIC_BASE_URL)"; BASE="${BASE:-http://127.0.0.1:20128}"; BASE="${BASE%/}"
KEY="$(read_env ANTHROPIC_AUTH_TOKEN)"; [ -z "$KEY" ] && KEY="$(read_env ANTHROPIC_API_KEY)"
case "$BASE" in *20128*) ok "ANTHROPIC_BASE_URL=$BASE (OmniRoute)";; *) bad "ANTHROPIC_BASE_URL=$BASE is not OmniRoute";; esac

POS="$HOME/Library/Application Support/Positron/User/settings.json"
if [ -f "$POS" ] && grep -qE '909[90]' "$POS"; then bad "Positron settings still reference the old proxy (9099/9100) - stage 0b.1"
else ok "Positron settings do not reference 9099/9100"; fi

echo; echo "2. Combo '$COMBO' order"
EXPECTED='claude/claude-opus-5-5,agy/claude-opus-4-6-thinking,agy/claude-sonnet-4-6,agy/gemini-3.1-pro-high'
STRAT_FILE="$(mktemp)"
ACTUAL="$($SQL "$DB" "SELECT data FROM combos WHERE name='$COMBO'" | node -e '
  let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>{
    const j = JSON.parse(d || "{}");
    const steps = (j.models||[]).map(m => typeof m === "string" ? m
      : ((m.provider||m.providerId) && !String(m.model).includes("/") ? `${m.provider||m.providerId}/${m.model}` : m.model));
    console.log(steps.join(","));
    console.error("strategy=" + (j.strategy || "priority"));
  });' 2>"$STRAT_FILE")"
info "$(cat "$STRAT_FILE")"; rm -f "$STRAT_FILE"
if [ "$ACTUAL" = "$EXPECTED" ]; then ok "order: ${ACTUAL//,/ → }"
else bad "order is: ${ACTUAL//,/ → }"; info "expected: ${EXPECTED//,/ → }"; fi

echo; echo "3. Connections"
$SQL -separator ' | ' "$DB" "SELECT provider, coalesce(name,email,id), CASE is_active WHEN 1 THEN 'active' ELSE 'INACTIVE' END FROM provider_connections WHERE provider IN ('claude','agy','antigravity') ORDER BY provider" | sed 's/^/  ·  /'

echo; echo "4. Network exposure"
LISTEN="$(lsof -iTCP:20128 -sTCP:LISTEN -n -P 2>/dev/null | awk 'NR>1{print $9}' | sort -u | tr '\n' ' ')"
case "$LISTEN" in
  *127.0.0.1:20128*|*'[::1]:20128'*) ok "20128 bound to loopback ($LISTEN)";;
  "") bad "nothing listening on 20128 - is OmniRoute running?";;
  *) bad "20128 is exposed: $LISTEN -> stage 3 (OMNIROUTE_SERVER_HOST=127.0.0.1)";;
esac
OLD="$(lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -E ':(9099|9100) ' || true)"
if [ -z "$OLD" ]; then ok "old proxies 9099/9100 are down"; else info "old proxies still listening (stage 0b.4):"; echo "$OLD" | sed 's/^/      /'; fi

echo; echo "5. Recent combo traffic (call_logs)"
$SQL -header -column "$DB" "SELECT substr(timestamp,12,8) t, status, provider, model, combo_step_id step, substr(error_summary,1,50) err FROM call_logs WHERE combo_name='$COMBO' OR requested_model='$COMBO' ORDER BY timestamp DESC LIMIT 8" | sed 's/^/     /'
N503="$($SQL "$DB" "SELECT count(*) FROM call_logs WHERE (combo_name='$COMBO' OR requested_model='$COMBO') AND status=503 AND timestamp >= strftime('%Y-%m-%dT%H:%M:%S', 'now', '-60 minutes')")"
if [ "${N503:-0}" -eq 0 ]; then ok "no 503s in the last hour"; else bad "$N503 × 503 in the last hour"; fi

echo; echo "6. Quotas"
node "$HERE/../bin/omni-status.js" --combo "$COMBO" | sed -n '/^Quotas/,$p' | sed 's/^/  /'

send() { # $1 = max_tokens
  local hdr body code
  hdr="$(mktemp)"; body="$(mktemp)"
  code="$(curl -sS -o "$body" -D "$hdr" -w '%{http_code}' --max-time 180 \
    "$BASE/v1/messages" \
    -H "content-type: application/json" -H "anthropic-version: 2023-06-01" \
    -H "x-api-key: $KEY" -H "authorization: Bearer $KEY" \
    -d "{\"model\":\"$COMBO\",\"max_tokens\":$1,\"messages\":[{\"role\":\"user\",\"content\":\"Reply with one word: shalom\"}]}")"
  echo "     max_tokens=$1 -> HTTP $code"
  grep -iE '^x-omniroute-(model|provider|fallback-attempts|emergency-fallback|combo-trace):' "$hdr" | tr -d '\r' | sed 's/^/       /'
  if [ "$code" != "200" ]; then head -c 400 "$body" | sed 's/^/       body: /'; echo; fi
  rm -f "$hdr" "$body"
  [ "$code" = "200" ]
}

if [ "$LIVE" = 1 ]; then
  echo; echo "7. Live request through $COMBO"
  if [ -z "$KEY" ]; then bad "no ANTHROPIC_AUTH_TOKEN / ANTHROPIC_API_KEY in ~/.claude/settings.json"
  elif send "${MAX_OUT:-32000}"; then ok "combo answered (see X-OmniRoute-Model above = who answered)"
  else bad "combo failed with the current max_tokens"; fi
  if [ "$REGRESSION" = 1 ] && [ -n "$KEY" ]; then
    echo "     regression: the old Claude Code value"
    send 128000 && info "128000 also succeeded (Claude is up, so it answered)" \
                || info "128000 failed as expected while Claude is unavailable - this is the original bug"
  fi
fi

echo; echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
