// Mirrors internal/app/dock/sysinfo.go SystemHostInfo. Served by the
// public GET /api/system/info endpoint — no auth, no Workspace header
// needed. Deploy tooling can hit this on a fresh box.

export type SystemHostIP = {
  interface: string;
  address: string;
  family: "ipv4" | "ipv6";
};

export type SystemHostDisk = {
  mount: string;
  filesystem?: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  used_pct: number;
};

export type SystemHostMemory = {
  total_bytes: number;
  available_bytes?: number;
};

export type SystemHostCPU = {
  count: number;
  model?: string;
};

export type SystemHostVersion = {
  git_sha?: string;
  git_branch?: string;
  git_dirty?: boolean;
  build_time?: string;
  go: string;
  module?: string;
};

export type SystemHostDBPool = {
  open: number;
  in_use: number;
  idle: number;
  wait_count: number;
};

export type SystemHostRuntime = {
  process_uptime_seconds: number;
  goroutines: number;
  heap_alloc_bytes: number;
  heap_sys_bytes: number;
  gc_runs: number;
  db_pool?: SystemHostDBPool;
};

export type SystemHostInfo = {
  hostname: string;
  os: string;
  arch: string;
  uname?: string;
  version: SystemHostVersion;
  uptime_seconds: number;
  ip_addresses: SystemHostIP[];
  disks: SystemHostDisk[];
  memory: SystemHostMemory;
  cpu: SystemHostCPU;
  runtime?: SystemHostRuntime;
  sampled_at: string;
};
