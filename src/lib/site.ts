import { makeDefaultAvatar } from "./avatar.js";
import { hydrateIcons } from "./icons.js";
import { applyI18n, t } from "./i18n.js";
import { installWorkspaceSwitcher } from "./workspace.js";

type SiteSettings = {
  name?: string;
  description?: string;
  icon_url?: string;
};

type SidebarUser = {
  username?: string;
  role?: string;
  icon_url?: string;
  // site_admin: P2 permission-model field from /api/me. When the
  // backend ships it, we use it to gate [data-site-admin-nav]
  // entries (audit log + future root-team-only pages). When the
  // field is missing/undefined we fall back to the legacy
  // role==='admin' check so older dock builds keep working.
  site_admin?: boolean;
};

const fallbackSite: Required<SiteSettings> = {
  name: "Polar-",
  description: "AI-assisted product prototyping workspace",
  icon_url: "",
};

function resolveSite(site?: SiteSettings): Required<SiteSettings> {
  return {
    name: site?.name?.trim() || fallbackSite.name,
    description: site?.description?.trim() || fallbackSite.description,
    icon_url: site?.icon_url || "",
  };
}

export function renderSiteBrand(site?: SiteSettings): void {
  const safeSite = resolveSite(site);
  const iconSrc = safeSite.icon_url || makeDefaultAvatar(safeSite.name, 160);

  document.querySelectorAll<HTMLElement>("[data-site-brand]").forEach((container) => {
    const nameEl = container.querySelector<HTMLElement>("[data-site-name]");
    const descEl = container.querySelector<HTMLElement>("[data-site-description]");
    const iconEl = container.querySelector<HTMLImageElement>("[data-site-icon]");

    if (nameEl) {
      nameEl.textContent = safeSite.name;
    }
    if (descEl) {
      descEl.textContent = safeSite.description;
    }
    if (iconEl) {
      iconEl.src = iconSrc;
      iconEl.alt = `${safeSite.name} ${t("brand.icon")}`;
    }
  });

  // Pages that opt in via <title data-site-title>...</title> get the
  // configured site name written into document.title. Other pages
  // keep whatever static title their HTML already has (e.g.
  // <title data-i18n-title="login.title">Login</title>).
  const titleEl = document.querySelector<HTMLTitleElement>("title[data-site-title]");
  if (titleEl) {
    titleEl.textContent = safeSite.name;
  }
}

const SIDEBAR_COLLAPSED_KEY = "lp_sidebar_collapsed";

export function initSettingsButton(): void {
  // On the dashboard, dashboard.ts handles [data-open-settings-center] directly.
  // On every other page, redirect to dashboard with ?settings= so the modal opens there.
  const isDashboard = window.location.pathname.endsWith("/dashboard.html") || window.location.pathname === "/";
  if (isDashboard) {
    return;
  }
  document.querySelectorAll<HTMLElement>("[data-open-settings-center]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.settingsTarget || "personalization";
      window.location.href = `/dashboard.html?settings=${encodeURIComponent(target)}`;
    });
  });
}

export function initSidebarToggle(): void {
  const topbar = document.querySelector<HTMLElement>(".lp-topbar");
  const app = document.querySelector<HTMLElement>(".lp-app");
  if (!topbar || !app) {
    return;
  }
  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
    app.classList.add("sidebar-collapsed");
  }
  const btn = document.createElement("button");
  btn.className = "lp-sidebar-toggle";
  btn.title = "Toggle sidebar";
  btn.setAttribute("aria-label", "Toggle sidebar");
  btn.textContent = "☰";

  // Mobile drawer needs a click-target outside the drawer to close it.
  // Inject one inside .lp-app so the existing fixed-positioned drawer
  // CSS finds it as a sibling. Idempotent — pages that re-init don't
  // accumulate backdrops.
  let backdrop = app.querySelector<HTMLElement>(".lp-mobile-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "lp-mobile-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    app.appendChild(backdrop);
  }
  backdrop.addEventListener("click", () => {
    app.classList.remove("mobile-nav-open");
  });

  // Single media query for mobile-vs-desktop dispatch. Listen for size
  // changes so resizing across the breakpoint cleans up any stale state
  // (e.g. drawer was open on mobile, user rotates wider — drop the class
  // so the desktop sidebar isn't stuck in mobile drawer styles).
  const mq = window.matchMedia("(max-width: 860px)");
  const onBreakpoint = () => {
    if (mq.matches) {
      app.classList.remove("sidebar-collapsed");
    } else {
      app.classList.remove("mobile-nav-open");
    }
  };
  mq.addEventListener?.("change", onBreakpoint);
  onBreakpoint();

  btn.addEventListener("click", () => {
    if (mq.matches) {
      // Mobile: toggle drawer; don't persist (user expects fresh-page
      // load to start with drawer closed, like a typical mobile site).
      app.classList.toggle("mobile-nav-open");
      return;
    }
    // Desktop: toggle the collapse class as before, persist to LS so
    // the choice survives reloads.
    const collapsed = app.classList.toggle("sidebar-collapsed");
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  });
  topbar.insertBefore(btn, topbar.firstChild);

  // Tapping a nav link inside the drawer should close the drawer
  // immediately — otherwise the new page loads with the drawer still
  // showing on top of the content for a beat. Foot icon buttons
  // (settings / logout) get the same treatment so the drawer doesn't
  // linger when the settings center modal opens behind it.
  app.querySelectorAll<HTMLElement>(
    ".lp-sidebar .lp-nav-item, .lp-sidebar .lp-foot-icon-btn",
  ).forEach((el) => {
    el.addEventListener("click", () => {
      if (mq.matches) {
        app.classList.remove("mobile-nav-open");
      }
    });
  });
}

export async function hydrateSiteBrand(): Promise<void> {
  applyI18n();
  // Inline-SVG icon hydration runs early so the nav doesn't show a
  // brief Unicode-fallback glyph when the page first paints. Re-run
  // is cheap; pages that mutate the DOM after their own bootstrap
  // (e.g. project list rendering) can call hydrateIcons() again on
  // the changed subtree.
  hydrateIcons();
  initSidebarToggle();
  initSettingsButton();
  await hydrateSidebarFoot();
  // Workspace switcher (T4): runs after the foot hydrate so the
  // sidebar is fully laid out. No-op on pages without .lp-nav (e.g.,
  // login / register / public invite preview).
  void installWorkspaceSwitcher();

  if (!document.querySelector("[data-site-brand]")) {
    return;
  }

  try {
    const response = await fetch("/api/site-settings", { credentials: "include" });
    if (!response.ok) {
      renderSiteBrand();
      return;
    }
    const data = await response.json();
    renderSiteBrand(data.site);
  } catch {
    renderSiteBrand();
  }
}

export function renderSidebarFoot(user?: SidebarUser): void {
  const nameEl = document.getElementById("lpFootName");
  const roleEl = document.getElementById("lpFootRole");
  const avatarEl = document.getElementById("lpFootAvatar");

  if (!nameEl && !roleEl && !avatarEl) {
    return;
  }

  const username = (user?.username || "").trim();
  if (nameEl) {
    nameEl.textContent = username || "—";
  }
  if (roleEl) {
    roleEl.textContent = user?.role === "admin" ? "Administrator" : "Member";
  }
  if (avatarEl) {
    const avatar = username ? username.slice(0, 1).toUpperCase() : "U";
    if (user?.icon_url) {
      avatarEl.style.backgroundImage = `url(${user.icon_url})`;
      avatarEl.style.backgroundSize = "cover";
      avatarEl.style.backgroundPosition = "center";
      avatarEl.textContent = "";
    } else {
      avatarEl.style.backgroundImage = "";
      avatarEl.style.backgroundSize = "";
      avatarEl.style.backgroundPosition = "";
      avatarEl.textContent = avatar;
    }
  }

  const isAdmin = user?.role === "admin";
  document.querySelectorAll<HTMLElement>("[data-admin-nav]").forEach((el) => {
    el.hidden = !isAdmin;
  });

  // P2 site-admin gating. Show [data-site-admin-nav] entries only to
  // users whose /api/me response sets site_admin=true. Older backends
  // that don't ship site_admin yet are treated as "legacy admin =
  // show" so we don't accidentally hide working pages mid-rollout.
  const siteAdminKnown = typeof user?.site_admin === "boolean";
  const showSiteAdmin = siteAdminKnown ? user!.site_admin === true : isAdmin;
  document.querySelectorAll<HTMLElement>("[data-site-admin-nav]").forEach((el) => {
    el.hidden = !showSiteAdmin;
  });
}

// P2 helper: pages that need to guard their own body (not just the
// sidebar) can call this after hydrateSidebarFoot() resolves. Returns
// the cached whoami payload from the most recent fetch.
let cachedWhoami: SidebarUser | null = null;
export function getCachedWhoami(): SidebarUser | null {
  return cachedWhoami;
}

export async function hydrateSidebarFoot(): Promise<void> {
  const hasFoot = document.getElementById("lpFootName") || document.getElementById("lpFootRole") || document.getElementById("lpFootAvatar");
  if (!hasFoot) {
    return;
  }

  try {
    const response = await fetch("/api/me", { credentials: "include" });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    cachedWhoami = data as SidebarUser;
    renderSidebarFoot(data);
  } catch {
    // Keep static placeholders on network failure.
  }
}
