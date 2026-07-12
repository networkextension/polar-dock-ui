// Minimal reusable Tiptap rich-text editor that stores MARKDOWN (not HTML).
// Same stack the /creation.html markdown editor uses (StarterKit +
// tiptap-markdown with html:false), packaged as a small factory so any compose
// surface (posts, …) gets WYSIWYG editing without re-wiring Tiptap.
//
// Why markdown, not HTML: html:false means the editor never emits raw HTML, so
// the stored content is clean markdown and the render side (renderMarkdown,
// which sanitizes) has a small, well-understood attack surface. No DOMPurify /
// arbitrary-HTML pipeline needed.

import { Editor, type AnyExtension } from "@tiptap/core";
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
  /** extra Tiptap nodes/marks (e.g. the post block-editor's figure/gallery). */
  extensions?: AnyExtension[];
  /** extra ProseMirror editorProps (handlePaste/handleDrop for image upload). */
  editorProps?: Record<string, unknown>;
  /**
   * hook to extend the markdown-it instance tiptap-markdown parses with
   * (custom :::directive containers). Called once after construction;
   * the instance lives at editor.storage.markdown.parser.md (0.9,
   * undocumented but stable — validated by the directive spike).
   */
  setupMarkdown?: (md: { use: (...args: unknown[]) => void }) => void;
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown?: () => string } };
  return (storage.markdown?.getMarkdown?.() ?? "").trim();
}

export function createMarkdownEditor(host: HTMLElement, opts: CreateOpts = {}): MarkdownEditor {
  const editor = new Editor({
    element: host,
    extensions: [StarterKit, Markdown.configure({ html: false, tightLists: true }), ...(opts.extensions ?? [])],
    content: opts.initial || "",
    editorProps: {
      attributes: {
        class: opts.cssClass || "rich-prose",
        spellcheck: "false",
      },
      ...(opts.editorProps ?? {}),
    },
    onUpdate: ({ editor: ed }) => {
      opts.onChange?.(readMarkdown(ed));
    },
  });

  if (opts.setupMarkdown) {
    const storage = editor.storage as {
      markdown?: { parser?: { md?: { use: (...args: unknown[]) => void } } };
    };
    const md = storage.markdown?.parser?.md;
    if (md) {
      opts.setupMarkdown(md);
      // re-ingest initial content so directives in `initial` parse too
      if (opts.initial) {
        editor.commands.setContent(opts.initial);
      }
    }
  }

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
