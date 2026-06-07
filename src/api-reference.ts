// /api-reference.html — read-only browser for the dock's public /api surface,
// rendered from the generated OpenAPI 3 spec (GET /api/openapi.json). Endpoints
// are grouped by tag (domain); each row shows METHOD path + required scope +
// auth tier; clicking expands params + request body. A "下载 OpenAPI" button
// saves the raw spec. DOM API only — no framework, no vendored spec viewer.

import { fetchOpenAPISpec } from "./api/openapi.js";
import type { OpenAPIOperation, OpenAPISpec } from "./api/openapi.js";
import { logout } from "./api/session.js";
import { byId } from "./lib/dom.js";
import { hydrateSidebarFoot, hydrateSiteBrand } from "./lib/site.js";
import { bindThemeSync, initStoredTheme } from "./lib/theme.js";

initStoredTheme();
bindThemeSync();

const logoutBtn = byId<HTMLButtonElement>("logoutBtn");
const refGroups = byId<HTMLElement>("refGroups");
const refLoading = byId<HTMLElement>("refLoading");
const refError = byId<HTMLElement>("refError");
const refMeta = byId<HTMLElement>("refMeta");
const refFilter = byId<HTMLInputElement>("refFilter");
const downloadSpecBtn = byId<HTMLButtonElement>("downloadSpecBtn");

let spec: OpenAPISpec | null = null;

type Op = { method: string; path: string; op: OpenAPIOperation };

function methodColor(m: string): string {
  switch (m.toUpperCase()) {
    case "GET":
      return "#16a34a";
    case "POST":
      return "#2563eb";
    case "PUT":
    case "PATCH":
      return "#d97706";
    case "DELETE":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}

function methodBadge(m: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = m.toUpperCase();
  span.style.cssText = `display:inline-block; min-width:54px; text-align:center; padding:1px 6px; border-radius:6px; font-size:11px; font-weight:700; color:#fff; background:${methodColor(m)};`;
  return span;
}

function chip(text: string, danger = false): HTMLSpanElement {
  const s = document.createElement("span");
  s.textContent = text;
  s.style.cssText = `display:inline-block; margin-left:6px; padding:1px 6px; border-radius:8px; font-size:11px; background:${danger ? "var(--surface-2,#fef2f2)" : "var(--surface-2,#f3f4f6)"}; border:1px solid var(--border,#e5e7eb);`;
  return s;
}

function renderDetail(op: OpenAPIOperation): HTMLElement {
  const box = document.createElement("div");
  box.style.cssText = "padding:6px 10px 10px 70px; font-size:12px;";

  const params = op.parameters ?? [];
  if (params.length > 0) {
    const h = document.createElement("div");
    h.textContent = "参数";
    h.style.cssText = "font-weight:600; margin:2px 0;";
    box.appendChild(h);
    params.forEach((p) => {
      const row = document.createElement("div");
      row.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      row.textContent = `${p.name} (${p.in}${p.required ? ", required" : ""}) : ${p.schema?.type ?? "string"}`;
      box.appendChild(row);
    });
  }

  const props = op.requestBody?.content?.["application/json"]?.schema?.properties;
  if (props && Object.keys(props).length > 0) {
    const req = op.requestBody?.content?.["application/json"]?.schema?.required ?? [];
    const h = document.createElement("div");
    h.textContent = "请求体 (application/json)";
    h.style.cssText = "font-weight:600; margin:6px 0 2px;";
    box.appendChild(h);
    Object.entries(props).forEach(([name, s]) => {
      const row = document.createElement("div");
      row.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      row.textContent = `${name}${req.includes(name) ? "*" : ""} : ${s.type ?? "string"}`;
      box.appendChild(row);
    });
  }

  if (!params.length && !(props && Object.keys(props).length)) {
    box.textContent = "无参数。";
    box.style.color = "var(--text-muted, #6b7280)";
  }
  return box;
}

function renderRow(o: Op): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "border-bottom:1px solid var(--border,#eee);";

  const head = document.createElement("div");
  head.style.cssText = "display:flex; align-items:center; gap:8px; padding:6px 10px; cursor:pointer;";
  head.appendChild(methodBadge(o.method));
  const path = document.createElement("code");
  path.textContent = o.path;
  path.style.cssText = "font-size:12px;";
  head.appendChild(path);
  const scope = o.op["x-polar-scope"];
  if (scope) head.appendChild(chip(scope));
  else head.appendChild(chip("无需 scope"));
  if (o.op["x-polar-auth"] === "admin") head.appendChild(chip("admin", true));

  const detail = renderDetail(o.op);
  detail.hidden = true;
  head.addEventListener("click", () => {
    detail.hidden = !detail.hidden;
  });

  wrap.append(head, detail);
  return wrap;
}

function allOps(): Op[] {
  if (!spec) return [];
  const ops: Op[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      ops.push({ method, path, op });
    }
  }
  return ops;
}

function tagOf(o: Op): string {
  return o.op.tags?.[0] ?? "other";
}

function render(): void {
  const q = refFilter.value.trim().toLowerCase();
  const ops = allOps().filter((o) => {
    if (!q) return true;
    return o.path.toLowerCase().includes(q) || (o.op["x-polar-scope"] ?? "").toLowerCase().includes(q);
  });
  ops.sort((a, b) => (tagOf(a) === tagOf(b) ? a.path.localeCompare(b.path) : tagOf(a).localeCompare(tagOf(b))));

  const byTag = new Map<string, Op[]>();
  for (const o of ops) {
    const t = tagOf(o);
    if (!byTag.has(t)) byTag.set(t, []);
    byTag.get(t)!.push(o);
  }

  refGroups.innerHTML = "";
  for (const tag of Array.from(byTag.keys()).sort()) {
    const list = byTag.get(tag)!;
    const card = document.createElement("div");
    card.className = "settings-section-card";
    card.style.cssText = "margin:0 0 12px 0; padding:0; overflow:hidden;";
    const header = document.createElement("div");
    header.style.cssText = "padding:6px 10px; font-weight:600; background:var(--surface-2,#f3f4f6); border-bottom:1px solid var(--border,#e5e7eb);";
    header.textContent = `${tag} (${list.length})`;
    card.appendChild(header);
    list.forEach((o) => card.appendChild(renderRow(o)));
    refGroups.appendChild(card);
  }
  refMeta.textContent = `${ops.length} 个接口`;
}

function downloadSpec(): void {
  if (!spec) return;
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "polar-openapi.json";
  a.click();
  URL.revokeObjectURL(url);
}

refFilter.addEventListener("input", () => render());
downloadSpecBtn.addEventListener("click", downloadSpec);
logoutBtn.addEventListener("click", () => void logout().then(() => (window.location.href = "/login.html")));

async function bootstrap(): Promise<void> {
  await hydrateSiteBrand();
  await hydrateSidebarFoot();
  try {
    spec = await fetchOpenAPISpec();
    render();
  } catch (err) {
    refError.hidden = false;
    refError.textContent = `加载失败：${(err as Error).message}`;
  } finally {
    refLoading.hidden = true;
  }
}

void bootstrap();
