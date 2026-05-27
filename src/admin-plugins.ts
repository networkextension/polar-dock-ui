// /admin-plugins.html — Phase 1-A: admin CRUD for the plugin registry
// (table backing /internal/v1/* HMAC auth). Mirrors the proxy-tokens
// page pattern: list table + create modal + plaintext one-time modal.

import {
  createPluginModule,
  deletePluginModule,
  disablePluginModule,
  enablePluginModule,
  listPluginModules,
  rotatePluginModuleKey,
} from "./api/plugin_modules.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { PluginModule } from "./types/plugin_modules.js";

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

function renderRow(p: PluginModule): HTMLTableRowElement {
  const tr = document.createElement("tr");
  if (!p.enabled) tr.style.opacity = "0.55";
  const cells = [
    `<code>${escapeHTML(p.name)}</code>`,
    escapeHTML(p.display_name || ""),
    p.endpoint ? `<code>${escapeHTML(p.endpoint)}</code>` : "—",
    p.enabled ? "🟢 enabled" : "💤 disabled",
    fmt(p.last_heartbeat),
    p.version ? escapeHTML(p.version) : "—",
    fmt(p.created_at),
    `<div style="display:flex; gap:4px;">
       <button class="btn-inline btn-secondary" data-rotate="${escapeHTML(p.name)}" title="rotate key">🔄</button>
       <button class="btn-inline btn-secondary" data-toggle="${escapeHTML(p.name)}" data-enabled="${p.enabled}">
         ${p.enabled ? "停用" : "启用"}
       </button>
       <button class="btn-inline btn-secondary" data-delete="${escapeHTML(p.name)}" style="color:var(--danger,#c00);">🗑</button>
     </div>`,
  ];
  tr.innerHTML = cells.map((c) => `<td>${c}</td>`).join("");
  tr.querySelector("[data-rotate]")?.addEventListener("click", () => void onRotate(p.name));
  tr.querySelector("[data-toggle]")?.addEventListener("click", () => void onToggle(p.name, p.enabled));
  tr.querySelector("[data-delete]")?.addEventListener("click", () => void onDelete(p.name));
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

// ---- bootstrap ----
refreshBtn.addEventListener("click", () => void refresh());
logoutBtn?.addEventListener("click", () => {
  void logout();
});

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await refresh();
})();
