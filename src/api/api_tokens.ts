// Typed fetch wrappers for /api/api-tokens (open API tokens).
//
// requestJson auto-injects X-Workspace-Id + the session cookie, so these
// resolve against the caller's active workspace. Mirrors api/llm_proxy.ts.

import { requestJson } from "./http.js";
import type {
  ApiScopeCatalogResponse,
  ApiTokenCallListResponse,
  ApiTokenCallSummaryResponse,
  ApiTokenCreatePayload,
  ApiTokenCreateResponse,
  ApiTokenListResponse,
  ApiTokenRevokeResponse,
} from "../types/api_tokens.js";

export async function listApiTokens() {
  return requestJson<ApiTokenListResponse>("/api/api-tokens");
}

export async function listApiTokenScopes() {
  return requestJson<ApiScopeCatalogResponse>("/api/api-token-scopes");
}

export async function createApiToken(payload: ApiTokenCreatePayload) {
  return requestJson<ApiTokenCreateResponse>("/api/api-tokens", {
    method: "POST",
    body: payload,
  });
}

export async function revokeApiToken(id: number) {
  return requestJson<ApiTokenRevokeResponse>(`/api/api-tokens/${id}`, {
    method: "DELETE",
  });
}

export async function rotateApiToken(id: number) {
  return requestJson<ApiTokenCreateResponse>(`/api/api-tokens/${id}/rotate`, {
    method: "POST",
  });
}

export async function fetchApiTokenCalls(id: number, limit = 100) {
  return requestJson<ApiTokenCallListResponse>(`/api/api-tokens/${id}/calls?limit=${limit}`);
}

export async function fetchApiTokenCallsAggregate(id: number, days = 7) {
  return requestJson<ApiTokenCallSummaryResponse>(`/api/api-tokens/${id}/calls/aggregate?days=${days}`);
}
