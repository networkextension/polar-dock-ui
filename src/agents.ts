// /agents.html — Agent Identity v4 / Phase F.
//
// Logical-instance view: list every agent across the workspace, with
// links back to the host it runs on. Sibling to https://hosts.4950.store:2443/hosts.html (the
// physical-asset view). See doc/arch/agent-identity-v4.md.
//
// Server status as of 2026-05-27: GET /api/agents and GET
// /api/hosts/:id/agents are NOT yet implemented; the dock side only
// has /internal/v1/agents/register (PR #355). This page calls the
// expected public endpoints and renders a friendly "endpoint pending"
// hint when the server returns 404. Once the dock follow-up lands no
// client changes are required.
//
// Pattern mirrors admin-audit-log.ts: byId helpers, plain DOM API,
// hydrateSiteBrand + hydrateSidebarFoot bootstrap, no framework.

import { fetchAgents, fetchAgentsForHost } from "./api/agents.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { Agent } from "./types/agents.js";

initStoredTheme();
bindThemeSync();

// ── helpers ────────────────────────────────────────────────────────────────

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtAbsoluteISO(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function fmtRelativeISO(ts?: string): string {
  if (!ts) return "—";
  try {
    const then = new Date(ts).getTime();
    if (!Number.isFinite(then)) return ts;
    const diffSec = Math.round((Date.now() - then) / 1000);
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const m = Math.round(diffSec / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  } catch {
    return ts;
  }
}

// helloAgeColor mirrors the dot-color rules on https://hosts.4950.store:2443/hosts.html so the
// two pages tell the same story about freshness.
function helloAgeColor(ts?: string): string {
  if (!ts) return "#9ca3af";
  const then = new Date(ts).getTime();
  if (!Number.isFinite(then)) return "#9ca3af";
  const sec = (Date.now() - then) / 1000;
  if (sec < 120) return "#10b981";   // <2 min: green
  if (sec < 3600) return "#f59e0b";  // <1 h: yellow
  return "#ef4444";                  // >=1 h: red
}

// Token suffix: server may pre-trim into agent_token_id_suffix; if
// not, fall back to the last 8 of the raw id. Empty string → "—".
function tokenSuffix(a: Agent): string {
  if (a.agent_token_id_suffix) return a.agent_token_id_suffix;
  const t = a.agent_token_id || "";
  if (!t) return "—";
  return t.length <= 8 ? t : t.slice(-8);
}

// fmtIPv4ByIface renders "en0: 192.168.11.35 · utun0: 10.88.0.7"
// for the per-iface map shipped on hello frames (agent v0.3.4+).
// Sorted alphabetically so the display is stable. Returns "" when
// missing/empty — caller substitutes an em dash.
function fmtIPv4ByIface(map?: Record<string, string>): string {
  if (!map) return "";
  const keys = Object.keys(map).filter((k) => map[k]).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${escapeHTML(k)}: ${escapeHTML(map[k])}`).join(" · ");
}

function hostLabel(a: Agent): string {
  if (a.host_name) return a.host_name;
  if (a.host_hw_model) {
    const arch = a.arch ? ` / ${a.arch}` : "";
    return `${a.host_hw_model}${arch}`;
  }
  // Fallback: short host_id (first 8 + ellipsis).
  if (a.host_id) {
    const short = a.host_id.length > 12 ? `${a.host_id.slice(0, 12)}…` : a.host_id;
    return short;
  }
  return "—";
}

// ── state ──────────────────────────────────────────────────────────────────

type State = {
  agents: Agent[];
  loaded: boolean;
  hostIDFilter: string;
  osFilter: string;
};

const state: State = {
  agents: [],
  loaded: false,
  hostIDFilter: "",
  osFilter: "",
};

function readQueryHostID(): string {
  return new URLSearchParams(window.location.search).get("host_id") ?? "";
}

// ── render ─────────────────────────────────────────────────────────────────

function renderRow(a: Agent): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const helloColor = helloAgeColor(a.last_hello_at);
  const dot = `<span title="${escapeHTML(a.last_hello_at || "never")}" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${helloColor}; vertical-align:middle; margin-right:6px;"></span>`;
  const hostHref = `https://hosts.4950.store:2443/hosts.html?id=${encodeURIComponent(a.host_id)}`;
  const osArch = `${escapeHTML(a.os || "?")} / ${escapeHTML(a.arch || "?")}`;
  const idShort = a.id.length > 14 ? `${a.id.slice(0, 14)}…` : a.id;
  const botCell = a.bot_user_id
    ? `<code style="font-size:11px;">${escapeHTML(a.bot_user_id)}</code>`
    : `<span class="meta-subtitle" style="font-style:italic;">(none)</span>`;
  // host_info ride-along may be absent if the agents endpoint returns
  // the minimal shape (dock side does, polar-hosts side joins it in).
  // Empty/missing renders as "—" so the column stays aligned.
  const ipv4Line = fmtIPv4ByIface(a.host_info?.ipv4_by_iface);
  const ipv4Cell = ipv4Line
    ? `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px;">${ipv4Line}</span>`
    : `<span class="meta-subtitle">—</span>`;
  tr.innerHTML =
    `<td><strong>${escapeHTML(a.name || "(unnamed)")}</strong></td>` +
    `<td><code title="${escapeHTML(a.id)}" style="font-size:11px;">${escapeHTML(idShort)}</code></td>` +
    `<td><a href="${hostHref}" title="${escapeHTML(a.host_id)}" style="color:var(--accent, #2563eb); text-decoration:none;">${escapeHTML(hostLabel(a))}</a></td>` +
    `<td>${ipv4Cell}</td>` +
    `<td>${botCell}</td>` +
    `<td>${osArch}</td>` +
    `<td><code style="font-size:11px;">${escapeHTML(tokenSuffix(a))}</code></td>` +
    `<td>${dot}<span title="${escapeHTML(fmtAbsoluteISO(a.last_hello_at))}">${escapeHTML(fmtRelativeISO(a.last_hello_at))}</span></td>` +
    `<td><span title="${escapeHTML(fmtAbsoluteISO(a.created_at))}">${escapeHTML(fmtRelativeISO(a.created_at))}</span></td>`;
  return tr;
}

function applyFilters(rows: Agent[]): Agent[] {
  return rows.filter((a) => {
    if (state.hostIDFilter && a.host_id !== state.hostIDFilter) return false;
    if (state.osFilter && a.os !== state.osFilter) return false;
    return true;
  });
}

function render(): void {
  const tbody = byId<HTMLTableSectionElement>("agentsTbody");
  const table = byId<HTMLTableElement>("agentsTable");
  const empty = byId<HTMLElement>("agentsEmpty");
  const loading = byId<HTMLElement>("agentsLoading");
  const meta = byId<HTMLElement>("agentsMeta");

  loading.hidden = state.loaded;

  if (!state.loaded) {
    table.hidden = true;
    empty.hidden = true;
    meta.textContent = "";
    return;
  }

  const filtered = applyFilters(state.agents);
  meta.textContent = `${filtered.length} / ${state.agents.length} agents`;

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }
  table.hidden = false;
  empty.hidden = true;
  for (const a of filtered) tbody.appendChild(renderRow(a));
}

// ── load ───────────────────────────────────────────────────────────────────

let inFlight = false;
async function refresh(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  const errEl = byId<HTMLElement>("agentsError");
  errEl.hidden = true;
  errEl.textContent = "";
  try {
    // Prefer the host-scoped endpoint when the URL pins us to a
    // single host — keeps the wire payload small even if the
    // server-side returns hundreds of rows for /api/agents.
    const result = state.hostIDFilter
      ? await fetchAgentsForHost(state.hostIDFilter)
      : await fetchAgents();
    const { response, data } = result;
    if (!response.ok) {
      // 404 is the expected state until the server-side handler ships;
      // surface it as an informational hint, not a red error.
      if (response.status === 404) {
        errEl.hidden = false;
        errEl.style.color = "var(--text-muted, #6b7280)";
        errEl.textContent =
          "GET /api/agents 尚未实现（待 dock 后续 PR 接入）。本页面 UI 已就绪，等接口上线即可显示数据。";
        state.agents = [];
        state.loaded = true;
        render();
        return;
      }
      errEl.hidden = false;
      errEl.style.color = "var(--danger, #c00)";
      errEl.textContent = `加载失败：${data.error || `HTTP ${response.status}`}`;
      return;
    }
    state.agents = data.agents ?? [];
    state.loaded = true;
    render();
  } catch (err) {
    // JSON parse failures usually mean the dock isn't serving JSON at
    // this path yet (returns 404 HTML page). Treat the same as a 404:
    // friendly hint, not a red wall.
    const msg = (err as Error).message || "";
    if (msg.includes("JSON")) {
      errEl.hidden = false;
      errEl.style.color = "var(--text-muted, #6b7280)";
      errEl.textContent =
        "GET /api/agents 尚未实现（待 dock 后续 PR 接入）。本页面 UI 已就绪，等接口上线即可显示数据。";
      state.agents = [];
      state.loaded = true;
      render();
    } else {
      errEl.hidden = false;
      errEl.style.color = "var(--danger, #c00)";
      errEl.textContent = `加载失败：${msg}`;
    }
  } finally {
    inFlight = false;
  }
}

// ── bootstrap ──────────────────────────────────────────────────────────────

function initFilters(): void {
  const hostInput = byId<HTMLInputElement>("filterHostID");
  const osSel = byId<HTMLSelectElement>("filterOS");
  const applyBtn = byId<HTMLButtonElement>("filterApplyBtn");
  const resetBtn = byId<HTMLButtonElement>("filterResetBtn");

  // Seed from ?host_id=... URL param.
  const q = readQueryHostID();
  if (q) {
    hostInput.value = q;
    state.hostIDFilter = q;
  }

  applyBtn.addEventListener("click", () => {
    state.hostIDFilter = hostInput.value.trim();
    state.osFilter = osSel.value;
    // Keep URL in sync so the back button works.
    const url = new URL(window.location.href);
    if (state.hostIDFilter) url.searchParams.set("host_id", state.hostIDFilter);
    else url.searchParams.delete("host_id");
    window.history.replaceState(null, "", url.toString());
    void refresh();
  });

  resetBtn.addEventListener("click", () => {
    hostInput.value = "";
    osSel.value = "";
    state.hostIDFilter = "";
    state.osFilter = "";
    const url = new URL(window.location.href);
    url.searchParams.delete("host_id");
    window.history.replaceState(null, "", url.toString());
    void refresh();
  });
}

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement | null;
  logoutBtn?.addEventListener("click", () => {
    void logout().then(() => window.location.replace("/login.html"));
  });

  initFilters();

  const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement | null;
  refreshBtn?.addEventListener("click", () => void refresh());

  void refresh();

  // Auto-refresh every 30s while visible — matches the audit-log page
  // cadence. Re-render every 5s so the relative "last hello" stays fresh.
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    void refresh();
  }, 30_000);
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!state.loaded) return;
    render();
  }, 5_000);
})();
