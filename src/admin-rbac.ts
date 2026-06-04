// /admin-rbac.html — per-workspace role & permission management
// (UniLake-style permission matrix). Pick a workspace, then:
//   1. see every member and assign/revoke roles (system + custom),
//   2. see all roles (global system roles read-only + this workspace's
//      custom roles) with their permission sets,
//   3. create / edit / delete custom roles via a permission checkbox matrix.
//
// Backed by polar-dock rbac_handlers.go. All mutations require team:manage
// (enforced server-side; the page is also sidebar-gated to admins).

import {
  assignMemberRole,
  createRole,
  deleteRole,
  fetchMemberRoles,
  fetchPermissionCatalog,
  fetchRoles,
  updateRole,
  type MemberRole,
  type RBACPermission,
  type RBACRole,
} from "./api/rbac.js";
import { fetchTeams, fetchTeamMembers } from "./api/teams.js";
import type { TeamMember, TeamWithRole } from "./types/teams.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

const WORKSPACE_KEY = "polar_active_workspace_id";

const wsSel = byId<HTMLSelectElement>("wsSel");
const membersTbody = byId<HTMLTableSectionElement>("membersTbody");
const rolesWrap = byId<HTMLElement>("rolesWrap");
const statusEl = byId<HTMLElement>("status");
const newRoleBtn = byId<HTMLButtonElement>("newRoleBtn");
const refreshBtn = byId<HTMLButtonElement>("refreshBtn");

// role editor modal
const modal = byId<HTMLElement>("roleModal");
const modalTitle = byId<HTMLElement>("roleModalTitle");
const roleKeyInput = byId<HTMLInputElement>("roleKey");
const roleNameInput = byId<HTMLInputElement>("roleName");
const permMatrix = byId<HTMLElement>("permMatrix");
const saveRoleBtn = byId<HTMLButtonElement>("saveRoleBtn");
const cancelRoleBtn = byId<HTMLButtonElement>("cancelRoleBtn");

let currentWS = "";
let catalog: RBACPermission[] = [];
let roles: RBACRole[] = [];
let members: TeamMember[] = [];
let memberRoles: MemberRole[] = [];
let editingRoleID: number | null = null; // null = creating

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function setStatus(msg: string, isErr = false): void {
  statusEl.textContent = msg;
  statusEl.style.color = isErr ? "var(--danger,#c00)" : "var(--muted,#888)";
}

// ---- workspace switcher -------------------------------------------------

async function loadWorkspaces(): Promise<void> {
  const { response, data } = await fetchTeams();
  if (!response.ok) {
    setStatus("无法加载工作区列表", true);
    return;
  }
  const teams: TeamWithRole[] = data.teams ?? [];
  const stored = localStorage.getItem(WORKSPACE_KEY) || "";
  wsSel.innerHTML = teams
    .map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`)
    .join("");
  currentWS = teams.some((t) => t.id === stored) ? stored : (teams[0]?.id ?? "");
  wsSel.value = currentWS;
}

// ---- data load ----------------------------------------------------------

async function loadAll(): Promise<void> {
  if (!currentWS) return;
  setStatus("加载中…");
  try {
    const [catRes, rolesRes, membersRes, mrRes] = await Promise.all([
      fetchPermissionCatalog(),
      fetchRoles(currentWS),
      fetchTeamMembers(currentWS),
      fetchMemberRoles(currentWS),
    ]);
    if (!rolesRes.response.ok) {
      const err = rolesRes.data as unknown as { error?: string };
      setStatus(
        rolesRes.response.status === 403
          ? "你没有该工作区的 team:manage 权限。"
          : `加载失败：${err.error || rolesRes.response.status}`,
        true,
      );
      membersTbody.innerHTML = "";
      rolesWrap.innerHTML = "";
      return;
    }
    catalog = catRes.data.permissions ?? [];
    roles = rolesRes.data.roles ?? [];
    members = membersRes.response.ok ? (membersRes.data.members ?? []) : [];
    memberRoles = mrRes.response.ok ? (mrRes.data.member_roles ?? []) : [];
    renderMembers();
    renderRoles();
    setStatus(`${members.length} 名成员 · ${roles.length} 个角色 · ${catalog.length} 项权限`);
  } catch (err) {
    setStatus(`加载失败：${(err as Error).message}`, true);
  }
}

// ---- members + role assignment -----------------------------------------

function rolesForMember(uid: string): Set<string> {
  return new Set(memberRoles.filter((m) => m.user_id === uid).map((m) => m.role_key));
}

function renderMembers(): void {
  membersTbody.innerHTML = "";
  members.forEach((m) => {
    const assigned = rolesForMember(m.user_id);
    const tr = document.createElement("tr");
    const chips = roles
      .map((r) => {
        // The legacy team_members.role maps to a same-named system role and
        // is shown as an always-on base badge (not a togglable chip).
        const base = r.key === m.role;
        const on = base || assigned.has(r.key);
        const cls = base ? "rbac-chip rbac-chip-base" : on ? "rbac-chip rbac-chip-on" : "rbac-chip";
        const title = base ? "来自团队基础角色（team_members.role），不可在此移除" : "";
        return `<button class="${cls}" data-uid="${esc(m.user_id)}" data-role="${esc(r.key)}" ${base ? "disabled" : ""} title="${esc(title)}">${esc(r.name)}</button>`;
      })
      .join("");
    tr.innerHTML = `
      <td>${esc(m.username || m.user_id)}<div class="rbac-sub">${esc(m.email || "")}</div></td>
      <td><span class="rbac-base">${esc(m.role)}</span></td>
      <td><div class="rbac-chips">${chips}</div></td>`;
    tr.querySelectorAll<HTMLButtonElement>(".rbac-chip:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () =>
        void toggleMemberRole(btn.dataset.uid!, btn.dataset.role!, !btn.classList.contains("rbac-chip-on")),
      );
    });
    membersTbody.appendChild(tr);
  });
}

async function toggleMemberRole(uid: string, roleKey: string, grant: boolean): Promise<void> {
  setStatus(grant ? "授予中…" : "撤销中…");
  try {
    const { response, data } = await assignMemberRole(currentWS, {
      user_id: uid,
      role_key: roleKey,
      revoke: !grant,
    });
    if (!response.ok) {
      const err = data as unknown as { error?: string };
      setStatus(`操作失败：${err.error || response.status}`, true);
      return;
    }
    const mrRes = await fetchMemberRoles(currentWS);
    memberRoles = mrRes.response.ok ? (mrRes.data.member_roles ?? []) : memberRoles;
    renderMembers();
    setStatus("已更新成员角色");
  } catch (err) {
    setStatus(`操作失败：${(err as Error).message}`, true);
  }
}

// ---- roles list ---------------------------------------------------------

function permLabel(key: string): string {
  const p = catalog.find((c) => c.key === key);
  return p ? `${p.description || p.key}` : key;
}

function renderRoles(): void {
  rolesWrap.innerHTML = "";
  roles.forEach((r) => {
    const card = document.createElement("div");
    card.className = "rbac-role-card";
    const badge = r.is_system
      ? `<span class="rbac-tag rbac-tag-sys">系统</span>`
      : `<span class="rbac-tag rbac-tag-custom">自定义</span>`;
    const scope = r.is_global ? "全局" : "本工作区";
    const perms = r.permissions.length
      ? r.permissions.map((k) => `<span class="rbac-perm" title="${esc(k)}">${esc(permLabel(k))}</span>`).join("")
      : `<span class="rbac-sub">（无权限）</span>`;
    const actions = r.is_system
      ? `<span class="rbac-sub">只读</span>`
      : `<button class="btn-inline btn-secondary" data-edit="${r.id}">编辑</button>
         <button class="btn-inline btn-secondary" data-del="${r.id}" style="color:var(--danger,#c00);">删除</button>`;
    card.innerHTML = `
      <div class="rbac-role-head">
        <div><strong>${esc(r.name)}</strong> <code>${esc(r.key)}</code> ${badge}
          <span class="rbac-sub">· ${scope} · ${r.permissions.length} 项权限</span></div>
        <div class="rbac-role-actions">${actions}</div>
      </div>
      <div class="rbac-perms">${perms}</div>`;
    card.querySelector("[data-edit]")?.addEventListener("click", () => openRoleModal(r));
    card.querySelector("[data-del]")?.addEventListener("click", () => void onDeleteRole(r));
    rolesWrap.appendChild(card);
  });
}

// ---- role editor modal --------------------------------------------------

function openRoleModal(role: RBACRole | null): void {
  editingRoleID = role ? role.id : null;
  modalTitle.textContent = role ? `编辑角色 · ${role.name}` : "新建自定义角色";
  roleKeyInput.value = role ? role.key : "";
  roleKeyInput.disabled = !!role; // key immutable once created
  roleNameInput.value = role ? role.name : "";
  const granted = new Set(role?.permissions ?? []);

  // group catalog by module for a readable matrix
  const byModule = new Map<string, RBACPermission[]>();
  catalog.forEach((p) => {
    const arr = byModule.get(p.module) ?? [];
    arr.push(p);
    byModule.set(p.module, arr);
  });
  permMatrix.innerHTML = [...byModule.entries()]
    .map(
      ([mod, perms]) => `
      <div class="rbac-mod">
        <div class="rbac-mod-head">${esc(mod)}</div>
        ${perms
          .map(
            (p) => `<label class="rbac-perm-row">
              <input type="checkbox" value="${esc(p.key)}" ${granted.has(p.key) ? "checked" : ""} />
              <span><code>${esc(p.key)}</code> — ${esc(p.description || p.action)}</span>
            </label>`,
          )
          .join("")}
      </div>`,
    )
    .join("");
  modal.hidden = false;
}

function closeRoleModal(): void {
  modal.hidden = true;
}

function selectedPerms(): string[] {
  return [...permMatrix.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map(
    (cb) => cb.value,
  );
}

async function onSaveRole(): Promise<void> {
  const key = roleKeyInput.value.trim();
  const name = roleNameInput.value.trim();
  const perms = selectedPerms();
  if (!name) {
    setStatus("请填写角色名称", true);
    return;
  }
  try {
    if (editingRoleID == null) {
      if (!key) {
        setStatus("新建角色需要 key（小写英文/下划线）", true);
        return;
      }
      const { response, data } = await createRole(currentWS, { key, name, permission_keys: perms });
      if (!response.ok) {
        setStatus(`创建失败：${(data as unknown as { error?: string }).error || response.status}`, true);
        return;
      }
    } else {
      const { response, data } = await updateRole(currentWS, editingRoleID, { name, permission_keys: perms });
      if (!response.ok) {
        setStatus(`保存失败：${(data as unknown as { error?: string }).error || response.status}`, true);
        return;
      }
    }
    closeRoleModal();
    await loadAll();
  } catch (err) {
    setStatus(`保存失败：${(err as Error).message}`, true);
  }
}

async function onDeleteRole(role: RBACRole): Promise<void> {
  if (!confirm(`删除自定义角色「${role.name}」？已分配该角色的成员将失去其权限。`)) return;
  try {
    const { response, data } = await deleteRole(currentWS, role.id);
    if (!response.ok) {
      setStatus(`删除失败：${(data as unknown as { error?: string }).error || response.status}`, true);
      return;
    }
    await loadAll();
  } catch (err) {
    setStatus(`删除失败：${(err as Error).message}`, true);
  }
}

// ---- wiring -------------------------------------------------------------

wsSel.addEventListener("change", () => {
  currentWS = wsSel.value;
  localStorage.setItem(WORKSPACE_KEY, currentWS);
  void loadAll();
});
refreshBtn.addEventListener("click", () => void loadAll());
newRoleBtn.addEventListener("click", () => openRoleModal(null));
saveRoleBtn.addEventListener("click", () => void onSaveRole());
cancelRoleBtn.addEventListener("click", () => closeRoleModal());
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeRoleModal();
});
document.getElementById("logoutBtn")?.addEventListener("click", () => void logout());

(async () => {
  hydrateSiteBrand();
  hydrateSidebarFoot();
  await loadWorkspaces();
  await loadAll();
})();
