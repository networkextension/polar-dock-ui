// /identity.html — unified person / biometric attribution console (polar-identity).
// Two confirm queues — 🎙 声纹 (voice) and 🙂 人脸 (face) — plus 👤 人物.
// Few people → no dropdown: each card shows the people as one-click chips.
// Two steps: 放原声 / 看原图 to check → click the person name = done.
// Voice is grouped by speaker cluster so one click confirms the whole speaker.
// See doc/arch/identity-biometric-framework.md.

import { fetchCurrentUser, logout } from "./api/session.js";
import {
  attributeSamplesBulk, listPeople, listSamples, sampleCandidates, sampleMediaURL,
  type AttrTarget, type IdPerson, type IdSample,
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
const tabVoice = byId<HTMLButtonElement>("tabVoice");
const tabFace = byId<HTMLButtonElement>("tabFace");
const tabPeople = byId<HTMLButtonElement>("tabPeople");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

type Tab = "voice" | "face" | "people";
let TAB: Tab = "voice";
let people: IdPerson[] = [];

async function loadPeople(): Promise<void> {
  try { const { response, data } = await listPeople(); if (response.ok) people = data.people || []; } catch { /* ignore */ }
}

// One-click person chips — the whole point: no dropdown. Renders every person as
// a click-to-confirm chip + a "+新人物" affordance. `best`/`pct` highlight the NN
// suggestion when known.
function peopleChipsHTML(best?: string, pct?: number): string {
  const chips = people.map((p) => {
    const isBest = p.id === best;
    const badge = isBest && pct != null ? `<span class="pct">${pct}%</span>` : "";
    return `<button class="id-pchip${isBest ? " best" : ""}" data-pid="${esc(p.id)}" type="button">${esc(p.display_name)}${badge}</button>`;
  }).join("");
  return `<div class="id-people">${chips}
    <span class="id-newwrap">
      <button class="id-pchip id-pchip-new" data-new="1" type="button">+ 新人物</button>
    </span>
    <span class="id-msg id-meta"></span></div>`;
}

// Wire the chips inside `card` to confirm `target` (a whole speaker cluster, or
// one face's sample_ids) → person. After success the card fades out.
function wireChips(card: HTMLElement, target: AttrTarget): void {
  const msg = card.querySelector<HTMLSpanElement>(".id-msg")!;
  const assign = async (body: { person_id?: string; new_person?: string }) => {
    msg.textContent = "归纳中…";
    const { response, data } = await attributeSamplesBulk({ ...target, ...body });
    if (!response.ok) { msg.textContent = "归纳失败"; return; }
    msg.textContent = `已归纳 ${data.count} 个 ✓`;
    card.style.opacity = "0.4";
    await loadPeople();
    setTimeout(() => card.remove(), 500);
  };
  card.querySelectorAll<HTMLButtonElement>(".id-pchip[data-pid]").forEach((b) =>
    b.addEventListener("click", () => void assign({ person_id: b.dataset.pid })));
  const newBtn = card.querySelector<HTMLButtonElement>(".id-pchip-new")!;
  newBtn.addEventListener("click", () => {
    const wrap = newBtn.parentElement!;
    wrap.innerHTML = `<input class="input id-new" type="text" placeholder="新人物姓名" style="max-width:150px;" />
      <button class="btn-inline btn-primary id-newok" type="button">确定</button>`;
    const inp = wrap.querySelector<HTMLInputElement>(".id-new")!;
    inp.focus();
    const go = () => { const n = inp.value.trim(); if (n) void assign({ new_person: n }); };
    wrap.querySelector<HTMLButtonElement>(".id-newok")!.addEventListener("click", go);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  });
}

// Lazily fetch the NN candidate for a representative sample and highlight the
// matching chip (best + %). Best-effort; the chips work without it.
async function highlightCandidate(card: HTMLElement, repSampleID: string): Promise<void> {
  try {
    const { response, data } = await sampleCandidates(repSampleID, 1);
    if (!response.ok || !(data.candidates || []).length) return;
    const c = data.candidates[0];
    if (c.score < 0.5) return;
    const chip = card.querySelector<HTMLButtonElement>(`.id-pchip[data-pid="${CSS.escape(c.person_id)}"]`);
    if (chip) {
      chip.classList.add("best");
      chip.insertAdjacentHTML("beforeend", `<span class="pct">${Math.round(c.score * 100)}%</span>`);
      card.querySelector(".id-people")?.prepend(chip); // surface the suggestion first
    }
  } catch { /* ignore */ }
}

// ── 🎙 声纹 (grouped by speaker cluster) ────────────────────────────────────
type Cluster = { key: string; speaker: string; assetID?: number; ids: string[]; rep: IdSample; minT0: number; maxT1: number };

async function renderVoice(): Promise<void> {
  hint.hidden = false;
  view.innerHTML = `<div class="meta-subtitle">加载中…</div>`;
  const { response, data } = await listSamples("?unattributed=1&modality=voice&limit=500");
  if (!response.ok) { view.innerHTML = `<div class="err">加载失败 HTTP ${response.status}</div>`; return; }
  const samples = data.samples || [];
  if (samples.length === 0) { view.innerHTML = `<div class="meta-subtitle">没有待确认的声纹。</div>`; return; }
  // group by (speaker, source recording)
  const groups = new Map<string, Cluster>();
  for (const s of samples) {
    const spk = s.locator?.speaker ?? "?";
    const key = `${spk}__${s.source_asset_id ?? 0}`;
    let g = groups.get(key);
    if (!g) { g = { key, speaker: spk, assetID: s.source_asset_id, ids: [], rep: s, minT0: Infinity, maxT1: 0 }; groups.set(key, g); }
    g.ids.push(s.id);
    const t0 = s.locator?.t0 ?? 0;
    if (t0 < g.minT0) { g.minT0 = t0; g.rep = s; }
    if ((s.locator?.t1 ?? 0) > g.maxT1) g.maxT1 = s.locator?.t1 ?? 0;
  }
  const clusters = [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
  view.innerHTML = clusters.map((g) => `<div class="id-card" data-key="${esc(g.key)}">
    <div class="id-row">
      <span class="id-chip">🎙 说话人 ${esc(g.speaker)}</span>
      <span class="id-meta">${g.ids.length} 段 · ${ms(g.minT0)}–${ms(g.maxT1)} · ${esc(g.rep.model_id)} · 来源 ${esc(g.rep.captured_from || "—")}</span>
      <span style="flex:1"></span>
      <button class="btn-inline btn-secondary id-play" type="button">▶ 放原声</button>
    </div>
    <div class="id-audio" style="margin-top:8px;"></div>
    ${peopleChipsHTML()}
  </div>`).join("");
  clusters.forEach((g) => {
    const card = view.querySelector<HTMLDivElement>(`.id-card[data-key="${CSS.escape(g.key)}"]`)!;
    card.querySelector<HTMLButtonElement>(".id-play")!.addEventListener("click", async () => {
      const slot = card.querySelector<HTMLDivElement>(".id-audio")!;
      slot.innerHTML = `<span class="meta-subtitle">载入音频…</span>`;
      const { response: r, data: d } = await sampleMediaURL(g.rep.id);
      if (!r.ok) { slot.innerHTML = `<span class="err">无法取音频</span>`; return; }
      const t0 = (g.rep.locator?.t0 ?? 0) / 1000;
      slot.innerHTML = `<audio controls autoplay preload="none" src="${esc(d.url)}#t=${t0}"></audio>
        <span class="id-meta">从 ${ms(g.minT0)} 起</span>`;
    });
    wireChips(card, { modality: "voice", speaker: g.speaker, source_asset_id: g.assetID });
    void highlightCandidate(card, g.rep.id);
  });
}

// ── 🙂 人脸 (per face; 看原图 + bbox) ────────────────────────────────────────
async function renderFace(): Promise<void> {
  hint.hidden = false;
  view.innerHTML = `<div class="meta-subtitle">加载中…</div>`;
  const { response, data } = await listSamples("?unattributed=1&modality=face&limit=500");
  if (!response.ok) { view.innerHTML = `<div class="err">加载失败 HTTP ${response.status}</div>`; return; }
  const samples = data.samples || [];
  if (samples.length === 0) { view.innerHTML = `<div class="meta-subtitle">没有待确认的人脸。</div>`; return; }
  view.innerHTML = samples.map((s) => `<div class="id-card" data-id="${esc(s.id)}">
    <div class="id-row">
      <span class="id-chip">🙂 人脸</span>
      <span class="id-meta">帧 ${ms(s.locator?.frame_ts)} ${s.locator?.face_index != null ? "· #" + esc(s.locator.face_index) : ""} · ${esc(s.model_id)} · 来源 ${esc(s.captured_from || "—")}</span>
      <span style="flex:1"></span>
      <button class="btn-inline btn-secondary id-show" type="button">🖼 看原图</button>
      <button class="btn-inline btn-secondary id-cand" type="button">🔎 候选</button>
    </div>
    <div class="id-facewrap" style="margin-top:8px;"></div>
    ${peopleChipsHTML()}
  </div>`).join("");
  samples.forEach((s) => {
    const card = view.querySelector<HTMLDivElement>(`.id-card[data-id="${CSS.escape(s.id)}"]`)!;
    card.querySelector<HTMLButtonElement>(".id-show")!.addEventListener("click", async () => {
      const slot = card.querySelector<HTMLDivElement>(".id-facewrap")!;
      slot.innerHTML = `<span class="meta-subtitle">载入图片…</span>`;
      const { response: r, data: d } = await sampleMediaURL(s.id);
      if (!r.ok) { slot.innerHTML = `<span class="err">无法取图</span>`; return; }
      const b = s.locator?.box;
      const box = b && b.length === 4
        ? `<div class="id-bbox" style="left:${b[0] * 100}%;top:${b[1] * 100}%;width:${b[2] * 100}%;height:${b[3] * 100}%;"></div>`
        : "";
      slot.innerHTML = `<div class="id-face"><img src="${esc(d.url)}" alt="" />${box}</div>`;
    });
    card.querySelector<HTMLButtonElement>(".id-cand")!.addEventListener("click", () => void highlightCandidate(card, s.id));
    wireChips(card, { sample_ids: [s.id] });
  });
}

// ── 👤 人物 ──────────────────────────────────────────────────────────────────
async function renderPeople(): Promise<void> {
  hint.hidden = true;
  await loadPeople();
  if (people.length === 0) { view.innerHTML = `<div class="meta-subtitle">还没有人物。去声纹/人脸队列归纳第一条。</div>`; return; }
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
      const voice = ss.filter((s) => s.modality === "voice").length;
      const face = ss.filter((s) => s.modality === "face").length;
      slot.innerHTML = `<div class="id-meta" style="margin-top:6px;">🎙 ${voice} 声纹 · 🙂 ${face} 人脸 · 共 ${ss.length}</div>`;
    });
  });
}

function render(): void {
  tabVoice.classList.toggle("on", TAB === "voice");
  tabFace.classList.toggle("on", TAB === "face");
  tabPeople.classList.toggle("on", TAB === "people");
  if (TAB === "voice") void renderVoice();
  else if (TAB === "face") void renderFace();
  else void renderPeople();
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
  tabVoice.addEventListener("click", () => { TAB = "voice"; render(); });
  tabFace.addEventListener("click", () => { TAB = "face"; render(); });
  tabPeople.addEventListener("click", () => { TAB = "people"; render(); });
  refreshBtn.addEventListener("click", render);
  logoutBtn.addEventListener("click", () => void logout());
  render();
}

void main();
