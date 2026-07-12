import { buildAssetUrl, resolveAvatar } from "./lib/avatar.js";
import { linkifyEscaped } from "./lib/linkify.js";
import { renderMarkdown } from "./lib/marked.js";
import { createMarkdownEditor, type MarkdownEditor } from "./lib/rich-editor.js";
import { PolarFigure, PolarGallery, setupDirectiveMarkdownIt } from "./lib/blocks/directive-nodes.js";
import { formatAssistUsageBadge } from "./lib/assist_usage.js";
import { byId, query } from "./lib/dom.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import {
  assistPostWithBot,
  assistReplyWithBot,
  fetchAvailableLLMConfigs,
  fetchBotUsers,
  fetchTags,
} from "./api/dashboard.js";
import type { BotUser, LLMConfig } from "./types/dashboard.js";
import { t } from "./lib/i18n.js";
import { logout } from "./api/session.js";
import { request } from "./api/http.js";

const postWelcome = byId<HTMLElement>("postWelcome");
const postDetail = byId<HTMLElement>("postDetail");
const postForm = byId<HTMLFormElement>("postForm");
const postContent = byId<HTMLTextAreaElement>("postContent");
const postType = byId<HTMLSelectElement>("postType");
const postTag = byId<HTMLSelectElement>("postTag");
const taskFields = byId<HTMLElement>("taskFields");
const taskLocation = byId<HTMLInputElement>("taskLocation");
const taskStartAt = byId<HTMLInputElement>("taskStartAt");
const taskEndAt = byId<HTMLInputElement>("taskEndAt");
const workingHours = byId<HTMLInputElement>("workingHours");
const applyDeadline = byId<HTMLInputElement>("applyDeadline");
const postImages = byId<HTMLInputElement>("postImages");
const postVideos = byId<HTMLInputElement>("postVideos");
const postAttachments = byId<HTMLInputElement>("postAttachments");
const postAttachmentChips = byId<HTMLElement>("postAttachmentChips");
const postFormStatus = byId<HTMLElement>("postFormStatus");
const postSubmitBtn = byId<HTMLButtonElement>("postSubmitBtn");
const postAssistBotSelect = byId<HTMLSelectElement>("postAssistBot");
const postAssistLLMSelect = byId<HTMLSelectElement>("postAssistLLM");
const postAssistTopicInput = byId<HTMLInputElement>("postAssistTopic");
const postAssistInstructionInput = byId<HTMLInputElement>("postAssistInstruction");
const postAssistStatus = byId<HTMLElement>("postAssistStatus");
const postAssistPreview = byId<HTMLElement>("postAssistPreview");
const postAssistRunBtn = byId<HTMLButtonElement>("postAssistRunBtn");
const postAssistApplyBtn = byId<HTMLButtonElement>("postAssistApplyBtn");

type VideoItem = {
  url: string;
  poster_url?: string;
};

type ImageItem = {
  original_url: string;
  medium_url?: string;
  small_url?: string;
};

type Reply = {
  username: string;
  user_icon?: string;
  created_at: string;
  content: string;
};

type Post = {
  id: number;
  user_id: string;
  username: string;
  user_icon?: string;
  tag_id?: number | null;
  post_type?: string;
  created_at: string;
  content: string;
  images?: string[];
  image_items?: ImageItem[];
  videos?: string[];
  video_items?: VideoItem[];
  attachments?: PostAttachment[];
  liked_by_me: boolean;
  like_count: number;
  task?: TaskMeta;
};

type PostAttachment = {
  id: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  download_url: string;
};

type Tag = {
  id: number;
  name: string;
};

type TaskMeta = {
  location?: string;
  start_at: string;
  end_at: string;
  working_hours: string;
  apply_deadline: string;
  application_status: string;
  selected_applicant_id?: string;
  selected_applicant_name?: string;
  invitation_template?: string;
  applicant_count?: number;
  applied_by_me?: boolean;
  can_apply?: boolean;
  can_manage?: boolean;
  selected_by_me?: boolean;
  can_view_results?: boolean;
  can_submit_result?: boolean;
};

type TaskApplication = {
  user_id: string;
  username: string;
  user_icon?: string;
  applied_at: string;
};

type TaskResult = {
  id: number;
  user_id: string;
  username: string;
  user_icon?: string;
  note?: string;
  created_at: string;
  images?: string[];
  videos?: string[];
  video_items?: VideoItem[];
};

let currentUserId = "";
let currentUserRole = "user";
let assistBots: BotUser[] = [];
let assistLLMConfigs: LLMConfig[] = [];
let assistBotsLoaded = false;
let postAssistResult = "";
let replyAssistResult = "";
let videoModal: HTMLDivElement | null = null;
let videoModalPlayer: HTMLVideoElement | null = null;
let imageModal: HTMLDivElement | null = null;
let imageModalViewer: HTMLImageElement | null = null;
let imageModalCounter: HTMLDivElement | null = null;
let imageModalPrevBtn: HTMLButtonElement | null = null;
let imageModalNextBtn: HTMLButtonElement | null = null;
let currentImageGallery: string[] = [];
let currentImageIndex = 0;
let currentTags: Tag[] = [];

initStoredTheme();
bindThemeSync();

function getPostId(): string | null {
  return new URLSearchParams(window.location.search).get("id");
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString();
}

function toISOStringFromLocal(value: string): string {
  return new Date(value).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function profileUrl(userId: string): string {
  return `/profile.html?user_id=${encodeURIComponent(userId)}`;
}

function getTagName(tagId?: number | null): string {
  if (!tagId) {
    return "";
  }
  return currentTags.find((item) => item.id === tagId)?.name || "";
}

async function loadAssistOptions(): Promise<void> {
  if (assistBotsLoaded) {
    return;
  }
  try {
    const [botResult, llmResult] = await Promise.all([fetchBotUsers(), fetchAvailableLLMConfigs()]);
    assistBots = botResult.response.ok ? botResult.data.bots || [] : [];
    assistLLMConfigs = llmResult.response.ok ? llmResult.data.configs || [] : [];
  } catch {
    assistBots = [];
    assistLLMConfigs = [];
  }
  assistBotsLoaded = true;
  renderPostAssistOptions();
}

function renderPostAssistOptions(): void {
  if (!assistBots.length) {
    postAssistBotSelect.innerHTML = `<option value="">${t("post.assistNoBot")}</option>`;
    postAssistRunBtn.disabled = true;
  } else {
    postAssistBotSelect.innerHTML = assistBots
      .map((bot) => `<option value="${bot.id}">${bot.name}${bot.config_name ? ` · ${bot.config_name}` : ""}</option>`)
      .join("");
    postAssistRunBtn.disabled = false;
  }
  const llmOptions = assistLLMConfigs
    .map((cfg) => `<option value="${cfg.id}">${cfg.name} · ${cfg.model}</option>`)
    .join("");
  postAssistLLMSelect.innerHTML = `<option value="">${t("post.assistDefaultLLM")}</option>${llmOptions}`;
}

function setupPostAssistPanel(): void {
  const panel = document.getElementById("postAssistPanel") as HTMLDetailsElement | null;
  panel?.addEventListener("toggle", () => {
    if (panel.open) {
      void loadAssistOptions();
    }
  });

  postAssistRunBtn.addEventListener("click", async () => {
    const botId = Number(postAssistBotSelect.value || 0);
    if (botId <= 0) {
      postAssistStatus.textContent = t("post.assistBotRequired");
      return;
    }
    const topic = postAssistTopicInput.value.trim();
    const draft = postContent.value.trim();
    if (!topic && !draft) {
      postAssistStatus.textContent = t("post.assistTopicOrDraftRequired");
      return;
    }
    postAssistRunBtn.disabled = true;
    postAssistApplyBtn.disabled = true;
    postAssistStatus.textContent = t("post.assistRunning");
    try {
      const llmId = Number(postAssistLLMSelect.value || 0);
      const { response, data } = await assistPostWithBot({
        bot_id: botId,
        llm_config_id: llmId > 0 ? llmId : undefined,
        content: draft,
        topic,
        instruction: postAssistInstructionInput.value.trim(),
      });
      if (!response.ok || !data.content) {
        postAssistStatus.textContent = data.error || t("post.assistFailed");
        postAssistPreview.hidden = true;
        postAssistResult = "";
        return;
      }
      postAssistResult = data.content;
      postAssistPreview.textContent = postAssistResult;
      postAssistPreview.hidden = false;
      postAssistApplyBtn.disabled = false;
      const llmLabel = data.llm?.model ? ` · ${data.llm.model}` : "";
      const usageBadge = formatAssistUsageBadge(data.usage);
      postAssistStatus.textContent = `${t("post.assistDone")}${llmLabel}${usageBadge}`;
    } catch {
      postAssistStatus.textContent = t("common.networkError");
    } finally {
      postAssistRunBtn.disabled = assistBots.length === 0;
    }
  });

  postAssistApplyBtn.addEventListener("click", () => {
    if (!postAssistResult) {
      return;
    }
    postContent.value = postAssistResult;
    postEditor?.setMarkdown(postAssistResult);
    postAssistStatus.textContent = t("post.assistApplied");
  });
}

function renderReplyAssistBotOptions(select: HTMLSelectElement, llmSelect: HTMLSelectElement): void {
  if (!assistBots.length) {
    select.innerHTML = `<option value="">${t("post.assistNoBot")}</option>`;
  } else {
    select.innerHTML = assistBots
      .map((bot) => `<option value="${bot.id}">${bot.name}${bot.config_name ? ` · ${bot.config_name}` : ""}</option>`)
      .join("");
  }
  const llmOptions = assistLLMConfigs
    .map((cfg) => `<option value="${cfg.id}">${cfg.name} · ${cfg.model}</option>`)
    .join("");
  llmSelect.innerHTML = `<option value="">${t("post.assistDefaultLLM")}</option>${llmOptions}`;
}

function setupReplyAssist(postId: number, replyInput: HTMLInputElement): void {
  const details = document.getElementById("replyAssistPanel") as HTMLDetailsElement | null;
  if (!details) {
    return;
  }
  const botSelect = document.getElementById("replyAssistBot") as HTMLSelectElement | null;
  const llmSelect = document.getElementById("replyAssistLLM") as HTMLSelectElement | null;
  const instructionInput = document.getElementById("replyAssistInstruction") as HTMLInputElement | null;
  const runBtn = document.getElementById("replyAssistRunBtn") as HTMLButtonElement | null;
  const applyBtn = document.getElementById("replyAssistApplyBtn") as HTMLButtonElement | null;
  const status = document.getElementById("replyAssistStatus") as HTMLElement | null;
  const preview = document.getElementById("replyAssistPreview") as HTMLElement | null;
  if (!botSelect || !llmSelect || !instructionInput || !runBtn || !applyBtn || !status || !preview) {
    return;
  }

  details.addEventListener("toggle", async () => {
    if (!details.open) {
      return;
    }
    await loadAssistOptions();
    renderReplyAssistBotOptions(botSelect, llmSelect);
    runBtn.disabled = assistBots.length === 0;
  });

  runBtn.addEventListener("click", async () => {
    const botId = Number(botSelect.value || 0);
    if (botId <= 0) {
      status.textContent = t("post.assistBotRequired");
      return;
    }
    runBtn.disabled = true;
    applyBtn.disabled = true;
    status.textContent = t("post.assistRunning");
    try {
      const llmId = Number(llmSelect.value || 0);
      const { response, data } = await assistReplyWithBot(postId, {
        bot_id: botId,
        llm_config_id: llmId > 0 ? llmId : undefined,
        content: replyInput.value.trim(),
        instruction: instructionInput.value.trim(),
      });
      if (!response.ok || !data.content) {
        status.textContent = data.error || t("post.assistFailed");
        preview.hidden = true;
        replyAssistResult = "";
        return;
      }
      replyAssistResult = data.content;
      preview.textContent = replyAssistResult;
      preview.hidden = false;
      applyBtn.disabled = false;
      const llmLabel = data.llm?.model ? ` · ${data.llm.model}` : "";
      const usageBadge = formatAssistUsageBadge(data.usage);
      status.textContent = `${t("post.assistDone")}${llmLabel}${usageBadge}`;
    } catch {
      status.textContent = t("common.networkError");
    } finally {
      runBtn.disabled = assistBots.length === 0;
    }
  });

  applyBtn.addEventListener("click", () => {
    if (!replyAssistResult) {
      return;
    }
    replyInput.value = replyAssistResult;
    status.textContent = t("post.assistApplied");
  });
}

async function loadTagOptions(): Promise<void> {
  const { response, data } = await fetchTags();
  if (!response.ok) {
    return;
  }
  currentTags = data.tags || [];
  postTag.innerHTML = [
    `<option value="">${t("post.noSection")}</option>`,
    ...currentTags.map((tag) => `<option value="${tag.id}">${tag.name}</option>`),
  ].join("");
}

function ensureVideoModal(): void {
  if (videoModal) {
    return;
  }

  const modal = document.createElement("div");
  modal.className = "video-modal";
  modal.innerHTML = `
    <div class="video-modal-backdrop"></div>
    <div class="video-modal-content panel">
      <button class="video-modal-close btn-inline btn-secondary" type="button">${t("common.close")}</button>
      <video class="video-modal-player" controls autoplay preload="metadata"></video>
    </div>
  `;
  document.body.appendChild(modal);
  videoModal = modal;
  videoModalPlayer = query<HTMLVideoElement>(modal, ".video-modal-player");

  const close = (): void => {
    if (!videoModal) {
      return;
    }
    videoModal.classList.remove("open");
    if (videoModalPlayer) {
      videoModalPlayer.pause();
      videoModalPlayer.removeAttribute("src");
      videoModalPlayer.load();
    }
  };

  query<HTMLElement>(modal, ".video-modal-backdrop").addEventListener("click", close);
  query<HTMLButtonElement>(modal, ".video-modal-close").addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
    }
  });
}

function openVideoModal(url: string): void {
  if (!url) {
    return;
  }
  ensureVideoModal();
  if (!videoModal || !videoModalPlayer) {
    return;
  }
  videoModalPlayer.src = url;
  videoModal.classList.add("open");
  void videoModalPlayer.play().catch(() => {});
}

function ensureImageModal(): void {
  if (imageModal) {
    return;
  }

  const modal = document.createElement("div");
  modal.className = "image-modal";
  modal.innerHTML = `
    <div class="image-modal-backdrop"></div>
    <div class="image-modal-content">
      <div class="image-modal-toolbar">
        <div class="image-modal-counter">1 / 1</div>
        <button class="image-modal-close btn-inline btn-secondary" type="button">${t("common.close")}</button>
      </div>
      <div class="image-modal-stage">
        <button class="image-modal-nav image-modal-prev btn-inline btn-secondary" type="button" aria-label="${t("post.prevImage")}">${t("post.prevImage")}</button>
        <img class="image-modal-viewer" alt="post image preview" />
        <button class="image-modal-nav image-modal-next btn-inline btn-secondary" type="button" aria-label="${t("post.nextImage")}">${t("post.nextImage")}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  imageModal = modal;
  imageModalViewer = query<HTMLImageElement>(modal, ".image-modal-viewer");
  imageModalCounter = query<HTMLDivElement>(modal, ".image-modal-counter");
  imageModalPrevBtn = query<HTMLButtonElement>(modal, ".image-modal-prev");
  imageModalNextBtn = query<HTMLButtonElement>(modal, ".image-modal-next");

  const close = (): void => {
    if (!imageModal || !imageModalViewer) {
      return;
    }
    imageModal.classList.remove("open");
    imageModalViewer.removeAttribute("src");
    currentImageGallery = [];
    currentImageIndex = 0;
  };

  query<HTMLElement>(modal, ".image-modal-backdrop").addEventListener("click", close);
  query<HTMLButtonElement>(modal, ".image-modal-close").addEventListener("click", close);
  imageModalPrevBtn.addEventListener("click", () => stepImageModal(-1));
  imageModalNextBtn.addEventListener("click", () => stepImageModal(1));

  document.addEventListener("keydown", (event) => {
    if (!imageModal?.classList.contains("open")) {
      return;
    }
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepImageModal(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      stepImageModal(1);
    }
  });
}

function renderImageModal(): void {
  if (!imageModal || !imageModalViewer || !imageModalCounter || !imageModalPrevBtn || !imageModalNextBtn) {
    return;
  }
  if (!currentImageGallery.length) {
    imageModal.classList.remove("open");
    return;
  }

  currentImageIndex = (currentImageIndex + currentImageGallery.length) % currentImageGallery.length;
  imageModalViewer.src = currentImageGallery[currentImageIndex];
  imageModalCounter.textContent = `${currentImageIndex + 1} / ${currentImageGallery.length}`;

  const multiple = currentImageGallery.length > 1;
  imageModalPrevBtn.disabled = !multiple;
  imageModalNextBtn.disabled = !multiple;
}

function openImageModal(images: string[], index: number): void {
  if (!images.length) {
    return;
  }
  ensureImageModal();
  if (!imageModal) {
    return;
  }
  currentImageGallery = images;
  currentImageIndex = index;
  renderImageModal();
  imageModal.classList.add("open");
}

function stepImageModal(step: number): void {
  if (!currentImageGallery.length) {
    return;
  }
  currentImageIndex += step;
  renderImageModal();
}

function normalizeVideoItems(post: Post): Array<{ url: string; posterUrl: string }> {
  if (Array.isArray(post.video_items) && post.video_items.length > 0) {
    return post.video_items
      .filter((item) => item && item.url)
      .map((item) => ({
        url: buildAssetUrl(item.url),
        posterUrl: item.poster_url ? buildAssetUrl(item.poster_url) : "",
      }));
  }
  return (post.videos || []).map((url) => ({
    url: buildAssetUrl(url),
    posterUrl: "",
  }));
}

function normalizePostImages(post: Post, variant: "small" | "medium" | "original"): string[] {
  if (Array.isArray(post.image_items) && post.image_items.length > 0) {
    return post.image_items
      .filter((item) => item && (item.original_url || item.medium_url || item.small_url))
      .map((item) => {
        if (variant === "small") {
          return buildAssetUrl(item.small_url || item.medium_url || item.original_url);
        }
        if (variant === "medium") {
          return buildAssetUrl(item.medium_url || item.original_url || item.small_url);
        }
        return buildAssetUrl(item.original_url || item.medium_url || item.small_url);
      });
  }
  return (post.images || []).map((url) => buildAssetUrl(url));
}

function enhancePostVideos(container: ParentNode): void {
  container.querySelectorAll<HTMLVideoElement>(".post-videos video").forEach((videoEl) => {
    videoEl.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const source = videoEl.querySelector<HTMLSourceElement>("source");
      const src = videoEl.currentSrc || source?.src || "";
      videoEl.pause();
      openVideoModal(src);
    });
  });
}

function enhancePostImages(container: ParentNode, images: string[]): void {
  container.querySelectorAll<HTMLImageElement>(".post-images img").forEach((imageEl, index) => {
    imageEl.addEventListener("click", () => {
      openImageModal(images, index);
    });
  });
  enhanceInlineImages(container);
}

// enhanceInlineImages gives block-editor figures/galleries rendered INSIDE
// the markdown body the same click-to-zoom as the trailing image grid.
function enhanceInlineImages(container: ParentNode): void {
  const inline = Array.from(container.querySelectorAll<HTMLImageElement>(".post-content img"));
  if (inline.length === 0) return;
  const gallery = inline.map((el) => el.src);
  inline.forEach((imageEl, index) => {
    imageEl.style.cursor = "zoom-in";
    imageEl.addEventListener("click", (event) => {
      event.stopPropagation();
      openImageModal(gallery, index);
    });
  });
}

async function loadProfile(): Promise<void> {
  const res = await request(`/api/me`);
  if (!res.ok) {
    window.location.href = "/login.html";
    return;
  }
  const data = await res.json();
  currentUserId = data.user_id;
  currentUserRole = data.role || "user";
  postWelcome.textContent = t("post.welcome", { username: data.username });
  renderSidebarFoot(data);
}

async function loadReplies(postId: number): Promise<void> {
  const replyList = document.getElementById("replyList");
  if (!replyList) {
    return;
  }

  replyList.innerHTML = `<div class='reply-empty'>${t("post.loadingReplies")}</div>`;
  const res = await request(`/api/posts/${postId}/replies?limit=50`);
  if (!res.ok) {
    replyList.innerHTML = `<div class='reply-empty'>${t("post.repliesLoadFailed")}</div>`;
    return;
  }

  const data = await res.json();
  const replies: Reply[] = data.replies || [];
  if (replies.length === 0) {
    replyList.innerHTML = `<div class='reply-empty'>${t("post.noReplies")}</div>`;
    return;
  }

  replyList.innerHTML = replies
    .map((reply) => {
      const avatar = resolveAvatar(reply.username, reply.user_icon, 48);
      return `
        <div class="reply-item">
          <img class="avatar-xs" src="${avatar}" alt="${reply.username}" />
          <div class="reply-body">
            <div class="reply-meta">${reply.username} · ${formatTime(reply.created_at)}</div>
            <div class="reply-content">${linkifyEscaped(reply.content)}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPost(post: Post): void {
  const postImagePreviews = normalizePostImages(post, "medium");
  const postImageOriginals = normalizePostImages(post, "original");
  const images = postImagePreviews
    .map((url) => `<img src="${url}" alt="post image" loading="lazy" />`)
    .join("");
  const videos = normalizeVideoItems(post)
    .map(
      (item) => `
        <video controls preload="metadata" ${item.posterUrl ? `poster="${item.posterUrl}"` : ""}>
          <source src="${item.url}" />
          ${t("post.videoNotSupported")}
        </video>
      `
    )
    .join("");
  const videoSection = videos ? `<div class="post-videos">${videos}</div>` : "";

  const isSelf = currentUserId && post.user_id === currentUserId;
  const canDelete = currentUserRole === "admin" || isSelf;
  const isTask = post.post_type === "task" && post.task;
  const authorLabel = `<a class="post-author-name" href="${profileUrl(post.user_id)}">${post.username}</a>`;

  const avatar = resolveAvatar(post.username, post.user_icon, 64);
  const taskInfo = isTask
    ? `
      <div class="task-meta-card">
        <div class="badge">${t("post.gigTaskBadge")}</div>
        <div class="task-meta-grid">
          <div><strong>${t("post.timeRange")}</strong>${formatTime(post.task!.start_at)} - ${formatTime(post.task!.end_at)}</div>
          <div><strong>${t("post.workingHoursLabel")}</strong>${escapeHtml(post.task!.working_hours)}</div>
          <div><strong>${t("post.applyDeadline")}</strong>${formatTime(post.task!.apply_deadline)}</div>
          <div><strong>${t("post.location")}</strong>${escapeHtml(post.task!.location || t("post.noLocation"))}</div>
          <div><strong>${t("post.status")}</strong>${post.task!.application_status === "open" ? t("post.statusOpen") : t("post.statusClosed")}</div>
          <div><strong>${t("post.applicantCount")}</strong>${post.task!.applicant_count || 0}</div>
          ${
            post.task!.selected_applicant_name
              ? `<div><strong>${t("post.selectedApplicant")}</strong>${escapeHtml(post.task!.selected_applicant_name)}</div>`
              : ""
          }
        </div>
      </div>
    `
    : "";
  const tagName = getTagName(post.tag_id);
  const tagInfo = tagName ? `<div class="tag-chip">${tagName}</div>` : "";
  const taskActions = isTask
    ? `
      <div class="task-actions">
        ${
          post.task!.can_apply
            ? `<button id="taskApplyBtn" class="btn-inline btn-secondary" type="button">${post.task!.applied_by_me ? t("post.withdrawApplication") : t("post.applyTask")}</button>`
            : ""
        }
        ${
          post.task!.can_manage && post.task!.application_status === "open"
            ? `<button id="taskCloseBtn" class="btn-inline btn-secondary" type="button">${t("post.closeApplications")}</button>
               <button id="taskLoadApplicantsBtn" class="btn-inline btn-secondary" type="button">${t("post.viewApplicants")}</button>`
            : ""
        }
      </div>
      <div id="taskApplicantsPanel" class="task-applicants-panel"></div>
    `
    : "";
  const taskResultSection = isTask && post.task!.can_view_results
    ? `
      <div class="task-results-card">
        <div class="badge">${t("post.taskResults")}</div>
        ${
          post.task!.can_submit_result
            ? `
              <form id="taskResultForm" class="task-result-form">
                <label class="form-label" for="taskResultNote">${t("post.resultDescription")}</label>
                <textarea id="taskResultNote" class="input textarea" rows="3" placeholder="${t("post.resultDescriptionPlaceholder")}"></textarea>
                <label class="form-label" for="taskResultImages">${t("post.resultImages")}</label>
                <input id="taskResultImages" class="input" type="file" accept="image/*" multiple />
                <label class="form-label" for="taskResultVideos">${t("post.resultVideos")}</label>
                <input id="taskResultVideos" class="input" type="file" accept="video/*" multiple />
                <div id="taskResultStatus" class="status-text"></div>
                <div class="task-form-actions">
                  <button id="taskResultSubmitBtn" class="btn-inline btn-secondary" type="submit">${t("post.submitResult")}</button>
                </div>
              </form>
            `
            : ""
        }
        <div id="taskResultList" class="task-result-list"></div>
      </div>
    `
    : "";

  postDetail.innerHTML = `
    <div class="post-header">
      <div class="post-author">
        <a href="${profileUrl(post.user_id)}"><img class="avatar-sm" src="${avatar}" alt="${post.username}" /></a>
        ${authorLabel}
      </div>
      <div class="post-time">${formatTime(post.created_at)}</div>
    </div>
    <div class="post-content md-body">${renderMarkdown(post.content)}</div>
    ${tagInfo}
    ${taskInfo}
    <div class="post-images">${images}</div>
    ${videoSection}
    ${renderPostAttachmentsList(post.attachments)}
    <div class="post-actions">
      <button id="detailLikeBtn" class="btn-inline btn-secondary" type="button">
        ${post.liked_by_me ? t("post.liked") : t("post.like")} · ${post.like_count}
      </button>
      ${canDelete ? `<button id="detailDeleteBtn" class="btn-inline btn-secondary" type="button">${t("post.deletePost")}</button>` : ""}
    </div>
    ${taskActions}
    ${taskResultSection}
    <div class="reply-box open">
      <div class="reply-list" id="replyList"></div>
      <form id="replyForm" class="reply-form">
        <input id="replyInput" class="input reply-input" type="text" placeholder="${t("post.replyPlaceholder")}" required />
        <button class="btn-inline btn-secondary" type="submit">${t("post.sendReply")}</button>
      </form>
      <details id="replyAssistPanel" class="post-assist-panel">
        <summary class="post-assist-summary">${t("post.replyAssistToggle")}</summary>
        <div class="post-assist-body">
          <label class="form-label" for="replyAssistBot">${t("post.assistBot")}</label>
          <select id="replyAssistBot" class="input"></select>
          <label class="form-label" for="replyAssistLLM">${t("post.assistLLM")}</label>
          <select id="replyAssistLLM" class="input"></select>
          <label class="form-label" for="replyAssistInstruction">${t("post.assistInstruction")}</label>
          <input id="replyAssistInstruction" class="input" type="text" placeholder="${t("post.assistInstructionPlaceholder")}" />
          <div id="replyAssistStatus" class="status-text"></div>
          <div id="replyAssistPreview" class="post-assist-preview" hidden></div>
          <div class="task-form-actions">
            <button id="replyAssistRunBtn" class="btn-inline btn-secondary" type="button">${t("post.replyAssistRun")}</button>
            <button id="replyAssistApplyBtn" class="btn-inline btn-secondary" type="button" disabled>${t("post.replyAssistApply")}</button>
          </div>
        </div>
      </details>
    </div>
  `;

  const likeBtn = byId<HTMLButtonElement>("detailLikeBtn");
  const deleteBtn = document.getElementById("detailDeleteBtn") as HTMLButtonElement | null;
  enhancePostVideos(postDetail);
  enhancePostImages(postDetail, postImageOriginals);

  likeBtn.addEventListener("click", async () => {
    const method = post.liked_by_me ? "DELETE" : "POST";
    const res = await request(`/api/posts/${post.id}/like`, {
      method,
    });
    if (!res.ok) {
      return;
    }
    post.liked_by_me = !post.liked_by_me;
    post.like_count += post.liked_by_me ? 1 : -1;
    likeBtn.textContent = `${post.liked_by_me ? t("post.liked") : t("post.like")} · ${post.like_count}`;
  });

  deleteBtn?.addEventListener("click", async () => {
    if (!window.confirm(t("post.confirmDelete"))) {
      return;
    }
    deleteBtn.disabled = true;
    const res = await request(`/api/posts/${post.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      deleteBtn.disabled = false;
      return;
    }
    window.location.href = "/posts.html";
  });

  const replyForm = byId<HTMLFormElement>("replyForm");
  const replyInput = byId<HTMLInputElement>("replyInput");
  replyAssistResult = "";
  setupReplyAssist(post.id, replyInput);
  const taskApplyBtn = document.getElementById("taskApplyBtn") as HTMLButtonElement | null;
  const taskCloseBtn = document.getElementById("taskCloseBtn") as HTMLButtonElement | null;
  const taskLoadApplicantsBtn = document.getElementById("taskLoadApplicantsBtn") as HTMLButtonElement | null;
  const taskApplicantsPanel = document.getElementById("taskApplicantsPanel") as HTMLElement | null;
  const taskResultForm = document.getElementById("taskResultForm") as HTMLFormElement | null;
  const taskResultNote = document.getElementById("taskResultNote") as HTMLTextAreaElement | null;
  const taskResultImages = document.getElementById("taskResultImages") as HTMLInputElement | null;
  const taskResultVideos = document.getElementById("taskResultVideos") as HTMLInputElement | null;
  const taskResultStatus = document.getElementById("taskResultStatus") as HTMLElement | null;
  const taskResultSubmitBtn = document.getElementById("taskResultSubmitBtn") as HTMLButtonElement | null;

  replyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = replyInput.value.trim();
    if (!content) {
      return;
    }
    const res = await request(`/api/posts/${post.id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      return;
    }
    replyInput.value = "";
    await loadReplies(post.id);
  });

  taskApplyBtn?.addEventListener("click", async () => {
    const method = post.task?.applied_by_me ? "DELETE" : "POST";
    const res = await request(`/api/tasks/${post.id}/apply`, {
      method,
    });
    if (!res.ok) {
      return;
    }
    await loadPost();
  });

  taskCloseBtn?.addEventListener("click", async () => {
    const res = await request(`/api/tasks/${post.id}/close`, {
      method: "POST",
    });
    if (!res.ok) {
      return;
    }
    await loadPost();
  });

  taskLoadApplicantsBtn?.addEventListener("click", async () => {
    if (!taskApplicantsPanel) {
      return;
    }
    taskApplicantsPanel.innerHTML = `<div class='reply-empty'>${t("post.loadingApplicants")}</div>`;
    const res = await request(`/api/tasks/${post.id}/applications`);
    if (!res.ok) {
      taskApplicantsPanel.innerHTML = `<div class='reply-empty'>${t("post.applicantsLoadFailed")}</div>`;
      return;
    }
    const data = await res.json();
    const applications: TaskApplication[] = data.applications || [];
    if (!applications.length) {
      taskApplicantsPanel.innerHTML = `<div class='reply-empty'>${t("post.noApplicants")}</div>`;
      return;
    }
    taskApplicantsPanel.innerHTML = applications
      .map((item) => {
        const avatarUrl = resolveAvatar(item.username, item.user_icon, 40);
        const defaultTemplate = post.task?.invitation_template
          || t("post.invitationDefault", { content: post.content });
        return `
          <div class="task-applicant-item">
            <div class="task-applicant-head">
              <a href="${profileUrl(item.user_id)}"><img class="avatar-xs" src="${avatarUrl}" alt="${item.username}" /></a>
              <div>
                <div class="reply-meta"><a class="post-author-name" href="${profileUrl(item.user_id)}">${item.username}</a> · ${formatTime(item.applied_at)}</div>
                <div class="task-applicant-id">${item.user_id}</div>
              </div>
            </div>
            <textarea class="input textarea task-template-input" data-user-id="${item.user_id}" rows="4">${escapeHtml(defaultTemplate)}</textarea>
            <button class="btn-inline btn-secondary task-select-btn" data-user-id="${item.user_id}" type="button">${t("post.confirmAndMessage")}</button>
          </div>
        `;
      })
      .join("");

    taskApplicantsPanel.querySelectorAll<HTMLButtonElement>(".task-select-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const applicantUserId = button.dataset.userId;
        if (!applicantUserId) {
          return;
        }
        const textarea = taskApplicantsPanel.querySelector<HTMLTextAreaElement>(
          `.task-template-input[data-user-id="${applicantUserId}"]`
        );
        const messageTemplate = textarea?.value.trim() || "";
        button.disabled = true;
        const selectRes = await request(`/api/tasks/${post.id}/select-candidate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicant_user_id: applicantUserId,
            message_template: messageTemplate,
          }),
        });
        if (!selectRes.ok) {
          button.disabled = false;
          return;
        }
        await loadPost();
      });
    });
  });

  taskResultForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!taskResultStatus || !taskResultSubmitBtn || !taskResultImages || !taskResultVideos) {
      return;
    }
    const formData = new FormData();
    const note = taskResultNote?.value.trim() || "";
    if (note) {
      formData.append("note", note);
    }
    Array.from(taskResultImages.files || []).forEach((file) => formData.append("images", file));
    Array.from(taskResultVideos.files || []).forEach((file) => formData.append("videos", file));
    taskResultStatus.textContent = t("post.submittingResult");
    taskResultSubmitBtn.disabled = true;
    const res = await request(`/api/tasks/${post.id}/results`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      taskResultStatus.textContent = data.error || t("common.submitFailed");
      taskResultSubmitBtn.disabled = false;
      return;
    }
    taskResultStatus.textContent = t("post.resultSubmitted");
    taskResultForm.reset();
    taskResultSubmitBtn.disabled = false;
    await loadTaskResults(post.id);
  });

  if (post.task?.can_view_results) {
    void loadTaskResults(post.id);
  }
}

async function loadTaskResults(postId: number): Promise<void> {
  const container = document.getElementById("taskResultList");
  if (!container) {
    return;
  }
  container.innerHTML = `<div class='reply-empty'>${t("post.loadingResults")}</div>`;
  const res = await request(`/api/tasks/${postId}/results`);
  if (!res.ok) {
    container.innerHTML = `<div class='reply-empty'>${t("post.resultsLoadFailed")}</div>`;
    return;
  }
  const data = await res.json();
  const results: TaskResult[] = data.results || [];
  if (!results.length) {
    container.innerHTML = `<div class='reply-empty'>${t("post.noResults")}</div>`;
    return;
  }
  container.innerHTML = results
    .map((result) => {
      const avatar = resolveAvatar(result.username, result.user_icon, 40);
      const images = (result.images || [])
        .map((url) => `<img src="${buildAssetUrl(url)}" alt="task result image" />`)
        .join("");
      const videos = (result.video_items || [])
        .map((item) => {
          const videoUrl = buildAssetUrl(item.url);
          const posterUrl = item.poster_url ? buildAssetUrl(item.poster_url) : "";
          return `
            <video controls preload="metadata" ${posterUrl ? `poster="${posterUrl}"` : ""}>
              <source src="${videoUrl}" />
              ${t("post.videoNotSupported")}
            </video>
          `;
        })
        .join("");
      return `
        <div class="task-result-item">
          <div class="task-applicant-head">
            <a href="${profileUrl(result.user_id)}"><img class="avatar-xs" src="${avatar}" alt="${result.username}" /></a>
            <div class="reply-meta"><a class="post-author-name" href="${profileUrl(result.user_id)}">${result.username}</a> · ${formatTime(result.created_at)}</div>
          </div>
          ${result.note ? `<div class="post-content">${linkifyEscaped(result.note)}</div>` : ""}
          ${images ? `<div class="post-images">${images}</div>` : ""}
          ${videos ? `<div class="post-videos">${videos}</div>` : ""}
        </div>
      `;
    })
    .join("");
  enhancePostVideos(container);
}

async function loadPost(): Promise<void> {
  const postId = getPostId();
  if (!postId) {
    postDetail.innerHTML = `<div class='post-empty'>${t("post.invalidPost")}</div>`;
    return;
  }

  const res = await request(`/api/posts/${postId}`);
  if (!res.ok) {
    postDetail.innerHTML = `<div class='post-empty'>${t("post.loadFailed")}</div>`;
    return;
  }

  const data = await res.json();
  const post: Post | null = data.post || null;
  if (!post) {
    postDetail.innerHTML = `<div class='post-empty'>${t("post.notFound")}</div>`;
    return;
  }

  renderPost(post);
  await loadReplies(post.id);
}

function syncTaskFields(): void {
  const enabled = postType.value === "task";
  taskFields.hidden = !enabled;
  taskStartAt.required = enabled;
  taskEndAt.required = enabled;
  workingHours.required = enabled;
  applyDeadline.required = enabled;
}

postType.addEventListener("change", syncTaskFields);

// ── Attachments (zip / pdf / doc / docx / ppt / pptx) ──────────────
//
// Files selected via the postAttachments input get uploaded
// immediately to /api/attachments. The returned IDs are buffered
// in pendingAttachmentIDs and submitted alongside the post create
// form. Chips render below the input with a remove button (which
// just drops the local reference; the row stays — author can
// soft-delete via DELETE /api/attachments/:id later if they
// really want to).

type PendingAttachment = {
  id: string;
  filename: string;
  size: number;
};

const pendingAttachments: PendingAttachment[] = [];

function renderAttachmentChips(): void {
  postAttachmentChips.innerHTML = pendingAttachments
    .map(
      (a, i) => `
        <span class="tag-chip" style="display:inline-flex; gap:6px; align-items:center;">
          📎 ${escapeAttachmentName(a.filename)}
          <span style="color:var(--text-muted,#888); font-size:11px;">(${formatBytes(a.size)})</span>
          <button type="button" data-rm-att="${i}" style="background:none; border:none; color:#c33; cursor:pointer; padding:0; font-size:14px; line-height:1;">×</button>
        </span>`,
    )
    .join("");
  postAttachmentChips.querySelectorAll<HTMLButtonElement>("[data-rm-att]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-rm-att"));
      if (Number.isFinite(idx) && idx >= 0 && idx < pendingAttachments.length) {
        pendingAttachments.splice(idx, 1);
        renderAttachmentChips();
      }
    });
  });
}

function escapeAttachmentName(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPostAttachmentsList(items?: PostAttachment[]): string {
  if (!items || items.length === 0) {
    return "";
  }
  const rows = items
    .map(
      (a) => `
        <li style="display:flex; gap:8px; align-items:center; padding:6px 8px; background:var(--card,#f7f7f9); border:1px solid var(--border,#ececf0); border-radius:6px;">
          <span style="font-size:14px;">📎</span>
          <a href="${a.download_url}" download style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeAttachmentName(a.filename)}</a>
          <span style="color:var(--text-muted,#888); font-size:11px;">${formatBytes(a.size_bytes)}</span>
        </li>`,
    )
    .join("");
  return `<ul class="post-attachments" style="list-style:none; padding:0; margin:8px 0 0 0; display:flex; flex-direction:column; gap:6px;">${rows}</ul>`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

postAttachments.addEventListener("change", async () => {
  const files = Array.from(postAttachments.files || []);
  if (!files.length) {
    return;
  }
  postAttachments.disabled = true;
  for (const file of files) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await request(`/api/attachments`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data.attachment) {
        postFormStatus.textContent = `附件 "${file.name}" 上传失败：${data.error || "服务器错误"}`;
        continue;
      }
      pendingAttachments.push({
        id: data.attachment.id,
        filename: data.attachment.filename,
        size: data.attachment.size_bytes,
      });
    } catch (err) {
      postFormStatus.textContent = `附件 "${file.name}" 上传失败`;
    }
  }
  postAttachments.value = "";
  postAttachments.disabled = false;
  renderAttachmentChips();
});

// Rich-text composer: a Tiptap editor that writes MARKDOWN into the hidden
// #postContent textarea, so the existing submit path (which reads
// postContent.value) is unchanged. Toolbar maps to Tiptap commands; StarterKit
// also gives markdown input rules (**bold**, # heading, - list, > quote) and the
// usual keyboard shortcuts for free.
const postEditorHost = byId<HTMLElement>("postEditor");
const postEditorToolbar = byId<HTMLElement>("postEditorToolbar");
const postInlineImages = byId<HTMLInputElement>("postInlineImages");
let postEditor: MarkdownEditor | null = null;
if (postEditorHost) {
  postEditor = createMarkdownEditor(postEditorHost, {
    cssClass: "rich-prose",
    onChange: (md) => {
      postContent.value = md;
    },
    extensions: [PolarFigure, PolarGallery],
    setupMarkdown: setupDirectiveMarkdownIt,
    editorProps: {
      // paste/drop an image anywhere in the editor → eager upload → figure
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertFigures(files, false);
        return true;
      },
      handleDrop: (_view: unknown, event: DragEvent) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertFigures(files, false);
        return true;
      },
    },
  });
  wireRichToolbar(postEditorToolbar, postEditor);
}

function imageFiles(list: FileList | null | undefined): File[] {
  return Array.from(list || []).filter((f) => f.type.startsWith("image/"));
}

// uploadInlineImage eagerly uploads one image (same pattern as the
// attachments change-handler above) and returns the permanent URLs.
async function uploadInlineImage(file: File): Promise<{ url: string; medium_url: string } | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await request("/api/posts/media", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok || !data.url) {
      window.alert(data.error || `上传失败：${file.name}`);
      return null;
    }
    return data as { url: string; medium_url: string };
  } catch {
    window.alert(`上传失败：${file.name}`);
    return null;
  }
}

function setInlineUploadBusy(busy: boolean): void {
  postEditorToolbar
    ?.querySelectorAll<HTMLButtonElement>('[data-cmd="figure"], [data-cmd="gallery"]')
    .forEach((b) => {
      b.disabled = busy;
      b.style.opacity = busy ? "0.5" : "";
    });
}

// insertFigures uploads each file and inserts one figure block per image.
// askCaption=true prompts for a caption when inserting a single image via
// the toolbar (same interaction as the link button); paste/drop skip it.
async function insertFigures(files: File[], askCaption: boolean): Promise<void> {
  if (!postEditor) return;
  setInlineUploadBusy(true);
  try {
    for (const file of files) {
      const media = await uploadInlineImage(file);
      if (!media) continue;
      const caption =
        askCaption && files.length === 1 ? (window.prompt("图片说明（可留空）", "") || "").trim() : "";
      postEditor.editor
        .chain()
        .focus()
        .insertContent({
          type: "polarFigure",
          attrs: { src: media.url, alt: file.name.replace(/\.[a-z0-9]+$/i, ""), caption, align: "center", width: "" },
        })
        .run();
    }
  } finally {
    setInlineUploadBusy(false);
  }
}

// insertGallery uploads all files and inserts ONE gallery block.
async function insertGallery(files: File[]): Promise<void> {
  if (!postEditor) return;
  setInlineUploadBusy(true);
  try {
    const images: Array<{ src: string; alt: string }> = [];
    for (const file of files) {
      const media = await uploadInlineImage(file);
      if (media) images.push({ src: media.url, alt: file.name.replace(/\.[a-z0-9]+$/i, "") });
    }
    if (images.length === 0) return;
    postEditor.editor.chain().focus().insertContent({ type: "polarGallery", attrs: { images } }).run();
  } finally {
    setInlineUploadBusy(false);
  }
}

let inlineImageMode: "figure" | "gallery" = "figure";
postInlineImages?.addEventListener("change", () => {
  const files = imageFiles(postInlineImages.files);
  postInlineImages.value = "";
  if (files.length === 0) return;
  if (inlineImageMode === "gallery" && files.length > 1) {
    void insertGallery(files);
  } else {
    void insertFigures(files, true);
  }
});

function wireRichToolbar(toolbar: HTMLElement | null, ed: MarkdownEditor): void {
  if (!toolbar) return;
  toolbar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
    if (!btn) return;
    e.preventDefault();
    const chain = ed.editor.chain().focus();
    switch (btn.dataset.cmd) {
      case "bold": chain.toggleBold().run(); break;
      case "italic": chain.toggleItalic().run(); break;
      case "strike": chain.toggleStrike().run(); break;
      case "h2": chain.toggleHeading({ level: 2 }).run(); break;
      case "bulletList": chain.toggleBulletList().run(); break;
      case "orderedList": chain.toggleOrderedList().run(); break;
      case "blockquote": chain.toggleBlockquote().run(); break;
      case "code": chain.toggleCode().run(); break;
      case "codeBlock": chain.toggleCodeBlock().run(); break;
      case "link": {
        const prev = ed.editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Link URL", prev || "https://");
        if (url === null) { chain.run(); return; }
        if (url.trim() === "") { chain.extendMarkRange("link").unsetLink().run(); return; }
        chain.extendMarkRange("link").setLink({ href: url.trim() }).run();
        break;
      }
      case "figure":
        inlineImageMode = "figure";
        chain.run();
        postInlineImages?.click();
        return;
      case "gallery":
        inlineImageMode = "gallery";
        chain.run();
        postInlineImages?.click();
        return;
      default: chain.run();
    }
  });
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (postEditor) {
    postContent.value = postEditor.getMarkdown();
  }
  const content = postContent.value.trim();
  if (!content) {
    postFormStatus.textContent = t("post.contentRequired");
    return;
  }
  if (postType.value === "task") {
    if (!taskStartAt.value || !taskEndAt.value || !workingHours.value.trim() || !applyDeadline.value) {
      postFormStatus.textContent = t("post.taskInfoRequired");
      return;
    }
  }

  postFormStatus.textContent = t("post.publishing");
  postSubmitBtn.disabled = true;

  const formData = new FormData();
  formData.append("post_type", postType.value);
  if (postTag.value) {
    formData.append("tag_id", postTag.value);
  }
  formData.append("content", content);
  if (postType.value === "task") {
    formData.append("task_location", taskLocation.value.trim());
    formData.append("task_start_at", toISOStringFromLocal(taskStartAt.value));
    formData.append("task_end_at", toISOStringFromLocal(taskEndAt.value));
    formData.append("working_hours", workingHours.value.trim());
    formData.append("apply_deadline", toISOStringFromLocal(applyDeadline.value));
  }
  Array.from(postImages.files || []).forEach((file) => {
    formData.append("images", file);
  });
  Array.from(postVideos.files || []).forEach((file) => {
    formData.append("videos", file);
  });
  for (const a of pendingAttachments) {
    formData.append("attachment_ids", a.id);
  }

  try {
    const res = await request(`/api/posts`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      postFormStatus.textContent = data.error || t("post.publishFailed");
      return;
    }
    postFormStatus.textContent = t("post.publishSuccess");
    postForm.reset();
    window.location.href = `/post.html?id=${data.id}`;
  } catch {
    postFormStatus.textContent = t("post.publishFailedRetry");
  } finally {
    postSubmitBtn.disabled = false;
  }
});

async function init(): Promise<void> {
  await hydrateSiteBrand();
  await loadProfile();
  await loadTagOptions();
  syncTaskFields();
  setupPostAssistPanel();
  await loadPost();
}

void init();

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try { await logout(); } finally { window.location.replace("/login.html"); }
});

