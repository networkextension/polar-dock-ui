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
