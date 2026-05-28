// Types for /api/assets, /api/asset-quota, /api/share-links.
// Matches the JSON shapes shipped in PR #359 (P1a), #360 (P1b),
// #361 (P1c) on polar-dock.

export type AssetKind = "model" | "package" | "lib" | "media" | "app_data";
export type AssetVisibility = "private" | "workspace" | "link" | "public";

export interface Asset {
  id: number;
  workspace_id?: string | null;
  kind: AssetKind;
  name: string;
  version: string;
  sha256: string;
  size_bytes: number;
  mime: string;
  visibility: AssetVisibility;
  source_url?: string | null;
  uploaded_by: string;
  pinned: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AssetListResponse {
  assets: Asset[];
}

export interface AssetUploadResponse {
  asset: Asset;
  error?: string;
}

export interface AssetQuota {
  workspace_id: string;
  quota_bytes: number;
  usage_bytes: number;
  usage_computed_at?: string | null;
  over_quota: boolean;
  updated_at: string;
}

export interface AssetQuotaResponse {
  quota: AssetQuota;
}

export interface AssetShareLink {
  id: number;
  asset_id: number;
  short_code: string;
  created_by: string;
  expires_at?: string | null;
  max_downloads?: number | null;
  download_count: number;
  require_login: boolean;
  created_at: string;
}

export interface AssetShareLinkCreatePayload {
  expires_at?: string;
  max_downloads?: number;
  require_login?: boolean;
}

export interface AssetShareLinkCreateResponse {
  link: AssetShareLink;
  public_url: string;
}

export interface AssetShareLinkListResponse {
  links: AssetShareLink[];
}
