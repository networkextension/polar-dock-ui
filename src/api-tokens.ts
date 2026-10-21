// /api-tokens.html — self-service management of the dock's open API tokens.
//
// Any logged-in member can mint a token scoped to their active workspace
// (the backend pins workspace + owner). Flow:
//   - On load: fetch the scope catalog (dock domains + registered module
//     manifests with presets), list tokens, render the table.
//   - "+ 新建 Token" opens the token modal: name, scopes (dock domains,
//     per-module scopes / 本模块全部 / presets, or 完全访问 "*"), expiry,
//     IP allowlist, rate limit. Submit -> backend returns the plaintext
//     secret ONCE -> show-once modal with copy.
//   - Each active row: 「编辑」 reopens the same modal prefilled and PATCHes
//     only the changed fields (secret unchanged, no secret dialog; scopes the
//     catalog no longer knows are shown read-only and kept); 「轮换」 mints a
//     new secret for the same row; 「撤销」 DELETEs. Revoked tokens stay in
//     the list (dimmed) and only show when the toggle is on.
//   - 「用量」 shows the per-call audit + 7-day summary.
//
// DOM API only, no framework.

import {
  createApiToken,
  fetchApiTokenCalls,
  fetchApiTokenCallsAggregate,
  listApiTokens,
  listApiTokenScopes,
  revokeApiToken,
  rotateApiToken,
  updateApiToken,
} from "./api/api_tokens.js";
import { logout } from "./api/session.js";
import { byId, byIdOpt } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type {
  ApiModuleScopes,
  ApiScopeGroup,
  ApiToken,
  ApiTokenCall,
  ApiTokenUpdatePayload,
} from "./types/api_tokens.js";

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
const createModalTitle = byId<HTMLElement>("createModalTitle");
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
const createRPM = byId<HTMLInputElement>("createRPM");
const createExpiryKeep = byId<HTMLOptionElement>("createExpiryKeep");
const scopeUnknown = byId<HTMLElement>("scopeUnknown");

// The token being edited (null = creating). Set by openTokenModal.
let editingToken: ApiToken | null = null;
// Scopes on the edited token that the current catalog doesn't offer (module
// manifest dropped them, admin domain hidden, …). Shown read-only and sent
// back unchanged so one save never silently strips a permission.
let preservedScopes: string[] = [];

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
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-inline btn-secondary";
    editBtn.textContent = "编辑";
    editBtn.style.marginRight = "4px";
    editBtn.addEventListener("click", () => openTokenModal(tok));
    cellActions.appendChild(editBtn);

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

function scopeCheckboxes(): HTMLInputElement[] {
  return Array.from(scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb"));
}

// Set the picker to exactly `scopes`: "*" -> 完全访问; otherwise tick the
// matching boxes and re-derive each module's 本模块全部 greying. Scopes with
// no checkbox are ignored here (the caller tracks them as preservedScopes).
function applySelectedScopes(scopes: string[]): void {
  const want = new Set(scopes);
  scopeWildcard.checked = want.has("*");
  scopeCheckboxes().forEach((cb) => {
    cb.disabled = false;
    cb.checked = !scopeWildcard.checked && want.has(cb.value);
  });
  // syncWildcard greys everything under "*", or else runs syncModuleAll for
  // every module so "<module>:*" disables (and clears) its individual boxes.
  syncWildcard();
}

// A preset replaces only its own module's selection; dock domains and other
// modules keep what is ticked.
function applyPreset(module: string, scopes: string[]): void {
  const keep = scopeCheckboxes()
    .filter((cb) => cb.checked && cb.dataset.module !== module)
    .map((cb) => cb.value);
  applySelectedScopes([...keep, ...scopes]);
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
  const picked = scopeWildcard.checked
    ? ["*"]
    : Array.from(scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb:checked")).map((cb) => cb.value);
  return [...picked, ...preservedScopes.filter((sc) => !picked.includes(sc))];
}

function renderPreservedScopes(): void {
  scopeUnknown.innerHTML = "";
  scopeUnknown.hidden = preservedScopes.length === 0;
  if (preservedScopes.length === 0) return;
  const head = document.createElement("div");
  head.className = "meta-subtitle";
  head.style.cssText = "font-size:11px; margin-bottom:2px;";
  head.textContent = "以下权限不在当前权限列表中（模块可能已下线或改名），只读显示，保存时原样保留：";
  scopeUnknown.appendChild(head);
  for (const sc of preservedScopes) {
    const chip = document.createElement("span");
    chip.className = "scope-unknown-chip";
    chip.textContent = "🔒 " + sc;
    chip.title = sc;
    chip.style.cssText =
      "display:inline-block; margin:1px 3px 1px 0; padding:1px 6px; border-radius:8px; font-size:11px; background:var(--surface-2,#f3f4f6); border:1px dashed var(--border,#e5e7eb);";
    scopeUnknown.appendChild(chip);
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Open the token modal: no argument = create, a token = edit it in place.
function openTokenModal(tok?: ApiToken): void {
  editingToken = tok ?? null;
  createError.textContent = "";
  if (tok) {
    createModalTitle.textContent = "编辑 API Token";
    createSubmitBtn.textContent = "保存";
    createName.value = tok.name;
    const scopes = tok.scopes ?? [];
    const known = new Set(scopeCheckboxes().map((cb) => cb.value));
    known.add("*");
    preservedScopes = scopes.filter((sc) => !known.has(sc));
    applySelectedScopes(scopes);
    createIPs.value = (tok.ip_allowlist ?? []).join("\n");
    createRPM.value = tok.rate_limit_rpm > 0 ? String(tok.rate_limit_rpm) : "";
    createExpiryKeep.hidden = false;
    createExpiryKeep.disabled = false;
    createExpiryKeep.textContent = tok.expires_at
      ? `保持不变（${fmtDate(tok.expires_at)} 到期）`
      : "保持不变（永不过期）";
    createExpiry.value = "keep";
  } else {
    createModalTitle.textContent = "新建 API Token";
    createSubmitBtn.textContent = "创建 Token";
    createName.value = "";
    preservedScopes = [];
    applySelectedScopes([]);
    createIPs.value = "";
    createRPM.value = "";
    createExpiryKeep.hidden = true;
    createExpiryKeep.disabled = true;
    createExpiry.value = "0";
  }
  renderPreservedScopes();
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

// Compute an ISO expires_at from the day-count select; null = never.
function computeExpiry(): string | null {
  const days = parseInt(createExpiry.value, 10) || 0;
  if (days <= 0) return null;
  return new Date(Date.now() + days * 86400 * 1000).toISOString();
}

// Rate limit field: blank = server default (create) / unchanged (edit);
// NaN = invalid input.
function parseRPM(): number | undefined {
  // type=number reports unparsable text as value "" + badInput.
  if (createRPM.validity.badInput) return NaN;
  const v = createRPM.value.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

// The modal body scrolls and the error line sits at its bottom; bring it
// into view so a failed submit is never silent.
function showModalError(msg: string): void {
  createError.textContent = msg;
  createError.scrollIntoView({ block: "nearest" });
}

function closeCreateModal(): void {
  createModal.hidden = true;
  editingToken = null;
}

// Backend error keys -> what to tell the user.
const ERROR_MESSAGES: Record<string, string> = {
  "input.invalid": "输入有误：请检查名称、限速（正整数）和有效期（不能早于现在）",
  "api.unknown_scope": "包含服务端不认识的权限范围（模块可能已下线或改名），请调整勾选后重试",
  "api.invalid_ip": "IP 白名单格式不正确：每行一个 IP 或 CIDR，如 203.0.113.7 或 10.0.0.0/8",
  "api.session_required": "只能在浏览器登录会话中签发或编辑令牌，API Token 不能操作令牌",
  "api.admin_scope_forbidden": "管理员权限范围只能由站点管理员授予",
  forbidden: "无权编辑该令牌：仅令牌创建者或工作区所有者 / 管理员可以编辑",
  not_found: "令牌不存在或已撤销，请刷新列表",
};

function errorText(key: string | undefined, status: number): string {
  if (key) return ERROR_MESSAGES[key] ?? key;
  return `请求失败（HTTP ${status}）`;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x)) && new Set(b).size === sa.size;
}

function confirmEmptyScopes(scopes: string[]): boolean {
  if (scopes.length > 0) return true;
  return confirm("未勾选任何权限范围 = 完全访问（与旧令牌兼容，不含管理员接口）。\n确定这样保存吗？");
}

function usageExample(secret: string): string {
  const origin = window.location.origin;
  return `curl ${origin}/api/nav \\\n  -H "Authorization: Bearer ${secret}"`;
}

async function onSubmitToken(): Promise<void> {
  if (createSubmitBtn.disabled) return;
  const name = createName.value.trim();
  if (!name) {
    showModalError("名称必填");
    return;
  }
  const rpm = parseRPM();
  if (Number.isNaN(rpm)) {
    showModalError("限速必须是正整数（每分钟请求数），留空 = 默认");
    return;
  }
  if (editingToken) {
    await submitEdit(editingToken, name, rpm);
    return;
  }
  const scopes = selectedScopes();
  if (!confirmEmptyScopes(scopes)) return;
  createSubmitBtn.disabled = true;
  createError.textContent = "";
  try {
    const { response, data } = await createApiToken({
      name,
      scopes,
      ip_allowlist: parseIPs(),
      rate_limit_rpm: rpm,
      expires_at: computeExpiry() ?? undefined,
    });
    if (data.error || !response.ok) {
      showModalError(errorText(data.error, response.status));
      return;
    }
    if (!data.secret) {
      showModalError("服务端未返回密钥，请联系管理员");
      return;
    }
    closeCreateModal();
    plaintextValue.value = data.secret;
    plaintextUsage.textContent = usageExample(data.secret);
    plaintextModal.hidden = false;
    void refreshTokenList();
  } catch (err) {
    showModalError((err as Error).message);
  } finally {
    createSubmitBtn.disabled = false;
  }
}

// Edit: PATCH only what changed. The secret is untouched, so no secret dialog.
async function submitEdit(tok: ApiToken, name: string, rpm: number | undefined): Promise<void> {
  const payload: ApiTokenUpdatePayload = {};
  if (name !== tok.name) payload.name = name;
  const scopes = selectedScopes();
  if (!sameSet(scopes, tok.scopes ?? [])) payload.scopes = scopes;
  const ips = parseIPs();
  if (!sameSet(ips, tok.ip_allowlist ?? [])) payload.ip_allowlist = ips;
  if (rpm !== undefined && rpm !== tok.rate_limit_rpm) payload.rate_limit_rpm = rpm;
  if (createExpiry.value !== "keep") {
    const exp = computeExpiry();
    // 永不过期 on a token that already never expires is a no-op.
    if (exp !== null || tok.expires_at) payload.expires_at = exp;
  }
  if (Object.keys(payload).length === 0) {
    showModalError("没有修改任何内容");
    return;
  }
  if (payload.scopes && !confirmEmptyScopes(payload.scopes)) return;
  createSubmitBtn.disabled = true;
  createError.textContent = "";
  try {
    const { response, data } = await updateApiToken(tok.id, payload);
    if (data.error || !response.ok) {
      showModalError(errorText(data.error, response.status));
      return;
    }
    closeCreateModal();
    void refreshTokenList();
  } catch (err) {
    showModalError((err as Error).message);
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
newTokenBtn.addEventListener("click", () => openTokenModal());
showRevokedToggle?.addEventListener("change", () => renderTokenTable());
createCloseBtn.addEventListener("click", closeCreateModal);
createCancelBtn.addEventListener("click", closeCreateModal);
createSubmitBtn.addEventListener("click", () => void onSubmitToken());
createName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void onSubmitToken();
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
