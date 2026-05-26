// Teams (collaboration workspaces) page entrypoint. T2 scope:
//   - List teams I'm a member of
//   - Open a team to view metadata + members (read-only)
//   - Edit team name/description/avatar (admin+)
//   - Delete a non-personal team (owner only)
//
// Invitations + member management land in T3. Workspace switcher
// (X-Workspace-Id header) lands in T4.

import {
  acceptInvitation,
  createTeam,
  createTeamInvitation,
  declineInvitation,
  deleteTeam,
  fetchMyInvitations,
  fetchTeam,
  fetchTeamInvitations,
  fetchTeamLogs,
  fetchTeamMembers,
  fetchTeams,
  removeTeamMember,
  revokeTeamInvitation,
  transferTeamOwnership,
  updateTeam,
  updateTeamMemberRole,
} from "./api/teams.js";
import { fetchCurrentUser, logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSiteBrand, renderSidebarFoot } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type {
  AdminInvitation,
  InboxInvitation,
  LogEntry,
  TeamDeleteBlockedResponse,
  TeamMember,
  TeamRole,
  TeamWithRole,
} from "./types/teams.js";

initStoredTheme();
bindThemeSync();

const listEl = byId<HTMLElement>("teamsList");
const emptyEl = byId<HTMLElement>("teamsEmpty");
const panelEl = byId<HTMLElement>("teamsPanel");
const avatarImg = byId<HTMLImageElement>("teamsAvatar");
const avatarPlaceholder = byId<HTMLElement>("teamsAvatarPlaceholder");
const nameEl = byId<HTMLElement>("teamsName");
const kindBadge = byId<HTMLElement>("teamsKindBadge");
const roleBadge = byId<HTMLElement>("teamsRoleBadge");
const slugEl = byId<HTMLElement>("teamsSlug");
const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-teams-tab]"));
const tabPanes = Array.from(document.querySelectorAll<HTMLElement>("[data-teams-pane]"));

const infoNameEl = byId<HTMLInputElement>("teamsInfoName");
const infoDescEl = byId<HTMLTextAreaElement>("teamsInfoDescription");
const infoAvatarEl = byId<HTMLInputElement>("teamsInfoAvatarURL");
const infoSaveBtn = byId<HTMLButtonElement>("teamsInfoSaveBtn");
const infoStatusEl = byId<HTMLElement>("teamsInfoStatus");
const infoReadonlyHintEl = byId<HTMLElement>("teamsInfoReadonlyHint");

const membersListEl = byId<HTMLElement>("teamsMembersList");

const invitationsTabBtn = document.querySelector<HTMLButtonElement>('[data-teams-tab="invitations"]');
const inviteForm = byId<HTMLFormElement>("teamsInviteForm");
const inviteEmailEl = byId<HTMLTextAreaElement>("teamsInviteEmail");
const inviteRoleEl = byId<HTMLSelectElement>("teamsInviteRole");
const inviteSubmitBtn = byId<HTMLButtonElement>("teamsInviteSubmit");
const inviteStatusEl = byId<HTMLElement>("teamsInviteStatus");
const invitationsListEl = byId<HTMLElement>("teamsInvitationsList");

const logsListEl = byId<HTMLElement>("teamsLogsList");
const logsCategoryEl = byId<HTMLSelectElement>("teamsLogsCategory");
const logsRefreshBtn = byId<HTMLButtonElement>("teamsLogsRefreshBtn");

const inboxEl = byId<HTMLElement>("teamsInbox");
const inboxCountEl = byId<HTMLElement>("teamsInboxCount");
const inboxListEl = byId<HTMLElement>("teamsInboxList");

const dangerPersonalEl = byId<HTMLElement>("teamsDangerPersonal");
const dangerTeamEl = byId<HTMLElement>("teamsDangerTeam");

const transferSection = byId<HTMLElement>("teamsTransferSection");
const transferTargetEl = byId<HTMLSelectElement>("teamsTransferTarget");
const transferBtn = byId<HTMLButtonElement>("teamsTransferBtn");
const transferStatusEl = byId<HTMLElement>("teamsTransferStatus");

const leaveSection = byId<HTMLElement>("teamsLeaveSection");
const leaveBtn = byId<HTMLButtonElement>("teamsLeaveBtn");

const deleteSection = byId<HTMLElement>("teamsDeleteSection");
const deleteBtn = byId<HTMLButtonElement>("teamsDeleteBtn");
const deleteStatusEl = byId<HTMLElement>("teamsDeleteStatus");

let currentMembers: TeamMember[] = [];
let currentUserID = "";

const createBtn = byId<HTMLButtonElement>("teamsCreateBtn");
const createModal = byId<HTMLElement>("teamsCreateModal");
const createModalCloseBtn = byId<HTMLButtonElement>("teamsCreateModalCloseBtn");
const createForm = byId<HTMLFormElement>("teamsCreateForm");
const createName = byId<HTMLInputElement>("teamsCreateName");
const createDesc = byId<HTMLTextAreaElement>("teamsCreateDescription");
const createAvatar = byId<HTMLInputElement>("teamsCreateAvatarURL");
const createStatusEl = byId<HTMLElement>("teamsCreateStatus");

let teams: TeamWithRole[] = [];
let activeTeamId: string | null = null;
let activeTeam: TeamWithRole | null = null;

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "管理员",
  member: "成员",
  viewer: "只读",
};

const KIND_LABEL: Record<string, string> = {
  personal: "个人工作区",
  team: "团队工作区",
};

function setModalOpen(modal: HTMLElement, open: boolean): void {
  modal.classList.toggle("open", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function setStatus(el: HTMLElement, msg: string, isError: boolean): void {
  el.textContent = msg;
  el.style.color = isError ? "#c33" : "#3a7";
}

function clearStatus(el: HTMLElement): void {
  el.textContent = "";
  el.style.color = "";
}

function canEdit(role: TeamRole): boolean {
  return role === "owner" || role === "admin";
}

function canDelete(team: TeamWithRole): boolean {
  return team.kind === "team" && team.my_role === "owner";
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTeamList(): void {
  if (teams.length === 0) {
    listEl.innerHTML = `<div class="chat-empty">还没有工作区，点右上角「＋ 新建工作区」创建一个</div>`;
    return;
  }
  listEl.innerHTML = teams
    .map((team) => {
      const active = team.id === activeTeamId ? "active" : "";
      const isPersonal = team.kind === "personal";
      const icon = team.avatar_url
        ? `<img src="${escapeHTML(team.avatar_url)}" alt="" style="width:32px; height:32px; border-radius:8px; object-fit:cover; flex-shrink:0;" />`
        : `<div style="width:32px; height:32px; border-radius:8px; background:linear-gradient(135deg,#e9e9ef,#cfd0d6); display:flex; align-items:center; justify-content:center; font-size:14px; color:#666; flex-shrink:0;">${isPersonal ? "👤" : "⌂"}</div>`;
      return `
        <div class="video-studio-project-item ${active}" data-team-id="${escapeHTML(team.id)}">
          ${icon}
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(team.name)}</div>
            <div style="font-size:11px; color:var(--text-muted,#888); display:flex; gap:6px;">
              <span>${KIND_LABEL[team.kind] ?? team.kind}</span>
              <span>·</span>
              <span>${ROLE_LABEL[team.my_role] ?? team.my_role}</span>
            </div>
          </div>
        </div>`;
    })
    .join("");

  listEl.querySelectorAll<HTMLElement>("[data-team-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-team-id");
      if (id) void openTeam(id);
    });
  });
}

function renderTeamPanel(team: TeamWithRole): void {
  emptyEl.hidden = true;
  panelEl.hidden = false;
  nameEl.textContent = team.name;
  slugEl.textContent = team.slug;
  kindBadge.textContent = KIND_LABEL[team.kind] ?? team.kind;
  roleBadge.textContent = ROLE_LABEL[team.my_role] ?? team.my_role;

  if (team.avatar_url) {
    avatarImg.src = team.avatar_url;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarPlaceholder.style.display = "flex";
  }

  // Info tab
  infoNameEl.value = team.name;
  infoDescEl.value = team.description;
  infoAvatarEl.value = team.avatar_url;
  const editable = canEdit(team.my_role);
  infoNameEl.disabled = !editable;
  infoDescEl.disabled = !editable;
  infoAvatarEl.disabled = !editable;
  infoSaveBtn.hidden = !editable;
  infoReadonlyHintEl.hidden = editable;
  clearStatus(infoStatusEl);

  // Invitations tab visibility (admin+, non-personal team only).
  const showInviteTab = canEdit(team.my_role) && team.kind !== "personal";
  if (invitationsTabBtn) invitationsTabBtn.hidden = !showInviteTab;

  // Danger tab. Each subsection appears based on what the caller can
  // actually do here; non-personal team only.
  dangerPersonalEl.hidden = team.kind !== "personal";
  dangerTeamEl.hidden = team.kind === "personal";
  if (team.kind !== "personal") {
    transferSection.hidden = team.my_role !== "owner";
    leaveSection.hidden = team.my_role === "owner"; // owner must transfer first
    deleteSection.hidden = team.my_role !== "owner";
    clearStatus(transferStatusEl);
    clearStatus(deleteStatusEl);
  }
}

function renderMembers(members: TeamMember[]): void {
  currentMembers = members;
  if (!activeTeam || members.length === 0) {
    membersListEl.innerHTML = `<div class="chat-empty">没有成员</div>`;
    refreshTransferTargetOptions();
    return;
  }
  const myRole = activeTeam.my_role;
  const isPersonal = activeTeam.kind === "personal";
  membersListEl.innerHTML = members
    .map((m) => {
      const initial = (m.username || m.email || "?").charAt(0).toUpperCase();
      const avatar = m.icon_url
        ? `<img src="${escapeHTML(m.icon_url)}" alt="" style="width:36px; height:36px; border-radius:50%; object-fit:cover; flex-shrink:0;" />`
        : `<div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#e9e9ef,#cfd0d6); display:flex; align-items:center; justify-content:center; font-size:14px; color:#666; flex-shrink:0;">${escapeHTML(initial)}</div>`;
      const isSelf = m.user_id === currentUserID;
      const targetIsOwner = m.role === "owner";
      const targetIsAdmin = m.role === "admin";

      // Decide which actions are available on this member row.
      // Mirrors the backend rules so the UI doesn't surface buttons
      // the API would reject.
      const canChangeRole =
        !isPersonal &&
        !isSelf &&
        !targetIsOwner &&
        teamRoleAtLeast(myRole, "admin") &&
        (myRole === "owner" || !targetIsAdmin);
      const canKick =
        !isPersonal &&
        !isSelf &&
        !targetIsOwner &&
        teamRoleAtLeast(myRole, "admin") &&
        (myRole === "owner" || !targetIsAdmin);

      let actions = "";
      if (canChangeRole) {
        const opts: TeamRole[] = ["admin", "member", "viewer"];
        const optsHtml = opts
          .map((r) => `<option value="${r}" ${r === m.role ? "selected" : ""}>${ROLE_LABEL[r]}</option>`)
          .join("");
        actions += `<select class="input" style="font-size:11px; padding:2px 6px;" data-member-role-target="${escapeHTML(m.user_id)}">${optsHtml}</select>`;
      } else {
        actions += `<span class="settings-value-pill" style="font-size:11px;">${ROLE_LABEL[m.role] ?? m.role}</span>`;
      }
      if (canKick) {
        actions += `<button type="button" class="btn-inline" style="color:#c33; font-size:11px;" data-member-kick="${escapeHTML(m.user_id)}">踢出</button>`;
      }
      return `
        <div class="video-studio-project-item" style="cursor:default;">
          ${avatar}
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500;">${escapeHTML(m.username || "(no name)")}${isSelf ? " (你)" : ""}</div>
            <div style="font-size:11px; color:var(--text-muted,#888); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(m.email)}</div>
          </div>
          ${actions}
        </div>`;
    })
    .join("");

  membersListEl.querySelectorAll<HTMLSelectElement>("[data-member-role-target]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const uid = sel.getAttribute("data-member-role-target");
      if (uid) void doMemberRoleChange(uid, sel.value as TeamRole);
    });
  });
  membersListEl.querySelectorAll<HTMLButtonElement>("[data-member-kick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.getAttribute("data-member-kick");
      if (uid) void doMemberKick(uid);
    });
  });

  refreshTransferTargetOptions();
}

function teamRoleAtLeast(actor: TeamRole, min: TeamRole): boolean {
  const rank: Record<TeamRole, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };
  return rank[actor] >= rank[min];
}

function refreshTransferTargetOptions(): void {
  if (!activeTeam || activeTeam.my_role !== "owner") {
    transferTargetEl.innerHTML = `<option value="">选择一位成员...</option>`;
    return;
  }
  const candidates = currentMembers.filter((m) => m.user_id !== currentUserID);
  if (candidates.length === 0) {
    transferTargetEl.innerHTML = `<option value="">工作区里只有你 ——先邀请其他人</option>`;
    return;
  }
  transferTargetEl.innerHTML =
    `<option value="">选择一位成员...</option>` +
    candidates
      .map(
        (m) =>
          `<option value="${escapeHTML(m.user_id)}">${escapeHTML(m.username || m.email)} (${ROLE_LABEL[m.role] ?? m.role})</option>`,
      )
      .join("");
}

function setActiveTab(name: string): void {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-teams-tab") === name);
  });
  tabPanes.forEach((pane) => {
    pane.hidden = pane.getAttribute("data-teams-pane") !== name;
  });
  if (name === "invitations" && activeTeam) {
    void loadInvitations(activeTeam.id);
  }
  if (name === "logs" && activeTeam) {
    void loadLogs(activeTeam.id);
  }
}

const LOG_LEVEL_COLOR: Record<string, string> = {
  debug: "#999",
  info: "#3a7",
  warn: "#c80",
  error: "#c33",
};

const LOG_CATEGORY_LABEL: Record<string, string> = {
  sign: "签名",
  team_audit: "工作区",
  deploy: "部署",
  agent: "AI",
  server: "服务",
};

function renderLogs(entries: LogEntry[]): void {
  if (entries.length === 0) {
    logsListEl.innerHTML = `<div class="chat-empty">暂无日志</div>`;
    return;
  }
  logsListEl.innerHTML = entries
    .map((e) => {
      const ts = new Date(e.created_at).toLocaleString();
      const levelColor = LOG_LEVEL_COLOR[e.level] ?? "#666";
      const categoryLabel = LOG_CATEGORY_LABEL[e.category] ?? e.category;
      const detailsBlob =
        e.details && Object.keys(e.details).length > 0
          ? `<details style="margin-top:4px;"><summary style="font-size:11px; color:var(--text-muted,#888); cursor:pointer;">详情</summary><pre style="font-size:11px; background:var(--surface,#f7f7f9); padding:6px; margin:4px 0 0 0; border-radius:4px; overflow:auto; white-space:pre-wrap; word-break:break-all;">${escapeHTML(JSON.stringify(e.details, null, 2))}</pre></details>`
          : "";
      const subject = e.subject_kind
        ? ` <span style="font-family:monospace; font-size:11px; color:var(--text-muted,#888);">${escapeHTML(e.subject_kind)}/${escapeHTML(e.subject_id || "")}</span>`
        : "";
      const action = e.action ? ` <span style="font-family:monospace; font-size:11px;">${escapeHTML(e.action)}</span>` : "";
      const actor = e.actor_user_id
        ? `<span style="font-size:11px; color:var(--text-muted,#888);">actor: ${escapeHTML(e.actor_user_id)}</span>`
        : `<span style="font-size:11px; color:var(--text-muted,#888);">${escapeHTML(e.actor_kind)}</span>`;
      return `
        <div style="padding:8px 10px; background:var(--card,#fff); border:1px solid var(--border,#ececf0); border-radius:6px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px;">
            <span style="font-family:monospace; color:var(--text-muted,#888);">${escapeHTML(ts)}</span>
            <span style="padding:1px 6px; border-radius:3px; background:${levelColor}; color:#fff; font-size:10px; text-transform:uppercase;">${escapeHTML(e.level)}</span>
            <span style="padding:1px 6px; border-radius:3px; border:1px solid var(--border,#ddd); font-size:10px;">${escapeHTML(categoryLabel)}</span>
            ${action}
            ${subject}
          </div>
          <div style="font-size:13px; margin-top:4px;">${escapeHTML(e.message || "(no message)")}</div>
          <div style="margin-top:4px;">${actor}</div>
          ${detailsBlob}
        </div>`;
    })
    .join("");
}

async function loadLogs(teamID: string): Promise<void> {
  logsListEl.innerHTML = `<div class="chat-empty">加载中...</div>`;
  const params: Record<string, string> = { limit: "50" };
  const cat = logsCategoryEl.value.trim();
  if (cat) params.category = cat;
  const { response, data } = await fetchTeamLogs(teamID, params);
  if (!response.ok) {
    logsListEl.innerHTML = `<div class="chat-empty">加载失败</div>`;
    return;
  }
  renderLogs(data.entries);
}

async function loadTeams(): Promise<void> {
  const { response, data } = await fetchTeams();
  if (!response.ok) {
    listEl.innerHTML = `<div class="chat-empty">加载失败</div>`;
    return;
  }
  teams = data.teams;
  renderTeamList();
}

async function openTeam(id: string): Promise<void> {
  activeTeamId = id;
  renderTeamList();
  setActiveTab("info");
  membersListEl.innerHTML = `<div class="chat-empty">加载中...</div>`;

  const { response, data } = await fetchTeam(id);
  if (!response.ok) {
    activeTeam = null;
    emptyEl.hidden = false;
    panelEl.hidden = true;
    return;
  }
  activeTeam = { ...data.team, my_role: data.my_role };
  renderTeamPanel(activeTeam);
  void loadMembers(id);
}

async function loadMembers(id: string): Promise<void> {
  const { response, data } = await fetchTeamMembers(id);
  if (!response.ok) {
    membersListEl.innerHTML = `<div class="chat-empty">加载失败</div>`;
    return;
  }
  renderMembers(data.members);
}

// ---- invitations (admin tab) ------------------------------------

function renderInvitations(invs: AdminInvitation[]): void {
  if (invs.length === 0) {
    invitationsListEl.innerHTML = `<div class="chat-empty">没有待处理的邀请</div>`;
    return;
  }
  invitationsListEl.innerHTML = invs
    .map((inv) => {
      const expires = new Date(inv.expires_at).toLocaleString();
      return `
        <div class="video-studio-project-item" style="cursor:default; flex-direction:column; align-items:stretch; gap:6px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="flex:1; min-width:0;">
              <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(inv.email)}</div>
              <div style="font-size:11px; color:var(--text-muted,#888);">
                ${ROLE_LABEL[inv.role] ?? inv.role} · 由 ${escapeHTML(inv.inviter_name)} 发出 · 到期 ${escapeHTML(expires)}
              </div>
            </div>
            <button type="button" class="btn-inline btn-secondary" data-invite-copy="${escapeHTML(inv.invite_url)}">复制链接</button>
            <button type="button" class="btn-inline btn-secondary" data-invite-download="${escapeHTML(inv.id)}">下载</button>
            <button type="button" class="btn-inline" data-invite-revoke="${escapeHTML(inv.id)}" style="color:#c33;">撤销</button>
          </div>
        </div>`;
    })
    .join("");
  invitationsListEl.querySelectorAll<HTMLButtonElement>("[data-invite-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.getAttribute("data-invite-copy") || "";
      try {
        await navigator.clipboard.writeText(url);
        const orig = btn.textContent;
        btn.textContent = "已复制";
        setTimeout(() => {
          btn.textContent = orig;
        }, 1200);
      } catch {
        window.prompt("复制下面这个链接：", url);
      }
    });
  });
  invitationsListEl.querySelectorAll<HTMLButtonElement>("[data-invite-download]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-invite-download");
      const inv = invs.find((row) => row.id === id);
      if (inv) downloadInvitation(inv);
    });
  });
  invitationsListEl.querySelectorAll<HTMLButtonElement>("[data-invite-revoke]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-invite-revoke");
      if (id) void doRevoke(id);
    });
  });
}

// downloadInvitation drops a small UTF-8 .txt with the invite URL +
// metadata so the operator can hand the file off through any channel
// (Slack/Lark/USB) without relying on email or clipboard. Filename
// embeds email + first 6 of invite id for disambiguation.
function downloadInvitation(inv: AdminInvitation): void {
  const lines = [
    `Polar 工作区邀请`,
    ``,
    `工作区: ${activeTeam?.name ?? inv.team_id}`,
    `邀请邮箱: ${inv.email}`,
    `角色: ${ROLE_LABEL[inv.role] ?? inv.role}`,
    `邀请人: ${inv.inviter_name}`,
    `到期时间: ${new Date(inv.expires_at).toLocaleString()}`,
    ``,
    `点击下面链接接受邀请（需先用 ${inv.email} 登录或注册）：`,
    inv.invite_url,
    ``,
    `邀请 ID: ${inv.id}`,
  ];
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
  const safeEmail = inv.email.replace(/[^a-z0-9_.\-@]/gi, "_");
  const fname = `polar-invite-${safeEmail}-${inv.id.slice(0, 6)}.txt`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function loadInvitations(teamID: string): Promise<void> {
  invitationsListEl.innerHTML = `<div class="chat-empty">加载中...</div>`;
  const { response, data } = await fetchTeamInvitations(teamID);
  if (!response.ok) {
    invitationsListEl.innerHTML = `<div class="chat-empty">加载失败</div>`;
    return;
  }
  renderInvitations(data.invitations);
}

// Email parser: split on newlines / commas / semicolons, trim, lowercase
// for dedup, drop empty / clearly-invalid. Preserve original casing in the
// kept entries (some mail systems are case-sensitive on local-part).
function parseInviteEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[\n,;]+/)) {
    const t = piece.trim();
    if (!t) continue;
    if (!/^\S+@\S+\.\S+$/.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

// Single-shape result (rather than a discriminated union) — keeps TS
// narrowing simple in the CSV builder where TS occasionally fails to
// propagate `if (r.ok)` through arrow callbacks.
type InviteResult = {
  email: string;
  ok: boolean;
  invitation?: AdminInvitation;
  email_sent?: boolean;
  email_send_disabled?: boolean;
  error?: string;
};

// Build a CSV the operator can hand to a script / spreadsheet. Rows include
// failure reasons too so a partial batch is still actionable. Excel-friendly:
// quote every cell, escape internal quotes, prepend BOM so 中文 doesn't mojibake.
function downloadBatchInviteCSV(teamName: string, role: TeamRole, results: InviteResult[]): void {
  const header = ["email", "role", "status", "invite_url", "expires_at", "email_sent", "error"];
  const rows: string[][] = [];
  for (const r of results) {
    if (r.ok && r.invitation) {
      rows.push([
        r.email,
        role,
        "created",
        r.invitation.invite_url,
        r.invitation.expires_at,
        r.email_sent ? "yes" : (r.email_send_disabled ? "disabled" : "no"),
        "",
      ]);
    } else {
      rows.push([r.email, role, "failed", "", "", "", r.error || ""]);
    }
  }
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv + "\n"], { type: "text/csv;charset=utf-8" });
  const safeTeam = teamName.replace(/[^a-z0-9_.\-]/gi, "_") || "team";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fname = `polar-invites-${safeTeam}-${stamp}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function submitInvite(e: Event): Promise<void> {
  e.preventDefault();
  if (!activeTeam) return;
  const emails = parseInviteEmails(inviteEmailEl.value);
  const role = inviteRoleEl.value as TeamRole;
  if (emails.length === 0) {
    setStatus(inviteStatusEl, "请填写有效的邮箱（多个用换行 / 逗号分隔）", true);
    return;
  }

  // Single-email path: keep the existing UX exactly (no CSV download,
  // detailed status message about email send state).
  if (emails.length === 1) {
    const email = emails[0];
    inviteSubmitBtn.disabled = true;
    setStatus(inviteStatusEl, "发送中...", false);
    const { response, data } = await createTeamInvitation(activeTeam.id, { email, role });
    inviteSubmitBtn.disabled = false;
    if (!response.ok) {
      const err = (data as unknown as { error?: string })?.error || "发送失败";
      setStatus(inviteStatusEl, err, true);
      return;
    }
    inviteEmailEl.value = "";
    if (data.email_send_disabled) {
      setStatus(inviteStatusEl, "邀请已创建，但服务器未配置邮件通道。请手动复制链接发给对方。", false);
    } else if (!data.email_sent) {
      setStatus(inviteStatusEl, "邀请已创建，但邮件发送失败。请用「复制链接」手动转发。", true);
    } else {
      setStatus(inviteStatusEl, "邀请邮件已发送", false);
    }
    await loadInvitations(activeTeam.id);
    return;
  }

  // Batch path: sequential POSTs (keeps server-side rate limits friendly,
  // gives a deterministic progress counter, lets one failure not abort
  // the rest). All results — successes and failures — go into the CSV
  // so the operator can retry just the failed rows.
  inviteSubmitBtn.disabled = true;
  const results: InviteResult[] = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    setStatus(inviteStatusEl, `发送中 (${i + 1}/${emails.length}) ${email}...`, false);
    const { response, data } = await createTeamInvitation(activeTeam.id, { email, role });
    if (response.ok) {
      results.push({
        email,
        ok: true,
        invitation: data.invitation,
        email_sent: data.email_sent,
        email_send_disabled: data.email_send_disabled,
      });
    } else {
      const err = (data as unknown as { error?: string })?.error || "失败";
      results.push({ email, ok: false, error: err });
    }
  }
  inviteSubmitBtn.disabled = false;

  downloadBatchInviteCSV(activeTeam.name || activeTeam.id, role, results);

  const ok = results.filter((r) => r.ok).length;
  const fail = emails.length - ok;
  if (fail === 0) {
    inviteEmailEl.value = "";
    setStatus(inviteStatusEl, `成功创建 ${ok} 条邀请，CSV 已下载`, false);
  } else {
    // Keep the textarea content so the operator can see what failed.
    setStatus(inviteStatusEl, `${ok} 条成功 · ${fail} 条失败 — 详见下载的 CSV`, true);
  }
  await loadInvitations(activeTeam.id);
}

async function doRevoke(invID: string): Promise<void> {
  if (!activeTeam) return;
  if (!window.confirm("确认撤销该邀请？对方点击邀请链接时将看到「邀请已失效」。")) return;
  const { response } = await revokeTeamInvitation(activeTeam.id, invID);
  if (!response.ok) {
    window.alert("撤销失败");
    return;
  }
  await loadInvitations(activeTeam.id);
}

// ---- inbox ---------------------------------------------------------

function renderInbox(invs: InboxInvitation[]): void {
  if (invs.length === 0) {
    inboxEl.hidden = true;
    return;
  }
  inboxEl.hidden = false;
  inboxCountEl.textContent = String(invs.length);
  inboxListEl.innerHTML = invs
    .map((inv) => {
      const expires = new Date(inv.expires_at).toLocaleString();
      return `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--card,#fff); border:1px solid #f0d597; border-radius:6px;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:500; font-size:13px;">${escapeHTML(inv.team_name)} <span style="font-size:11px; color:var(--text-muted,#888);">· ${ROLE_LABEL[inv.role] ?? inv.role}</span></div>
            <div style="font-size:11px; color:var(--text-muted,#888);">${escapeHTML(inv.inviter_name)} 邀请你 · 到期 ${escapeHTML(expires)}</div>
          </div>
          <button type="button" class="btn-inline btn-secondary" data-inbox-accept="${escapeHTML(inv.token)}">接受</button>
          <button type="button" class="btn-inline" data-inbox-decline="${escapeHTML(inv.token)}" style="color:#c33;">拒绝</button>
        </div>`;
    })
    .join("");
  inboxListEl.querySelectorAll<HTMLButtonElement>("[data-inbox-accept]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const token = btn.getAttribute("data-inbox-accept");
      if (token) void doInboxAccept(token);
    });
  });
  inboxListEl.querySelectorAll<HTMLButtonElement>("[data-inbox-decline]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const token = btn.getAttribute("data-inbox-decline");
      if (token) void doInboxDecline(token);
    });
  });
}

async function loadInbox(): Promise<void> {
  const { response, data } = await fetchMyInvitations();
  if (!response.ok) return;
  renderInbox(data.invitations);
}

async function doInboxAccept(token: string): Promise<void> {
  const { response, data } = await acceptInvitation(token);
  if (!response.ok) {
    window.alert(data?.error || "接受失败");
    return;
  }
  await Promise.all([loadInbox(), loadTeams()]);
  if (data?.team_id) void openTeam(data.team_id);
}

async function doInboxDecline(token: string): Promise<void> {
  if (!window.confirm("确认拒绝该邀请？")) return;
  const { response, data } = await declineInvitation(token);
  if (!response.ok) {
    window.alert(data?.error || "拒绝失败");
    return;
  }
  await loadInbox();
}

async function saveInfo(): Promise<void> {
  if (!activeTeam || !canEdit(activeTeam.my_role)) return;
  const name = infoNameEl.value.trim();
  if (!name) {
    setStatus(infoStatusEl, "名称不能为空", true);
    return;
  }
  infoSaveBtn.disabled = true;
  setStatus(infoStatusEl, "保存中...", false);
  try {
    const { response, data } = await updateTeam(activeTeam.id, {
      name,
      description: infoDescEl.value.trim(),
      avatar_url: infoAvatarEl.value.trim(),
    });
    if (!response.ok) {
      const err = (data as { error?: string })?.error || "保存失败";
      setStatus(infoStatusEl, err, true);
      return;
    }
    activeTeam = { ...data.team, my_role: activeTeam.my_role };
    // Reflect into list view too.
    teams = teams.map((t) => (t.id === activeTeam!.id ? { ...activeTeam! } : t));
    renderTeamList();
    renderTeamPanel(activeTeam);
    setStatus(infoStatusEl, "已保存", false);
  } finally {
    infoSaveBtn.disabled = false;
  }
}

async function doDelete(): Promise<void> {
  if (!activeTeam || !canDelete(activeTeam)) return;
  const name = activeTeam.name;
  const confirmed = window.confirm(`确认删除工作区「${name}」？该操作不可恢复。`);
  if (!confirmed) return;
  setStatus(deleteStatusEl, "删除中...", false);
  const { response, data } = await deleteTeam(activeTeam.id);
  if (response.status === 409) {
    const blocked = data as unknown as TeamDeleteBlockedResponse;
    const c = blocked.resource_counts;
    const parts: string[] = [];
    if (c.apps > 0) parts.push(`${c.apps} 个应用`);
    if (c.certificates > 0) parts.push(`${c.certificates} 个证书`);
    if (c.profiles > 0) parts.push(`${c.profiles} 个 Profile`);
    if (c.asc_configs > 0) parts.push(`${c.asc_configs} 个 ASC config`);
    if (c.llm_configs > 0) parts.push(`${c.llm_configs} 个 LLM config`);
    if (c.bot_users > 0) parts.push(`${c.bot_users} 个 Bot`);
    if (c.packtunnel_profiles > 0) parts.push(`${c.packtunnel_profiles} 个网络配置`);
    if (c.packtunnel_rules > 0) parts.push(`${c.packtunnel_rules} 份规则文件`);
    if (c.video_projects > 0) parts.push(`${c.video_projects} 个视频项目`);
    setStatus(deleteStatusEl, `工作区还有：${parts.join("、")}。请先归档或迁走再删除。`, true);
    return;
  }
  if (!response.ok) {
    const err = (data as unknown as { error?: string })?.error || "删除失败";
    setStatus(deleteStatusEl, err, true);
    return;
  }
  // Remove from list, jump back to empty / first remaining team.
  teams = teams.filter((t) => t.id !== activeTeam!.id);
  activeTeam = null;
  activeTeamId = null;
  emptyEl.hidden = false;
  panelEl.hidden = true;
  renderTeamList();
  if (teams.length > 0) {
    void openTeam(teams[0].id);
  }
}

async function doMemberRoleChange(targetUserID: string, role: TeamRole): Promise<void> {
  if (!activeTeam) return;
  const { response, data } = await updateTeamMemberRole(activeTeam.id, targetUserID, { role });
  if (!response.ok) {
    window.alert((data as unknown as { error?: string })?.error || "改角色失败");
    // Reload to reset the select to its real value.
    void loadMembers(activeTeam.id);
    return;
  }
  void loadMembers(activeTeam.id);
}

async function doMemberKick(targetUserID: string): Promise<void> {
  if (!activeTeam) return;
  const target = currentMembers.find((m) => m.user_id === targetUserID);
  const targetName = target ? target.username || target.email : "该成员";
  if (!window.confirm(`确认将 ${targetName} 踢出工作区？`)) return;
  const { response, data } = await removeTeamMember(activeTeam.id, targetUserID);
  if (!response.ok) {
    window.alert((data as unknown as { error?: string })?.error || "踢出失败");
    return;
  }
  void loadMembers(activeTeam.id);
}

async function doSelfLeave(): Promise<void> {
  if (!activeTeam || activeTeam.kind === "personal" || activeTeam.my_role === "owner") return;
  if (!window.confirm(`确认退出工作区「${activeTeam.name}」？退出后将看不到该工作区的资源。`)) return;
  const leftTeamID = activeTeam.id;
  const { response, data } = await removeTeamMember(leftTeamID, currentUserID);
  if (!response.ok) {
    window.alert((data as unknown as { error?: string })?.error || "退出失败");
    return;
  }
  // Reload everything; the team should disappear from my list.
  await loadTeams();
  if (activeTeamId === leftTeamID) {
    activeTeamId = null;
    activeTeam = null;
    emptyEl.hidden = false;
    panelEl.hidden = true;
  }
  if (teams.length > 0) void openTeam(teams[0].id);
}

async function doTransfer(): Promise<void> {
  if (!activeTeam || activeTeam.my_role !== "owner") return;
  const newOwnerUserID = transferTargetEl.value.trim();
  if (!newOwnerUserID) {
    setStatus(transferStatusEl, "请选择一位成员作为新所有者", true);
    return;
  }
  const target = currentMembers.find((m) => m.user_id === newOwnerUserID);
  const targetName = target ? target.username || target.email : "该成员";
  if (!window.confirm(`确认将工作区「${activeTeam.name}」的所有者转给 ${targetName}？转让后你会自动降为管理员。`)) return;
  transferBtn.disabled = true;
  setStatus(transferStatusEl, "转让中...", false);
  const { response, data } = await transferTeamOwnership(activeTeam.id, { new_owner_user_id: newOwnerUserID });
  transferBtn.disabled = false;
  if (!response.ok) {
    setStatus(transferStatusEl, (data as unknown as { error?: string })?.error || "转让失败", true);
    return;
  }
  setStatus(transferStatusEl, "已转让，正在刷新...", false);
  // Re-fetch the team detail so my_role flips from owner to admin.
  await Promise.all([loadTeams(), reopenActiveTeam()]);
}

async function reopenActiveTeam(): Promise<void> {
  if (!activeTeamId) return;
  const id = activeTeamId;
  await openTeam(id);
}

function openCreateModal(): void {
  createName.value = "";
  createDesc.value = "";
  createAvatar.value = "";
  clearStatus(createStatusEl);
  setModalOpen(createModal, true);
  setTimeout(() => createName.focus(), 0);
}

function closeCreateModal(): void {
  setModalOpen(createModal, false);
}

async function submitCreate(e: Event): Promise<void> {
  e.preventDefault();
  const name = createName.value.trim();
  if (!name) {
    setStatus(createStatusEl, "名称不能为空", true);
    return;
  }
  setStatus(createStatusEl, "创建中...", false);
  const { response, data } = await createTeam({
    name,
    description: createDesc.value.trim(),
    avatar_url: createAvatar.value.trim(),
  });
  if (!response.ok) {
    const err = (data as unknown as { error?: string })?.error || "创建失败";
    setStatus(createStatusEl, err, true);
    return;
  }
  closeCreateModal();
  await loadTeams();
  void openTeam(data.team.id);
}

// ---- wiring -------------------------------------------------------

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const name = btn.getAttribute("data-teams-tab");
    if (name) setActiveTab(name);
  });
});
infoSaveBtn.addEventListener("click", () => void saveInfo());
deleteBtn.addEventListener("click", () => void doDelete());
transferBtn.addEventListener("click", () => void doTransfer());
leaveBtn.addEventListener("click", () => void doSelfLeave());
createBtn.addEventListener("click", openCreateModal);
createModalCloseBtn.addEventListener("click", closeCreateModal);
createModal.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.classList.contains("modal-backdrop")) closeCreateModal();
});
createForm.addEventListener("submit", (e) => void submitCreate(e));
inviteForm.addEventListener("submit", (e) => void submitInvite(e));
logsRefreshBtn.addEventListener("click", () => {
  if (activeTeam) void loadLogs(activeTeam.id);
});
logsCategoryEl.addEventListener("change", () => {
  if (activeTeam) void loadLogs(activeTeam.id);
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await logout();
  } finally {
    window.location.replace("/login.html");
  }
});

// ---- bootstrap ----------------------------------------------------

async function init(): Promise<void> {
  await hydrateSiteBrand();
  const { response, data } = await fetchCurrentUser();
  if (!response.ok) {
    window.location.href = "/login.html";
    return;
  }
  currentUserID = data.user_id || "";
  renderSidebarFoot(data);
  await Promise.all([loadTeams(), loadInbox()]);
  if (teams.length > 0) {
    void openTeam(teams[0].id);
  }
}

void init();
