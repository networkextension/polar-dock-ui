import {
  createBotUser,
  fetchAvailableLLMConfigs,
  fetchBotStatusBatch,
  fetchBotUser,
  fetchBotUsers,
  removeBotUser,
  updateBotUser,
} from "./api/dashboard.js";
import { logout, fetchCurrentUser } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import { t } from "./lib/i18n.js";
import { renderMarkdown } from "./lib/marked.js";
import type { BotPayload, BotUser, GroupCount, LLMConfig } from "./types/dashboard.js";

// ── Bot User DOM ─────────────────────────────────────────────────────────────
const botUserForm = byId<HTMLFormElement>("botUserForm");
const botUserNameInput = byId<HTMLInputElement>("botUserNameInput");
const botUserConfigSelect = byId<HTMLSelectElement>("botUserConfigSelect");
const botUserConfigBlock = byId<HTMLElement>("botUserConfigBlock");
const botUserPreferredToolBlock = byId<HTMLElement>("botUserPreferredToolBlock");
const botUserPreferredToolSelect = byId<HTMLSelectElement>("botUserPreferredToolSelect");
const botKindClassicRadio = byId<HTMLInputElement>("botKindClassic");
const botKindPassthroughRadio = byId<HTMLInputElement>("botKindPassthrough");
const botUserDescriptionInput = byId<HTMLTextAreaElement>("botUserDescriptionInput");
const botUserSystemPromptInput = byId<HTMLTextAreaElement>("botUserSystemPromptInput");
const botUserResetBtn = byId<HTMLButtonElement>("botUserResetBtn");
const botUserSubmitBtn = byId<HTMLButtonElement>("botUserSubmitBtn");
const botUserStatus = byId<HTMLElement>("botUserStatus");
const botUserList = byId<HTMLUListElement>("botUserList");
const botSearchInput = byId<HTMLInputElement>("botSearchInput");
const botListCount = byId<HTMLElement>("botListCount");
const botPrevBtn = byId<HTMLButtonElement>("botPrevBtn");
const botNextBtn = byId<HTMLButtonElement>("botNextBtn");
const botPageInfo = byId<HTMLElement>("botPageInfo");
const botGroupChips = byId<HTMLElement>("botGroupChips");

const welcomeText = byId<HTMLElement>("welcomeText");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

// ── State ─────────────────────────────────────────────────────────────────────
let editingBotUserId: number | null = null;
let pendingDeleteBotId: number | null = null;
let expandedBotId: number | null = null;
let currentAvailableLLMConfigs: LLMConfig[] = [];
let currentBotUsers: BotUser[] = []; // current page only
// Server-paginated list state (the workspace may hold hundreds of bots).
const BOT_PAGE_SIZE = 30;
let botQuery = "";
let botGroup = ""; // active category filter ("" = all)
let botGroups: GroupCount[] = []; // facet, refreshed from the first page
let botOffset = 0;
let botTotal = 0;
// Bots whose full system_prompt has been lazy-loaded (list is summary-only).
const loadedDetailIds = new Set<number>();

// ── Bot User ──────────────────────────────────────────────────────────────────
function resetBotUserForm(): void {
  editingBotUserId = null;
  botUserForm.reset();
  // form.reset() clears the radio selection — restore classic
  // as the default (no LLM = no work) and re-sync visibility.
  botKindClassicRadio.checked = true;
  applyBotKindUI();
  botUserStatus.textContent = "";
  botUserSubmitBtn.textContent = t("dashboard.saveBotBtn");
}

function syncBotConfigOptions(configs: LLMConfig[]): void {
  if (!configs.length) {
    botUserConfigSelect.innerHTML = `<option value="">${t("dashboard.createLLMConfigFirst")}</option>`;
    botUserConfigSelect.disabled = true;
    botUserSubmitBtn.disabled = true;
    return;
  }
  const currentValue = editingBotUserId ? botUserConfigSelect.value : "";
  botUserConfigSelect.innerHTML = configs
    .map((config) => `<option value="${config.id}">${config.name} · ${config.model}</option>`)
    .join("");
  if (currentValue && configs.some((config) => String(config.id) === currentValue)) {
    botUserConfigSelect.value = currentValue;
  }
  botUserConfigSelect.disabled = false;
  botUserSubmitBtn.disabled = false;
}

function renderBotUserList(bots: BotUser[]): void {
  if (!bots.length) {
    botUserList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.noBots")}</li>`;
    return;
  }
  botUserList.innerHTML = bots
    .map((bot) => {
      const isPending = pendingDeleteBotId === bot.id;
      const isExpanded = expandedBotId === bot.id;
      const actions = isPending
        ? `<button class="btn-inline" type="button" data-action="confirm-delete">${t("common.confirmDelete")}</button>
           <button class="btn-inline btn-secondary" type="button" data-action="cancel-delete">${t("common.cancel")}</button>`
        : `<button class="btn-inline btn-secondary" type="button" data-action="toggle-expand">${isExpanded ? "▲" : "▼"}</button>
           <button class="btn-inline btn-secondary" type="button" data-action="chat">${t("dashboard.chat")}</button>
           <button class="btn-inline btn-secondary" type="button" data-action="edit">${t("common.edit")}</button>
           <button class="btn-inline" type="button" data-action="delete">${t("common.delete")}</button>`;

      const descHtml = bot.description ? renderMarkdown(bot.description) : "";
      const promptHtml = bot.system_prompt ? renderMarkdown(bot.system_prompt) : "";
      const expandPanel = isExpanded ? `
        <div class="bot-expand-panel">
          ${descHtml ? `<div class="bot-expand-section"><div class="bot-expand-label">${t("dashboard.botDescriptionLabel")}</div><div class="content-box bot-expand-content">${descHtml}</div></div>` : ""}
          ${promptHtml ? `<div class="bot-expand-section"><div class="bot-expand-label">${t("dashboard.botSystemPromptLabel")}</div><div class="content-box bot-expand-content">${promptHtml}</div></div>` : ""}
        </div>` : "";

      // Bot kind chip:
      //   classic     → show the LLM config name (existing behavior)
      //   passthrough → show "Passthrough" + the preferred tool hint
      // so the list reads at a glance which bots use a local agent
      // vs the platform LLM.
      const kindChip = bot.bot_kind === "passthrough"
        ? `<span class="tag-chip tag-chip-accent">Passthrough${bot.preferred_tool ? " · " + bot.preferred_tool : ""}</span>`
        : `<span class="tag-chip">${bot.config_name || ""}</span>`;
      const autoChip = bot.is_auto_registered
        ? `<span class="tag-chip" style="background:#e6f4ed; color:#3a7;">🤖 auto · agent</span>`
        : "";
      // Auto-registered bots are managed by the agent itself; the
      // operator can't tweak system_prompt or LLM here. Keep the
      // edit/delete actions disabled to make this obvious.
      const actionsForRow = bot.is_auto_registered
        ? `<span style="font-size:11px; color:var(--text-muted,#888); padding:4px 6px;">(by agent · 撤销 token 即清除)</span>`
        : actions;
      return `
        <li class="tag-item${isPending ? " tag-item-pending-delete" : ""}${isExpanded ? " tag-item-expanded" : ""}" data-bot-user-id="${bot.id}">
          <div class="tag-item-main">
            <div class="tag-item-header">
              <strong>${bot.name}</strong>
              ${kindChip}
              ${autoChip}
              <span class="bot-agent-badge" data-bot-agent-badge="${bot.bot_user_id}"></span>
            </div>
            <div class="tag-item-meta">${t("dashboard.botUserId", { id: bot.bot_user_id })}</div>
          </div>
          <div class="tag-item-actions">${actionsForRow}</div>
          ${expandPanel}
        </li>
      `;
    })
    .join("");
  void hydrateBotAgentBadges(bots);
}

// hydrateBotAgentBadges fans out one /api/agent/bots/<id>/status call
// per bot row (parallel) and slips an inline badge into the
// data-bot-agent-badge slot when the bot has a polar-agent attached.
// Today the only meaningful capability is "kimi" (passthrough mode);
// when present we show a badge so users realize the bot's configured
// model field is being bypassed by their local kimi-cli.
async function hydrateBotAgentBadges(bots: BotUser[]): Promise<void> {
  if (!bots.length) return;
  try {
    const { response, data } = await fetchBotStatusBatch(bots.map((b) => b.bot_user_id));
    if (!response.ok || !data.statuses) {
      return;
    }
    for (const bot of bots) {
      const status = data.statuses[bot.bot_user_id];
      if (!status || !status.attached) {
        continue;
      }
      const slot = document.querySelector<HTMLElement>(
        `[data-bot-agent-badge="${bot.bot_user_id}"]`,
      );
      if (!slot) {
        continue;
      }
      const caps = status.capabilities || [];
      const workdir = status.workdir || "";
      const tool = (status.tool || "").trim();
      const remoteIP = (status.remote_ip || "").trim();
      const uptime = formatUptime(status.uptime_sec || 0);
      const isPassthrough = caps.includes("passthrough") || caps.includes("kimi");
      const detail = `workdir=${workdir}${remoteIP ? ` · ip=${remoteIP}` : ""}${uptime ? ` · uptime=${uptime}` : ""}`;
      const ipChip = remoteIP ? `<span class="tag-chip" title="${escapeAttr(detail)}">${escapeAttr(remoteIP)}</span>` : "";
      const uptimeChip = uptime ? `<span class="tag-chip" title="${escapeAttr(detail)}">⏱ ${escapeAttr(uptime)}</span>` : "";
      if (isPassthrough) {
        const label = tool ? `🤖 ${tool} 接管` : "🤖 本地 agent 接管";
        slot.innerHTML = `<span class="tag-chip tag-chip-accent" title="${escapeAttr(detail)}">${label}</span>${ipChip}${uptimeChip}`;
      } else {
        slot.innerHTML = `<span class="tag-chip" title="${escapeAttr(detail)}">⚙️ agent 已连接</span>${ipChip}${uptimeChip}`;
      }
    }
  } catch {
    // network / 4xx — leave badges empty rather than render a misleading
    // "disconnected" state we can't actually verify.
  }
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// formatUptime renders a server-supplied second count as "Nd Nh Nm" /
// "Nh Nm" / "Nm Ns" / "Ns" — coarsest two units to keep the chip short.
// Empty string if zero so callers can render conditionally.
function formatUptime(sec: number): string {
  if (!sec || sec < 0) return "";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

function updateBotPager(): void {
  const start = botTotal === 0 ? 0 : botOffset + 1;
  const end = Math.min(botOffset + currentBotUsers.length, botTotal);
  botListCount.textContent = botTotal ? `共 ${botTotal} 个` : "";
  botPageInfo.textContent = botTotal ? `${start}–${end} / ${botTotal}` : "";
  botPrevBtn.disabled = botOffset <= 0;
  botNextBtn.disabled = botOffset + BOT_PAGE_SIZE >= botTotal;
}

// renderGroupChips draws the category facet as a chip row: an "All" chip
// plus one per tag with its count. The active filter is highlighted. The
// facet only ships on the first page, so we keep the last-seen set and only
// re-render when it changes (avoids the row flickering during pagination).
function renderGroupChips(): void {
  if (!botGroups.length) {
    botGroupChips.innerHTML = "";
    return;
  }
  const chip = (label: string, value: string): string => {
    const active = botGroup === value;
    const cls = active ? "btn-chip btn-chip-primary" : "btn-chip";
    return `<button type="button" class="${cls}" data-group="${escapeAttr(value)}">${escapeAttr(label)}</button>`;
  };
  const parts = [chip("全部", "")];
  for (const g of botGroups) {
    parts.push(chip(`${g.name} ${g.count}`, g.name));
  }
  botGroupChips.innerHTML = parts.join("");
}

// loadBots fetches one server-paginated, summary (no system_prompt) page for
// the current query + group + offset, so a workspace with hundreds of bots
// stays light. The first page also carries the category facet for the chips.
async function loadBots(): Promise<void> {
  const botResult = await fetchBotUsers({
    q: botQuery,
    group: botGroup,
    limit: BOT_PAGE_SIZE,
    offset: botOffset,
    summary: true,
  });
  if (botResult.response.ok) {
    currentBotUsers = botResult.data.bots || [];
    botTotal = botResult.data.total ?? currentBotUsers.length;
    // groups only ride on the first page (offset 0); preserve them otherwise.
    if (botResult.data.groups) {
      botGroups = botResult.data.groups;
      renderGroupChips();
    }
    renderBotUserList(currentBotUsers);
    updateBotPager();
  } else {
    botUserStatus.textContent = botResult.data.error || t("dashboard.botListLoadFailed");
    botUserList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.botListLoadFailed")}</li>`;
  }
}

async function loadData(): Promise<void> {
  const availableResult = await fetchAvailableLLMConfigs();
  if (availableResult.response.ok) {
    currentAvailableLLMConfigs = availableResult.data.configs || [];
  } else {
    currentAvailableLLMConfigs = [];
  }
  syncBotConfigOptions(currentAvailableLLMConfigs);
  await loadBots();
}

async function bootstrap(): Promise<void> {
  await hydrateSiteBrand();

  const { response, data } = await fetchCurrentUser();
  if (!response.ok) {
    window.location.replace("/login.html");
    return;
  }

  welcomeText.textContent = data.username || "";
  renderSidebarFoot(data);

  await loadData();
}

// ── Event handlers ────────────────────────────────────────────────────────────
botUserResetBtn.addEventListener("click", () => {
  resetBotUserForm();
});

function currentBotKind(): "classic" | "passthrough" {
  return botKindPassthroughRadio.checked ? "passthrough" : "classic";
}

// applyBotKindUI hides/shows the LLM config block + preferred-tool
// block based on the radio. Passthrough bots don't need an LLM
// config; the polar-agent's local tool is the runtime.
function applyBotKindUI(): void {
  const kind = currentBotKind();
  if (kind === "passthrough") {
    botUserConfigBlock.style.display = "none";
    botUserPreferredToolBlock.style.display = "";
  } else {
    botUserConfigBlock.style.display = "";
    botUserPreferredToolBlock.style.display = "none";
  }
}

botKindClassicRadio.addEventListener("change", applyBotKindUI);
botKindPassthroughRadio.addEventListener("change", applyBotKindUI);

botUserForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const kind = currentBotKind();
  const payload: BotPayload = {
    name: botUserNameInput.value.trim(),
    description: botUserDescriptionInput.value.trim(),
    system_prompt: botUserSystemPromptInput.value.trim(),
    llm_config_id: kind === "classic" ? Number(botUserConfigSelect.value || 0) : 0,
    bot_kind: kind,
    preferred_tool: kind === "passthrough" ? botUserPreferredToolSelect.value : "",
  };
  if (!payload.name) {
    botUserStatus.textContent = t("dashboard.botMissingFields");
    return;
  }
  if (kind === "classic" && payload.llm_config_id <= 0) {
    botUserStatus.textContent = t("dashboard.botMissingFields");
    return;
  }
  botUserSubmitBtn.disabled = true;
  botUserStatus.textContent = editingBotUserId ? t("dashboard.botSaving") : t("dashboard.botCreating");
  try {
    const { response, data } = editingBotUserId
      ? await updateBotUser(editingBotUserId, payload)
      : await createBotUser(payload);
    if (!response.ok) {
      botUserStatus.textContent = data.error || t("common.saveFailed");
      return;
    }
    botUserStatus.textContent = editingBotUserId ? t("dashboard.botUpdated") : t("dashboard.botCreated");
    resetBotUserForm();
    await loadData();
  } catch {
    botUserStatus.textContent = t("common.networkErrorRetry");
  } finally {
    botUserSubmitBtn.disabled = false;
  }
});

botUserList.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  const item = button.closest<HTMLElement>("[data-bot-user-id]");
  const botID = Number(item?.dataset.botUserId || 0);
  const bot = currentBotUsers.find((entry) => entry.id === botID);
  if (!bot) return;

  const action = button.dataset.action;
  if (action === "toggle-expand") {
    if (expandedBotId === bot.id) {
      expandedBotId = null;
      renderBotUserList(currentBotUsers);
      return;
    }
    expandedBotId = bot.id;
    // The list is summary-only (no system_prompt); fetch the full bot once on
    // first expand and cache it on the in-memory row.
    if (!loadedDetailIds.has(bot.id)) {
      try {
        const { response, data } = await fetchBotUser(bot.id);
        if (response.ok && data.bot) {
          bot.system_prompt = data.bot.system_prompt || "";
          bot.description = data.bot.description || bot.description;
          loadedDetailIds.add(bot.id);
        }
      } catch {
        // leave prompt empty on failure; expand still shows description
      }
    }
    renderBotUserList(currentBotUsers);
    return;
  }
  if (action === "chat") {
    window.location.href = `/chat.html?user_id=${encodeURIComponent(bot.bot_user_id)}&username=${encodeURIComponent(bot.name)}`;
    return;
  }
  if (action === "edit") {
    editingBotUserId = bot.id;
    botUserNameInput.value = bot.name;
    botUserDescriptionInput.value = bot.description || "";
    botUserSystemPromptInput.value = bot.system_prompt || "";
    botUserConfigSelect.value = String(bot.llm_config_id || "");
    if (bot.bot_kind === "passthrough") {
      botKindPassthroughRadio.checked = true;
      botUserPreferredToolSelect.value = bot.preferred_tool || "";
    } else {
      botKindClassicRadio.checked = true;
    }
    applyBotKindUI();
    botUserSubmitBtn.textContent = t("dashboard.updateBot");
    botUserStatus.textContent = "";
    botUserNameInput.focus();
    return;
  }
  if (action === "delete") {
    pendingDeleteBotId = bot.id;
    renderBotUserList(currentBotUsers);
    return;
  }
  if (action === "cancel-delete") {
    pendingDeleteBotId = null;
    renderBotUserList(currentBotUsers);
    return;
  }
  if (action === "confirm-delete") {
    pendingDeleteBotId = null;
    const { response, data } = await removeBotUser(bot.id);
    if (!response.ok) {
      botUserStatus.textContent = data.error || t("common.deleteFailed");
      renderBotUserList(currentBotUsers);
      return;
    }
    botUserStatus.textContent = t("dashboard.botDeleted", { name: bot.name });
    resetBotUserForm();
    await loadData();
  }
});

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    const response = await logout();
    if (response.ok) {
      window.location.replace("/login.html");
    }
  } finally {
    logoutBtn.disabled = false;
  }
});

// ── Search + pagination ────────────────────────────────────────────────────
let searchDebounce: number | undefined;
botSearchInput.addEventListener("input", () => {
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(() => {
    botQuery = botSearchInput.value.trim();
    botOffset = 0;
    void loadBots();
  }, 250);
});
botGroupChips.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-group]");
  if (!button) return;
  const next = button.dataset.group ?? "";
  if (next === botGroup) return;
  botGroup = next;
  botOffset = 0;
  renderGroupChips(); // immediate active-state feedback
  void loadBots();
});
botPrevBtn.addEventListener("click", () => {
  if (botOffset <= 0) return;
  botOffset = Math.max(0, botOffset - BOT_PAGE_SIZE);
  void loadBots();
});
botNextBtn.addEventListener("click", () => {
  if (botOffset + BOT_PAGE_SIZE >= botTotal) return;
  botOffset += BOT_PAGE_SIZE;
  void loadBots();
});

initStoredTheme();
bindThemeSync();

void bootstrap();
