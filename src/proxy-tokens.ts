// /proxy-tokens.html — admin-gated CRUD for LLM proxy tokens.
//
// Workflow:
//   - On load: fetch tokens + llm_configs in parallel, render the table.
//   - "+ 新建 Token" opens the create modal pre-populated with the
//     llm_config picker. Submit -> backend returns plaintext ONCE ->
//     show the plaintext-shown-once modal with copy buttons.
//   - Each row's "撤销" button hits DELETE /api/llm-proxy/tokens/:id;
//     revoked tokens stay in the list but show as dimmed + read-only.

import { fetchLLMConfigs } from "./api/dashboard.js";
import {
  createProxyToken,
  fetchProxyTokenCalls,
  fetchProxyTokenCallsAggregate,
  fetchProxyTokenRoutes,
  listProxyTokens,
  replaceProxyTokenRoutes,
  revokeProxyToken,
} from "./api/llm_proxy.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { LLMConfig } from "./types/dashboard.js";
import type {
  LLMProxyCall,
  LLMProxyCallAggregate,
  LLMProxyRoute,
  LLMProxyToken,
} from "./types/llm_proxy.js";

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

// Revoked tokens accumulate over time (test keys, rotated keys) and
// add visual noise. Default: hide them; flip the toggle to audit.
let allTokens: LLMProxyToken[] = [];

const createModal = byId<HTMLElement>("createModal");
const createCloseBtn = byId<HTMLButtonElement>("createCloseBtn");
const createCancelBtn = byId<HTMLButtonElement>("createCancelBtn");
const createSubmitBtn = byId<HTMLButtonElement>("createSubmitBtn");
const createName = byId<HTMLInputElement>("createName");
const createLLMConfig = byId<HTMLSelectElement>("createLLMConfig");
const createRPM = byId<HTMLInputElement>("createRPM");
const createError = byId<HTMLElement>("createError");

const plaintextModal = byId<HTMLElement>("plaintextModal");
const plaintextValue = byId<HTMLInputElement>("plaintextValue");
const plaintextBaseURL = byId<HTMLInputElement>("plaintextBaseURL");
const plaintextCopyBtn = byId<HTMLButtonElement>("plaintextCopyBtn");
const plaintextBaseCopyBtn = byId<HTMLButtonElement>("plaintextBaseCopyBtn");
const plaintextDoneBtn = byId<HTMLButtonElement>("plaintextDoneBtn");

const auditModal = byId<HTMLElement>("auditModal");
const auditTitle = byId<HTMLElement>("auditTitle");
const auditSubtitle = byId<HTMLElement>("auditSubtitle");
const auditCloseBtn = byId<HTMLButtonElement>("auditCloseBtn");
const auditDays = byId<HTMLSelectElement>("auditDays");
const auditDaysGroup = byId<HTMLElement>("auditDaysGroup");
const auditRefreshBtn = byId<HTMLButtonElement>("auditRefreshBtn");
const auditStatus = byId<HTMLElement>("auditStatus");
const auditAggregateTable = byId<HTMLTableElement>("auditAggregateTable");
const auditAggregateTbody = byId<HTMLTableSectionElement>("auditAggregateTbody");
const auditAggregateEmpty = byId<HTMLElement>("auditAggregateEmpty");
const auditCallsTable = byId<HTMLTableElement>("auditCallsTable");
const auditCallsTbody = byId<HTMLTableSectionElement>("auditCallsTbody");
const auditCallsEmpty = byId<HTMLElement>("auditCallsEmpty");

let auditCurrentToken: LLMProxyToken | null = null;

const routesModal = byId<HTMLElement>("routesModal");
const routesTitle = byId<HTMLElement>("routesTitle");
const routesCloseBtn = byId<HTMLButtonElement>("routesCloseBtn");
const routesCancelBtn = byId<HTMLButtonElement>("routesCancelBtn");
const routesSaveBtn = byId<HTMLButtonElement>("routesSaveBtn");
const routesTbody = byId<HTMLTableSectionElement>("routesTbody");
const routesAddBtn = byId<HTMLButtonElement>("routesAddBtn");
const routesError = byId<HTMLElement>("routesError");

let routesCurrentToken: LLMProxyToken | null = null;

let llmConfigById = new Map<number, LLMConfig>();

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

function setBaseURLInPlaintextModal(): void {
  const origin = window.location.origin;
  plaintextBaseURL.value = `${origin}/api/proxy/v1`;
}

function renderTokenRow(tok: LLMProxyToken): HTMLTableRowElement {
  const tr = document.createElement("tr");
  if (tok.revoked_at) tr.style.opacity = "0.5";

  const cellName = document.createElement("td");
  cellName.textContent = tok.name;

  const cellPrefix = document.createElement("td");
  const code = document.createElement("code");
  code.textContent = tok.prefix + "…";
  code.style.fontSize = "11px";
  cellPrefix.appendChild(code);

  const cellLLM = document.createElement("td");
  if (tok.default_llm_config_id != null) {
    const cfg = llmConfigById.get(tok.default_llm_config_id);
    cellLLM.textContent = cfg ? `${cfg.name} · ${cfg.model}` : `#${tok.default_llm_config_id} (已删除)`;
  } else {
    cellLLM.textContent = "—";
  }

  const cellRPM = document.createElement("td");
  cellRPM.textContent = String(tok.rate_limit_rpm);

  const cellCreated = document.createElement("td");
  cellCreated.textContent = fmtRelative(tok.created_at);

  const cellLastUsed = document.createElement("td");
  cellLastUsed.textContent = fmtRelative(tok.last_used_at);

  const cellStatus = document.createElement("td");
  cellStatus.textContent = tok.revoked_at ? `🔴 已撤销 ${fmtRelative(tok.revoked_at)}` : "✓ 启用";

  const cellActions = document.createElement("td");
  // Audit available on all rows (even revoked — historical view).
  const auditBtn = document.createElement("button");
  auditBtn.type = "button";
  auditBtn.className = "btn-inline btn-secondary";
  auditBtn.textContent = "审计";
  auditBtn.style.marginRight = "4px";
  auditBtn.addEventListener("click", () => openAuditModal(tok));
  cellActions.appendChild(auditBtn);
  if (!tok.revoked_at) {
    const routesBtn = document.createElement("button");
    routesBtn.type = "button";
    routesBtn.className = "btn-inline btn-secondary";
    routesBtn.textContent = "路由";
    routesBtn.style.marginRight = "4px";
    routesBtn.addEventListener("click", () => openRoutesModal(tok));
    cellActions.appendChild(routesBtn);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-inline btn-secondary";
    btn.textContent = "撤销";
    btn.addEventListener("click", () => onRevoke(tok));
    cellActions.appendChild(btn);
  }

  tr.append(cellName, cellPrefix, cellLLM, cellRPM, cellCreated, cellLastUsed, cellStatus, cellActions);
  return tr;
}

async function refreshTokenList(): Promise<void> {
  tokenLoading.hidden = false;
  tokenTable.hidden = true;
  tokenEmpty.hidden = true;

  try {
    const { data } = await listProxyTokens();
    allTokens = data.tokens ?? [];
    renderTokenTable();
  } catch (err) {
    tokenEmpty.hidden = false;
    tokenEmpty.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    tokenLoading.hidden = true;
  }
}

function renderTokenTable(): void {
  const showRevoked = showRevokedToggle?.checked ?? false;
  const visible = showRevoked ? allTokens : allTokens.filter((t) => !t.revoked_at);
  const revokedCount = allTokens.filter((t) => t.revoked_at).length;

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
    tokenEmpty.textContent = '没有启用中的 token。勾选「显示已撤销」查看历史。';
  }
}

async function loadLLMConfigs(): Promise<void> {
  try {
    const { data } = await fetchLLMConfigs();
    const configs = data.configs ?? [];
    llmConfigById = new Map(configs.map((c) => [c.id, c]));

    createLLMConfig.innerHTML = "";
    if (configs.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "—— 当前 workspace 还没有 llm_config，先去 /bots.html 创建一个 ——";
      opt.disabled = true;
      createLLMConfig.appendChild(opt);
      return;
    }
    configs
      .filter((c) => c.has_api_key && (c.provider_kind === "text" || !c.provider_kind))
      .forEach((cfg) => {
        const opt = document.createElement("option");
        opt.value = String(cfg.id);
        opt.textContent = `${cfg.name} · ${cfg.model}`;
        createLLMConfig.appendChild(opt);
      });
  } catch (err) {
    createLLMConfig.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = `加载失败：${(err as Error).message}`;
    opt.disabled = true;
    createLLMConfig.appendChild(opt);
  }
}

function openCreateModal(): void {
  createName.value = "";
  createRPM.value = "60";
  createError.textContent = "";
  createModal.hidden = false;
  createName.focus();
}

function closeCreateModal(): void {
  createModal.hidden = true;
}

async function onSubmitCreate(): Promise<void> {
  const name = createName.value.trim();
  if (!name) {
    createError.textContent = "name 必填";
    return;
  }
  const llmConfigID = parseInt(createLLMConfig.value, 10);
  if (!Number.isFinite(llmConfigID) || llmConfigID <= 0) {
    createError.textContent = "请选择一个 LLM 配置";
    return;
  }
  const rpm = parseInt(createRPM.value, 10) || 60;

  createSubmitBtn.disabled = true;
  createError.textContent = "";
  try {
    const { data } = await createProxyToken({
      name,
      default_llm_config_id: llmConfigID,
      rate_limit_rpm: rpm,
    });
    if (data.error) {
      createError.textContent = data.error;
      return;
    }
    const tok = data.token;
    if (!tok || !tok.plaintext) {
      createError.textContent = "服务端未返回 plaintext，请联系管理员";
      return;
    }
    closeCreateModal();
    plaintextValue.value = tok.plaintext;
    setBaseURLInPlaintextModal();
    plaintextModal.hidden = false;
    void refreshTokenList();
  } catch (err) {
    createError.textContent = (err as Error).message;
  } finally {
    createSubmitBtn.disabled = false;
  }
}

async function onRevoke(tok: LLMProxyToken): Promise<void> {
  if (!confirm(`确认撤销 token "${tok.name}" (${tok.prefix}…)？\n撤销后无法恢复，依赖该 token 的客户端会立即收到 401。`)) {
    return;
  }
  try {
    await revokeProxyToken(tok.id);
    void refreshTokenList();
  } catch (err) {
    alert(`撤销失败：${(err as Error).message}`);
  }
}

function statusBadgeColors(status: number): { bg: string; fg: string } {
  if (status >= 500) return { bg: "#fee2e2", fg: "#991b1b" };
  if (status >= 400) return { bg: "#ffedd5", fg: "#9a3412" };
  if (status >= 200 && status < 300) return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#e5e7eb", fg: "#374151" };
}

function renderStatusBadge(status: number): HTMLSpanElement {
  const span = document.createElement("span");
  const c = statusBadgeColors(status);
  span.textContent = String(status);
  span.style.cssText = `display:inline-block; padding:2px 8px; border-radius:10px; font-size:12px; font-weight:600; background:${c.bg}; color:${c.fg};`;
  return span;
}

function renderLatencyCell(latencyMs: number): HTMLElement {
  const wrap = document.createElement("span");
  if (latencyMs <= 0) {
    wrap.textContent = "—";
    return wrap;
  }
  let color = "#16a34a"; // green <300ms
  if (latencyMs >= 3000) color = "#dc2626"; // red ≥3s
  else if (latencyMs >= 300) color = "#d97706"; // amber <3s
  const dot = document.createElement("span");
  dot.style.cssText = `display:inline-block; width:8px; height:8px; border-radius:50%; background:${color}; margin-right:6px; vertical-align:middle;`;
  wrap.appendChild(dot);
  wrap.appendChild(document.createTextNode(latencyMs >= 1000 ? `${(latencyMs / 1000).toFixed(2)}s` : `${latencyMs}ms`));
  return wrap;
}

function renderAuditAggregateRow(a: LLMProxyCallAggregate): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const mk = (text: string) => {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  };
  tr.appendChild(mk(a.model || "—"));
  tr.appendChild(mk(a.calls.toLocaleString()));

  // Success rate: progress bar + "X / Y (Z%)" label
  const rateTd = document.createElement("td");
  const pct = a.calls > 0 ? (a.ok_count / a.calls) * 100 : 0;
  const barColor = pct >= 99 ? "#16a34a" : pct >= 90 ? "#d97706" : "#dc2626";
  rateTd.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; min-width:180px;">
      <div style="flex:1; height:6px; background:#e5e7eb; border-radius:3px; overflow:hidden;">
        <div style="width:${pct.toFixed(1)}%; height:100%; background:${barColor};"></div>
      </div>
      <span style="font-size:12px; white-space:nowrap; color:#374151;">${a.ok_count}/${a.calls} (${pct.toFixed(1)}%)</span>
    </div>`;
  tr.appendChild(rateTd);

  tr.appendChild(mk(a.prompt_tokens.toLocaleString()));
  tr.appendChild(mk(a.completion_tokens.toLocaleString()));
  tr.appendChild(mk(a.total_tokens.toLocaleString()));

  // USD emphasized: bold + slightly larger
  const usdTd = document.createElement("td");
  usdTd.textContent = a.cost_usd > 0 ? `$${a.cost_usd.toFixed(4)}` : "—";
  usdTd.style.cssText = "font-weight:600; font-size:14px;";
  tr.appendChild(usdTd);

  return tr;
}

function renderAuditCallRow(c: LLMProxyCall): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const mk = (text: string) => {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  };
  tr.appendChild(mk(fmtRelative(c.created_at)));

  const statusTd = document.createElement("td");
  statusTd.appendChild(renderStatusBadge(c.status_code));
  tr.appendChild(statusTd);

  tr.appendChild(mk(c.model_resolved || c.model_requested || "—"));
  tr.appendChild(mk(`${c.prompt_tokens} / ${c.completion_tokens}`));
  tr.appendChild(mk(c.cost_usd != null ? `$${c.cost_usd.toFixed(4)}` : "—"));

  const latTd = document.createElement("td");
  latTd.appendChild(renderLatencyCell(c.latency_ms));
  tr.appendChild(latTd);

  const errTd = mk(c.error_text || "");
  if (c.error_text) {
    errTd.style.color = "var(--danger, #c00)";
    errTd.title = c.error_text;
  }
  tr.appendChild(errTd);

  // Failed rows get a subtle red tint
  if (c.status_code >= 400) {
    tr.style.background = "rgba(220, 38, 38, 0.04)";
  }
  return tr;
}

async function refreshAuditModal(): Promise<void> {
  if (!auditCurrentToken) return;
  const tokenID = auditCurrentToken.id;
  const days = parseInt(auditDays.value, 10) || 7;

  auditStatus.textContent = "加载中...";
  try {
    const [aggResp, callsResp] = await Promise.all([
      fetchProxyTokenCallsAggregate(tokenID, days),
      fetchProxyTokenCalls(tokenID, 100),
    ]);

    auditAggregateTbody.innerHTML = "";
    const aggList = aggResp.data.aggregate ?? [];
    aggList.forEach((a) => auditAggregateTbody.appendChild(renderAuditAggregateRow(a)));
    auditAggregateTable.hidden = aggList.length === 0;
    auditAggregateEmpty.hidden = aggList.length !== 0;

    auditCallsTbody.innerHTML = "";
    const callsList = callsResp.data.calls ?? [];
    callsList.forEach((c) => auditCallsTbody.appendChild(renderAuditCallRow(c)));
    auditCallsTable.hidden = callsList.length === 0;
    auditCallsEmpty.hidden = callsList.length !== 0;

    auditStatus.textContent = `聚合 ${aggList.length} 行 / 最近 ${callsList.length} 次`;
  } catch (err) {
    auditStatus.textContent = `加载失败：${(err as Error).message}`;
  }
}

function openAuditModal(tok: LLMProxyToken): void {
  auditCurrentToken = tok;
  auditTitle.textContent = `审计日志 — ${tok.name}`;

  // Subtitle: truncated prefix + copy button
  auditSubtitle.innerHTML = "";
  const prefixSpan = document.createElement("span");
  prefixSpan.textContent = `${tok.prefix}…`;
  prefixSpan.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
  auditSubtitle.appendChild(prefixSpan);
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.title = "复制完整前缀";
  copyBtn.textContent = "📋";
  copyBtn.style.cssText = "background: transparent; border: none; cursor: pointer; padding: 0 4px; font-size: 13px;";
  copyBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(tok.prefix).then(() => {
      copyBtn.textContent = "✓";
      window.setTimeout(() => (copyBtn.textContent = "📋"), 1200);
    });
  });
  auditSubtitle.appendChild(copyBtn);

  syncAuditDaysButtons();
  auditModal.hidden = false;
  void refreshAuditModal();
}

function syncAuditDaysButtons(): void {
  const current = auditDays.value;
  auditDaysGroup.querySelectorAll<HTMLButtonElement>(".audit-day-btn").forEach((btn) => {
    const active = btn.dataset.days === current;
    btn.style.background = active ? "var(--accent, #3b82f6)" : "transparent";
    btn.style.color = active ? "#fff" : "var(--text, #374151)";
    btn.style.fontWeight = active ? "600" : "400";
  });
}

function closeAuditModal(): void {
  auditCurrentToken = null;
  auditModal.hidden = true;
  auditAggregateTbody.innerHTML = "";
  auditCallsTbody.innerHTML = "";
  auditStatus.textContent = "";
}

function buildLLMConfigSelect(selectedID?: number): HTMLSelectElement {
  const sel = document.createElement("select");
  sel.className = "input";
  sel.style.width = "100%";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "—— 选择上游 ——";
  sel.appendChild(empty);
  for (const cfg of llmConfigById.values()) {
    if (!cfg.has_api_key) continue;
    if (cfg.provider_kind && cfg.provider_kind !== "text") continue;
    const opt = document.createElement("option");
    opt.value = String(cfg.id);
    opt.textContent = `${cfg.name} · ${cfg.model}`;
    if (selectedID != null && cfg.id === selectedID) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function appendRouteRow(alias = "", llmConfigID?: number): void {
  const tr = document.createElement("tr");

  const aliasTd = document.createElement("td");
  const aliasInput = document.createElement("input");
  aliasInput.className = "input";
  aliasInput.type = "text";
  aliasInput.placeholder = "e.g. gpt-4o-mini";
  aliasInput.value = alias;
  aliasInput.style.width = "100%";
  aliasTd.appendChild(aliasInput);

  const cfgTd = document.createElement("td");
  cfgTd.appendChild(buildLLMConfigSelect(llmConfigID));

  const actTd = document.createElement("td");
  const rmBtn = document.createElement("button");
  rmBtn.type = "button";
  rmBtn.className = "btn-inline btn-secondary";
  rmBtn.textContent = "✕";
  rmBtn.addEventListener("click", () => tr.remove());
  actTd.appendChild(rmBtn);

  tr.append(aliasTd, cfgTd, actTd);
  routesTbody.appendChild(tr);
}

async function openRoutesModal(tok: LLMProxyToken): Promise<void> {
  routesCurrentToken = tok;
  routesTitle.textContent = `别名路由 · ${tok.name}`;
  routesError.textContent = "";
  routesTbody.innerHTML = "";
  routesModal.hidden = false;
  try {
    const { data } = await fetchProxyTokenRoutes(tok.id);
    const routes = data.routes ?? [];
    if (routes.length === 0) {
      appendRouteRow();
    } else {
      routes.forEach((r) => appendRouteRow(r.alias_model, r.llm_config_id));
    }
  } catch (err) {
    routesError.textContent = `加载失败：${(err as Error).message}`;
  }
}

function closeRoutesModal(): void {
  routesCurrentToken = null;
  routesModal.hidden = true;
  routesTbody.innerHTML = "";
  routesError.textContent = "";
}

async function onSaveRoutes(): Promise<void> {
  if (!routesCurrentToken) return;
  const payload: Array<{ alias_model: string; llm_config_id: number }> = [];
  const seenAlias = new Set<string>();
  for (const tr of Array.from(routesTbody.children) as HTMLTableRowElement[]) {
    const aliasInput = tr.querySelector("input") as HTMLInputElement | null;
    const cfgSelect = tr.querySelector("select") as HTMLSelectElement | null;
    if (!aliasInput || !cfgSelect) continue;
    const alias = aliasInput.value.trim();
    const cfgID = parseInt(cfgSelect.value, 10);
    if (!alias) continue;
    if (!Number.isFinite(cfgID) || cfgID <= 0) {
      routesError.textContent = `别名 "${alias}" 未选上游`;
      return;
    }
    if (seenAlias.has(alias)) {
      routesError.textContent = `别名 "${alias}" 重复`;
      return;
    }
    seenAlias.add(alias);
    payload.push({ alias_model: alias, llm_config_id: cfgID });
  }

  routesSaveBtn.disabled = true;
  routesError.textContent = "";
  try {
    const { data } = await replaceProxyTokenRoutes(routesCurrentToken.id, { routes: payload });
    if (data.error) {
      routesError.textContent = data.error;
      return;
    }
    closeRoutesModal();
  } catch (err) {
    routesError.textContent = (err as Error).message;
  } finally {
    routesSaveBtn.disabled = false;
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
    // Fallback: select for manual copy
    const input = btn.previousElementSibling as HTMLInputElement | null;
    input?.select();
  }
}

newTokenBtn.addEventListener("click", openCreateModal);
showRevokedToggle?.addEventListener("change", () => renderTokenTable());
createCloseBtn.addEventListener("click", closeCreateModal);
createCancelBtn.addEventListener("click", closeCreateModal);
createSubmitBtn.addEventListener("click", () => void onSubmitCreate());
plaintextDoneBtn.addEventListener("click", () => {
  plaintextModal.hidden = true;
  plaintextValue.value = "";
});
plaintextCopyBtn.addEventListener("click", () => void copyToClipboard(plaintextValue.value, plaintextCopyBtn));
plaintextBaseCopyBtn.addEventListener("click", () => void copyToClipboard(plaintextBaseURL.value, plaintextBaseCopyBtn));
auditCloseBtn.addEventListener("click", closeAuditModal);
auditRefreshBtn.addEventListener("click", () => void refreshAuditModal());
auditDays.addEventListener("change", () => {
  syncAuditDaysButtons();
  void refreshAuditModal();
});
auditDaysGroup.addEventListener("click", (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLButtonElement>(".audit-day-btn");
  if (!target) return;
  const days = target.dataset.days;
  if (!days) return;
  auditDays.value = days;
  syncAuditDaysButtons();
  void refreshAuditModal();
});
routesCloseBtn.addEventListener("click", closeRoutesModal);
routesCancelBtn.addEventListener("click", closeRoutesModal);
routesSaveBtn.addEventListener("click", () => void onSaveRoutes());
routesAddBtn.addEventListener("click", () => appendRouteRow());
logoutBtn.addEventListener("click", () => void logout().then(() => (window.location.href = "/login.html")));

async function bootstrap(): Promise<void> {
  await hydrateSiteBrand();
  await renderSidebarFoot();
  await loadLLMConfigs();
  await refreshTokenList();
}

void bootstrap();
