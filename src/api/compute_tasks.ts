// Typed fetch wrappers for the compute-task queue (polar-task).
//   GET  /api/compute-tasks       → { tasks }
//   GET  /api/compute-tasks/:id   → { task, artifacts }
//   POST /api/compute-tasks       → ComputeTask (submit)
// Session-cookie auth via requestJson (credentials:include). The list is
// workspace-scoped to the caller; admin/root verify their own workspace here.
// Fleet view reuses /api/agents (nginx-proxied to polar-hosts; tolerant of shape).

import { requestJson } from "./http.js";
import type {
  ComputeTask,
  ComputeTaskGetResponse,
  ComputeTaskListResponse,
  SubmitComputeTaskBody,
} from "../types/compute_tasks.js";

export async function listComputeTasks() {
  return requestJson<ComputeTaskListResponse>("/api/compute-tasks");
}

export async function getComputeTask(id: string) {
  return requestJson<ComputeTaskGetResponse>(`/api/compute-tasks/${encodeURIComponent(id)}`);
}

export async function submitComputeTask(body: SubmitComputeTaskBody) {
  return requestJson<ComputeTask>("/api/compute-tasks", { method: "POST", body });
}

// Best-effort fleet listing. Shape varies (polar-hosts owns it); the caller
// renders defensively. Returns the raw parsed JSON.
export async function listAgentsRaw() {
  return requestJson<unknown>("/api/agents");
}
