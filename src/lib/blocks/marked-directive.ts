// Render-side :::figure / :::gallery support for marked v15 (the vendored
// window.marked that renderMarkdown() uses). Counterpart of the editor's
// markdown-it wiring in directive-nodes.ts — the emitted HTML shapes must
// stay in sync with the nodes' renderHTML (same inline styles: zen aliases
// /styles.css elsewhere, so repo CSS can't be relied on).
//
// Unknown directive kinds (":::anything-else") are left untokenized on
// purpose: they fall through marked as plain paragraph text — the same
// graceful degradation older clients get.

import { DIRECTIVE_ALIGNS, figureStyles, galleryStyles } from "./directive-nodes.js";

interface DirectiveToken {
  type: "polarDirective";
  raw: string;
  kind: "figure" | "gallery";
  align: string;
  width: string;
  images: Array<{ src: string; alt: string }>;
  caption: string;
}

const OPEN_RE = /^:::(figure|gallery)(\{[^}\n]*\})?[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

function safeSrc(src: string): string {
  return /^\s*javascript:/i.test(src) ? "" : src;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function polarDirectiveExtension(): Record<string, unknown> {
  return {
    name: "polarDirective",
    level: "block",
    start(src: string): number | undefined {
      const i = src.indexOf(":::");
      return i < 0 ? undefined : i;
    },
    tokenizer(src: string): DirectiveToken | undefined {
      const m = OPEN_RE.exec(src);
      if (!m) return undefined;
      const kind = m[1] as DirectiveToken["kind"];
      const attrs: Record<string, string> = {};
      if (m[2]) {
        for (const pair of m[2].slice(1, -1).split(/\s+/)) {
          const [k, v] = pair.split("=");
          if (k && v) attrs[k] = v;
        }
      }
      const images: DirectiveToken["images"] = [];
      const captionLines: string[] = [];
      for (const line of m[3].split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const im = IMAGE_RE.exec(trimmed);
        if (im) {
          const src2 = safeSrc(im[2]);
          if (src2) images.push({ src: src2, alt: im[1] });
        } else {
          captionLines.push(trimmed);
        }
      }
      return {
        type: "polarDirective",
        raw: m[0],
        kind,
        align: DIRECTIVE_ALIGNS.has(attrs.align) ? attrs.align : "center",
        width: /^\d{1,3}$/.test(attrs.width || "") ? attrs.width : "",
        images,
        caption: captionLines.join(" "),
      };
    },
    renderer(token: DirectiveToken): string {
      if (token.kind === "figure") {
        const img = token.images[0];
        if (!img) return "";
        const s = figureStyles(token.align, token.width);
        return (
          `<figure class="post-figure" data-polar-figure data-align="${token.align}" data-width="${token.width}" style="${s.fig}">` +
          `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" loading="lazy" style="${s.img}" />` +
          `<figcaption style="${s.cap}">${escapeHtml(token.caption)}</figcaption>` +
          `</figure>`
        );
      }
      if (token.images.length === 0) return "";
      const s = galleryStyles(token.images.length);
      const imgs = token.images
        .map((im) => `<img src="${escapeHtml(im.src)}" alt="${escapeHtml(im.alt)}" loading="lazy" style="${s.img}" />`)
        .join("");
      return `<div class="post-gallery" data-polar-gallery style="${s.wrap}">${imgs}</div>`;
    },
  };
}
