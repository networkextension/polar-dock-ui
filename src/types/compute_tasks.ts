// Types for the on-device compute-task queue (polar-task). Mirrors dock's
// AgentTask (internal/app/dock/agent_tasks_store.go) + TaskArtifact.

export type ComputeTask = {
  id: string;
  workspace_id: string;
  created_by: string;
  skill: string;
  input: unknown;
  constraints?: unknown;
  priority: number;
  status: string; // queued | running | done | failed
  agent_id?: string;
  result?: unknown;
  error?: string;
  created_at: string;
  claimed_at?: string;
  updated_at: string;
};

export type ComputeTaskArtifact = {
  kind: string;
  asset_id: number;
  mime: string;
  bytes: number;
  download_url?: string;
};

export type ComputeTaskListResponse = { tasks: ComputeTask[] };
export type ComputeTaskGetResponse = { task: ComputeTask; artifacts: ComputeTaskArtifact[] };

export type SubmitComputeTaskBody = {
  skill: string;
  input: unknown;
  priority?: number;
};
