// SPIKE (POLARDOCKU #8, item 2): can tiptap-markdown 0.9 round-trip a
// custom :::figure / :::gallery directive? Validates the serialize hook
// (extension storage `markdown.serialize`) and the parse path
// (markdown-it-container plugin → HTML → node parseHTML).
// Not shipped — driven headlessly by scripts/spike-directive-test.mjs.

import { Editor, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import markdownItContainer from "markdown-it-container";

const ALIGN = new Set(["left", "center", "right"]);

// ---- figure: single image + caption, attrs align/width -----------------

const Figure = Node.create({
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
            // markdown-it renders the inner "![img]\ncaption" as a <p>,
            // not a <figcaption>; the img contributes no text, so the
            // figure's own textContent IS the caption.
            caption: (fig.textContent || "").trim(),
            align: ALIGN.has(fig.dataset.align || "") ? fig.dataset.align : "center",
            width: fig.dataset.width || "",
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      "figure",
      mergeAttributes({
        "data-polar-figure": "",
        "data-align": node.attrs.align,
        "data-width": node.attrs.width,
      }),
      ["img", { src: node.attrs.src, alt: node.attrs.alt }],
      ["figcaption", {}, node.attrs.caption],
    ];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: {
          attrs: Record<string, string>;
        }) {
          const attrs: string[] = [];
          if (node.attrs.align && node.attrs.align !== "center") attrs.push(`align=${node.attrs.align}`);
          if (node.attrs.width) attrs.push(`width=${node.attrs.width}`);
          const brace = attrs.length ? `{${attrs.join(" ")}}` : "";
          state.write(`:::figure${brace}\n![${node.attrs.alt}](${node.attrs.src})\n${node.attrs.caption}\n:::`);
          state.closeBlock(node);
        },
        parse: {
          // tiptap-markdown parse pipeline = markdown-it → HTML → editor
          // HTML parser, so parsing lives in the markdown-it plugin below.
        },
      },
    };
  },
});

// ---- gallery: 2..9 images as one block ---------------------------------

const Gallery = Node.create({
  name: "polarGallery",
  group: "block",
  atom: true,
  addAttributes() {
    return { images: { default: [] as Array<{ src: string; alt: string }> } };
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
    const imgs = (node.attrs.images as Array<{ src: string; alt: string }>).map(
      (im) => ["img", { src: im.src, alt: im.alt }] as const
    );
    return ["div", mergeAttributes({ "data-polar-gallery": "" }), ...imgs];
  },
  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: {
          attrs: { images: Array<{ src: string; alt: string }> };
        }) {
          const body = node.attrs.images.map((im) => `![${im.alt}](${im.src})`).join("\n");
          state.write(`:::gallery\n${body}\n:::`);
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
});

// ---- markdown-it container plugin: directive → HTML ---------------------

function attrString(info: string): Record<string, string> {
  const m = info.match(/\{([^}]*)\}/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const pair of m[1].split(/\s+/)) {
    const [k, v] = pair.split("=");
    if (k && v) out[k] = v;
  }
  return out;
}

function setupMarkdownIt(md: {
  use: (...args: unknown[]) => void;
  renderer: { rules: Record<string, unknown> };
  render: (s: string) => string;
}): void {
  md.use(markdownItContainer, "figure", {
    // default validate compares the WHOLE info string against the name,
    // so ":::figure{align=right}" is rejected — must accept name+braces.
    validate(params: string) {
      return /^figure(\{[^}]*\})?\s*$/.test(params.trim());
    },
    render(tokens: Array<{ nesting: number; info: string }>, idx: number) {
      const tok = tokens[idx];
      if (tok.nesting === 1) {
        const attrs = attrString(tok.info);
        const align = ALIGN.has(attrs.align) ? attrs.align : "center";
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

// ---- wire up + expose to the headless driver ----------------------------

const host = document.getElementById("editor") as HTMLElement;

// figure's inner "![alt](src)\ncaption" arrives as <p><img/>caption</p>
// inside <figure> from markdown-it; our parseHTML on figure grabs the img
// + trailing text regardless of the intermediate <p>, so no extra work.

const editor = new Editor({
  element: host,
  extensions: [
    StarterKit,
    Figure,
    Gallery,
    Markdown.configure({ html: false, tightLists: true }),
  ],
  content: "",
});

// tiptap-markdown exposes the markdown-it instance at
// editor.storage.markdown.parser.md (undocumented but stable in 0.9).
type MarkdownStorage = { parser?: { md?: Parameters<typeof setupMarkdownIt>[0] } };
const mdStorage = (editor.storage as { markdown?: MarkdownStorage }).markdown;
const mdIt = mdStorage?.parser?.md;
let parserWired = false;
if (mdIt) {
  setupMarkdownIt(mdIt);
  parserWired = true;
}

declare global {
  interface Window {
    __spike: {
      parserWired: boolean;
      setMd(md: string): void;
      getMd(): string;
      getHTML(): string;
    };
  }
}

window.__spike = {
  parserWired,
  setMd(md: string) {
    editor.commands.setContent(md);
  },
  getMd() {
    const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
    return (storage.markdown?.getMarkdown?.() ?? "").trim();
  },
  getHTML() {
    return editor.getHTML();
  },
};
