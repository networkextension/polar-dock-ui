// Public invite preview page. Reachable at /invite.html?token=<token>.
// Renders team info from /api/invitations/:token, handles accept (auth
// required) and decline (no auth needed). If the visitor isn't logged
// in, surfaces a login/register hint with return_to so they come back
// here after auth.

import { request, requestJson } from "./api/http.js";
import { fetchCurrentUser, logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { formatDateTime } from "./lib/datetime.js";
import { hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

type PublicInvitationView = {
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  team_id: string;
  team_name: string;
  team_slug: string;
  team_avatar_url: string;
  inviter_name: string;
  expires_at: string;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "所有者",
  admin: "管理员",
  member: "成员",
  viewer: "只读",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "待处理",
  accepted: "已接受",
  declined: "已拒绝",
  revoked: "已撤销",
  expired: "已过期",
};

const loadingEl = byId<HTMLElement>("inviteLoading");
const contentEl = byId<HTMLElement>("inviteContent");
const errorEl = byId<HTMLElement>("inviteError");
const errorMsgEl = byId<HTMLElement>("inviteErrorMsg");

const teamNameEl = byId<HTMLElement>("inviteTeamName");
const inviterEl = byId<HTMLElement>("inviteInviterName");
const emailEl = byId<HTMLElement>("inviteEmail");
const roleEl = byId<HTMLElement>("inviteRole");
const expiresEl = byId<HTMLElement>("inviteExpires");
const avatarImg = byId<HTMLImageElement>("inviteAvatar");
const avatarPlaceholder = byId<HTMLElement>("inviteAvatarPlaceholder");

const acceptBtn = byId<HTMLButtonElement>("inviteAcceptBtn");
const declineBtn = byId<HTMLButtonElement>("inviteDeclineBtn");

const authHint = byId<HTMLElement>("inviteAuthHint");
const emailMismatchEl = byId<HTMLElement>("inviteEmailMismatch");
const currentEmailEl = byId<HTMLElement>("inviteCurrentEmail");
const loginLink = byId<HTMLAnchorElement>("inviteLoginLink");
const registerLink = byId<HTMLAnchorElement>("inviteRegisterLink");
const logoutLink = byId<HTMLAnchorElement>("inviteLogoutLink");

const statusEl = byId<HTMLElement>("inviteStatus");

function getToken(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showError(msg: string): void {
  loadingEl.hidden = true;
  contentEl.hidden = true;
  errorEl.hidden = false;
  errorMsgEl.textContent = msg;
}

function setStatus(msg: string, isError: boolean): void {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#c33" : "#3a7";
}

function clearStatus(): void {
  statusEl.textContent = "";
  statusEl.style.color = "";
}

function fmtDate(s: string): string {
  try {
    return formatDateTime(s);
  } catch {
    return s;
  }
}

async function load(): Promise<void> {
  const token = getToken();
  if (!token) {
    showError("缺少 token 参数");
    return;
  }

  // Fetch invitation in parallel with current-user lookup so we can
  // decide auth state in one render.
  const [invRes, userRes] = await Promise.all([
    request(`/api/invitations/${encodeURIComponent(token)}`),
    fetchCurrentUser(),
  ]);

  if (!invRes.ok) {
    if (invRes.status === 404 || invRes.status === 410) {
      showError("该邀请不存在或已被撤销");
    } else {
      showError("加载邀请失败");
    }
    return;
  }
  const invData = (await invRes.json()) as { invitation: PublicInvitationView };
  const inv = invData.invitation;

  // Hydrate display.
  loadingEl.hidden = true;
  contentEl.hidden = false;
  teamNameEl.textContent = inv.team_name;
  inviterEl.textContent = inv.inviter_name || "(unknown)";
  emailEl.textContent = inv.email;
  roleEl.textContent = ROLE_LABEL[inv.role] ?? inv.role;
  expiresEl.textContent = fmtDate(inv.expires_at);
  if (inv.team_avatar_url) {
    avatarImg.src = inv.team_avatar_url;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
  }

  // Non-pending statuses: show as informational, hide actions.
  if (inv.status !== "pending") {
    setStatus(`此邀请状态：${STATUS_LABEL[inv.status] ?? inv.status}`, true);
    acceptBtn.hidden = true;
    declineBtn.hidden = true;
    return;
  }

  // Auth state.
  const loggedIn = userRes.response.ok;
  if (!loggedIn) {
    authHint.hidden = false;
    acceptBtn.disabled = true;
    acceptBtn.title = "请先登录";
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    loginLink.href = `/login.html?return_to=${returnTo}&prefill_email=${encodeURIComponent(inv.email)}`;
    registerLink.href = `/register.html?return_to=${returnTo}&prefill_email=${encodeURIComponent(inv.email)}&invite_token=${encodeURIComponent(getToken())}`;
    return;
  }

  // Email match check.
  const me = userRes.data;
  if (me.email && inv.email && me.email.toLowerCase() !== inv.email.toLowerCase()) {
    emailMismatchEl.hidden = false;
    currentEmailEl.textContent = me.email;
    acceptBtn.disabled = true;
    acceptBtn.title = "邮箱不匹配";
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await logout();
      } finally {
        window.location.reload();
      }
    });
    return;
  }
}

async function doAccept(): Promise<void> {
  const token = getToken();
  if (!token) return;
  acceptBtn.disabled = true;
  declineBtn.disabled = true;
  setStatus("接受中...", false);
  const { response, data } = await requestJson<{ team_id?: string; error?: string }>(`/api/invitations/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
  if (!response.ok) {
    setStatus(data?.error || "接受失败", true);
    acceptBtn.disabled = false;
    declineBtn.disabled = false;
    return;
  }
  setStatus("已加入工作区，正在跳转...", false);
  setTimeout(() => {
    window.location.href = "/teams.html";
  }, 600);
}

async function doDecline(): Promise<void> {
  const token = getToken();
  if (!token) return;
  if (!window.confirm("确认拒绝该邀请？拒绝后无法撤回，邀请人需要重新发起。")) return;
  acceptBtn.disabled = true;
  declineBtn.disabled = true;
  setStatus("处理中...", false);
  const { response, data } = await requestJson<{ ok?: boolean; error?: string }>(`/api/invitations/${encodeURIComponent(token)}/decline`, {
    method: "POST",
  });
  if (!response.ok) {
    setStatus(data?.error || "操作失败", true);
    acceptBtn.disabled = false;
    declineBtn.disabled = false;
    return;
  }
  setStatus("已拒绝邀请", false);
  acceptBtn.hidden = true;
  declineBtn.hidden = true;
}

acceptBtn.addEventListener("click", () => void doAccept());
declineBtn.addEventListener("click", () => void doDecline());

void hydrateSiteBrand().finally(() => void load());
