// R2-4 — site-admin team-creation approval queue. Backed by the dock
// endpoints from #378: GET /api/admin/teams/pending + POST
// /api/admin/teams/:id/{approve,reject}.

import { requestJson } from "./http.js";

export interface PendingTeam {
  id: string;
  slug: string;
  name: string;
  description?: string;
  kind: string;
  status: string;
  owner_user_id: string;
  created_at: string;
}

export interface PendingTeamsResponse {
  teams: PendingTeam[];
}

export async function listPendingTeams() {
  return requestJson<PendingTeamsResponse>("/api/admin/teams/pending");
}

export async function approveTeam(id: string) {
  return requestJson<{ ok: boolean; status: string }>(
    `/api/admin/teams/${encodeURIComponent(id)}/approve`,
    { method: "POST" },
  );
}

export async function rejectTeam(id: string) {
  return requestJson<{ ok: boolean; status: string }>(
    `/api/admin/teams/${encodeURIComponent(id)}/reject`,
    { method: "POST" },
  );
}
