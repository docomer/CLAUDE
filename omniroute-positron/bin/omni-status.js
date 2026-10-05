#!/usr/bin/env node
"use strict";
// Who is answering right now + remaining quota, from OmniRoute's own DB.
//   node omni-status.js            full report
//   node omni-status.js --line     one line (usable as a Claude Code statusLine command)
//   node omni-status.js --combo X  different combo (default: my-pro-fallback)

const omni = require("../extension/lib/omni");

const args = process.argv.slice(2);
const comboIdx = args.indexOf("--combo");
const combo = comboIdx >= 0 ? args[comboIdx + 1] : "my-pro-fallback";
const oneLine = args.includes("--line");

(async () => {
  const s = await omni.getSnapshot(combo);
  const claude = s.quotas
    .filter((q) => q.provider === "claude" && q.minRemaining !== null)
    .sort((a, b) => a.minRemaining - b.minRemaining)[0];
  const quota = claude ? ` | Claude ${Math.round(claude.minRemaining)}%` : "";

  if (oneLine) {
    if (!s.call) return console.log(`OmniRoute: no requests${quota}`);
    const who = omni.friendlyModel(s.call.model);
    const tag = Number(s.call.status) >= 500 ? `ERR ${s.call.status}` : s.stepIndex > 0 ? `fallback ${s.stepIndex + 1}/${s.steps.length}` : "primary";
    return console.log(`${who} (${tag})${quota}`);
  }

  console.log(`Combo: ${combo}`);
  s.steps.forEach((st, i) =>
    console.log(`  ${i === s.stepIndex ? ">" : " "} ${i + 1}. ${st.provider ? st.provider + "/" : ""}${st.model}`)
  );
  if (s.call) {
    console.log(`\nLast call: ${s.call.timestamp}  status=${s.call.status}  ${s.call.provider}/${s.call.model}  step=${s.call.combo_step_id || "-"}`);
    if (s.call.error_summary) console.log(`  error: ${s.call.error_summary}`);
  } else {
    console.log("\nLast call: none");
  }
  console.log(`5xx in last 10 min: ${s.failures}`);
  console.log("\nQuotas (OmniRoute providerLimitsCache):");
  for (const q of s.quotas) {
    console.log(`  ${q.provider}${q.active ? "" : " (inactive)"} - ${q.connectionName}  [fetched ${q.fetchedAt || "?"}]`);
    for (const w of q.windows) {
      const reset = omni.formatReset(w.resetAt);
      console.log(`      ${w.name.padEnd(28)} ${String(Math.round(w.remaining)).padStart(3)}%${reset ? `  resets in ${reset}` : ""}`);
    }
    if (!q.windows.length && q.message) console.log(`      ${q.message}`);
  }
})().catch((err) => {
  console.error(`omni-status: ${err.message}`);
  process.exit(1);
});
