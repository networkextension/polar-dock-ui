// Typed fetch wrappers for /api/console/layouts/*.

import { requestJson } from "./http.js";
import type {
  ConsoleLayoutCreatePayload,
  ConsoleLayoutListResponse,
  ConsoleLayoutResponse,
  ConsoleLayoutUpdatePayload,
} from "../types/console.js";

export async function fetchConsoleLayouts() {
  return requestJson<ConsoleLayoutListResponse>("/api/console/layouts");
}

export async function createConsoleLayout(payload: ConsoleLayoutCreatePayload) {
  return requestJson<ConsoleLayoutResponse>("/api/console/layouts", {
    method: "POST",
    body: payload,
  });
}

export async function updateConsoleLayout(id: number, payload: ConsoleLayoutUpdatePayload) {
  return requestJson<ConsoleLayoutResponse>(`/api/console/layouts/${id}`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteConsoleLayout(id: number) {
  return requestJson<{ ok: boolean; error?: string }>(`/api/console/layouts/${id}`, {
    method: "DELETE",
  });
}
