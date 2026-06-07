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

import { createApiToken, listApiTokens, revokeApiToken } from "./api/api_tokens.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { ApiToken } from "./types/api_tokens.js";

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

const plaintextModal = byId<HTMLElement>("plaintextModal");
const plaintextValue = byId<HTMLInputElement>("plaintextValue");
const plaintextUsage = byId<HTMLElement>("plaintextUsage");
const plaintextCopyBtn = byId<HTMLButtonElement>("plaintextCopyBtn");
const plaintextDoneBtn = byId<HTMLButtonElement>("plaintextDoneBtn");

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

  const cellCreated = document.createElement("td");
  cellCreated.textContent = fmtRelative(tok.created_at);

  const cellLastUsed = document.createElement("td");
  cellLastUsed.textContent = fmtRelative(tok.last_used_at);

  const cellStatus = document.createElement("td");
  cellStatus.textContent = revoked ? `🔴 已撤销 ${fmtRelative(tok.revoked_at)}` : "✓ 启用";

  const cellActions = document.createElement("td");
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

function openCreateModal(): void {
  createName.value = "";
  createError.textContent = "";
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
    const { data } = await createApiToken({ name });
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
logoutBtn.addEventListener("click", () => void logout().then(() => (window.location.href = "/login.html")));

async function bootstrap(): Promise<void> {
  await hydrateSiteBrand();
  await hydrateSidebarFoot();
  await refreshTokenList();
}

void bootstrap();
