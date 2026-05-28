// Type definitions for the Agent module (Agent Identity v4 / Phase F).
//
// Mirrors the Go-side struct at
//   modules/polar-hosts/internal/hosts/hosts_store.go::Agent
// joined with hosts.{hw_model, arch} for the list/detail responses.
//
// As of 2026-05-27 the server-side handlers do NOT yet exist; this
// type file is written ahead of them so the UI compiles cleanly and
// gracefully renders an empty state when the endpoint 404s. See
// doc/arch/agent-identity-v4.md for the table shape.

import type { ErrorResponse } from "./dashboard.js";
import type { HostInfo } from "./hosts.js";

// Agent is the v4 logical-instance row. One host has N agents.
//
// Field names are snake_case to match the JSON tags on the Go side.
// We carry a small "host context" block (hw_model, arch from the
// hosts row) so the agents list can render "ag_a1b2 · Mac15,8 / arm64"
// without a second API round-trip per row.
export type Agent = {
  id: string;                          // ag_<random32hex>
  workspace_id: string;
  host_id: string;
  name: string;                        // operator label
  bot_user_id?: string;
  agent_token_id?: string;             // full id (we'll show last 8)
  agent_token_id_suffix?: string;      // last 8 chars (if server pre-trimmed)
  os?: string;                         // darwin / linux / freebsd
  arch?: string;                       // arm64 / amd64
  created_at: string;
  last_hello_at?: string;
  // Joined from hosts for context. Server may or may not populate;
  // UI falls back to host_id when missing.
  host_name?: string;                  // e.g. "Mac15,8 / arm64"
  host_hw_model?: string;
  // host_info is the per-host hardware/network blob (joined from
  // hosts.host_info_json). polar-hosts side surfaces it; dock side
  // currently returns a minimal agents shape that omits it. UI must
  // render gracefully when undefined.
  host_info?: HostInfo;
};

export type AgentListResponse = ErrorResponse & {
  agents?: Agent[];
};

export type AgentDetailResponse = ErrorResponse & {
  agent?: Agent;
};
