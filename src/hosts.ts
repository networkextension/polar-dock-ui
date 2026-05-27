// /hosts.html — physical-asset view (Agent Identity v4 / Phase F).
//
// One bundle, two views. On boot we check the URL query for `?id=...`:
//   - present → render the detail view for that host id
//   - absent  → render the list view (auto-refresh 15s)
//
// v4 split this page's role: hosts are now the *physical asset*
// (hardware + capacity peaks). Logical agents (bot binding, last
// hello, token) live on the sibling /agents.html page. The "▾ 实例"
// footer on each card links over with ?host_id=... pre-filled.
//
// Backend exposes GET /api/hosts and GET /api/hosts/:id. mem_peak_bytes
// / cpu_peak_pct columns ship in v4 (PR #355) but aren't yet surfaced
// in the /api/hosts SELECT — the UI gracefully shows "—" until that
// follow-up lands. Pre-v0.4 agents send host_info={}, so every field
// in HostInfo is optional and the detail card has to gracefully fall
// back to "hardware info pending agent upgrade".
//
// Pattern mirrors admin-audit-log.ts: byId helpers, hydrateSiteBrand /
// hydrateSidebarFoot bootstrap, plain DOM API, no framework. The edit
// section on the detail view is a UI-only stub for now — the PATCH
// endpoint ships in a follow-up; submitting shows a "not implemented"
// toast.

import { enrollHost, fetchHost, fetchHosts } from "./api/hosts.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { AdvertisedSkill, Host, HostInfo } from "./types/hosts.js";

initStoredTheme();
bindThemeSync();

// ── helpers ────────────────────────────────────────────────────────────────

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtBytes(n: number | undefined): string {
  if (!n || !Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  // GB+ usually want integer values; smaller units one decimal.
  const fixed = v >= 100 ? 0 : v >= 10 ? 0 : 1;
  // Memory is typically reported as power-of-two multiples (e.g.
  // 68719476736 = 64 GiB). Round to int when the result is very close
  // to a whole number so "64.0 GB" reads as "64 GB".
  const rounded = Math.round(v);
  if (i >= 3 && Math.abs(v - rounded) < 0.05) {
    return `${rounded} ${units[i]}`;
  }
  return `${v.toFixed(fixed)} ${units[i]}`;
}

function fmtRelativeSec(secondsAgo: number): string {
  if (!Number.isFinite(secondsAgo) || secondsAgo < 0) return "—";
  if (secondsAgo < 5) return "just now";
  if (secondsAgo < 60) return `${Math.round(secondsAgo)}s ago`;
  const m = Math.round(secondsAgo / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function fmtRelativeISO(ts?: string): string {
  if (!ts) return "—";
  try {
    const then = new Date(ts).getTime();
    if (!Number.isFinite(then)) return ts;
    return fmtRelativeSec((Date.now() - then) / 1000);
  } catch {
    return ts;
  }
}

function fmtAbsoluteISO(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

function fmtUptime(bootUnix: number | undefined): string {
  if (!bootUnix || !Number.isFinite(bootUnix) || bootUnix <= 0) return "—";
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - bootUnix));
  if (sec < 60) return `${sec} seconds`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} minutes`;
  const h = Math.floor(sec / 3600);
  if (h < 48) return `${h} hours`;
  const d = Math.floor(sec / 86400);
  return `${d} days`;
}

function secondsSince(ts?: string): number {
  if (!ts) return Number.POSITIVE_INFINITY;
  const then = new Date(ts).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / 1000;
}

function onlineDot(lastSeen?: string): string {
  // Green within 60s, yellow within 5min, gray older / unknown.
  // Single source of truth for the dot — used in both list and detail.
  const s = secondsSince(lastSeen);
  let color = "#9ca3af"; // gray
  let label = "offline";
  if (s < 60) { color = "#10b981"; label = "online"; }
  else if (s < 300) { color = "#f59e0b"; label = "stale"; }
  return `<span title="${escapeHTML(label)}" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; vertical-align:middle; margin-right:6px;"></span>`;
}

function virtBadge(virt?: string): string {
  if (!virt || virt === "none" || virt === "") return "";
  return ` <span class="badge" style="background:rgba(99,102,241,0.16); color:#4338ca; font-size:11px; padding:1px 6px; border-radius:4px;">🖥️ ${escapeHTML(virt)}</span>`;
}

// v4: cpu_peak_pct badge. Color tracks "how stressed has this box
// been in the last 24h" — green <60, yellow 60-85, red >85.
function cpuPeakBadge(pct?: number): string {
  if (pct === undefined || pct === null || !Number.isFinite(pct) || pct <= 0) return "";
  let bg = "rgba(16,185,129,0.16)";
  let fg = "#047857";
  if (pct >= 85) { bg = "rgba(239,68,68,0.16)"; fg = "#b91c1c"; }
  else if (pct >= 60) { bg = "rgba(245,158,11,0.16)"; fg = "#b45309"; }
  return ` <span class="badge" title="24h CPU peak" style="background:${bg}; color:${fg}; font-size:11px; padding:1px 6px; border-radius:4px;">CPU↑ ${pct.toFixed(0)}%</span>`;
}

// v4: "48 GB / peak 32 GB" — total + peak in one cell. Empty when
// neither field is present.
function memWithPeak(totalBytes?: number, peakBytes?: number): string {
  const total = totalBytes && totalBytes > 0 ? fmtBytes(totalBytes) : "";
  const peak = peakBytes && peakBytes > 0 ? fmtBytes(peakBytes) : "";
  if (total && peak) return `${total} / peak ${peak}`;
  if (total) return total;
  if (peak) return `peak ${peak}`;
  return "";
}

function fmtCores(info: HostInfo): string {
  // Apple Silicon: prefer "12P+4E" if we know the split.
  if (info.cpu_cores_perf && info.cpu_cores_eff) {
    return `${info.cpu_cores_perf}P+${info.cpu_cores_eff}E`;
  }
  if (info.cpu_cores) return `${info.cpu_cores} cores`;
  return "";
}

function hostInfoEmpty(info?: HostInfo): boolean {
  if (!info) return true;
  return Object.keys(info).length === 0;
}

// fmtIPv4ByIface renders "en0: 192.168.11.35 · utun0: 10.88.0.7"
// for the per-iface map shipped on hello frames (agent v0.3.4+).
// Interfaces are sorted alphabetically so the display is stable
// across reloads — operators depend on the same iface always sitting
// in the same slot. Returns "" when the map is empty/missing so the
// caller can skip the row entirely (no empty placeholder).
function fmtIPv4ByIface(map?: Record<string, string>): string {
  if (!map) return "";
  const keys = Object.keys(map).filter((k) => map[k]).sort();
  if (keys.length === 0) return "";
  return keys.map((k) => `${escapeHTML(k)}: ${escapeHTML(map[k])}`).join(" · ");
}

// One-line list-row hardware summary. Returns "" when host_info is
// empty so the caller can swap in the upgrade hint.
//
// v4: memory cell merges total + 24h peak ("48 GB / peak 32 GB"). The
// peak comes from hosts.mem_peak_bytes, populated by the agent's
// /internal/v1/hosts/hello GREATEST update.
function fmtListSummary(h: Host): string {
  const i = h.host_info;
  if (!i || hostInfoEmpty(i)) return "";
  const bits: string[] = [];
  if (i.hw_model) bits.push(escapeHTML(i.hw_model));
  if (i.cpu_brand) bits.push(escapeHTML(i.cpu_brand));
  const cores = fmtCores(i);
  if (cores) bits.push(escapeHTML(cores));
  const mem = memWithPeak(i.memory_bytes, h.mem_peak_bytes);
  if (mem) bits.push(escapeHTML(mem));
  if (i.gpu?.model) bits.push(escapeHTML(i.gpu.model));
  if (i.os_name) {
    const ver = i.os_version ? ` ${i.os_version}` : "";
    bits.push(`${escapeHTML(i.os_name)}${escapeHTML(ver)}`);
  } else if (i.os_pretty) {
    bits.push(escapeHTML(i.os_pretty));
  }
  return bits.join(" · ");
}

// ── routing ────────────────────────────────────────────────────────────────

function getQueryHostID(): string {
  return new URLSearchParams(window.location.search).get("id") ?? "";
}

// ── list view ──────────────────────────────────────────────────────────────

const FILTER_OS_KEY = "polar_hosts_filter_os";
const FILTER_VIRT_KEY = "polar_hosts_filter_virt";
const FILTER_MEM_KEY = "polar_hosts_filter_mem";

type ListState = {
  hosts: Host[];
  loaded: boolean;
};

const listState: ListState = { hosts: [], loaded: false };

function readListFilters(): { os: string; virt: string; minMemGB: number } {
  const osSel = document.getElementById("filterOS") as HTMLSelectElement | null;
  const virtSel = document.getElementById("filterVirt") as HTMLSelectElement | null;
  const memSel = document.getElementById("filterMinMem") as HTMLSelectElement | null;
  const minMemGB = parseInt(memSel?.value || "0", 10) || 0;
  return {
    os: osSel?.value || "",
    virt: virtSel?.value || "",
    minMemGB,
  };
}

function applyFilters(rows: Host[]): Host[] {
  const f = readListFilters();
  return rows.filter((h) => {
    if (f.os && h.os !== f.os) return false;
    if (f.virt) {
      const v = h.host_info?.virt || "";
      // "none" filter matches both explicit "none" and empty (we
      // treat the absence of a virt field as bare-metal too).
      if (f.virt === "none") {
        if (v && v !== "none") return false;
      } else if (v !== f.virt) {
        return false;
      }
    }
    if (f.minMemGB > 0) {
      const bytes = h.host_info?.memory_bytes || 0;
      const gb = bytes / (1024 * 1024 * 1024);
      if (gb < f.minMemGB) return false;
    }
    return true;
  });
}

function renderListRow(h: Host): HTMLDivElement {
  // v4: outer card is a <div>, not <a>, because we now have two
  // independent click targets inside it (the body navigates to the
  // host detail; the "▾ 实例 (N)" footer navigates to /agents.html
  // pre-filtered for this host). Wrapping the whole thing in <a>
  // would nest links, which is invalid HTML and breaks middle-click.
  const card = document.createElement("div");
  card.className = "lp-hosts-row";
  card.style.cssText = "display:block; padding:10px 12px; border:1px solid var(--surface-strong, #e5e7eb); border-radius:6px; margin-bottom:6px; background:var(--surface, #fff);";

  const summary = fmtListSummary(h);
  const summaryHTML = summary
    ? `<div style="font-size:12px; color:var(--text-muted, #6b7280); margin-top:2px;">${summary}</div>`
    : `<div style="font-size:12px; color:var(--text-muted, #888); margin-top:2px; font-style:italic;">主机信息待 agent 升级 (v0.4+)</div>`;

  // Per-iface IPv4 line (agent v0.3.4+). Skip silently when missing —
  // pre-v0.3.4 agents don't ship the map at all.
  const ipv4Line = fmtIPv4ByIface(h.host_info?.ipv4_by_iface);
  const ipv4HTML = ipv4Line
    ? `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; color:var(--text-muted, #6b7280); margin-top:2px;">${ipv4Line}</div>`
    : "";

  const lastSeenRel = h.last_seen_at ? fmtRelativeISO(h.last_seen_at) : "—";
  const ip = h.last_seen_ip ? escapeHTML(h.last_seen_ip) : "—";

  const detailHref = `/hosts.html?id=${encodeURIComponent(h.id)}`;
  const agentsHref = `/agents.html?host_id=${encodeURIComponent(h.id)}`;
  // Count comes from a server-side join (not yet wired) — show "?" when
  // the field is missing so it's obvious it's a pending number.
  const agentsCount = typeof h.agents_count === "number"
    ? String(h.agents_count)
    : "?";

  card.innerHTML =
    `<a href="${detailHref}" style="display:block; text-decoration:none; color:inherit;">` +
      `<div style="display:flex; align-items:center; gap:4px; flex-wrap:wrap;">` +
        `${onlineDot(h.last_seen_at)}` +
        `<strong>${escapeHTML(h.name || h.slug || h.id)}</strong>` +
        `${virtBadge(h.host_info?.virt)}` +
        `${cpuPeakBadge(h.cpu_peak_pct)}` +
        `<span style="color:var(--text-muted, #888); font-size:11px; margin-left:auto;">last seen ${escapeHTML(lastSeenRel)} · ${ip}</span>` +
      `</div>` +
      summaryHTML +
      ipv4HTML +
    `</a>` +
    `<div style="margin-top:8px; padding-top:6px; border-top:1px dashed var(--surface-strong, #e5e7eb);">` +
      `<a href="${agentsHref}" style="font-size:12px; color:var(--accent, #2563eb); text-decoration:none;" title="跳转到 /agents.html 仅看本主机上的 agent 实例">▾ 实例 (${agentsCount})</a>` +
    `</div>`;

  return card;
}

function renderListView(): void {
  const container = byId<HTMLElement>("hostsContainer");
  const filtered = applyFilters(listState.hosts);
  container.innerHTML = "";
  const metaEl = document.getElementById("hostsMeta");
  if (metaEl) {
    if (!listState.loaded) {
      metaEl.textContent = "加载中…";
    } else {
      metaEl.textContent = `${filtered.length} / ${listState.hosts.length} 台`;
    }
  }
  if (!listState.loaded) {
    container.innerHTML = `<div class="meta-subtitle">加载中…</div>`;
    return;
  }
  if (filtered.length === 0) {
    if (listState.hosts.length === 0) {
      container.innerHTML = `<div class="meta-subtitle">暂无已注册主机。安装 agent 后会自动出现在这里。</div>`;
    } else {
      container.innerHTML = `<div class="meta-subtitle">没有符合筛选条件的主机。调整 OS / 虚拟化 / 内存 筛选。</div>`;
    }
    return;
  }
  for (const h of filtered) container.appendChild(renderListRow(h));
}

let listInFlight = false;
async function refreshList(): Promise<void> {
  if (listInFlight) return;
  listInFlight = true;
  const errEl = document.getElementById("hostsError");
  if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
  try {
    const { response, data } = await fetchHosts();
    if (!response.ok) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = `加载失败：${data.error || `HTTP ${response.status}`}`;
      }
      return;
    }
    listState.hosts = data.hosts ?? [];
    listState.loaded = true;
    renderListView();
  } catch (err) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = `加载失败：${(err as Error).message}`;
    }
  } finally {
    listInFlight = false;
  }
}

function persistFilters(): void {
  const f = readListFilters();
  try {
    localStorage.setItem(FILTER_OS_KEY, f.os);
    localStorage.setItem(FILTER_VIRT_KEY, f.virt);
    localStorage.setItem(FILTER_MEM_KEY, String(f.minMemGB));
  } catch {
    // Storage disabled — filters just don't persist. Not fatal.
  }
}

function restoreFilters(): void {
  try {
    const os = localStorage.getItem(FILTER_OS_KEY) ?? "";
    const virt = localStorage.getItem(FILTER_VIRT_KEY) ?? "";
    const mem = localStorage.getItem(FILTER_MEM_KEY) ?? "0";
    const osSel = document.getElementById("filterOS") as HTMLSelectElement | null;
    const virtSel = document.getElementById("filterVirt") as HTMLSelectElement | null;
    const memSel = document.getElementById("filterMinMem") as HTMLSelectElement | null;
    if (osSel) osSel.value = os;
    if (virtSel) virtSel.value = virt;
    if (memSel) memSel.value = mem;
  } catch {
    // Same as above — no-op on storage failure.
  }
}

function initListView(): void {
  // Reveal the list shell, hide the detail shell.
  byId<HTMLElement>("listView").hidden = false;
  byId<HTMLElement>("detailView").hidden = true;

  restoreFilters();

  const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement | null;
  refreshBtn?.addEventListener("click", () => void refreshList());

  ["filterOS", "filterVirt", "filterMinMem"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("change", () => {
      persistFilters();
      renderListView();
    });
  });

  void refreshList();

  // Auto-refresh every 15s; skip while hidden to avoid burning
  // requests no one can see. Re-render on every tick even without
  // fetch since the relative timestamps drift.
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    void refreshList();
  }, 15_000);

  // Pure clock-tick re-render (no fetch) so "12s ago" stays fresh
  // between the 15s data pulls.
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!listState.loaded) return;
    renderListView();
  }, 5_000);
}

// ── detail view ────────────────────────────────────────────────────────────

function fmtSkillRow(s: AdvertisedSkill): string {
  const v = s.version ? ` <code style="font-size:11px;">v${escapeHTML(s.version)}</code>` : "";
  return `<li><strong>${escapeHTML(s.kind)}</strong>${v}</li>`;
}

function renderHardwareCard(host: Host): string {
  const i = host.host_info;
  if (!i || hostInfoEmpty(i)) {
    return `
      <div class="settings-section-card" style="margin-bottom:8px;">
        <div class="settings-section-title">硬件</div>
        <div class="meta-subtitle" style="font-style:italic;">主机信息待 agent 升级 (v0.4+)</div>
      </div>`;
  }
  const cores = fmtCores(i);
  const gpu = i.gpu
    ? [i.gpu.vendor, i.gpu.model, i.gpu.cores ? `${i.gpu.cores} cores` : ""]
        .filter(Boolean).map((x) => escapeHTML(x as string)).join(" · ")
    : "";
  // v4: surface mem_peak_bytes + cpu_peak_pct (rolling 24h peak from
  // agent samples). When the field is undefined (older dock that
  // doesn't yet SELECT the new columns), show "—" rather than 0 so
  // operators can tell "no data" from "really zero".
  const memTotal = fmtBytes(i.memory_bytes);
  const memPeak = host.mem_peak_bytes && host.mem_peak_bytes > 0
    ? `${fmtBytes(host.mem_peak_bytes)} <span class="meta-subtitle" style="font-size:11px;">(24h peak)</span>`
    : `<span class="meta-subtitle">—</span>`;
  const cpuPeak = host.cpu_peak_pct !== undefined && host.cpu_peak_pct > 0
    ? `${host.cpu_peak_pct.toFixed(1)}% <span class="meta-subtitle" style="font-size:11px;">(24h peak)</span>`
    : `<span class="meta-subtitle">—</span>`;
  const rows: Array<[string, string]> = [
    ["机型", i.hw_model ? escapeHTML(i.hw_model) : "—"],
    ["厂商", i.hw_vendor ? escapeHTML(i.hw_vendor) : "—"],
    ["CPU", i.cpu_brand ? escapeHTML(i.cpu_brand) : "—"],
    ["核心数", cores || "—"],
    ["内存总量", memTotal],
    ["内存峰值", memPeak],
    ["CPU 峰值", cpuPeak],
    ["GPU", gpu || "—"],
    // Reserved for a future phase (doc/arch/agent-identity-v4.md):
    // GPU components (multiple slots, fault history). The row is a
    // placeholder so the card layout doesn't shift when collection lands.
    ["GPU 组件", `<span class="meta-subtitle" style="font-style:italic;">待后续 phase — 多 GPU/组件健康追踪</span>`],
  ];
  const tbody = rows
    .map(([k, v]) => `<tr><td style="padding:4px 8px 4px 0; color:var(--text-muted, #6b7280); white-space:nowrap;">${escapeHTML(k)}</td><td style="padding:4px 0;">${v}</td></tr>`)
    .join("");
  return `
    <div class="settings-section-card" style="margin-bottom:8px;">
      <div class="settings-section-title">硬件</div>
      <table style="border-collapse:collapse; font-size:13px;"><tbody>${tbody}</tbody></table>
    </div>`;
}

function renderOSCard(host: Host): string {
  const i = host.host_info;
  if (!i || hostInfoEmpty(i)) return "";
  const osName = [i.os_name, i.os_version].filter(Boolean).join(" ");
  const osBuild = i.os_build ? ` (build ${escapeHTML(i.os_build)})` : "";
  const rows: Array<[string, string]> = [
    ["系统", osName ? `${escapeHTML(osName)}${osBuild}` : "—"],
    ["发行类型", i.os_release_type ? escapeHTML(i.os_release_type) : "—"],
  ];
  if (i.os_pretty) rows.push(["发行版", escapeHTML(i.os_pretty)]);
  rows.push(["内核", i.kernel ? `<code style="font-size:11px;">${escapeHTML(i.kernel)}</code>` : "—"]);
  rows.push([
    "虚拟化",
    i.virt && i.virt !== "none" && i.virt !== ""
      ? `<span class="badge" style="background:rgba(99,102,241,0.16); color:#4338ca; padding:1px 6px; border-radius:4px;">🖥️ ${escapeHTML(i.virt)}</span>`
      : "bare metal",
  ]);
  rows.push(["运行时长", fmtUptime(i.boot_unix)]);
  const tbody = rows
    .map(([k, v]) => `<tr><td style="padding:4px 8px 4px 0; color:var(--text-muted, #6b7280); white-space:nowrap;">${escapeHTML(k)}</td><td style="padding:4px 0;">${v}</td></tr>`)
    .join("");
  return `
    <div class="settings-section-card" style="margin-bottom:8px;">
      <div class="settings-section-title">操作系统</div>
      <table style="border-collapse:collapse; font-size:13px;"><tbody>${tbody}</tbody></table>
    </div>`;
}

function renderNetworkCard(host: Host): string {
  const ipv4Line = fmtIPv4ByIface(host.host_info?.ipv4_by_iface);
  const rows: Array<[string, string]> = [
    ["最近 IP", host.last_seen_ip ? `<code>${escapeHTML(host.last_seen_ip)}</code>` : "—"],
    ["接口 IPv4", ipv4Line
      ? `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px;">${ipv4Line}</span>`
      : `<span class="meta-subtitle">—</span>`],
    ["最近上报", host.last_seen_at
      ? `<span title="${escapeHTML(fmtAbsoluteISO(host.last_seen_at))}">${escapeHTML(fmtRelativeISO(host.last_seen_at))}</span>`
      : "—"],
    ["agent token", host.agent_token_id
      ? `<code style="font-size:11px;">${escapeHTML(host.agent_token_id)}</code>`
      : "—"],
    ["架构 / OS", `${escapeHTML(host.os || "?")} · ${escapeHTML(host.arch || "?")}`],
  ];
  const tbody = rows
    .map(([k, v]) => `<tr><td style="padding:4px 8px 4px 0; color:var(--text-muted, #6b7280); white-space:nowrap;">${escapeHTML(k)}</td><td style="padding:4px 0;">${v}</td></tr>`)
    .join("");
  return `
    <div class="settings-section-card" style="margin-bottom:8px;">
      <div class="settings-section-title">网络</div>
      <table style="border-collapse:collapse; font-size:13px;"><tbody>${tbody}</tbody></table>
    </div>`;
}

function renderSkillsCard(host: Host): string {
  const skills = host.advertised_skills ?? [];
  if (skills.length === 0) {
    return `
      <div class="settings-section-card" style="margin-bottom:8px;">
        <div class="settings-section-title">已声明技能</div>
        <div class="meta-subtitle">无（agent 未声明任何 capability）</div>
      </div>`;
  }
  const items = skills.map(fmtSkillRow).join("");
  return `
    <div class="settings-section-card" style="margin-bottom:8px;">
      <div class="settings-section-title">已声明技能</div>
      <ul style="margin:0; padding-left:18px;">${items}</ul>
    </div>`;
}

let detailHost: Host | null = null;

function renderDetailHeader(host: Host): void {
  const h = byId<HTMLElement>("detailHeader");
  const agentsHref = `/agents.html?host_id=${encodeURIComponent(host.id)}`;
  h.innerHTML =
    `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">` +
      `${onlineDot(host.last_seen_at)}` +
      `<strong style="font-size:18px;">${escapeHTML(host.name || host.slug || host.id)}</strong>` +
      `<code style="font-size:11px; color:var(--text-muted, #6b7280);">${escapeHTML(host.slug || host.id)}</code>` +
      `${virtBadge(host.host_info?.virt)}` +
      `${cpuPeakBadge(host.cpu_peak_pct)}` +
      `<a href="${agentsHref}" class="btn-inline btn-secondary" style="margin-left:auto; text-decoration:none; font-size:12px;" title="跳转到 /agents.html 查看本主机上的 agent 实例">▾ 查看 agents</a>` +
    `</div>` +
    `<div style="font-size:12px; color:var(--text-muted, #6b7280); margin-top:4px;">workspace <code>${escapeHTML(host.workspace_id || "—")}</code></div>`;
}

function renderDetailBody(host: Host): void {
  const body = byId<HTMLElement>("detailBody");
  body.innerHTML =
    renderHardwareCard(host) +
    renderOSCard(host) +
    renderNetworkCard(host) +
    renderSkillsCard(host);
}

function renderDetailEditForm(host: Host): void {
  const editName = document.getElementById("editHostName") as HTMLInputElement | null;
  if (editName) editName.value = host.name || "";
}

async function refreshDetail(hostID: string): Promise<void> {
  const errEl = document.getElementById("detailError");
  if (errEl) { errEl.hidden = true; errEl.textContent = ""; }
  try {
    const { response, data } = await fetchHost(hostID);
    if (!response.ok || !data.host) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = `加载失败：${data.error || `HTTP ${response.status}`}`;
      }
      return;
    }
    detailHost = data.host;
    renderDetailHeader(data.host);
    renderDetailBody(data.host);
    renderDetailEditForm(data.host);
    const metaEl = document.getElementById("detailMeta");
    if (metaEl && data.host.last_seen_at) {
      metaEl.textContent = `last seen ${fmtRelativeISO(data.host.last_seen_at)}`;
    }
  } catch (err) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = `加载失败：${(err as Error).message}`;
    }
  }
}

// Lightweight inline toast — no shared toast util in this repo yet,
// and we only need it for the "not implemented" PATCH stub.
function inlineToast(msg: string, kind: "info" | "error" = "info"): void {
  const slot = document.getElementById("editStatus");
  if (!slot) return;
  slot.textContent = msg;
  slot.style.color = kind === "error" ? "var(--danger, #c00)" : "var(--text-muted, #6b7280)";
  slot.hidden = false;
}

function initDetailView(hostID: string): void {
  byId<HTMLElement>("listView").hidden = true;
  byId<HTMLElement>("detailView").hidden = false;

  // Back link drops the query param to return to list mode.
  const backBtn = document.getElementById("detailBackBtn") as HTMLAnchorElement | null;
  if (backBtn) backBtn.href = "/hosts.html";

  // Edit section is collapsed by default. The summary→content toggle
  // is native via <details>, but we still wire submit + cancel so the
  // stub behaviour matches the brief (toast on submit, collapse on
  // cancel).
  const editForm = document.getElementById("editForm") as HTMLFormElement | null;
  editForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    // PATCH /api/hosts/:id doesn't exist yet — this UI lands ahead of
    // the backend. The brief calls for a stub here; the actual call
    // ships in a follow-up PR.
    inlineToast("PATCH /api/hosts/:id 尚未实现 — 后续 PR 接入。", "error");
  });
  const cancelBtn = document.getElementById("editCancelBtn") as HTMLButtonElement | null;
  cancelBtn?.addEventListener("click", () => {
    const det = document.getElementById("editDetails") as HTMLDetailsElement | null;
    if (det) det.open = false;
    if (detailHost) renderDetailEditForm(detailHost);
    const slot = document.getElementById("editStatus");
    if (slot) { slot.hidden = true; slot.textContent = ""; }
  });

  const refreshBtn = document.getElementById("refreshBtn") as HTMLButtonElement | null;
  refreshBtn?.addEventListener("click", () => void refreshDetail(hostID));

  void refreshDetail(hostID);

  // Refresh the detail view every 15s so the "last seen" header stays
  // current — same cadence as the list page.
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    void refreshDetail(hostID);
  }, 15_000);
}

// ── add-host modal ─────────────────────────────────────────────────────────
//
// Wraps the "+ 添加主机" topbar button. Calls POST /api/hosts/enroll with
// just {name} — that returns a one-time enroll token (1h TTL) plus the
// literal `polar-agent register` snippet the operator pastes on the new
// box. On register the agent gets back a permanent agent_token and the
// host row appears in the list within seconds.
//
// (Earlier this morning the button was wired to POST /api/agent/tokens by
// mistake — that's the bot-attach agent_token flow, not the host-enroll
// flow. Tokens from that endpoint don't satisfy
// polar-hosts/internal/hosts/host_handlers.go:consumeEnrollmentToken and
// `polar-agent register` rejects them. This fix moves to the correct
// endpoint and drops the now-irrelevant target_os field.)

function showAddHostError(msg: string): void {
  const el = document.getElementById("addHostError") as HTMLElement | null;
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function clearAddHostError(): void {
  const el = document.getElementById("addHostError") as HTMLElement | null;
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

function openAddHostModal(): void {
  const modal = document.getElementById("addHostModal") as HTMLElement | null;
  if (!modal) return;
  // Reset state every open — fresh form, hide result panel.
  (document.getElementById("addHostForm") as HTMLFormElement | null)?.removeAttribute("hidden");
  const result = document.getElementById("addHostResult") as HTMLElement | null;
  if (result) result.hidden = true;
  clearAddHostError();
  const nameInput = document.getElementById("addHostName") as HTMLInputElement | null;
  if (nameInput) nameInput.value = "polar-agent";
  modal.hidden = false;
}

function closeAddHostModal(): void {
  const modal = document.getElementById("addHostModal") as HTMLElement | null;
  if (modal) modal.hidden = true;
  // Always refresh list after the modal closes — agent may have
  // connected by now (curl-bash flows are fast on local LAN).
  void refreshList();
}

async function copyToClipboard(text: string, btn: HTMLButtonElement): Promise<void> {
  const original = btn.textContent || "复制";
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "已复制 ✓";
  } catch {
    btn.textContent = "复制失败";
  }
  window.setTimeout(() => { btn.textContent = original; }, 1500);
}

async function submitAddHost(ev: Event): Promise<void> {
  ev.preventDefault();
  clearAddHostError();
  const submitBtn = document.getElementById("addHostSubmitBtn") as HTMLButtonElement | null;
  if (submitBtn) submitBtn.disabled = true;
  try {
    const name = (document.getElementById("addHostName") as HTMLInputElement | null)?.value.trim() || "polar-agent";
    const { response, data } = await enrollHost({ name });
    if (!response.ok) {
      const err = (data as { error?: string })?.error;
      showAddHostError(err ? `创建失败：${err}` : `创建失败：HTTP ${response.status}`);
      return;
    }
    // Swap to result mode.
    (document.getElementById("addHostForm") as HTMLFormElement | null)?.setAttribute("hidden", "");
    const result = document.getElementById("addHostResult") as HTMLElement | null;
    if (result) result.hidden = false;
    const hintEl = document.getElementById("addHostHint") as HTMLElement | null;
    if (hintEl) {
      const expiry = data.expires_at ? ` · 有效期至 ${new Date(data.expires_at).toLocaleString()}` : "";
      hintEl.textContent = `Enroll token（一次性，1 小时 TTL${expiry}）。在目标机器上执行下方命令即可注册。`;
    }
    const rawEl = document.getElementById("addHostRaw") as HTMLInputElement | null;
    if (rawEl) rawEl.value = data.token || "";
    const scriptEl = document.getElementById("addHostScript") as HTMLTextAreaElement | null;
    // dock returns a ready-to-paste snippet:
    //   polar-agent register --token=<raw> --name="<name>"
    // Prepend a one-line comment + the server URL since `polar-agent
    // register` requires --server too for the remote enroll path.
    if (scriptEl) {
      const serverURL = window.location.origin;
      const baseSnippet = data.install_hint
        || `polar-agent register --token=${data.token || ""} --name=${JSON.stringify(name)}`;
      scriptEl.value =
        `# 在新主机的 shell 中执行（需先装好 polar-agent 二进制）\n` +
        baseSnippet.replace(
          "polar-agent register",
          `polar-agent register --server=${serverURL}`,
        );
    }
  } catch (err) {
    showAddHostError(`创建失败：${(err as Error).message}`);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function initAddHostModal(): void {
  // Button is always present in the page chrome; only the list view
  // currently exposes it (the detail view has its own back link).
  const openBtn = document.getElementById("addHostBtn") as HTMLButtonElement | null;
  openBtn?.addEventListener("click", openAddHostModal);

  document.getElementById("addHostModalCloseBtn")?.addEventListener("click", closeAddHostModal);
  document.getElementById("addHostCancelBtn")?.addEventListener("click", closeAddHostModal);
  document.getElementById("addHostDoneBtn")?.addEventListener("click", closeAddHostModal);

  // Click backdrop to close.
  document.getElementById("addHostModal")?.addEventListener("click", (ev) => {
    if ((ev.target as HTMLElement | null)?.id === "addHostModal") closeAddHostModal();
  });

  (document.getElementById("addHostForm") as HTMLFormElement | null)?.addEventListener("submit", (ev) => void submitAddHost(ev));

  document.getElementById("addHostRawCopyBtn")?.addEventListener("click", () => {
    const raw = (document.getElementById("addHostRaw") as HTMLInputElement | null)?.value || "";
    const btn = document.getElementById("addHostRawCopyBtn") as HTMLButtonElement | null;
    if (btn) void copyToClipboard(raw, btn);
  });
  document.getElementById("addHostScriptCopyBtn")?.addEventListener("click", () => {
    const script = (document.getElementById("addHostScript") as HTMLTextAreaElement | null)?.value || "";
    const btn = document.getElementById("addHostScriptCopyBtn") as HTMLButtonElement | null;
    if (btn) void copyToClipboard(script, btn);
  });
}

// ── bootstrap ──────────────────────────────────────────────────────────────

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement | null;
  logoutBtn?.addEventListener("click", () => { void logout(); });

  const id = getQueryHostID();
  if (id) {
    initDetailView(id);
  } else {
    initListView();
    initAddHostModal();
  }
})();
