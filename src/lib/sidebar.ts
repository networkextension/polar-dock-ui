// Single source of truth for the left sidebar nav + the brand/logo click.
//
// Previously every page carried its own ~28-item <nav class="lp-nav"> inline,
// with the active item hardcoded per page — adding/moving an entry meant editing
// ~30 HTML files, and they had already drifted apart. Now the nav is described
// once here and rendered into the page's `<nav class="lp-nav">` on load
// (renderSidebar). Active state is derived from the URL; admin gating reuses the
// existing [data-admin-nav] / [data-site-admin-nav] hooks that
// renderSidebarFoot() already toggles from /api/me.
//
// The logo: wireBrandHome() guarantees a click always lands on the dashboard
// (same host), even on SPA-ish pages (editor/console) that might otherwise
// swallow the default navigation.

import { hydrateIcons } from "./icons.js";
import { applyI18n } from "./i18n.js";

type Gate = "admin" | "site-admin";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  i18n?: string; // data-i18n key when one exists
  gate?: Gate;
  external?: boolean;
}

interface NavGroup {
  label?: string; // section header; omitted for the top "home" group
  items: NavItem[];
}

// Order + grouping is the single place to change the menu.
const NAV: NavGroup[] = [
  {
    items: [{ href: "/dashboard.html", label: "Dashboard", icon: "layout-dashboard" }],
  },
  {
    label: "工作区",
    items: [
      { href: "/teams.html", label: "工作区", i18n: "nav.teams", icon: "users-round" },
      { href: "/assets.html", label: "资产", icon: "folder" },
      { href: "/api-tokens.html", label: "开放 API", icon: "key-round" },
      { href: "/api-reference.html", label: "API 参考", icon: "book-open" },
    ],
  },
  {
    label: "内容",
    items: [
      { href: "/posts.html", label: "Posts", icon: "message-square" },
      { href: "/markdowns.html", label: "Markdowns", icon: "file-text" },
      { href: "/creation.html", label: "Creation", i18n: "nav.creation", icon: "pen-line" },
      { href: "/editor.html", label: "Editor", icon: "code" },
      { href: "/skills.html", label: "Skills", icon: "package" },
    ],
  },
  {
    label: "协作",
    items: [
      { href: "/rooms.html", label: "群聊", icon: "users" },
      { href: "/chat.html", label: "Chat", icon: "message-circle" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/llm.html", label: "LLM", icon: "sparkles" },
      { href: "/llm-config.html", label: "LLM 配置", icon: "sliders" },
      { href: "/expense.html", label: "家庭账本", icon: "receipt" },
      { href: "/llm-billing.html", label: "LLM 计费", icon: "dollar-sign", gate: "admin" },
      { href: "/llm-apps.html", label: "LLM 申请", icon: "inbox", gate: "admin" },
      { href: "/bots.html", label: "Bot Management", i18n: "nav.bots", icon: "bot", gate: "admin" },
      { href: "/prompts.html", label: "Prompt 模板", icon: "sparkles", gate: "admin" },
    ],
  },
  {
    label: "设备",
    items: [
      { href: "https://hosts.4950.store:2443/hosts.html", label: "主机", i18n: "nav.hosts", icon: "server", gate: "site-admin" },
      { href: "/agents.html", label: "Agents", i18n: "nav.agents", icon: "cpu", gate: "site-admin" },
      { href: "/compute-tasks.html", label: "算力任务", icon: "cpu", gate: "admin" },
      { href: "https://wg.4950.store:2443/wg-tokens.html", label: "WG Mesh", icon: "network", gate: "admin" },
    ],
  },
  {
    label: "管理",
    items: [
      { href: "/latch.html", label: "Latch", i18n: "nav.latch", icon: "settings", gate: "admin" },
      { href: "/invites.html", label: "邀请码", icon: "ticket", gate: "admin" },
      { href: "/admin-plugins.html", label: "Plugin 注册", icon: "puzzle", gate: "admin" },
      { href: "/admin-assets.html", label: "资产管理（管理员）", icon: "database", gate: "site-admin" },
      { href: "/admin-audit-log.html", label: "审计日志", icon: "clipboard-list", gate: "site-admin" },
      { href: "/proxy-tokens.html", label: "API Tokens", icon: "key", gate: "admin" },
      { href: "/grafana/", label: "Grafana", icon: "line-chart", gate: "admin", external: true },
      { href: "/admin.html", label: "用户管理", i18n: "nav.userAdmin", icon: "users-cog", gate: "admin" },
      { href: "/admin-rbac.html", label: "角色与权限", icon: "shield-check", gate: "admin" },
    ],
  },
];

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function escHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function currentPath(): string {
  const p = window.location.pathname;
  return p === "/" || p === "" ? "/dashboard.html" : p;
}

function isActive(href: string): boolean {
  // hrefs from /api/nav are absolute (cross-subdomain). Match on host+path.
  try {
    const u = new URL(href, window.location.href);
    if (u.host !== window.location.host) return false;
    if (u.pathname === "/grafana/") return currentPath().startsWith("/grafana");
    return u.pathname === currentPath();
  } catch {
    return href === currentPath();
  }
}

function itemHTML(it: NavItem): string {
  const gate =
    it.gate === "admin" ? " hidden data-admin-nav" : it.gate === "site-admin" ? " hidden data-site-admin-nav" : "";
  const ext = it.external ? ' target="_blank" rel="noopener"' : "";
  const active = isActive(it.href);
  const cls = `lp-nav-item${active ? " active" : ""}`;
  const cur = active ? ' aria-current="page"' : "";
  const label = it.i18n
    ? `<span data-i18n="${escAttr(it.i18n)}">${escHTML(it.label)}</span>`
    : `<span>${escHTML(it.label)}</span>`;
  return (
    `<a class="${cls}" href="${escAttr(it.href)}"${ext}${gate}${cur}>` +
    `<span class="lp-nav-icon" data-icon="${escAttr(it.icon)}"></span>${label}</a>`
  );
}

function ensureStyle(): void {
  if (document.getElementById("lp-nav-group-style")) return;
  const s = document.createElement("style");
  s.id = "lp-nav-group-style";
  s.textContent =
    ".lp-nav-group-label{padding:12px 14px 4px;font-size:11px;font-weight:600;" +
    "letter-spacing:.04em;text-transform:uppercase;color:var(--text-muted,#9aa0ad);opacity:.65;}" +
    ".lp-app.sidebar-collapsed .lp-nav-group-label{display:none;}";
  document.head.appendChild(s);
}

/**
 * Rebuild `<nav class="lp-nav">` from dock's GET /api/nav — the single source
 * of truth shared with every module subdomain. Module links come back absolute
 * (their subdomain) so they don't 404 from the dock origin. Falls back to the
 * static NAV const if the fetch fails (offline / pre-auth). No-op on pages
 * without a sidebar. Gated items render hidden+data-(site-)admin-nav so the
 * existing /api/me reveal in hydrateSidebarFoot shows the allowed ones.
 */
export async function renderSidebar(): Promise<void> {
  const nav = document.querySelector<HTMLElement>("nav.lp-nav");
  if (!nav) return;
  ensureStyle();
  let groups: NavGroup[] = NAV;
  try {
    const res = await fetch("/api/nav", { credentials: "include" });
    if (res.ok) {
      const body = (await res.json()) as { groups?: NavGroup[] };
      if (Array.isArray(body.groups) && body.groups.length) groups = body.groups;
    }
  } catch {
    /* keep static NAV fallback */
  }
  nav.innerHTML = groups
    .map((g) => {
      const header = g.label ? `<div class="lp-nav-group-label">${escHTML(g.label)}</div>` : "";
      return header + g.items.map(itemHTML).join("");
    })
    .join("");
  hydrateIcons(nav);
  applyI18n();
}

/** Make the brand/logo always navigate home to the dashboard, reliably. */
export function wireBrandHome(): void {
  document.querySelectorAll<HTMLAnchorElement>("a.lp-brand[data-site-brand]").forEach((a) => {
    a.setAttribute("href", "/dashboard.html");
    if (a.dataset.brandHomeWired === "1") return;
    a.dataset.brandHomeWired = "1";
    a.addEventListener("click", (e) => {
      // Plain left-click → force navigation (works from SPA pages too).
      // Respect modifier clicks (cmd/ctrl/middle) so "open in new tab" works.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      window.location.assign("/dashboard.html");
    });
  });
}
