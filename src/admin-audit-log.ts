// /admin-audit-log.html — P2c: site-admin read view of the audit log.
//
// Backed by GET /api/admin/audit-log (polar-dock #349). The endpoint
// itself is gated on the server (site_admin only); the sidebar link
// is also hidden for non-site-admins via lib/site.ts. This page just
// renders rows + filters and auto-refreshes every 30s.
//
// Pattern mirrors admin-plugins.ts: byId helpers, hydrateSiteBrand /
// hydrateSidebarFoot bootstrap, single-page table with a topbar
// refresh button. No framework — DOM API only.

import { listAdminAuditLog } from "./api/admin_audit.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { AdminAuditQuery, AdminAuditRow } from "./types/admin_audit.js";

initStoredTheme();
bindThemeSync();

// ---- DOM refs ----
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const auditTable = byId<HTMLTableElement>("auditTable");
const auditTbody = byId<HTMLTableSectionElement>("auditTbody");
const auditEmpty = byId<HTMLElement>("auditEmpty");
const auditLoading = byId<HTMLElement>("auditLoading");
const auditError = byId<HTMLElement>("auditError");
const auditMeta = byId<HTMLElement>("auditMeta");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

const filterActor = byId<HTMLSelectElement>("filterActor");
const filterCategory = byId<HTMLSelectElement>("filterCategory");
const filterAction = byId<HTMLInputElement>("filterAction");
const filterSince = byId<HTMLInputElement>("filterSince");
const filterLimit = byId<HTMLInputElement>("filterLimit");
const filterApplyBtn = byId<HTMLButtonElement>("filterApplyBtn");
const filterResetBtn = byId<HTMLButtonElement>("filterResetBtn");

// ---- helpers ----
function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function truncateID(id: string, head = 8): string {
  if (!id) return "";
  if (id.length <= head + 2) return id;
  return `${id.slice(0, head)}…`;
}

function fmtAbsolute(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function fmtRelative(ts: string): string {
  try {
    const then = new Date(ts).getTime();
    const now = Date.now();
    const diffSec = Math.round((now - then) / 1000);
    if (Number.isNaN(diffSec)) return ts;
    if (diffSec < 5) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const min = Math.round(diffSec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.round(hr / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
  } catch {
    return ts;
  }
}

const CATEGORY_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  provisioning: { bg: "rgba(59,130,246,0.16)", fg: "#1d4ed8", label: "provisioning" },
  reconciliation: { bg: "rgba(16,185,129,0.16)", fg: "#047857", label: "reconciliation" },
  config: { bg: "rgba(107,114,128,0.16)", fg: "#374151", label: "config" },
  audit_read: { bg: "rgba(107,114,128,0.08)", fg: "#6b7280", label: "audit_read" },
};

function categoryChip(cat: string): string {
  const style = CATEGORY_STYLES[cat] ?? { bg: "rgba(107,114,128,0.12)", fg: "#374151", label: cat || "—" };
  return (
    `<span class="badge" style="background:${style.bg}; color:${style.fg};">` +
    escapeHTML(style.label) +
    `</span>`
  );
}

function renderActor(row: AdminAuditRow): string {
  const username = row.actor_username ? escapeHTML(row.actor_username) : "<em>unknown</em>";
  const id = row.actor_user_id ? `<code style="font-size:11px; color:var(--text-muted,#888);">${escapeHTML(truncateID(row.actor_user_id))}</code>` : "";
  return `<div>${username}</div>${id ? `<div>${id}</div>` : ""}`;
}

function renderTarget(row: AdminAuditRow): string {
  if (!row.target_kind && !row.target_id) return "—";
  const kind = row.target_kind ? escapeHTML(row.target_kind) : "?";
  const id = row.target_id ? escapeHTML(truncateID(row.target_id)) : "";
  const team = row.target_team_id
    ? `<div style="font-size:11px; color:var(--text-muted,#888);">team ${escapeHTML(truncateID(row.target_team_id))}</div>`
    : "";
  return `<code>${kind}${id ? `#${id}` : ""}</code>${team}`;
}

function renderPayload(row: AdminAuditRow): string {
  const has = row.payload && Object.keys(row.payload).length > 0;
  if (!has) return `<span class="meta-subtitle">—</span>`;
  const body = escapeHTML(JSON.stringify(row.payload, null, 2));
  return (
    `<details>` +
    `<summary style="cursor:pointer; color:var(--text-muted,#888);">payload</summary>` +
    `<pre style="margin:4px 0 0; padding:6px; background:var(--badge-neutral-bg,#f1f1f1); border-radius:4px; max-width:360px; overflow:auto; font-size:11px;">${body}</pre>` +
    `</details>`
  );
}

function renderRow(row: AdminAuditRow): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const created = `<div title="${escapeHTML(fmtAbsolute(row.created_at))}">${escapeHTML(fmtRelative(row.created_at))}</div>`;
  const cells = [
    created,
    renderActor(row),
    `<code style="font-size:11px;">${escapeHTML(row.actor_role || "—")}</code>`,
    categoryChip(row.action_category),
    `<code>${escapeHTML(row.action)}</code>`,
    renderTarget(row),
    row.source_ip ? `<code style="font-size:11px;">${escapeHTML(row.source_ip)}</code>` : "—",
    renderPayload(row),
  ];
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
  return tr;
}

// ---- actor dropdown ----
function refreshActorDropdown(rows: AdminAuditRow[]): void {
  // Preserve the current selection across refreshes so auto-refresh
  // doesn't keep clobbering the user's filter pick.
  const current = filterActor.value;
  const seen = new Map<string, string>();
  for (const r of rows) {
    if (!r.actor_user_id) continue;
    if (!seen.has(r.actor_user_id)) {
      const label = r.actor_username
        ? `${r.actor_username} (${truncateID(r.actor_user_id)})`
        : truncateID(r.actor_user_id);
      seen.set(r.actor_user_id, label);
    }
  }
  filterActor.innerHTML = `<option value="">所有 actor</option>`;
  for (const [id, label] of seen) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    filterActor.appendChild(opt);
  }
  if (current && seen.has(current)) {
    filterActor.value = current;
  }
}

// ---- filter state ----
function readFilters(): AdminAuditQuery {
  const q: AdminAuditQuery = {};
  if (filterActor.value) q.actor_user_id = [filterActor.value];
  if (filterCategory.value) q.action_category = [filterCategory.value];
  const action = filterAction.value.trim();
  if (action) q.action = [action];
  if (filterSince.value) {
    // <input type="date"> ships YYYY-MM-DD with no TZ; treat as local
    // midnight then send as ISO. Backend expects RFC3339.
    const d = new Date(filterSince.value);
    if (!Number.isNaN(d.getTime())) q.since = d.toISOString();
  }
  const limRaw = parseInt(filterLimit.value, 10);
  if (Number.isFinite(limRaw) && limRaw > 0) {
    q.limit = Math.min(limRaw, 500);
  } else {
    q.limit = 100;
  }
  return q;
}

// ---- refresh ----
let inFlight = false;
async function refresh(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  auditLoading.hidden = false;
  auditError.hidden = true;
  auditError.textContent = "";
  try {
    const q = readFilters();
    const { response, data } = await listAdminAuditLog(q);
    if (!response.ok) {
      const errBody = data as unknown as { error?: string };
      if (response.status === 403) {
        renderForbidden();
        return;
      }
      auditError.hidden = false;
      auditError.textContent = `加载失败：${errBody.error || `HTTP ${response.status}`}`;
      return;
    }
    const rows = data.rows ?? [];
    refreshActorDropdown(rows);
    auditTbody.innerHTML = "";
    rows.forEach((r) => auditTbody.appendChild(renderRow(r)));
    auditTable.hidden = rows.length === 0;
    auditEmpty.hidden = rows.length !== 0;
    auditMeta.textContent = `${data.count} 条 / limit ${data.limit}`;
  } catch (err) {
    auditError.hidden = false;
    auditError.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    auditLoading.hidden = true;
    inFlight = false;
  }
}

function renderForbidden(): void {
  auditTable.hidden = true;
  auditEmpty.hidden = true;
  auditError.hidden = false;
  auditError.innerHTML =
    `你不是 site admin，无法查看全站审计日志。` +
    `如确实需要，请联系 root team owner。` +
    `<br><small>如果你是某个团队的成员，可以查看该团队范围内的 admin actions —— 后续会在团队页加入口。</small>`;
}

// ---- bootstrap ----
refreshBtn.addEventListener("click", () => void refresh());
filterApplyBtn.addEventListener("click", () => void refresh());
filterResetBtn.addEventListener("click", () => {
  filterActor.value = "";
  filterCategory.value = "";
  filterAction.value = "";
  filterSince.value = "";
  filterLimit.value = "100";
  void refresh();
});
logoutBtn?.addEventListener("click", () => {
  void logout();
});

// Auto-refresh every 30s. Skip while a fetch is already in flight
// (see inFlight guard inside refresh()) and skip when the tab is
// hidden — no point burning a request the user can't see.
const AUTO_REFRESH_MS = 30_000;
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  void refresh();
}, AUTO_REFRESH_MS);

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await refresh();
})();
