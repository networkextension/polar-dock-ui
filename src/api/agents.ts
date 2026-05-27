// Typed fetch wrappers for /api/agents/* (Agent Identity v4 / Phase F).
//
// As of 2026-05-27 these endpoints do NOT yet exist on the dock side;
// PR #355 only shipped the internal /internal/v1/agents/register chain
// + the agents table. A follow-up dock PR needs to add:
//
//   GET /api/agents                  (workspace-scoped list)
//   GET /api/agents/:id              (single)
//   GET /api/hosts/:host_id/agents   (per-host filter)
//
// The UI bundle is written to gracefully degrade when these 404:
// agents.ts catches !response.ok and renders an empty-state hint.
// Once the dock endpoints land, no client changes are needed.
//
// Mirrors src/api/hosts.ts shape.

import { requestJson } from "./http.js";
import type { AgentDetailResponse, AgentListResponse } from "../types/agents.js";

export async function fetchAgents() {
  return requestJson<AgentListResponse>("/api/agents");
}

export async function fetchAgent(id: string) {
  return requestJson<AgentDetailResponse>(`/api/agents/${encodeURIComponent(id)}`);
}

export async function fetchAgentsForHost(hostID: string) {
  return requestJson<AgentListResponse>(
    `/api/hosts/${encodeURIComponent(hostID)}/agents`,
  );
}

// TODO: when the dock ships POST /api/admin/agents/:id/kick (reset
// the WS conn for a misbehaving agent), wire it here. The UI has a
// placeholder action column but doesn't render a button until the
// endpoint exists.
//
// export async function kickAgent(id: string) {
//   return requestJson<{ ok: boolean; error?: string }>(
//     `/api/admin/agents/${encodeURIComponent(id)}/kick`,
//     { method: "POST" },
//   );
// }
