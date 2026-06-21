// /identity.html — voiceprint attribution console (polar-identity). List
// unattributed voice samples → play the original clip → see NN candidates →
// assign to a person. Identity is reached at /api/identity/* (nginx-proxied).
// See doc/arch/identity-biometric-framework.md (B2b).

import { fetchCurrentUser, logout } from "./api/session.js";
import {
  attributeSample, listPeople, listSamples, sampleAudioURL, sampleCandidates,
  type IdPerson, type IdSample,
} from "./api/identity.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function ms(t?: number): string {
  if (t == null) return "—";
  const s = Math.round(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const denied = byId<HTMLDivElement>("denied");
const board = byId<HTMLDivElement>("board");
const view = byId<HTMLDivElement>("view");
const hint = byId<HTMLParagraphElement>("hint");
const tabPending = byId<HTMLButtonElement>("tabPending");
const tabPeople = byId<HTMLButtonElement>("tabPeople");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

let TAB: "pending" | "people" = "pending";
let people: IdPerson[] = [];

async function loadPeople(): Promise<void> {
  try { const { response, data } = await listPeople(); if (response.ok) people = data.people || []; } catch { /* ignore */ }
}

// ── 待确认 ─────────────────────────────────────────────────────────────────
async function renderPending(): Promise<void> {
  hint.hidden = false;
  view.innerHTML = `<div class="meta-subtitle">加载中…</div>`;
  const { response, data } = await listSamples("?unattributed=1&modality=voice&limit=100");
  if (!response.ok) { view.innerHTML = `<div class="err">加载失败 HTTP ${response.status}</div>`; return; }
  const samples = data.samples || [];
  if (samples.length === 0) { view.innerHTML = `<div class="meta-subtitle">没有待确认的声纹。</div>`; return; }
  view.innerHTML = samples.map(cardHTML).join("");
  samples.forEach((s) => wireCard(s));
}

function cardHTML(s: IdSample): string {
  const spk = s.locator?.speaker ? `说话人 ${esc(s.locator.speaker)}` : "—";
  return `<div class="id-card" data-id="${esc(s.id)}">
    <div class="id-row">
      <span class="id-chip">🎙 voice</span>
      <span class="id-meta">${spk} · ${ms(s.locator?.t0)}–${ms(s.locator?.t1)} · ${esc(s.model_id)} · 来源 ${esc(s.captured_from || "—")}</span>
      <span style="flex:1"></span>
      <button class="btn-inline btn-secondary id-play" type="button">▶ 放原声</button>
      <button class="btn-inline btn-secondary id-cand" type="button">🔎 候选</button>
    </div>
    <div class="id-audio" style="margin-top:8px;"></div>
    <div class="id-cands"></div>
    <div class="id-assign">
      <select class="input id-person" style="max-width:220px;">
        <option value="">— 选择已有人物 —</option>
        ${people.map((p) => `<option value="${esc(p.id)}">${esc(p.display_name)}</option>`).join("")}
      </select>
      <span class="id-meta">或</span>
      <input class="input id-new" type="text" placeholder="新建人物姓名" style="max-width:180px;" />
      <button class="btn-inline btn-primary id-assignBtn" type="button">归纳到此人</button>
      <span class="id-msg id-meta"></span>
    </div>
  </div>`;
}

function wireCard(s: IdSample): void {
  const card = view.querySelector<HTMLDivElement>(`.id-card[data-id="${CSS.escape(s.id)}"]`);
  if (!card) return;
  card.querySelector<HTMLButtonElement>(".id-play")!.addEventListener("click", async () => {
    const slot = card.querySelector<HTMLDivElement>(".id-audio")!;
    slot.innerHTML = `<span class="meta-subtitle">载入音频…</span>`;
    const { response, data } = await sampleAudioURL(s.id);
    if (!response.ok) { slot.innerHTML = `<span class="err">无法取音频</span>`; return; }
    const t0 = (s.locator?.t0 ?? 0) / 1000;
    slot.innerHTML = `<audio controls preload="none" src="${esc(data.url)}#t=${t0}"></audio>
      <span class="id-meta">从 ${ms(s.locator?.t0)} 起</span>`;
  });
  card.querySelector<HTMLButtonElement>(".id-cand")!.addEventListener("click", async () => {
    const slot = card.querySelector<HTMLDivElement>(".id-cands")!;
    slot.innerHTML = `<span class="meta-subtitle">检索候选…</span>`;
    const { response, data } = await sampleCandidates(s.id, 5);
    if (!response.ok) { slot.innerHTML = `<span class="err">候选检索失败</span>`; return; }
    if ((data.candidates || []).length === 0) { slot.innerHTML = `<span class="meta-subtitle">无候选(库里还没有已归纳的同模态声纹)→ 建新人物。</span>`; return; }
    slot.innerHTML = data.candidates.map((c) => {
      const pct = Math.max(0, Math.min(100, Math.round(c.score * 100)));
      return `<div class="id-cand"><button class="btn-inline btn-secondary id-pick" data-pid="${esc(c.person_id)}" data-name="${esc(c.display_name)}">选</button>
        <b>${esc(c.display_name)}</b><div class="id-bar" style="width:${pct}px"></div><span class="id-meta">${pct}%</span></div>`;
    }).join("");
    slot.querySelectorAll<HTMLButtonElement>(".id-pick").forEach((b) => b.addEventListener("click", () => {
      const sel = card.querySelector<HTMLSelectElement>(".id-person")!;
      sel.value = b.dataset.pid || "";
    }));
  });
  card.querySelector<HTMLButtonElement>(".id-assignBtn")!.addEventListener("click", async () => {
    const personID = card.querySelector<HTMLSelectElement>(".id-person")!.value;
    const newName = card.querySelector<HTMLInputElement>(".id-new")!.value.trim();
    const msg = card.querySelector<HTMLSpanElement>(".id-msg")!;
    if (!personID && !newName) { msg.textContent = "选一个人物或填新名"; return; }
    const body = personID ? { person_id: personID } : { new_person: newName };
    const { response } = await attributeSample(s.id, body);
    if (!response.ok) { msg.textContent = "归纳失败"; return; }
    card.style.opacity = "0.4"; msg.textContent = "已归纳 ✓";
    await loadPeople();
    setTimeout(() => card.remove(), 600);
  });
}

// ── 人物 ──────────────────────────────────────────────────────────────────
async function renderPeople(): Promise<void> {
  hint.hidden = true;
  await loadPeople();
  if (people.length === 0) { view.innerHTML = `<div class="meta-subtitle">还没有人物。去「待确认」归纳第一条声纹。</div>`; return; }
  view.innerHTML = people.map((p) => `<div class="id-card" data-pid="${esc(p.id)}">
    <div class="id-row"><b>${esc(p.display_name)}</b><span class="id-mono id-meta">${esc(p.id)}</span>
      <span style="flex:1"></span><button class="btn-inline btn-secondary id-show" type="button">查看样本</button></div>
    <div class="id-psamples"></div></div>`).join("");
  view.querySelectorAll<HTMLDivElement>(".id-card").forEach((card) => {
    card.querySelector<HTMLButtonElement>(".id-show")!.addEventListener("click", async () => {
      const pid = card.dataset.pid!;
      const slot = card.querySelector<HTMLDivElement>(".id-psamples")!;
      slot.innerHTML = `<span class="meta-subtitle">加载…</span>`;
      const { data } = await listSamples(`?person_id=${encodeURIComponent(pid)}`);
      const ss = data.samples || [];
      slot.innerHTML = `<div class="id-meta" style="margin-top:6px;">${ss.length} 个样本</div>` +
        ss.map((s) => `<div class="id-meta">· ${esc(s.modality)} ${esc(s.model_id)} ${s.locator?.speaker ? "说话人 " + esc(s.locator.speaker) : ""} ${ms(s.locator?.t0)}–${ms(s.locator?.t1)}</div>`).join("");
    });
  });
}

function render(): void {
  tabPending.classList.toggle("on", TAB === "pending");
  tabPeople.classList.toggle("on", TAB === "people");
  if (TAB === "pending") void renderPending(); else void renderPeople();
}

async function main(): Promise<void> {
  void hydrateSiteBrand();
  void hydrateSidebarFoot();
  const { response, data } = await fetchCurrentUser();
  if (!response.ok || !data.site_admin) {
    denied.hidden = false;
    denied.textContent = "你不是 site admin(不是 root team 成员),无法管理声纹/人物。";
    return;
  }
  board.hidden = false;
  await loadPeople();
  tabPending.addEventListener("click", () => { TAB = "pending"; render(); });
  tabPeople.addEventListener("click", () => { TAB = "people"; render(); });
  refreshBtn.addEventListener("click", render);
  logoutBtn.addEventListener("click", () => void logout());
  render();
}

void main();
