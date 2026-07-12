// Headless round-trip test for the :::figure / :::gallery directive spike.
// Usage: node scripts/spike-directive-test.mjs (after npm run build; serves dist itself)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".map": "application/json" };

const server = createServer(async (req, res) => {
  try {
    const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
    const body = await readFile(p);
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("nope");
  }
});
await new Promise((r) => server.listen(8899, r));

const CASES = [
  {
    name: "figure round-trip",
    md: ":::figure{align=right width=60}\n![dam](/uploads/dam.jpg)\n黄昏时的水坝\n:::",
    expect: [":::figure{align=right width=60}", "![dam](/uploads/dam.jpg)", "黄昏时的水坝", ":::"],
  },
  {
    name: "gallery round-trip",
    md: ":::gallery\n![a](/uploads/a.jpg)\n![b](/uploads/b.jpg)\n:::",
    expect: [":::gallery", "![a](/uploads/a.jpg)", "![b](/uploads/b.jpg)", ":::"],
  },
  {
    name: "plain markdown untouched",
    md: "# 标题\n\n正文 **加粗** 和 [链接](https://x.com)。\n\n- 甲\n- 乙",
    expect: ["# 标题", "**加粗**", "[链接](https://x.com)", "- 甲"],
  },
  {
    name: "figure defaults omitted",
    md: ":::figure\n![x](/uploads/x.jpg)\ncap\n:::",
    expect: [":::figure\n", "![x](/uploads/x.jpg)"],
  },
];

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:8899/spike-directive.html", { waitUntil: "networkidle2" });
await page.waitForFunction(() => Boolean(window.__spike), { timeout: 10000 });

const wired = await page.evaluate(() => window.__spike.parserWired);
console.log(`parser wired into tiptap-markdown's markdown-it: ${wired}`);

let pass = 0, fail = 0;
for (const c of CASES) {
  const out = await page.evaluate((md) => {
    window.__spike.setMd(md);
    return { md: window.__spike.getMd(), html: window.__spike.getHTML() };
  }, c.md);
  const missing = c.expect.filter((frag) => !out.md.includes(frag));
  if (missing.length === 0) {
    console.log(`PASS ${c.name}`);
    pass += 1;
  } else {
    console.log(`FAIL ${c.name}\n  missing: ${JSON.stringify(missing)}\n  got md: ${JSON.stringify(out.md)}\n  got html: ${out.html.slice(0, 300)}`);
    fail += 1;
  }
}
await browser.close();
server.close();
console.log(`\n${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
