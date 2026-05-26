// Workspace switcher (T4). One pattern across all pages:
//
//   1. localStorage holds the user's currently selected workspace_id.
//   2. http.ts injects "X-Workspace-Id: <id>" on every authenticated
//      API call.
//   3. installWorkspaceSwitcher() prepends a dropdown into the
//      sidebar. Clicking an option swaps the localStorage value and
//      reloads the page so all module pages reflect the new context.
//
// The switcher is added dynamically (no per-page HTML edits) by
// finding the first .lp-nav element and prepending a custom block.

const WORKSPACE_KEY = "polar_active_workspace_id";

export type Team = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar_url: string;
  kind: "personal" | "team";
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  my_role: "owner" | "admin" | "member" | "viewer";
};

export function getCurrentWorkspaceID(): string {
  try {
    return localStorage.getItem(WORKSPACE_KEY) || "";
  } catch {
    return "";
  }
}

export function setCurrentWorkspaceID(id: string): void {
  try {
    if (id) {
      localStorage.setItem(WORKSPACE_KEY, id);
    } else {
      localStorage.removeItem(WORKSPACE_KEY);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — switcher
    // becomes per-tab via fetch but doesn't persist.
  }
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "管理员",
  member: "成员",
  viewer: "只读",
};

const KIND_LABEL: Record<string, string> = {
  personal: "我的工作区",
  team: "团队",
};

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSwitcherStyles(): string {
  // Inline once, no styles.css edits in this PR. Scoped via class
  // prefix lp-ws-* to avoid collisions.
  return `
.lp-ws-switcher { position: relative; padding: 8px 12px; border-bottom: 1px solid var(--border, #ececf0); }
.lp-ws-trigger { display: flex; align-items: center; gap: 8px; width: 100%; background: transparent; border: 1px solid var(--border, #d9d9e0); border-radius: 8px; padding: 6px 8px; cursor: pointer; text-align: left; color: inherit; font: inherit; }
.lp-ws-trigger:hover { background: var(--surface-hover, #f3f3f6); }
.lp-ws-icon { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg,#e9e9ef,#cfd0d6); display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666; flex-shrink: 0; overflow: hidden; }
.lp-ws-icon img { width: 100%; height: 100%; object-fit: cover; }
.lp-ws-label { flex: 1; min-width: 0; overflow: hidden; }
.lp-ws-name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-ws-meta { font-size: 11px; color: var(--text-muted, #888); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-ws-chevron { font-size: 10px; color: var(--text-muted, #888); flex-shrink: 0; }
.lp-ws-menu { position: absolute; top: calc(100% - 4px); left: 12px; right: 12px; background: var(--surface, #fff); border: 1px solid var(--border, #d9d9e0); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); z-index: 100; padding: 4px; max-height: 360px; overflow-y: auto; display: none; }
.lp-ws-menu.open { display: block; }
.lp-ws-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.lp-ws-item:hover { background: var(--surface-hover, #f3f3f6); }
.lp-ws-item.active { background: var(--surface-hover, #eef2ff); }
.lp-ws-divider { height: 1px; background: var(--border, #ececf0); margin: 4px 0; }
.lp-ws-action { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; color: var(--text-muted, #555); text-decoration: none; font-size: 12px; }
.lp-ws-action:hover { background: var(--surface-hover, #f3f3f6); }
.lp-ws-empty { padding: 8px; font-size: 12px; color: var(--text-muted, #888); }
.lp-ws-trigger { position: relative; }
.lp-ws-inbox-dot { position: absolute; top: 4px; right: 4px; min-width: 14px; height: 14px; padding: 0 4px; border-radius: 7px; background: #c33; color: #fff; font-size: 10px; line-height: 14px; text-align: center; box-shadow: 0 0 0 2px var(--surface, #fff); display: none; }
.lp-ws-inbox-dot.visible { display: block; }
.lp-ws-action.lp-ws-inbox-action { font-weight: 500; color: #a22; }
  `.trim();
}

let stylesInstalled = false;
function ensureStyles(): void {
  if (stylesInstalled) return;
  stylesInstalled = true;
  const style = document.createElement("style");
  style.dataset.lpWsStyles = "1";
  style.textContent = buildSwitcherStyles();
  document.head.appendChild(style);
}

function renderItem(team: Team, activeID: string): string {
  const active = team.id === activeID ? "active" : "";
  const initial = team.name ? team.name.charAt(0).toUpperCase() : "?";
  const avatar = team.avatar_url
    ? `<img src="${escapeHTML(team.avatar_url)}" alt="" />`
    : escapeHTML(initial);
  const meta = `${KIND_LABEL[team.kind] ?? team.kind} · ${ROLE_LABEL[team.my_role] ?? team.my_role}`;
  return `
    <div class="lp-ws-item ${active}" data-ws-pick="${escapeHTML(team.id)}">
      <div class="lp-ws-icon">${avatar}</div>
      <div class="lp-ws-label">
        <div class="lp-ws-name">${escapeHTML(team.name)}</div>
        <div class="lp-ws-meta">${escapeHTML(meta)}</div>
      </div>
      ${team.id === activeID ? `<span class="lp-ws-chevron">✓</span>` : ""}
    </div>`;
}

function findActiveTeam(teams: Team[], activeID: string): Team | null {
  if (activeID) {
    const m = teams.find((t) => t.id === activeID);
    if (m) return m;
  }
  // No selection (or stale) — pick personal team if present, else
  // first available.
  return teams.find((t) => t.kind === "personal") || teams[0] || null;
}

async function fetchTeamsForSwitcher(): Promise<Team[]> {
  // Direct fetch so we don't go through the http.ts wrapper that
  // would inject X-Workspace-Id (which during initial bootstrap may
  // be stale). credentials:include for auth cookies.
  try {
    const res = await fetch("/api/teams", { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { teams: Team[] };
    return data.teams || [];
  } catch {
    return [];
  }
}

// Inbox poll cadence — invitations are low-frequency events, but
// users do expect the badge to clear shortly after they accept on
// /teams.html. 60s strikes a reasonable balance.
const INBOX_POLL_INTERVAL_MS = 60_000;

async function fetchInboxCount(): Promise<number> {
  try {
    const res = await fetch("/api/users/me/invitations/count", { credentials: "include" });
    if (!res.ok) return 0;
    const data = (await res.json()) as { count?: number };
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

function applyInboxCount(wrapper: HTMLElement, count: number): void {
  const dot = wrapper.querySelector<HTMLElement>(".lp-ws-inbox-dot");
  const action = wrapper.querySelector<HTMLElement>(".lp-ws-inbox-action");
  if (dot) {
    if (count > 0) {
      dot.textContent = count > 9 ? "9+" : String(count);
      dot.classList.add("visible");
    } else {
      dot.classList.remove("visible");
    }
  }
  if (action) {
    action.hidden = count <= 0;
    action.textContent = count > 0 ? `📬 你有 ${count} 条待处理邀请` : "";
  }
}

function pollInbox(wrapper: HTMLElement): void {
  void (async () => {
    applyInboxCount(wrapper, await fetchInboxCount());
  })();
  window.setInterval(async () => {
    applyInboxCount(wrapper, await fetchInboxCount());
  }, INBOX_POLL_INTERVAL_MS);
}

export async function installWorkspaceSwitcher(): Promise<void> {
  const nav = document.querySelector<HTMLElement>(".lp-nav");
  if (!nav) return;
  // Don't double-install across hot reloads or library re-imports.
  if (document.querySelector(".lp-ws-switcher")) return;

  ensureStyles();
  const teams = await fetchTeamsForSwitcher();
  if (teams.length === 0) return;

  const stored = getCurrentWorkspaceID();
  const active = findActiveTeam(teams, stored);
  if (!active) return;
  // Persist the resolved active id so the http.ts header reflects
  // what the user sees, even if localStorage was empty.
  if (active.id !== stored) {
    setCurrentWorkspaceID(active.id);
  }

  const wrapper = document.createElement("div");
  wrapper.className = "lp-ws-switcher";
  wrapper.innerHTML = `
    <button type="button" class="lp-ws-trigger" data-ws-trigger>
      <span class="lp-ws-inbox-dot" data-ws-inbox-dot>0</span>
      <div class="lp-ws-icon">${
        active.avatar_url
          ? `<img src="${escapeHTML(active.avatar_url)}" alt="" />`
          : escapeHTML(active.name.charAt(0).toUpperCase())
      }</div>
      <div class="lp-ws-label">
        <div class="lp-ws-name" data-ws-active-name>${escapeHTML(active.name)}</div>
        <div class="lp-ws-meta">${escapeHTML(KIND_LABEL[active.kind] ?? active.kind)} · ${escapeHTML(ROLE_LABEL[active.my_role] ?? active.my_role)}</div>
      </div>
      <span class="lp-ws-chevron">▾</span>
    </button>
    <div class="lp-ws-menu" data-ws-menu>
      ${teams.map((t) => renderItem(t, active.id)).join("")}
      <div class="lp-ws-divider"></div>
      <a class="lp-ws-action lp-ws-inbox-action" href="/teams.html" hidden></a>
      <a class="lp-ws-action" href="/teams.html">＋ 创建 / 管理工作区</a>
    </div>`;
  nav.parentNode?.insertBefore(wrapper, nav);
  pollInbox(wrapper);

  const trigger = wrapper.querySelector<HTMLButtonElement>("[data-ws-trigger]");
  const menu = wrapper.querySelector<HTMLElement>("[data-ws-menu]");
  if (!trigger || !menu) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target as Node)) {
      menu.classList.remove("open");
    }
  });

  wrapper.querySelectorAll<HTMLElement>("[data-ws-pick]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-ws-pick");
      if (!id) return;
      if (id === getCurrentWorkspaceID()) {
        menu.classList.remove("open");
        return;
      }
      setCurrentWorkspaceID(id);
      // Simplest, most reliable refresh: full reload picks up the
      // new header on every subsequent fetch on every module page.
      window.location.reload();
    });
  });
}
