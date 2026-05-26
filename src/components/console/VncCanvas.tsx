// noVNC RFB canvas wrapped as a React component. Mirrors Terminal.tsx's
// shape: takes a wsURL (null = "not connecting yet") + an onStateChange
// callback for connection lifecycle. Handles the noVNC `credentialsrequired`
// event by prompting the operator inline (noVNC ships no built-in modal —
// the embedder must call sendCredentials).
//
// noVNC 1.7+ supports both standard VNC auth (security type 2) and Apple
// Auth (type 30 / ARD with DH + AES) natively. macOS Screen Sharing speaks
// RFB 003.889 + type 30 by default; the operator types their macOS login
// in our prompt and it goes through.
//
// noVNC is loaded lazily via dynamic import — its WebCodecs H264 probe
// uses top-level await which, even with splitting, can create surprises
// in some bundlers. Lazy load + await in async context = no surprises.

import { useEffect, useRef } from "react";

export type VncConnState = "connecting" | "connected" | "disconnected" | "error";

interface Props {
  /** WS URL to connect to. null = don't connect yet. */
  wsURL: string | null;
  onStateChange?: (state: VncConnState) => void;
}

type RFBClass = any;
let cachedRFB: RFBClass | undefined;
async function loadRFB(): Promise<RFBClass> {
  if (cachedRFB) return cachedRFB;
  const mod = await import("@novnc/novnc");
  cachedRFB = (mod as { default: RFBClass }).default;
  return cachedRFB;
}

export function VncCanvas({ wsURL, onStateChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wsURL || !containerRef.current) return;
    let cancelled = false;
    let rfb: any = null;
    onStateChange?.("connecting");
    if (statusRef.current) statusRef.current.textContent = "VNC 连接中...";

    void (async () => {
      const RFBCtor = await loadRFB();
      if (cancelled || !containerRef.current) return;
      rfb = new RFBCtor(containerRef.current, wsURL, { shared: true });
      rfb.scaleViewport = true;
      // resizeSession=false: don't ask the server to resize its
      // framebuffer. macOS Screen Sharing rejects that anyway and the
      // connection silently degrades.
      rfb.resizeSession = false;
      rfb.background = "#000";
      rfbRef.current = rfb;

      rfb.addEventListener("connect", () => {
        onStateChange?.("connected");
        if (statusRef.current) {
          statusRef.current.textContent = "VNC 已连接";
          // Fade out after a beat so it doesn't cover the desktop.
          setTimeout(() => {
            if (statusRef.current) {
              statusRef.current.style.transition = "opacity .8s";
              statusRef.current.style.opacity = "0";
            }
          }, 1500);
        }
      });

      rfb.addEventListener("disconnect", (ev: any) => {
        onStateChange?.("disconnected");
        if (statusRef.current) {
          statusRef.current.style.opacity = "1";
          statusRef.current.textContent = `VNC 已断开${ev?.detail?.clean === false ? "（异常）" : ""}`;
        }
      });

      rfb.addEventListener("securityfailure", (ev: any) => {
        const reason = ev?.detail?.reason || "unknown";
        onStateChange?.("error");
        if (statusRef.current) {
          statusRef.current.style.opacity = "1";
          statusRef.current.textContent = `VNC 认证失败: ${reason}`;
        }
        window.alert(
          `VNC 认证失败: ${reason}\n密码错？账号错？再试用 macOS 登录用户名 + 密码。`,
        );
      });

      // RFB fires this AFTER security-type negotiation. noVNC has no
      // built-in modal — embedder must call sendCredentials.
      // For Apple Auth (type 30) the server wants {username, password}
      // (macOS login). For standard VNC Auth (type 2) only {password}.
      rfb.addEventListener("credentialsrequired", () => {
        if (statusRef.current) statusRef.current.textContent = "等待凭据输入";
        const username =
          window.prompt(
            "VNC 用户名（标准 VNC 留空，Apple Auth 用 macOS 登录用户）",
            "",
          ) ?? "";
        const password = window.prompt("VNC 密码", "") ?? "";
        try {
          rfb.sendCredentials({ username, password, target: "" });
        } catch (err) {
          if (statusRef.current) {
            statusRef.current.textContent = `sendCredentials 失败: ${
              err instanceof Error ? err.message : String(err)
            }`;
          }
        }
      });
    })();

    return () => {
      cancelled = true;
      if (rfb) {
        try {
          rfb.disconnect();
        } catch {
          /* ignore */
        }
      }
      rfbRef.current = null;
    };
  }, [wsURL, onStateChange]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div
        ref={statusRef}
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(0,0,0,0.5)",
          color: "#fff",
          padding: "4px 8px",
          fontSize: 11,
          borderRadius: 4,
          fontFamily: "monospace",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />
    </div>
  );
}
