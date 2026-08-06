// /admin-plugins.html — Phase 1-A: admin CRUD for the plugin registry
// (table backing /internal/v1/* HMAC auth). Mirrors the proxy-tokens
// page pattern: list table + create modal + plaintext one-time modal.

import {
  approvePluginAccessRequest,
  createPluginModule,
  deletePluginModule,
  denyPluginAccessRequest,
  disablePluginModule,
  enablePluginModule,
  listPluginAccessRequests,
  listPluginModules,
  rotatePluginModuleKey,
  setPluginModuleAcceptsApplications,
  setPluginModulePublished,
  updatePluginModule,
} from "./api/plugin_modules.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { PluginAccessRequest, PluginModule } from "./types/plugin_modules.js";

initStoredTheme();
bindThemeSync();

// ---- DOM refs ----
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const createBtn = byId<HTMLButtonElement>("createBtn");
const pluginTable = byId<HTMLTableElement>("pluginTable");
const pluginTbody = byId<HTMLTableSectionElement>("pluginTbody");
const pluginEmpty = byId<HTMLElement>("pluginEmpty");
const pluginLoading = byId<HTMLElement>("pluginLoading");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

// R3 marketplace: tenant access-request queue.
const reqTable = byId<HTMLTableElement>("reqTable");
const reqTbody = byId<HTMLTableSectionElement>("reqTbody");
const reqEmpty = byId<HTMLElement>("reqEmpty");

const createModal = byId<HTMLElement>("createModal");
const createCloseBtn = byId<HTMLButtonElement>("createCloseBtn");
const createCancelBtn = byId<HTMLButtonElement>("createCancelBtn");
const createSubmitBtn = byId<HTMLButtonElement>("createSubmitBtn");
const createName = byId<HTMLInputElement>("createName");
const createDisplayName = byId<HTMLInputElement>("createDisplayName");
const createEndpoint = byId<HTMLInputElement>("createEndpoint");
const createError = byId<HTMLElement>("createError");

const plaintextModal = byId<HTMLElement>("plaintextModal");
const plaintextValue = byId<HTMLInputElement>("plaintextValue");
const plaintextCopyBtn = byId<HTMLButtonElement>("plaintextCopyBtn");
const plaintextCloseBtn = byId<HTMLButtonElement>("plaintextCloseBtn");
const plaintextOkBtn = byId<HTMLButtonElement>("plaintextOkBtn");

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt(ts?: string): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

// versionCell shows the running version and, when a newer published build
// exists (Track 3 OTA), the latest version + a 更新 button that pins it.
// A pending pin (target_version set but not yet rolled) shows ⏳.
function versionCell(p: PluginModule): string {
  const running = p.version ? escapeHTML(p.version) : "—";
  const pinned = (p.target_version ?? "").trim();
  if (pinned && pinned !== p.version) {
    return `${running} <span style="opacity:.7">⏳ → ${escapeHTML(pinned)}</span>`;
  }
  if (p.update_available && p.latest_version) {
    return `${running} <span style="opacity:.7">→ ${escapeHTML(p.latest_version)}</span>
      <button class="btn-inline btn-primary" data-update="${escapeHTML(p.name)}"
        data-version="${escapeHTML(p.latest_version)}" title="roll to ${escapeHTML(p.latest_version)}">更新</button>`;
  }
  return running;
}

function renderRow(p: PluginModule): HTMLTableRowElement {
  const tr = document.createElement("tr");
  if (!p.enabled) tr.style.opacity = "0.55";
  const marketBadges =
    (p.published ? ' · <span title="已上架到市场">🛒上架</span>' : "") +
    (p.accepts_applications ? ' · <span title="允许租户申请">📝可申请</span>' : "");
  const cells = [
    `<code>${escapeHTML(p.name)}</code>`,
    escapeHTML(p.display_name || ""),
    p.endpoint ? `<code>${escapeHTML(p.endpoint)}</code>` : "—",
    `${p.enabled ? "🟢 enabled" : "💤 disabled"}${marketBadges}`,
    fmt(p.last_heartbeat),
    versionCell(p),
    fmt(p.created_at),
    `<div style="display:flex; gap:4px; flex-wrap:wrap;">
       <button class="btn-inline btn-secondary" data-rotate="${escapeHTML(p.name)}" title="rotate key">🔄</button>
       <button class="btn-inline btn-secondary" data-toggle="${escapeHTML(p.name)}" data-enabled="${p.enabled}">
         ${p.enabled ? "停用" : "启用"}
       </button>
       <button class="btn-inline btn-secondary" data-publish="${escapeHTML(p.name)}" data-pub="${!!p.published}">
         ${p.published ? "下架" : "上架"}
       </button>
       <button class="btn-inline btn-secondary" data-accepts="${escapeHTML(p.name)}" data-acc="${!!p.accepts_applications}">
         ${p.accepts_applications ? "关申请" : "开申请"}
       </button>
       <button class="btn-inline btn-secondary" data-delete="${escapeHTML(p.name)}" style="color:var(--danger,#c00);">🗑</button>
     </div>`,
  ];
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
  tr.querySelector("[data-rotate]")?.addEventListener("click", () => void onRotate(p.name));
  tr.querySelector("[data-toggle]")?.addEventListener("click", () => void onToggle(p.name, p.enabled));
  tr.querySelector("[data-publish]")?.addEventListener("click", () => void onTogglePublish(p.name, !!p.published));
  tr.querySelector("[data-accepts]")?.addEventListener("click", () => void onToggleAccepts(p.name, !!p.accepts_applications));
  tr.querySelector("[data-delete]")?.addEventListener("click", () => void onDelete(p.name));
  const updBtn = tr.querySelector<HTMLButtonElement>("[data-update]");
  updBtn?.addEventListener("click", () => void onUpdate(p.name, updBtn.dataset.version || ""));
  return tr;
}

async function refresh(): Promise<void> {
  pluginLoading.hidden = false;
  pluginTable.hidden = true;
  pluginEmpty.hidden = true;
  try {
    const { response, data } = await listPluginModules();
    if (!response.ok) {
      // P2b: distinguish forbidden from generic error so a non-site-admin
      // who deep-links to /admin-plugins.html gets a clear message instead
      // of a permanent "加载中..." (or an opaque "HTTP 403"). 401 lands
      // here too if the access cookie is gone and refresh failed — same
      // friendly framing applies.
      pluginEmpty.hidden = false;
      if (response.status === 403 || response.status === 401) {
        pluginEmpty.textContent =
          "你不是 site admin（不是 root team 成员），无法管理 plugin 注册。如确实需要，请联系 root team owner。";
      } else {
        const errBody = data as unknown as { error?: string };
        pluginEmpty.textContent = `加载失败：${errBody.error || `HTTP ${response.status}`}`;
      }
      return;
    }
    const items = data.plugins ?? [];
    pluginTbody.innerHTML = "";
    items.forEach((p) => pluginTbody.appendChild(renderRow(p)));
    pluginTable.hidden = items.length === 0;
    pluginEmpty.hidden = items.length !== 0;
    if (items.length === 0) {
      pluginEmpty.textContent = "暂无 plugin。点右上「+ 新建 Plugin」开始。";
    }
  } catch (err) {
    pluginEmpty.hidden = false;
    pluginEmpty.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    pluginLoading.hidden = true;
  }
}

// ---- create modal ----
createBtn.addEventListener("click", () => {
  createName.value = "";
  createDisplayName.value = "";
  createEndpoint.value = "";
  createError.textContent = "";
  createModal.hidden = false;
  createName.focus();
});
createCloseBtn.addEventListener("click", () => (createModal.hidden = true));
createCancelBtn.addEventListener("click", () => (createModal.hidden = true));

createSubmitBtn.addEventListener("click", async () => {
  const name = createName.value.trim();
  if (!name) {
    createError.textContent = "name 必填";
    return;
  }
  createSubmitBtn.disabled = true;
  createError.textContent = "";
  try {
    const { response, data } = await createPluginModule({
      name,
      display_name: createDisplayName.value.trim(),
      endpoint: createEndpoint.value.trim(),
    });
    if (!response.ok) {
      const errBody = data as unknown as { error?: string };
      createError.textContent = errBody.error || `HTTP ${response.status}`;
      return;
    }
    const plain = data.plugin?.plaintext;
    if (!plain) {
      createError.textContent = "服务端未返回 plaintext，请刷新后联系管理员";
      return;
    }
    createModal.hidden = true;
    showPlaintext(plain);
    await refresh();
  } catch (err) {
    createError.textContent = (err as Error).message;
  } finally {
    createSubmitBtn.disabled = false;
  }
});

// ---- plaintext one-time modal ----
function showPlaintext(p: string): void {
  plaintextValue.value = p;
  plaintextModal.hidden = false;
  plaintextValue.select();
}
plaintextCloseBtn.addEventListener("click", () => (plaintextModal.hidden = true));
plaintextOkBtn.addEventListener("click", () => (plaintextModal.hidden = true));
plaintextCopyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(plaintextValue.value);
    plaintextCopyBtn.textContent = "已复制 ✓";
    setTimeout(() => (plaintextCopyBtn.textContent = "复制"), 1500);
  } catch {
    plaintextValue.select();
    document.execCommand("copy");
  }
});

// ---- row actions ----
async function onRotate(name: string): Promise<void> {
  if (!confirm(`轮换 plugin「${name}」的 HMAC key？旧 key 立即失效，必须把新 plaintext 给 plugin operator。`)) return;
  try {
    const { data } = await rotatePluginModuleKey(name);
    showPlaintext(data.plaintext);
  } catch (err) {
    alert(`轮换失败：${(err as Error).message}`);
  }
}

async function onToggle(name: string, enabled: boolean): Promise<void> {
  try {
    if (enabled) await disablePluginModule(name);
    else await enablePluginModule(name);
    await refresh();
  } catch (err) {
    alert(`切换失败：${(err as Error).message}`);
  }
}

async function onDelete(name: string): Promise<void> {
  if (!confirm(`删除 plugin「${name}」？hard delete，不可恢复。建议先用「停用」。`)) return;
  if (!confirm(`再次确认删除「${name}」？`)) return;
  try {
    await deletePluginModule(name);
    await refresh();
  } catch (err) {
    alert(`删除失败：${(err as Error).message}`);
  }
}

async function onUpdate(name: string, version: string): Promise<void> {
  if (!version) return;
  if (!confirm(`把 plugin「${name}」更新到 ${version}？\n下一次心跳（≤60s）时模块会拉取新二进制、校验、热替换并重启。`)) return;
  try {
    const { response, data } = await updatePluginModule(name, version);
    if (!response.ok) {
      const errBody = data as unknown as { error?: string };
      alert(`更新失败：${errBody.error || `HTTP ${response.status}`}`);
      return;
    }
    await refresh();
  } catch (err) {
    alert(`更新失败：${(err as Error).message}`);
  }
}

async function onTogglePublish(name: string, published: boolean): Promise<void> {
  try {
    await setPluginModulePublished(name, !published);
    await refresh();
  } catch (err) {
    alert(`上架切换失败：${(err as Error).message}`);
  }
}

async function onToggleAccepts(name: string, accepts: boolean): Promise<void> {
  try {
    await setPluginModuleAcceptsApplications(name, !accepts);
    await refresh();
  } catch (err) {
    alert(`申请开关切换失败：${(err as Error).message}`);
  }
}

// ---- R3 marketplace: access-request queue ----
function renderRequestRow(r: PluginAccessRequest): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const scope = r.scope === "api" ? `api：<code>${escapeHTML(r.api_route || "")}</code>` : "整个模块";
  const cells = [
    `<code>${escapeHTML(r.plugin_name)}</code>`,
    `<code>${escapeHTML(r.workspace_id)}</code>`,
    scope,
    escapeHTML(r.requested_by_user_id),
    r.reason ? escapeHTML(r.reason) : "—",
    fmt(r.created_at),
    `<div style="display:flex; gap:4px;">
       <button class="btn-inline btn-primary" data-approve="${r.id}">批准</button>
       <button class="btn-inline btn-secondary" data-deny="${r.id}" style="color:var(--danger,#c00);">拒绝</button>
     </div>`,
  ];
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
  tr.querySelector("[data-approve]")?.addEventListener("click", () => void onApprove(r.id, r.plugin_name));
  tr.querySelector("[data-deny]")?.addEventListener("click", () => void onDeny(r.id, r.plugin_name));
  return tr;
}

async function refreshRequests(): Promise<void> {
  try {
    const { response, data } = await listPluginAccessRequests();
    if (!response.ok) {
      // 403/401 already surfaced by the module list; keep the queue quiet.
      reqTable.hidden = true;
      reqEmpty.hidden = false;
      reqEmpty.textContent = "（无法加载申请队列）";
      return;
    }
    const items = data.requests ?? [];
    reqTbody.innerHTML = "";
    items.forEach((r) => reqTbody.appendChild(renderRequestRow(r)));
    reqTable.hidden = items.length === 0;
    reqEmpty.hidden = items.length !== 0;
    if (items.length === 0) reqEmpty.textContent = "暂无待处理的模块申请。";
  } catch (err) {
    reqTable.hidden = true;
    reqEmpty.hidden = false;
    reqEmpty.textContent = `加载失败：${(err as Error).message}`;
  }
}

async function onApprove(id: number, plugin: string): Promise<void> {
  if (!confirm(`批准对「${plugin}」的申请？将为该工作区开通此模块。`)) return;
  try {
    await approvePluginAccessRequest(id);
    await refreshRequests();
  } catch (err) {
    alert(`批准失败：${(err as Error).message}`);
  }
}

async function onDeny(id: number, plugin: string): Promise<void> {
  if (!confirm(`拒绝对「${plugin}」的申请？`)) return;
  try {
    await denyPluginAccessRequest(id);
    await refreshRequests();
  } catch (err) {
    alert(`拒绝失败：${(err as Error).message}`);
  }
}

// ---- bootstrap ----
refreshBtn.addEventListener("click", () => {
  void refresh();
  void refreshRequests();
});
logoutBtn?.addEventListener("click", () => {
  void logout().then(() => window.location.replace("/login.html"));
});

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await refresh();
  await refreshRequests();
})();
