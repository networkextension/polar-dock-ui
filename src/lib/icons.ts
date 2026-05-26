// Lucide-style inline SVG icons.
//
// We don't depend on the `lucide` npm package — the runtime cost
// (icon name lookup table + a few k of paths) is the same either
// way, and copy-pasting the path data here means we can edit / strip
// any icon without bumping a dependency. Paths are the official
// Lucide v0.x stroke definitions (MIT licensed).
//
// Usage:
//
//   1. Markup with a data-icon attribute:
//        <span class="lp-nav-icon" data-icon="layout-dashboard"></span>
//      Then call hydrateIcons() once after DOM is ready (already
//      auto-called from lib/site.ts hydrateSiteBrand on every page).
//
//   2. Programmatic from a TS template string:
//        innerHTML = `<button>${iconHTML("settings")} 设置</button>`
//
// All icons render with `currentColor` stroke + `none` fill, so the
// surrounding element's `color:` controls them. Default size is 18px.

const VIEW_BOX = "0 0 24 24";

// Path data only — full <svg> wrapper is added by iconHTML. Keep
// this map alphabetized by Lucide name. Add a new icon by copying
// the inner contents of an icon SVG file from lucide.dev.
const ICON_PATHS: Record<string, string> = {
  // 9-tile + nav: dashboard, posts, markdowns, chat, creation, video, ios, workspace, editor
  "layout-dashboard": `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>`,
  "users-round": `<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>`,
  "folder-kanban": `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>`,
  "message-square": `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  "file-text": `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>`,
  "message-circle": `<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>`,
  "pen-line": `<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>`,
  "video": `<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/>`,
  "smartphone": `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`,
  "code": `<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>`,

  // Admin nav + footer
  "settings": `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
  "bot": `<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>`,
  "sparkles": `<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>`,
  "users-cog": `<path d="M2 21a8 8 0 0 1 10.434-7.62"/><circle cx="10" cy="8" r="5"/><circle cx="18" cy="18" r="3"/><path d="m22 22-1.9-1.9"/>`,
  "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>`,

  // Settings center modal
  "user": `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  "palette": `<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>`,
  "cpu": `<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>`,
  "globe": `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
};

const DEFAULT_SIZE = 18;

// iconHTML returns the full inline <svg> markup. Use within template
// strings to embed an icon. Returns empty string for unknown names —
// callers fall back to whatever was already in the slot (Unicode
// char), which is fine as a graceful degradation path.
export function iconHTML(name: string, size: number = DEFAULT_SIZE): string {
  const path = ICON_PATHS[name];
  if (!path) return "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEW_BOX}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

// hydrateIcons walks the DOM under root looking for [data-icon]
// attributes and replaces innerHTML with the inline SVG. Idempotent
// — re-running hydrate after innerHTML mutations is safe (the
// elements with data-icon get refreshed, others ignored).
export function hydrateIcons(root: ParentNode = document): void {
  const targets = root.querySelectorAll<HTMLElement>("[data-icon]");
  targets.forEach((el) => {
    const name = el.getAttribute("data-icon");
    if (!name) return;
    const sizeAttr = el.getAttribute("data-icon-size");
    const size = sizeAttr ? Number.parseInt(sizeAttr, 10) || DEFAULT_SIZE : DEFAULT_SIZE;
    const svg = iconHTML(name, size);
    if (svg) el.innerHTML = svg;
  });
}
