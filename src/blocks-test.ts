// blocks-test.html backing script — a permanent regression harness for the
// post block editor (:::figure/:::gallery): exposes editor round-trip and
// renderMarkdown on window.__blocks for the headless test
// (scripts/blocks-test.mjs). No API calls; safe static page.

import { createMarkdownEditor } from "./lib/rich-editor.js";
import { PolarFigure, PolarGallery, setupDirectiveMarkdownIt } from "./lib/blocks/directive-nodes.js";
import { renderMarkdown } from "./lib/marked.js";

const host = document.getElementById("editor") as HTMLElement;
const editor = createMarkdownEditor(host, {
  extensions: [PolarFigure, PolarGallery],
  setupMarkdown: setupDirectiveMarkdownIt,
});

declare global {
  interface Window {
    __blocks: {
      setMd(md: string): void;
      getMd(): string;
      render(md: string): string;
    };
  }
}

window.__blocks = {
  setMd(md: string) {
    editor.setMarkdown(md);
  },
  getMd() {
    return editor.getMarkdown();
  },
  render(md: string) {
    return renderMarkdown(md);
  },
};
