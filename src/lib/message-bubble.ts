// Shared bubble renderer for chat surfaces.
//
// /chat.html (1:1 chat) and /rooms.html (qunliao multi-bot rooms) both
// render a stream of messages. Both want the same visual: avatar + bubble
// + meta foot, with sender-side alignment (mine right, other left). The
// surface-specific bits (chat's streaming UI / attachment chips /
// shared-markdown cards / feedback action bar, rooms' metadata pill) are
// passed in as callbacks so neither surface leaks into the other.
//
// Returns a single `<div class="message-item ...">…</div>` per message.
// Caller is responsible for joining + assigning to innerHTML, and for
// wiring any event listeners (data-* attributes on the action buttons
// stay intact for jQuery-free delegation).

import { renderMarkdown } from "./marked.js";

export interface BubbleMessage {
    id: string | number;
    content: string;
    sender_id: string;
    sender_username?: string;
    sender_icon?: string;
    created_at: string;
    llm_model?: string;
    llm_config_name?: string;
    latency_ms?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    cost_usd?: number;
    deleted?: boolean;
    failed?: boolean;
}

export interface BubbleContext {
    /** Logged-in user's ID — anything from this sender renders as "mine" (right-aligned). */
    currentUserId: string;
    /** Decide whether a message is a bot reply. Surfaces have their own convention. */
    isBot: (m: BubbleMessage) => boolean;
    /** Optional content override. Default: renderMarkdown(content). */
    renderContent?: (m: BubbleMessage) => string;
    /** Optional extra HTML after the bubble (chat's action bar, etc.). */
    extraActions?: (m: BubbleMessage) => string;
    /** Optional extra HTML appended INSIDE the meta foot (rooms' metadata pill). */
    metaTrailer?: (m: BubbleMessage) => string;
    /** Optional time formatter. Default: toLocaleString. */
    formatTime?: (iso: string) => string;
    /** i18n string helper. Default: minimal English fallbacks. */
    t?: (key: string) => string;
}

const I18N_DEFAULTS: Record<string, string> = {
    "chat.revoked": "Message revoked",
    "chat.failed": "Failed",
    "chat.sendFailed": "Send failed",
    "chat.retry": "Retry",
};

function tDefault(key: string): string {
    return I18N_DEFAULTS[key] ?? key;
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[c] as string);
}

function formatLatency(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

/** Standalone meta-foot atom — `sender · model · time · latency · extras`.
 *
 * Returns the full `<div class="message-meta message-meta-foot">…</div>`
 * or empty string when no parts apply. Used by renderBubble's bot foot
 * AND by chat.ts directly (chat.ts builds its bubble inline because of
 * its many content-variant branches but wants the same meta foot HTML).
 */
export function renderBubbleMetaFoot(opts: {
    sender: string;
    model?: string;
    timestamp: string;
    latencyMs?: number;
    /** Pre-formatted HTML strings appended after latency (streaming pulse, failed badge, etc.). */
    extraParts?: string[];
}): string {
    const parts: string[] = [
        escapeHtml(opts.sender),
        opts.model ? escapeHtml(opts.model) : "",
        escapeHtml(opts.timestamp),
        opts.latencyMs && opts.latencyMs > 0 ? escapeHtml(formatLatency(opts.latencyMs)) : "",
        ...(opts.extraParts || []),
    ].filter(Boolean);
    if (parts.length === 0) return "";
    return `<div class="message-meta message-meta-foot">${parts.join(" · ")}</div>`;
}

function avatarHtml(m: BubbleMessage): string {
    if (m.sender_icon) {
        return `<img class="avatar-xs message-avatar" src="${escapeHtml(m.sender_icon)}" alt="${escapeHtml(m.sender_username || "")}" />`;
    }
    // Fallback: 1-char initial badge derived from username. Inline color
    // so this works on surfaces that don't ship the avatar.ts palette.
    const name = (m.sender_username || m.sender_id || "?").trim();
    const initial = name.slice(0, 1).toUpperCase();
    // Cheap deterministic hue from sender id (stable across reloads).
    let h = 0;
    for (let i = 0; i < m.sender_id.length; i++) h = (h * 31 + m.sender_id.charCodeAt(i)) >>> 0;
    const bg = `hsl(${h % 360}, 60%, 50%)`;
    return `<div class="avatar-xs message-avatar" style="background:${bg};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:13px;">${escapeHtml(initial)}</div>`;
}

export function renderBubble(m: BubbleMessage, ctx: BubbleContext): string {
    const t = ctx.t ?? tDefault;
    const formatTime = ctx.formatTime ?? ((iso: string) => new Date(iso).toLocaleString());

    const isMine = m.sender_id === ctx.currentUserId;
    const isBot = !isMine && ctx.isBot(m);
    const isFailedBot = isBot && Boolean(m.failed) && !m.deleted;

    // Body content. Default: render markdown. Overridable for streaming /
    // attachments / shared-markdown cards (chat.ts).
    const content = m.deleted
        ? `<em>${escapeHtml(t("chat.revoked"))}</em>`
        : ctx.renderContent
            ? ctx.renderContent(m)
            : renderMarkdown(m.content || "");

    const bubbleClass = m.deleted
        ? "message-bubble deleted"
        : "message-bubble";
    const contentClass = "message-bubble-content markdown-body";

    const failureBadge = isFailedBot
        ? `<div class="message-failure-badge">${escapeHtml(t("chat.sendFailed"))}</div>`
        : "";

    // Bot meta foot — sender · model · time · latency. User messages get
    // nothing (alignment + avatar already identify them).
    let footerHtml = "";
    if (isBot) {
        const trailer = ctx.metaTrailer ? ctx.metaTrailer(m) : "";
        footerHtml = renderBubbleMetaFoot({
            sender: m.sender_username || m.sender_id,
            model: m.llm_model || m.llm_config_name,
            timestamp: formatTime(m.created_at),
            latencyMs: m.latency_ms,
            extraParts: [
                isFailedBot ? escapeHtml(t("chat.failed")) : "",
                trailer,
            ].filter(Boolean),
        });
    } else if (ctx.metaTrailer) {
        // Non-bot messages may still want the trailer (rooms shows per-user
        // metadata too if/when enabled). Render it standalone.
        const trailer = ctx.metaTrailer(m);
        if (trailer) {
            footerHtml = `<div class="message-meta message-meta-foot">${trailer}</div>`;
        }
    }

    const extra = ctx.extraActions ? ctx.extraActions(m) : "";

    // Retry button on failed bot replies. data-id is what callers wire to.
    const retryButton = isFailedBot
        ? `<button class="message-retry btn-inline btn-secondary" data-id="${escapeHtml(String(m.id))}" type="button">${escapeHtml(t("chat.retry"))}</button>`
        : "";

    if (isMine) {
        return `<div class="message-item mine">` +
            `<div class="message-row">` +
                `<div class="${bubbleClass}">` +
                    `<div class="${contentClass}">${content}</div>` +
                    failureBadge +
                `</div>` +
            `</div>` +
            (footerHtml || "") +
        `</div>`;
    }
    return `<div class="message-item other">` +
        avatarHtml(m) +
        `<div class="message-body">` +
            `<div class="message-row">` +
                `<div class="${bubbleClass}">` +
                    `<div class="${contentClass}">${content}</div>` +
                    failureBadge +
                `</div>` +
                retryButton +
            `</div>` +
            (footerHtml || "") +
            (extra || "") +
        `</div>` +
    `</div>`;
}
