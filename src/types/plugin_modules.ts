// Phase 1-A — admin types for the plugin registry. Mirrors
// internal/app/dock/plugin_modules_store.go::PluginModule. plaintext
// is present only in the create / rotate-key responses.

export interface PluginModule {
  name: string;
  display_name: string;
  enabled: boolean;
  endpoint?: string;
  last_heartbeat?: string;
  version?: string;
  // R3 marketplace: 上架 flag + per-module "tenants may request" toggle.
  published?: boolean;
  accepts_applications?: boolean;
  created_at: string;
  // Track 3 (OTA). latest_version is the newest published stable build;
  // update_available is (latest != running). target_version is the pinned
  // roll target ("" = follow latest); the module rolls on its next
  // heartbeat after it is set via the 更新 button.
  latest_version?: string;
  update_available?: boolean;
  target_version?: string;
  // Plaintext appears ONLY on POST /api/admin/plugin-modules and
  // POST /api/admin/plugin-modules/:name/rotate-key responses. Never
  // returned from list/get.
  plaintext?: string;
}

export interface PluginModuleListResponse {
  plugins: PluginModule[];
}

// R3 — a tenant team-admin's request for a published module (or a
// specific API route within it). Mirrors
// internal/app/dock/plugin_access_store.go::PluginAccessRequest.
export interface PluginAccessRequest {
  id: number;
  workspace_id: string;
  plugin_name: string;
  scope: "module" | "api";
  api_route?: string;
  status: "pending" | "approved" | "denied";
  requested_by_user_id: string;
  reviewed_by_user_id?: string;
  reason?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface PluginAccessRequestListResponse {
  requests: PluginAccessRequest[];
}

// R3-3b — one row of the tenant marketplace discovery view. Mirrors
// internal/app/dock/plugin_access_store.go::AvailableModule.
export interface AvailableModule {
  name: string;
  display_name: string;
  accepts_applications: boolean;
  enabled: boolean;          // workspace_plugin_access granted+enabled
  pending_request: boolean;  // an open request already exists
}

export interface AvailableModulesResponse {
  modules: AvailableModule[];
}
export interface PluginModuleCreatePayload {
  name: string;
  display_name?: string;
  endpoint?: string;
}
export interface PluginModuleCreateResponse {
  plugin: PluginModule;
}
export interface PluginModuleRotateKeyResponse {
  plaintext: string;
}
