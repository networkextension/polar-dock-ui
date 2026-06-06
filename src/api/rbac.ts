// RBAC management API — backed by polar-dock's rbac_handlers.go.
// Permission catalog + per-workspace roles (system + custom) + member
// role assignment. The active workspace is sent as X-Workspace-Id by the
// shared http transport; these endpoints also take :id in the path so the
// page targets the workspace the admin picked in the switcher.

import { requestJson } from "./http.js";

export interface RBACPermission {
  key: string;
  module: string;
  action: string;
  description: string;
}

export interface RBACRole {
  id: number;
  key: string;
  name: string;
  is_system: boolean;
  is_global: boolean;
  permissions: string[];
}

export interface MemberRole {
  user_id: string;
  role_key: string;
  role_name: string;
}

export async function fetchPermissionCatalog() {
  return requestJson<{ permissions: RBACPermission[] }>("/api/rbac/permissions");
}

export async function fetchRoles(teamID: string) {
  return requestJson<{ roles: RBACRole[] }>(
    `/api/teams/${encodeURIComponent(teamID)}/roles`,
  );
}

export async function createRole(
  teamID: string,
  body: { key: string; name: string; permission_keys: string[] },
) {
  return requestJson<{ id: number; key: string }>(
    `/api/teams/${encodeURIComponent(teamID)}/roles`,
    { method: "POST", body },
  );
}

export async function updateRole(
  teamID: string,
  roleID: number,
  body: { name?: string; permission_keys: string[] },
) {
  return requestJson<{ id: number }>(
    `/api/teams/${encodeURIComponent(teamID)}/roles/${roleID}`,
    { method: "PUT", body },
  );
}

export async function deleteRole(teamID: string, roleID: number) {
  return requestJson<{ deleted: number }>(
    `/api/teams/${encodeURIComponent(teamID)}/roles/${roleID}`,
    { method: "DELETE" },
  );
}

export async function fetchMemberRoles(teamID: string) {
  return requestJson<{ member_roles: MemberRole[] }>(
    `/api/teams/${encodeURIComponent(teamID)}/member-roles`,
  );
}

export async function assignMemberRole(
  teamID: string,
  body: { user_id: string; role_key: string; revoke?: boolean },
) {
  return requestJson<{ user_id: string; role_key: string; revoked: boolean }>(
    `/api/teams/${encodeURIComponent(teamID)}/member-roles`,
    { method: "POST", body },
  );
}

// ---- workspace mounts (南北向 resource sharing) ------------------------

export interface WorkspaceMount {
  id: number;
  workspace_id: string;
  source_workspace_id: string;
  resource_kind: string;
  source_resource_id?: string;
  mode: string;
  created_by: string;
  created_at: string;
}

export async function fetchMounts(teamID: string) {
  return requestJson<{ mounts: WorkspaceMount[] }>(
    `/api/teams/${encodeURIComponent(teamID)}/mounts`,
  );
}

export async function createMount(
  teamID: string,
  body: {
    source_workspace_id: string;
    resource_kind: string;
    source_resource_id?: string;
    mode?: string;
  },
) {
  return requestJson<{ id: number }>(
    `/api/teams/${encodeURIComponent(teamID)}/mounts`,
    { method: "POST", body },
  );
}

export async function deleteMount(teamID: string, mountID: number) {
  return requestJson<{ deleted: number }>(
    `/api/teams/${encodeURIComponent(teamID)}/mounts/${mountID}`,
    { method: "DELETE" },
  );
}
