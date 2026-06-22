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
