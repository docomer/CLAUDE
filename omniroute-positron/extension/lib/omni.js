"use strict";
// Read-only access to OmniRoute's SQLite store (~/.omniroute/storage.sqlite).
// Shared by the Positron status bar extension and the omni-status CLI.
//
// Everything here relies on tables OmniRoute already maintains:
//   call_logs          - one row per upstream attempt (provider, model, combo_step_id, status)
//   combos             - combo definitions (JSON in `data`, `models` = ordered steps)
//   provider_connections - connection id -> provider / display name
//   key_value          - namespace 'providerLimitsCache' = OmniRoute's own quota cache
//                        (same data the dashboard "Provider Limits" page shows)

const { execFile } = require("child_process");
const os = require("os");
const path = require("path");

const DEFAULT_DB = path.join(os.homedir(), ".omniroute", "storage.sqlite");
const SQLITE_BIN = process.platform === "darwin" ? "/usr/bin/sqlite3" : "sqlite3";

// Antigravity serves some public model ids under an internal alias; call_logs may
// record either side, so treat both as the same combo step.
const MODEL_ALIASES = {
  "gemini-3.1-pro-high": "gemini-pro-agent",
};

function canonicalModel(model) {
  const m = String(model || "").trim();
  return MODEL_ALIASES[m] || m;
}

function sqlString(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function runQuery(sql, { dbPath = DEFAULT_DB, timeoutMs = 4000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      SQLITE_BIN,
      ["-readonly", "-json", dbPath, sql],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(err);
        const text = String(stdout || "").trim();
        if (!text) return resolve([]);
        try {
          resolve(JSON.parse(text));
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    );
  });
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Ordered list of {provider, model, label} for the combo's steps. */
async function getComboSteps(comboName, opts) {
  const rows = await runQuery(
    `SELECT data FROM combos WHERE name = ${sqlString(comboName)} LIMIT 1`,
    opts
  );
  if (!rows.length) return [];
  const data = parseJson(rows[0].data) || {};
  const models = Array.isArray(data.models) ? data.models : [];
  return models
    .map((entry) => {
      if (typeof entry === "string") {
        const slash = entry.indexOf("/");
        return slash > 0
          ? { provider: entry.slice(0, slash), model: entry.slice(slash + 1), label: null }
          : { provider: "", model: entry, label: null };
      }
      if (entry && typeof entry === "object" && typeof entry.model === "string") {
        let provider = entry.provider || entry.providerId || "";
        let model = entry.model;
        const slash = model.indexOf("/");
        if (!provider && slash > 0) {
          provider = model.slice(0, slash);
          model = model.slice(slash + 1);
        }
        return { provider, model, label: entry.label || null };
      }
      return null;
    })
    .filter(Boolean);
}

/**
 * Most recent call_logs row for the combo. A 4xx row is a single step failing
 * (e.g. Claude 429 before the combo moves on), so prefer the latest row that is
 * either a success or a combo-level 5xx.
 */
async function getLastCall(comboName, opts) {
  const rows = await runQuery(
    `SELECT timestamp, status, provider, model, requested_model, combo_name, combo_step_id,
            connection_id, substr(error_summary, 1, 160) AS error_summary
       FROM call_logs
      WHERE (combo_name = ${sqlString(comboName)} OR requested_model = ${sqlString(comboName)})
        AND (status < 400 OR status >= 500)
      ORDER BY timestamp DESC LIMIT 1`,
    opts
  );
  return rows[0] || null;
}

/** Count of 5xx combo failures in the last N minutes (fallback health). */
async function getRecentFailures(comboName, minutes, opts) {
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const rows = await runQuery(
    `SELECT count(*) AS n FROM call_logs
      WHERE (combo_name = ${sqlString(comboName)} OR requested_model = ${sqlString(comboName)})
        AND status >= 500 AND timestamp >= ${sqlString(since)}`,
    opts
  );
  return rows[0] ? Number(rows[0].n) || 0 : 0;
}

function stepIndexFor(call, steps) {
  if (!call) return -1;
  const model = canonicalModel(call.model);
  const provider = String(call.provider || "");
  let idx = steps.findIndex(
    (s) => canonicalModel(s.model) === model && (!s.provider || !provider || s.provider === provider)
  );
  if (idx === -1) idx = steps.findIndex((s) => canonicalModel(s.model) === model);
  if (idx === -1 && call.combo_step_id) {
    const m = /(\d+)\s*$/.exec(String(call.combo_step_id));
    if (m) idx = Number(m[1]) - 1;
  }
  return idx;
}

function remainingPercent(window) {
  if (!window || typeof window !== "object") return null;
  const rp = Number(window.remainingPercentage);
  if (Number.isFinite(rp)) return Math.max(0, Math.min(100, rp));
  const total = Number(window.total);
  const used = Number(window.used);
  if (Number.isFinite(total) && total > 0 && Number.isFinite(used)) {
    return Math.max(0, Math.min(100, ((total - used) / total) * 100));
  }
  return null;
}

/**
 * Quota per provider from OmniRoute's providerLimitsCache.
 * Returns [{provider, connectionName, active, fetchedAt, windows:[{name, remaining, resetAt}], minRemaining}]
 */
async function getQuotas(opts) {
  const [cacheRows, connRows] = await Promise.all([
    runQuery("SELECT key, value FROM key_value WHERE namespace = 'providerLimitsCache'", opts),
    runQuery("SELECT id, provider, name, email, is_active FROM provider_connections", opts),
  ]);
  const conns = new Map(connRows.map((c) => [c.id, c]));
  const out = [];
  for (const row of cacheRows) {
    const entry = parseJson(row.value);
    if (!entry || typeof entry !== "object") continue;
    const conn = conns.get(row.key) || {};
    const windows = [];
    for (const source of [entry.quotas, entry.modelQuotas]) {
      if (!source || typeof source !== "object") continue;
      for (const [name, w] of Object.entries(source)) {
        const remaining = remainingPercent(w);
        if (remaining === null) continue;
        windows.push({ name, remaining, resetAt: (w && w.resetAt) || null });
      }
    }
    const minRemaining = windows.length ? Math.min(...windows.map((w) => w.remaining)) : null;
    out.push({
      connectionId: row.key,
      provider: conn.provider || "?",
      connectionName: conn.name || conn.email || row.key,
      active: conn.is_active === undefined ? true : Number(conn.is_active) === 1,
      fetchedAt: entry.fetchedAt || null,
      message: entry.message || null,
      windows,
      minRemaining,
    });
  }
  return out;
}

/** One-shot snapshot used by both the extension and the CLI. */
async function getSnapshot(comboName, opts) {
  const [steps, call, failures, quotas] = await Promise.all([
    getComboSteps(comboName, opts),
    getLastCall(comboName, opts),
    getRecentFailures(comboName, 10, opts),
    getQuotas(opts).catch(() => []),
  ]);
  const stepIndex = stepIndexFor(call, steps);
  return { comboName, steps, call, stepIndex, failures, quotas };
}

const FRIENDLY = [
  [/opus-5-5/, "Opus 5.5"],
  [/opus-4-6/, "Opus 4.6"],
  [/sonnet-4-6/, "Sonnet 4.6"],
  [/gemini-3\.1-pro|gemini-pro-agent/, "Gemini 3.1 Pro"],
];

function friendlyModel(model) {
  const m = String(model || "");
  for (const [re, name] of FRIENDLY) if (re.test(m)) return name;
  return m || "?";
}

function formatReset(resetAt) {
  if (!resetAt) return "";
  const ms = Date.parse(resetAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  return d >= 1 ? `${d}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

module.exports = {
  DEFAULT_DB,
  runQuery,
  getComboSteps,
  getLastCall,
  getRecentFailures,
  getQuotas,
  getSnapshot,
  stepIndexFor,
  remainingPercent,
  friendlyModel,
  formatReset,
  canonicalModel,
};
