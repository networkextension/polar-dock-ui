// Typed wrappers for /api/rooms/* — qunliao P0c.

import { request, requestJson } from "./http.js";
import type {
  AgentLoop,
  AgentLoopListResponse,
  Room,
  RoomCreateResponse,
  RoomGetResponse,
  RoomKind,
  RoomListResponse,
  RoomMemberListResponse,
  RoomMessageListResponse,
  RoomMessageSendResponse,
  RoomRole,
} from "../types/room.js";

export async function fetchRooms(includeArchived = false) {
  const q = includeArchived ? "?include_archived=1" : "";
  return requestJson<RoomListResponse>(`/api/rooms${q}`);
}

export async function createRoom(body: { kind?: RoomKind; name?: string; topic?: string }) {
  return requestJson<RoomCreateResponse>("/api/rooms", {
    method: "POST",
    body: {
      kind: body.kind || "room",
      name: body.name || "",
      topic: body.topic || "",
    },
  });
}

export async function fetchRoom(id: number) {
  return requestJson<RoomGetResponse>(`/api/rooms/${id}`);
}

export async function updateRoom(id: number, body: { name?: string; topic?: string }) {
  return requestJson<{ ok: boolean }>(`/api/rooms/${id}`, { method: "PUT", body });
}

export async function archiveRoom(id: number) {
  return request(`/api/rooms/${id}`, { method: "DELETE" });
}

export async function fetchRoomMembers(id: number) {
  return requestJson<RoomMemberListResponse>(`/api/rooms/${id}/members`);
}

export async function addRoomMember(id: number, userId: string, role: RoomRole = "member") {
  return requestJson<{ ok: boolean }>(`/api/rooms/${id}/members`, {
    method: "POST",
    body: { user_id: userId, role },
  });
}

export async function removeRoomMember(id: number, userId: string) {
  return request(`/api/rooms/${id}/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export async function fetchRoomMessages(id: number, opts: { limit?: number; beforeId?: number } = {}) {
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.beforeId) q.set("before_id", String(opts.beforeId));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return requestJson<RoomMessageListResponse>(`/api/rooms/${id}/messages${suffix}`);
}

export async function sendRoomMessage(id: number, content: string, messageType = "text") {
  return requestJson<RoomMessageSendResponse>(`/api/rooms/${id}/messages`, {
    method: "POST",
    body: { content, message_type: messageType },
  });
}

// qunliao P3 — agent idle-loop config endpoints (owner-only on backend).

export async function fetchAgentLoops(id: number) {
  return requestJson<AgentLoopListResponse>(`/api/rooms/${id}/agent-loops`);
}

export async function saveAgentLoop(
  id: number,
  botUserId: string,
  body: { enabled: boolean; interval_secs: number; max_per_hour: number },
) {
  return requestJson<{ ok: boolean }>(`/api/rooms/${id}/agent-loops/${encodeURIComponent(botUserId)}`, {
    method: "PUT",
    body,
  });
}

export async function deleteAgentLoop(id: number, botUserId: string) {
  return request(`/api/rooms/${id}/agent-loops/${encodeURIComponent(botUserId)}`, { method: "DELETE" });
}

export type { AgentLoop, Room, RoomKind, RoomRole };
