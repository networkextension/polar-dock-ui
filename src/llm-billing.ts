// /llm-billing.html — LLM 定价 + 团队配额 + 申请 single-page UI.
//
// Members see:
//   - Marketplace section: every shared/platform LLM config + pricing +
//     my workspace's budget/spend/status. "申请" button posts an
//     application which auto-approves and creates a team_quota row at
//     the platform-default budget.
//
// Admins additionally see:
//   - A "✏ 价格" button on every marketplace row (open pricing modal).
//   - Team Quotas section: all (workspace, config) budgets, editable.
//   - Applications section: history of every workspace's requests.

import { requestJson } from "./api/http.js";
import {
  fetchMyProxyTokenCalls,
  fetchMyProxyTokenCallsAggregate,
  listMyProxyTokens,
} from "./api/llm_proxy.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type {
  LLMProxyCall,
  LLMProxyCallAggregate,
  LLMProxyToken,
} from "./types/llm_proxy.js";

initStoredTheme();
bindThemeSync();

interface MarketRow {
  id: number;
  name: string;
  model: string;
  is_platform: boolean;
  owned_by_my_workspace: boolean;
  price_per_million_input_usd?: number | null;
  price_per_million_output_usd?: number | null;
  my_monthly_budget_usd?: number | null;
  my_month_spend_usd?: number | null;
  my_credit_balance_usd?: number | null;
  my_has_recharge?: boolean;
  my_application_status?: string;
}

interface LLMHealthItem {
  config_id: number;
  name: string;
  model: string;
  up: boolean;
  reason?: string;
  checked_at: string;
}

// Populated by loadHealth(); used by renderMarket() to render the
// Availability column. Empty before the first probe pass completes.
let healthByConfigID = new Map<number, LLMHealthItem>();

interface TeamQuotaRow {
  id: number;
  llm_config_id: number;
  workspace_id: string;
  monthly_budget_usd: number;
  month_spend_usd: number;
}

interface ApplicationRow {
  id: number;
  llm_config_id: number;
  workspace_id: string;
  requested_by_user_id: string;
  status: string;
  note: string;
  applied_at: string;
  decided_at?: string;
  granted_budget_usd: number;
}

interface MeResponse {
  role?: string;
}

const billingStatus = byId<HTMLElement>("billingStatus");

const marketTable = byId<HTMLTableElement>("marketTable");
const marketTbody = byId<HTMLTableSectionElement>("marketTbody");
const marketEmpty = byId<HTMLElement>("marketEmpty");
const marketLoading = byId<HTMLElement>("marketLoading");
const marketCount = byId<HTMLElement>("marketCount");

const adminPricingSection = byId<HTMLElement>("adminPricingSection");
const adminQuotasSection = byId<HTMLElement>("adminQuotasSection");
const adminAppsSection = byId<HTMLElement>("adminAppsSection");
const quotasTable = byId<HTMLTableElement>("quotasTable");
const quotasTbody = byId<HTMLTableSectionElement>("quotasTbody");
const quotasEmpty = byId<HTMLElement>("quotasEmpty");
const quotasCount = byId<HTMLElement>("quotasCount");
const appsTable = byId<HTMLTableElement>("appsTable");
const appsTbody = byId<HTMLTableSectionElement>("appsTbody");
const appsEmpty = byId<HTMLElement>("appsEmpty");
const appsCount = byId<HTMLElement>("appsCount");

const pricingModal = byId<HTMLElement>("pricingModal");
const pricingTitle = byId<HTMLElement>("pricingTitle");
const pricingCloseBtn = byId<HTMLButtonElement>("pricingCloseBtn");
const pricingCancelBtn = byId<HTMLButtonElement>("pricingCancelBtn");
const pricingSubmitBtn = byId<HTMLButtonElement>("pricingSubmitBtn");
const pricingInput = byId<HTMLInputElement>("pricingInput");
const pricingOutput = byId<HTMLInputElement>("pricingOutput");
const pricingError = byId<HTMLElement>("pricingError");

const applyModal = byId<HTMLElement>("applyModal");
const applyTitle = byId<HTMLElement>("applyTitle");
const applyCloseBtn = byId<HTMLButtonElement>("applyCloseBtn");
const applyCancelBtn = byId<HTMLButtonElement>("applyCancelBtn");
const applySubmitBtn = byId<HTMLButtonElement>("applySubmitBtn");
const applyNote = byId<HTMLInputElement>("applyNote");
const applyError = byId<HTMLElement>("applyError");

const quotaModal = byId<HTMLElement>("quotaModal");
const quotaTitle = byId<HTMLElement>("quotaTitle");
const quotaCloseBtn = byId<HTMLButtonElement>("quotaCloseBtn");
const quotaCancelBtn = byId<HTMLButtonElement>("quotaCancelBtn");
const quotaSubmitBtn = byId<HTMLButtonElement>("quotaSubmitBtn");
const quotaBudget = byId<HTMLInputElement>("quotaBudget");
const quotaError = byId<HTMLElement>("quotaError");

const rechargeModal = byId<HTMLElement>("rechargeModal");
const rechargeTitle = byId<HTMLElement>("rechargeTitle");
const rechargeCloseBtn = byId<HTMLButtonElement>("rechargeCloseBtn");
const rechargeCancelBtn = byId<HTMLButtonElement>("rechargeCancelBtn");
const rechargeSubmitBtn = byId<HTMLButtonElement>("rechargeSubmitBtn");
const rechargeAmount = byId<HTMLInputElement>("rechargeAmount");
const rechargeNote = byId<HTMLInputElement>("rechargeNote");
const rechargeError = byId<HTMLElement>("rechargeError");

const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

let isAdmin = false;
let myWorkspaceID = "";
let pricingTargetId = 0;
let applyTargetId = 0;
let quotaTarget: { llm_config_id: number; workspace_id: string } | null = null;
let rechargeTarget: { llm_config_id: number; workspace_id: string; name: string } | null = null;
let marketRows: MarketRow[] = [];

function setStatus(text: string): void {
  if (billingStatus) {
    billingStatus.textContent = text;
  }
}

function fmtUSD(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${v.toFixed(4)}`;
}

function fmtBudget(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${v.toFixed(2)}`;
}

function openModal(el: HTMLElement | null): void {
  if (el) el.hidden = false;
}

function closeModal(el: HTMLElement | null): void {
  if (el) el.hidden = true;
}

function renderMarket(): void {
  if (marketLoading) marketLoading.hidden = true;
  if (!marketTbody || !marketTable || !marketEmpty || !marketCount) return;
  marketTbody.innerHTML = "";
  if (marketRows.length === 0) {
    marketTable.hidden = true;
    marketEmpty.hidden = false;
    marketCount.textContent = "0";
    return;
  }
  marketTable.hidden = false;
  marketEmpty.hidden = true;
  marketCount.textContent = String(marketRows.length);

  for (const row of marketRows) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = row.name;
    if (row.is_platform) {
      const tag = document.createElement("span");
      tag.className = "badge";
      tag.style.marginLeft = "6px";
      tag.textContent = "platform";
      tdName.appendChild(tag);
    }
    tr.appendChild(tdName);

    const tdModel = document.createElement("td");
    tdModel.textContent = row.model;
    tr.appendChild(tdModel);

    const tdIn = document.createElement("td");
    tdIn.textContent = fmtUSD(row.price_per_million_input_usd);
    tr.appendChild(tdIn);
    const tdOut = document.createElement("td");
    tdOut.textContent = fmtUSD(row.price_per_million_output_usd);
    tr.appendChild(tdOut);

    const tdSpend = document.createElement("td");
    tdSpend.textContent = fmtBudget(row.my_month_spend_usd);
    tr.appendChild(tdSpend);

    const tdBudget = document.createElement("td");
    tdBudget.textContent = fmtBudget(row.my_monthly_budget_usd);
    tr.appendChild(tdBudget);

    const tdBalance = document.createElement("td");
    const bal = row.my_credit_balance_usd ?? 0;
    if (row.my_has_recharge) {
      const color = bal <= 0 ? "var(--danger, #c00)" : (bal < 5 ? "var(--warn, #c80)" : "var(--ok, #0a7a3a)");
      tdBalance.innerHTML = `<span style="color: ${color}; font-weight: 600;">${fmtBudget(bal)}</span>`;
    } else {
      tdBalance.innerHTML = '<span class="meta-subtitle">未充值</span>';
    }
    tr.appendChild(tdBalance);

    const tdStatus = document.createElement("td");
    const hasBudget = row.my_monthly_budget_usd !== null && row.my_monthly_budget_usd !== undefined;
    const used = row.my_month_spend_usd ?? 0;
    const budget = row.my_monthly_budget_usd ?? 0;
    // Priority: credit exhausted > monthly exceeded > opened > owned-no-cap > applied-pending > none
    if (row.my_has_recharge && bal <= 0) {
      tdStatus.innerHTML = '<span style="color: var(--danger, #c00);">余额耗尽</span>';
    } else if (hasBudget && budget > 0 && used >= budget) {
      tdStatus.innerHTML = '<span style="color: var(--danger, #c00);">月度超额</span>';
    } else if (row.my_has_recharge) {
      tdStatus.innerHTML = '<span style="color: var(--ok, #0a7a3a);">✓ 已充值</span>';
    } else if (hasBudget) {
      tdStatus.innerHTML = '<span style="color: var(--ok, #0a7a3a);">✓ 已开通</span>';
    } else if (row.owned_by_my_workspace) {
      tdStatus.innerHTML = '<span style="color: var(--ok, #0a7a3a);">✓ 自有 · 未设额度</span>';
    } else if (row.my_application_status) {
      tdStatus.textContent = row.my_application_status;
    } else {
      tdStatus.innerHTML = '<span class="meta-subtitle">未申请</span>';
    }
    tr.appendChild(tdStatus);

    // Upstream availability cell — empty until first probe pass.
    // Driven by /api/llm-configs/health refreshed every 30s.
    const tdHealth = document.createElement("td");
    const h = healthByConfigID.get(row.id);
    if (!h) {
      tdHealth.innerHTML = '<span class="meta-subtitle" title="尚未探测">—</span>';
    } else if (h.up) {
      const since = fmtRelative(h.checked_at);
      tdHealth.innerHTML = `<span style="color: var(--ok, #0a7a3a);" title="最近探测 ${since}">🟢 可用</span>`;
    } else {
      const reason = h.reason || "未知原因";
      const safe = reason.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const since = fmtRelative(h.checked_at);
      tdHealth.innerHTML = `<span style="color: var(--danger, #c00);" title="${safe} · 最近探测 ${since}">🔴 不可用</span>`;
    }
    tr.appendChild(tdHealth);

    const tdAct = document.createElement("td");
    tdAct.style.whiteSpace = "nowrap";
    if (!hasBudget) {
      const btn = document.createElement("button");
      btn.className = "btn-inline btn-primary";
      btn.textContent = "申请";
      btn.addEventListener("click", () => openApplyModal(row));
      tdAct.appendChild(btn);
    }
    if (isAdmin) {
      const btnP = document.createElement("button");
      btnP.className = "btn-inline btn-secondary";
      btnP.style.marginLeft = "6px";
      btnP.textContent = "✏ 价格";
      btnP.addEventListener("click", () => openPricingModal(row));
      tdAct.appendChild(btnP);

      const btnR = document.createElement("button");
      btnR.className = "btn-inline btn-secondary";
      btnR.style.marginLeft = "6px";
      btnR.textContent = "💰 充值";
      btnR.addEventListener("click", () => openRechargeModal(row, myWorkspaceID));
      tdAct.appendChild(btnR);
    }
    tr.appendChild(tdAct);

    marketTbody.appendChild(tr);
  }
}

async function loadMarket(): Promise<void> {
  setStatus("加载市场…");
  try {
    const { data } = await requestJson<{ items: MarketRow[] }>("/api/llm-configs/marketplace");
    marketRows = data.items ?? [];
    renderMarket();
    setStatus("");
  } catch (err) {
    setStatus("加载市场失败");
    console.error(err);
  }
}

// loadHealth pulls the prober snapshot and updates the in-memory map
// keyed by llm_config.id. Called once at boot and then on a 30s timer
// matching the backend probe cadence. Failures are silent — the
// status cells gracefully fall back to "—".
async function loadHealth(): Promise<void> {
  // Skip the round-trip if this page doesn't render the marketplace
  // table — e.g. on llm-billing.html (admin-only) or llm-apps.html.
  if (!marketTbody) return;
  try {
    const { data } = await requestJson<{ items: LLMHealthItem[] }>("/api/llm-configs/health");
    const next = new Map<number, LLMHealthItem>();
    for (const item of data.items ?? []) {
      next.set(item.config_id, item);
    }
    healthByConfigID = next;
    if (marketRows.length > 0) {
      renderMarket();
    }
  } catch (err) {
    console.error("loadHealth failed", err);
  }
}

function openApplyModal(row: MarketRow): void {
  applyTargetId = row.id;
  if (applyTitle) applyTitle.textContent = `申请：${row.name}`;
  if (applyNote) applyNote.value = "";
  if (applyError) applyError.textContent = "";
  openModal(applyModal);
}

async function submitApply(): Promise<void> {
  if (!applyTargetId) return;
  if (applyError) applyError.textContent = "";
  try {
    const note = applyNote?.value?.trim() ?? "";
    await requestJson<{ application: ApplicationRow; granted_budget_usd: number }>(
      "/api/llm-config-applications",
      {
        method: "POST",
        body: { llm_config_id: applyTargetId, note },
      },
    );
    closeModal(applyModal);
    await loadMarket();
    if (isAdmin) {
      await Promise.all([loadQuotas(), loadApplications()]);
    }
  } catch (err) {
    if (applyError) applyError.textContent = `申请失败：${(err as Error).message}`;
  }
}

function openPricingModal(row: MarketRow): void {
  pricingTargetId = row.id;
  if (pricingTitle) pricingTitle.textContent = `编辑单价：${row.name}`;
  if (pricingInput) pricingInput.value = row.price_per_million_input_usd != null ? String(row.price_per_million_input_usd) : "";
  if (pricingOutput) pricingOutput.value = row.price_per_million_output_usd != null ? String(row.price_per_million_output_usd) : "";
  if (pricingError) pricingError.textContent = "";
  openModal(pricingModal);
}

async function submitPricing(): Promise<void> {
  if (!pricingTargetId) return;
  if (pricingError) pricingError.textContent = "";
  const inVal = pricingInput?.value?.trim() ?? "";
  const outVal = pricingOutput?.value?.trim() ?? "";
  const body: { price_per_million_input_usd: number | null; price_per_million_output_usd: number | null } = {
    price_per_million_input_usd: inVal === "" ? null : Number(inVal),
    price_per_million_output_usd: outVal === "" ? null : Number(outVal),
  };
  try {
    await requestJson(`/api/admin/llm-configs/${pricingTargetId}/pricing`, {
      method: "PUT",
      body,
    });
    closeModal(pricingModal);
    await loadMarket();
  } catch (err) {
    if (pricingError) pricingError.textContent = `保存失败：${(err as Error).message}`;
  }
}

function openQuotaModal(row: TeamQuotaRow): void {
  quotaTarget = { llm_config_id: row.llm_config_id, workspace_id: row.workspace_id };
  if (quotaTitle) quotaTitle.textContent = `编辑预算：${row.workspace_id} · LLM #${row.llm_config_id}`;
  if (quotaBudget) quotaBudget.value = String(row.monthly_budget_usd);
  if (quotaError) quotaError.textContent = "";
  openModal(quotaModal);
}

async function submitQuota(): Promise<void> {
  if (!quotaTarget) return;
  if (quotaError) quotaError.textContent = "";
  const v = Number(quotaBudget?.value ?? 0);
  if (Number.isNaN(v) || v < 0) {
    if (quotaError) quotaError.textContent = "预算必须是非负数";
    return;
  }
  try {
    await requestJson("/api/admin/llm-config-team-quotas", {
      method: "PUT",
      body: {
        llm_config_id: quotaTarget.llm_config_id,
        workspace_id: quotaTarget.workspace_id,
        monthly_budget_usd: v,
      },
    });
    closeModal(quotaModal);
    await Promise.all([loadQuotas(), loadMarket()]);
  } catch (err) {
    if (quotaError) quotaError.textContent = `保存失败：${(err as Error).message}`;
  }
}

async function loadQuotas(): Promise<void> {
  if (!quotasTbody || !quotasTable || !quotasEmpty || !quotasCount) return;
  try {
    const { data } = await requestJson<{ items: TeamQuotaRow[] }>("/api/admin/llm-config-team-quotas");
    const items = data.items ?? [];
    quotasTbody.innerHTML = "";
    if (items.length === 0) {
      quotasTable.hidden = true;
      quotasEmpty.hidden = false;
      quotasCount.textContent = "0";
      return;
    }
    quotasTable.hidden = false;
    quotasEmpty.hidden = true;
    quotasCount.textContent = String(items.length);
    for (const row of items) {
      const tr = document.createElement("tr");
      const tdWs = document.createElement("td");
      tdWs.textContent = row.workspace_id;
      tr.appendChild(tdWs);
      const tdCfg = document.createElement("td");
      tdCfg.textContent = `#${row.llm_config_id}`;
      tr.appendChild(tdCfg);
      const tdSpend = document.createElement("td");
      tdSpend.textContent = fmtBudget(row.month_spend_usd);
      tr.appendChild(tdSpend);
      const tdBudget = document.createElement("td");
      tdBudget.textContent = fmtBudget(row.monthly_budget_usd);
      tr.appendChild(tdBudget);
      const tdAct = document.createElement("td");
      const btn = document.createElement("button");
      btn.className = "btn-inline btn-secondary";
      btn.textContent = "✏ 改预算";
      btn.addEventListener("click", () => openQuotaModal(row));
      tdAct.appendChild(btn);
      tr.appendChild(tdAct);
      quotasTbody.appendChild(tr);
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadApplications(): Promise<void> {
  if (!appsTbody || !appsTable || !appsEmpty || !appsCount) return;
  try {
    const { data } = await requestJson<{ items: ApplicationRow[] }>("/api/admin/llm-config-applications");
    const items = data.items ?? [];
    appsTbody.innerHTML = "";
    if (items.length === 0) {
      appsTable.hidden = true;
      appsEmpty.hidden = false;
      appsCount.textContent = "0";
      return;
    }
    appsTable.hidden = false;
    appsEmpty.hidden = true;
    appsCount.textContent = String(items.length);
    for (const row of items) {
      const tr = document.createElement("tr");
      const tdT = document.createElement("td");
      tdT.textContent = new Date(row.applied_at).toLocaleString();
      tr.appendChild(tdT);
      const tdWs = document.createElement("td");
      tdWs.textContent = row.workspace_id;
      tr.appendChild(tdWs);
      const tdU = document.createElement("td");
      tdU.textContent = row.requested_by_user_id;
      tr.appendChild(tdU);
      const tdCfg = document.createElement("td");
      tdCfg.textContent = `#${row.llm_config_id}`;
      tr.appendChild(tdCfg);
      const tdS = document.createElement("td");
      tdS.textContent = row.status;
      tr.appendChild(tdS);
      const tdG = document.createElement("td");
      tdG.textContent = fmtBudget(row.granted_budget_usd);
      tr.appendChild(tdG);
      const tdN = document.createElement("td");
      tdN.textContent = row.note;
      tr.appendChild(tdN);
      appsTbody.appendChild(tr);
    }
  } catch (err) {
    console.error(err);
  }
}

function openRechargeModal(row: MarketRow, workspaceID: string): void {
  rechargeTarget = { llm_config_id: row.id, workspace_id: workspaceID, name: row.name };
  if (rechargeTitle) rechargeTitle.textContent = `充值：${row.name}（当前余额 ${fmtBudget(row.my_credit_balance_usd ?? 0)}）`;
  if (rechargeAmount) rechargeAmount.value = "";
  if (rechargeNote) rechargeNote.value = "";
  if (rechargeError) rechargeError.textContent = "";
  openModal(rechargeModal);
}

async function submitRecharge(): Promise<void> {
  if (!rechargeTarget) return;
  if (rechargeError) rechargeError.textContent = "";
  const amt = Number(rechargeAmount?.value ?? 0);
  if (Number.isNaN(amt) || amt === 0) {
    if (rechargeError) rechargeError.textContent = "金额必须为非零数字（允许负数清退）";
    return;
  }
  try {
    await requestJson("/api/admin/llm-config-team-quotas/recharge", {
      method: "POST",
      body: {
        llm_config_id: rechargeTarget.llm_config_id,
        workspace_id: rechargeTarget.workspace_id,
        amount_usd: amt,
        note: rechargeNote?.value?.trim() ?? "",
      },
    });
    closeModal(rechargeModal);
    await loadMarket();
  } catch (err) {
    if (rechargeError) rechargeError.textContent = `充值失败：${(err as Error).message}`;
  }
}

function readActiveWorkspaceID(): string {
  try {
    return localStorage.getItem("polar_active_workspace_id") || "";
  } catch {
    return "";
  }
}

// ---------- B6: 我的 API Token 用量 ----------
//
// Reuses the same audit modal shape as /proxy-tokens.html (PR #251) —
// renderers duplicated here rather than extracted into a shared module
// because the two pages have separate ts bundles and the render code
// is small. Worth factoring out if a third page wants it.

const myTokensTable = byId<HTMLTableElement>("myTokensTable");
const myTokensTbody = byId<HTMLTableSectionElement>("myTokensTbody");
const myTokensEmpty = byId<HTMLElement>("myTokensEmpty");
const myTokensLoading = byId<HTMLElement>("myTokensLoading");
const myTokensCount = byId<HTMLElement>("myTokensCount");
const myTokensShowRevokedToggle = byId<HTMLInputElement>("myTokensShowRevokedToggle");

let myAllTokens: LLMProxyToken[] = [];
let myAggregateByTokenID = new Map<number, LLMProxyCallAggregate[]>();

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
  let color = "#16a34a";
  if (latencyMs >= 3000) color = "#dc2626";
  else if (latencyMs >= 300) color = "#d97706";
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

  if (c.status_code >= 400) {
    tr.style.background = "rgba(220, 38, 38, 0.04)";
  }
  return tr;
}

async function loadMyTokens(): Promise<void> {
  if (!myTokensTable || !myTokensTbody || !myTokensEmpty || !myTokensLoading || !myTokensCount) return;
  myTokensLoading.hidden = false;
  myTokensTable.hidden = true;
  myTokensEmpty.hidden = true;

  try {
    const { data } = await listMyProxyTokens();
    myAllTokens = data.tokens ?? [];
    myAggregateByTokenID = new Map();
    renderMyTokensTable();
    myTokensLoading.hidden = true;

    // Fetch aggregates for visible tokens concurrently; patch in place
    // as each lands. One slow upstream shouldn't block the others.
    const visible = filteredMyTokens();
    await Promise.allSettled(
      visible.map(async (tok) => {
        try {
          const { data: aggData } = await fetchMyProxyTokenCallsAggregate(tok.id, 30);
          const agg = aggData.aggregate ?? [];
          myAggregateByTokenID.set(tok.id, agg);
          const tr = myTokensTbody.querySelector<HTMLTableRowElement>(`tr[data-token-id="${tok.id}"]`);
          if (tr) patchMyTokenRowWithAggregate(tr, agg);
        } catch {
          // ignore — placeholder "—" stays
        }
      }),
    );
  } catch (err) {
    myTokensEmpty.hidden = false;
    myTokensEmpty.textContent = `加载失败：${(err as Error).message}`;
    myTokensLoading.hidden = true;
  }
}

function filteredMyTokens(): LLMProxyToken[] {
  const showRevoked = myTokensShowRevokedToggle?.checked ?? false;
  return showRevoked ? myAllTokens : myAllTokens.filter((t) => !t.revoked_at);
}

function renderMyTokensTable(): void {
  if (!myTokensTable || !myTokensTbody || !myTokensEmpty || !myTokensCount) return;
  const visible = filteredMyTokens();
  const revokedCount = myAllTokens.filter((t) => t.revoked_at).length;
  const showRevoked = myTokensShowRevokedToggle?.checked ?? false;

  myTokensTbody.innerHTML = "";
  visible.forEach((tok) => {
    const tr = renderMyTokenRow(tok);
    tr.dataset.tokenId = String(tok.id);
    // Re-apply cached aggregate if we already fetched it on a previous render
    const cached = myAggregateByTokenID.get(tok.id);
    if (cached) patchMyTokenRowWithAggregate(tr, cached);
    myTokensTbody.appendChild(tr);
  });

  if (revokedCount > 0 && !showRevoked) {
    myTokensCount.textContent = `${visible.length} 个 (隐藏 ${revokedCount} 个已撤销)`;
  } else {
    myTokensCount.textContent = `${visible.length} 个`;
  }
  myTokensTable.hidden = visible.length === 0;
  myTokensEmpty.hidden = visible.length !== 0;
  if (visible.length === 0 && myAllTokens.length > 0) {
    myTokensEmpty.textContent = '没有启用中的 token。勾选「显示已撤销」查看历史。';
  }
}

function renderMyTokenRow(tok: LLMProxyToken): HTMLTableRowElement {
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
  cellLLM.textContent = tok.default_llm_config_id != null ? `#${tok.default_llm_config_id}` : "—";

  // Placeholders patched later by aggregate fetch.
  const cellCalls = document.createElement("td");
  cellCalls.textContent = "—";
  cellCalls.dataset.role = "calls";

  const cellRate = document.createElement("td");
  cellRate.textContent = "—";
  cellRate.dataset.role = "rate";

  const cellUSD = document.createElement("td");
  cellUSD.textContent = "—";
  cellUSD.dataset.role = "usd";
  cellUSD.style.cssText = "font-weight:600;";

  const cellLastUsed = document.createElement("td");
  cellLastUsed.textContent = fmtRelative(tok.last_used_at);

  const cellAct = document.createElement("td");
  const auditBtn = document.createElement("button");
  auditBtn.type = "button";
  auditBtn.className = "btn-inline btn-secondary";
  auditBtn.textContent = "📊 审计";
  auditBtn.addEventListener("click", () => openAuditModal(tok));
  cellAct.appendChild(auditBtn);

  tr.append(cellName, cellPrefix, cellLLM, cellCalls, cellRate, cellUSD, cellLastUsed, cellAct);
  return tr;
}

function patchMyTokenRowWithAggregate(tr: HTMLTableRowElement, agg: LLMProxyCallAggregate[]): void {
  let totalCalls = 0;
  let totalOK = 0;
  let totalUSD = 0;
  for (const a of agg) {
    totalCalls += a.calls;
    totalOK += a.ok_count;
    totalUSD += a.cost_usd;
  }
  const callsCell = tr.querySelector<HTMLTableCellElement>('td[data-role="calls"]');
  const rateCell = tr.querySelector<HTMLTableCellElement>('td[data-role="rate"]');
  const usdCell = tr.querySelector<HTMLTableCellElement>('td[data-role="usd"]');
  if (callsCell) callsCell.textContent = totalCalls.toLocaleString();
  if (rateCell) {
    if (totalCalls === 0) {
      rateCell.textContent = "—";
    } else {
      const pct = (totalOK / totalCalls) * 100;
      const color = pct >= 99 ? "#16a34a" : pct >= 90 ? "#d97706" : "#dc2626";
      rateCell.innerHTML = `<span style="color:${color}; font-weight:600;">${pct.toFixed(1)}%</span> <span class="meta-subtitle">(${totalOK}/${totalCalls})</span>`;
    }
  }
  if (usdCell) usdCell.textContent = totalUSD > 0 ? `$${totalUSD.toFixed(4)}` : "—";
}

function openAuditModal(tok: LLMProxyToken): void {
  if (!auditModal || !auditTitle || !auditSubtitle) return;
  auditCurrentToken = tok;
  auditTitle.textContent = `审计日志 — ${tok.name}`;

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

function closeAuditModal(): void {
  auditCurrentToken = null;
  if (auditModal) auditModal.hidden = true;
  if (auditAggregateTbody) auditAggregateTbody.innerHTML = "";
  if (auditCallsTbody) auditCallsTbody.innerHTML = "";
  if (auditStatus) auditStatus.textContent = "";
}

function syncAuditDaysButtons(): void {
  if (!auditDays || !auditDaysGroup) return;
  const current = auditDays.value;
  auditDaysGroup.querySelectorAll<HTMLButtonElement>(".audit-day-btn").forEach((btn) => {
    const active = btn.dataset.days === current;
    btn.style.background = active ? "var(--accent, #3b82f6)" : "transparent";
    btn.style.color = active ? "#fff" : "var(--text, #374151)";
    btn.style.fontWeight = active ? "600" : "400";
  });
}

async function refreshAuditModal(): Promise<void> {
  if (!auditCurrentToken || !auditDays || !auditStatus) return;
  if (!auditAggregateTable || !auditAggregateTbody || !auditAggregateEmpty) return;
  if (!auditCallsTable || !auditCallsTbody || !auditCallsEmpty) return;
  const tokenID = auditCurrentToken.id;
  const days = parseInt(auditDays.value, 10) || 7;

  auditStatus.textContent = "加载中...";
  try {
    const [aggResp, callsResp] = await Promise.all([
      fetchMyProxyTokenCallsAggregate(tokenID, days),
      fetchMyProxyTokenCalls(tokenID, 100),
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

myTokensShowRevokedToggle?.addEventListener("change", () => renderMyTokensTable());

auditCloseBtn?.addEventListener("click", closeAuditModal);
auditRefreshBtn?.addEventListener("click", () => void refreshAuditModal());
auditDays?.addEventListener("change", () => {
  syncAuditDaysButtons();
  void refreshAuditModal();
});
auditDaysGroup?.addEventListener("click", (ev) => {
  const target = (ev.target as HTMLElement).closest<HTMLButtonElement>(".audit-day-btn");
  if (!target || !auditDays) return;
  const days = target.dataset.days;
  if (!days) return;
  auditDays.value = days;
  syncAuditDaysButtons();
  void refreshAuditModal();
});

async function bootstrap(): Promise<void> {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  try {
    const { data } = await requestJson<MeResponse>("/api/me");
    isAdmin = data?.role === "admin";
  } catch {
    isAdmin = false;
  }
  myWorkspaceID = readActiveWorkspaceID();
  if (isAdmin) {
    if (adminPricingSection) adminPricingSection.hidden = false;
    if (adminQuotasSection) adminQuotasSection.hidden = false;
    if (adminAppsSection) adminAppsSection.hidden = false;
  }
  await Promise.all([loadMarket(), loadMyTokens(), loadHealth()]);
  if (isAdmin) {
    await Promise.all([loadQuotas(), loadApplications()]);
  }
  // Match backend probe cadence — refresh the status column on
  // /llm.html so a recovery / new failure surfaces within ~30s.
  // No-op on pages that don't render the marketplace table (the
  // guard inside loadHealth handles it).
  setInterval(() => {
    void loadHealth();
  }, 30000);
}

// Wire modal buttons
pricingCloseBtn?.addEventListener("click", () => closeModal(pricingModal));
pricingCancelBtn?.addEventListener("click", () => closeModal(pricingModal));
pricingSubmitBtn?.addEventListener("click", () => void submitPricing());

applyCloseBtn?.addEventListener("click", () => closeModal(applyModal));
applyCancelBtn?.addEventListener("click", () => closeModal(applyModal));
applySubmitBtn?.addEventListener("click", () => void submitApply());

quotaCloseBtn?.addEventListener("click", () => closeModal(quotaModal));
quotaCancelBtn?.addEventListener("click", () => closeModal(quotaModal));
quotaSubmitBtn?.addEventListener("click", () => void submitQuota());

rechargeCloseBtn?.addEventListener("click", () => closeModal(rechargeModal));
rechargeCancelBtn?.addEventListener("click", () => closeModal(rechargeModal));
rechargeSubmitBtn?.addEventListener("click", () => void submitRecharge());

logoutBtn?.addEventListener("click", () => {
  void logout().then(() => {
    window.location.href = "/login.html";
  });
});

void bootstrap();
