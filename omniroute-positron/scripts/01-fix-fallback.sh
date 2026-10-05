#!/bin/bash
# Stage 1a: cap Claude Code's requested output tokens so OmniRoute keeps the
# Antigravity fallbacks in the combo pool.
#
# Root cause (OmniRoute open-sse/services/combo/comboStructure.ts):
#   filterTargetsByRequestCompatibility() treats `max_tokens > model.maxOutputTokens`
#   as a HARD failure ("output_tokens"). Every Antigravity model (Opus 4.6, Sonnet 4.6,
#   Gemini 3.1 Pro) is catalogued with maxOutputTokens ~65,536, and Claude Code asks
#   for up to 128,000. So the priority combo is reduced to [claude/opus-5-5] before any
#   request is sent; when Claude's quota runs out there is nothing left -> 503.
#   (The "last-resort compat fallback" tier, #6238, only exists for round-robin combos.)
#   Context size is NOT the problem: all three fallbacks are catalogued at 1,048,576.
#
# 32000 is below every fallback's ceiling. Override with MAX_OUT=... if you want.
set -euo pipefail

MAX_OUT="${MAX_OUT:-32000}"
SETTINGS="$HOME/.claude/settings.json"

if [ "$MAX_OUT" -gt 65535 ]; then
  echo "MAX_OUT must be <= 65535 (the Antigravity output ceiling)" >&2
  exit 1
fi

MAX_OUT="$MAX_OUT" SETTINGS="$SETTINGS" node -e '
const fs = require("fs");
const file = process.env.SETTINGS;
const s = JSON.parse(fs.readFileSync(file, "utf8"));
s.env = s.env || {};
const before = s.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
s.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = process.env.MAX_OUT;
fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
console.log(`CLAUDE_CODE_MAX_OUTPUT_TOKENS: ${before ?? "(unset)"} -> ${process.env.MAX_OUT}`);
console.log(`ANTHROPIC_BASE_URL = ${s.env.ANTHROPIC_BASE_URL ?? "(unset)"}`);
console.log(`ANTHROPIC_MODEL    = ${s.env.ANTHROPIC_MODEL ?? "(unset)"}`);
'

echo
echo "Restart Claude Code in Positron (close and reopen the Claude panel) so the new env is picked up."
echo
echo "Stage 1b is done in the dashboard: Combos -> my-pro-fallback, order must be:"
echo "  1. claude/claude-opus-5-5"
echo "  2. agy/claude-opus-4-6-thinking"
echo "  3. agy/claude-sonnet-4-6"
echo "  4. agy/gemini-3.1-pro-high"
echo "Then run scripts/02-verify.sh"
