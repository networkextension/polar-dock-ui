// Top-level state container for /console.html. Owns:
// - the list of hosts (one fetch on mount)
// - the per-host skills cache (lazy, populated by Pane → HostSkillPicker)
// - the array of live panes (each pane is an independent <Pane>)
// - saved-layouts (CRUD via ./api/console-layouts)
// - the toolbar UI (layout-count select, saved-select, save / delete /
//   close-all buttons)
//
// Things the vanilla console.ts had that I'm keeping:
// - restoreActiveSessions on mount (so refresh reattaches to live runs)
// - the [1,2,3,4,6,9] pane-count grid
// - the same /api endpoints (no backend change)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pane, type PaneHandle } from "./Pane";
import {
  fetchHosts,
  fetchHostSkillsForHost,
  listHostShellSessions,
  listHostVNCSessions,
} from "../../api/hosts.js";
import {
  createConsoleLayout,
  deleteConsoleLayout,
  fetchConsoleLayouts,
  updateConsoleLayout,
} from "../../api/console-layouts.js";
import type { Host, HostSkill } from "../../types/hosts.js";
import type { ConsoleLayout } from "../../types/console.js";

const PANE_COUNTS = [1, 2, 3, 4, 6, 9];

function gridColsFor(n: number) {
  if (n <= 1) return 1;
  if (n <= 4) return 2;
  return 3;
}
function nearestLayoutCount(n: number) {
  for (const v of PANE_COUNTS) if (v >= n) return v;
  return PANE_COUNTS[PANE_COUNTS.length - 1];
}

interface PaneState {
  id: string;
  autofill?: { hostId: string; hostSkillId: number; kind?: string; runId?: number };
}

function newPaneId() {
  return "p" + Math.random().toString(36).slice(2, 8);
}

export function ConsoleApp() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [skillsByHost, setSkillsByHost] = useState<Map<string, HostSkill[]>>(new Map());
  const [panes, setPanes] = useState<PaneState[]>([]);
  const [targetCount, setTargetCount] = useState(4);
  const [layouts, setLayouts] = useState<Map<number, ConsoleLayout>>(new Map());
  const [selectedLayoutId, setSelectedLayoutId] = useState(0);
  const paneRefs = useRef<Map<string, PaneHandle>>(new Map());

  // ---- bootstrap ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { response, data } = await fetchHosts();
      if (cancelled || !response.ok) return;
      const list = data.hosts || [];
      setHosts(list);

      // Saved layouts
      const layoutsRes = await fetchConsoleLayouts();
      if (!cancelled && layoutsRes.response.ok && layoutsRes.data.layouts) {
        const map = new Map<number, ConsoleLayout>();
        for (const l of layoutsRes.data.layouts) map.set(l.id, l);
        setLayouts(map);
      }

      // Restore active sessions (shell + vnc). Each restored pane
      // carries the live run_id so it reattaches via direct WS — no
      // round-trip to /open, no risk of minting a duplicate run.
      const restored: PaneState[] = [];
      const newSkills = new Map<string, HostSkill[]>();
      await Promise.all(
        list.map(async (h) => {
          const [shellSessRes, vncSessRes, skillsRes] = await Promise.all([
            listHostShellSessions(h.id),
            listHostVNCSessions(h.id),
            fetchHostSkillsForHost(h.id),
          ]);
          if (skillsRes.response.ok && skillsRes.data.skills) {
            newSkills.set(h.id, skillsRes.data.skills);
          }
          const skillKindById = new Map<number, string>();
          for (const s of skillsRes.response.ok ? skillsRes.data.skills || [] : []) {
            skillKindById.set(s.id, s.kind);
          }
          if (shellSessRes.response.ok) {
            for (const s of shellSessRes.data.sessions || []) {
              if (skillKindById.get(s.host_skill_id) !== "shell") continue;
              restored.push({
                id: newPaneId(),
                autofill: {
                  hostId: s.host_id,
                  hostSkillId: s.host_skill_id,
                  kind: "shell",
                  runId: s.run_id,
                },
              });
            }
          }
          if (vncSessRes.response.ok) {
            for (const s of vncSessRes.data.sessions || []) {
              if (skillKindById.get(s.host_skill_id) !== "vnc") continue;
              restored.push({
                id: newPaneId(),
                autofill: {
                  hostId: s.host_id,
                  hostSkillId: s.host_skill_id,
                  kind: "vnc",
                  runId: s.run_id,
                },
              });
            }
          }
        }),
      );
      if (cancelled) return;
      setSkillsByHost(newSkills);
      if (restored.length > 0) {
        const target = nearestLayoutCount(restored.length);
        setTargetCount(target);
        // Pad with empty panes if restored count < target.
        const padded = [...restored];
        while (padded.length < target) padded.push({ id: newPaneId() });
        setPanes(padded);
      } else {
        // Fresh page: spawn empty panes matching default target.
        setPanes(Array.from({ length: 4 }, () => ({ id: newPaneId() })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- pane-count selector --------------------------------------------
  // When operator changes the count, add empty panes / drop the oldest
  // empty ones first (don't kill running shells unexpectedly).
  useEffect(() => {
    setPanes((cur) => {
      if (cur.length === targetCount) return cur;
      if (cur.length < targetCount) {
        const next = [...cur];
        while (next.length < targetCount) next.push({ id: newPaneId() });
        return next;
      }
      // Shrink: prefer dropping autofill-less (empty) panes from the end.
      const empties: number[] = [];
      const filled: number[] = [];
      cur.forEach((p, i) => {
        if (paneRefs.current.get(p.id)?.snapshot().runId) filled.push(i);
        else empties.push(i);
      });
      const toRemove = new Set<number>();
      while (toRemove.size < cur.length - targetCount) {
        const drop = empties.pop() ?? filled.pop();
        if (drop == null) break;
        toRemove.add(drop);
      }
      return cur.filter((_, i) => !toRemove.has(i));
    });
  }, [targetCount]);

  // ---- pane handles registry ------------------------------------------
  const registerPaneRef = useCallback((id: string, handle: PaneHandle | null) => {
    if (handle) paneRefs.current.set(id, handle);
    else paneRefs.current.delete(id);
  }, []);

  const onPaneSkillsResolved = useCallback((hostId: string, list: HostSkill[]) => {
    setSkillsByHost((prev) => {
      const next = new Map(prev);
      next.set(hostId, list);
      return next;
    });
  }, []);

  const onPaneClose = useCallback((paneId: string) => {
    setPanes((cur) => {
      const next = cur.filter((p) => p.id !== paneId);
      paneRefs.current.delete(paneId);
      // Pad back to targetCount so the grid doesn't collapse weirdly.
      while (next.length < targetCount) next.push({ id: newPaneId() });
      return next;
    });
  }, [targetCount]);

  const closeAll = useCallback(async () => {
    if (panes.length === 0) return;
    const hasRunning = Array.from(paneRefs.current.values()).some((h) => !!h.snapshot().runId);
    if (hasRunning && !window.confirm("关闭所有 pane（包括 agent 端的 PTY）？")) return;
    await Promise.all(
      Array.from(paneRefs.current.values()).map((h) => h.closeFully().catch(() => undefined)),
    );
    paneRefs.current.clear();
    setPanes(Array.from({ length: targetCount }, () => ({ id: newPaneId() })));
  }, [panes.length, targetCount]);

  // ---- saved layouts --------------------------------------------------
  const refreshLayouts = useCallback(async (selectId?: number) => {
    const { response, data } = await fetchConsoleLayouts();
    if (response.ok && data.layouts) {
      const map = new Map<number, ConsoleLayout>();
      for (const l of data.layouts) map.set(l.id, l);
      setLayouts(map);
    }
    if (selectId !== undefined) setSelectedLayoutId(selectId);
  }, []);

  const loadLayout = useCallback(
    (layout: ConsoleLayout) => {
      const cfg = layout.panes_config || [];
      if (cfg.length === 0) {
        alert("空布局，未生效");
        return;
      }
      // Close existing live panes first (best effort).
      void Promise.all(
        Array.from(paneRefs.current.values()).map((h) => h.closeFully().catch(() => undefined)),
      );
      paneRefs.current.clear();
      const target = nearestLayoutCount(cfg.length);
      setTargetCount(target);
      const next: PaneState[] = cfg.map((c) => ({
        id: newPaneId(),
        autofill: {
          hostId: c.host_id,
          hostSkillId: c.host_skill_id,
          kind: c.kind,
          // Saved layouts only carry (host, skill, kind) — no run_id —
          // so loading triggers fresh /open. If the operator wants to
          // reattach to a still-live run instead, refresh the page
          // (restoreActiveSessions discovers + carries the run_id).
        },
      }));
      while (next.length < target) next.push({ id: newPaneId() });
      setPanes(next);
    },
    [],
  );

  const sortedLayouts = useMemo(() => {
    return Array.from(layouts.values()).sort((a, b) =>
      a.updated_at < b.updated_at ? 1 : -1,
    );
  }, [layouts]);

  const onSavedChange = (idStr: string) => {
    const id = Number(idStr) || 0;
    setSelectedLayoutId(id);
    if (!id) return;
    const l = layouts.get(id);
    if (l) loadLayout(l);
  };

  const saveCurrent = async () => {
    const cfg = panes
      .map((p) => paneRefs.current.get(p.id)?.snapshot())
      .filter((s): s is { hostId: string; hostSkillId: number; kind: string; runId: number } =>
        !!s?.hostId && !!s?.hostSkillId && !!s.runId,
      )
      .map((s) => {
        // Save kind only when non-shell so older layouts (no kind
        // field) keep parsing — restore defaults to "shell" without it.
        const entry: { host_id: string; host_skill_id: number; kind?: string } = {
          host_id: s.hostId,
          host_skill_id: s.hostSkillId,
        };
        if (s.kind && s.kind !== "shell") entry.kind = s.kind;
        return entry;
      });
    if (cfg.length === 0) {
      alert("没有可保存的活动 pane（请先启动至少一个 shell / vnc）");
      return;
    }
    const existing = selectedLayoutId ? layouts.get(selectedLayoutId) : undefined;
    const defaultName = existing?.name || `布局 ${new Date().toLocaleString()}`;
    const name = window.prompt("布局名称", defaultName);
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    if (existing && trimmed === existing.name) {
      const { response, data } = await updateConsoleLayout(existing.id, { panes_config: cfg });
      if (!response.ok) {
        alert(`保存失败: ${data.error || response.status}`);
        return;
      }
      await refreshLayouts(existing.id);
    } else {
      const { response, data } = await createConsoleLayout({ name: trimmed, panes_config: cfg });
      if (!response.ok) {
        const hint = response.status === 409 ? "已存在同名布局，请换一个名字" : data.error;
        alert(`保存失败: ${hint || response.status}`);
        return;
      }
      await refreshLayouts(data.layout?.id);
    }
  };

  const deleteSelected = async () => {
    if (!selectedLayoutId) return;
    const l = layouts.get(selectedLayoutId);
    if (!l) return;
    if (!window.confirm(`确定删除布局 "${l.name}"？`)) return;
    const { response, data } = await deleteConsoleLayout(selectedLayoutId);
    if (!response.ok) {
      alert(`删除失败: ${data.error || response.status}`);
      return;
    }
    setSelectedLayoutId(0);
    await refreshLayouts(0);
  };

  // ---- render ---------------------------------------------------------
  return (
    <>
      <div className="console-toolbar">
        <strong style={{ fontSize: 13 }}>Console</strong>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>多终端并排工作区</span>
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 12 }} htmlFor="consoleLayoutSelect">
          布局{" "}
          <select
            id="consoleLayoutSelect"
            name="console-layout-count"
            value={String(targetCount)}
            onChange={(e) => setTargetCount(Number(e.target.value))}
            style={{ marginLeft: 4 }}
            aria-label="pane 数量布局"
            autoComplete="off"
          >
            <option value="1">1 pane</option>
            <option value="2">2 panes</option>
            <option value="3">3 panes</option>
            <option value="4">2×2</option>
            <option value="6">2×3</option>
            <option value="9">3×3</option>
          </select>
        </label>
        <label style={{ fontSize: 12 }} htmlFor="consoleSavedSelect">
          已保存{" "}
          <select
            id="consoleSavedSelect"
            name="console-saved-layout"
            value={selectedLayoutId ? String(selectedLayoutId) : ""}
            onChange={(e) => onSavedChange(e.target.value)}
            style={{ marginLeft: 4, minWidth: 140 }}
            aria-label="加载已保存的布局"
            autoComplete="off"
          >
            <option value="">— 选择已保存的布局 —</option>
            {sortedLayouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-inline btn-secondary"
          onClick={saveCurrent}
          aria-label="保存当前布局"
        >
          💾 保存
        </button>
        <button
          type="button"
          className="btn-inline btn-secondary"
          disabled={!selectedLayoutId}
          onClick={deleteSelected}
          aria-label="删除选中的已保存布局"
          title="删除选中的已保存布局"
          style={!selectedLayoutId ? { cursor: "not-allowed", opacity: 0.5 } : undefined}
        >
          🗑
        </button>
        <button
          type="button"
          className="btn-inline btn-secondary"
          onClick={closeAll}
          aria-label="关闭所有 pane 并终止 agent 端 session"
          title="关闭所有 pane"
        >
          关闭全部
        </button>
        <a className="lp-topbar-back" href="/hosts.html">
          主机
        </a>
      </div>
      <div
        className="console-grid"
        data-cols={String(gridColsFor(targetCount))}
      >
        {panes.map((p) => (
          <Pane
            key={p.id}
            paneId={p.id}
            hosts={hosts}
            skillsByHost={skillsByHost}
            onSkillsResolved={onPaneSkillsResolved}
            autofill={p.autofill}
            onCloseRequested={() => onPaneClose(p.id)}
            ref={(h) => registerPaneRef(p.id, h)}
          />
        ))}
      </div>
    </>
  );
}
