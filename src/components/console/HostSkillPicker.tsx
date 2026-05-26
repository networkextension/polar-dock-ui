// The picker UI that lives in an empty pane: host → skill → (optional
// shell-program) → 启动. Mirrors the vanilla renderPicker() but in
// React-controlled state. Returns the operator's choice to the parent,
// which then calls /shell/open + spawns the Terminal.

import { useEffect, useMemo, useState } from "react";
import { fetchHostSkillsForHost } from "../../api/hosts.js";
import type { Host, HostSkill } from "../../types/hosts.js";

export interface PickerChoice {
  hostId: string;
  hostSkillId: number;
  /** Skill kind: "shell" or "vnc". Determines which /open endpoint
   *  the pane will call. Other byte-streaming kinds (kdp) need
   *  device-specific config and aren't started from this picker. */
  kind: string;
  shell?: string;
}

interface Props {
  hosts: Host[];
  skillsByHost: Map<string, HostSkill[]>;
  onSkillsResolved: (hostId: string, skills: HostSkill[]) => void;
  onStart: (choice: PickerChoice) => Promise<void>;
}

export function HostSkillPicker({ hosts, skillsByHost, onSkillsResolved, onStart }: Props) {
  const [hostId, setHostId] = useState("");
  const [skillId, setSkillId] = useState("");
  const [shellPref, setShellPref] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const skills = hostId ? skillsByHost.get(hostId) : undefined;

  // Lazy-fetch skills when host changes.
  useEffect(() => {
    if (!hostId || skills) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      const { response, data } = await fetchHostSkillsForHost(hostId);
      if (cancelled) return;
      setLoading(false);
      if (!response.ok) {
        setErr(data.error || `加载 skills 失败 (HTTP ${response.status})`);
        return;
      }
      onSkillsResolved(hostId, data.skills || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [hostId, skills, onSkillsResolved]);

  // shell + vnc are user-selectable byte-streaming kinds. KDP
  // needs device_path which the picker doesn't ask for; see PR #208.
  const usable = useMemo(
    () => (skills || []).filter((s) => s.kind === "shell" || s.kind === "vnc"),
    [skills],
  );

  const selectedSkill = useMemo(
    () => usable.find((s) => String(s.id) === skillId),
    [usable, skillId],
  );

  const canStart = !!hostId && !!skillId && !busy;

  const submit = async () => {
    if (!canStart) return;
    setBusy(true);
    setErr(null);
    try {
      await onStart({
        hostId,
        hostSkillId: Number(skillId),
        kind: selectedSkill?.kind || "shell",
        shell: shellPref || undefined,
      });
    } catch (e) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <div>选择主机 + skill 启动</div>
      <select
        className="input"
        style={{ maxWidth: 240 }}
        value={hostId}
        onChange={(e) => {
          setHostId(e.target.value);
          setSkillId("");
        }}
        name="console-pane-host"
        aria-label="选择主机"
        autoComplete="off"
      >
        <option value="">— host —</option>
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} ({h.slug})
          </option>
        ))}
      </select>
      <select
        className="input"
        style={{ maxWidth: 240 }}
        value={skillId}
        onChange={(e) => setSkillId(e.target.value)}
        disabled={!hostId || loading}
        name="console-pane-skill"
        aria-label="选择 skill"
        autoComplete="off"
      >
        <option value="">{loading ? "加载中..." : "— skill —"}</option>
        {usable.map((s) => (
          <option key={s.id} value={s.id}>
            {/* Display the operator-renameable label; fall back to the
                bare kind when name hasn't been customized. The DB id is
                kept off-screen — operators don't need to see "129". */}
            {s.name && s.name !== s.kind ? `${s.name} (${s.kind})` : s.kind}
          </option>
        ))}
      </select>
      {selectedSkill?.kind === "shell" && (
        <select
          className="input"
          style={{ maxWidth: 240 }}
          value={shellPref}
          onChange={(e) => setShellPref(e.target.value)}
          name="console-pane-shell"
          aria-label="shell 程序"
          autoComplete="off"
        >
          <option value="">默认 shell (auto)</option>
          <option value="bash">bash</option>
          <option value="zsh">zsh</option>
          <option value="sh">sh</option>
        </select>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!canStart}
        style={{
          padding: "8px 24px",
          border: "none",
          borderRadius: 8,
          background: "#16a34a",
          color: "#fff",
          fontWeight: 600,
          fontSize: 13,
          cursor: canStart ? "pointer" : "not-allowed",
          opacity: canStart ? 1 : 0.5,
        }}
      >
        {busy ? "启动中..." : "启动"}
      </button>
      {err && <div style={{ color: "#fca5a5", fontSize: 11 }}>{err}</div>}
    </>
  );
}
