// /system.html — full-screen ops view of GET /api/system/info.
//
// Unlike the dashboard widget (filtered for at-a-glance), this page
// shows EVERYTHING: all IPs (loopback / link-local included), all
// disks (no macOS pseudo-volume filter), plus the runtime sub-struct
// (goroutines / heap / db_pool) that the widget doesn't surface.
//
// Auto-poll every 10s — the dock caches the snapshot 5s server-side
// so this is a 2-scrape-per-cache cadence.

import { fetchSystemHostInfo } from "./api/sysinfo.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { SystemHostInfo } from "./types/sysinfo.js";

initStoredTheme();
bindThemeSync();

const POLL_MS = 10000;

const loading = byId<HTMLElement>("loadingState");
const error = byId<HTMLElement>("errorState");
const hero = byId<HTMLElement>("heroSection");
const heroHostname = byId<HTMLElement>("heroHostname");
const heroUname = byId<HTMLElement>("heroUname");
const heroVersion = byId<HTMLElement>("heroVersion");
const mainGrid = byId<HTMLElement>("mainGrid");
const basicTable = byId<HTMLTableElement>("basicTable");
const runtimeTable = byId<HTMLTableElement>("runtimeTable");
const ipsTable = byId<HTMLTableElement>("ipsTable");
const disksList = byId<HTMLUListElement>("disksList");
const diskSummary = byId<HTMLElement>("diskSummary");
const ipSummary = byId<HTMLElement>("ipSummary");
const runtimeSummary = byId<HTMLElement>("runtimeSummary");
const autoRefreshStatus = byId<HTMLElement>("autoRefreshStatus");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const copyBtn = byId<HTMLButtonElement>("copyJsonBtn");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

let lastRaw: SystemHostInfo | null = null;
let pollTimer: number | undefined;

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

function fmtSeconds(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function row(k: string, v: string | number | undefined | null, opts: { mono?: boolean } = {}): string {
  const val = v == null || v === "" ? "—" : String(v);
  const cls = opts.mono ? ' class="sysinfo-mono"' : "";
  return `<tr><th>${k}</th><td${cls}>${escapeHTML(val)}</td></tr>`;
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(data: SystemHostInfo): void {
  lastRaw = data;
  error.hidden = true;
  loading.hidden = true;
  hero.hidden = false;
  mainGrid.hidden = false;

  heroHostname.textContent = data.hostname || "—";
  heroUname.textContent = data.uname || "";
  const v = data.version || ({} as SystemHostInfo["version"]);
  const versionLine: string[] = [];
  if (v.git_sha) {
    versionLine.push(
      v.git_branch
        ? `${escapeHTML(v.git_branch)} <code>${escapeHTML(v.git_sha)}</code>${v.git_dirty ? ' <span style="color:var(--danger,#c00);">(dirty)</span>' : ""}`
        : `<code>${escapeHTML(v.git_sha)}</code>${v.git_dirty ? ' <span style="color:var(--danger,#c00);">(dirty)</span>' : ""}`,
    );
  }
  if (v.build_time) versionLine.push(`built ${escapeHTML(v.build_time)}`);
  if (v.go) versionLine.push(`<code>${escapeHTML(v.go)}</code>`);
  if (v.module) versionLine.push(`<code>${escapeHTML(v.module)}</code>`);
  heroVersion.innerHTML = versionLine.length > 0 ? versionLine.join(" · ") : "—";

  // Basic table
  const mem = data.memory || ({ total_bytes: 0 } as SystemHostInfo["memory"]);
  const memTotal = mem.total_bytes || 0;
  const memAvail = mem.available_bytes || 0;
  const memUsed = memTotal > 0 && memAvail > 0 ? memTotal - memAvail : 0;
  const memPct = memTotal > 0 && memUsed > 0 ? ((memUsed / memTotal) * 100).toFixed(1) + "%" : "—";
  basicTable.innerHTML = [
    row("OS / Arch", `${data.os} / ${data.arch}`, { mono: true }),
    row("CPU", `${data.cpu?.count ?? "?"} × ${data.cpu?.model || "—"}`),
    row("内存", `${fmtBytes(memUsed)} / ${fmtBytes(memTotal)} (${memPct})${memAvail ? ` · ${fmtBytes(memAvail)} 可用` : ""}`),
    row("OS 上线", fmtSeconds(data.uptime_seconds)),
    row("采集时间", new Date(data.sampled_at).toLocaleString()),
  ].join("");

  // Runtime
  const rt = data.runtime;
  if (rt) {
    runtimeTable.innerHTML = [
      row("进程上线", fmtSeconds(rt.process_uptime_seconds)),
      row("Goroutines", rt.goroutines),
      row("Heap (alloc)", fmtBytes(rt.heap_alloc_bytes)),
      row("Heap (sys)", fmtBytes(rt.heap_sys_bytes)),
      row("GC 次数", rt.gc_runs),
      rt.db_pool ? row("DB 连接池", `${rt.db_pool.in_use} 使用 / ${rt.db_pool.idle} 空闲 / ${rt.db_pool.open} 共开 · 等待 ${rt.db_pool.wait_count}`) : "",
    ].join("");
    runtimeSummary.textContent = `${rt.goroutines} goroutines · ${fmtBytes(rt.heap_alloc_bytes)} heap`;
  } else {
    runtimeTable.innerHTML = `<tr><td colspan="2" class="meta-subtitle">无 runtime 数据</td></tr>`;
    runtimeSummary.textContent = "";
  }

  // Disks
  const disks = data.disks || [];
  disksList.innerHTML = disks
    .map((d) => {
      const pct = Math.round(d.used_pct);
      const barColor = pct >= 90 ? "var(--danger,#c00)" : pct >= 75 ? "var(--warning,#e60)" : "var(--success,#0a7)";
      return `
        <li>
          <div class="sysinfo-disk-row">
            <code class="sysinfo-mount">${escapeHTML(d.mount)}</code>
            <span class="sysinfo-disk-meta">${escapeHTML(d.filesystem || "")} · ${fmtBytes(d.used_bytes)} / ${fmtBytes(d.total_bytes)} (${pct}%)</span>
          </div>
          <div class="sysinfo-disk-bar"><div class="sysinfo-disk-bar-fill" style="width:${pct}%; background:${barColor};"></div></div>
        </li>`;
    })
    .join("");
  diskSummary.textContent = `${disks.length} 挂载`;

  // IPs (full — including loopback + link-local)
  const ips = data.ip_addresses || [];
  ipsTable.innerHTML = ips
    .map(
      (ip) => `
        <tr>
          <th>${escapeHTML(ip.interface)}</th>
          <td class="sysinfo-mono">${escapeHTML(ip.address)} <span style="color:var(--text-muted,#888); font-size:11px;">(${ip.family})</span></td>
        </tr>`,
    )
    .join("");
  ipSummary.textContent = `${ips.length} 地址`;

  autoRefreshStatus.textContent = `↻ ${new Date().toLocaleTimeString()}`;
}

async function refresh(): Promise<void> {
  try {
    const { response, data } = await fetchSystemHostInfo();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    render(data);
  } catch (e) {
    error.hidden = false;
    error.textContent = `加载失败：${(e as Error).message}`;
    loading.hidden = true;
  }
}

function startPolling(): void {
  if (pollTimer != null) return;
  pollTimer = window.setInterval(() => void refresh(), POLL_MS);
}

refreshBtn.addEventListener("click", () => void refresh());
copyBtn.addEventListener("click", async () => {
  if (!lastRaw) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastRaw, null, 2));
    const prev = copyBtn.textContent;
    copyBtn.textContent = "✓ 已复制";
    setTimeout(() => (copyBtn.textContent = prev), 1500);
  } catch {
    // Ignore — user can hit "原始 JSON →" instead.
  }
});
logoutBtn.addEventListener("click", () => void logout().then(() => (window.location.href = "/login.html")));

async function bootstrap(): Promise<void> {
  await hydrateSiteBrand();
  await renderSidebarFoot();
  await refresh();
  startPolling();
}

void bootstrap();
