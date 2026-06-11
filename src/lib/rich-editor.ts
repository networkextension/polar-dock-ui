// Minimal reusable Tiptap rich-text editor that stores MARKDOWN (not HTML).
// Same stack the /creation.html markdown editor uses (StarterKit +
// tiptap-markdown with html:false), packaged as a small factory so any compose
// surface (posts, …) gets WYSIWYG editing without re-wiring Tiptap.
//
// Why markdown, not HTML: html:false means the editor never emits raw HTML, so
// the stored content is clean markdown and the render side (renderMarkdown,
// which sanitizes) has a small, well-understood attack surface. No DOMPurify /
// arbitrary-HTML pipeline needed.

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

export interface MarkdownEditor {
  editor: Editor;
  /** Current document as trimmed markdown source. */
  getMarkdown(): string;
  /** Replace the document with the given markdown. */
  setMarkdown(md: string): void;
  /** Empty the document. */
  clear(): void;
  isEmpty(): boolean;
  focus(): void;
  destroy(): void;
}

interface CreateOpts {
  initial?: string;
  /** class applied to the contenteditable host (for styling). */
  cssClass?: string;
  /** fires on every edit with the current markdown — e.g. to mirror into a hidden textarea. */
  onChange?: (markdown: string) => void;
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  return (storage.markdown?.getMarkdown?.() ?? "").trim();
}

export function createMarkdownEditor(host: HTMLElement, opts: CreateOpts = {}): MarkdownEditor {
  const editor = new Editor({
    element: host,
    extensions: [StarterKit, Markdown.configure({ html: false, tightLists: true })],
    content: opts.initial || "",
    editorProps: {
      attributes: {
        class: opts.cssClass || "rich-prose",
        spellcheck: "false",
      },
    },
    onUpdate: ({ editor: ed }) => {
      opts.onChange?.(readMarkdown(ed));
    },
  });

  return {
    editor,
    getMarkdown: () => readMarkdown(editor),
    setMarkdown(md: string) {
      editor.commands.setContent(md || "");
    },
    clear() {
      editor.commands.clearContent();
    },
    isEmpty() {
      return editor.isEmpty;
    },
    focus() {
      editor.commands.focus("end");
    },
    destroy() {
      editor.destroy();
    },
  };
}
