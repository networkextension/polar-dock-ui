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
  created_at: string;
  // Plaintext appears ONLY on POST /api/admin/plugin-modules and
  // POST /api/admin/plugin-modules/:name/rotate-key responses. Never
  // returned from list/get.
  plaintext?: string;
}

export interface PluginModuleListResponse {
  plugins: PluginModule[];
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
