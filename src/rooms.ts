// /rooms.html — qunliao P0c-2 multi-participant chat surface.
//
// Three columns: room list (left), messages (center), members (right).
// Reuses the existing /ws/chat WebSocket; filters on event.type ===
// "room_message". Sits alongside the 1:1 /chat.html surface; the two
// don't touch each other's state.

import {
  addRoomMember,
  archiveRoom,
  createRoom,
  deleteAgentLoop,
  fetchAgentLoops,
  fetchRoom,
  fetchRoomMembers,
  fetchRoomMessages,
  fetchRooms,
  removeRoomMember,
  saveAgentLoop,
  sendRoomMessage,
  updateRoom,
} from "./api/rooms.js";
import type { AgentLoop } from "./types/room.js";
import { fetchCurrentUser, logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { formatDateTime } from "./lib/datetime.js";
import { renderBubble, type BubbleMessage } from "./lib/message-bubble.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";
import type { Room, RoomMember, RoomMessage } from "./types/room.js";

initStoredTheme();
bindThemeSync();

// ---- DOM refs ----
const roomListEl = byId<HTMLUListElement>("roomList");
const roomCountEl = byId<HTMLElement>("roomCount");
const roomEmptyEl = byId<HTMLElement>("roomEmpty");
const roomLoadingEl = byId<HTMLElement>("roomLoading");
const roomRefreshBtn = byId<HTMLButtonElement>("roomRefreshBtn");
const newRoomBtn = byId<HTMLButtonElement>("newRoomBtn");

const activeRoomTitleEl = byId<HTMLElement>("activeRoomTitle");
const topicBarEl = byId<HTMLElement>("topicBar");
const topicTextEl = byId<HTMLElement>("topicText");
const topicEditBtn = byId<HTMLButtonElement>("topicEditBtn");
const wsStatusDotEl = byId<HTMLElement>("wsStatusDot");
const metadataToggle = byId<HTMLInputElement>("metadataToggle");
const messageScrollEl = byId<HTMLElement>("messageScroll");
const messageListEl = byId<HTMLElement>("messageList");
const sendForm = byId<HTMLFormElement>("sendForm");
const sendInput = byId<HTMLInputElement>("sendInput");
const sendBtn = byId<HTMLButtonElement>("sendBtn");

const memberListEl = byId<HTMLUListElement>("memberList");
const memberCountEl = byId<HTMLElement>("memberCount");
const memberEmptyEl = byId<HTMLElement>("memberEmpty");
const addMemberBtn = byId<HTMLButtonElement>("addMemberBtn");

const newRoomModal = byId<HTMLElement>("newRoomModal");
const newRoomCloseBtn = byId<HTMLButtonElement>("newRoomCloseBtn");
const newRoomCancelBtn = byId<HTMLButtonElement>("newRoomCancelBtn");
const newRoomSubmitBtn = byId<HTMLButtonElement>("newRoomSubmitBtn");
const newRoomNameInput = byId<HTMLInputElement>("newRoomName");
const newRoomTopicInput = byId<HTMLInputElement>("newRoomTopic");
const newRoomErrorEl = byId<HTMLElement>("newRoomError");
const logoutBtn = byId<HTMLButtonElement>("logoutBtn");

// ---- state ----
let rooms: Room[] = [];
let activeRoomId: number | null = null;
let activeMessages: RoomMessage[] = [];
let activeMembers: RoomMember[] = [];
let activeAgentLoops: Map<string, AgentLoop> = new Map();
// Captured at init for the bubble renderer's alignment (mine vs other).
// Empty string before the session call returns; bubbles then render every
// message as "other" until the first render after init resolves, which is
// fine — sender-id-based alignment, no flicker.
let currentUserId = "";

function escapeHTML(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---- room list ----
async function loadRooms(): Promise<void> {
  roomLoadingEl.hidden = false;
  roomEmptyEl.hidden = true;
  try {
    const { data } = await fetchRooms(false);
    rooms = data.rooms ?? [];
    renderRoomList();
  } catch (err) {
    roomListEl.innerHTML = "";
    roomEmptyEl.hidden = false;
    roomEmptyEl.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    roomLoadingEl.hidden = true;
  }
}

function renderRoomList(): void {
  roomCountEl.textContent = `${rooms.length}`;
  roomListEl.innerHTML = "";
  if (rooms.length === 0) {
    roomEmptyEl.hidden = false;
    return;
  }
  roomEmptyEl.hidden = true;
  rooms.forEach((r) => {
    const li = document.createElement("li");
    li.style.cssText = "padding:8px 10px; cursor:pointer; border-radius:6px; margin-bottom:2px;";
    if (r.id === activeRoomId) {
      li.style.background = "var(--accent-soft, #eef)";
    }
    const name = r.name || `房间 #${r.id}`;
    li.innerHTML = `<div style="font-weight:500;">${escapeHTML(name)}</div>` +
      (r.topic ? `<div class="meta-subtitle" style="font-size:11px;">${escapeHTML(r.topic)}</div>` : "");
    li.addEventListener("click", () => void switchRoom(r.id));
    roomListEl.appendChild(li);
  });
}

async function switchRoom(roomId: number): Promise<void> {
  activeRoomId = roomId;
  const r = rooms.find((x) => x.id === roomId);
  activeRoomTitleEl.textContent = r ? (r.name || `房间 #${r.id}`) : `房间 #${roomId}`;
  sendInput.disabled = false;
  sendBtn.disabled = false;
  addMemberBtn.disabled = false;
  renderRoomList();
  // Authoritative room + caller's membership (gives us the topic +
  // whether to show the ✎ owner-edit affordance). Fall through on err
  // — message + member loads can still proceed.
  void refreshTopicBar(roomId);
  await Promise.all([loadMessages(roomId), loadMembers(roomId)]);
}

async function refreshTopicBar(roomId: number): Promise<void> {
  try {
    const { data } = await fetchRoom(roomId);
    const topic = (data.room?.topic || "").trim();
    const isOwner = data.member?.role === "owner";
    topicBarEl.hidden = !topic && !isOwner;
    topicTextEl.textContent = topic || "（未设话题；bot 不受约束）";
    topicTextEl.style.fontStyle = topic ? "normal" : "italic";
    topicEditBtn.hidden = !isOwner;
  } catch {
    topicBarEl.hidden = true;
  }
}

topicEditBtn.addEventListener("click", async () => {
  if (!activeRoomId) return;
  const current = topicTextEl.textContent || "";
  const next = prompt(
    "房间话题（会自动加进 bot 的 system prompt 防止跑题）：",
    current.startsWith("（") ? "" : current,
  );
  if (next === null) return; // cancelled
  try {
    await updateRoom(activeRoomId, { topic: next.trim() });
    await refreshTopicBar(activeRoomId);
  } catch (err) {
    alert(`保存失败：${(err as Error).message}`);
  }
});

// ---- messages ----
async function loadMessages(roomId: number): Promise<void> {
  messageListEl.innerHTML = '<div class="meta-subtitle">加载中...</div>';
  try {
    const { data } = await fetchRoomMessages(roomId, { limit: 100 });
    // Backend returns newest-first; flip to oldest-first for display.
    activeMessages = (data.messages ?? []).slice().reverse();
    renderMessages();
  } catch (err) {
    messageListEl.innerHTML = `<div class="meta-subtitle" style="color:var(--danger,#c00);">加载失败：${escapeHTML((err as Error).message)}</div>`;
  }
}

function renderMessages(): void {
  const showMeta = showMetadataPref();
  messageListEl.innerHTML = activeMessages
    .map((m) =>
      renderBubble(m as BubbleMessage, {
        currentUserId,
        // Qunliao bot convention: sender_id has the `bot_` prefix when
        // a chat_room_members row points at a bot_user.
        isBot: (msg) => msg.sender_id.startsWith("bot_"),
        // Append the cost pill (rooms-only) to the meta footer.
        metaTrailer: showMeta ? (msg) => renderMetadataPill(msg as RoomMessage) : undefined,
      })
    )
    .join("");
  // Scroll to bottom.
  messageScrollEl.scrollTop = messageScrollEl.scrollHeight;
}

// renderMetadataPill returns a small chip with the LLM call telemetry
// snapshot saved on the message row. Empty string for non-bot messages
// (no LLM call → all metric fields nil/0). Cost formats in ¥ at 8x
// of recorded USD (rough placeholder; replace when admin sets fx rate).
function renderMetadataPill(m: RoomMessage): string {
  const parts: string[] = [];
  if (m.llm_model) parts.push(escapeHTML(m.llm_model));
  else if (m.llm_config_name) parts.push(escapeHTML(m.llm_config_name));
  if (m.latency_ms && m.latency_ms > 0) parts.push(`${(m.latency_ms / 1000).toFixed(1)}s`);
  const totalToks = (m.prompt_tokens || 0) + (m.completion_tokens || 0);
  if (totalToks > 0) parts.push(`${totalToks}t`);
  if (typeof m.cost_usd === "number" && m.cost_usd > 0) {
    parts.push(`$${m.cost_usd.toFixed(4)}`);
  }
  if (parts.length === 0) return "";
  return `<div style="margin-top:4px; font-size:10px; color:var(--text-muted,#888); font-family:monospace;">` +
    parts.join(" · ") + `</div>`;
}

// ── metadata-pill preference (localStorage-backed, default OFF) ──

const METADATA_PREF_KEY = "qunliao.showLLMMetadata";

function showMetadataPref(): boolean {
  try {
    return localStorage.getItem(METADATA_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

function setShowMetadataPref(v: boolean): void {
  try {
    localStorage.setItem(METADATA_PREF_KEY, v ? "1" : "0");
  } catch {
    /* private mode etc */
  }
}

metadataToggle.checked = showMetadataPref();
metadataToggle.addEventListener("change", () => {
  setShowMetadataPref(metadataToggle.checked);
  renderMessages();
});

function upsertMessage(m: RoomMessage): boolean {
  if (m.room_id !== activeRoomId) return false;
  if (activeMessages.some((x) => x.id === m.id)) return false;
  activeMessages.push(m);
  return true;
}

// ---- send ----
sendForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeRoomId) return;
  const text = sendInput.value.trim();
  if (!text) return;
  sendInput.disabled = true;
  sendBtn.disabled = true;
  try {
    await sendRoomMessage(activeRoomId, text);
    sendInput.value = "";
    // The WS event will push the row into activeMessages; if WS is
    // down, reload the list manually.
    if (!wsConnected) {
      await loadMessages(activeRoomId);
    }
  } catch (err) {
    alert(`发送失败：${(err as Error).message}`);
  } finally {
    sendInput.disabled = false;
    sendBtn.disabled = false;
    sendInput.focus();
  }
});

// ---- members ----
async function loadMembers(roomId: number): Promise<void> {
  memberListEl.innerHTML = "";
  memberEmptyEl.hidden = true;
  try {
    const { data } = await fetchRoomMembers(roomId);
    activeMembers = data.members ?? [];
    // Best-effort: load agent-loop config so member rows can show the
    // 🤖 toggle. 403 (non-owner) is expected for member-role callers —
    // we just leave the map empty and skip rendering the toggle.
    try {
      const loops = await fetchAgentLoops(roomId);
      activeAgentLoops = new Map((loops.data.loops ?? []).map((l) => [l.bot_user_id, l]));
    } catch {
      activeAgentLoops = new Map();
    }
    renderMembers();
  } catch (err) {
    memberListEl.innerHTML = `<div class="meta-subtitle" style="color:var(--danger,#c00);">${escapeHTML((err as Error).message)}</div>`;
  }
}

function renderMembers(): void {
  memberCountEl.textContent = `${activeMembers.length}`;
  if (activeMembers.length === 0) {
    memberEmptyEl.hidden = false;
    memberEmptyEl.textContent = "暂无成员";
    return;
  }
  memberEmptyEl.hidden = true;
  memberListEl.innerHTML = "";
  activeMembers.forEach((m) => {
    const li = document.createElement("li");
    li.style.cssText = "padding:6px 10px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border,#eee);";
    const roleBadge = m.role === "owner" ? "👑" : m.role === "observer" ? "👁" : "";
    // Bot detection comes from backend now (is_bot via LEFT JOIN
    // bot_users); fallback to the user_id prefix for old payloads.
    const isBot = !!m.is_bot || m.user_id.startsWith("bot_");
    const loop = activeAgentLoops.get(m.user_id);
    const loopDot = isBot && loop?.enabled ? "🟢" : isBot ? "💤" : "";
    const toggleBtn = isBot
      ? `<button class="btn-inline btn-secondary" data-loop="${escapeHTML(m.user_id)}" title="自主性" style="padding:2px 6px;">🤖${loopDot}</button>`
      : "";
    // Show the bot's @mention name (bot_users.name) so the user
    // knows what to type. For humans, show username with no @.
    const display = m.username || m.user_id;
    const mentionHint = isBot && m.bot_name
      ? ` <button class="btn-inline btn-secondary" data-mention="${escapeHTML(m.bot_name)}" title="插入 @${escapeHTML(m.bot_name)}" style="padding:2px 6px; font-family:monospace;">@${escapeHTML(m.bot_name)}</button>`
      : "";
    li.innerHTML = `<span style="flex:1;">${roleBadge} ${escapeHTML(display)}${mentionHint}</span>` +
      toggleBtn +
      `<button class="btn-inline btn-secondary" data-remove="${escapeHTML(m.user_id)}" title="移除" style="padding:2px 6px;">✕</button>`;
    // Clicking the @name chip inserts it into the send input.
    li.querySelector("[data-mention]")?.addEventListener("click", () => {
      const tok = `@${m.bot_name} `;
      const at = sendInput.selectionStart ?? sendInput.value.length;
      const before = sendInput.value.slice(0, at);
      const after = sendInput.value.slice(at);
      sendInput.value = before + tok + after;
      sendInput.focus();
      sendInput.selectionStart = sendInput.selectionEnd = (before + tok).length;
    });
    li.querySelector("[data-remove]")?.addEventListener("click", async () => {
      if (!activeRoomId) return;
      if (!confirm(`移除 ${m.user_id}？`)) return;
      try {
        await removeRoomMember(activeRoomId, m.user_id);
        await loadMembers(activeRoomId);
      } catch (err) {
        alert(`移除失败：${(err as Error).message}`);
      }
    });
    li.querySelector("[data-loop]")?.addEventListener("click", () => {
      if (!activeRoomId) return;
      void openAgentLoopDialog(activeRoomId, m.user_id, loop);
    });
    memberListEl.appendChild(li);
  });
}

async function openAgentLoopDialog(roomId: number, botUserId: string, current?: AgentLoop): Promise<void> {
  const enabled = confirm(
    `启用 bot 自主发言？\n\n点确定 = 启用，点取消 = 停用。\n` +
      `当前：${current?.enabled ? "已启用" : "未启用"}` +
      (current?.last_posted_at ? `\n上次发言：${formatDateTime(current.last_posted_at)}` : ""),
  );
  if (!enabled && !current) {
    return; // not currently configured + user chose disable → noop
  }
  const intervalStr = prompt("发言间隔（秒，60-3600）：", String(current?.interval_secs ?? 900));
  if (intervalStr === null) return;
  const interval = parseInt(intervalStr, 10);
  if (!interval || interval < 60 || interval > 3600) {
    alert("interval 必须 60-3600");
    return;
  }
  const maxStr = prompt("每小时上限：", String(current?.max_per_hour ?? 4));
  if (maxStr === null) return;
  const max = parseInt(maxStr, 10);
  if (!max || max < 1 || max > 30) {
    alert("max 必须 1-30");
    return;
  }
  try {
    if (!enabled && current) {
      await deleteAgentLoop(roomId, botUserId);
    } else {
      await saveAgentLoop(roomId, botUserId, { enabled, interval_secs: interval, max_per_hour: max });
    }
    await loadMembers(roomId);
  } catch (err) {
    alert(`保存失败：${(err as Error).message}`);
  }
}

addMemberBtn.addEventListener("click", async () => {
  if (!activeRoomId) return;
  const userId = prompt("user_id（成员或 bot 的 users.id）：");
  if (!userId) return;
  const role = (prompt("role: owner / member / observer", "member") || "member").trim();
  try {
    await addRoomMember(activeRoomId, userId.trim(), role as "owner" | "member" | "observer");
    await loadMembers(activeRoomId);
  } catch (err) {
    alert(`添加失败：${(err as Error).message}`);
  }
});

// ---- new room modal ----
newRoomBtn.addEventListener("click", () => {
  newRoomNameInput.value = "";
  newRoomTopicInput.value = "";
  newRoomErrorEl.textContent = "";
  newRoomModal.hidden = false;
  newRoomNameInput.focus();
});
newRoomCloseBtn.addEventListener("click", () => (newRoomModal.hidden = true));
newRoomCancelBtn.addEventListener("click", () => (newRoomModal.hidden = true));
newRoomSubmitBtn.addEventListener("click", async () => {
  const name = newRoomNameInput.value.trim();
  if (!name) {
    newRoomErrorEl.textContent = "请填名称";
    return;
  }
  newRoomSubmitBtn.disabled = true;
  try {
    const { data } = await createRoom({
      kind: "room",
      name,
      topic: newRoomTopicInput.value.trim(),
    });
    newRoomModal.hidden = true;
    await loadRooms();
    if (data.room?.id) await switchRoom(data.room.id);
  } catch (err) {
    newRoomErrorEl.textContent = `创建失败：${(err as Error).message}`;
  } finally {
    newRoomSubmitBtn.disabled = false;
  }
});

// ---- WebSocket ----
let ws: WebSocket | null = null;
let wsConnected = false;
let pollTimer: number | null = null;

function getWebSocketUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/chat`;
}

function setWSStatus(ok: boolean): void {
  wsConnected = ok;
  if (wsStatusDotEl) {
    wsStatusDotEl.style.color = ok ? "#10b981" : "#ef4444";
    wsStatusDotEl.title = ok ? "WS connected" : "WS disconnected (polling fallback)";
  }
}

function startPolling(): void {
  if (pollTimer != null) return;
  pollTimer = window.setInterval(() => {
    if (activeRoomId) void loadMessages(activeRoomId);
  }, 5000);
}
function stopPolling(): void {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

function connectWS(): void {
  try {
    ws = new WebSocket(getWebSocketUrl());
  } catch {
    setWSStatus(false);
    startPolling();
    return;
  }
  ws.addEventListener("open", () => {
    setWSStatus(true);
    stopPolling();
  });
  ws.addEventListener("close", () => {
    setWSStatus(false);
    startPolling();
    // Auto-reconnect after a beat. Avoids tight loops if upstream is
    // genuinely down — 5s matches what chat.ts uses.
    setTimeout(connectWS, 5000);
  });
  ws.addEventListener("error", () => {
    setWSStatus(false);
  });
  ws.addEventListener("message", (event) => {
    let payload: { type?: string; room_id?: number; message?: RoomMessage };
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload?.type !== "room_message") return;
    if (!payload.message) return;
    if (upsertMessage(payload.message)) {
      renderMessages();
    }
  });
}

// ---- bootstrap ----
roomRefreshBtn.addEventListener("click", () => void loadRooms());
logoutBtn?.addEventListener("click", () => {
  void logout().then(() => window.location.replace("/login.html"));
});

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  // Capture self-id BEFORE first loadRooms so the bubble renderer
  // aligns the current user's messages to the right on first paint.
  // fetchCurrentUser returns {response, data}; data.id is unset on 401.
  try {
    const { response, data } = await fetchCurrentUser();
    if (response.ok && data?.user_id) currentUserId = String(data.user_id);
  } catch {
    /* fall through — bubbles will all render as `other` (server still 401s on writes) */
  }
  await loadRooms();
  connectWS();
})();
