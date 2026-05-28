// Types for /api/admin/asset-quotas and /api/admin/asset-providers.

import type { AssetQuota } from "./assets.js";

export interface AssetRootQuotaConfig {
  mode: "absolute" | "partition_pct" | string;
  value: number;
  workspace_default_bytes: number;
}

export interface AdminAssetQuotaListResponse {
  quotas: AssetQuota[];
  root_config: AssetRootQuotaConfig;
  root_cap_bytes: number;
}

export interface AdminAssetQuotaSetResponse {
  quota: AssetQuota;
  warning?: string;
  error?: string;
}

export interface AssetProvider {
  id: number;
  slug: string;
  base_url: string;
  region: string;
  capacity_gb: number;
  hmac_token?: string; // populated only on create response
  last_seen_at?: string | null;
  created_at: string;
}

export interface AdminAssetProviderListResponse {
  providers: AssetProvider[];
}

export interface AdminAssetProviderCreatePayload {
  slug: string;
  base_url: string;
  region: string;
  capacity_gb: number;
}

export interface AdminAssetProviderCreateResponse {
  provider: AssetProvider;
  hint?: string;
  error?: string;
}
