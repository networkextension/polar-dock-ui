// Typed fetch wrappers for /api/llm-proxy/tokens.

import { requestJson } from "./http.js";
import type {
  LLMProxyCallAggregateResponse,
  LLMProxyCallListResponse,
  LLMProxyRouteListResponse,
  LLMProxyRouteReplacePayload,
  LLMProxyTokenCreatePayload,
  LLMProxyTokenCreateResponse,
  LLMProxyTokenListResponse,
  LLMProxyTokenRevokeResponse,
} from "../types/llm_proxy.js";

export async function listProxyTokens() {
  return requestJson<LLMProxyTokenListResponse>("/api/llm-proxy/tokens");
}

export async function createProxyToken(payload: LLMProxyTokenCreatePayload) {
  return requestJson<LLMProxyTokenCreateResponse>("/api/llm-proxy/tokens", {
    method: "POST",
    body: payload,
  });
}

export async function revokeProxyToken(id: number) {
  return requestJson<LLMProxyTokenRevokeResponse>(`/api/llm-proxy/tokens/${id}`, {
    method: "DELETE",
  });
}

export async function fetchProxyTokenCalls(id: number, limit = 100) {
  return requestJson<LLMProxyCallListResponse>(
    `/api/llm-proxy/tokens/${id}/calls?limit=${limit}`,
  );
}

export async function fetchProxyTokenCallsAggregate(id: number, days = 7) {
  return requestJson<LLMProxyCallAggregateResponse>(
    `/api/llm-proxy/tokens/${id}/calls/aggregate?days=${days}`,
  );
}

export async function fetchProxyTokenRoutes(id: number) {
  return requestJson<LLMProxyRouteListResponse>(`/api/llm-proxy/tokens/${id}/routes`);
}

export async function replaceProxyTokenRoutes(id: number, payload: LLMProxyRouteReplacePayload) {
  return requestJson<LLMProxyRouteListResponse>(`/api/llm-proxy/tokens/${id}/routes`, {
    method: "PUT",
    body: payload,
  });
}
