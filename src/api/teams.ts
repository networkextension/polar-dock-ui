import { requestJson } from "./http.js";
import type {
  AdminInvitationCreatePayload,
  AdminInvitationCreateResponse,
  AdminInvitationListResponse,
  InboxCountResponse,
  InboxInvitationListResponse,
  LogListResponse,
  TeamCreatePayload,
  TeamCreateResponse,
  TeamDetailResponse,
  TeamListResponse,
  TeamMemberRoleUpdatePayload,
  TeamMembersResponse,
  TeamTransferPayload,
  TeamUpdatePayload,
  TeamUpdateResponse,
} from "../types/teams.js";

export async function fetchTeams() {
  return requestJson<TeamListResponse>("/api/teams");
}

export async function fetchTeam(id: string) {
  return requestJson<TeamDetailResponse>(`/api/teams/${encodeURIComponent(id)}`);
}

export async function createTeam(payload: TeamCreatePayload) {
  return requestJson<TeamCreateResponse>("/api/teams", {
    method: "POST",
    body: payload,
  });
}

export async function updateTeam(id: string, payload: TeamUpdatePayload) {
  return requestJson<TeamUpdateResponse>(`/api/teams/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
}

export async function deleteTeam(id: string) {
  return requestJson<{ ok: boolean }>(`/api/teams/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function fetchTeamMembers(id: string) {
  return requestJson<TeamMembersResponse>(`/api/teams/${encodeURIComponent(id)}/members`);
}

// ---- invitations (admin-side, scoped under team) ------------------

export async function fetchTeamInvitations(id: string) {
  return requestJson<AdminInvitationListResponse>(`/api/teams/${encodeURIComponent(id)}/invitations`);
}

export async function createTeamInvitation(id: string, payload: AdminInvitationCreatePayload) {
  return requestJson<AdminInvitationCreateResponse>(`/api/teams/${encodeURIComponent(id)}/invitations`, {
    method: "POST",
    body: payload,
  });
}

export async function revokeTeamInvitation(id: string, invID: string) {
  return requestJson<{ ok: boolean }>(`/api/teams/${encodeURIComponent(id)}/invitations/${encodeURIComponent(invID)}`, {
    method: "DELETE",
  });
}

// ---- members + ownership (T7) -------------------------------------

export async function updateTeamMemberRole(id: string, userID: string, payload: TeamMemberRoleUpdatePayload) {
  return requestJson<{ ok: boolean }>(
    `/api/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(userID)}`,
    { method: "PUT", body: payload },
  );
}

export async function removeTeamMember(id: string, userID: string) {
  return requestJson<{ ok: boolean; self_left: boolean }>(
    `/api/teams/${encodeURIComponent(id)}/members/${encodeURIComponent(userID)}`,
    { method: "DELETE" },
  );
}

export async function transferTeamOwnership(id: string, payload: TeamTransferPayload) {
  return requestJson<{ ok: boolean }>(
    `/api/teams/${encodeURIComponent(id)}/transfer`,
    { method: "POST", body: payload },
  );
}

// ---- invitations (recipient-side) ---------------------------------

export async function fetchMyInvitations() {
  return requestJson<InboxInvitationListResponse>("/api/users/me/invitations");
}

export async function fetchMyInvitationCount() {
  return requestJson<InboxCountResponse>("/api/users/me/invitations/count");
}

// ---- logs (workspace scope) ---------------------------------------

export async function fetchTeamLogs(id: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const path = `/api/teams/${encodeURIComponent(id)}/logs${qs ? "?" + qs : ""}`;
  return requestJson<LogListResponse>(path);
}

export async function fetchAdminLogs(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return requestJson<LogListResponse>(`/api/admin/logs${qs ? "?" + qs : ""}`);
}

export async function acceptInvitation(token: string) {
  return requestJson<{ team_id: string; role: string; error?: string }>(
    `/api/invitations/${encodeURIComponent(token)}/accept`,
    { method: "POST" },
  );
}

export async function declineInvitation(token: string) {
  return requestJson<{ ok: boolean; error?: string }>(
    `/api/invitations/${encodeURIComponent(token)}/decline`,
    { method: "POST" },
  );
}
