// Type definitions for the Host module (Phase 0).
// Mirror the Go-side structs in internal/app/dock/hosts_store.go.

import type { ErrorResponse } from "./dashboard.js";

export type AdvertisedSkill = {
  kind: string;
  version?: string;
  capabilities?: Record<string, unknown>;
};

// HostInfoGPU mirrors the agent's GPU probe payload. macOS fills
// vendor/model/cores from system_profiler; linux fills what lspci /
// /sys give us. Any field can be empty.
export type HostInfoGPU = {
  vendor?: string;
  model?: string;
  cores?: number;
};

// HostInfo is the hardware + OS report the agent posts on connect.
// All fields are optional: pre-v0.4 agents send {} and we render a
// "hardware info pending agent upgrade" hint instead of blank rows.
// Fields are intentionally flat (no nested OS struct) so json.Marshal
// on the Go side stays compatible with future renames.
export type HostInfo = {
  hw_model?: string;
  hw_vendor?: string;
  cpu_brand?: string;
  cpu_arch?: string;
  cpu_cores?: number;
  cpu_cores_perf?: number;
  cpu_cores_eff?: number;
  memory_bytes?: number;
  gpu?: HostInfoGPU;
  os_name?: string;
  os_version?: string;
  os_build?: string;
  os_release_type?: string;
  os_pretty?: string;
  virt?: string;
  kernel?: string;
  boot_unix?: number;
};

export type Host = {
  id: string;
  workspace_id: string;
  slug: string;
  name: string;
  agent_token_id?: string;
  os: string;
  arch: string;
  last_seen_ip?: string;
  advertised_skills?: AdvertisedSkill[];
  last_seen_at?: string;
  created_at: string;
  host_info?: HostInfo;
  host_info_seen_at?: string;
  // Agent Identity v4 / Phase F additions. Populated by the dock once
  // /api/hosts is updated to surface the new columns from the v4
  // schema migration (PR #355). Until then the field is undefined and
  // the UI shows "—". See doc/arch/agent-identity-v4.md.
  mem_peak_bytes?: number;
  cpu_peak_pct?: number;
  first_seen_at?: string;
  // Convenience: when the dock joins agents.count into the hosts
  // payload (currently not — see follow-up PR), we render the
  // "▾ 实例 (N)" footer with this number. Falls back to "?".
  agents_count?: number;
};

export type HostListResponse = ErrorResponse & {
  hosts?: Host[];
};

export type HostDetailResponse = ErrorResponse & {
  host?: Host;
};

export type HostEnrollPayload = {
  name: string;
};

export type HostEnrollResponse = ErrorResponse & {
  token?: string;
  expires_at?: string;
  host_name?: string;
  install_hint?: string;
};

// P1d additions ----------------------------------------------------------

export type HostSkill = {
  id: number;
  host_id: string;
  kind: string;
  name: string;
  config_json: Record<string, unknown>;
  enabled: boolean;
  auto_start: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type HostSkillWithHost = HostSkill & {
  host_slug: string;
  host_name: string;
};

export type HostSkillListResponse = ErrorResponse & {
  skills?: HostSkill[];
};

export type HostSkillsWithHostListResponse = ErrorResponse & {
  skills?: HostSkillWithHost[];
};

// P1c.4: credential vault. The raw `value` is NEVER returned from
// the server — only masked_value + the encrypted bit.
export type HostSkillCredential = {
  id: number;
  host_skill_id: number;
  key: string;
  masked_value: string;
  encrypted: boolean;
  last_used_at?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type HostSkillCredentialListResponse = ErrorResponse & {
  credentials?: HostSkillCredential[];
  encryption_active?: boolean;
};

// P2 (Shell skill) -------------------------------------------------------

export type ShellOpenResponse = ErrorResponse & {
  run_id?: number;
  ws_url?: string;
  host_id?: string;
  opened_at?: string;
};

export type ShellSession = {
  run_id: number;
  host_id: string;
  host_skill_id: number;
  operator_user_id: string;
  opened_at: string;
};

export type ShellSessionListResponse = ErrorResponse & {
  sessions?: ShellSession[];
};

// VNC skill --------------------------------------------------------------

export type VNCOpenResponse = ErrorResponse & {
  run_id?: number;
  ws_url?: string;
  host_id?: string;
  target?: string;
  opened_at?: string;
};

export type VNCSession = {
  run_id: number;
  host_id: string;
  host_skill_id: number;
  operator_user_id: string;
  opened_at: string;
  target?: string;
};

export type VNCSessionListResponse = ErrorResponse & {
  sessions?: VNCSession[];
};
