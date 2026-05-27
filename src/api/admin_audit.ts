import { requestJson } from "./http.js";
import type {
  AdminAuditListResponse,
  AdminAuditQuery,
} from "../types/admin_audit.js";

function buildQuery(q: AdminAuditQuery): string {
  const params = new URLSearchParams();
  for (const id of q.actor_user_id ?? []) {
    if (id) params.append("actor_user_id", id);
  }
  for (const c of q.action_category ?? []) {
    if (c) params.append("action_category", c);
  }
  for (const a of q.action ?? []) {
    if (a) params.append("action", a);
  }
  for (const k of q.target_kind ?? []) {
    if (k) params.append("target_kind", k);
  }
  if (q.since) params.set("since", q.since);
  if (q.until) params.set("until", q.until);
  if (typeof q.limit === "number" && q.limit > 0) {
    params.set("limit", String(q.limit));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// Site-admin scoped audit log read. Returns 403 for non-site-admins —
// callers should branch on response.ok.
export async function listAdminAuditLog(q: AdminAuditQuery = {}) {
  return requestJson<AdminAuditListResponse>(
    `/api/admin/audit-log${buildQuery(q)}`,
  );
}

// Team-scoped audit log read. Any member of the team can call this.
export async function listTeamAdminActions(
  teamID: string,
  q: AdminAuditQuery = {},
) {
  return requestJson<AdminAuditListResponse>(
    `/api/teams/${encodeURIComponent(teamID)}/admin-actions${buildQuery(q)}`,
  );
}
