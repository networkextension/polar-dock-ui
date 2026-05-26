export type TeamKind = "personal" | "team";
export type TeamRole = "owner" | "admin" | "member" | "viewer";

export type Team = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar_url: string;
  kind: TeamKind;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};

export type TeamWithRole = Team & {
  my_role: TeamRole;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  username: string;
  email: string;
  icon_url: string;
  role: TeamRole;
  joined_at: string;
};

export type TeamListResponse = {
  teams: TeamWithRole[];
};

export type TeamDetailResponse = {
  team: Team;
  my_role: TeamRole;
};

export type TeamCreateResponse = {
  team: Team;
  my_role: TeamRole;
};

export type TeamUpdateResponse = {
  team: Team;
};

export type TeamMembersResponse = {
  members: TeamMember[];
};

export type TeamCreatePayload = {
  name: string;
  description?: string;
  avatar_url?: string;
};

export type TeamUpdatePayload = {
  name: string;
  description: string;
  avatar_url: string;
};

// Admin-side invitation view (shown in the team's invitations tab).
export type AdminInvitation = {
  id: string;
  team_id: string;
  email: string;
  role: TeamRole;
  inviter_user_id: string;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  invite_url: string;
  inviter_name: string;
  inviter_email: string;
  accepted_at?: string;
};

export type AdminInvitationListResponse = {
  invitations: AdminInvitation[];
};

export type AdminInvitationCreateResponse = {
  invitation: AdminInvitation;
  email_sent: boolean;
  email_send_disabled: boolean;
};

export type AdminInvitationCreatePayload = {
  email: string;
  role: TeamRole;
};

// Recipient-side inbox view.
export type InboxInvitation = {
  id: string;
  token: string;
  team_id: string;
  team_name: string;
  team_slug: string;
  team_avatar_url: string;
  role: TeamRole;
  inviter_name: string;
  expires_at: string;
  created_at: string;
};

export type InboxInvitationListResponse = {
  invitations: InboxInvitation[];
};

export type InboxCountResponse = {
  count: number;
};

export type TeamResourceCounts = {
  apps: number;
  certificates: number;
  profiles: number;
  asc_configs: number;
  llm_configs: number;
  bot_users: number;
  packtunnel_profiles: number;
  packtunnel_rules: number;
  video_projects: number;
};

export type TeamDeleteBlockedResponse = {
  error: string;
  resource_counts: TeamResourceCounts;
};

export type TeamTransferPayload = {
  new_owner_user_id: string;
};

export type TeamMemberRoleUpdatePayload = {
  role: TeamRole;
};

export type LogEntry = {
  id: number;
  category: "sign" | "team_audit" | "deploy" | "agent" | "server" | string;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  workspace_id?: string;
  actor_user_id?: string;
  actor_kind: "user" | "bot" | "system" | "agent";
  subject_kind?: string;
  subject_id?: string;
  action?: string;
  message: string;
  details?: Record<string, unknown>;
  request_id?: string;
  created_at: string;
};

export type LogListResponse = {
  entries: LogEntry[];
  scope: "workspace" | "site";
};
