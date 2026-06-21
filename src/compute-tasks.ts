// /compute-tasks.html — admin/root compute-task monitor + test bench (polar-task doc/07 P5).
//
// Read-only queue + fleet view over the existing dock APIs (GET /api/compute-tasks,
// GET /api/compute-tasks/:id, POST /api/compute-tasks, GET /api/agents), plus a
// submit-test-task form. Gated to site-admin via /api/me. No dock change — v1.
// Lifecycle controls (pause/resume/cancel/reorder) + cross-workspace stats come
// with later phases (P2b / P4b).

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
const STATUS_COLOR: Record<string, string> = {
  queued: "#9ca3af", hold: "#a78bfa", paused: "#f59e0b",
  running: "#3b82f6", done: "#10b981", failed: "#ef4444", cancelled: "#6b7280",
};
function statusBadge(s: string): string {
  const c = STATUS_COLOR[s] || "#9ca3af";
  return `<span class="tag-chip" style="background:${c}1a; color:${c}; border-color:${c}55;">${esc(s)}</span>`;
}
function peek(v: unknown, n = 80): string {
  let str = "";
  try { str = typeof v === "string" ? v : JSON.stringify(v); } catch { str = String(v); }
  return str.length > n ? `${str.slice(0, n)}…` : str;
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
const detailModal = byId<HTMLDivElement>("detailModal");
const detailTitle = byId<HTMLSpanElement>("detailTitle");
const detailBody = byId<HTMLDivElement>("detailBody");
const detailCloseBtn = byId<HTMLButtonElement>("detailCloseBtn");

// ── tasks ────────────────────────────────────────────────────────────────────
async function loadTasks(): Promise<void> {
  const { response, data } = await listComputeTasks();
  if (!response.ok) {
    taskEmpty.hidden = false;
    taskEmpty.textContent = `加载任务失败：HTTP ${response.status}`;
    return;
  }
  const tasks = data.tasks || [];
  // status chips
  const counts: Record<string, number> = {};
  for (const t of tasks) counts[t.status] = (counts[t.status] || 0) + 1;
  const order = ["queued", "hold", "paused", "running", "done", "failed", "cancelled"];
  chips.innerHTML = `<span class="tag-chip">共 ${tasks.length}</span>` +
    order.filter((s) => counts[s]).map((s) => statusBadge(`${s} ${counts[s]}`)).join("");
  // table
  taskEmpty.hidden = tasks.length > 0;
  taskTbody.innerHTML = tasks.map((t) => `
    <tr data-id="${esc(t.id)}" style="cursor:pointer;">
      <td><code>${esc(shortId(t.id))}</code></td>
      <td>${esc(t.skill)}</td>
      <td>${statusBadge(t.status)}</td>
      <td><code>${esc(t.agent_id ? shortId(t.agent_id) : "—")}</code></td>
      <td>${esc(durationMs(t.claimed_at, t.updated_at))}</td>
      <td style="white-space:nowrap;">${esc(fmtTime(t.created_at))}</td>
      <td><code style="font-size:11px;">${esc(peek(t.input))}</code></td>
    </tr>`).join("");
  taskTbody.querySelectorAll<HTMLTableRowElement>("tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => openDetail(row.dataset.id || ""));
  });
}

function renderResult(t: ComputeTask): string {
  const r = (t.result || {}) as Record<string, unknown>;
  if (t.skill === "vision.ocr" && typeof r.fullText === "string") {
    return `<pre style="white-space:pre-wrap;">${esc(r.fullText)}</pre>`;
  }
  if (t.skill === "speech.stt" && typeof r.text === "string") {
    return `<pre style="white-space:pre-wrap;">${esc(r.text)}</pre>`;
  }
  if (t.skill === "vision.faces" && Array.isArray(r.faces)) {
    return `<div>检测到 ${(r.faces as unknown[]).length} 张人脸</div>
      <pre style="white-space:pre-wrap;">${esc(JSON.stringify(r, null, 2))}</pre>`;
  }
  return `<pre style="white-space:pre-wrap;">${esc(JSON.stringify(r, null, 2))}</pre>`;
}

function renderArtifacts(arts: ComputeTaskArtifact[]): string {
  if (!arts || arts.length === 0) return "";
  const rows = arts.map((a) => {
    const url = a.download_url || "";
    const link = url
      ? (a.mime?.startsWith("audio/")
          ? `<audio controls src="${esc(url)}" style="height:32px;"></audio>`
          : `<a href="${esc(url)}" target="_blank" rel="noopener">下载</a>`)
      : "（无下载链接）";
    return `<tr><td>${esc(a.kind)}</td><td>${esc(a.mime)}</td><td>${esc(a.bytes)}</td><td>${link}</td></tr>`;
  }).join("");
  return `<div class="settings-section-title" style="margin:12px 0 4px;">产物</div>
    <table class="lp-table"><thead><tr><th>kind</th><th>mime</th><th>bytes</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function openDetail(id: string): Promise<void> {
  if (!id) return;
  detailTitle.textContent = `任务 ${shortId(id)}`;
  detailBody.innerHTML = `<div class="meta-subtitle">加载中…</div>`;
  detailModal.hidden = false;
  const { response, data } = await getComputeTask(id);
  if (!response.ok) {
    detailBody.innerHTML = `<div style="color:var(--danger,#c00);">加载失败：HTTP ${response.status}</div>`;
    return;
  }
  const t = data.task;
  detailBody.innerHTML = `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
      ${statusBadge(t.status)}<span class="tag-chip">${esc(t.skill)}</span>
      <span class="tag-chip">agent ${esc(t.agent_id ? shortId(t.agent_id) : "—")}</span>
      <span class="tag-chip">耗时 ${esc(durationMs(t.claimed_at, t.updated_at))}</span>
    </div>
    <div class="settings-section-title" style="margin:8px 0 4px;">input</div>
    <pre style="white-space:pre-wrap;">${esc(JSON.stringify(t.input, null, 2))}</pre>
    ${t.error ? `<div class="settings-section-title" style="margin:8px 0 4px; color:var(--danger,#c00);">error</div><pre style="white-space:pre-wrap; color:var(--danger,#c00);">${esc(t.error)}</pre>` : ""}
    <div class="settings-section-title" style="margin:8px 0 4px;">result</div>
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
      const name = (a.name || a.agent_id || a.id || "—") as string;
      const host = (a.hw_model || a.host_model || a.host_id || "—") as string;
      const sk = Array.isArray(a.skills)
        ? (a.skills as unknown[]).map((s) => (typeof s === "string" ? s : (s as { kind?: string })?.kind || "")).filter(Boolean).join(", ")
        : "—";
      const seen = (a.last_hello_at || a.last_seen_at || a.updated_at || "") as string;
      return `<tr><td><code>${esc(shortId(String(name)))}</code></td><td>${esc(host)}</td><td style="font-size:12px;">${esc(sk)}</td><td style="white-space:nowrap;">${esc(fmtTime(seen))}</td></tr>`;
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
let timer: number | undefined;
function tick(): void {
  if (autoRefresh.checked && detailModal.hidden) void loadTasks();
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
  detailCloseBtn.addEventListener("click", () => { detailModal.hidden = true; });
  detailModal.addEventListener("click", (e) => { if (e.target === detailModal) detailModal.hidden = true; });
  await refreshAll();
  timer = window.setInterval(tick, 4000);
}

void main();
// keep timer referenced (avoid unused-var lint)
window.addEventListener("beforeunload", () => { if (timer) window.clearInterval(timer); });
