// Webmux-ported xterm component (translation of webmux/frontend/src/components/Terminal.tsx
// adapted to Polar's /shell/open + /ws/host byte-bridge protocol).
//
// What we kept from webmux verbatim:
// - userScrolled state via wheel + onScroll: tail-f when at bottom,
//   freeze on every chunk while reading history
// - Full ANSI 16-color palette + selection + cursor tint
// - macOptionIsMeta on Mac so emacs/vim Option-shortcuts pass through
// - WebLinksAddon with custom handler (open new tab, noreferrer)
// - Refs for the latest callbacks so xterm listeners don't capture
//   stale closures from re-renders
// - imperativeHandle exposing scrollToBottom / isAtBottom / sendInput
//   to the parent (so the Pane component can drive the terminal
//   without React props churn)
//
// What's polar-specific (NOT in webmux):
// - The WS we connect to is /ws/host/:id/shell/:run_id and it speaks
//   raw bytes (binary frames) both ways, plus a JSON {kind:"resize"}
//   control. webmux's WS is JSON envelopes both ways. So our message
//   handler is simpler than webmux's switch(msg.type).
// - Resize sends JSON {kind:"resize",rows,cols}; webmux sends
//   {type:"resize",cols,rows}.
// - We don't have viewer count / focus broadcast yet — those slots
//   exist as TODO placeholders in the parent so we can backfill
//   without re-touching this file.

import { useEffect, useImperativeHandle, useRef, forwardRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

export interface TerminalHandle {
  scrollToBottom: () => void;
  isAtBottom: () => boolean;
  fit: () => void;
  sendInput: (data: string) => void;
  /** Returns the current rows × cols so the parent can pass them
   *  to /shell/open before the WS connects. */
  measure: () => { rows: number; cols: number };
}

interface TerminalProps {
  /** The WS URL to bridge to. null means "don't connect yet"
   *  (parent is still resolving /shell/open). */
  wsURL: string | null;
  onStateChange: (state: ConnectionState) => void;
  /** Fires once after xterm mounts + first fit so the parent can
   *  call /shell/open with the right rows/cols. */
  onMeasured: (rows: number, cols: number) => void;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(function Terminal(
  { wsURL, onStateChange, onMeasured },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const userScrolledRef = useRef(false);
  const onStateChangeRef = useRef(onStateChange);
  const onMeasuredRef = useRef(onMeasured);
  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);
  useEffect(() => {
    onMeasuredRef.current = onMeasured;
  }, [onMeasured]);

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      userScrolledRef.current = false;
      termRef.current?.scrollToBottom();
    },
    isAtBottom: () => !userScrolledRef.current,
    fit: () => fitRef.current?.fit(),
    sendInput: (data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    },
    measure: () => ({
      rows: termRef.current?.rows ?? 30,
      cols: termRef.current?.cols ?? 100,
    }),
  }));

  // ---- mount xterm once -----------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "ui-monospace, 'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      fontSize: 12,
      cursorBlink: true,
      convertEol: false,
      scrollback: 5000,
      allowTransparency: false,
      macOptionIsMeta: /Mac|iPhone|iPad/.test(navigator.platform),
      theme: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        cursor: "#7c6af7",
        selectionBackground: "rgba(124, 106, 247, 0.35)",
        black: "#1a1a2e",
        red: "#ff5555",
        green: "#50fa7b",
        yellow: "#f1fa8c",
        blue: "#6272a4",
        magenta: "#ff79c6",
        cyan: "#8be9fd",
        white: "#f8f8f2",
        brightBlack: "#333333",
        brightRed: "#ff8080",
        brightGreen: "#80ffaa",
        brightYellow: "#ffff80",
        brightBlue: "#8080ff",
        brightMagenta: "#ffaadd",
        brightCyan: "#aaeeff",
        brightWhite: "#ffffff",
      },
    });
    const fit = new FitAddon();
    const links = new WebLinksAddon((_e, uri) => {
      window.open(uri, "_blank", "noopener,noreferrer");
    });
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);

    termRef.current = term;
    fitRef.current = fit;

    // Two rAFs so layout has settled before measure (vanilla console.ts
    // had the same dance — keep it here too).
    let cancelled = false;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          fit.fit();
        } catch {
          /* container not ready */
        }
        onMeasuredRef.current(term.rows, term.cols);
      }),
    );

    // userScrolled tracking — webmux pattern.
    const scrollListener = term.onScroll(() => {
      const b = term.buffer.active;
      if (userScrolledRef.current && b.viewportY >= b.baseY) {
        userScrolledRef.current = false;
      }
    });
    const wheelHandler = (e: WheelEvent) => {
      if (e.deltaY < 0) userScrolledRef.current = true;
    };
    containerRef.current.addEventListener("wheel", wheelHandler);

    // Container resize → re-fit (no scrollToBottom — see vanilla
    // postmortem in commit 877ebf3).
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        /* term may be disposed */
      }
    });
    ro.observe(containerRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      scrollListener.dispose();
      containerRef.current?.removeEventListener("wheel", wheelHandler);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // ---- WS bridge ------------------------------------------------------
  //
  // wsURL becomes non-null once /shell/open succeeds. We connect, wire
  // binary frames → term.write, control JSON ← term.onResize, and
  // term.onData → ws.send. Reconnect is the parent's job (the
  // ConsolePane re-mounts this component if it wants a fresh run).
  useEffect(() => {
    if (!wsURL || !termRef.current) return;
    onStateChangeRef.current("connecting");

    const term = termRef.current;
    const ws = new WebSocket(wsURL);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const sendResize = () => {
      try {
        fitRef.current?.fit();
      } catch {
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ kind: "resize", rows: term.rows, cols: term.cols }));
      }
    };

    const dataListener = term.onData((data) => {
      // Snap-to-bottom on user input — matches native terminal /
      // tmux UX. If the operator scrolled up to read history and
      // then types, they expect the viewport to jump back to the
      // live prompt so they can see what they're typing.
      userScrolledRef.current = false;
      term.scrollToBottom();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(new TextEncoder().encode(data));
      }
    });
    const resizeListener = term.onResize(() => sendResize());

    ws.addEventListener("open", () => {
      onStateChangeRef.current("connected");
      term.writeln(`\x1b[2m[console] connected\x1b[0m`);
      sendResize();
    });
    ws.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") return;
      const chunk = new Uint8Array(ev.data);
      try {
        if (userScrolledRef.current) {
          const savedY = term.buffer.active.viewportY;
          term.write(chunk, () => term.scrollToLine(savedY));
        } else {
          term.write(chunk);
        }
      } catch (err) {
        // Defensive: if xterm's parser throws on a malformed escape
        // sequence, keep the bridge alive. Without this, the message
        // handler dies + the WS effectively stops processing output.
        // eslint-disable-next-line no-console
        console.warn("[console] term.write threw, dropping chunk:", err);
      }
    });
    ws.addEventListener("close", (ev) => {
      onStateChangeRef.current("disconnected");
      term.writeln(`\r\n\x1b[2m[console] closed (code=${ev.code})\x1b[0m`);
      term.options.disableStdin = true;
    });
    ws.addEventListener("error", () => {
      onStateChangeRef.current("error");
      term.writeln(`\r\n\x1b[31m[console] WS error\x1b[0m`);
    });

    return () => {
      dataListener.dispose();
      resizeListener.dispose();
      if (ws.readyState <= WebSocket.OPEN) {
        try {
          ws.close(1000, "pane_closed");
        } catch {
          /* ignore */
        }
      }
      wsRef.current = null;
    };
  }, [wsURL]);

  const onClickFocus = useCallback(() => termRef.current?.focus(), []);

  return (
    <div
      ref={containerRef}
      onMouseDown={onClickFocus}
      style={{ width: "100%", height: "100%" }}
    />
  );
});
