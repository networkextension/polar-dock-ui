// /llm-config.html — standalone LLM Config bundle.
//
// Extracted from src/bots.ts so the bot-management page and the
// LLM-config page no longer share a 695-line mixed bundle. This
// module owns: provider preset wiring, the LLM-config CRUD modal,
// list rendering, and the test-connection action. The bot-user
// runtime config (passthrough kind, host-skill picker, agent-status
// badges) stays in bots.ts.

import {
  createLLMConfig,
  fetchLLMConfigs,
  removeLLMConfig,
  testLLMConfig,
  updateLLMConfig,
} from "./api/dashboard.js";
import { logout, fetchCurrentUser } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { LLM_PROVIDER_PRESETS, getPresetByID, matchPresetForConfig, resolvePresetEndpoint, resolvePresetExtras, resolvePresetProviderKind } from "./lib/llm_presets.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import { t } from "./lib/i18n.js";
import type { LLMConfig, LLMConfigPayload } from "./types/dashboard.js";

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

const welcomeText = byId<HTMLElement>("welcomeText");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

// ── State ─────────────────────────────────────────────────────────────────────
let editingLLMConfigId: number | null = null;
let pendingDeleteLLMConfigId: number | null = null;
let currentLLMConfigs: LLMConfig[] = [];

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

async function loadData(): Promise<void> {
  const { response, data } = await fetchLLMConfigs();

  if (response.ok) {
    currentLLMConfigs = data.configs || [];
    renderLLMConfigList(currentLLMConfigs);
  } else {
    llmConfigStatus.textContent = data.error || t("dashboard.llmConfigLoadFailed");
    llmConfigList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.llmConfigLoadFailed")}</li>`;
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
