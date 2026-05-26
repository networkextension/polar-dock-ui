// One tile in the grid. Three internal states:
//   "picker"  → empty, shows the host/skill picker (shell or vnc)
//   "running" → connected to a live shell OR vnc run; renders the
//               appropriate body (Terminal for shell, VncCanvas for vnc)
//   "error"   → /open failed; shows the error + "重新选择"
//
// Two start paths:
//   - Fresh start (from picker): POST /shell/open or /vnc/open with
//     measured rows/cols, get run_id + ws_url back.
//   - Reattach (autofill.runId given): skip /open entirely, construct
//     ws_url client-side, connect WS directly. This is what makes
//     refresh / saved-layout-load reattach to the SAME live PTY/VNC
//     instead of spawning a new one. Dock-side /open always mints
//     fresh runs (the findActiveFor dedup was removed because it broke
//     the "two panes = two sessions" expectation).
//
// Layering trick: shell Terminal is always mounted from pane-mount so
// measure() returns accurate rows/cols. VNC mounts lazily because it
// has no measurement concern + the noVNC library is loaded async.

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Terminal, type ConnectionState, type TerminalHandle } from "./Terminal";
import { VncCanvas, type VncConnState } from "./VncCanvas";
import { HostSkillPicker, type PickerChoice } from "./HostSkillPicker";
import {
  kickHostShellSession,
  kickHostVNCSession,
  openHostShell,
  openHostVNC,
} from "../../api/hosts.js";
import type { Host, HostSkill } from "../../types/hosts.js";

export interface PaneHandle {
  /** Fully terminate the agent-side session (best effort). */
  closeFully: () => Promise<void>;
  /** Current (hostId, hostSkillId, kind, runId) for layout save / restore. */
  snapshot: () => { hostId?: string; hostSkillId?: number; kind?: string; runId?: number };
}

interface Props {
  paneId: string;
  hosts: Host[];
  skillsByHost: Map<string, HostSkill[]>;
  onSkillsResolved: (hostId: string, skills: HostSkill[]) => void;
  /** Pre-fill the picker / auto-start a session on mount.
   *  - When runId is set: reattach (skip /open, connect WS directly).
   *  - Else: fresh start via POST /open. */
  autofill?: { hostId: string; hostSkillId: number; kind?: string; runId?: number };
  onCloseRequested: () => void;
}

type Kind =
  | { kind: "picker" }
  | {
      kind: "running";
      skillKind: string; // "shell" | "vnc"
      hostId: string;
      hostSkillId: number;
      runId: number;
      wsURL: string;
    }
  | { kind: "error"; hostId: string; hostSkillId: number; reason: string };

// buildWSURL constructs the ws[s] URL for a known (host, kind, run_id).
// Used by the reattach path so we don't have to round-trip /open just
// to learn a URL we can compute ourselves.
function buildWSURL(hostId: string, kind: string, runId: number): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws/host/${hostId}/${kind}/${runId}`;
}

export const Pane = forwardRef<PaneHandle, Props>(function Pane(
  { paneId, hosts, skillsByHost, onSkillsResolved, autofill, onCloseRequested },
  ref,
) {
  const [state, setState] = useState<Kind>({ kind: "picker" });
  const [connState, setConnState] = useState<ConnectionState>("connecting");
  const [vncConnState, setVncConnState] = useState<VncConnState>("connecting");
  const termRef = useRef<TerminalHandle>(null);

  const start = useCallback(async (choice: PickerChoice) => {
    if (choice.kind === "vnc") {
      const { response, data } = await openHostVNC(choice.hostId, choice.hostSkillId, {});
      if (!response.ok || !data.ws_url || typeof data.run_id !== "number") {
        setState({
          kind: "error",
          hostId: choice.hostId,
          hostSkillId: choice.hostSkillId,
          reason: data.error || `HTTP ${response.status}`,
        });
        return;
      }
      setState({
        kind: "running",
        skillKind: "vnc",
        hostId: choice.hostId,
        hostSkillId: choice.hostSkillId,
        runId: data.run_id,
        wsURL: data.ws_url,
      });
      return;
    }
    // shell (default)
    // Terminal is mounted from the start, so measure() returns real
    // fitted dimensions after the rAF inside Terminal has settled.
    // The agent's PTY opens at exactly the right size.
    const termSize = termRef.current?.measure() || { rows: 30, cols: 100 };
    const { response, data } = await openHostShell(choice.hostId, choice.hostSkillId, {
      rows: termSize.rows,
      cols: termSize.cols,
      shell: choice.shell,
    });
    if (!response.ok || !data.ws_url || typeof data.run_id !== "number") {
      setState({
        kind: "error",
        hostId: choice.hostId,
        hostSkillId: choice.hostSkillId,
        reason: data.error || `HTTP ${response.status}`,
      });
      return;
    }
    setState({
      kind: "running",
      skillKind: "shell",
      hostId: choice.hostId,
      hostSkillId: choice.hostSkillId,
      runId: data.run_id,
      wsURL: data.ws_url,
    });
  }, []);

  // Autofill: two flavors
  //   1) {hostId, hostSkillId, kind?, runId} — REATTACH: known live
  //      session, skip /open, go straight to WS. Used by restore +
  //      saved-layout-load after the original session was alive.
  //   2) {hostId, hostSkillId, kind?} only — FRESH START via /open.
  //      Used by loading a saved layout that names hosts but doesn't
  //      have live runs.
  useEffect(() => {
    if (!autofill) return;
    const kind = autofill.kind || "shell";
    if (typeof autofill.runId === "number" && autofill.runId > 0) {
      setState({
        kind: "running",
        skillKind: kind,
        hostId: autofill.hostId,
        hostSkillId: autofill.hostSkillId,
        runId: autofill.runId,
        wsURL: buildWSURL(autofill.hostId, kind, autofill.runId),
      });
      return;
    }
    // Fresh-start fallback. Wait one tick so the Terminal can fit
    // before /shell/open captures its rows/cols.
    const id = window.setTimeout(() => {
      void start({
        hostId: autofill.hostId,
        hostSkillId: autofill.hostSkillId,
        kind,
      });
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // × handler — kick the agent-side session (shell or vnc) then ask
  // parent to drop us from the panes[] array.
  const onCloseClick = useCallback(async () => {
    if (state.kind === "running") {
      try {
        if (state.skillKind === "vnc") {
          await kickHostVNCSession(state.hostId, state.runId);
        } else {
          await kickHostShellSession(state.hostId, state.runId);
        }
      } catch {
        /* best effort — supervisor's agent_disconnect / idle timeout reaps */
      }
    }
    onCloseRequested();
  }, [state, onCloseRequested]);

  useImperativeHandle(
    ref,
    () => ({
      async closeFully() {
        if (state.kind === "running") {
          try {
            if (state.skillKind === "vnc") {
              await kickHostVNCSession(state.hostId, state.runId);
            } else {
              await kickHostShellSession(state.hostId, state.runId);
            }
          } catch {
            /* best effort */
          }
        }
      },
      snapshot() {
        if (state.kind === "running") {
          return {
            hostId: state.hostId,
            hostSkillId: state.hostSkillId,
            kind: state.skillKind,
            runId: state.runId,
          };
        }
        return {};
      },
    }),
    [state],
  );

  const hostName = (id: string) => hosts.find((h) => h.id === id)?.name || id;
  let title = "未选择";
  if (state.kind === "running") {
    const kindLabel = state.skillKind === "vnc" ? "vnc · " : "";
    title = `${hostName(state.hostId)} · ${kindLabel}run=${state.runId}`;
  } else if (state.kind === "error") {
    title = `${hostName(state.hostId)} · 失败`;
  }

  const isShellRunning = state.kind === "running" && state.skillKind === "shell";
  const isVncRunning = state.kind === "running" && state.skillKind === "vnc";
  const shellWsURL = isShellRunning ? state.wsURL : null;
  const vncWsURL = isVncRunning ? state.wsURL : null;
  const showPicker = state.kind === "picker";
  const showError = state.kind === "error";
  const showConnOverlay = isShellRunning && connState !== "connected";

  return (
    <div className="console-pane" data-pane-id={paneId}>
      <div className="console-pane-head">
        <span className="console-pane-title" title={title}>{title}</span>
        <button
          type="button"
          className="btn-inline"
          onClick={onCloseClick}
          title="关闭并终止 agent 端 session"
          style={{
            background: "#dc2626",
            color: "#fff",
            borderColor: "#dc2626",
            fontSize: 10,
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>
      <div className="console-pane-body">
        {/* Always-mounted Terminal (shell path). wsURL=null until /shell/open
            succeeds or we reattach with a known runId; Terminal's WS effect
            skips the bridge until wsURL is real. */}
        <div className="console-pane-term">
          <Terminal
            ref={termRef}
            wsURL={shellWsURL}
            onStateChange={setConnState}
            onMeasured={() => {
              /* parent doesn't need it post-mount */
            }}
          />
        </div>
        {isVncRunning && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
            }}
          >
            <VncCanvas wsURL={vncWsURL} onStateChange={setVncConnState} />
          </div>
        )}
        {showPicker && (
          <div className="console-pane-empty">
            <HostSkillPicker
              hosts={hosts}
              skillsByHost={skillsByHost}
              onSkillsResolved={onSkillsResolved}
              onStart={start}
            />
          </div>
        )}
        {showError && state.kind === "error" && (
          <div className="console-pane-empty">
            <div style={{ color: "#fca5a5" }}>
              无法启动 host={state.hostId} skill={state.hostSkillId}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{state.reason}</div>
            <button
              type="button"
              className="btn-inline btn-secondary"
              onClick={() => setState({ kind: "picker" })}
            >
              重新选择
            </button>
          </div>
        )}
        {showConnOverlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                connState === "error"
                  ? "rgba(60,13,13,0.6)"
                  : connState === "disconnected"
                  ? "rgba(13,13,26,0.7)"
                  : "rgba(13,13,26,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#aaa",
              fontSize: 13,
              pointerEvents: "none",
            }}
          >
            {connState === "connecting" && "Connecting..."}
            {connState === "disconnected" && "Disconnected"}
            {connState === "error" && "Connection error"}
          </div>
        )}
      </div>
    </div>
  );
});
