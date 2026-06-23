import {
  blockUser,
  unblockUser,
  upsertRecommendation,
  updateMyProfile,
  changePassword,
  fetchUserProfile,
  followUser,
  unfollowUser,
  fetchFollowers,
  fetchFollowing,
  type UserProfileDetail,
  type UserSummary,
} from "./api/profile.js";
import { uploadUserIcon } from "./api/dashboard.js";
import { fetchCurrentUser, logout, sendEmailVerification } from "./api/session.js";
import { resolveAvatar } from "./lib/avatar.js";
import { byId } from "./lib/dom.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import { t } from "./lib/i18n.js";

const profileWelcome = byId<HTMLElement>("profileWelcome");
const profileCard = byId<HTMLElement>("profileCard");
const profileBioPanel = byId<HTMLElement>("profileBioPanel");
const profileFollowPanel = byId<HTMLElement>("profileFollowPanel");
const profileRecommendationPanel = byId<HTMLElement>("profileRecommendationPanel");

let currentUserId = "";
let currentUserEmail = "";
let currentUserEmailVerified = false;
let profileUserId = "";
let followTab: "followers" | "following" = "followers";
let followCurrentProfile: UserProfileDetail | null = null;

initStoredTheme();
bindThemeSync();

function getUserId(): string | null {
  return new URLSearchParams(window.location.search).get("user_id");
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadCurrentUser(): Promise<void> {
  const { response, data } = await fetchCurrentUser();
  if (!response.ok) {
    window.location.href = "/login.html";
    return;
  }
  currentUserId = data.user_id;
  currentUserEmail = data.email || "";
  currentUserEmailVerified = Boolean(data.email_verified);
  renderSidebarFoot(data);
}

function renderProfileCard(profile: UserProfileDetail): void {
  const avatar = resolveAvatar(profile.username, profile.icon_url, 120);
  const emailLine = profile.is_me && profile.email
    ? `<div class="profile-meta-line profile-email-line"><span class="profile-meta-label">${t("profile.email")}</span><a class="profile-email-link" href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a></div>`
    : "";
  const canMessage = !profile.is_me && !profile.i_blocked_user && !profile.blocked_me;
  const blockMessage = profile.i_blocked_user
    ? t("profile.youBlockedUser")
    : profile.blocked_me
      ? t("profile.userBlockedYou")
      : "";
  const messageAction = canMessage
    ? `<a class="btn-inline btn-secondary" href="/chat.html?user_id=${encodeURIComponent(profile.user_id)}&username=${encodeURIComponent(profile.username)}">${t("profile.sendMessage")}</a>`
    : "";
  const canFollow = !profile.is_me && !profile.i_blocked_user && !profile.blocked_me;
  const followAction = canFollow
    ? `<button id="profileFollowBtn" class="btn-inline ${profile.is_following ? "btn-secondary" : "btn-primary"}" type="button">${profile.is_following ? t("profile.unfollowUser") : t("profile.followUser")}</button>`
    : "";
  const blockAction = !profile.is_me
    ? `<button id="profileBlockBtn" class="btn-inline btn-secondary" type="button">${profile.i_blocked_user ? t("profile.unblockUser") : t("profile.blockUser")}</button>`
    : "";
  const followerCount = profile.follower_count ?? 0;
  const followingCount = profile.following_count ?? 0;
  const followSummary = `
    <div class="profile-meta-line profile-follow-summary">
      <span class="profile-follow-count"><strong>${followerCount}</strong> ${t("profile.followersLabel")}</span>
      <span class="profile-follow-count"><strong>${followingCount}</strong> ${t("profile.followingLabel")}</span>
      ${profile.followed_me ? `<span class="tag-chip">${t("profile.followsYou")}</span>` : ""}
    </div>
  `;
  const statusLine = blockMessage
    ? `<div class="status-text">${escapeHtml(blockMessage)}</div>`
    : "";
  profileCard.innerHTML = `
    <div class="profile-hero">
      <img class="profile-hero-avatar" src="${avatar}" alt="${profile.username}" />
      <div class="profile-hero-body">
        <div class="badge">${profile.is_me ? t("profile.myProfile") : t("profile.userProfile")}</div>
        <h2>${profile.username}</h2>
        ${emailLine}
        <div class="profile-meta-line">${t("profile.userId", { id: profile.user_id })}</div>
        <div class="profile-meta-line">${t("profile.joinedAt", { time: formatTime(profile.created_at) })}</div>
        ${followSummary}
        <div class="task-form-actions">${messageAction}${followAction}${blockAction}</div>
        ${statusLine}
      </div>
    </div>
  `;

  if (profile.is_me) {
    return;
  }
  const followBtn = document.getElementById("profileFollowBtn") as HTMLButtonElement | null;
  followBtn?.addEventListener("click", async () => {
    followBtn.disabled = true;
    const result = profile.is_following
      ? await unfollowUser(profile.user_id)
      : await followUser(profile.user_id);
    if (!result.response.ok || !result.data.profile) {
      profileWelcome.textContent = result.data.error || t("profile.followActionFailed");
      followBtn.disabled = false;
      return;
    }
    profileWelcome.textContent = result.data.message || "";
    const updated = result.data.profile;
    renderProfileCard(updated);
    renderBioPanel(updated);
    renderFollowPanel(updated);
    renderRecommendationPanel(updated);
  });

  const blockBtn = byId<HTMLButtonElement>("profileBlockBtn");
  blockBtn.addEventListener("click", async () => {
    blockBtn.disabled = true;
    const result = profile.i_blocked_user ? await unblockUser(profile.user_id) : await blockUser(profile.user_id);
    if (!result.response.ok || !result.data.profile) {
      profileWelcome.textContent = result.data.error || t("profile.blockActionFailed");
      blockBtn.disabled = false;
      return;
    }
    profileWelcome.textContent = result.data.message || "";
    const updated = result.data.profile;
    renderProfileCard(updated);
    renderBioPanel(updated);
    renderFollowPanel(updated);
    renderRecommendationPanel(updated);
  });
}

function renderFollowUserList(users: UserSummary[]): string {
  if (!users.length) {
    const emptyKey = followTab === "followers" ? "profile.noFollowers" : "profile.noFollowing";
    return `<div class='reply-empty'>${t(emptyKey)}</div>`;
  }
  return users
    .map((user) => {
      const avatar = resolveAvatar(user.username, user.user_icon, 40);
      const bio = user.bio ? `<div class="reply-meta">${escapeHtml(user.bio)}</div>` : "";
      const followBadge = user.is_following ? `<span class="tag-chip">${t("profile.followingLabel")}</span>` : "";
      return `
        <div class="profile-recommendation-item">
          <div class="task-applicant-head">
            <a href="/profile.html?user_id=${encodeURIComponent(user.id)}">
              <img class="avatar-xs" src="${avatar}" alt="${escapeHtml(user.username)}" />
            </a>
            <div>
              <a class="post-author-name" href="/profile.html?user_id=${encodeURIComponent(user.id)}">${escapeHtml(user.username)}</a>
              ${bio}
            </div>
            ${followBadge}
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadFollowList(): Promise<void> {
  if (!followCurrentProfile) {
    return;
  }
  const container = document.getElementById("profileFollowList");
  if (!container) {
    return;
  }
  container.innerHTML = `<div class='reply-empty'>${t("profile.loadingFollowList")}</div>`;
  const targetUserId = followCurrentProfile.user_id;
  const fetcher = followTab === "followers" ? fetchFollowers : fetchFollowing;
  const { response, data } = await fetcher(targetUserId, 30, 0);
  if (!response.ok) {
    container.innerHTML = `<div class='reply-empty'>${t("profile.followListLoadFailed")}</div>`;
    return;
  }
  container.innerHTML = renderFollowUserList(data.users || []);
}

function renderFollowPanel(profile: UserProfileDetail): void {
  followCurrentProfile = profile;
  const followerCount = profile.follower_count ?? 0;
  const followingCount = profile.following_count ?? 0;
  profileFollowPanel.innerHTML = `
    <div class="badge">${t("profile.followSection")}</div>
    <div class="lp-filter-bar" style="margin-top:8px;">
      <button class="btn-inline btn-secondary profile-follow-tab ${followTab === "followers" ? "active" : ""}" data-follow-tab="followers" type="button">${t("profile.tabFollowers", { count: String(followerCount) })}</button>
      <button class="btn-inline btn-secondary profile-follow-tab ${followTab === "following" ? "active" : ""}" data-follow-tab="following" type="button">${t("profile.tabFollowing", { count: String(followingCount) })}</button>
    </div>
    <div id="profileFollowList" class="task-result-list" style="margin-top:8px;"></div>
  `;

  profileFollowPanel.querySelectorAll<HTMLButtonElement>(".profile-follow-tab").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = (btn.dataset.followTab as "followers" | "following") || "followers";
      if (next === followTab) {
        return;
      }
      followTab = next;
      renderFollowPanel(profile);
      await loadFollowList();
    });
  });

  void loadFollowList();
}

function renderBioPanel(profile: UserProfileDetail): void {
  if (profile.is_me) {
    const verificationState = currentUserEmailVerified ? t("profile.emailVerified") : t("profile.emailUnverified");
    const verificationAction = currentUserEmailVerified
      ? ""
      : `<button id="profileSendVerificationBtn" class="btn-inline btn-secondary" type="button">${t("profile.sendVerificationEmail")}</button>`;
    profileBioPanel.innerHTML = `
      <div class="badge">${t("profile.bio")}</div>
      <div class="profile-verification-card">
        <div class="profile-meta-line"><span class="profile-meta-label">${t("profile.email")}</span><span>${escapeHtml(currentUserEmail || t("profile.emailUnavailable"))}</span></div>
        <div class="profile-meta-line"><span class="profile-meta-label">${t("profile.emailVerificationStatus")}</span><span>${verificationState}</span></div>
        <div id="profileEmailVerificationStatus" class="status-text"></div>
        <div class="task-form-actions">
          ${verificationAction}
        </div>
      </div>
      <form id="profileBioForm" class="task-result-form">
        <label class="form-label" for="profileBioInput">${t("profile.personalBio")}</label>
        <textarea id="profileBioInput" class="input textarea" rows="5" maxlength="500" placeholder="${t("profile.bioPlaceholder")}">${escapeHtml(profile.bio || "")}</textarea>
        <label class="form-label" for="profileIndustryInput">行业 / 领域 <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">（可选 — 用于 AI 任务优化时注入领域上下文）</span></label>
        <input id="profileIndustryInput" class="input" type="text" maxlength="80" list="profileIndustryOptions" value="${escapeHtml(profile.industry || "")}" placeholder="例如：iOS 应用开发、量化金融、临床研究、教育科技" />
        <datalist id="profileIndustryOptions">
          <option value="iOS 应用开发"></option>
          <option value="Web 全栈开发"></option>
          <option value="量化金融"></option>
          <option value="医疗 / 临床研究"></option>
          <option value="法律 / 合规"></option>
          <option value="科研 / 数据分析"></option>
          <option value="增长 / 营销运营"></option>
          <option value="教育科技"></option>
        </datalist>
        <label class="form-label" for="profileIconInput">${t("profile.avatar")}</label>
        <input id="profileIconInput" class="input" type="file" accept="image/*" />
        <div id="profileBioStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">${t("profile.saveProfile")}</button>
          <button id="profileBioRefineBtn" class="btn-inline btn-secondary" type="button" title="用 AI 帮我改写">✨ AI 改写</button>
        </div>
      </form>
      <form id="profilePasswordForm" class="task-result-form" style="margin-top:18px;">
        <div class="badge">修改密码</div>
        <label class="form-label" for="pwOld">当前密码</label>
        <input id="pwOld" class="input" type="password" autocomplete="current-password" />
        <label class="form-label" for="pwNew">新密码 <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">（至少 6 位）</span></label>
        <input id="pwNew" class="input" type="password" autocomplete="new-password" minlength="6" />
        <label class="form-label" for="pwNew2">确认新密码</label>
        <input id="pwNew2" class="input" type="password" autocomplete="new-password" minlength="6" />
        <div id="pwStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">更新密码</button>
        </div>
      </form>
    `;

    const pwForm = byId<HTMLFormElement>("profilePasswordForm");
    const pwStatus = byId<HTMLElement>("pwStatus");
    pwForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const oldp = byId<HTMLInputElement>("pwOld").value;
      const newp = byId<HTMLInputElement>("pwNew").value;
      const new2 = byId<HTMLInputElement>("pwNew2").value;
      pwStatus.classList.remove("status-success", "status-error");
      if (newp.length < 6) { pwStatus.textContent = "新密码至少 6 位"; pwStatus.classList.add("status-error"); return; }
      if (newp !== new2) { pwStatus.textContent = "两次新密码不一致"; pwStatus.classList.add("status-error"); return; }
      if (oldp === newp) { pwStatus.textContent = "新密码不能与当前密码相同"; pwStatus.classList.add("status-error"); return; }
      pwStatus.textContent = "更新中…";
      const { response, data } = await changePassword(oldp, newp);
      if (!response.ok) {
        pwStatus.textContent = response.status === 401 ? "当前密码不正确" : (data?.error || "更新失败");
        pwStatus.classList.add("status-error");
        return;
      }
      pwForm.reset();
      pwStatus.textContent = data?.message || "密码已更新 ✓";
      pwStatus.classList.add("status-success");
    });

    const form = byId<HTMLFormElement>("profileBioForm");
    const bioInput = byId<HTMLTextAreaElement>("profileBioInput");
    const iconInput = byId<HTMLInputElement>("profileIconInput");
    const status = byId<HTMLElement>("profileBioStatus");
    const verificationStatus = byId<HTMLElement>("profileEmailVerificationStatus");
    const verificationBtn = document.getElementById("profileSendVerificationBtn") as HTMLButtonElement | null;
    const refineBtn = document.getElementById("profileBioRefineBtn") as HTMLButtonElement | null;
    refineBtn?.addEventListener("click", () => {
      openBioRefineModal(bioInput);
    });

    verificationBtn?.addEventListener("click", async () => {
      verificationBtn.disabled = true;
      verificationStatus.textContent = t("profile.sendingVerificationEmail");
      const { response, data } = await sendEmailVerification();
      if (!response.ok) {
        verificationStatus.textContent = data.error || t("profile.emailVerificationSendFailed");
        verificationStatus.classList.remove("status-success");
        verificationStatus.classList.add("status-error");
        verificationBtn.disabled = false;
        return;
      }
      const me = await fetchCurrentUser();
      if (me.response.ok) {
        currentUserEmail = me.data.email || currentUserEmail;
        currentUserEmailVerified = Boolean(me.data.email_verified);
      }
      verificationStatus.textContent = data.message || t("profile.verificationEmailSent");
      verificationStatus.classList.remove("status-error");
      verificationStatus.classList.add("status-success");
      await loadProfile();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = t("profile.saving");
      const industryInput = document.getElementById("profileIndustryInput") as HTMLInputElement | null;
      const industry = industryInput?.value.trim() ?? undefined;
      const { response, data } = await updateMyProfile(bioInput.value.trim(), industry);
      if (!response.ok) {
        status.textContent = data.error || t("profile.saveFailed");
        return;
      }

      const iconFile = iconInput.files?.[0];
      if (iconFile) {
        const formData = new FormData();
        formData.append("icon", iconFile);
        const { response: iconResponse, data: iconData } = await uploadUserIcon(formData);
        if (!iconResponse.ok) {
          status.textContent = iconData.error || t("profile.avatarUploadFailed");
          return;
        }
      }
      status.textContent = t("profile.profileUpdated");
      await loadProfile();
    });
    return;
  }

  profileBioPanel.innerHTML = `
    <div class="badge">${t("profile.bio")}</div>
    <div class="profile-bio-copy">${profile.bio ? escapeHtml(profile.bio) : t("profile.noBio")}</div>
  `;
}

function renderRecommendationPanel(profile: UserProfileDetail): void {
  const recommendations = profile.recommendations || [];
  const formHtml = profile.can_recommend
    && !profile.i_blocked_user
    && !profile.blocked_me
    ? `
      <form id="recommendationForm" class="task-result-form">
        <label class="form-label" for="recommendationInput">${t("profile.writeRecommendation")}</label>
        <textarea id="recommendationInput" class="input textarea" rows="4" maxlength="1000" placeholder="${t("profile.recommendationPlaceholder")}"></textarea>
        <div id="recommendationStatus" class="status-text"></div>
        <div class="task-form-actions">
          <button class="btn-inline btn-secondary" type="submit">${t("profile.submitRecommendation")}</button>
        </div>
      </form>
    `
    : "";

  const listHtml = recommendations.length
    ? recommendations
        .map((item) => {
          const avatar = resolveAvatar(item.author_username, item.author_user_icon, 40);
          return `
            <div class="profile-recommendation-item">
              <div class="task-applicant-head">
                <a href="/profile.html?user_id=${encodeURIComponent(item.author_user_id)}">
                  <img class="avatar-xs" src="${avatar}" alt="${item.author_username}" />
                </a>
                <div>
                  <a class="post-author-name" href="/profile.html?user_id=${encodeURIComponent(item.author_user_id)}">${item.author_username}</a>
                  <div class="reply-meta">${formatTime(item.updated_at)}</div>
                </div>
              </div>
              <div class="profile-bio-copy">${escapeHtml(item.content)}</div>
            </div>
          `;
        })
        .join("")
    : `<div class='reply-empty'>${t("profile.noRecommendations")}</div>`;

  profileRecommendationPanel.innerHTML = `
    <div class="badge">${t("profile.recommendation")}</div>
    ${profile.i_blocked_user || profile.blocked_me ? `<div class="status-text">${profile.i_blocked_user ? t("profile.recommendationBlockedByYou") : t("profile.recommendationBlockedByOther")}</div>` : ""}
    ${formHtml}
    <div class="task-result-list">${listHtml}</div>
  `;

  if (!profile.can_recommend || profile.i_blocked_user || profile.blocked_me) {
    return;
  }

  const form = byId<HTMLFormElement>("recommendationForm");
  const input = byId<HTMLTextAreaElement>("recommendationInput");
  const status = byId<HTMLElement>("recommendationStatus");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content) {
      status.textContent = t("profile.recommendationRequired");
      return;
    }
    status.textContent = t("profile.submitting");
    const { response, data } = await upsertRecommendation(profile.user_id, content);
    if (!response.ok) {
      status.textContent = data.error || t("profile.submitFailed");
      return;
    }
    status.textContent = t("profile.recommendationSaved");
    input.value = "";
    await loadProfile();
  });
}

async function loadProfile(): Promise<void> {
  const userId = getUserId() || currentUserId;
  profileUserId = userId;
  const { response, data } = await fetchUserProfile(userId);
  if (!response.ok || !data.profile) {
    profileWelcome.textContent = data.error || t("profile.loadFailed");
    return;
  }

  const profile = data.profile;
  profileWelcome.textContent = profile.is_me
    ? t("profile.completeProfile")
    : t("profile.viewingProfile", { username: profile.username });
  renderProfileCard(profile);
  renderBioPanel(profile);
  renderFollowPanel(profile);
  renderRecommendationPanel(profile);
}

async function init(): Promise<void> {
  await hydrateSiteBrand();
  await loadCurrentUser();
  await loadProfile();
}

void init();

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try { await logout(); } finally { window.location.replace("/login.html"); }
});

// ── system_agent capability A: bio refine modal ─────────────────
//
// Owns the "AI 改写自我介绍" modal. Reads the current bio textarea,
// fires POST /api/system-agent/bio/refine, renders 2-3 candidate
// cards. Clicking 采用 writes the chosen draft into the bio
// textarea — the user still has to hit "保存个人资料" to persist
// (intentional: avoid surprise writes; reuse the existing audit/
// validation path on update).

const HINT_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "more_professional", label: "更专业" },
  { key: "more_concise", label: "更简短" },
  { key: "more_structured", label: "更结构化" },
  { key: "add_industry_keywords", label: "加上行业关键词" },
  { key: "warmer", label: "更亲切口语" },
];

let activeBioInput: HTMLTextAreaElement | null = null;
const selectedHints = new Set<string>();

function setBioRefineModalOpen(open: boolean): void {
  const modal = document.getElementById("bioRefineModal");
  if (!modal) return;
  modal.classList.toggle("open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function openBioRefineModal(bioInput: HTMLTextAreaElement): void {
  activeBioInput = bioInput;
  selectedHints.clear();
  // Render the chips fresh each open (state is local to the modal).
  const chipHost = document.getElementById("bioRefineHints");
  if (chipHost) {
    chipHost.innerHTML = HINT_OPTIONS.map(
      (o) => `<button type="button" class="btn-chip" data-hint="${o.key}">${o.label}</button>`,
    ).join("");
    chipHost.querySelectorAll<HTMLButtonElement>("[data-hint]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.dataset.hint!;
        if (selectedHints.has(k)) {
          selectedHints.delete(k);
          btn.classList.remove("is-active");
        } else {
          selectedHints.add(k);
          btn.classList.add("is-active");
        }
      });
    });
  }
  const currentEl = document.getElementById("bioRefineCurrent");
  if (currentEl) {
    currentEl.textContent = bioInput.value.trim() || "（空 — 系统会建议先写个初稿）";
  }
  const extraEl = document.getElementById("bioRefineExtra") as HTMLTextAreaElement | null;
  if (extraEl) extraEl.value = "";
  const resultsEl = document.getElementById("bioRefineResults");
  if (resultsEl) resultsEl.innerHTML = "";
  const notesEl = document.getElementById("bioRefineNotes");
  if (notesEl) notesEl.textContent = "";
  const statusEl = document.getElementById("bioRefineStatus");
  if (statusEl) statusEl.textContent = "";
  setBioRefineModalOpen(true);
}

document.getElementById("bioRefineCloseBtn")?.addEventListener("click", () => {
  setBioRefineModalOpen(false);
});
document
  .querySelector("#bioRefineModal .modal-backdrop")
  ?.addEventListener("click", () => setBioRefineModalOpen(false));

document.getElementById("bioRefineRunBtn")?.addEventListener("click", async () => {
  if (!activeBioInput) return;
  const runBtn = document.getElementById("bioRefineRunBtn") as HTMLButtonElement | null;
  const statusEl = document.getElementById("bioRefineStatus");
  const resultsEl = document.getElementById("bioRefineResults");
  const notesEl = document.getElementById("bioRefineNotes");
  if (runBtn) runBtn.disabled = true;
  if (statusEl) statusEl.textContent = "生成中...";
  if (resultsEl) resultsEl.innerHTML = "";
  if (notesEl) notesEl.textContent = "";
  try {
    const extraEl = document.getElementById("bioRefineExtra") as HTMLTextAreaElement | null;
    const res = await fetch("/api/system-agent/bio/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        current_bio: activeBioInput.value,
        hints: Array.from(selectedHints),
        extra: extraEl?.value ?? "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (statusEl) statusEl.textContent = data?.error || "生成失败";
      return;
    }
    if (statusEl && data.llm) {
      statusEl.textContent = `由 ${data.llm.name}${data.llm.model ? ` · ${data.llm.model}` : ""} 生成`;
    } else if (statusEl) {
      statusEl.textContent = "";
    }
    type Draft = { label: string; text: string; rationale: string };
    const drafts: Draft[] = data.drafts || [];
    if (resultsEl) {
      resultsEl.innerHTML = drafts
        .map(
          (d, i) => `
            <div class="bio-refine-draft">
              <div class="bio-refine-draft-head">
                <span class="bio-refine-draft-label">${escapeHtmlBio(d.label || `候选 ${i + 1}`)}</span>
                <button type="button" class="btn-inline btn-secondary" data-adopt="${i}">采用</button>
              </div>
              <div class="bio-refine-draft-text">${escapeHtmlBio(d.text)}</div>
              ${d.rationale ? `<div class="bio-refine-draft-rationale">调整：${escapeHtmlBio(d.rationale)}</div>` : ""}
            </div>
          `,
        )
        .join("");
      resultsEl.querySelectorAll<HTMLButtonElement>("[data-adopt]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.adopt);
          if (Number.isNaN(idx) || !drafts[idx] || !activeBioInput) return;
          activeBioInput.value = drafts[idx].text;
          activeBioInput.dispatchEvent(new Event("input", { bubbles: true }));
          setBioRefineModalOpen(false);
        });
      });
    }
    if (notesEl && data.notes) {
      notesEl.textContent = data.notes;
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = `生成失败：${(e as Error).message}`;
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
});

function escapeHtmlBio(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

