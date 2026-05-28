// Typed fetch wrappers for the admin asset endpoints
// (/api/admin/asset-quotas, /api/admin/asset-providers).

import { requestJson } from "./http.js";
import type {
  AdminAssetProviderCreatePayload,
  AdminAssetProviderCreateResponse,
  AdminAssetProviderListResponse,
  AdminAssetQuotaListResponse,
  AdminAssetQuotaSetResponse,
} from "../types/admin-assets.js";

export async function listAdminAssetQuotas() {
  return requestJson<AdminAssetQuotaListResponse>("/api/admin/asset-quotas");
}

export async function setAdminAssetQuota(
  workspaceID: string,
  quotaBytes: number,
) {
  return requestJson<AdminAssetQuotaSetResponse>(
    `/api/admin/asset-quotas/${encodeURIComponent(workspaceID)}`,
    {
      method: "PATCH",
      body: { quota_bytes: quotaBytes },
    },
  );
}

export async function listAdminAssetProviders() {
  return requestJson<AdminAssetProviderListResponse>(
    "/api/admin/asset-providers",
  );
}

export async function createAdminAssetProvider(
  payload: AdminAssetProviderCreatePayload,
) {
  return requestJson<AdminAssetProviderCreateResponse>(
    "/api/admin/asset-providers",
    {
      method: "POST",
      body: { ...payload } as Record<string, unknown>,
    },
  );
}

export async function deleteAdminAssetProvider(id: number) {
  return requestJson<{ ok: boolean; error?: string }>(
    `/api/admin/asset-providers/${id}`,
    { method: "DELETE" },
  );
}
