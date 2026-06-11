// Plain-text → safe HTML with clickable links. Single source of truth for
// rendering user-authored text (posts, replies, chat DMs). The rule is
// escape-FIRST: every character of the input is HTML-escaped, and only spans
// that matched an http(s) URL are wrapped in an anchor — so a post containing
// `<script>` or `https://x.com/<img onerror=…>` can never inject markup.
//
// Anchors get target=_blank + rel="noopener noreferrer" to block tab-nabbing.
//
// Scope is deliberately small: plain text + autolinked URLs, NOT markdown or
// arbitrary HTML. Posts are a plain-text field; richer formatting (markdown,
// @mentions, link unfurling) is a separate, opt-in concern — keep this safe and
// boring.

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// linkifyEscaped escapes the whole string and turns bare http(s) URLs into
// anchors. Trailing sentence punctuation (.,;:!?)]}>) is sliced off the URL
// into the surrounding text so "见 https://example.com." doesn't swallow the
// period into the link.
export function linkifyEscaped(input: string): string {
  if (!input) return "";
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(input)) !== null) {
    out += escapeHtml(input.slice(last, m.index));
    let url = m[0];
    let trailing = "";
    while (url.length > 0 && /[.,;:!?)\]}>]/.test(url[url.length - 1])) {
      trailing = url[url.length - 1] + trailing;
      url = url.slice(0, -1);
    }
    if (url.length === 0) {
      // Pathological "https://" with nothing after — treat as plain text.
      out += escapeHtml(m[0]);
    } else {
      const safe = escapeHtml(url);
      out += `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`;
      out += escapeHtml(trailing);
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(input.slice(last));
  return out;
}
