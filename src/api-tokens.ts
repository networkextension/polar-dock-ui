// /api-tokens.html — self-service CRUD for the dock's open API tokens.
//
// Any logged-in member can mint a token scoped to their active workspace
// (the backend pins workspace + owner; no admin gate). Flow:
//   - On load: list tokens, render the table.
//   - "+ 新建 Token" opens a name-only create modal. Submit -> backend
//     returns the plaintext secret ONCE -> show-once modal with copy.
//   - Each active row's "撤销" hits DELETE /api/api-tokens/:id; revoked
//     tokens stay in the list (dimmed) and only show when the toggle is on.
//
// Pattern mirrors proxy-tokens.ts, trimmed to P0 (name only; no scopes /
// RPM / audit yet). DOM API only, no framework.

import {
  createApiToken,
  fetchApiTokenCalls,
  fetchApiTokenCallsAggregate,
  listApiTokens,
  listApiTokenScopes,
  revokeApiToken,
  rotateApiToken,
} from "./api/api_tokens.js";
import { logout } from "./api/session.js";
import { byId, byIdOpt } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { ApiModuleScopes, ApiScopeGroup, ApiToken, ApiTokenCall } from "./types/api_tokens.js";

initStoredTheme();
bindThemeSync();

const logoutBtn = byId<HTMLButtonElement>("logoutBtn");
const newTokenBtn = byId<HTMLButtonElement>("newTokenBtn");
const tokenTable = byId<HTMLTableElement>("tokenTable");
const tokenTbody = byId<HTMLTableSectionElement>("tokenTbody");
const tokenEmpty = byId<HTMLElement>("tokenEmpty");
const tokenLoading = byId<HTMLElement>("tokenLoading");
const tokenCount = byId<HTMLElement>("tokenCount");
const showRevokedToggle = byId<HTMLInputElement>("showRevokedToggle");

const createModal = byId<HTMLElement>("createModal");
const createCloseBtn = byId<HTMLButtonElement>("createCloseBtn");
const createCancelBtn = byId<HTMLButtonElement>("createCancelBtn");
const createSubmitBtn = byId<HTMLButtonElement>("createSubmitBtn");
const createName = byId<HTMLInputElement>("createName");
const createError = byId<HTMLElement>("createError");
const scopeTree = byId<HTMLElement>("scopeTree");
const scopeWildcard = byId<HTMLInputElement>("scopeWildcard");
const scopeWildcardHint = byIdOpt<HTMLElement>("scopeWildcardHint");
const createExpiry = byId<HTMLSelectElement>("createExpiry");
const createIPs = byId<HTMLTextAreaElement>("createIPs");

let scopeGroups: ApiScopeGroup[] = [];
// Plugin-module scopes from registered manifests (catalog `modules`; absent
// on older docks). Rendered after the dock's own groups, one section each.
let scopeModules: ApiModuleScopes[] = [];
// Scope id -> human label (module scopes only), used by the token list chips.
const scopeLabels = new Map<string, { label: string; sensitive: boolean }>();

const plaintextModal = byId<HTMLElement>("plaintextModal");
const plaintextValue = byId<HTMLInputElement>("plaintextValue");
const plaintextUsage = byId<HTMLElement>("plaintextUsage");
const plaintextCopyBtn = byId<HTMLButtonElement>("plaintextCopyBtn");
const plaintextDoneBtn = byId<HTMLButtonElement>("plaintextDoneBtn");

const usageModal = byId<HTMLElement>("usageModal");
const usageTitle = byId<HTMLElement>("usageTitle");
const usageSummary = byId<HTMLElement>("usageSummary");
const usageTable = byId<HTMLTableElement>("usageTable");
const usageTbody = byId<HTMLTableSectionElement>("usageTbody");
const usageEmpty = byId<HTMLElement>("usageEmpty");
const usageCloseBtn = byId<HTMLButtonElement>("usageCloseBtn");
const usageDoneBtn = byId<HTMLButtonElement>("usageDoneBtn");

// Revoked tokens accumulate (test/rotated keys); hide them by default.
let allTokens: ApiToken[] = [];

function isRevoked(tok: ApiToken): boolean {
  return !!tok.revoked_at || tok.status === "revoked";
}

function fmtRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const ageSec = Math.floor((Date.now() - t) / 1000);
  if (ageSec < 60) return `${ageSec}s 前`;
  if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m 前`;
  if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h 前`;
  return `${Math.floor(ageSec / 86400)}d 前`;
}

function renderTokenRow(tok: ApiToken): HTMLTableRowElement {
  const revoked = isRevoked(tok);
  const tr = document.createElement("tr");
  if (revoked) tr.style.opacity = "0.5";

  const cellName = document.createElement("td");
  cellName.textContent = tok.name;

  const cellPrefix = document.createElement("td");
  const code = document.createElement("code");
  code.textContent = tok.prefix + "…";
  code.style.fontSize = "11px";
  cellPrefix.appendChild(code);

  const cellScopes = document.createElement("td");
  const scopes = tok.scopes ?? [];
  if (scopes.length === 0) {
    const span = document.createElement("span");
    span.className = "meta-subtitle";
    span.textContent = "完全访问";
    cellScopes.appendChild(span);
  } else {
    scopes.forEach((sc) => {
      const chip = document.createElement("span");
      const known = scopeLabels.get(sc);
      if (known) {
        chip.textContent = (known.sensitive ? "⚠ " : "") + known.label;
        chip.title = sc;
      } else {
        chip.textContent = sc;
      }
      chip.style.cssText =
        "display:inline-block; margin:1px 3px 1px 0; padding:1px 6px; border-radius:8px; font-size:11px; background:var(--surface-2,#f3f4f6); border:1px solid var(--border,#e5e7eb);";
      cellScopes.appendChild(chip);
    });
  }

  const cellExpiry = document.createElement("td");
  if (!tok.expires_at) {
    const span = document.createElement("span");
    span.className = "meta-subtitle";
    span.textContent = "永不";
    cellExpiry.appendChild(span);
  } else {
    const expired = new Date(tok.expires_at).getTime() < Date.now();
    cellExpiry.textContent = (expired ? "🔴 " : "") + fmtRelative(tok.expires_at);
    if (expired) cellExpiry.style.color = "var(--danger, #c00)";
  }

  const cellCreated = document.createElement("td");
  cellCreated.textContent = fmtRelative(tok.created_at);

  const cellLastUsed = document.createElement("td");
  cellLastUsed.textContent = fmtRelative(tok.last_used_at);

  const cellStatus = document.createElement("td");
  cellStatus.textContent = revoked ? `🔴 已撤销 ${fmtRelative(tok.revoked_at)}` : "✓ 启用";

  const cellActions = document.createElement("td");
  const usageBtn = document.createElement("button");
  usageBtn.type = "button";
  usageBtn.className = "btn-inline btn-secondary";
  usageBtn.textContent = "用量";
  usageBtn.style.marginRight = "4px";
  usageBtn.addEventListener("click", () => void openUsageModal(tok));
  cellActions.appendChild(usageBtn);
  if (!revoked) {
    const rotBtn = document.createElement("button");
    rotBtn.type = "button";
    rotBtn.className = "btn-inline btn-secondary";
    rotBtn.textContent = "轮换";
    rotBtn.style.marginRight = "4px";
    rotBtn.addEventListener("click", () => void onRotate(tok));
    cellActions.appendChild(rotBtn);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-inline btn-secondary";
    btn.textContent = "撤销";
    btn.addEventListener("click", () => void onRevoke(tok));
    cellActions.appendChild(btn);
  }

  tr.append(cellName, cellPrefix, cellScopes, cellExpiry, cellCreated, cellLastUsed, cellStatus, cellActions);
  return tr;
}

function renderTokenTable(): void {
  const showRevoked = showRevokedToggle?.checked ?? false;
  const visible = showRevoked ? allTokens : allTokens.filter((t) => !isRevoked(t));
  const revokedCount = allTokens.filter((t) => isRevoked(t)).length;

  tokenTbody.innerHTML = "";
  visible.forEach((tok) => tokenTbody.appendChild(renderTokenRow(tok)));

  if (revokedCount > 0 && !showRevoked) {
    tokenCount.textContent = `${visible.length} 个 (隐藏 ${revokedCount} 个已撤销)`;
  } else {
    tokenCount.textContent = `${visible.length} 个`;
  }
  tokenTable.hidden = visible.length === 0;
  tokenEmpty.hidden = visible.length !== 0;
  if (visible.length === 0 && allTokens.length > 0) {
    tokenEmpty.textContent = "没有启用中的 token。勾选「显示已撤销」查看历史。";
  }
}

async function refreshTokenList(): Promise<void> {
  tokenLoading.hidden = false;
  tokenTable.hidden = true;
  tokenEmpty.hidden = true;
  try {
    const { data } = await listApiTokens();
    allTokens = data.tokens ?? [];
    renderTokenTable();
  } catch (err) {
    tokenEmpty.hidden = false;
    tokenEmpty.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    tokenLoading.hidden = true;
  }
}

function renderScopeTree(): void {
  scopeTree.innerHTML = "";
  if (scopeGroups.length === 0 && scopeModules.length === 0) {
    const empty = document.createElement("div");
    empty.className = "meta-subtitle";
    empty.textContent = "无可用权限范围。";
    scopeTree.appendChild(empty);
    return;
  }
  for (const g of scopeGroups) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; gap:6px; align-items:baseline; padding:2px 0;";
    const label = document.createElement("span");
    label.textContent = (g.admin ? "🔒 " : "") + g.domain;
    label.style.cssText = "min-width:120px; font-weight:500;";
    row.appendChild(label);
    for (const sc of g.scopes) {
      const lbl = document.createElement("label");
      lbl.style.cssText = "display:inline-flex; gap:3px; align-items:center; margin-right:10px; cursor:pointer;";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "scope-cb";
      cb.value = sc;
      const txt = document.createElement("span");
      // show just the action (read/write); full scope is the value
      txt.textContent = sc.slice(sc.lastIndexOf(":") + 1);
      lbl.append(cb, txt);
      row.appendChild(lbl);
    }
    scopeTree.appendChild(row);
  }
  for (const m of scopeModules) {
    scopeTree.appendChild(renderModuleSection(m));
  }
  if (scopeWildcardHint) scopeWildcardHint.hidden = scopeModules.length === 0;
}

// Global input styles stretch checkboxes inside wrapping flex rows; pin them.
const MODULE_CB_STYLE = "width:auto; flex:none; margin:0;";

function moduleTitle(m: ApiModuleScopes): string {
  const dn = (m.display_name ?? "").trim();
  return dn && dn !== m.module ? `${dn} (${m.module})` : m.module;
}

function moduleCheckboxes(module: string): HTMLInputElement[] {
  return Array.from(scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb")).filter(
    (cb) => cb.dataset.module === module && cb.dataset.moduleAll !== "1",
  );
}

// "<module>:*" checked -> the module's individual boxes are implied; grey them.
function syncModuleAll(module: string): void {
  const all = Array.from(scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb")).find(
    (cb) => cb.dataset.module === module && cb.dataset.moduleAll === "1",
  );
  const on = !!all?.checked && !scopeWildcard.checked;
  moduleCheckboxes(module).forEach((cb) => {
    if (scopeWildcard.checked) return;
    cb.disabled = on;
    if (on) cb.checked = false;
  });
}

function applyPreset(module: string, scopes: string[]): void {
  const want = new Set(scopes);
  scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb").forEach((cb) => {
    if (cb.dataset.module !== module) return;
    cb.checked = want.has(cb.value);
  });
  syncModuleAll(module);
}

function renderModuleSection(m: ApiModuleScopes): HTMLElement {
  const section = document.createElement("div");
  section.style.cssText =
    "margin-top:8px; padding-top:6px; border-top:1px dashed var(--border,#e5e7eb);";

  const head = document.createElement("div");
  head.style.cssText = "display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:2px 0;";
  const title = document.createElement("span");
  title.textContent = "🧩 " + moduleTitle(m);
  title.style.cssText = "font-weight:600; margin-right:6px;";
  head.appendChild(title);

  const allLbl = document.createElement("label");
  allLbl.style.cssText = "display:inline-flex; gap:3px; align-items:center; margin-right:10px; cursor:pointer; white-space:nowrap;";
  allLbl.title = `${m.module}:*`;
  const allCb = document.createElement("input");
  allCb.type = "checkbox";
  allCb.style.cssText = MODULE_CB_STYLE;
  allCb.className = "scope-cb";
  allCb.value = `${m.module}:*`;
  allCb.dataset.module = m.module;
  allCb.dataset.moduleAll = "1";
  allCb.addEventListener("change", () => syncModuleAll(m.module));
  const allTxt = document.createElement("span");
  allTxt.textContent = "本模块全部";
  allLbl.append(allCb, allTxt);
  head.appendChild(allLbl);

  const presets = m.presets ?? [];
  if (presets.length > 0) {
    const pl = document.createElement("span");
    pl.className = "meta-subtitle";
    pl.textContent = "预设：";
    head.appendChild(pl);
    for (const p of presets) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-inline btn-secondary scope-preset-btn";
      btn.style.cssText = "font-size:12px; padding:1px 8px;";
      btn.textContent = p.name;
      btn.title = `只勾选「${p.name}」的 ${p.scopes.length} 项权限（不影响其它模块与 dock 权限）\n` + p.scopes.join("\n");
      btn.addEventListener("click", () => applyPreset(m.module, p.scopes));
      head.appendChild(btn);
    }
  }
  section.appendChild(head);

  for (const g of m.groups ?? []) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; flex-wrap:wrap; gap:6px; align-items:baseline; padding:2px 0;";
    const label = document.createElement("span");
    label.textContent = g.group;
    label.style.cssText = "min-width:120px; font-weight:500;";
    row.appendChild(label);
    for (const sc of g.scopes) {
      const lbl = document.createElement("label");
      lbl.style.cssText = "display:inline-flex; gap:3px; align-items:center; margin-right:10px; cursor:pointer; white-space:nowrap;";
      lbl.title = sc.id;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.style.cssText = MODULE_CB_STYLE;
      cb.className = "scope-cb";
      cb.value = sc.id;
      cb.dataset.module = m.module;
      const txt = document.createElement("span");
      txt.textContent = sc.name || sc.id;
      lbl.append(cb, txt);
      if (sc.sensitive) {
        const warn = document.createElement("span");
        warn.textContent = "⚠ 敏感";
        warn.style.cssText = "font-size:11px; color:var(--danger,#c00);";
        lbl.appendChild(warn);
      }
      row.appendChild(lbl);
    }
    section.appendChild(row);
  }
  return section;
}

function syncWildcard(): void {
  const on = scopeWildcard.checked;
  scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb").forEach((cb) => {
    cb.disabled = on;
    if (on) cb.checked = false;
  });
  scopeTree.querySelectorAll<HTMLButtonElement>(".scope-preset-btn").forEach((btn) => {
    btn.disabled = on;
  });
  if (!on) scopeModules.forEach((m) => syncModuleAll(m.module));
  scopeTree.style.opacity = on ? "0.5" : "1";
}

function selectedScopes(): string[] {
  if (scopeWildcard.checked) return ["*"];
  return Array.from(scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb:checked")).map((cb) => cb.value);
}

function openCreateModal(): void {
  createName.value = "";
  createError.textContent = "";
  scopeWildcard.checked = false;
  scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb").forEach((cb) => {
    cb.checked = false;
  });
  syncWildcard();
  createExpiry.value = "0";
  createIPs.value = "";
  createModal.hidden = false;
  createName.focus();
}

// Parse the IP-allowlist textarea into entries (one per line, commas ok).
function parseIPs(): string[] {
  return createIPs.value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Compute an ISO expires_at from the day-count select; "" = never.
function computeExpiry(): string | undefined {
  const days = parseInt(createExpiry.value, 10) || 0;
  if (days <= 0) return undefined;
  return new Date(Date.now() + days * 86400 * 1000).toISOString();
}

function closeCreateModal(): void {
  createModal.hidden = true;
}

function usageExample(secret: string): string {
  const origin = window.location.origin;
  return `curl ${origin}/api/nav \\\n  -H "Authorization: Bearer ${secret}"`;
}

async function onSubmitCreate(): Promise<void> {
  const name = createName.value.trim();
  if (!name) {
    createError.textContent = "名称必填";
    return;
  }
  createSubmitBtn.disabled = true;
  createError.textContent = "";
  try {
    const { data } = await createApiToken({
      name,
      scopes: selectedScopes(),
      ip_allowlist: parseIPs(),
      expires_at: computeExpiry(),
    });
    if (data.error) {
      createError.textContent = data.error;
      return;
    }
    if (!data.secret) {
      createError.textContent = "服务端未返回密钥，请联系管理员";
      return;
    }
    closeCreateModal();
    plaintextValue.value = data.secret;
    plaintextUsage.textContent = usageExample(data.secret);
    plaintextModal.hidden = false;
    void refreshTokenList();
  } catch (err) {
    createError.textContent = (err as Error).message;
  } finally {
    createSubmitBtn.disabled = false;
  }
}

async function onRevoke(tok: ApiToken): Promise<void> {
  if (
    !confirm(
      `确认撤销 token "${tok.name}" (${tok.prefix}…)？\n撤销后无法恢复，使用该 token 的客户端会立即收到 401。`,
    )
  ) {
    return;
  }
  try {
    await revokeApiToken(tok.id);
    void refreshTokenList();
  } catch (err) {
    alert(`撤销失败：${(err as Error).message}`);
  }
}

async function onRotate(tok: ApiToken): Promise<void> {
  if (
    !confirm(
      `确认轮换 token "${tok.name}" (${tok.prefix}…)？\n会生成新 secret，旧 secret 立即失效；权限范围与限制保持不变。`,
    )
  ) {
    return;
  }
  try {
    const { data } = await rotateApiToken(tok.id);
    if (data.error || !data.secret) {
      alert(`轮换失败：${data.error ?? "服务端未返回密钥"}`);
      return;
    }
    plaintextValue.value = data.secret;
    plaintextUsage.textContent = usageExample(data.secret);
    plaintextModal.hidden = false;
    void refreshTokenList();
  } catch (err) {
    alert(`轮换失败：${(err as Error).message}`);
  }
}

function statusColor(status: number): string {
  if (status >= 500) return "#dc2626";
  if (status >= 400) return "#d97706";
  if (status >= 200 && status < 300) return "#16a34a";
  return "#6b7280";
}

function renderUsageCallRow(c: ApiTokenCall): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const mk = (t: string) => {
    const td = document.createElement("td");
    td.textContent = t;
    return td;
  };
  tr.appendChild(mk(fmtRelative(c.created_at)));
  tr.appendChild(mk(c.method));
  const pathTd = mk(c.path || "—");
  pathTd.style.cssText = "font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px;";
  tr.appendChild(pathTd);
  const stTd = document.createElement("td");
  const dot = document.createElement("span");
  dot.style.cssText = `display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:5px; vertical-align:middle; background:${statusColor(c.status_code)};`;
  stTd.append(dot, document.createTextNode(String(c.status_code)));
  tr.appendChild(stTd);
  tr.appendChild(mk(c.latency_ms > 0 ? `${c.latency_ms}ms` : "—"));
  tr.appendChild(mk(c.ip || "—"));
  return tr;
}

async function openUsageModal(tok: ApiToken): Promise<void> {
  usageTitle.textContent = `用量 — ${tok.name}`;
  usageSummary.textContent = "加载中…";
  usageTbody.innerHTML = "";
  usageTable.hidden = true;
  usageEmpty.hidden = true;
  usageModal.hidden = false;
  try {
    const [aggResp, callsResp] = await Promise.all([
      fetchApiTokenCallsAggregate(tok.id, 7),
      fetchApiTokenCalls(tok.id, 100),
    ]);
    const s = aggResp.data.summary;
    if (s) {
      const rate = s.calls > 0 ? ((s.ok_count / s.calls) * 100).toFixed(1) : "—";
      usageSummary.textContent = `近 7 天：总调用 ${s.calls} · 成功率 ${rate}% · 最近使用 ${fmtRelative(s.last_used)}`;
    } else {
      usageSummary.textContent = "近 7 天：暂无数据";
    }
    const calls = callsResp.data.calls ?? [];
    calls.forEach((c) => usageTbody.appendChild(renderUsageCallRow(c)));
    usageTable.hidden = calls.length === 0;
    usageEmpty.hidden = calls.length !== 0;
  } catch (err) {
    usageSummary.textContent = `加载失败：${(err as Error).message}`;
  }
}

function closeUsageModal(): void {
  usageModal.hidden = true;
  usageTbody.innerHTML = "";
}

async function copyToClipboard(value: string, btn: HTMLButtonElement): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    const prev = btn.textContent;
    btn.textContent = "✓ 已复制";
    setTimeout(() => {
      btn.textContent = prev;
    }, 1500);
  } catch {
    plaintextValue.select();
  }
}

scopeWildcard.addEventListener("change", syncWildcard);
newTokenBtn.addEventListener("click", openCreateModal);
showRevokedToggle?.addEventListener("change", () => renderTokenTable());
createCloseBtn.addEventListener("click", closeCreateModal);
createCancelBtn.addEventListener("click", closeCreateModal);
createSubmitBtn.addEventListener("click", () => void onSubmitCreate());
createName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void onSubmitCreate();
});
plaintextDoneBtn.addEventListener("click", () => {
  plaintextModal.hidden = true;
  plaintextValue.value = "";
});
plaintextCopyBtn.addEventListener("click", () => void copyToClipboard(plaintextValue.value, plaintextCopyBtn));
usageCloseBtn.addEventListener("click", closeUsageModal);
usageDoneBtn.addEventListener("click", closeUsageModal);
logoutBtn.addEventListener("click", () => void logout().then(() => (window.location.href = "/login.html")));

async function loadScopeCatalog(): Promise<void> {
  try {
    const { data } = await listApiTokenScopes();
    scopeGroups = data.groups ?? [];
    scopeModules = Array.isArray(data.modules) ? data.modules : [];
  } catch {
    scopeGroups = [];
    scopeModules = [];
  }
  scopeLabels.clear();
  for (const m of scopeModules) {
    const mt = (m.display_name ?? "").trim() || m.module;
    scopeLabels.set(`${m.module}:*`, { label: `${mt}·全部`, sensitive: false });
    for (const g of m.groups ?? []) {
      for (const sc of g.scopes) {
        scopeLabels.set(sc.id, { label: `${mt}·${sc.name || sc.id}`, sensitive: !!sc.sensitive });
      }
    }
  }
  renderScopeTree();
}

async function bootstrap(): Promise<void> {
  await hydrateSiteBrand();
  await hydrateSidebarFoot();
  await loadScopeCatalog();
  await refreshTokenList();
}

void bootstrap();
