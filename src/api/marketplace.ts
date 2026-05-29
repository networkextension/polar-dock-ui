// R3-3b — tenant-facing marketplace calls. Unlike api/plugin_modules.ts
// (admin /api/admin/* CRUD), these are workspace-scoped /api/teams/:id/*
// endpoints gated by team role (list = member, apply = team-admin).

import { requestJson } from "./http.js";
import type {
  AvailableModulesResponse,
  PluginAccessRequest,
} from "../types/plugin_modules.js";

export async function listAvailableModules(teamID: string) {
  return requestJson<AvailableModulesResponse>(
    `/api/teams/${encodeURIComponent(teamID)}/available-modules`,
  );
}

export interface ApplyForModuleBody {
  plugin_name: string;
  scope?: "module" | "api";
  api_route?: string;
  reason?: string;
}

export async function applyForModule(teamID: string, body: ApplyForModuleBody) {
  return requestJson<{ request: PluginAccessRequest }>(
    `/api/teams/${encodeURIComponent(teamID)}/plugin-requests`,
    { method: "POST", body: { ...body } },
  );
}
