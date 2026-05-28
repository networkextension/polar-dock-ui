// Typed fetch wrappers for /api/assets, /api/asset-quota,
// /api/share-links. Auth + workspace headers handled by requestJson.

import { requestJson } from "./http.js";
import type {
  Asset,
  AssetListResponse,
  AssetQuotaResponse,
  AssetShareLinkCreatePayload,
  AssetShareLinkCreateResponse,
  AssetShareLinkListResponse,
  AssetUploadResponse,
} from "../types/assets.js";

export interface ListAssetsOpts {
  kind?: string;
  namePrefix?: string;
  limit?: number;
  offset?: number;
}

export async function listAssets(opts: ListAssetsOpts = {}) {
  const q = new URLSearchParams();
  if (opts.kind) q.set("kind", opts.kind);
  if (opts.namePrefix) q.set("name_prefix", opts.namePrefix);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.offset) q.set("offset", String(opts.offset));
  const suffix = q.toString() ? `?${q}` : "";
  return requestJson<AssetListResponse>(`/api/assets${suffix}`);
}

export async function getAsset(id: number) {
  return requestJson<{ asset: Asset }>(`/api/assets/${id}`);
}

export interface UploadAssetInput {
  file: File;
  kind: string;
  name: string;
  version?: string;
  visibility?: string;
  source_url?: string;
  mime?: string;
  metadata?: Record<string, unknown>;
}

export async function uploadAsset(input: UploadAssetInput) {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("kind", input.kind);
  fd.append("name", input.name);
  if (input.version) fd.append("version", input.version);
  if (input.visibility) fd.append("visibility", input.visibility);
  if (input.source_url) fd.append("source_url", input.source_url);
  if (input.mime) fd.append("mime", input.mime);
  if (input.metadata) fd.append("metadata", JSON.stringify(input.metadata));
  return requestJson<AssetUploadResponse>("/api/assets", {
    method: "POST",
    body: fd,
  });
}

export async function deleteAsset(id: number) {
  return requestJson<{ ok: boolean; error?: string }>(`/api/assets/${id}`, {
    method: "DELETE",
  });
}

export async function getAssetQuota() {
  return requestJson<AssetQuotaResponse>(`/api/asset-quota`);
}

export async function createShareLink(
  assetID: number,
  payload: AssetShareLinkCreatePayload,
) {
  return requestJson<AssetShareLinkCreateResponse>(
    `/api/assets/${assetID}/share`,
    { method: "POST", body: { ...payload } as Record<string, unknown> },
  );
}

export async function listShareLinks() {
  return requestJson<AssetShareLinkListResponse>(`/api/share-links`);
}

export async function deleteShareLink(id: number) {
  return requestJson<{ ok: boolean; error?: string }>(
    `/api/share-links/${id}`,
    { method: "DELETE" },
  );
}
