// /assets.html — tenant asset manager. Workspace-scoped browse +
// upload + delete + share. Backed by /api/assets, /api/asset-quota,
// /api/share-links.

import {
  createShareLink,
  deleteAsset as apiDeleteAsset,
  deleteShareLink,
  getAssetQuota,
  listAssets,
  listShareLinks,
  uploadAsset,
} from "./api/assets.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type {
  Asset,
  AssetQuota,
  AssetShareLink,
  AssetVisibility,
} from "./types/assets.js";

initStoredTheme();
bindThemeSync();

const quotaBarEl = byId<HTMLDivElement>("quotaBar");
const quotaLabelEl = byId<HTMLSpanElement>("quotaLabel");
const quotaBannerEl = byId<HTMLDivElement>("quotaBanner");
const assetsTbodyEl = byId<HTMLTableSectionElement>("assetsTbody");
const assetsEmptyEl = byId<HTMLDivElement>("assetsEmpty");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const uploadOpenBtn = byId<HTMLButtonElement>("uploadOpenBtn");

const uploadModal = byId<HTMLDivElement>("uploadModal");
const uploadFileInput = byId<HTMLInputElement>("uploadFile");
const uploadKindSelect = byId<HTMLSelectElement>("uploadKind");
const uploadNameInput = byId<HTMLInputElement>("uploadName");
const uploadVersionInput = byId<HTMLInputElement>("uploadVersion");
const uploadVisibilitySelect = byId<HTMLSelectElement>("uploadVisibility");
const uploadSourceUrlInput = byId<HTMLInputElement>("uploadSourceUrl");
const uploadMetadataInput = byId<HTMLTextAreaElement>("uploadMetadata");
const uploadSubmitBtn = byId<HTMLButtonElement>("uploadSubmit");
const uploadCancelBtn = byId<HTMLButtonElement>("uploadCancel");
const uploadErrorEl = byId<HTMLDivElement>("uploadError");

const shareModal = byId<HTMLDivElement>("shareModal");
const shareAssetNameEl = byId<HTMLSpanElement>("shareAssetName");
const shareExpiresInput = byId<HTMLInputElement>("shareExpires");
const shareMaxDownloadsInput = byId<HTMLInputElement>("shareMaxDownloads");
const shareRequireLoginInput = byId<HTMLInputElement>("shareRequireLogin");
const shareSubmitBtn = byId<HTMLButtonElement>("shareSubmit");
const shareCancelBtn = byId<HTMLButtonElement>("shareCancel");
const shareErrorEl = byId<HTMLDivElement>("shareError");
const shareResultEl = byId<HTMLDivElement>("shareResult");
const shareLinksTbodyEl = byId<HTMLTableSectionElement>("shareLinksTbody");
const shareLinksEmptyEl = byId<HTMLDivElement>("shareLinksEmpty");

let shareTargetAssetID: number | null = null;

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function esc(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function refreshQuota(): Promise<void> {
  try {
    const { response, data } = await getAssetQuota();
    if (!response.ok) return;
    renderQuota(data.quota);
  } catch (err) {
    console.error("getAssetQuota failed", err);
  }
}

function renderQuota(q: AssetQuota): void {
  const pct = q.quota_bytes > 0 ? (q.usage_bytes / q.quota_bytes) * 100 : 0;
  const color = pct >= 100 ? "#dc2626" : pct >= 80 ? "#d97706" : "#16a34a";
  quotaBarEl.innerHTML = `<div style="width:${Math.min(pct, 100).toFixed(1)}%; height:100%; background:${color}; border-radius:4px;"></div>`;
  quotaLabelEl.textContent = `${fmtBytes(q.usage_bytes)} / ${fmtBytes(q.quota_bytes)} (${pct.toFixed(1)}%)`;
  if (q.over_quota) {
    const need = q.usage_bytes - q.quota_bytes;
    quotaBannerEl.innerHTML = `⚠ 已超出配额。请删除约 ${fmtBytes(need)} 后才能继续上传。`;
    quotaBannerEl.hidden = false;
  } else {
    quotaBannerEl.hidden = true;
  }
}

async function refreshAssets(): Promise<void> {
  try {
    const { response, data } = await listAssets({ limit: 200 });
    if (!response.ok) {
      assetsEmptyEl.textContent = `加载失败: HTTP ${response.status}`;
      assetsEmptyEl.hidden = false;
      return;
    }
    renderAssets(data.assets);
  } catch (err) {
    assetsEmptyEl.textContent = `加载失败: ${(err as Error).message}`;
    assetsEmptyEl.hidden = false;
  }
}

function visibilityBadge(v: AssetVisibility): string {
  const color = {
    private: "#64748b",
    workspace: "#0ea5e9",
    link: "#d97706",
    public: "#16a34a",
  }[v] || "#64748b";
  return `<span style="display:inline-block; padding:1px 6px; font-size:11px; background:${color}; color:white; border-radius:8px;">${v}</span>`;
}

function renderAssets(rows: Asset[]): void {
  assetsTbodyEl.innerHTML = "";
  if (rows.length === 0) {
    assetsEmptyEl.textContent = "还没有资产。上传一个开始吧。";
    assetsEmptyEl.hidden = false;
    return;
  }
  assetsEmptyEl.hidden = true;
  for (const a of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code>${esc(a.name)}</code></td>
      <td>${esc(a.kind)}</td>
      <td>${esc(a.version)}</td>
      <td style="text-align:right;">${fmtBytes(a.size_bytes)}</td>
      <td>${visibilityBadge(a.visibility)}</td>
      <td>${esc(new Date(a.created_at).toLocaleString())}</td>
      <td style="white-space:nowrap;">
        <a href="/api/assets/${a.id}/blob" class="btn-inline btn-secondary" title="下载">⬇</a>
        <button data-share="${a.id}" data-name="${esc(a.name)}" class="btn-inline btn-secondary" title="分享链接">🔗</button>
        <button data-delete="${a.id}" data-name="${esc(a.name)}" class="btn-inline btn-secondary" title="删除">🗑</button>
      </td>
    `;
    assetsTbodyEl.appendChild(tr);
  }
}

assetsTbodyEl.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const shareID = target.getAttribute("data-share");
  const deleteID = target.getAttribute("data-delete");
  if (shareID) {
    shareTargetAssetID = Number(shareID);
    shareAssetNameEl.textContent = target.getAttribute("data-name") || "";
    shareExpiresInput.value = "";
    shareMaxDownloadsInput.value = "";
    shareRequireLoginInput.checked = false;
    shareErrorEl.textContent = "";
    shareResultEl.innerHTML = "";
    shareModal.hidden = false;
    return;
  }
  if (deleteID) {
    const name = target.getAttribute("data-name") || `#${deleteID}`;
    if (!confirm(`确定删除 ${name} ？此操作不可撤销。`)) return;
    const { response, data } = await apiDeleteAsset(Number(deleteID));
    if (!response.ok) {
      alert(`删除失败: ${data?.error || response.statusText}`);
      return;
    }
    await Promise.all([refreshAssets(), refreshQuota()]);
  }
});

// Upload modal wiring.
uploadOpenBtn.addEventListener("click", () => {
  uploadFileInput.value = "";
  uploadKindSelect.value = "media";
  uploadNameInput.value = "";
  uploadVersionInput.value = "v1";
  uploadVisibilitySelect.value = "private";
  uploadSourceUrlInput.value = "";
  uploadMetadataInput.value = "";
  uploadErrorEl.textContent = "";
  uploadModal.hidden = false;
});
uploadCancelBtn.addEventListener("click", () => {
  uploadModal.hidden = true;
});

uploadSubmitBtn.addEventListener("click", async () => {
  uploadErrorEl.textContent = "";
  const f = uploadFileInput.files?.[0];
  if (!f) {
    uploadErrorEl.textContent = "请选择文件";
    return;
  }
  const kind = uploadKindSelect.value;
  const name = uploadNameInput.value.trim() || f.name;
  let metadata: Record<string, unknown> | undefined;
  const metaRaw = uploadMetadataInput.value.trim();
  if (metaRaw) {
    try {
      metadata = JSON.parse(metaRaw);
    } catch {
      uploadErrorEl.textContent = "metadata 必须是合法 JSON";
      return;
    }
  }
  uploadSubmitBtn.disabled = true;
  try {
    const { response, data } = await uploadAsset({
      file: f,
      kind,
      name,
      version: uploadVersionInput.value.trim() || "v1",
      visibility: uploadVisibilitySelect.value,
      source_url: uploadSourceUrlInput.value.trim() || undefined,
      metadata,
    });
    if (!response.ok) {
      uploadErrorEl.textContent = data?.error || `HTTP ${response.status}`;
      return;
    }
    uploadModal.hidden = true;
    await Promise.all([refreshAssets(), refreshQuota()]);
  } catch (err) {
    uploadErrorEl.textContent = (err as Error).message;
  } finally {
    uploadSubmitBtn.disabled = false;
  }
});

// Share modal wiring.
shareCancelBtn.addEventListener("click", () => {
  shareModal.hidden = true;
});

shareSubmitBtn.addEventListener("click", async () => {
  if (shareTargetAssetID == null) return;
  shareErrorEl.textContent = "";
  shareResultEl.innerHTML = "";
  const payload: {
    expires_at?: string;
    max_downloads?: number;
    require_login?: boolean;
  } = {};
  if (shareExpiresInput.value) {
    payload.expires_at = new Date(shareExpiresInput.value).toISOString();
  }
  if (shareMaxDownloadsInput.value) {
    const n = Number(shareMaxDownloadsInput.value);
    if (!Number.isFinite(n) || n <= 0) {
      shareErrorEl.textContent = "max_downloads 必须 > 0";
      return;
    }
    payload.max_downloads = n;
  }
  if (shareRequireLoginInput.checked) payload.require_login = true;
  shareSubmitBtn.disabled = true;
  try {
    const { response, data } = await createShareLink(
      shareTargetAssetID,
      payload,
    );
    if (!response.ok) {
      shareErrorEl.textContent = `HTTP ${response.status}`;
      return;
    }
    const fullURL = `${location.origin}${data.public_url}`;
    shareResultEl.innerHTML = `
      <div style="margin-top:8px; padding:8px; background:var(--surface-2, #f3f4f6); border-radius:6px;">
        <div style="font-size:11px; color:var(--text-muted, #64748b); margin-bottom:4px;">公开链接</div>
        <input type="text" readonly value="${esc(fullURL)}" style="width:100%; font-family:monospace; padding:4px;" id="shareUrlInput">
        <button class="btn-inline btn-primary" style="margin-top:4px;" id="shareCopyBtn">复制</button>
      </div>
    `;
    const copyBtn = document.getElementById("shareCopyBtn");
    const urlInput = document.getElementById("shareUrlInput") as HTMLInputElement | null;
    if (copyBtn && urlInput) {
      copyBtn.addEventListener("click", async () => {
        urlInput.select();
        try {
          await navigator.clipboard.writeText(fullURL);
          copyBtn.textContent = "已复制";
          setTimeout(() => { copyBtn.textContent = "复制"; }, 1500);
        } catch {
          document.execCommand("copy");
        }
      });
    }
    await refreshShareLinks();
  } catch (err) {
    shareErrorEl.textContent = (err as Error).message;
  } finally {
    shareSubmitBtn.disabled = false;
  }
});

async function refreshShareLinks(): Promise<void> {
  try {
    const { response, data } = await listShareLinks();
    if (!response.ok) return;
    renderShareLinks(data.links);
  } catch {
    /* swallow — links panel is non-critical */
  }
}

function renderShareLinks(rows: AssetShareLink[]): void {
  shareLinksTbodyEl.innerHTML = "";
  if (rows.length === 0) {
    shareLinksEmptyEl.hidden = false;
    return;
  }
  shareLinksEmptyEl.hidden = true;
  for (const l of rows) {
    const url = `${location.origin}/s/${l.short_code}`;
    const expires = l.expires_at
      ? new Date(l.expires_at).toLocaleString()
      : "永久";
    const downloads = l.max_downloads
      ? `${l.download_count} / ${l.max_downloads}`
      : `${l.download_count}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code>${l.short_code}</code></td>
      <td><a href="${url}" target="_blank" rel="noopener" style="font-size:11px;">${esc(url)}</a></td>
      <td>${esc(expires)}</td>
      <td>${esc(downloads)}</td>
      <td>${l.require_login ? "需要登录" : "公开"}</td>
      <td><button data-revoke="${l.id}" class="btn-inline btn-secondary">撤销</button></td>
    `;
    shareLinksTbodyEl.appendChild(tr);
  }
}

shareLinksTbodyEl.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const id = target.getAttribute("data-revoke");
  if (!id) return;
  if (!confirm("确定撤销此分享链接？")) return;
  const { response } = await deleteShareLink(Number(id));
  if (response.ok) await refreshShareLinks();
});

refreshBtn.addEventListener("click", () => {
  void refreshAssets();
  void refreshQuota();
  void refreshShareLinks();
});

byId<HTMLButtonElement>("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  location.href = "/login.html";
});

void (async () => {
  await Promise.all([hydrateSiteBrand(), hydrateSidebarFoot()]);
  await Promise.all([refreshQuota(), refreshAssets(), refreshShareLinks()]);
})();
