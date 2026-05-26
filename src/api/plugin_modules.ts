import { request, requestJson } from "./http.js";
import type {
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
