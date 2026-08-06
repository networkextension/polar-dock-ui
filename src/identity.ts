// /identity.html — unified person / biometric attribution console (polar-identity).
// Two confirm queues — 🎙 声纹 (voice) and 🙂 人脸 (face) — plus 👤 人物.
// Few people → no dropdown: each card shows the people as one-click chips.
// Two steps: 放原声 / 看原图 to check → click the person name = done.
// Voice is grouped by speaker cluster so one click confirms the whole speaker.
// See doc/arch/identity-biometric-framework.md.

import { fetchCurrentUser, logout } from "./api/session.js";
import {
  attributeSamplesBulk, autoLabel, faceClusters, listPeople, listSamples, mergePeople,
  reassignSamples, sampleCandidates, sampleMediaURL, voiceClusters,
  type AttrTarget, type IdAutoSuggestion, type IdFaceCluster, type IdPerson,
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

// ── ✨ auto-label (shared by 声纹 + 人脸) ────────────────────────────────────
// Toolbar + a 建议 block. The tab body lives in #idClusters; suggestions in
// #idSuggest. wireAuto runs the learning loop then re-renders both.
function autoBarHTML(): string {
  return `<div class="id-tools" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
      <button id="autoBtn" class="btn-inline btn-primary" type="button">✨ 自动归类</button>
      <span class="id-meta">学已确认的样本 → 高分自动归、中分给建议(都可撤销)</span>
      <span id="autoMsg" class="id-meta"></span>
    </div><div id="idSuggest"></div><div id="idClusters"><div class="meta-subtitle">加载中…</div></div>`;
}
function wireAuto(modality: "voice" | "face", refill: () => Promise<void>): void {
  const btn = byId<HTMLButtonElement>("autoBtn");
  const msg = byId<HTMLSpanElement>("autoMsg");
  btn.addEventListener("click", async () => {
    btn.disabled = true; msg.textContent = "学习中…";
    const { response, data } = await autoLabel(modality);
    btn.disabled = false;
    if (!response.ok) { msg.textContent = "失败"; return; }
    msg.textContent = `已自动归 ${data.applied_count} 个,建议 ${data.suggestions.length} 条`;
    renderSuggestions(byId<HTMLDivElement>("idSuggest"), data.suggestions, modality);
    await loadPeople();
    await refill();
  });
}
function renderSuggestions(host: HTMLDivElement, sugg: IdAutoSuggestion[], modality: "voice" | "face"): void {
  if (!sugg.length) { host.innerHTML = ""; return; }
  host.innerHTML = `<div class="meta-subtitle" style="margin:2px 0 8px;">✨ 建议(机器猜的 —— 核对后点确认,或点别的名字改判)</div>` +
    sugg.map((s, i) => `<div class="id-card id-sg" data-sg="${i}">
      <div class="id-row">
        <span class="id-chip">${modality === "voice" ? "🎙" : "🙂"} 像 <b>${esc(s.display_name)}</b> · ${Math.round(s.score * 100)}%</span>
        <span style="flex:1"></span>
        <button class="btn-inline btn-secondary id-show" type="button">${modality === "voice" ? "▶ 放原声" : "🖼 看原图"}</button>
        <button class="btn-inline btn-primary id-ok" type="button">✓ 确认是 ${esc(s.display_name)}</button>
      </div>
      <div class="id-media" style="margin-top:8px;"></div>
      ${peopleChipsHTML()}
    </div>`).join("");
  sugg.forEach((s, i) => {
    const card = host.querySelector<HTMLDivElement>(`.id-card[data-sg="${i}"]`)!;
    card.querySelector<HTMLButtonElement>(".id-show")!.addEventListener("click", async () => {
      const slot = card.querySelector<HTMLDivElement>(".id-media")!;
      slot.innerHTML = `<span class="meta-subtitle">载入…</span>`;
      const { response: r, data: d } = await sampleMediaURL(s.sample_id);
      if (!r.ok) { slot.innerHTML = `<span class="err">取不到</span>`; return; }
      slot.innerHTML = modality === "voice"
        ? `<audio controls autoplay preload="none" src="${esc(d.url)}"></audio>`
        : `<div class="id-face"><img src="${esc(d.url)}" alt="" /></div>`;
    });
    const done = () => { card.style.opacity = "0.4"; setTimeout(() => card.remove(), 400); };
    card.querySelector<HTMLButtonElement>(".id-ok")!.addEventListener("click", async () => {
      const { response: r } = await attributeSamplesBulk({ sample_ids: [s.sample_id], person_id: s.person_id });
      if (r.ok) { done(); await loadPeople(); }
    });
    // the chips below let you override the guess to a different / new person
    wireChips(card, { sample_ids: [s.sample_id] });
    const sel = card.querySelector<HTMLButtonElement>(`.id-pchip[data-pid="${CSS.escape(s.person_id)}"]`);
    sel?.classList.add("best");
  });
}

// ── 🎙 声纹 (server-side speaker clusters: ~1 card per speaker) ──────────────
async function fillVoiceClusters(host: HTMLDivElement): Promise<void> {
  const { response, data } = await voiceClusters();
  if (!response.ok) { host.innerHTML = `<div class="err">加载失败 HTTP ${response.status}</div>`; return; }
  const cs = data.clusters || [];
  if (cs.length === 0) { host.innerHTML = `<div class="meta-subtitle">没有待确认的声纹。</div>`; return; }
  host.innerHTML = cs.map((g, i) => `<div class="id-card" data-idx="${i}">
    <div class="id-row">
      <span class="id-chip">🎙 说话人 ${esc(g.speaker)}</span>
      <span class="id-meta">${g.count} 段 · ${ms(g.t0)}–${ms(g.t1)} · ${esc(g.model_id)} · 来源 ${esc(g.captured_from || "—")}</span>
      <span style="flex:1"></span>
      <button class="btn-inline btn-secondary id-play" type="button">▶ 放原声</button>
    </div>
    <div class="id-audio" style="margin-top:8px;"></div>
    ${peopleChipsHTML()}
  </div>`).join("");
  cs.forEach((g, i) => {
    const card = host.querySelector<HTMLDivElement>(`.id-card[data-idx="${i}"]`)!;
    card.querySelector<HTMLButtonElement>(".id-play")!.addEventListener("click", async () => {
      const slot = card.querySelector<HTMLDivElement>(".id-audio")!;
      slot.innerHTML = `<span class="meta-subtitle">载入音频…</span>`;
      const { response: r, data: d } = await sampleMediaURL(g.rep_sample_id);
      if (!r.ok) { slot.innerHTML = `<span class="err">无法取音频</span>`; return; }
      slot.innerHTML = `<audio controls autoplay preload="none" src="${esc(d.url)}#t=${g.t0 / 1000}"></audio>
        <span class="id-meta">从 ${ms(g.t0)} 起</span>`;
    });
    wireChips(card, { modality: "voice", speaker: g.speaker, source_asset_id: g.source_asset_id });
    void highlightCandidate(card, g.rep_sample_id);
  });
}
async function renderVoice(): Promise<void> {
  hint.hidden = false;
  view.innerHTML = autoBarHTML();
  const host = byId<HTMLDivElement>("idClusters");
  await fillVoiceClusters(host);
  wireAuto("voice", () => fillVoiceClusters(host));
}

// ── 🙂 人脸 (similarity clusters, ranked by size; singletons collapsed) ──────
function faceCardHTML(c: IdFaceCluster, i: number): string {
  const label = c.count > 1 ? `${c.count} 张` : "单张";
  return `<div class="id-card" data-idx="${i}">
    <div class="id-row">
      <span class="id-chip">🙂 ${label}</span>
      <span class="id-meta">人脸大小 ${(c.avg_area * 100).toFixed(1)}% · ${esc(c.model_id)}</span>
      <span style="flex:1"></span>
      <button class="btn-inline btn-secondary id-show" type="button">🖼 看原图</button>
      <button class="btn-inline btn-secondary id-cand" type="button">🔎 候选</button>
    </div>
    <div class="id-facewrap" style="margin-top:8px;"></div>
    ${peopleChipsHTML()}
  </div>`;
}
function wireFaceCard(card: HTMLDivElement, c: IdFaceCluster): void {
  card.querySelector<HTMLButtonElement>(".id-show")!.addEventListener("click", async () => {
    const slot = card.querySelector<HTMLDivElement>(".id-facewrap")!;
    slot.innerHTML = `<span class="meta-subtitle">载入图片…</span>`;
    const { response: r, data: d } = await sampleMediaURL(c.rep_sample_id);
    if (!r.ok) { slot.innerHTML = `<span class="err">无法取图</span>`; return; }
    const b = c.rep_box;
    const box = b && b.length === 4
      ? `<div class="id-bbox" style="left:${b[0] * 100}%;top:${b[1] * 100}%;width:${b[2] * 100}%;height:${b[3] * 100}%;"></div>`
      : "";
    slot.innerHTML = `<div class="id-face"><img src="${esc(d.url)}" alt="" />${box}</div>`;
  });
  card.querySelector<HTMLButtonElement>(".id-cand")!.addEventListener("click", () => void highlightCandidate(card, c.rep_sample_id));
  wireChips(card, { sample_ids: c.member_ids });
}

async function fillFaceClusters(host: HTMLDivElement): Promise<void> {
  host.innerHTML = `<div class="meta-subtitle">聚类中…</div>`;
  const { response, data } = await faceClusters();
  if (!response.ok) { host.innerHTML = `<div class="err">加载失败 HTTP ${response.status}</div>`; return; }
  const cs = data.clusters || [];
  if (cs.length === 0) { host.innerHTML = `<div class="meta-subtitle">没有待确认的人脸（或都被当作背景过滤）。</div>`; return; }
  const main = cs.filter((c) => c.count > 1);
  const singles = cs.filter((c) => c.count === 1);
  host.innerHTML =
    (main.length ? `<div class="meta-subtitle" style="margin:2px 0 8px;">主要人物（按出现次数排序，${main.length}）</div>` +
      main.map((c, i) => faceCardHTML(c, i)).join("") : "") +
    (singles.length ? `<details style="margin-top:10px;"><summary class="meta-subtitle" style="cursor:pointer;">次要 / 一次性人脸（${singles.length}）</summary><div id="idSingles" style="margin-top:8px;"></div></details>` : "");
  main.forEach((c, i) => wireFaceCard(host.querySelector<HTMLDivElement>(`.id-card[data-idx="${i}"]`)!, c));
  // singletons rendered lazily when the <details> is opened (keeps it light)
  const det = host.querySelector<HTMLDetailsElement>("details");
  det?.addEventListener("toggle", () => {
    const sh = byId<HTMLDivElement>("idSingles");
    if (!det.open || sh.dataset.done) return;
    sh.dataset.done = "1";
    sh.innerHTML = singles.map((c, i) => faceCardHTML(c, 1000 + i)).join("");
    singles.forEach((c, i) => wireFaceCard(sh.querySelector<HTMLDivElement>(`.id-card[data-idx="${1000 + i}"]`)!, c));
  }, { once: false });
}
async function renderFace(): Promise<void> {
  hint.hidden = false;
  view.innerHTML = autoBarHTML();
  const host = byId<HTMLDivElement>("idClusters");
  await fillFaceClusters(host);
  wireAuto("face", () => fillFaceClusters(host));
}

// ── 👤 人物 ──────────────────────────────────────────────────────────────────
function personOptions(excludeID: string, extra = ""): string {
  return people.filter((p) => p.id !== excludeID)
    .map((p) => `<option value="${esc(p.id)}">${esc(p.display_name)}</option>`).join("") + extra;
}
async function renderPeople(): Promise<void> {
  hint.hidden = true;
  await loadPeople();
  if (people.length === 0) { view.innerHTML = `<div class="meta-subtitle">还没有人物。去声纹/人脸队列归纳第一条。</div>`; return; }
  view.innerHTML = people.map((p) => `<div class="id-card" data-pid="${esc(p.id)}">
    <div class="id-row"><b>${esc(p.display_name)}</b><span class="id-mono id-meta">${esc(p.id)}</span>
      <span style="flex:1"></span>
      <select class="input id-mergeto" style="max-width:150px;"><option value="">合并到…</option>${personOptions(p.id)}</select>
      <button class="btn-inline btn-secondary id-merge" type="button">合并</button>
      <button class="btn-inline btn-secondary id-show" type="button">查看 / 整理样本</button></div>
    <div class="id-psamples"></div></div>`).join("");
  view.querySelectorAll<HTMLDivElement>(".id-card").forEach((card) => {
    const pid = card.dataset.pid!;
    card.querySelector<HTMLButtonElement>(".id-merge")!.addEventListener("click", async () => {
      const into = card.querySelector<HTMLSelectElement>(".id-mergeto")!.value;
      if (!into) return;
      const intoName = people.find((p) => p.id === into)?.display_name || into;
      const selfName = card.querySelector("b")!.textContent;
      if (!confirm(`把「${selfName}」合并进「${intoName}」？\n本人物的全部声纹+人脸都并过去,然后删除「${selfName}」。`)) return;
      const { response } = await mergePeople(pid, into);
      if (response.ok) render(); else alert("合并失败");
    });
    card.querySelector<HTMLButtonElement>(".id-show")!.addEventListener("click", () => void showSamples(card, pid));
  });
}

// Per-person sample tray: check the wrong ones → 移到别人 / 退回待确认 (the split half).
async function showSamples(card: HTMLDivElement, pid: string): Promise<void> {
  const slot = card.querySelector<HTMLDivElement>(".id-psamples")!;
  slot.innerHTML = `<span class="meta-subtitle">加载…</span>`;
  const { data } = await listSamples(`?person_id=${encodeURIComponent(pid)}&limit=500`);
  const ss = data.samples || [];
  const voice = ss.filter((s) => s.modality === "voice").length;
  const face = ss.filter((s) => s.modality === "face").length;
  slot.innerHTML = `<div class="id-meta" style="margin:6px 0;">🎙 ${voice} 声纹 · 🙂 ${face} 人脸 · 共 ${ss.length} —— 勾选不是TA的样本 → 移走/退回</div>
    <div class="id-tools" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
      <select class="input id-moveto" style="max-width:150px;"><option value="">移到…</option>${personOptions(pid, '<option value="__new">+ 新人物</option>')}</select>
      <button class="btn-inline btn-secondary id-move" type="button">移动选中</button>
      <button class="btn-inline btn-secondary id-unassign" type="button">退回待确认</button>
      <span class="id-msg id-meta"></span>
    </div>
    <div class="id-grid" style="display:flex;flex-direction:column;gap:4px;"></div>`;
  const grid = slot.querySelector<HTMLDivElement>(".id-grid")!;
  grid.innerHTML = ss.map((s) => `<label class="id-row" style="gap:8px;">
      <input type="checkbox" data-sid="${esc(s.id)}" />
      <span class="id-meta">${s.modality === "voice" ? "🎙 声纹 " + ms(s.locator?.t0) : "🙂 人脸 帧" + ms(s.locator?.frame_ts)} · ${esc(s.model_id)}</span>
      <button class="btn-inline btn-secondary id-peek" type="button" data-sid="${esc(s.id)}" data-mod="${esc(s.modality)}">看</button>
      <span class="id-peekslot"></span>
    </label>`).join("");
  grid.querySelectorAll<HTMLButtonElement>(".id-peek").forEach((b) => b.addEventListener("click", async (e) => {
    e.preventDefault();
    const out = b.nextElementSibling as HTMLElement;
    const { response: r, data: d } = await sampleMediaURL(b.dataset.sid!);
    if (!r.ok) { out.textContent = "取不到"; return; }
    out.innerHTML = b.dataset.mod === "voice"
      ? `<audio controls autoplay style="height:28px;vertical-align:middle;" src="${esc(d.url)}"></audio>`
      : `<img src="${esc(d.url)}" style="max-height:60px;border-radius:4px;vertical-align:middle;" />`;
  }));
  const checked = () => Array.from(grid.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked")).map((i) => i.dataset.sid!);
  const msg = slot.querySelector<HTMLSpanElement>(".id-msg")!;
  const after = async () => { await loadPeople(); void showSamples(card, pid); };
  slot.querySelector<HTMLButtonElement>(".id-move")!.addEventListener("click", async () => {
    const ids = checked(); if (!ids.length) { msg.textContent = "先勾选"; return; }
    const sel = slot.querySelector<HTMLSelectElement>(".id-moveto")!.value;
    let body: { sample_ids: string[]; person_id?: string; new_person?: string };
    if (sel === "__new") { const n = prompt("新人物姓名")?.trim(); if (!n) return; body = { sample_ids: ids, new_person: n }; }
    else if (sel) body = { sample_ids: ids, person_id: sel };
    else { msg.textContent = "选个目标"; return; }
    const { response } = await reassignSamples(body);
    if (response.ok) await after(); else msg.textContent = "移动失败";
  });
  slot.querySelector<HTMLButtonElement>(".id-unassign")!.addEventListener("click", async () => {
    const ids = checked(); if (!ids.length) { msg.textContent = "先勾选"; return; }
    const { response } = await reassignSamples({ sample_ids: ids, unassign: true });
    if (response.ok) await after(); else msg.textContent = "退回失败";
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
  logoutBtn.addEventListener("click", () => void logout().then(() => window.location.replace("/login.html")));
  render();
}

void main();
