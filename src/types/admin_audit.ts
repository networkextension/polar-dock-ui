// AdminAuditRow — one entry from /api/admin/audit-log (site-admin)
// or /api/teams/:id/admin-actions (team-scoped view).
//
// Shape matches the JSON the backend ships (polar-dock #349/#350).
// payload is whatever the originating action put there — never trust
// its shape; we render it as JSON.
export type AdminAuditRow = {
  id: number;
  actor_user_id: string;
  actor_username?: string;
  actor_role: string;
  action_category: string;
  action: string;
  target_team_id?: string;
  target_kind?: string;
  target_id?: string;
  payload?: Record<string, unknown>;
  note?: string;
  source_ip?: string;
  user_agent?: string;
  created_at: string;
};

export type AdminAuditListResponse = {
  rows: AdminAuditRow[];
  limit: number;
  count: number;
};

export type AdminAuditQuery = {
  actor_user_id?: string[];
  action_category?: string[];
  action?: string[];
  target_kind?: string[];
  since?: string;
  until?: string;
  limit?: number;
};
