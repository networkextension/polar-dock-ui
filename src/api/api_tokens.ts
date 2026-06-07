// Typed fetch wrappers for /api/api-tokens (open API tokens).
//
// requestJson auto-injects X-Workspace-Id + the session cookie, so these
// resolve against the caller's active workspace. Mirrors api/llm_proxy.ts.

import { requestJson } from "./http.js";
import type {
  ApiTokenCreatePayload,
  ApiTokenCreateResponse,
  ApiTokenListResponse,
  ApiTokenRevokeResponse,
} from "../types/api_tokens.js";

export async function listApiTokens() {
  return requestJson<ApiTokenListResponse>("/api/api-tokens");
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
