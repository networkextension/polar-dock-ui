// Type definitions for /api/api-tokens — see internal/app/dock/api_tokens_store.go.
//
// These are the dock's general-purpose "open API" tokens (Cloudflare-style
// apply-a-token for the public /api/* surface), distinct from the LLM-proxy
// keys in llm_proxy.ts. A token authenticates as its owner within the pinned
// workspace; the secret (polar_…) is shown exactly once on create.

import type { ErrorResponse } from "./dashboard.js";

export type ApiToken = {
  id: number;
  workspace_id: string;
  owner_user_id: string;
  name: string;
  prefix: string;
  scopes: string[];
  ip_allowlist?: string[];
  rate_limit_rpm: number;
  status: string; // "active" | "revoked"
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked_at?: string;
};

export type ApiTokenListResponse = ErrorResponse & {
  tokens?: ApiToken[];
};

export type ApiTokenCreatePayload = {
  name: string;
  scopes?: string[];
  ip_allowlist?: string[];
  expires_at?: string;
};

// One domain's grantable scopes for the create-token picker, from
// GET /api/api-token-scopes.
export type ApiScopeGroup = {
  domain: string;
  admin: boolean;
  scopes: string[];
};

// A registered plugin module's scopes, from its manifest
// (PUT /internal/v1/modules/{module}/manifest). Scope ids look like
// "<module>:<res>:<action>"; `name` is the human label to show.
export type ApiModuleScope = {
  id: string;
  name: string;
  sensitive?: boolean;
};

export type ApiModuleScopeGroup = {
  group: string;
  scopes: ApiModuleScope[];
};

// A named bundle of a module's scopes (e.g. 现场机 / 分析系统); clicking it
// in the picker checks exactly these scopes within that module.
export type ApiModulePreset = {
  id: string;
  name: string;
  scopes: string[];
};

export type ApiModuleScopes = {
  module: string;
  display_name?: string;
  groups?: ApiModuleScopeGroup[];
  presets?: ApiModulePreset[];
};

export type ApiScopeCatalogResponse = ErrorResponse & {
  groups?: ApiScopeGroup[];
  wildcard?: string;
  // Absent on docks that predate module manifests — treat as [].
  modules?: ApiModuleScopes[];
};

// POST returns the freshly-minted secret at the TOP level (`secret`), not
// nested under `token` — the server stores only the hash, so this is the one
// and only time the plaintext is visible.
export type ApiTokenCreateResponse = ErrorResponse & {
  secret?: string;
  hint?: string;
  token?: ApiToken;
};

export type ApiTokenRevokeResponse = ErrorResponse & {
  ok?: boolean;
};

// P2: per-call audit + usage summary.
export type ApiTokenCall = {
  id: number;
  token_id: number;
  workspace_id: string;
  method: string;
  path: string;
  status_code: number;
  scope: string;
  ip: string;
  latency_ms: number;
  created_at: string;
};

export type ApiTokenCallListResponse = ErrorResponse & {
  calls?: ApiTokenCall[];
};

export type ApiTokenCallSummary = {
  calls: number;
  ok_count: number;
  err_count: number;
  last_used?: string;
};

export type ApiTokenCallSummaryResponse = ErrorResponse & {
  summary?: ApiTokenCallSummary;
};
