// types/skills.ts — wire shapes for the P1b skill marketplace UI.
//
// Mirror of polar-hosts/internal/hosts/skill_catalog_store.go and
// polar-dock/internal/app/dock/skill_install_handlers.go. Update
// both sides together when changing.

export interface SkillCatalogEntry {
  id: string;
  publisher: string;
  skill_kind: string;
  version: string;
  sha256: string;
  download_url: string;
  size_bytes: number;
  manifest_json: unknown;
  display_name: string;
  description: string;
  license: string;
  homepage: string;
  publisher_pubkey?: string;
  signed_at?: string;
  is_platform: boolean;
  workspace_id?: string;
  created_by: string;
  created_at: string;
  retired_at?: string;
}

export interface SkillCatalogListResponse {
  items: SkillCatalogEntry[];
}

export interface SkillCatalogDetailResponse {
  item: SkillCatalogEntry;
}

export interface HostSkillInstallTriggerResponse {
  install_id: string;
  host_id: string;
  catalog_id: string;
  sent_at: string;
  hint: string;
}

export interface HostSkillUninstallTriggerResponse {
  uninstall_id: string;
  host_id: string;
  sent_at: string;
}

// Light shape for the hosts list — we only need (id, name, slug)
// to render the install target picker. /api/hosts already returns
// these fields; we just type them locally here.
export interface SkillsPageHost {
  id: string;
  name: string;
  slug: string;
}

// Per-(host, kind) install state assembled client-side by joining
// /api/hosts/:id/skills with the catalog list. publisher + version
// pinpoint exactly which catalog row this row corresponds to.
export interface HostSkillRow {
  id: number;
  host_id: string;
  kind: string;
  name: string;
  publisher?: string;
  install_id?: string;
  source?: string; // builtin | bundle
  enabled: boolean;
  auto_start: boolean;
  updated_at: string;
}

export interface HostSkillListResponse {
  items: HostSkillRow[];
}

export interface HostsListResponse {
  items: SkillsPageHost[];
}
