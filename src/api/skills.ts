// api/skills.ts — REST client for the P1b skill marketplace.
//
// Catalog lives in polar-hosts; install/uninstall triggers live in
// dock. Both reachable via the same /api/* prefix through nginx.

import { requestJson } from "./http.js";
import type {
  SkillCatalogListResponse,
  SkillCatalogDetailResponse,
  HostSkillInstallTriggerResponse,
  HostSkillUninstallTriggerResponse,
  HostsListResponse,
  HostSkillListResponse,
} from "../types/skills.js";

export function listSkillCatalog(includeRetired = false) {
  const qs = includeRetired ? "?include_retired=true" : "";
  return requestJson<SkillCatalogListResponse>(`/api/skill-catalog${qs}`);
}

export function getSkillCatalogEntry(id: string) {
  return requestJson<SkillCatalogDetailResponse>(`/api/skill-catalog/${id}`);
}

export function retireSkillCatalogEntry(id: string) {
  return requestJson<{ ok: boolean }>(`/api/skill-catalog/${id}/retire`, {
    method: "POST",
  });
}

export function installSkillOnHost(hostID: string, catalogID: string) {
  return requestJson<HostSkillInstallTriggerResponse>(
    `/api/hosts/${hostID}/skills/install`,
    {
      method: "POST",
      body: { catalog_id: catalogID },
    },
  );
}

export function uninstallSkillOnHost(
  hostID: string,
  publisher: string,
  skillKind: string,
  version: string,
  force = false,
) {
  return requestJson<HostSkillUninstallTriggerResponse>(
    `/api/hosts/${hostID}/skills/uninstall`,
    {
      method: "POST",
      body: { publisher, skill_kind: skillKind, version, force },
    },
  );
}

export function listHosts() {
  return requestJson<HostsListResponse>("/api/hosts");
}

export function listHostSkills(hostID: string) {
  return requestJson<HostSkillListResponse>(`/api/hosts/${hostID}/skills`);
}
