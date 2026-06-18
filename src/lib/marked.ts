import { linkifyEscaped } from "./linkify.js";

declare global {
  interface Window {
    marked?: {
      parse(input: string, options?: Record<string, unknown>): string;
      use?(...extensions: Array<Record<string, unknown>>): void;
      Renderer?: new () => Record<string, unknown>;
    };
    __markedConfigured?: boolean;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{L}\p{N}\-_]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string): string {
  return escapeHtml(input).replace(/`/g, "&#96;");
}

function normalizeFenceLang(input: string): string {
  return input.trim().split(/\s+/)[0]?.toLowerCase() || "";
}

function countLines(input: string): number {
  return input ? input.split(/\r\n|\r|\n/).length : 0;
}

function encodedCopyPayload(input: string): string {
  try {
    return window.btoa(unescape(encodeURIComponent(input)));
  } catch {
    return "";
  }
}

function codeBlockShell(opts: {
  code: string;
  lang: string;
  body: string;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  label?: string;
}): string {
  const lang = opts.lang || "text";
  const label = opts.label || lang;
  const copyPayload = encodedCopyPayload(opts.code);
  const copyButton = copyPayload
    ? `<button class="markdown-code-copy" type="button" data-copy-code="${escapeAttr(copyPayload)}">Copy</button>`
    : "";
  const header = `
    <div class="markdown-code-head">
      <span class="markdown-code-lang">${escapeHtml(label)}</span>
      ${copyButton}
    </div>
  `;
  const body = `<div class="markdown-code-body">${opts.body}</div>`;
  const cls = `markdown-code-block${opts.className ? ` ${opts.className}` : ""}`;
  if (opts.collapsible) {
    return `
      <details class="${cls}"${opts.defaultOpen ? " open" : ""}>
        <summary>${header}</summary>
        ${body}
      </details>
    `;
  }
  return `<figure class="${cls}">${header}${body}</figure>`;
}

function renderSourcePre(code: string, lang: string): string {
  const classAttr = lang ? ` class="language-${escapeAttr(lang)}"` : "";
  return `<pre><code${classAttr}>${escapeHtml(code)}</code></pre>`;
}

function sanitizeSvgForImage(input: string): string | null {
  const source = input.trim();
  if (!/^<svg[\s>]/i.test(source)) {
    return null;
  }
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return source;
  }

  const doc = new DOMParser().parseFromString(source, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    return null;
  }
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") {
    return null;
  }

  svg.querySelectorAll("script, foreignObject, iframe, object, embed, link, meta").forEach((el) => el.remove());
  svg.querySelectorAll("style").forEach((el) => {
    el.textContent = (el.textContent || "")
      .replace(/@import[^;]+;/gi, "")
      .replace(/url\s*\([^)]*\)/gi, "none");
  });
  svg.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === "href" || name === "xlink:href" || name === "src") && /^\s*(javascript:|data:text\/html)/i.test(value)) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === "style") {
        el.setAttribute(attr.name, value.replace(/url\s*\([^)]*\)/gi, "none"));
      }
    });
  });

  return new XMLSerializer().serializeToString(svg);
}

type CodeFenceRenderer = {
  match: (lang: string, code: string) => boolean;
  render: (code: string, lang: string) => string | false;
};

function renderSvgCodeBlock(code: string, lang: string): string | false {
  const svg = sanitizeSvgForImage(code);
  if (!svg) {
    return false;
  }
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const body = `
      <div class="markdown-svg-frame">
        <img class="markdown-svg-preview" src="${dataUrl}" alt="SVG preview" loading="lazy" />
      </div>
      <details class="markdown-svg-source">
        <summary>SVG source</summary>
        ${renderSourcePre(code, lang)}
      </details>
  `;
  return codeBlockShell({ code, lang, label: "SVG", className: "markdown-svg-figure", body });
}

function renderDefaultCodeBlock(code: string, lang: string): string {
  const lineCount = countLines(code);
  return codeBlockShell({
    code,
    lang,
    label: lang || "code",
    className: lineCount > 80 ? "is-long" : "",
    collapsible: lineCount > 140,
    defaultOpen: lineCount <= 140,
    body: renderSourcePre(code, lang),
  });
}

function renderJsonValue(value: unknown, depth = 0): string {
  if (depth > 16) {
    return `<span class="json-muted">...</span>`;
  }
  if (value === null) return `<span class="json-null">null</span>`;
  if (typeof value === "string") return `<span class="json-string">"${escapeHtml(value)}"</span>`;
  if (typeof value === "number") return `<span class="json-number">${String(value)}</span>`;
  if (typeof value === "boolean") return `<span class="json-boolean">${String(value)}</span>`;
  if (Array.isArray(value)) {
    if (!value.length) return `<span class="json-muted">[]</span>`;
    const items = value
      .map((item, index) => `<li><span class="json-index">${index}</span>${renderJsonValue(item, depth + 1)}</li>`)
      .join("");
    return `<details class="json-node" open><summary>Array(${value.length})</summary><ol>${items}</ol></details>`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return `<span class="json-muted">{}</span>`;
    const items = entries
      .map(([key, item]) => `<li><span class="json-key">"${escapeHtml(key)}"</span>${renderJsonValue(item, depth + 1)}</li>`)
      .join("");
    return `<details class="json-node" open><summary>Object(${entries.length})</summary><ol>${items}</ol></details>`;
  }
  return `<span class="json-muted">${escapeHtml(String(value))}</span>`;
}

function renderJsonCodeBlock(code: string, lang: string): string | false {
  if (code.length > 200_000) {
    return false;
  }
  try {
    const parsed = JSON.parse(code) as unknown;
    const pretty = JSON.stringify(parsed, null, 2);
    const body = `
      <div class="markdown-json-tree">${renderJsonValue(parsed)}</div>
      <details class="markdown-code-source">
        <summary>JSON source</summary>
        ${renderSourcePre(pretty, lang)}
      </details>
    `;
    return codeBlockShell({ code: pretty, lang, label: "JSON", className: "markdown-json-block", body });
  } catch {
    return false;
  }
}

function renderDiffCodeBlock(code: string, lang: string): string {
  const rows = code.split(/\r\n|\r|\n/).map((line) => {
    const kind = line.startsWith("+") && !line.startsWith("+++") ? "add"
      : line.startsWith("-") && !line.startsWith("---") ? "del"
      : line.startsWith("@@") ? "hunk"
      : "ctx";
    return `<span class="diff-line diff-${kind}">${escapeHtml(line || " ")}</span>`;
  }).join("");
  return codeBlockShell({
    code,
    lang,
    label: "diff",
    className: "markdown-diff-block",
    collapsible: countLines(code) > 180,
    defaultOpen: countLines(code) <= 180,
    body: `<pre><code>${rows}</code></pre>`,
  });
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function renderDelimitedCodeBlock(code: string, lang: string, delimiter: string): string | false {
  const lines = code.trim().split(/\r\n|\r|\n/).filter(Boolean);
  if (lines.length < 2 || lines.length > 200) {
    return false;
  }
  const rows = lines.map((line) => splitDelimitedLine(line, delimiter));
  const width = rows[0]?.length || 0;
  if (width < 2 || rows.some((row) => Math.abs(row.length - width) > 2)) {
    return false;
  }
  const header = rows[0];
  const bodyRows = rows.slice(1);
  const table = `
    <div class="markdown-data-table-wrap">
      <table class="markdown-data-table">
        <thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <details class="markdown-code-source">
      <summary>${escapeHtml(lang.toUpperCase())} source</summary>
      ${renderSourcePre(code, lang)}
    </details>
  `;
  return codeBlockShell({ code, lang, label: lang.toUpperCase(), className: "markdown-data-block", body: table });
}

function renderHtmlCodeBlock(code: string, lang: string): string | false {
  if (code.length > 120_000 || !/<[a-z][\s\S]*>/i.test(code)) {
    return false;
  }
  const body = `
    <iframe
      class="markdown-html-preview"
      sandbox=""
      referrerpolicy="no-referrer"
      loading="lazy"
      srcdoc="${escapeAttr(code)}"
      title="HTML preview"></iframe>
    <details class="markdown-code-source">
      <summary>HTML source</summary>
      ${renderSourcePre(code, lang)}
    </details>
  `;
  return codeBlockShell({ code, lang, label: "HTML", className: "markdown-html-block", body });
}

function renderMermaidCodeBlock(code: string, lang: string): string {
  const body = `
    <div class="markdown-preview-placeholder">Mermaid diagram source</div>
    ${renderSourcePre(code, lang)}
  `;
  return codeBlockShell({ code, lang, label: "Mermaid", className: "markdown-mermaid-block", body });
}

const codeFenceRenderers: CodeFenceRenderer[] = [
  { match: (lang) => lang === "svg", render: renderSvgCodeBlock },
  { match: (lang) => lang === "json" || lang === "jsonc", render: renderJsonCodeBlock },
  { match: (lang) => lang === "diff" || lang === "patch", render: renderDiffCodeBlock },
  { match: (lang) => lang === "csv", render: (code, lang) => renderDelimitedCodeBlock(code, lang, ",") },
  { match: (lang) => lang === "tsv", render: (code, lang) => renderDelimitedCodeBlock(code, lang, "\t") },
  { match: (lang) => lang === "html" || lang === "htm", render: renderHtmlCodeBlock },
  { match: (lang) => lang === "mermaid", render: renderMermaidCodeBlock },
];

function renderCodeFence(code: string, info: string): string {
  const lang = normalizeFenceLang(info);
  for (const renderer of codeFenceRenderers) {
    if (!renderer.match(lang, code)) {
      continue;
    }
    const html = renderer.render(code, lang);
    if (html) {
      return html;
    }
  }
  return renderDefaultCodeBlock(code, lang);
}

function bindMarkdownEnhancements(): void {
  if (document.documentElement.dataset.markdownEnhancementsBound === "true") {
    return;
  }
  document.documentElement.dataset.markdownEnhancementsBound = "true";
  document.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(".markdown-code-copy");
    const encoded = button?.dataset.copyCode;
    if (!button || !encoded) {
      return;
    }
    try {
      const text = decodeURIComponent(escape(window.atob(encoded)));
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      const originalText = button.textContent || "Copy";
      button.dataset.copied = "true";
      button.textContent = "Copied";
      window.setTimeout(() => {
        delete button.dataset.copied;
        button.textContent = originalText;
      }, 1200);
    } catch {
      const originalText = button.textContent || "Copy";
      button.dataset.copyFailed = "true";
      button.textContent = "Failed";
      window.setTimeout(() => {
        delete button.dataset.copyFailed;
        button.textContent = originalText;
      }, 1200);
    }
  });
}

function configureMarked(): void {
  const marked = window.marked;
  if (!marked || window.__markedConfigured) {
    return;
  }
  if (typeof marked.use !== "function") {
    return;
  }
  bindMarkdownEnhancements();

  const usedSlugs = new Map<string, number>();

  marked.use({
    gfm: true,
    breaks: true,
    pedantic: false,
    renderer: {
      // Force external links to open in a new tab and add safe rel attrs.
      link(this: unknown, hrefOrToken: unknown, titleOrUndefined?: unknown, textOrUndefined?: unknown): string {
        let href = "";
        let title: string | null = null;
        let text = "";
        if (typeof hrefOrToken === "object" && hrefOrToken !== null) {
          // marked v5+ passes a token object
          const token = hrefOrToken as { href?: string; title?: string | null; text?: string; tokens?: unknown[] };
          href = token.href || "";
          title = token.title ?? null;
          // Try to use the parser's inline rendering if available; fall back to text.
          const parser = (this as { parser?: { parseInline?: (tokens: unknown[]) => string } } | undefined)?.parser;
          if (token.tokens && parser?.parseInline) {
            text = parser.parseInline(token.tokens);
          } else {
            text = token.text || "";
          }
        } else {
          href = String(hrefOrToken || "");
          title = (titleOrUndefined as string | null) ?? null;
          text = String(textOrUndefined || "");
        }
        const safeHref = href.replace(/"/g, "&quot;");
        const titleAttr = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
        const isExternal = /^https?:\/\//i.test(href);
        const relAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${safeHref}"${titleAttr}${relAttr}>${text}</a>`;
      },
      code(codeOrToken: unknown, infostringMaybe?: unknown): string | false {
        let code = "";
        let lang = "";
        if (typeof codeOrToken === "object" && codeOrToken !== null) {
          const token = codeOrToken as { text?: string; lang?: string };
          code = token.text || "";
          lang = token.lang || "";
        } else {
          code = String(codeOrToken || "");
          lang = String(infostringMaybe || "");
        }
        return renderCodeFence(code, lang);
      },
      heading(this: unknown, textOrToken: unknown, levelMaybe?: unknown): string {
        let text = "";
        let level = 1;
        let raw = "";
        if (typeof textOrToken === "object" && textOrToken !== null) {
          const token = textOrToken as { text?: string; depth?: number; tokens?: unknown[] };
          level = token.depth || 1;
          raw = token.text || "";
          const parser = (this as { parser?: { parseInline?: (tokens: unknown[]) => string } } | undefined)?.parser;
          if (token.tokens && parser?.parseInline) {
            text = parser.parseInline(token.tokens);
          } else {
            text = raw;
          }
        } else {
          text = String(textOrToken || "");
          level = Number(levelMaybe) || 1;
          raw = text.replace(/<[^>]+>/g, "");
        }
        let slug = slugify(raw);
        if (slug) {
          const used = usedSlugs.get(slug) || 0;
          usedSlugs.set(slug, used + 1);
          if (used > 0) {
            slug = `${slug}-${used}`;
          }
        }
        const idAttr = slug ? ` id="${slug}"` : "";
        return `<h${level}${idAttr}>${text}</h${level}>\n`;
      },
    },
  });

  window.__markedConfigured = true;
}

// Strip <script>, <style>, <iframe>, and inline event handlers from rendered
// HTML to mitigate XSS in user-supplied markdown.
function sanitizeHtml(html: string): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }
  const doc = new DOMParser().parseFromString(`<div id="__md_root">${html}</div>`, "text/html");
  const root = doc.getElementById("__md_root");
  if (!root) {
    return html;
  }
  const dangerousTags = ["script", "style", "object", "embed", "link", "meta"];
  dangerousTags.forEach((tag) => {
    root.querySelectorAll(tag).forEach((el) => el.remove());
  });
  root.querySelectorAll("iframe").forEach((el) => {
    const isSafePreview = el.classList.contains("markdown-html-preview")
      && el.getAttribute("sandbox") === ""
      && el.hasAttribute("srcdoc")
      && !el.hasAttribute("src");
    if (!isSafePreview) {
      el.remove();
    }
  });
  root.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (el.tagName.toLowerCase() === "iframe") {
        const allowedIframeAttrs = new Set(["class", "sandbox", "referrerpolicy", "loading", "srcdoc", "title"]);
        if (!allowedIframeAttrs.has(name)) {
          el.removeAttribute(attr.name);
          return;
        }
      }
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return root.innerHTML;
}

export function renderMarkdown(input: string): string {
  if (!input) {
    return "";
  }
  // Defense-in-depth: if marked is unavailable or throws, fall back to the
  // escape-then-autolink renderer rather than returning the raw string — the
  // result is interpolated as innerHTML by callers, so a raw passthrough would
  // be an injection vector on a CDN/parse failure.
  if (!window.marked) {
    return linkifyEscaped(input);
  }
  configureMarked();
  try {
    const html = window.marked.parse(input);
    return sanitizeHtml(typeof html === "string" ? html : String(html));
  } catch {
    return linkifyEscaped(input);
  }
}

// Plain-text raw view that preserves the original markdown source. The DOM
// caller is responsible for placing the returned string inside a <pre>.
export function escapeForRaw(input: string): string {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export {};
