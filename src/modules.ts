// /modules.html — R3-3b tenant module marketplace. Lists published
// modules with this workspace's state (已开通 / 申请中 / 可申请) and lets
// a team-admin apply for ones that accept applications. Backed by
// GET /api/teams/:id/available-modules + POST /api/teams/:id/plugin-requests.

import { applyForModule, listAvailableModules } from "./api/marketplace.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import { getCurrentWorkspaceID, installWorkspaceSwitcher } from "./lib/workspace.js";
import type { AvailableModule } from "./types/plugin_modules.js";

initStoredTheme();
bindThemeSync();

const tbody = byId<HTMLTableSectionElement>("modTbody");
const table = byId<HTMLTableElement>("modTable");
const emptyEl = byId<HTMLElement>("modEmpty");
const loadingEl = byId<HTMLElement>("modLoading");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function statusCell(m: AvailableModule): string {
  if (m.enabled) return "🟢 已开通";
  if (m.pending_request) return "⏳ 申请中";
  if (m.accepts_applications) return "可申请";
  return "—（暂不开放申请）";
}

function renderRow(teamID: string, m: AvailableModule): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const canApply = !m.enabled && !m.pending_request && m.accepts_applications;
  const action = canApply
    ? `<button class="btn-inline btn-primary" data-apply="${escapeHTML(m.name)}">申请开通</button>`
    : "—";
  const cells = [
    escapeHTML(m.display_name || m.name),
    `<code>${escapeHTML(m.name)}</code>`,
    statusCell(m),
    action,
  ];
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
  if (canApply) {
    tr.querySelector("[data-apply]")?.addEventListener("click", () =>
      void onApply(teamID, m.name, m.display_name || m.name),
    );
  }
  return tr;
}

async function refresh(): Promise<void> {
  const teamID = getCurrentWorkspaceID();
  loadingEl.hidden = false;
  table.hidden = true;
  emptyEl.hidden = true;
  if (!teamID) {
    loadingEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = "请先在左下角选择一个工作区。";
    return;
  }
  try {
    const { response, data } = await listAvailableModules(teamID);
    if (!response.ok) {
      emptyEl.hidden = false;
      const err = data as unknown as { error?: string };
      emptyEl.textContent =
        response.status === 403
          ? "你不是该工作区成员，无法查看模块市场。"
          : `加载失败：${err.error || `HTTP ${response.status}`}`;
      return;
    }
    const items = data.modules ?? [];
    tbody.innerHTML = "";
    items.forEach((m) => tbody.appendChild(renderRow(teamID, m)));
    table.hidden = items.length === 0;
    emptyEl.hidden = items.length !== 0;
    if (items.length === 0) emptyEl.textContent = "市场暂无已上架的模块。";
  } catch (err) {
    emptyEl.hidden = false;
    emptyEl.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    loadingEl.hidden = true;
  }
}

async function onApply(teamID: string, name: string, label: string): Promise<void> {
  const reason = prompt(`申请开通「${label}」模块的理由（可选）：`, "");
  if (reason === null) return; // cancelled
  try {
    const { response, data } = await applyForModule(teamID, {
      plugin_name: name,
      scope: "module",
      reason: reason.trim(),
    });
    if (!response.ok) {
      const err = data as unknown as { error?: string };
      if (response.status === 403) {
        alert("只有团队管理员（owner / admin）可以申请模块。");
      } else if (response.status === 409) {
        alert("已存在一个待处理的申请。");
      } else {
        alert(`申请失败：${err.error || `HTTP ${response.status}`}`);
      }
      return;
    }
    await refresh();
  } catch (err) {
    alert(`申请失败：${(err as Error).message}`);
  }
}

refreshBtn.addEventListener("click", () => void refresh());
document.getElementById("logoutBtn")?.addEventListener("click", () => void logout().then(() => window.location.replace("/login.html")));

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await installWorkspaceSwitcher();
  await refresh();
})();
