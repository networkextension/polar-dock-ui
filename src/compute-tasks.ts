// /compute-tasks.html — admin/root compute-task monitor + test bench (polar-task doc/07 P5).
//
// Read-only queue + fleet view over existing dock APIs (GET /api/compute-tasks,
// GET /api/compute-tasks/:id, POST /api/compute-tasks, GET /api/agents), plus a
// submit-test-task form. Gated to site-admin via /api/me. Detail opens in a
// right-side drawer; results get JSON syntax highlighting + layered errors.

import { fetchCurrentUser, logout } from "./api/session.js";
import {
  getComputeTask,
  listAgentsRaw,
  listComputeTasks,
  submitComputeTask,
} from "./api/compute_tasks.js";
import type { ComputeTask, ComputeTaskArtifact } from "./types/compute_tasks.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

// ── helpers ────────────────────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function shortId(id: string): string {
  return id && id.length > 14 ? `${id.slice(0, 11)}…${id.slice(-3)}` : id;
}
function fmtTime(ts?: string): string {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}
function durationMs(a?: string, b?: string): string {
  if (!a || !b) return "—";
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}
function fmtBytes(n: number): string {
  if (!n || n < 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${i === 0 ? v : v.toFixed(1)} ${u[i]}`;
}
const STATUS_COLOR: Record<string, string> = {
  queued: "#9ca3af", hold: "#a78bfa", paused: "#f59e0b",
  running: "#3b82f6", done: "#10b981", failed: "#ef4444", cancelled: "#6b7280",
};
// statusBadge colors by the status KEY (not the label) so "failed 6" still goes red.
function statusBadge(label: string, key: string): string {
  const c = STATUS_COLOR[key] || "#9ca3af";
  const dot = key === "running" ? `<span class="ct-dot"></span>` : "";
  return `<span class="ct-badge" style="background:${c}1a; color:${c}; border-color:${c}66;">${dot}${esc(label)}</span>`;
}
function peek(v: unknown, n = 50): string {
  let str = "";
  try { str = typeof v === "string" ? v : JSON.stringify(v); } catch { str = String(v); }
  return str.length > n ? `${str.slice(0, n)}…` : str;
}
// jsonHighlight: pretty-print + token-color (escaped). Wrap in a .ct-code block.
function jsonHighlight(v: unknown): string {
  let pretty: string;
  try { pretty = JSON.stringify(v, null, 2); } catch { pretty = String(v); }
  if (pretty === undefined) pretty = "";
  const escaped = pretty
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "jn";
      if (/^"/.test(m)) cls = /:$/.test(m) ? "jk" : "js";
      else if (/true|false|null/.test(m)) cls = "jb";
      return `<span class="${cls}">${m}</span>`;
    },
  );
}
// humanError extracts a readable one-line summary from a raw error string.
function humanError(err: string): string {
  if (/timed out|timeout/i.test(err)) return "网络/请求超时（The request timed out）";
  if (/modelsUnavailable|-1001/i.test(err)) return "模型/资源不可用或超时";
  if (/e5rt|coreml|compute_operation/i.test(err)) return "端侧 ML 运行时错误（CoreML/ANE）";
  if (/could not load image|bad input/i.test(err)) return "输入加载失败（路径/URL/asset 无效）";
  const firstLine = err.split("\n")[0].trim();
  return firstLine.length > 160 ? `${firstLine.slice(0, 160)}…` : firstLine;
}

// ── DOM refs ─────────────────────────────────────────────────────────────────
const denied = byId<HTMLDivElement>("denied");
const board = byId<HTMLDivElement>("board");
const chips = byId<HTMLDivElement>("chips");
const taskTbody = byId<HTMLTableSectionElement>("taskTbody");
const taskEmpty = byId<HTMLDivElement>("taskEmpty");
const fleetTbody = byId<HTMLTableSectionElement>("fleetTbody");
const fleetEmpty = byId<HTMLDivElement>("fleetEmpty");
const skillSel = byId<HTMLSelectElement>("skillSel");
const inputJson = byId<HTMLTextAreaElement>("inputJson");
const prioInput = byId<HTMLInputElement>("prioInput");
const submitBtn = byId<HTMLButtonElement>("submitBtn");
const submitMsg = byId<HTMLDivElement>("submitMsg");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const autoRefresh = byId<HTMLInputElement>("autoRefresh");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");
const detailDrawer = byId<HTMLElement>("detailDrawer");
const detailBackdrop = byId<HTMLDivElement>("detailBackdrop");
const detailTitle = byId<HTMLSpanElement>("detailTitle");
const detailBody = byId<HTMLDivElement>("detailBody");
const detailCloseBtn = byId<HTMLButtonElement>("detailCloseBtn");
const detailCopy = byId<HTMLButtonElement>("detailCopy");

let currentDetailId = "";

// ── tasks ────────────────────────────────────────────────────────────────────
async function loadTasks(): Promise<void> {
  const { response, data } = await listComputeTasks();
  if (!response.ok) {
    taskEmpty.hidden = false;
    taskEmpty.textContent = `加载任务失败：HTTP ${response.status}`;
    return;
  }
  const tasks = data.tasks || [];
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
  const order = ["queued", "hold", "paused", "running", "done", "failed", "cancelled"];
  chips.innerHTML = `<span class="ct-badge" style="border-color:#88888866;color:var(--text-muted,#888);">共 ${tasks.length}</span>` +
    order.filter((s) => counts[s]).map((s) => statusBadge(`${s} ${counts[s]}`, s)).join("");

  taskEmpty.hidden = tasks.length > 0;
  taskTbody.innerHTML = tasks.map((t) => `
    <tr class="ct-row" data-id="${esc(t.id)}">
      <td><span class="ct-id" title="${esc(t.id)}">${esc(shortId(t.id))}</span></td>
      <td>${esc(t.skill)}</td>
      <td>${statusBadge(t.status, t.status)}</td>
      <td><span class="ct-id" title="${esc(t.agent_id || "")}">${esc(t.agent_id ? shortId(t.agent_id) : "—")}</span></td>
      <td>${esc(durationMs(t.claimed_at, t.updated_at))}</td>
      <td style="white-space:nowrap;">${esc(fmtTime(t.created_at))}</td>
      <td><span class="ct-trunc" style="display:inline-block;" title="${esc(typeof t.input === "string" ? t.input : JSON.stringify(t.input))}">${esc(peek(t.input))}</span></td>
    </tr>`).join("");
  taskTbody.querySelectorAll<HTMLTableRowElement>("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => openDetail(row.dataset.id || ""));
  });
}

function renderResult(t: ComputeTask): string {
  const r = (t.result || {}) as Record<string, unknown>;
  if (t.skill === "vision.ocr" && typeof r.fullText === "string") {
    return `<div class="ct-code">${esc(r.fullText)}</div>`;
  }
  if (t.skill === "speech.stt" && typeof r.text === "string") {
    return `<div class="ct-code">${esc(r.text)}</div>`;
  }
  if (t.skill === "vision.faces" && Array.isArray(r.faces)) {
    return `<div style="margin-bottom:6px;">检测到 <b>${(r.faces as unknown[]).length}</b> 张人脸</div>
      <div class="ct-code">${jsonHighlight(r)}</div>`;
  }
  return `<div class="ct-code">${jsonHighlight(r)}</div>`;
}

function renderError(err: string): string {
  if (!err) return "";
  return `<div class="ct-section-label" style="color:var(--danger,#c00);">error</div>
    <div style="color:var(--danger,#c00); font-weight:600; margin-bottom:4px;">${esc(humanError(err))}</div>
    <details><summary style="cursor:pointer; font-size:12px; color:var(--text-muted,#888);">查看完整错误</summary>
      <div class="ct-code" style="margin-top:4px;">${esc(err)}</div></details>`;
}

function renderArtifacts(arts: ComputeTaskArtifact[]): string {
  if (!arts || arts.length === 0) return "";
  const rows = arts.map((a) => {
    const url = a.download_url || "";
    let media = "";
    if (url) {
      if (a.mime?.startsWith("image/")) media = `<a href="${esc(url)}" target="_blank" rel="noopener"><img class="ct-art-thumb" src="${esc(url)}" alt="${esc(a.kind)}" /></a>`;
      else if (a.mime?.startsWith("audio/")) media = `<audio controls src="${esc(url)}" style="height:34px;"></audio>`;
    }
    const dl = url ? `<a class="btn-inline btn-secondary" href="${esc(url)}" download target="_blank" rel="noopener">下载</a>` : `<span style="color:var(--text-muted,#888);">（无链接）</span>`;
    return `<div class="ct-art-row">
      <span class="ct-badge" style="border-color:#88888866;color:var(--text-muted,#888);">${esc(a.kind)}</span>
      <span style="font-size:12px; color:var(--text-muted,#888);">${esc(a.mime)} · ${esc(fmtBytes(a.bytes))}</span>
      ${dl}${media ? `<div style="flex-basis:100%;">${media}</div>` : ""}
    </div>`;
  }).join("");
  return `<div class="ct-section-label">产物（${arts.length}）</div>${rows}`;
}

function openDrawer(): void {
  detailBackdrop.hidden = false;
  detailDrawer.classList.add("open");
  detailDrawer.setAttribute("aria-hidden", "false");
}
function closeDrawer(): void {
  detailDrawer.classList.remove("open");
  detailDrawer.setAttribute("aria-hidden", "true");
  detailBackdrop.hidden = true;
}

async function openDetail(id: string): Promise<void> {
  if (!id) return;
  currentDetailId = id;
  detailTitle.textContent = id;
  detailTitle.title = id;
  detailBody.innerHTML = `<div class="meta-subtitle">加载中…</div>`;
  openDrawer();
  const { response, data } = await getComputeTask(id);
  if (!response.ok) {
    detailBody.innerHTML = `<div style="color:var(--danger,#c00);">加载失败：HTTP ${response.status}</div>`;
    return;
  }
  const t = data.task;
  detailBody.innerHTML = `
    <div class="ct-metarow">
      ${statusBadge(t.status, t.status)}
      <span class="ct-badge" style="border-color:#88888866;color:var(--text-muted,#888);">${esc(t.skill)}</span>
      <span class="ct-badge" style="border-color:#88888866;color:var(--text-muted,#888);" title="${esc(t.agent_id || "")}">agent ${esc(t.agent_id ? shortId(t.agent_id) : "—")}</span>
      <span class="ct-badge" style="border-color:#88888866;color:var(--text-muted,#888);">耗时 ${esc(durationMs(t.claimed_at, t.updated_at))}</span>
    </div>
    <div class="ct-section-label">input</div>
    <div class="ct-code">${jsonHighlight(t.input)}</div>
    ${renderError(t.error || "")}
    <div class="ct-section-label">result</div>
    ${renderResult(t)}
    ${renderArtifacts(data.artifacts || [])}`;
}

// ── fleet ────────────────────────────────────────────────────────────────────
async function loadFleet(): Promise<void> {
  try {
    const { response, data } = await listAgentsRaw();
    if (!response.ok) { fleetEmpty.hidden = false; fleetTbody.innerHTML = ""; return; }
    const raw = data as unknown;
    const list = (Array.isArray(raw) ? raw : (raw as { agents?: unknown[] })?.agents) || [];
    if (list.length === 0) { fleetEmpty.hidden = false; fleetTbody.innerHTML = ""; return; }
    fleetEmpty.hidden = true;
    fleetTbody.innerHTML = (list as Record<string, unknown>[]).map((a) => {
      const name = String(a.name || a.agent_id || a.id || "—");
      const host = String(a.hw_model || a.host_model || a.host_id || "—");
      const sk = Array.isArray(a.skills)
        ? (a.skills as unknown[]).map((s) => (typeof s === "string" ? s : (s as { kind?: string })?.kind || "")).filter(Boolean).join(", ")
        : "—";
      const seen = String(a.last_hello_at || a.last_seen_at || a.updated_at || "");
      return `<tr><td><span class="ct-id" title="${esc(name)}">${esc(shortId(name))}</span></td><td>${esc(host)}</td><td style="font-size:12px;">${esc(sk)}</td><td style="white-space:nowrap;">${esc(fmtTime(seen))}</td></tr>`;
    }).join("");
  } catch {
    fleetEmpty.hidden = false; fleetTbody.innerHTML = "";
  }
}

// ── submit ───────────────────────────────────────────────────────────────────
async function onSubmit(): Promise<void> {
  submitMsg.textContent = "";
  submitMsg.style.color = "";
  let input: unknown;
  try {
    input = JSON.parse(inputJson.value || "{}");
  } catch {
    submitMsg.style.color = "var(--danger,#c00)";
    submitMsg.textContent = "input 不是合法 JSON";
    return;
  }
  submitBtn.disabled = true;
  try {
    const { response, data } = await submitComputeTask({
      skill: skillSel.value,
      input,
      priority: Number(prioInput.value) || 0,
    });
    if (!response.ok) {
      submitMsg.style.color = "var(--danger,#c00)";
      const e = data as unknown as { error?: string };
      submitMsg.textContent = `提交失败：${e.error || `HTTP ${response.status}`}`;
      return;
    }
    submitMsg.style.color = "var(--success,#0a0)";
    submitMsg.textContent = `已提交：${(data as { id?: string }).id || "ok"}`;
    void loadTasks();
  } finally {
    submitBtn.disabled = false;
  }
}

// ── refresh loop ─────────────────────────────────────────────────────────────
async function refreshAll(): Promise<void> {
  await Promise.all([loadTasks(), loadFleet()]);
}
function tick(): void {
  if (autoRefresh.checked && !detailDrawer.classList.contains("open")) void loadTasks();
}

// ── bootstrap ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  void hydrateSiteBrand();
  void hydrateSidebarFoot();
  const { response, data } = await fetchCurrentUser();
  if (!response.ok || !data.site_admin) {
    denied.hidden = false;
    denied.textContent = "你不是 site admin（不是 root team 成员），无法查看算力任务监控。";
    return;
  }
  board.hidden = false;
  refreshBtn.addEventListener("click", () => void refreshAll());
  submitBtn.addEventListener("click", () => void onSubmit());
  logoutBtn.addEventListener("click", () => void logout());
  detailCloseBtn.addEventListener("click", closeDrawer);
  detailBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
  detailCopy.addEventListener("click", () => {
    if (currentDetailId) void navigator.clipboard?.writeText(currentDetailId);
  });
  await refreshAll();
  window.setInterval(tick, 4000);
}

void main();
