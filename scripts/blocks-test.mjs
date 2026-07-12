// Headless regression test for the post block editor (:::figure/:::gallery).
// Usage: npm run build && node scripts/blocks-test.mjs
// Needs puppeteer-core + a local Chrome (dev machines only; not wired to CI).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "application/json" };

const server = createServer(async (req, res) => {
  try {
    const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    const body = await readFile(p);
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(8898, r));

const FIGURE_MD = ":::figure{align=right width=60}\n![dam](/uploads/dam.jpg)\n黄昏时的水坝\n:::";
const GALLERY_MD = ":::gallery\n![a](/uploads/a.jpg)\n![b](/uploads/b.jpg)\n![c](/uploads/c.jpg)\n:::";

const ROUNDTRIP = [
  { name: "figure round-trip", md: FIGURE_MD, expect: [":::figure{align=right width=60}", "![dam](/uploads/dam.jpg)", "黄昏时的水坝"] },
  { name: "gallery round-trip", md: GALLERY_MD, expect: [":::gallery", "![b](/uploads/b.jpg)"] },
  { name: "plain md untouched", md: "# 标题\n\n**加粗** 与 [链接](https://x.com)。", expect: ["# 标题", "**加粗**"] },
];

const RENDER = [
  { name: "figure renders", md: FIGURE_MD, expect: ['class="post-figure"', 'data-align="right"', 'src="/uploads/dam.jpg"', "黄昏时的水坝", "width:60%"] },
  { name: "gallery renders 3-col grid", md: GALLERY_MD, expect: ['class="post-gallery"', "repeat(3,1fr)", 'src="/uploads/c.jpg"'] },
  { name: "unknown kind degrades to text", md: ":::script\nalert(1)\n:::", expect: [":::script"], reject: ["<script"] },
  { name: "javascript: src dropped", md: ":::figure\n![x](javascript:alert(1))\ncap\n:::", reject: ["javascript:"] },
  { name: "plain markdown unaffected", md: "**加粗**", expect: ["<strong"] },
];

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:8898/blocks-test.html", { waitUntil: "networkidle2" });
await page.waitForFunction(() => Boolean(window.__blocks), { timeout: 10000 });

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    console.log(`PASS ${name}`);
    pass += 1;
  } else {
    console.log(`FAIL ${name}\n  ${detail}`);
    fail += 1;
  }
}

for (const c of ROUNDTRIP) {
  const out = await page.evaluate((md) => {
    window.__blocks.setMd(md);
    return window.__blocks.getMd();
  }, c.md);
  const missing = c.expect.filter((f) => !out.includes(f));
  check(c.name, missing.length === 0, `missing ${JSON.stringify(missing)} in ${JSON.stringify(out)}`);
}

for (const c of RENDER) {
  const html = await page.evaluate((md) => window.__blocks.render(md), c.md);
  const missing = (c.expect || []).filter((f) => !html.includes(f));
  const present = (c.reject || []).filter((f) => html.includes(f));
  check(c.name, missing.length === 0 && present.length === 0, `missing ${JSON.stringify(missing)} unwanted ${JSON.stringify(present)} in ${html.slice(0, 240)}`);
}

await browser.close();
server.close();
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
