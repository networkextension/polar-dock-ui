// /console.html entry point. The page chrome (sidebar nav, topbar,
// brand, theme toggle) is shared HTML with all other Polar pages, so
// we hydrate it imperatively here; React owns only #consoleRoot which
// contains the toolbar + the pane grid.

import { createRoot } from "react-dom/client";
import { ConsoleApp } from "./components/console/ConsoleApp";
import { fetchCurrentUser, logout } from "./api/session.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

async function bootstrap() {
  await hydrateSiteBrand();
  const { response, data: me } = await fetchCurrentUser();
  if (!response.ok) {
    window.location.href = "/login.html?next=/console.html";
    return;
  }
  renderSidebarFoot(me);

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logout();
    window.location.href = "/login.html";
  });

  const rootEl = document.getElementById("consoleRoot");
  if (!rootEl) {
    console.error("missing #consoleRoot in console.html");
    return;
  }
  createRoot(rootEl).render(<ConsoleApp />);
}

void bootstrap();
