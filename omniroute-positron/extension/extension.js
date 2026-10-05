"use strict";
// OmniRoute status bar for Positron / VS Code.
// Shows who is answering right now (combo step N/M + model), the remaining
// Claude quota, and turns yellow when a fallback model is serving.

const vscode = require("vscode");
const omni = require("./lib/omni");

let item;
let timer;
let inFlight = false; // never spawn a second sqlite3 while one is running
let lastSnapshot = null;
let lastStepIndex = null;
let lowQuotaWarned = false;

function cfg() {
  const c = vscode.workspace.getConfiguration("omniroute");
  return {
    combo: c.get("comboName", "my-pro-fallback"),
    dbPath: c.get("dbPath", "") || omni.DEFAULT_DB,
    intervalSec: Math.max(3, c.get("refreshSeconds", 5)),
    lowQuota: c.get("lowQuotaPercent", 10),
    dashboardUrl: c.get("dashboardUrl", "http://127.0.0.1:20128/dashboard"),
  };
}

function quotaFor(snapshot, providers) {
  const list = snapshot.quotas.filter((q) => providers.includes(q.provider) && q.minRemaining !== null);
  if (!list.length) return null;
  return list.reduce((a, b) => (b.minRemaining < a.minRemaining ? b : a));
}

function render(snapshot, c) {
  const { steps, call, stepIndex } = snapshot;
  const total = steps.length || "?";
  const claude = quotaFor(snapshot, ["claude"]);
  const quotaText = claude ? ` · Claude ${Math.round(claude.minRemaining)}%` : "";

  item.backgroundColor = undefined;
  if (!call) {
    item.text = `$(circle-outline) OmniRoute: אין בקשות${quotaText}`;
  } else if (Number(call.status) >= 500) {
    item.text = `$(error) OmniRoute ${call.status}${quotaText}`;
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  } else if (stepIndex > 0) {
    item.text = `$(warning) גיבוי ${stepIndex + 1}/${total}: ${omni.friendlyModel(call.model)}${quotaText}`;
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
  } else {
    item.text = `$(check) ${omni.friendlyModel(call.model)}${quotaText}`;
  }

  const md = new vscode.MarkdownString("", true);
  md.appendMarkdown(`**OmniRoute · ${snapshot.comboName}**\n\n`);
  steps.forEach((s, i) => {
    const mark = i === stepIndex ? "▶" : "·";
    md.appendMarkdown(`${mark} ${i + 1}. \`${s.provider ? s.provider + "/" : ""}${s.model}\`\n\n`);
  });
  if (call) {
    md.appendMarkdown(
      `---\n\nבקשה אחרונה: ${call.timestamp} · status ${call.status} · \`${call.provider}/${call.model}\`\n\n`
    );
    if (call.error_summary) md.appendMarkdown(`שגיאה: ${call.error_summary}\n\n`);
  }
  if (snapshot.failures > 0) md.appendMarkdown(`⚠️ ${snapshot.failures} כשלי 5xx ב-10 הדקות האחרונות\n\n`);
  if (snapshot.quotas.length) {
    md.appendMarkdown("---\n\n**מכסות**\n\n");
    for (const q of snapshot.quotas) {
      const windows = q.windows
        .map((w) => {
          const reset = omni.formatReset(w.resetAt);
          return `${w.name}: ${Math.round(w.remaining)}%${reset ? ` (מתאפס בעוד ${reset})` : ""}`;
        })
        .join(" · ");
      md.appendMarkdown(`- **${q.provider}**${q.active ? "" : " (כבוי)"}: ${windows || q.message || "—"}\n`);
    }
  }
  item.tooltip = md;

  // Notify once when routing moves off the primary model, and once when it returns.
  if (lastStepIndex !== null && call && Number(call.status) < 500 && stepIndex !== lastStepIndex) {
    if (stepIndex > 0 && lastStepIndex <= 0) {
      vscode.window.showWarningMessage(
        `OmniRoute עבר למודל גיבוי ${stepIndex + 1}/${total}: ${omni.friendlyModel(call.model)}`
      );
    } else if (stepIndex === 0 && lastStepIndex > 0) {
      vscode.window.showInformationMessage(`OmniRoute חזר למודל הראשי: ${omni.friendlyModel(call.model)}`);
    }
  }
  if (call && Number(call.status) < 500 && stepIndex >= 0) lastStepIndex = stepIndex;

  if (claude && claude.minRemaining < c.lowQuota && !lowQuotaWarned) {
    lowQuotaWarned = true;
    vscode.window.showWarningMessage(
      `נשארו ${Math.round(claude.minRemaining)}% ממכסת Claude. מומלץ /compact כדי שמודלי הגיבוי יקבלו את השיחה.`
    );
  } else if (claude && claude.minRemaining >= c.lowQuota) {
    lowQuotaWarned = false;
  }
}

async function refresh() {
  if (inFlight) return;
  inFlight = true;
  const c = cfg();
  try {
    lastSnapshot = await omni.getSnapshot(c.combo, { dbPath: c.dbPath });
    render(lastSnapshot, c);
  } catch (err) {
    item.text = "$(debug-disconnect) OmniRoute: אין גישה למסד";
    item.tooltip = String((err && err.message) || err);
    item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  } finally {
    inFlight = false;
  }
}

function schedule() {
  if (timer) clearInterval(timer);
  timer = setInterval(refresh, cfg().intervalSec * 1000);
}

function activate(context) {
  item = vscode.window.createStatusBarItem("omniroute.status", vscode.StatusBarAlignment.Left, 100);
  item.name = "OmniRoute";
  item.command = "omniroute.openDashboard";
  item.text = "$(sync~spin) OmniRoute";
  item.show();

  context.subscriptions.push(
    item,
    vscode.commands.registerCommand("omniroute.refresh", refresh),
    vscode.commands.registerCommand("omniroute.openDashboard", () =>
      vscode.env.openExternal(vscode.Uri.parse(cfg().dashboardUrl))
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("omniroute")) {
        schedule();
        refresh();
      }
    }),
    { dispose: () => timer && clearInterval(timer) }
  );

  schedule();
  refresh();
}

function deactivate() {
  if (timer) clearInterval(timer);
}

module.exports = { activate, deactivate };
