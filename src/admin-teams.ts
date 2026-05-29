// /admin-teams.html — R2-4 site-admin team-creation approval queue.
// Lists pending teams (explicitly-created collaboration teams await
// approval; home teams are auto-active) with 批准 / 拒绝. Approving a
// team also provisions its default AI team bot (server-side).

import {
  approveTeam,
  listPendingTeams,
  rejectTeam,
  type PendingTeam,
} from "./api/teams_admin.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

const tbody = byId<HTMLTableSectionElement>("teamTbody");
const table = byId<HTMLTableElement>("teamTable");
const emptyEl = byId<HTMLElement>("teamEmpty");
const loadingEl = byId<HTMLElement>("teamLoading");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(ts?: string): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function renderRow(t: PendingTeam): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const cells = [
    escapeHTML(t.name),
    `<code>${escapeHTML(t.slug)}</code>`,
    escapeHTML(t.owner_user_id),
    t.description ? escapeHTML(t.description) : "—",
    fmt(t.created_at),
    `<div style="display:flex; gap:4px;">
       <button class="btn-inline btn-primary" data-approve="${escapeHTML(t.id)}">批准</button>
       <button class="btn-inline btn-secondary" data-reject="${escapeHTML(t.id)}" style="color:var(--danger,#c00);">拒绝</button>
     </div>`,
  ];
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
  tr.querySelector("[data-approve]")?.addEventListener("click", () => void onApprove(t.id, t.name));
  tr.querySelector("[data-reject]")?.addEventListener("click", () => void onReject(t.id, t.name));
  return tr;
}

async function refresh(): Promise<void> {
  loadingEl.hidden = false;
  table.hidden = true;
  emptyEl.hidden = true;
  try {
    const { response, data } = await listPendingTeams();
    if (!response.ok) {
      emptyEl.hidden = false;
      if (response.status === 403 || response.status === 401) {
        emptyEl.textContent = "你不是 site admin（不是 root team 成员），无法审批团队创建。";
      } else {
        const err = data as unknown as { error?: string };
        emptyEl.textContent = `加载失败：${err.error || `HTTP ${response.status}`}`;
      }
      return;
    }
    const items = data.teams ?? [];
    tbody.innerHTML = "";
    items.forEach((t) => tbody.appendChild(renderRow(t)));
    table.hidden = items.length === 0;
    emptyEl.hidden = items.length !== 0;
    if (items.length === 0) emptyEl.textContent = "暂无待审批的团队创建申请。";
  } catch (err) {
    emptyEl.hidden = false;
    emptyEl.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    loadingEl.hidden = true;
  }
}

async function onApprove(id: string, name: string): Promise<void> {
  if (!confirm(`批准团队「${name}」？将激活该团队并为其自动开通默认 AI 助手。`)) return;
  try {
    await approveTeam(id);
    await refresh();
  } catch (err) {
    alert(`批准失败：${(err as Error).message}`);
  }
}

async function onReject(id: string, name: string): Promise<void> {
  if (!confirm(`拒绝团队「${name}」的创建申请？`)) return;
  try {
    await rejectTeam(id);
    await refresh();
  } catch (err) {
    alert(`拒绝失败：${(err as Error).message}`);
  }
}

refreshBtn.addEventListener("click", () => void refresh());
document.getElementById("logoutBtn")?.addEventListener("click", () => void logout());

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await refresh();
})();
