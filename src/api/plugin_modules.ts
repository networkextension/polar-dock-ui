import { request, requestJson } from "./http.js";
import type {
  PluginAccessRequestListResponse,
  PluginModuleCreatePayload,
  PluginModuleCreateResponse,
  PluginModuleListResponse,
  PluginModuleRotateKeyResponse,
} from "../types/plugin_modules.js";

export async function listPluginModules() {
  return requestJson<PluginModuleListResponse>("/api/admin/plugin-modules");
}

export async function createPluginModule(body: PluginModuleCreatePayload) {
  return requestJson<PluginModuleCreateResponse>("/api/admin/plugin-modules", {
    method: "POST",
    body: { ...body },
  });
}

export async function enablePluginModule(name: string) {
  return requestJson<{ ok: boolean }>(
    `/api/admin/plugin-modules/${encodeURIComponent(name)}/enable`,
    { method: "PATCH" },
  );
}

export async function disablePluginModule(name: string) {
  return requestJson<{ ok: boolean }>(
    `/api/admin/plugin-modules/${encodeURIComponent(name)}/disable`,
    { method: "PATCH" },
  );
}

export async function rotatePluginModuleKey(name: string) {
  return requestJson<PluginModuleRotateKeyResponse>(
    `/api/admin/plugin-modules/${encodeURIComponent(name)}/rotate-key`,
    { method: "POST" },
  );
}

export async function deletePluginModule(name: string) {
  return request(`/api/admin/plugin-modules/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

// ── R3 marketplace ───────────────────────────────────────────────────

export async function setPluginModulePublished(name: string, published: boolean) {
  return requestJson<{ ok: boolean; published: boolean }>(
    `/api/admin/plugin-modules/${encodeURIComponent(name)}/publish`,
    { method: "PATCH", body: { published } },
  );
}

export async function setPluginModuleAcceptsApplications(name: string, accepts: boolean) {
  return requestJson<{ ok: boolean; accepts_applications: boolean }>(
    `/api/admin/plugin-modules/${encodeURIComponent(name)}/accepts-applications`,
    { method: "PATCH", body: { accepts } },
  );
}

export async function listPluginAccessRequests() {
  return requestJson<PluginAccessRequestListResponse>("/api/admin/plugin-access-requests");
}

export async function approvePluginAccessRequest(id: number) {
  return requestJson<{ ok: boolean; status: string }>(
    `/api/admin/plugin-access-requests/${id}/approve`,
    { method: "POST" },
  );
}

export async function denyPluginAccessRequest(id: number) {
  return requestJson<{ ok: boolean; status: string }>(
    `/api/admin/plugin-access-requests/${id}/deny`,
    { method: "POST" },
  );
}
