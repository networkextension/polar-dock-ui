import { buildAssetUrl, resolveAvatar } from "./lib/avatar.js";
import { formatDateTime as formatTime } from "./lib/datetime.js";
import { hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import { byId } from "./lib/dom.js";
import { t } from "./lib/i18n.js";
import { logout } from "./api/session.js";
import { request } from "./api/http.js";

const markdownList = byId<HTMLElement>("markdownList");
const markdownLoadMoreBtn = byId<HTMLButtonElement>("markdownLoadMoreBtn");

type PublicMarkdownEntry = {
  id: number;
  user_id: string;
  username: string;
  user_icon?: string;
  title: string;
  summary?: string;
  cover_url?: string;
  uploaded_at: string;
};

type Scope = "own" | "workspace" | "public";

let nextOffset = 0;
let hasMore = true;
// Default tab is "我的" — when a user lands on /markdowns.html they
// almost always want to see their own drafts first; "公开" / "工作区"
// are discovery surfaces, "我的" is the work surface.
let scope: Scope = "own";

initStoredTheme();
bindThemeSync();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createMarkdownCard(entry: PublicMarkdownEntry): HTMLElement {
  const card = document.createElement("a");
  card.className = "markdown-card panel";
  card.href = `/markdown.html?id=${entry.id}`;

  const avatar = resolveAvatar(entry.username, entry.user_icon, 64);
  const cover = entry.cover_url
    ? `<img class="markdown-card-cover" src="${buildAssetUrl(entry.cover_url)}" alt="${escapeHtml(entry.title)}" loading="lazy" />`
    : "";
  const summary = entry.summary
    ? `<div class="markdown-card-summary">${escapeHtml(entry.summary)}</div>`
    : "";
  card.innerHTML = `
    <div class="post-header">
      <div class="post-author">
        <img class="avatar-sm" src="${avatar}" alt="${entry.username}" />
        <span class="post-author-name">${entry.username}</span>
      </div>
      <div class="post-time text-meta-mono">${formatTime(entry.uploaded_at)}</div>
    </div>
    ${cover}
    <div class="markdown-card-title">${entry.title}</div>
    ${summary}
    <div class="markdown-card-meta">${t("markdowns.clickToView")}</div>
  `;

  return card;
}

async function loadMarkdowns(reset = false): Promise<void> {
  if (reset) {
    nextOffset = 0;
    hasMore = true;
    markdownList.innerHTML = "";
  }
  if (!hasMore) {
    return;
  }

  // Scope picks the listing endpoint:
  //   own       → GET /api/markdown        (auth, owner-scoped)
  //   workspace → GET /api/markdown/workspace (auth, X-Workspace-Id)
  //   public    → GET /api/public/markdowns  (no auth required)
  const url = (() => {
    const qs = `limit=10&offset=${nextOffset}`;
    switch (scope) {
      case "own":
        return `/api/markdown?${qs}`;
      case "workspace":
        return `/api/markdown/workspace?${qs}`;
      default:
        return `/api/public/markdowns?${qs}`;
    }
  })();
  let response: Response;
  let data: { entries?: PublicMarkdownEntry[]; has_more?: boolean; next_offset?: number };
  try {
    response = await request(url);
    data = await response.json();
  } catch {
    markdownList.innerHTML = `<div class='post-empty'>${t("markdowns.loadFailed")}</div>`;
    hasMore = false;
    markdownLoadMoreBtn.style.display = "none";
    return;
  }
  if (!response.ok) {
    markdownList.innerHTML = `<div class='post-empty'>${t("markdowns.loadFailed")}</div>`;
    hasMore = false;
    markdownLoadMoreBtn.style.display = "none";
    return;
  }

  const entries: PublicMarkdownEntry[] = data.entries || [];
  if (reset && entries.length === 0) {
    // Scope-aware empty state — "暂无公开 Markdown" was misleading
    // when the user is on the 我的 / 工作区 tab.
    const emptyMsg =
      scope === "own"
        ? "你还没有 Markdown，去 Editor 写第一篇吧"
        : scope === "workspace"
        ? "工作区里还没有共享的 Markdown"
        : t("markdowns.noPosts");
    markdownList.innerHTML = `<div class='post-empty'>${emptyMsg}</div>`;
    hasMore = false;
    markdownLoadMoreBtn.style.display = "none";
    return;
  }

  entries.forEach((entry) => {
    markdownList.appendChild(createMarkdownCard(entry));
  });

  hasMore = Boolean(data.has_more);
  nextOffset = Number(data.next_offset || 0);
  markdownLoadMoreBtn.style.display = hasMore ? "inline-flex" : "none";
}

markdownLoadMoreBtn.addEventListener("click", () => {
  void loadMarkdowns(false);
});

// Scope tabs: clicking switches the data source and resets the list.
// `is-active` styles match the existing .btn-ghost convention; only
// one tab is active at a time.
document.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.scope as Scope;
    if (!next || next === scope) return;
    scope = next;
    document.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.scope === scope);
    });
    void loadMarkdowns(true);
  });
});

void hydrateSiteBrand();
void loadMarkdowns(true);

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try { await logout(); } finally { window.location.replace("/login.html"); }
});

