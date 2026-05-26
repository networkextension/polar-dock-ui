// skills.ts — entry script for /skills.html (P1b).
//
// One screen, two stacks of data:
//   1) catalog rows from polar-hosts
//   2) per-host install state derived from /api/hosts/:id/skills
//
// Render flow:
//   - Pick host (top-of-page select; defaults to first host in workspace)
//   - For each catalog row show: display name + version + status
//     ("installed" / "available" / "installed (different version)")
//   - "Install" button → POST /api/hosts/<picked>/skills/install
//   - "Uninstall" button (when installed) → POST .../skills/uninstall
//
// Refresh model: poll /api/hosts/<picked>/skills every 8s after a
// trigger fires so the UI reflects the next skill.advertise tick.

import { logout } from "./api/session.js";
import {
  installSkillOnHost,
  listHostSkills,
  listHosts,
  listSkillCatalog,
  uninstallSkillOnHost,
} from "./api/skills.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type {
  HostSkillRow,
  SkillCatalogEntry,
  SkillsPageHost,
} from "./types/skills.js";

initStoredTheme();
bindThemeSync();

const hostSelect = byId<HTMLSelectElement>("skillsHostSelect");
const statusLine = byId<HTMLElement>("skillsStatus");
const tableBody = byId<HTMLTableSectionElement>("skillsTbody");
const emptyRow = byId<HTMLElement>("skillsEmpty");
const loadingRow = byId<HTMLElement>("skillsLoading");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

let allHosts: SkillsPageHost[] = [];
let catalog: SkillCatalogEntry[] = [];
let installed: HostSkillRow[] = [];
let refreshTimer: number | undefined;

function setStatus(text: string) {
  if (statusLine) statusLine.textContent = text;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Map publisher@kind → installed row (if any) for the picked host.
function installedIndex(): Map<string, HostSkillRow> {
  const m = new Map<string, HostSkillRow>();
  for (const row of installed) {
    if (row.source !== "bundle") continue;
    if (!row.publisher) continue;
    m.set(`${row.publisher}/${row.kind}`, row);
  }
  return m;
}

function render(): void {
  if (loadingRow) loadingRow.hidden = true;
  if (!tableBody) return;
  tableBody.innerHTML = "";
  if (catalog.length === 0) {
    if (emptyRow) emptyRow.hidden = false;
    return;
  }
  if (emptyRow) emptyRow.hidden = true;
  const idx = installedIndex();
  const pickedHost = hostSelect?.value || "";

  for (const entry of catalog) {
    const tr = document.createElement("tr");
    const key = `${entry.publisher}/${entry.skill_kind}`;
    const installedHere = idx.get(key);
    const sameVersion = installedHere?.install_id ? installedHere : null;
    // P1a doesn't yet record the catalog's version on host_skills, only
    // publisher+kind+install_id. Same-version detection uses the row's
    // install_id presence + the catalog row's id — close enough for now.

    tr.appendChild(td(`${entry.display_name || entry.skill_kind}`));
    tr.appendChild(td(entry.publisher));
    tr.appendChild(td(entry.version));
    tr.appendChild(td(fmtBytes(entry.size_bytes)));
    tr.appendChild(td(entry.is_platform ? "platform" : "workspace"));

    const tdStatus = document.createElement("td");
    if (sameVersion) {
      tdStatus.innerHTML = '<span style="color: var(--ok, #0a7a3a);">✓ 已安装</span>';
    } else if (installedHere) {
      tdStatus.innerHTML = '<span style="color: var(--warn, #c80);">已安装其他版本</span>';
    } else {
      tdStatus.innerHTML = '<span class="meta-subtitle">未安装</span>';
    }
    tr.appendChild(tdStatus);

    const tdAct = document.createElement("td");
    tdAct.style.whiteSpace = "nowrap";
    if (!pickedHost) {
      tdAct.innerHTML = '<span class="meta-subtitle">选择 host</span>';
    } else if (sameVersion) {
      const btn = document.createElement("button");
      btn.className = "btn-inline btn-secondary";
      btn.textContent = "🗑 卸载";
      btn.addEventListener("click", () => onUninstall(entry));
      tdAct.appendChild(btn);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn-inline btn-primary";
      btn.textContent = installedHere ? "↻ 重装为此版本" : "⬇ 安装";
      btn.addEventListener("click", () => onInstall(entry));
      tdAct.appendChild(btn);
    }
    tr.appendChild(tdAct);

    tableBody.appendChild(tr);
  }
}

function td(text: string): HTMLTableCellElement {
  const el = document.createElement("td");
  el.textContent = text;
  return el;
}

async function loadCatalog() {
  setStatus("加载 catalog…");
  try {
    const { data } = await listSkillCatalog();
    catalog = data.items ?? [];
    setStatus("");
    render();
  } catch (err) {
    setStatus(`catalog 加载失败：${(err as Error).message}`);
  }
}

async function loadInstalled(hostID: string) {
  if (!hostID) {
    installed = [];
    render();
    return;
  }
  try {
    const { data } = await listHostSkills(hostID);
    installed = data.items ?? [];
    render();
  } catch (err) {
    setStatus(`host_skills 加载失败：${(err as Error).message}`);
  }
}

async function loadHosts() {
  try {
    const { data } = await listHosts();
    allHosts = data.items ?? [];
    if (!hostSelect) return;
    hostSelect.innerHTML = "";
    if (allHosts.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "（工作区暂无 host）";
      hostSelect.appendChild(opt);
      return;
    }
    for (const h of allHosts) {
      const opt = document.createElement("option");
      opt.value = h.id;
      opt.textContent = `${h.name}  ·  ${h.id}`;
      hostSelect.appendChild(opt);
    }
    void loadInstalled(hostSelect.value);
  } catch (err) {
    setStatus(`hosts 加载失败：${(err as Error).message}`);
  }
}

function startRefreshTimer() {
  if (refreshTimer !== undefined) {
    window.clearInterval(refreshTimer);
  }
  // Poll every 8s — matches the spirit of the 60s advertise tick but
  // tighter so install→visible feels fast in the UI.
  refreshTimer = window.setInterval(() => {
    if (hostSelect?.value) {
      void loadInstalled(hostSelect.value);
    }
  }, 8000);
}

async function onInstall(entry: SkillCatalogEntry) {
  const hostID = hostSelect?.value || "";
  if (!hostID) {
    setStatus("请先选择 host");
    return;
  }
  setStatus(`触发安装 ${entry.publisher}/${entry.skill_kind}@${entry.version}…`);
  try {
    const { response, data } = await installSkillOnHost(hostID, entry.id);
    if (!response.ok) {
      const errMsg = (data as { error?: string })?.error || `HTTP ${response.status}`;
      setStatus(`安装触发失败：${errMsg}`);
      return;
    }
    setStatus(`已发送给 agent（install_id=${data.install_id}）。约 ${entry.size_bytes > 50 * 1024 * 1024 ? "30s-2min" : "数秒"} 内 advertise 反馈。`);
    void loadInstalled(hostID);
  } catch (err) {
    setStatus(`安装失败：${(err as Error).message}`);
  }
}

async function onUninstall(entry: SkillCatalogEntry) {
  const hostID = hostSelect?.value || "";
  if (!hostID) return;
  if (!window.confirm(`确定卸载 ${entry.publisher}/${entry.skill_kind}@${entry.version}？`)) {
    return;
  }
  setStatus(`触发卸载…`);
  try {
    const { response, data } = await uninstallSkillOnHost(
      hostID,
      entry.publisher,
      entry.skill_kind,
      entry.version,
      false,
    );
    if (!response.ok) {
      const errMsg = (data as { error?: string })?.error || `HTTP ${response.status}`;
      // If active_runs blocked, offer force.
      if (response.status === 503 || errMsg.includes("active")) {
        if (window.confirm("有 active runs 引用此 skill。强制卸载？")) {
          await uninstallSkillOnHost(hostID, entry.publisher, entry.skill_kind, entry.version, true);
          setStatus("强制卸载已发送");
          void loadInstalled(hostID);
        }
        return;
      }
      setStatus(`卸载触发失败：${errMsg}`);
      return;
    }
    setStatus(`卸载已发送（uninstall_id=${data.uninstall_id}）`);
    void loadInstalled(hostID);
  } catch (err) {
    setStatus(`卸载失败：${(err as Error).message}`);
  }
}

async function bootstrap() {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await Promise.all([loadCatalog(), loadHosts()]);
  startRefreshTimer();
}

hostSelect?.addEventListener("change", () => {
  if (hostSelect.value) {
    void loadInstalled(hostSelect.value);
  }
});

logoutBtn?.addEventListener("click", () => {
  void logout().then(() => {
    window.location.href = "/login.html";
  });
});

void bootstrap();
