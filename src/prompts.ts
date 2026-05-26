import { byId } from "./lib/dom.js";
import { requestJson } from "./api/http.js";
import { logout, fetchCurrentUser } from "./api/session.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

type PromptTemplate = {
  slug: string;
  name: string;
  description: string;
  content: string;
  default_content: string;
  updated_at: string;
};

type PromptListResponse = { prompts: PromptTemplate[] };
type PromptDetailResponse = { prompt: PromptTemplate };

const listEl = byId<HTMLElement>("promptsList");
const statusEl = byId<HTMLElement>("promptsStatus");

let prompts: PromptTemplate[] = [];

function setStatus(msg: string, isError = false): void {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#c33" : "#3a7";
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadPrompts(): Promise<void> {
  setStatus("加载中...");
  const { response, data } = await requestJson<PromptListResponse>("/api/prompts");
  if (!response.ok) {
    setStatus("加载失败 — 需要管理员权限", true);
    return;
  }
  prompts = data.prompts ?? [];
  setStatus(`${prompts.length} 条`);
  renderList();
}

function renderList(): void {
  if (prompts.length === 0) {
    listEl.innerHTML = `<div style="color:var(--text-muted,#888); font-size:13px;">暂无模板（应该在服务启动时自动 bootstrap，检查 dock 日志）。</div>`;
    return;
  }
  listEl.innerHTML = prompts
    .map((p) => {
      const dirty = p.content !== p.default_content;
      const dirtyTag = dirty
        ? `<span style="color:#3a7; font-size:11px; padding:2px 6px; background:#e6f4ed; border-radius:3px;">已编辑</span>`
        : `<span style="color:var(--text-muted,#888); font-size:11px;">默认</span>`;
      const updated = p.updated_at ? new Date(p.updated_at).toLocaleString() : "";
      return `
        <div style="border:1px solid var(--border,#ececf0); border-radius:6px; padding:10px; background:var(--card,#fff);">
          <div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; margin-bottom:6px;">
            <strong style="font-size:14px;">${escapeHTML(p.name || p.slug)}</strong>
            <code style="font-size:11px; color:var(--text-muted,#888);">${escapeHTML(p.slug)}</code>
            ${dirtyTag}
            <span style="flex:1;"></span>
            <span class="text-meta-mono" style="font-size:11px; color:var(--text-muted,#888);">更新于 ${escapeHTML(updated)}</span>
          </div>
          ${p.description ? `<div style="font-size:12px; color:var(--text-muted,#888); margin-bottom:8px; white-space:pre-wrap;">${escapeHTML(p.description)}</div>` : ""}
          <textarea
            data-slug="${escapeHTML(p.slug)}"
            class="input textarea"
            rows="10"
            spellcheck="false"
            style="font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; width:100%; box-sizing:border-box;"
          >${escapeHTML(p.content)}</textarea>
          <div style="display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;">
            <button class="btn-inline btn-secondary" type="button" data-save="${escapeHTML(p.slug)}">保存</button>
            <button class="btn-inline" type="button" data-reset="${escapeHTML(p.slug)}" ${dirty ? "" : "disabled"}>重置为默认</button>
            <span data-row-status="${escapeHTML(p.slug)}" class="status-text" style="font-size:11px;"></span>
          </div>
        </div>
      `;
    })
    .join("");
}

async function savePrompt(slug: string, content: string): Promise<void> {
  const rowStatus = listEl.querySelector(`[data-row-status="${CSS.escape(slug)}"]`) as HTMLElement | null;
  if (rowStatus) rowStatus.textContent = "保存中...";
  const { response, data } = await requestJson<PromptDetailResponse>(
    `/api/prompts/${encodeURIComponent(slug)}`,
    { method: "PUT", body: { content } },
  );
  if (!response.ok || !data.prompt) {
    if (rowStatus) {
      rowStatus.textContent = "保存失败";
      rowStatus.style.color = "#c33";
    }
    return;
  }
  // Replace the in-memory copy + re-render so 已编辑 / 重置 button states refresh.
  prompts = prompts.map((p) => (p.slug === slug ? data.prompt : p));
  renderList();
  const refreshed = listEl.querySelector(`[data-row-status="${CSS.escape(slug)}"]`) as HTMLElement | null;
  if (refreshed) {
    refreshed.textContent = "已保存";
    refreshed.style.color = "#3a7";
  }
}

function resetPrompt(slug: string): void {
  const p = prompts.find((x) => x.slug === slug);
  if (!p) return;
  if (!confirm(`重置 "${p.name || p.slug}" 为代码默认？当前编辑的内容会丢失。`)) return;
  void savePrompt(slug, p.default_content);
}

listEl.addEventListener("click", (ev) => {
  const target = ev.target as HTMLElement;
  const saveSlug = target.dataset.save;
  if (saveSlug) {
    const ta = listEl.querySelector(`textarea[data-slug="${CSS.escape(saveSlug)}"]`) as HTMLTextAreaElement | null;
    if (ta) void savePrompt(saveSlug, ta.value);
    return;
  }
  const resetSlug = target.dataset.reset;
  if (resetSlug) {
    resetPrompt(resetSlug);
  }
});

const logoutBtn = byId<HTMLButtonElement>("logoutBtn");
logoutBtn.addEventListener("click", () => {
  void logout().then(() => {
    window.location.href = "/login.html";
  });
});

async function bootstrap(): Promise<void> {
  initStoredTheme();
  bindThemeSync();
  await hydrateSiteBrand();
  const { response, data } = await fetchCurrentUser();
  if (!response.ok) {
    window.location.replace("/login.html");
    return;
  }
  if (data.role !== "admin") {
    window.location.replace("/dashboard.html");
    return;
  }
  renderSidebarFoot(data);
  document.querySelectorAll<HTMLElement>("[data-admin-nav]").forEach((el) => {
    el.removeAttribute("hidden");
  });
  await loadPrompts();
}

void bootstrap();
