// Typed fetch wrappers for polar-identity (unified person + biometric store).
// Reached at /api/identity/* (nginx proxies to identity-svc); session-cookie auth.

import { requestJson } from "./http.js";

export type IdSample = {
  id: string;
  modality: string;
  model_id: string;
  dim: number;
  source_asset_id?: number;
  locator?: { t0?: number; t1?: number; speaker?: string; frame_ts?: number; box?: number[]; face_index?: number };
  captured_from?: string;
  person_id?: string;
  created_at: string;
};
export type IdPerson = { id: string; display_name: string; notes?: string; created_at: string };
export type IdCandidate = { person_id: string; display_name: string; sample_id: string; score: number };

export function listSamples(q: string) {
  return requestJson<{ samples: IdSample[]; count: number }>(`/api/identity/samples${q}`);
}
export function listPeople() {
  return requestJson<{ people: IdPerson[]; count: number }>("/api/identity/people");
}
export function sampleCandidates(id: string, k = 5) {
  return requestJson<{ candidates: IdCandidate[]; count: number }>(
    `/api/identity/samples/${encodeURIComponent(id)}/candidates?k=${k}`);
}
export function sampleAudioURL(id: string) {
  return requestJson<{ url: string; asset_id: number }>(
    `/api/identity/samples/${encodeURIComponent(id)}/audio-url`);
}
export function attributeSample(id: string, body: { person_id?: string; new_person?: string }) {
  return requestJson<{ ok: boolean; person_id: string }>(
    `/api/identity/samples/${encodeURIComponent(id)}/attribute`, { method: "POST", body });
}
// Confirm many samples → one person in one call. Either pass explicit sample_ids
// (e.g. one face) OR a cluster spec {modality, speaker, source_asset_id?} which
// confirms EVERY unattributed segment of that speaker server-side (covers all,
// not just the loaded page).
export function attributeSamplesBulk(
  body: {
    sample_ids?: string[];
    modality?: string; speaker?: string; source_asset_id?: number;
    person_id?: string; new_person?: string;
  },
) {
  return requestJson<{ ok: boolean; person_id: string; count: number }>(
    `/api/identity/samples/attribute-bulk`, { method: "POST", body });
}
export type AttrTarget = {
  sample_ids?: string[]; modality?: string; speaker?: string; source_asset_id?: number;
};
// The /audio-url endpoint mints a signed URL for any source asset (audio OR a
// face keyframe image) — generic media.
export const sampleMediaURL = sampleAudioURL;

// Server-side clusters — the console renders one card per cluster instead of
// hundreds of per-sample cards.
export type IdVoiceCluster = {
  speaker: string; source_asset_id?: number; count: number;
  rep_sample_id: string; t0: number; t1: number; model_id: string; captured_from?: string;
};
export type IdFaceCluster = {
  rep_sample_id: string; rep_box?: number[]; member_ids: string[]; count: number; avg_area: number; model_id: string;
};
export function voiceClusters() {
  return requestJson<{ clusters: IdVoiceCluster[]; count: number }>(
    "/api/identity/samples/clusters?modality=voice");
}
// Merge two people into one (same-person).
export function mergePeople(from: string, into: string) {
  return requestJson<{ ok: boolean; moved: number; into: string }>(
    "/api/identity/people/merge", { method: "POST", body: { from, into } });
}
// Move samples (override) to a person / new person / back to 待确认 (unassign).
export function reassignSamples(body: { sample_ids: string[]; person_id?: string; new_person?: string; unassign?: boolean }) {
  return requestJson<{ ok: boolean; count: number; person_id: string }>(
    "/api/identity/samples/reassign", { method: "POST", body });
}
export type IdAutoSuggestion = {
  sample_id: string; modality: string; person_id: string; display_name: string; score: number; applied: boolean;
};
// 1-NN label propagation: learn from confirmed samples → auto-apply high-confidence
// matches + return medium-confidence ones to review. Reversible (attributed_by='auto').
export function autoLabel(modality: string, opts?: { autoThreshold?: number; suggestThreshold?: number; dryRun?: boolean }) {
  return requestJson<{
    applied: IdAutoSuggestion[]; applied_count: number; suggestions: IdAutoSuggestion[];
    auto_threshold: number; suggest_threshold: number;
  }>("/api/identity/auto-label", {
    method: "POST",
    body: { modality, auto_threshold: opts?.autoThreshold, suggest_threshold: opts?.suggestThreshold, dry_run: opts?.dryRun },
  });
}
export function faceClusters(opts?: { minArea?: number; threshold?: number }) {
  const q = new URLSearchParams();
  if (opts?.minArea != null) q.set("min_area", String(opts.minArea));
  if (opts?.threshold != null) q.set("threshold", String(opts.threshold));
  const qs = q.toString();
  return requestJson<{ clusters: IdFaceCluster[]; count: number; min_area: number; threshold: number }>(
    `/api/identity/faces/clusters${qs ? "?" + qs : ""}`);
}
