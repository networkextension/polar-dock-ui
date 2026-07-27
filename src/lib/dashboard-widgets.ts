// Dashboard widget rendering. Each widget = small card with a
// title + body fetched from an existing list endpoint (limit=5).
// Widgets are rendered in the user's saved order; the customize
// modal toggles which ones show + reorders.
//
// Adding a widget: add a slug to the server's dashboardWidgetCatalog
// + register a renderer here. No new API surface needed unless the
// list data shape demands it.

import { requestJson } from "../api/http.js";
import { iconHTML } from "./icons.js";
import { formatDate, formatDateTime } from "./datetime.js";

export type WidgetMeta = {
  slug: string;
  name: string;
  description: string;
  admin_only?: boolean;
  default?: boolean;
};

export type DashboardLayoutResponse = {
  layout: string[];
  catalog: WidgetMeta[];
};

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// formatTime keeps the widget-local (value, kind) signature; the actual
// rendering (locale binding + Invalid-Date → "—" defense) lives in
// lib/datetime.ts, shared with every page.
function formatTime(s: string | null | undefined, kind: "date" | "datetime" = "datetime"): string {
  return kind === "date" ? formatDate(s) : formatDateTime(s);
}

function widgetCard(title: string, body: string, opts: { headerExtra?: string } = {}): string {
  // Title row: title + spacer + headerExtra. The heading is an <h2>
  // (page <h1> is the topbar title) so screen readers can navigate
  // by widget; styles.css's .dashboard-widget-header > h2 rule
  // overrides the default user-agent margin so it visually matches
  // the previous <strong>.
  return `
    <div class="dashboard-widget">
      <div class="dashboard-widget-header">
        <h2>${escapeHTML(title)}</h2>
        <span style="flex:1;"></span>
        ${opts.headerExtra ?? ""}
      </div>
      <div class="dashboard-widget-body">${body}</div>
    </div>
  `;
}

// emptyState: icon + line + optional CTA link. The icon argument is
// already a plain string char — we don't sanitize it because callers
// are trusted (this file only). Used by every list-style widget.
function emptyState(msg: string, opts: { icon?: string; ctaText?: string; ctaHref?: string } = {}): string {
  const icon = opts.icon ?? "·";
  const cta = opts.ctaHref && opts.ctaText
    ? `<a class="dashboard-widget-empty-cta" href="${escapeHTML(opts.ctaHref)}">${escapeHTML(opts.ctaText)} →</a>`
    : "";
  return `
    <div class="dashboard-widget-empty">
      <div class="dashboard-widget-empty-icon">${icon}</div>
      <div class="dashboard-widget-empty-msg">${escapeHTML(msg)}</div>
      ${cta}
    </div>
  `;
}

// ---- individual widget renderers ----

export function renderQuickStart(): string {
  // 9 tiles linking to main modules. Static — doesn't need data fetch.
  // Icon names map 1:1 to lib/icons.ts ICON_PATHS keys; mismatched
  // names render an empty SVG (graceful degradation, but flag in
  // dev tools because the visual will be conspicuously blank).
  const tiles: Array<[string, string, string, string]> = [
    ["folder-kanban",   "项目",          "/projects.html",     "AI 拆解 + 派单"],
    ["message-square",  "Posts",         "/posts.html",        "动态 / 讨论"],
    ["file-text",       "Markdowns",     "/markdowns.html",    "长文 / 笔记"],
    ["message-circle",  "Chat",          "/chat.html",         "Bot 对话"],
    ["pen-line",        "Creation",      "/creation.html",     "图文创作"],
    ["video",           "Video Studio",  "https://video.4950.store:2443/video-studio.html", "视频生成"],
    ["smartphone",      "iOS 分发",       "/iosdist.html",      "TF / OTA"],
    ["users-round",     "工作区",         "/teams.html",        "团队 / 邀请"],
    ["code",            "Editor",        "/editor.html",       "代码编辑器"],
  ];
  const body = `
    <div class="dashboard-quickstart-grid">
      ${tiles
        .map(
          ([iconName, label, href, desc]) => `
            <a class="dashboard-quickstart-tile" href="${escapeHTML(href)}">
              <span class="dashboard-quickstart-icon" aria-hidden="true">${iconHTML(iconName, 22)}</span>
              <div class="dashboard-quickstart-text">
                <span class="dashboard-quickstart-label">${escapeHTML(label)}</span>
                <span class="dashboard-quickstart-desc">${escapeHTML(desc)}</span>
              </div>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
  return widgetCard("快速入口", body);
}

type ProjectListItem = {
  id: string;
  name: string;
  status: string;
  current_sprint: number;
  updated_at: string;
};

export async function renderRecentProjects(): Promise<string> {
  const { response, data } = await requestJson<{ projects: ProjectListItem[] }>(
    "/api/projects",
  );
  if (!response.ok) {
    return widgetCard("最近项目", emptyState("加载失败 — 可能没有 workspace 权限"));
  }
  const items = (data.projects ?? []).slice(0, 5);
  if (items.length === 0) {
    return widgetCard(
      "最近项目",
      emptyState("还没有项目", { icon: "✦", ctaText: "去创建第一个", ctaHref: "/projects.html" }),
    );
  }
  const body = `
    <ul class="dashboard-widget-list">
      ${items
        .map(
          (p) => `
            <li>
              <a class="dashboard-widget-row" href="/projects.html?project=${encodeURIComponent(p.id)}">
                <span class="dashboard-widget-row-title">${escapeHTML(p.name)}</span>
                <span class="dashboard-widget-row-meta">Sprint ${p.current_sprint || 0}</span>
                <span class="tag-chip" style="font-size:11px;">${escapeHTML(p.status)}</span>
                <span class="dashboard-widget-row-arrow" aria-hidden="true">›</span>
              </a>
            </li>`,
        )
        .join("")}
    </ul>
  `;
  return widgetCard("最近项目", body, {
    headerExtra: `<a href="/projects.html" style="font-size:11px;">查看全部 →</a>`,
  });
}

type MarkdownEntry = { id: number; title: string; updated_at: string };

export async function renderRecentMarkdowns(): Promise<string> {
  const { response, data } = await requestJson<{ entries: MarkdownEntry[] }>(
    "/api/markdown?limit=5",
  );
  if (!response.ok) {
    return widgetCard("最近 Markdown", emptyState("加载失败"));
  }
  const items = (data.entries ?? []).slice(0, 5);
  if (items.length === 0) {
    return widgetCard(
      "最近 Markdown",
      emptyState("还没有 markdown entry", { icon: "◈", ctaText: "去创建第一个", ctaHref: "/markdowns.html" }),
    );
  }
  const body = `
    <ul class="dashboard-widget-list">
      ${items
        .map(
          (e) => `
            <li>
              <a class="dashboard-widget-row" href="/markdowns.html#entry-${encodeURIComponent(String(e.id))}">
                <span class="dashboard-widget-row-title">${escapeHTML(e.title || "(无标题)")}</span>
                <span class="dashboard-widget-row-meta dashboard-widget-row-meta-mono">${formatTime(e.updated_at, "date")}</span>
                <span class="dashboard-widget-row-arrow" aria-hidden="true">›</span>
              </a>
            </li>`,
        )
        .join("")}
    </ul>
  `;
  return widgetCard("最近 Markdown", body, {
    headerExtra: `<a href="/markdowns.html" style="font-size:11px;">查看全部 →</a>`,
  });
}

type PostItem = { id: number; content: string; created_at: string };

export async function renderRecentPosts(): Promise<string> {
  const { response, data } = await requestJson<{ posts: PostItem[] }>("/api/posts?limit=5");
  if (!response.ok) {
    return widgetCard("最近 Post", emptyState("加载失败"));
  }
  const items = (data.posts ?? []).slice(0, 5);
  if (items.length === 0) {
    return widgetCard("最近 Post", emptyState("还没有 post", { icon: "◎", ctaText: "去看看", ctaHref: "/posts.html" }));
  }
  const body = `
    <ul class="dashboard-widget-list">
      ${items
        .map(
          (p) => `
            <li>
              <a class="dashboard-widget-row dashboard-widget-row-multiline" href="/post.html?id=${encodeURIComponent(String(p.id))}">
                <span class="dashboard-widget-row-snippet">${escapeHTML((p.content || "").slice(0, 200))}</span>
                <span class="dashboard-widget-row-meta dashboard-widget-row-meta-mono">${formatTime(p.created_at, "datetime")}</span>
              </a>
            </li>`,
        )
        .join("")}
    </ul>
  `;
  return widgetCard("最近 Post", body, {
    headerExtra: `<a href="/posts.html" style="font-size:11px;">查看全部 →</a>`,
  });
}

type ChatThread = {
  id: number;
  participant_username?: string;
  participant_name?: string;
  unread?: number;
  last_message_at?: string;
};

export async function renderRecentChat(): Promise<string> {
  const { response, data } = await requestJson<{ threads: ChatThread[] }>("/api/chats");
  if (!response.ok) {
    return widgetCard("最近 Chat", emptyState("加载失败"));
  }
  const items = (data.threads ?? []).slice(0, 5);
  if (items.length === 0) {
    return widgetCard("最近 Chat", emptyState("还没有对话", { icon: "◉", ctaText: "和 Bot 聊聊", ctaHref: "/chat.html" }));
  }
  const body = `
    <ul class="dashboard-widget-list">
      ${items
        .map((t) => {
          const name = t.participant_name || t.participant_username || `Thread ${t.id}`;
          const unread = (t.unread ?? 0) > 0
            ? `<span class="dashboard-widget-badge-unread">${t.unread}</span>`
            : "";
          return `
            <li>
              <a class="dashboard-widget-row" href="/chat.html?thread=${encodeURIComponent(String(t.id))}">
                <span class="dashboard-widget-row-title">${escapeHTML(name)}</span>
                ${unread}
                <span class="dashboard-widget-row-arrow" aria-hidden="true">›</span>
              </a>
            </li>`;
        })
        .join("")}
    </ul>
  `;
  return widgetCard("最近 Chat", body, {
    headerExtra: `<a href="/chat.html" style="font-size:11px;">全部 →</a>`,
  });
}

type IOSApp = {
  id: number;
  name: string;
  bundle_id: string;
  latest_build_state?: string;
  updated_at: string;
};

export async function renderIOSDistBuilds(): Promise<string> {
  const { response, data } = await requestJson<{ apps: IOSApp[] }>("/api/iosdist/apps");
  if (!response.ok) {
    return widgetCard("iOS 分发构建", emptyState("加载失败 — 需要 admin 权限"));
  }
  const items = (data.apps ?? []).slice(0, 5);
  if (items.length === 0) {
    return widgetCard("iOS 分发构建", emptyState("没有 iosdist app", { icon: "⬇", ctaText: "去管理", ctaHref: "/iosdist.html" }));
  }
  const body = `
    <ul class="dashboard-widget-list">
      ${items
        .map(
          (a) => `
            <li>
              <a class="dashboard-widget-row" href="/iosdist.html#app-${encodeURIComponent(String(a.id))}">
                <span class="dashboard-widget-row-title">${escapeHTML(a.name)}</span>
                <span class="dashboard-widget-row-meta dashboard-widget-row-meta-mono">${escapeHTML(a.bundle_id)}</span>
                <span class="dashboard-widget-row-arrow" aria-hidden="true">›</span>
              </a>
            </li>`,
        )
        .join("")}
    </ul>
  `;
  return widgetCard("iOS 分发构建", body, {
    headerExtra: `<a href="/iosdist.html" style="font-size:11px;">全部 →</a>`,
  });
}

// Render the entire dashboard's enabled widgets in order. Renders
// each card synchronously when possible (quick_start) and awaits
// async fetches in parallel for a fast first paint.
export async function renderDashboardWidgets(layout: string[], container: HTMLElement): Promise<void> {
  const tasks = layout.map(async (slug): Promise<{ slug: string; html: string }> => {
    switch (slug) {
      case "quick_start":
        return { slug, html: renderQuickStart() };
      case "recent_projects":
        return { slug, html: await renderRecentProjects() };
      case "recent_markdowns":
        return { slug, html: await renderRecentMarkdowns() };
      case "recent_posts":
        return { slug, html: await renderRecentPosts() };
      case "recent_chat":
        return { slug, html: await renderRecentChat() };
      case "iosdist_builds":
        return { slug, html: await renderIOSDistBuilds() };
      default:
        return { slug, html: "" };
    }
  });
  const results = await Promise.all(tasks);
  container.innerHTML = results.map((r) => r.html).join("");
}

// ---- layout API ----

export async function fetchDashboardLayout() {
  return requestJson<DashboardLayoutResponse>("/api/dashboard/layout");
}

export async function saveDashboardLayout(layout: string[]) {
  return requestJson<{ layout: string[] }>("/api/dashboard/layout", {
    method: "PUT",
    body: { layout },
  });
}
