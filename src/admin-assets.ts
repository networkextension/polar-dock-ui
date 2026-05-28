// /admin-assets.html — root admin view. Workspace quota table with
// inline edit + provider registry with add/delete. Site-admin only;
// non-admin users see the empty banner because the backend returns
// 403 on the underlying endpoints.

import {
  createAdminAssetProvider,
  deleteAdminAssetProvider,
  listAdminAssetProviders,
  listAdminAssetQuotas,
  setAdminAssetQuota,
} from "./api/admin-assets.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { AssetQuota } from "./types/assets.js";
import type {
  AdminAssetQuotaListResponse,
  AssetProvider,
} from "./types/admin-assets.js";

initStoredTheme();
bindThemeSync();

const quotasTbody = byId<HTMLTableSectionElement>("quotasTbody");
const quotasEmpty = byId<HTMLDivElement>("quotasEmpty");
const rootConfigEl = byId<HTMLDivElement>("rootConfig");

const providersTbody = byId<HTMLTableSectionElement>("providersTbody");
const providersEmpty = byId<HTMLDivElement>("providersEmpty");
const addProviderOpenBtn = byId<HTMLButtonElement>("addProviderOpenBtn");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");

// Edit-quota modal
const editQuotaModal = byId<HTMLDivElement>("editQuotaModal");
const editQuotaTitle = byId<HTMLSpanElement>("editQuotaTitle");
const editQuotaCurrent = byId<HTMLDivElement>("editQuotaCurrent");
const editQuotaInput = byId<HTMLInputElement>("editQuotaInput");
const editQuotaSubmit = byId<HTMLButtonElement>("editQuotaSubmit");
const editQuotaCancel = byId<HTMLButtonElement>("editQuotaCancel");
const editQuotaError = byId<HTMLDivElement>("editQuotaError");

// Add-provider modal
const addProviderModal = byId<HTMLDivElement>("addProviderModal");
const addProviderSlug = byId<HTMLInputElement>("addProviderSlug");
const addProviderBaseUrl = byId<HTMLInputElement>("addProviderBaseUrl");
const addProviderRegion = byId<HTMLInputElement>("addProviderRegion");
const addProviderCapacity = byId<HTMLInputElement>("addProviderCapacity");
const addProviderSubmit = byId<HTMLButtonElement>("addProviderSubmit");
const addProviderCancel = byId<HTMLButtonElement>("addProviderCancel");
const addProviderError = byId<HTMLDivElement>("addProviderError");
const addProviderResult = byId<HTMLDivElement>("addProviderResult");

let editTargetWorkspace: string | null = null;

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtGB(bytes: number): string {
  return `${(bytes / (1 << 30)).toFixed(2)} GB`;
}

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function usageBar(usage: number, cap: number): string {
  const pct = cap > 0 ? Math.min((usage / cap) * 100, 100) : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 80 ? "#d97706" : "#16a34a";
  return `
    <div style="display:flex; align-items:center; gap:6px;">
      <div style="flex:1; height:6px; min-width:80px; background:var(--surface-2, #e5e7eb); border-radius:3px; overflow:hidden;">
        <div style="width:${pct.toFixed(1)}%; height:100%; background:${color};"></div>
      </div>
      <span style="font-size:11px; white-space:nowrap;">${pct.toFixed(1)}%</span>
    </div>
  `;
}

async function refreshQuotas(): Promise<void> {
  let data: AdminAssetQuotaListResponse | undefined;
  try {
    const r = await listAdminAssetQuotas();
    if (!r.response.ok) {
      if (r.response.status === 403 || r.response.status === 401) {
        quotasEmpty.textContent = "你不是 site admin，无权访问此页面。";
      } else {
        quotasEmpty.textContent = `加载失败: HTTP ${r.response.status}`;
      }
      quotasEmpty.hidden = false;
      return;
    }
    data = r.data;
  } catch (err) {
    quotasEmpty.textContent = `加载失败: ${(err as Error).message}`;
    quotasEmpty.hidden = false;
    return;
  }
  renderRootConfig(data);
  renderQuotas(data.quotas);
}

function renderRootConfig(d: AdminAssetQuotaListResponse): void {
  const modeText = d.root_config.mode === "absolute"
    ? `${fmtGB(d.root_config.value)} (绝对值)`
    : d.root_config.mode === "partition_pct"
    ? `${d.root_config.value}% 分区（未启用）`
    : `${d.root_config.mode}=${d.root_config.value}`;
  rootConfigEl.innerHTML = `
    <div><strong>根配额：</strong> ${esc(modeText)}</div>
    <div><strong>有效上限：</strong> ${d.root_cap_bytes > 0 ? fmtGB(d.root_cap_bytes) : "无限（未启用）"}</div>
    <div><strong>默认工作区配额：</strong> ${fmtGB(d.root_config.workspace_default_bytes)}</div>
  `;
}

function renderQuotas(rows: AssetQuota[]): void {
  quotasTbody.innerHTML = "";
  if (rows.length === 0) {
    quotasEmpty.textContent = "还没有工作区使用记录。";
    quotasEmpty.hidden = false;
    return;
  }
  quotasEmpty.hidden = true;
  for (const q of rows) {
    const tr = document.createElement("tr");
    const overBadge = q.over_quota
      ? `<span style="display:inline-block; padding:1px 6px; font-size:11px; background:#dc2626; color:white; border-radius:8px;">超额</span>`
      : "";
    tr.innerHTML = `
      <td><code>${esc(q.workspace_id)}</code></td>
      <td style="text-align:right;">${fmtBytes(q.quota_bytes)}</td>
      <td style="text-align:right;">${fmtBytes(q.usage_bytes)}</td>
      <td style="min-width:160px;">${usageBar(q.usage_bytes, q.quota_bytes)}</td>
      <td>${overBadge}</td>
      <td><button data-edit="${esc(q.workspace_id)}" data-cap="${q.quota_bytes}" data-usage="${q.usage_bytes}" class="btn-inline btn-secondary">✏ 改配额</button></td>
    `;
    quotasTbody.appendChild(tr);
  }
}

quotasTbody.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const ws = target.getAttribute("data-edit");
  if (!ws) return;
  const cap = Number(target.getAttribute("data-cap"));
  const usage = Number(target.getAttribute("data-usage"));
  editTargetWorkspace = ws;
  editQuotaTitle.textContent = ws;
  editQuotaCurrent.innerHTML = `当前用量 ${fmtBytes(usage)} / ${fmtBytes(cap)}`;
  editQuotaInput.value = String(Math.round(cap / (1 << 30) * 100) / 100);
  editQuotaError.innerHTML = "";
  editQuotaModal.hidden = false;
});

editQuotaCancel.addEventListener("click", () => {
  editQuotaModal.hidden = true;
});

editQuotaSubmit.addEventListener("click", async () => {
  if (!editTargetWorkspace) return;
  const gb = Number(editQuotaInput.value);
  if (!Number.isFinite(gb) || gb < 0) {
    editQuotaError.textContent = "请输入非负数字（GB）";
    return;
  }
  const bytes = Math.round(gb * (1 << 30));
  editQuotaSubmit.disabled = true;
  try {
    const { response, data } = await setAdminAssetQuota(
      editTargetWorkspace,
      bytes,
    );
    if (!response.ok) {
      editQuotaError.textContent = data?.error || `HTTP ${response.status}`;
      return;
    }
    if (data?.warning) {
      editQuotaError.innerHTML = `<div style="color:#d97706;">⚠ ${esc(data.warning)}</div>`;
    } else {
      editQuotaModal.hidden = true;
    }
    await refreshQuotas();
  } catch (err) {
    editQuotaError.textContent = (err as Error).message;
  } finally {
    editQuotaSubmit.disabled = false;
  }
});

async function refreshProviders(): Promise<void> {
  try {
    const { response, data } = await listAdminAssetProviders();
    if (!response.ok) {
      providersEmpty.textContent = `加载失败: HTTP ${response.status}`;
      providersEmpty.hidden = false;
      return;
    }
    renderProviders(data.providers);
  } catch (err) {
    providersEmpty.textContent = `加载失败: ${(err as Error).message}`;
    providersEmpty.hidden = false;
  }
}

function renderProviders(rows: AssetProvider[]): void {
  providersTbody.innerHTML = "";
  if (rows.length === 0) {
    providersEmpty.textContent = "还没有注册任何 provider。";
    providersEmpty.hidden = false;
    return;
  }
  providersEmpty.hidden = true;
  const now = Date.now();
  for (const p of rows) {
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at) : null;
    const ageStr = lastSeen
      ? `${Math.round((now - lastSeen.getTime()) / 1000)}s 前`
      : "—";
    const healthy = lastSeen && (now - lastSeen.getTime()) < 5 * 60 * 1000;
    const healthBadge = healthy
      ? `<span style="display:inline-block; width:8px; height:8px; background:#16a34a; border-radius:50%;"></span>`
      : `<span style="display:inline-block; width:8px; height:8px; background:#64748b; border-radius:50%;"></span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${healthBadge} <code>${esc(p.slug)}</code></td>
      <td><code style="font-size:11px;">${esc(p.base_url)}</code></td>
      <td>${esc(p.region)}</td>
      <td style="text-align:right;">${p.capacity_gb} GB</td>
      <td>${esc(ageStr)}</td>
      <td><button data-delete="${p.id}" data-slug="${esc(p.slug)}" class="btn-inline btn-secondary">删除</button></td>
    `;
    providersTbody.appendChild(tr);
  }
}

providersTbody.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const id = target.getAttribute("data-delete");
  if (!id) return;
  const slug = target.getAttribute("data-slug") || id;
  if (!confirm(`确定删除 provider "${slug}" ？\n这会断开所有分配到该 provider 的 asset_locations。`)) return;
  const { response, data } = await deleteAdminAssetProvider(Number(id));
  if (!response.ok) {
    alert(`删除失败: ${data?.error || response.statusText}`);
    return;
  }
  await refreshProviders();
});

addProviderOpenBtn.addEventListener("click", () => {
  addProviderSlug.value = "";
  addProviderBaseUrl.value = "https://";
  addProviderRegion.value = "";
  addProviderCapacity.value = "500";
  addProviderError.textContent = "";
  addProviderResult.innerHTML = "";
  addProviderModal.hidden = false;
});

addProviderCancel.addEventListener("click", () => {
  addProviderModal.hidden = true;
});

addProviderSubmit.addEventListener("click", async () => {
  addProviderError.textContent = "";
  addProviderResult.innerHTML = "";
  const slug = addProviderSlug.value.trim();
  const baseUrl = addProviderBaseUrl.value.trim();
  const region = addProviderRegion.value.trim();
  const capacity = Number(addProviderCapacity.value);
  if (!slug || !baseUrl || !region) {
    addProviderError.textContent = "slug / base_url / region 必填";
    return;
  }
  if (!Number.isFinite(capacity) || capacity <= 0) {
    addProviderError.textContent = "capacity_gb 必须 > 0";
    return;
  }
  addProviderSubmit.disabled = true;
  try {
    const { response, data } = await createAdminAssetProvider({
      slug,
      base_url: baseUrl,
      region,
      capacity_gb: capacity,
    });
    if (!response.ok) {
      addProviderError.textContent = data?.error || `HTTP ${response.status}`;
      return;
    }
    const token = data.provider.hmac_token;
    if (token) {
      addProviderResult.innerHTML = `
        <div style="margin-top:8px; padding:10px; background:#fef3c7; color:#92400e; border-radius:6px;">
          <div style="font-weight:bold; margin-bottom:6px;">⚠ 一次性显示 — 请立即复制：</div>
          <input type="text" readonly value="${esc(token)}" style="width:100%; font-family:monospace; padding:4px; font-size:11px;" id="addProviderTokenInput">
          <button class="btn-inline btn-primary" style="margin-top:6px;" id="addProviderCopyBtn">复制 token</button>
          ${data.hint ? `<div style="margin-top:6px; font-size:11px;">${esc(data.hint)}</div>` : ""}
        </div>
      `;
      const copyBtn = document.getElementById("addProviderCopyBtn");
      const tokenInput = document.getElementById("addProviderTokenInput") as HTMLInputElement | null;
      if (copyBtn && tokenInput) {
        copyBtn.addEventListener("click", async () => {
          tokenInput.select();
          try {
            await navigator.clipboard.writeText(token);
            copyBtn.textContent = "已复制";
            setTimeout(() => { copyBtn.textContent = "复制 token"; }, 1500);
          } catch {
            document.execCommand("copy");
          }
        });
      }
    }
    await refreshProviders();
  } catch (err) {
    addProviderError.textContent = (err as Error).message;
  } finally {
    addProviderSubmit.disabled = false;
  }
});

refreshBtn.addEventListener("click", () => {
  void refreshQuotas();
  void refreshProviders();
});

byId<HTMLButtonElement>("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  location.href = "/login.html";
});

void (async () => {
  await Promise.all([hydrateSiteBrand(), hydrateSidebarFoot()]);
  await Promise.all([refreshQuotas(), refreshProviders()]);
})();
