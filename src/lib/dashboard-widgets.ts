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

// formatTime is the dashboard's defensive Date renderer. Backend
// timestamps occasionally come back as "" / null / a malformed
// ISO string (e.g. when an aggregate query couldn't resolve a row);
// `new Date("").toLocaleString()` produces "Invalid Date" which
// leaks straight into the UI. We substitute "—" instead.
function formatTime(s: string | null | undefined, kind: "date" | "datetime" = "datetime"): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return kind === "date" ? d.toLocaleDateString() : d.toLocaleString();
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
    ["video",           "Video Studio",  "/video-studio.html", "视频生成"],
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

// system_info widget — surfaces the public /api/system/info endpoint.
// Three blocks: identity (hostname/uname/version), addresses, capacity
// (disk + memory). Updates on every dashboard load; the backend caches
// 5s so rapid reloads don't hammer.
function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function fmtUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function renderSystemInfo(): Promise<string> {
  const { response, data } = await requestJson<import("../types/sysinfo.js").SystemHostInfo>("/api/system/info");
  if (!response.ok) {
    return widgetCard("系统信息", emptyState("加载失败"));
  }

  // Filter IPs: drop link-local + loopback for the at-a-glance view;
  // the full /api/system/info JSON still has them.
  const ips = (data.ip_addresses ?? []).filter((ip) => {
    if (ip.address.startsWith("127.") || ip.address === "::1") return false;
    if (ip.address.startsWith("fe80:")) return false;
    if (ip.address.startsWith("169.254.")) return false; // link-local v4
    return true;
  });
  const ipsHTML = ips.length > 0
    ? ips.map((ip) => `<code class="sysinfo-ip">${escapeHTML(ip.address)}<span class="sysinfo-iface">@${escapeHTML(ip.interface)}</span></code>`).join(" ")
    : '<span class="dashboard-widget-row-meta">无对外地址</span>';

  const versionParts: string[] = [];
  if (data.version?.git_sha) versionParts.push(escapeHTML(data.version.git_sha));
  if (data.version?.go) versionParts.push(escapeHTML(data.version.go));
  const versionHTML = versionParts.length > 0 ? versionParts.join(" · ") : "—";

  const disksHTML = (data.disks ?? [])
    .slice(0, 6)
    .map((d) => {
      const pct = Math.round(d.used_pct);
      const barColor = pct >= 90 ? "var(--danger,#c00)" : pct >= 75 ? "var(--warning,#e60)" : "var(--success,#0a7)";
      return `
        <li>
          <div class="sysinfo-disk-row">
            <code class="sysinfo-mount">${escapeHTML(d.mount)}</code>
            <span class="sysinfo-disk-meta">${fmtBytes(d.used_bytes)} / ${fmtBytes(d.total_bytes)} (${pct}%)</span>
          </div>
          <div class="sysinfo-disk-bar"><div class="sysinfo-disk-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
        </li>`;
    })
    .join("");

  const memTotal = data.memory?.total_bytes ?? 0;
  const memAvail = data.memory?.available_bytes ?? 0;
  const memUsed = memTotal > 0 && memAvail > 0 ? memTotal - memAvail : 0;
  const memPct = memTotal > 0 && memUsed > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

  const body = `
    <div class="sysinfo-grid">
      <div class="sysinfo-row"><span class="sysinfo-k">主机</span><span class="sysinfo-v"><code>${escapeHTML(data.hostname || "—")}</code></span></div>
      <div class="sysinfo-row"><span class="sysinfo-k">OS</span><span class="sysinfo-v"><code>${escapeHTML(data.os)}/${escapeHTML(data.arch)}</code></span></div>
      ${data.uname ? `<div class="sysinfo-row"><span class="sysinfo-k">uname</span><span class="sysinfo-v"><code class="sysinfo-uname" title="${escapeHTML(data.uname)}">${escapeHTML(data.uname)}</code></span></div>` : ""}
      <div class="sysinfo-row"><span class="sysinfo-k">CPU</span><span class="sysinfo-v">${data.cpu?.count ?? "?"} × ${escapeHTML(data.cpu?.model || "—")}</span></div>
      <div class="sysinfo-row"><span class="sysinfo-k">内存</span><span class="sysinfo-v">${fmtBytes(memUsed)} / ${fmtBytes(memTotal)}${memPct > 0 ? ` (${memPct}%)` : ""}${memAvail > 0 ? ` · ${fmtBytes(memAvail)} 可用` : ""}</span></div>
      <div class="sysinfo-row"><span class="sysinfo-k">上线</span><span class="sysinfo-v">${fmtUptime(data.uptime_seconds)}</span></div>
      <div class="sysinfo-row"><span class="sysinfo-k">Polar</span><span class="sysinfo-v">${versionHTML}</span></div>
      <div class="sysinfo-row"><span class="sysinfo-k">IP</span><span class="sysinfo-v sysinfo-ips">${ipsHTML}</span></div>
    </div>
    ${disksHTML ? `<ul class="sysinfo-disks">${disksHTML}</ul>` : ""}
  `;
  return widgetCard("系统信息", body, {
    headerExtra: `<a href="/api/system/info" target="_blank" rel="noopener" style="font-size:11px;">JSON →</a>`,
  });
}

// llm_proxy_stats widget — P7c. Three numbers an admin glances at:
//   1. 本月 API 用量 (workspace-wide SUM cost_usd this UTC month)
//   2. 上游可用性 (count UP / total from the prober)
//   3. 活跃 token (un-revoked tokens in this workspace)
// Hides itself on non-admin (the endpoint is admin-gated → 403 →
// emptyState).
type ProxyStatsResp = {
  month_spend_usd: number;
  active_tokens: number;
  upstreams: {
    up: number;
    total: number;
    items?: Array<{ name: string; model: string; up: boolean }>;
  };
};

export async function renderLLMProxyStats(): Promise<string> {
  const { response, data } = await requestJson<ProxyStatsResp>("/api/llm-proxy/dashboard-stats");
  if (!response.ok) {
    return widgetCard("LLM Proxy", emptyState("加载失败 — 可能没有 admin 权限"));
  }
  const spend = data.month_spend_usd ?? 0;
  const ups = data.upstreams || { up: 0, total: 0 };
  const upRatio = ups.total > 0 ? ups.up / ups.total : 0;
  const upColor =
    ups.total === 0 ? "var(--text-muted,#888)" : upRatio === 1 ? "var(--success,#0a7)" : upRatio >= 0.5 ? "var(--warning,#e60)" : "var(--danger,#c00)";
  const downItems = (ups.items ?? []).filter((u) => !u.up);
  const downList =
    downItems.length > 0
      ? `<div class="proxy-stats-down" title="${escapeHTML(downItems.map((u) => `${u.name} · ${u.model}`).join(" / "))}">
           ${downItems.length} 死: ${downItems.map((u) => escapeHTML(u.name)).join("、")}
         </div>`
      : "";
  const body = `
    <div class="proxy-stats-grid">
      <a class="proxy-stats-card" href="/proxy-tokens.html" title="本月 SUM(cost_usd) — 仅含价格表里的 model">
        <div class="proxy-stats-label">本月用量</div>
        <div class="proxy-stats-value">$${spend.toFixed(spend < 1 ? 4 : 2)}</div>
        <div class="proxy-stats-sub">USD · 估算</div>
      </a>
      <a class="proxy-stats-card" href="/proxy-tokens.html" title="活跃（未撤销）token 数">
        <div class="proxy-stats-label">活跃 Token</div>
        <div class="proxy-stats-value">${data.active_tokens}</div>
        <div class="proxy-stats-sub">未撤销</div>
      </a>
      <a class="proxy-stats-card" href="/grafana/" target="_blank" rel="noopener" title="polar_llm_upstream_up gauge — 探针每 30s 更新">
        <div class="proxy-stats-label">上游可用</div>
        <div class="proxy-stats-value" style="color: ${upColor};">${ups.up} / ${ups.total}</div>
        <div class="proxy-stats-sub">${downItems.length === 0 && ups.total > 0 ? "全部 UP" : downItems.length > 0 ? `${downItems.length} DOWN` : "无数据"}</div>
      </a>
    </div>
    ${downList}
  `;
  return widgetCard("LLM Proxy", body, {
    headerExtra: `<a href="/proxy-tokens.html" style="font-size:11px;">管理 →</a>`,
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
      case "system_info":
        return { slug, html: await renderSystemInfo() };
      case "llm_proxy_stats":
        return { slug, html: await renderLLMProxyStats() };
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
