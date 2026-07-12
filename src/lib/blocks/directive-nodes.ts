// Block-editor nodes for post 图文混排 (C-P0a, Plane POLARDOCKU #9).
//
// Storage stays PURE MARKDOWN: each node serializes to a :::figure /
// :::gallery directive fence whose body is standard markdown, so every
// consumer that doesn't know the directive (older mobile, AI summary,
// search) degrades to "fence line as text + images still visible".
// Syntax is frozen in doc/ui/post-block-editor-design.md §2.
//
// Two parsers must understand the directive:
//  - editor side (this file): tiptap-markdown's markdown-it instance,
//    via setupDirectiveMarkdownIt() + the nodes' parseHTML;
//  - render side: lib/blocks/marked-directive.ts (marked v15 block
//    extension) — keep the emitted HTML shapes in sync.
//
// Styling is INTENTIONALLY inline: zen aliases /styles.css to the
// polar-ui-shared repo, so CSS shipped in this repo is silently ignored
// there — and inline styles also survive copy-export (C-P2) verbatim.

import { Node, mergeAttributes } from "@tiptap/core";

export const DIRECTIVE_ALIGNS = new Set(["left", "center", "right"]);

export interface GalleryImage {
  src: string;
  alt: string;
}

export function figureStyles(align: string, width: string): { fig: string; img: string; cap: string } {
  const safeAlign = DIRECTIVE_ALIGNS.has(align) ? align : "center";
  const widthCss = /^\d{1,3}$/.test(width) ? `width:${width}%;` : "";
  return {
    fig: `margin:16px 0;text-align:${safeAlign};`,
    img: `max-width:100%;border-radius:8px;${widthCss}`,
    cap: "font-size:12px;color:#888;margin-top:6px;text-align:center;",
  };
}

export function galleryStyles(count: number): { wrap: string; img: string } {
  const cols = Math.max(1, Math.min(3, count));
  return {
    wrap: `display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;margin:16px 0;`,
    img: "width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;",
  };
}

export const PolarFigure = Node.create({
  name: "polarFigure",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
      align: { default: "center" },
      width: { default: "" },
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-polar-figure]",
        getAttrs: (el) => {
          const fig = el as HTMLElement;
          const img = fig.querySelector("img");
          return {
            src: img?.getAttribute("src") || "",
            alt: img?.getAttribute("alt") || "",
            // markdown-it renders the fence body "![img]\ncaption" as a
            // <p>; the img contributes no text, so the figure's own
            // textContent IS the caption (spike finding).
            caption: (fig.textContent || "").trim(),
            align: DIRECTIVE_ALIGNS.has(fig.dataset.align || "") ? fig.dataset.align : "center",
            width: /^\d{1,3}$/.test(fig.dataset.width || "") ? fig.dataset.width : "",
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const s = figureStyles(node.attrs.align, node.attrs.width);
    return [
      "figure",
      mergeAttributes({
        class: "post-figure",
        "data-polar-figure": "",
        "data-align": node.attrs.align,
        "data-width": node.attrs.width,
        style: s.fig,
      }),
      ["img", { src: node.attrs.src, alt: node.attrs.alt, style: s.img }],
      ["figcaption", { style: s.cap }, node.attrs.caption],
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (n: unknown) => void },
          node: { attrs: Record<string, string> }
        ) {
          const attrs: string[] = [];
          if (node.attrs.align && node.attrs.align !== "center") attrs.push(`align=${node.attrs.align}`);
          if (node.attrs.width) attrs.push(`width=${node.attrs.width}`);
          const brace = attrs.length ? `{${attrs.join(" ")}}` : "";
          state.write(`:::figure${brace}\n![${node.attrs.alt}](${node.attrs.src})\n${node.attrs.caption}\n:::`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

export const PolarGallery = Node.create({
  name: "polarGallery",
  group: "block",
  atom: true,
  addAttributes() {
    return { images: { default: [] as GalleryImage[] } };
  },
  parseHTML() {
    return [
      {
        tag: "div[data-polar-gallery]",
        getAttrs: (el) => ({
          images: Array.from((el as HTMLElement).querySelectorAll("img")).map((img) => ({
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
          })),
        }),
      },
    ];
  },
  renderHTML({ node }) {
    const images = node.attrs.images as GalleryImage[];
    const s = galleryStyles(images.length);
    const imgs = images.map((im) => ["img", { src: im.src, alt: im.alt, style: s.img }] as const);
    return ["div", mergeAttributes({ class: "post-gallery", "data-polar-gallery": "", style: s.wrap }), ...imgs];
  },
  addStorage() {
    return {
      markdown: {
        serialize(
          state: { write: (s: string) => void; closeBlock: (n: unknown) => void },
          node: { attrs: { images: GalleryImage[] } }
        ) {
          const body = node.attrs.images.map((im) => `![${im.alt}](${im.src})`).join("\n");
          state.write(`:::gallery\n${body}\n:::`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

// ---- editor-side markdown parsing (tiptap-markdown → markdown-it) -------

import markdownItContainer from "markdown-it-container";

function parseBraceAttrs(info: string): Record<string, string> {
  const m = info.match(/\{([^}]*)\}/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const pair of m[1].split(/\s+/)) {
    const [k, v] = pair.split("=");
    if (k && v) out[k] = v;
  }
  return out;
}

type MarkdownItLike = {
  use: (...args: unknown[]) => void;
};

// setupDirectiveMarkdownIt teaches tiptap-markdown's markdown-it instance
// to turn :::figure/:::gallery fences into the HTML shapes the nodes'
// parseHTML matches. NOTE (spike finding): markdown-it-container's default
// validate compares the WHOLE info string to the name, so "figure{...}"
// needs a custom validate.
export function setupDirectiveMarkdownIt(md: MarkdownItLike): void {
  md.use(markdownItContainer, "figure", {
    validate(params: string) {
      return /^figure(\{[^}]*\})?\s*$/.test(params.trim());
    },
    render(tokens: Array<{ nesting: number; info: string }>, idx: number) {
      const tok = tokens[idx];
      if (tok.nesting === 1) {
        const attrs = parseBraceAttrs(tok.info);
        const align = DIRECTIVE_ALIGNS.has(attrs.align) ? attrs.align : "center";
        const width = /^\d{1,3}$/.test(attrs.width || "") ? attrs.width : "";
        return `<figure data-polar-figure data-align="${align}" data-width="${width}">`;
      }
      return "</figure>";
    },
  });
  md.use(markdownItContainer, "gallery", {
    render(tokens: Array<{ nesting: number }>, idx: number) {
      return tokens[idx].nesting === 1 ? `<div data-polar-gallery>` : "</div>";
    },
  });
}
