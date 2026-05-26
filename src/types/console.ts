// Types for /console.html saved layouts.

import type { ErrorResponse } from "./dashboard.js";

export type ConsolePaneConfig = {
  host_id: string;
  host_skill_id: number;
  // kind: skill type the pane was started against. Optional for
  // backward compatibility — layouts saved before VNC support omit
  // this field; the pane defaults to "shell" on restore. The persisted
  // form lives in jsonb so adding the field is non-breaking.
  kind?: string;
};

export type ConsoleLayout = {
  id: number;
  workspace_id: string;
  owner_user_id: string;
  name: string;
  panes_config: ConsolePaneConfig[];
  created_at: string;
  updated_at: string;
};

export type ConsoleLayoutListResponse = ErrorResponse & {
  layouts?: ConsoleLayout[];
};

export type ConsoleLayoutResponse = ErrorResponse & {
  layout?: ConsoleLayout;
};

export type ConsoleLayoutCreatePayload = {
  name: string;
  panes_config: ConsolePaneConfig[];
};

export type ConsoleLayoutUpdatePayload = {
  name?: string;
  panes_config?: ConsolePaneConfig[];
};
