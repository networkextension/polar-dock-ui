// Types for /api/rooms/* (qunliao P0c). Mirrors the Go structs in
// internal/app/dock/chat_rooms_store.go.

export type RoomKind = "room" | "dm" | "whisper" | "convene";
export type RoomRole = "owner" | "member" | "observer";

export interface Room {
  id: number;
  workspace_id: string;
  kind: RoomKind;
  name: string;
  topic: string;
  created_by_user_id: string;
  created_at: string;
  archived_at?: string;
}

export interface RoomMember {
  room_id: number;
  user_id: string;
  role: RoomRole;
  joined_at: string;
  last_read_message_id?: number;
  // Denormalized display fields populated by listChatRoomMembers
  // (JOIN users + LEFT JOIN bot_users). UI uses these instead of the
  // opaque user_id, and bot_name is the @mention token that the P1
  // fanout looks up by.
  username?: string;
  icon?: string;
  is_bot?: boolean;
  bot_name?: string;
}

// RoomMessage reuses the same chat_messages row shape as 1:1 DMs, just
// with room_id set instead of (or alongside) thread_id.
export interface RoomMessage {
  id: number;
  room_id?: number;
  thread_id?: number;
  llm_thread_id?: number;
  sender_id: string;
  sender_username: string;
  sender_icon: string;
  message_type: string;
  failed: boolean;
  content: string;
  created_at: string;
  llm_config_id?: number;
  llm_config_name?: string;
  llm_model?: string;
  // Qunliao β: per-message LLM call telemetry snapshot. Populated for
  // bot replies; null/0 on user posts. UI surfaces these via the
  // 📊 元数据 toggle on /rooms.html (default OFF).
  latency_ms?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost_usd?: number;
}

export interface RoomListResponse {
  rooms: Room[];
}
export interface RoomGetResponse {
  room: Room;
  member: RoomMember;
}
export interface RoomMemberListResponse {
  members: RoomMember[];
}
export interface RoomMessageListResponse {
  messages: RoomMessage[];
}
export interface RoomMessageSendResponse {
  message: {
    id: number;
    room_id: number;
    sender_id: string;
    message_type: string;
    content: string;
    created_at: string;
  };
}
export interface RoomCreateResponse {
  room: Room;
}

// qunliao P3 — per-(room, bot) "speak up on your own" config.
export interface AgentLoop {
  room_id: number;
  bot_user_id: string;
  enabled: boolean;
  interval_secs: number;       // 60-3600
  max_per_hour: number;        // 1-30
  last_decided_at?: string;
  last_posted_at?: string;
  decisions_this_hour: number;
  hour_window_start?: string;
}
export interface AgentLoopListResponse {
  loops: AgentLoop[];
}
