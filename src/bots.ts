import {
  createBotUser,
  createLLMConfig,
  fetchAvailableLLMConfigs,
  fetchBotUsers,
  fetchLLMConfigs,
  removeBotUser,
  removeLLMConfig,
  testLLMConfig,
  updateBotUser,
  updateLLMConfig,
} from "./api/dashboard.js";
import { fetchHostSkillsForWorkspace } from "./api/hosts.js";
import { fetchAgentBotStatus } from "./api/projects.js";
import { logout, fetchCurrentUser } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { LLM_PROVIDER_PRESETS, getPresetByID, matchPresetByBaseURL, matchPresetForConfig, resolvePresetEndpoint, resolvePresetExtras, resolvePresetProviderKind } from "./lib/llm_presets.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import { t } from "./lib/i18n.js";
import { renderMarkdown } from "./lib/marked.js";
import type { BotPayload, BotUser, LLMConfig, LLMConfigPayload } from "./types/dashboard.js";
import type { HostSkillWithHost } from "./types/hosts.js";

// ── LLM Config DOM ──────────────────────────────────────────────────────────
const llmConfigForm = byId<HTMLFormElement>("llmConfigForm");
const llmProviderPresetSelect = byId<HTMLSelectElement>("llmProviderPresetSelect");
const llmProviderPresetNote = byId<HTMLElement>("llmProviderPresetNote");
const llmProviderPresetDocs = byId<HTMLAnchorElement>("llmProviderPresetDocs");
const llmConfigNameInput = byId<HTMLInputElement>("llmConfigNameInput");
const llmConfigBaseUrlInput = byId<HTMLInputElement>("llmConfigBaseUrlInput");
const llmConfigModelInput = byId<HTMLInputElement>("llmConfigModelInput");
const llmConfigApiKeyInput = byId<HTMLInputElement>("llmConfigApiKeyInput");
const llmConfigProxyUrlInput = byId<HTMLInputElement>("llmConfigProxyUrlInput");
const llmConfigSystemPromptInput = byId<HTMLTextAreaElement>("llmConfigSystemPromptInput");
const llmConfigSharedInput = byId<HTMLInputElement>("llmConfigSharedInput");
const llmConfigIsSystemInput = byId<HTMLInputElement>("llmConfigIsSystemInput");
const llmConfigResetBtn = byId<HTMLButtonElement>("llmConfigResetBtn");
const llmConfigTestBtn = byId<HTMLButtonElement>("llmConfigTestBtn");
const llmConfigSubmitBtn = byId<HTMLButtonElement>("llmConfigSubmitBtn");
const llmConfigStatus = byId<HTMLElement>("llmConfigStatus");
const llmConfigList = byId<HTMLUListElement>("llmConfigList");
const addLLMConfigBtn = byId<HTMLButtonElement>("addLLMConfigBtn");
const llmConfigModal = byId<HTMLElement>("llmConfigModal");
const llmConfigModalCloseBtn = byId<HTMLButtonElement>("llmConfigModalCloseBtn");
const llmConfigModalTitle = byId<HTMLElement>("llmConfigModalTitle");

// ── Bot User DOM ─────────────────────────────────────────────────────────────
const botUserForm = byId<HTMLFormElement>("botUserForm");
const botUserNameInput = byId<HTMLInputElement>("botUserNameInput");
const botUserConfigSelect = byId<HTMLSelectElement>("botUserConfigSelect");
const botUserConfigBlock = byId<HTMLElement>("botUserConfigBlock");
const botUserPreferredToolBlock = byId<HTMLElement>("botUserPreferredToolBlock");
const botUserPreferredToolSelect = byId<HTMLSelectElement>("botUserPreferredToolSelect");
const botUserHostSkillSelect = byId<HTMLSelectElement>("botUserHostSkillSelect");
const botKindClassicRadio = byId<HTMLInputElement>("botKindClassic");
const botKindPassthroughRadio = byId<HTMLInputElement>("botKindPassthrough");
const botUserDescriptionInput = byId<HTMLTextAreaElement>("botUserDescriptionInput");
const botUserSystemPromptInput = byId<HTMLTextAreaElement>("botUserSystemPromptInput");
const botUserModelOverrideInput = byId<HTMLInputElement>("botUserModelOverrideInput");
const botUserResetBtn = byId<HTMLButtonElement>("botUserResetBtn");
const botUserSubmitBtn = byId<HTMLButtonElement>("botUserSubmitBtn");
const botUserStatus = byId<HTMLElement>("botUserStatus");
const botUserList = byId<HTMLUListElement>("botUserList");
const addBotUserBtn = byId<HTMLButtonElement>("addBotUserBtn");
const botUserModal = byId<HTMLElement>("botUserModal");
const botUserModalCloseBtn = byId<HTMLButtonElement>("botUserModalCloseBtn");
const botUserModalTitle = byId<HTMLElement>("botUserModalTitle");

const welcomeText = byId<HTMLElement>("welcomeText");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

// ── State ─────────────────────────────────────────────────────────────────────
let editingLLMConfigId: number | null = null;
let editingBotUserId: number | null = null;
let pendingDeleteLLMConfigId: number | null = null;
let pendingDeleteBotId: number | null = null;
let expandedBotId: number | null = null;
let currentLLMConfigs: LLMConfig[] = [];
let currentAvailableLLMConfigs: LLMConfig[] = [];
let currentBotUsers: BotUser[] = [];
let currentHostSkills: HostSkillWithHost[] = [];

function populateLLMProviderPresets(): void {
  llmProviderPresetSelect.innerHTML = LLM_PROVIDER_PRESETS
    .map((item) => `<option value="${item.id}">${item.displayName}</option>`)
    .join("");
}

function applyLLMProviderPreset(presetID: string, keepName = false): void {
  const preset = getPresetByID(presetID) || LLM_PROVIDER_PRESETS[0];
  llmProviderPresetSelect.value = preset.id;
  llmConfigBaseUrlInput.placeholder = resolvePresetEndpoint(preset);
  llmConfigModelInput.placeholder = preset.defaultModelID;
  llmProviderPresetNote.textContent = preset.note;
  llmProviderPresetDocs.href = preset.docsURL;
  if (!keepName || !llmConfigNameInput.value.trim()) {
    llmConfigNameInput.value = `${preset.displayName} Preset`;
  }
}

function collectLLMConfigPayloadFromForm(): LLMConfigPayload {
  const preset = getPresetByID(llmProviderPresetSelect.value) || LLM_PROVIDER_PRESETS[0];
  return {
    name: llmConfigNameInput.value.trim(),
    base_url: llmConfigBaseUrlInput.value.trim() || resolvePresetEndpoint(preset),
    model: llmConfigModelInput.value.trim() || preset.defaultModelID,
    api_key: llmConfigApiKeyInput.value.trim(),
    proxy_url: llmConfigProxyUrlInput.value.trim(),
    system_prompt: llmConfigSystemPromptInput.value.trim(),
    shared: llmConfigSharedInput.checked,
    is_system: llmConfigIsSystemInput?.checked ?? false,
    provider_kind: resolvePresetProviderKind(preset),
    extras: resolvePresetExtras(preset),
  };
}

// Mutual exclusion: is_system rows are internal infra and can't be in
// the customer marketplace. The DB has a CHECK constraint; UI mirrors
// it for instant feedback.
llmConfigIsSystemInput?.addEventListener("change", () => {
  if (llmConfigIsSystemInput.checked && llmConfigSharedInput.checked) {
    llmConfigSharedInput.checked = false;
  }
});
llmConfigSharedInput.addEventListener("change", () => {
  if (llmConfigSharedInput.checked && llmConfigIsSystemInput?.checked) {
    llmConfigIsSystemInput.checked = false;
  }
});

// ── LLM Config ────────────────────────────────────────────────────────────────
function resetLLMConfigForm(): void {
  editingLLMConfigId = null;
  llmConfigForm.reset();
  llmConfigApiKeyInput.value = "";
  llmConfigStatus.textContent = "";
  llmConfigSubmitBtn.textContent = t("dashboard.saveConfigBtn");
  applyLLMProviderPreset(LLM_PROVIDER_PRESETS[0].id, false);
}

function openLLMConfigModal(mode: "add" | "edit"): void {
  llmConfigModalTitle.textContent = mode === "edit" ? "编辑 LLM 配置" : "新建 LLM 配置";
  llmConfigModal.classList.add("open");
  llmConfigModal.setAttribute("aria-hidden", "false");
  llmConfigNameInput.focus();
}

function closeLLMConfigModal(): void {
  llmConfigModal.classList.remove("open");
  llmConfigModal.setAttribute("aria-hidden", "true");
  resetLLMConfigForm();
}

function renderLLMConfigList(configs: LLMConfig[]): void {
  if (!configs.length) {
    llmConfigList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.noLLMConfigs")}</li>`;
    return;
  }

  llmConfigList.innerHTML = configs
    .map((config) => {
      const isPending = pendingDeleteLLMConfigId === config.id;
      const actions = isPending
        ? `<button class="btn-inline" type="button" data-action="confirm-delete">${t("common.confirmDelete")}</button>
           <button class="btn-inline btn-secondary" type="button" data-action="cancel-delete">${t("common.cancel")}</button>`
        : `<button class="btn-inline btn-secondary" type="button" data-action="edit">${t("common.edit")}</button>
           <button class="btn-inline" type="button" data-action="delete">${t("common.delete")}</button>`;
      return `
        <li class="tag-item${isPending ? " tag-item-pending-delete" : ""}" data-llm-config-id="${config.id}">
          <div class="tag-item-main">
            <div class="tag-item-header">
              <strong>${config.name}</strong>
              <span class="tag-chip">${config.model}</span>
              ${config.has_api_key ? `<span class="tag-chip">${t("dashboard.keySaved")}</span>` : `<span class="tag-chip">${t("dashboard.noKey")}</span>`}
              ${config.shared ? `<span class="tag-chip">${t("dashboard.shared")}</span>` : `<span class="tag-chip">${t("dashboard.private")}</span>`}
              ${config.is_system ? `<span class="tag-chip" style="background:#fb923c; color:#fff;">🛠 system</span>` : ""}
            </div>
            <div class="tag-item-meta">${config.base_url}</div>
            <div class="tag-item-desc">${config.system_prompt || t("dashboard.noSystemPrompt")}</div>
          </div>
          <div class="tag-item-actions">${actions}</div>
        </li>
      `;
    })
    .join("");
}

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

function openBotUserModal(mode: "add" | "edit"): void {
  botUserModalTitle.textContent = mode === "edit" ? "编辑 Bot" : "新建 Bot";
  botUserModal.classList.add("open");
  botUserModal.setAttribute("aria-hidden", "false");
  botUserNameInput.focus();
}

function closeBotUserModal(): void {
  botUserModal.classList.remove("open");
  botUserModal.setAttribute("aria-hidden", "true");
  resetBotUserForm();
}

function syncBotHostSkillOptions(skills: HostSkillWithHost[]): void {
  const currentValue = editingBotUserId ? botUserHostSkillSelect.value : "";
  const placeholder = `<option value="">（不绑定 — 使用 Bot 自身的 LLM / 本地 polar-agent）</option>`;
  const options = skills
    .map((sk) => {
      const label = `${sk.host_name || sk.host_slug} · ${sk.kind}${sk.name && sk.name !== sk.kind ? ` (${sk.name})` : ""}`;
      return `<option value="${sk.id}">${label}</option>`;
    })
    .join("");
  botUserHostSkillSelect.innerHTML = placeholder + options;
  if (currentValue) {
    botUserHostSkillSelect.value = currentValue;
  }
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
  await Promise.all(bots.map(async (bot) => {
    try {
      const { response, data } = await fetchAgentBotStatus(bot.bot_user_id);
      if (!response.ok || !data.attached) {
        return;
      }
      const slot = document.querySelector<HTMLElement>(
        `[data-bot-agent-badge="${bot.bot_user_id}"]`,
      );
      if (!slot) {
        return;
      }
      const caps = data.capabilities || [];
      const workdir = data.workdir || "";
      const tool = (data.tool || "").trim();
      const remoteIP = (data.remote_ip || "").trim();
      const uptime = formatUptime(data.uptime_sec || 0);
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
    } catch {
      // network / 4xx — leave badge slot empty rather than render a
      // misleading "disconnected" state we can't actually verify.
    }
  }));
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

async function loadData(): Promise<void> {
  const [ownResult, availableResult, botResult, hostSkillsResult] = await Promise.all([
    fetchLLMConfigs(),
    fetchAvailableLLMConfigs(),
    fetchBotUsers(),
    fetchHostSkillsForWorkspace(),
  ]);

  if (ownResult.response.ok) {
    currentLLMConfigs = ownResult.data.configs || [];
    renderLLMConfigList(currentLLMConfigs);
  } else {
    llmConfigStatus.textContent = ownResult.data.error || t("dashboard.llmConfigLoadFailed");
    llmConfigList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.llmConfigLoadFailed")}</li>`;
  }

  if (availableResult.response.ok) {
    currentAvailableLLMConfigs = availableResult.data.configs || [];
  } else {
    currentAvailableLLMConfigs = [];
  }
  syncBotConfigOptions(currentAvailableLLMConfigs);

  if (hostSkillsResult.response.ok) {
    currentHostSkills = hostSkillsResult.data.skills || [];
  } else {
    currentHostSkills = [];
  }
  syncBotHostSkillOptions(currentHostSkills);

  if (botResult.response.ok) {
    currentBotUsers = botResult.data.bots || [];
    renderBotUserList(currentBotUsers);
  } else {
    botUserStatus.textContent = botResult.data.error || t("dashboard.botListLoadFailed");
    botUserList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.botListLoadFailed")}</li>`;
  }
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
llmConfigResetBtn.addEventListener("click", () => {
  resetLLMConfigForm();
});

llmProviderPresetSelect.addEventListener("change", () => {
  applyLLMProviderPreset(llmProviderPresetSelect.value, false);
});

llmConfigTestBtn.addEventListener("click", async () => {
  const payload = collectLLMConfigPayloadFromForm();
  if (!payload.name || !payload.base_url || !payload.model) {
    llmConfigStatus.textContent = t("dashboard.llmConfigMissingFields");
    return;
  }
  llmConfigTestBtn.disabled = true;
  llmConfigSubmitBtn.disabled = true;
  llmConfigStatus.textContent = t("dashboard.llmConfigTesting");
  try {
    const { response, data } = await testLLMConfig(payload);
    llmConfigStatus.textContent = response.ok
      ? data.message || t("dashboard.llmTestSuccess")
      : data.error || t("dashboard.llmTestFailed");
  } catch {
    llmConfigStatus.textContent = t("common.networkErrorRetry");
  } finally {
    llmConfigTestBtn.disabled = false;
    llmConfigSubmitBtn.disabled = false;
  }
});

llmConfigForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = collectLLMConfigPayloadFromForm();
  if (!payload.name || !payload.base_url || !payload.model) {
    llmConfigStatus.textContent = t("dashboard.llmConfigMissingFields");
    return;
  }
  llmConfigSubmitBtn.disabled = true;
  llmConfigStatus.textContent = editingLLMConfigId ? t("dashboard.llmConfigSaving") : t("dashboard.llmConfigCreating");
  try {
    const { response, data } = editingLLMConfigId
      ? await updateLLMConfig(editingLLMConfigId, { ...payload, update_api_key: payload.api_key !== "" })
      : await createLLMConfig(payload);
    if (!response.ok) {
      llmConfigStatus.textContent = data.error || t("common.saveFailed");
      return;
    }
    llmConfigStatus.textContent = editingLLMConfigId ? t("dashboard.llmConfigUpdated") : t("dashboard.llmConfigCreated");
    closeLLMConfigModal();
    await loadData();
  } catch {
    llmConfigStatus.textContent = t("common.networkErrorRetry");
  } finally {
    llmConfigSubmitBtn.disabled = false;
  }
});

addLLMConfigBtn.addEventListener("click", () => {
  resetLLMConfigForm();
  openLLMConfigModal("add");
});
llmConfigModalCloseBtn.addEventListener("click", () => closeLLMConfigModal());
llmConfigModal.querySelector<HTMLElement>("[data-close-modal]")?.addEventListener("click", () => closeLLMConfigModal());

llmConfigList.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  const item = button.closest<HTMLElement>("[data-llm-config-id]");
  const configID = Number(item?.dataset.llmConfigId || 0);
  const config = currentLLMConfigs.find((entry) => entry.id === configID);
  if (!config) return;

  const action = button.dataset.action;
  if (action === "edit") {
    editingLLMConfigId = config.id;
    const presetID = matchPresetForConfig(config) || LLM_PROVIDER_PRESETS[0].id;
    applyLLMProviderPreset(presetID, true);
    llmConfigNameInput.value = config.name;
    llmConfigBaseUrlInput.value = config.base_url;
    llmConfigModelInput.value = config.model;
    llmConfigApiKeyInput.value = "";
    llmConfigProxyUrlInput.value = config.proxy_url || "";
    llmConfigSystemPromptInput.value = config.system_prompt || "";
    llmConfigSharedInput.checked = config.shared;
    if (llmConfigIsSystemInput) llmConfigIsSystemInput.checked = !!config.is_system;
    llmConfigSubmitBtn.textContent = t("dashboard.updateConfig");
    llmConfigStatus.textContent = config.has_api_key ? t("dashboard.apiKeySaved") : "";
    openLLMConfigModal("edit");
    return;
  }
  if (action === "delete") {
    pendingDeleteLLMConfigId = config.id;
    renderLLMConfigList(currentLLMConfigs);
    return;
  }
  if (action === "cancel-delete") {
    pendingDeleteLLMConfigId = null;
    renderLLMConfigList(currentLLMConfigs);
    return;
  }
  if (action === "confirm-delete") {
    pendingDeleteLLMConfigId = null;
    const { response, data } = await removeLLMConfig(config.id);
    if (!response.ok) {
      llmConfigStatus.textContent = data.error || t("common.deleteFailed");
      renderLLMConfigList(currentLLMConfigs);
      return;
    }
    llmConfigStatus.textContent = t("dashboard.configDeleted", { name: config.name });
    resetLLMConfigForm();
    await loadData();
  }
});

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
  const hostSkillRaw = botUserHostSkillSelect.value;
  const hostSkillID: number | null = hostSkillRaw ? Number(hostSkillRaw) : null;
  const payload: BotPayload = {
    name: botUserNameInput.value.trim(),
    description: botUserDescriptionInput.value.trim(),
    system_prompt: botUserSystemPromptInput.value.trim(),
    llm_config_id: kind === "classic" ? Number(botUserConfigSelect.value || 0) : 0,
    bot_kind: kind,
    preferred_tool: kind === "passthrough" ? botUserPreferredToolSelect.value : "",
    model_override: botUserModelOverrideInput.value.trim(),
    host_skill_id: hostSkillID,
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
    closeBotUserModal();
    await loadData();
  } catch {
    botUserStatus.textContent = t("common.networkErrorRetry");
  } finally {
    botUserSubmitBtn.disabled = false;
  }
});

addBotUserBtn.addEventListener("click", () => {
  resetBotUserForm();
  openBotUserModal("add");
});
botUserModalCloseBtn.addEventListener("click", () => closeBotUserModal());
botUserModal.querySelector<HTMLElement>("[data-close-modal]")?.addEventListener("click", () => closeBotUserModal());

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
    expandedBotId = expandedBotId === bot.id ? null : bot.id;
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
    botUserModelOverrideInput.value = bot.model_override || "";
    botUserConfigSelect.value = String(bot.llm_config_id || "");
    if (bot.bot_kind === "passthrough") {
      botKindPassthroughRadio.checked = true;
      botUserPreferredToolSelect.value = bot.preferred_tool || "";
    } else {
      botKindClassicRadio.checked = true;
    }
    botUserHostSkillSelect.value = bot.host_skill_id ? String(bot.host_skill_id) : "";
    applyBotKindUI();
    botUserSubmitBtn.textContent = t("dashboard.updateBot");
    botUserStatus.textContent = "";
    openBotUserModal("edit");
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

initStoredTheme();
bindThemeSync();

void bootstrap();

populateLLMProviderPresets();
applyLLMProviderPreset(LLM_PROVIDER_PRESETS[0].id, false);
