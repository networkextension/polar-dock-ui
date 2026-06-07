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
} from "./api/api_tokens.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { ApiScopeGroup, ApiToken, ApiTokenCall } from "./types/api_tokens.js";

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

let scopeGroups: ApiScopeGroup[] = [];

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
      chip.textContent = sc;
      chip.style.cssText =
        "display:inline-block; margin:1px 3px 1px 0; padding:1px 6px; border-radius:8px; font-size:11px; background:var(--surface-2,#f3f4f6); border:1px solid var(--border,#e5e7eb);";
      cellScopes.appendChild(chip);
    });
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
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-inline btn-secondary";
    btn.textContent = "撤销";
    btn.addEventListener("click", () => void onRevoke(tok));
    cellActions.appendChild(btn);
  }

  tr.append(cellName, cellPrefix, cellCreated, cellLastUsed, cellStatus, cellActions);
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
  if (scopeGroups.length === 0) {
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
}

function syncWildcard(): void {
  const on = scopeWildcard.checked;
  scopeTree.querySelectorAll<HTMLInputElement>(".scope-cb").forEach((cb) => {
    cb.disabled = on;
    if (on) cb.checked = false;
  });
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
  createModal.hidden = false;
  createName.focus();
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
    const { data } = await createApiToken({ name, scopes: selectedScopes() });
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
  } catch {
    scopeGroups = [];
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
