// invites.ts — admin entry for /invites.html.
//
// Holds the "registration requires invite code" toggle + the
// "generate one-time invite codes" tool. Moved out of the
// dashboard's settings drawer per request — the dashboard is the
// landing page and shouldn't double as the admin console.

import { fetchInviteCodes, fetchSiteSettings, generateInviteCodes, updateSiteSettings } from "./api/dashboard.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { t } from "./lib/i18n.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { InviteCode, SiteSettings } from "./types/dashboard.js";

initStoredTheme();
bindThemeSync();

const toggleInput = byId<HTMLInputElement>("invitesRequiredToggle");
const saveToggleBtn = byId<HTMLButtonElement>("invitesSaveToggleBtn");
const toggleStatus = byId<HTMLElement>("invitesToggleStatus");

const countInput = byId<HTMLInputElement>("invitesGenerateCount");
const generateBtn = byId<HTMLButtonElement>("invitesGenerateBtn");
const generateStatus = byId<HTMLElement>("invitesGenerateStatus");
const codeList = byId<HTMLUListElement>("invitesCodeList");

const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

let currentSite: SiteSettings | null = null;

function renderCodes(codes: InviteCode[]) {
  if (!codeList) return;
  if (!codes.length) {
    codeList.innerHTML = `<li class="tag-item tag-item-empty">${t("dashboard.noInviteCodes")}</li>`;
    return;
  }
  codeList.innerHTML = codes
    .map((item) => {
      const state = item.used_at ? t("dashboard.inviteCodeUsed") : t("dashboard.inviteCodeAvailable");
      const usedBy = item.used_by ? ` · ${item.used_by}` : "";
      const timeText = item.created_at ? new Date(item.created_at).toLocaleString() : "-";
      return `
        <li class="tag-item">
          <div class="tag-item-main">
            <div class="tag-item-header">
              <strong>${item.code}</strong>
              <span class="tag-chip">${state}</span>
            </div>
            <div class="tag-item-meta">${timeText}${usedBy}</div>
          </div>
        </li>`;
    })
    .join("");
}

async function loadToggle() {
  try {
    const { response, data } = await fetchSiteSettings();
    if (!response.ok) return;
    currentSite = data.site || null;
    if (toggleInput) toggleInput.checked = Boolean(data.site?.registration_requires_invite);
  } catch {
    if (toggleStatus) toggleStatus.textContent = t("common.networkErrorRetry");
  }
}

async function loadCodes() {
  if (!codeList) return;
  try {
    const { response, data } = await fetchInviteCodes(40);
    if (!response.ok) {
      if (generateStatus) generateStatus.textContent = data.error || t("dashboard.inviteCodeLoadFailed");
      return;
    }
    renderCodes(data.codes || []);
  } catch {
    if (generateStatus) generateStatus.textContent = t("common.networkErrorRetry");
  }
}

saveToggleBtn?.addEventListener("click", async () => {
  if (!toggleInput) return;
  if (!currentSite) {
    if (toggleStatus) toggleStatus.textContent = t("common.networkErrorRetry");
    return;
  }
  if (toggleStatus) toggleStatus.textContent = t("dashboard.savingSiteInfo");
  saveToggleBtn.disabled = true;
  try {
    // Backend PUT /api/site-settings is a full replacement (not a
    // PATCH), so we have to round-trip name + description + icon
    // from the latest fetched snapshot when toggling this one field.
    const { response, data } = await updateSiteSettings({
      name: currentSite.name,
      description: currentSite.description,
      icon_url: currentSite.icon_url,
      registration_requires_invite: toggleInput.checked,
    });
    if (data.site) currentSite = data.site;
    if (!response.ok) {
      if (toggleStatus) toggleStatus.textContent = data.error || t("common.saveFailed");
      return;
    }
    if (toggleStatus) toggleStatus.textContent = t("dashboard.siteInfoSaved");
  } catch {
    if (toggleStatus) toggleStatus.textContent = t("common.networkErrorRetry");
  } finally {
    saveToggleBtn.disabled = false;
  }
});

generateBtn?.addEventListener("click", async () => {
  if (!countInput) return;
  const count = Math.max(1, Math.min(50, Number(countInput.value || "1")));
  if (generateStatus) generateStatus.textContent = t("dashboard.generatingInviteCode");
  generateBtn.disabled = true;
  try {
    const { response, data } = await generateInviteCodes(count);
    if (!response.ok) {
      if (generateStatus) generateStatus.textContent = data.error || t("dashboard.inviteCodeGenerateFailed");
      return;
    }
    if (generateStatus) {
      generateStatus.textContent = t("dashboard.inviteCodeGenerated", {
        count: String((data.codes || []).length),
      });
    }
    await loadCodes();
  } catch {
    if (generateStatus) generateStatus.textContent = t("common.networkErrorRetry");
  } finally {
    generateBtn.disabled = false;
  }
});

logoutBtn?.addEventListener("click", () => {
  void logout().then(() => {
    window.location.href = "/login.html";
  });
});

async function bootstrap() {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await Promise.all([loadToggle(), loadCodes()]);
}

void bootstrap();
