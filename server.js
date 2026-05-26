const express = require("express");
const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.API_BASE || "http://localhost:8080";
const UI_STATIC_DIR = process.env.UI_STATIC_DIR || "public";
const target = new URL(API_BASE);
const client = target.protocol === "https:" ? https : http;

// Read build hash for cache busting. Falls back to process start time.
function getBuildHash() {
  try {
    const metaPath = path.join(__dirname, UI_STATIC_DIR, "build-meta.json");
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    return meta.buildHash || Date.now().toString(36);
  } catch {
    return Date.now().toString(36);
  }
}
const BUILD_HASH = getBuildHash();

// Serve HTML pages with no-cache headers and inject ?v= into asset URLs.
const HTML_PAGES = ["login", "register", "dashboard", "editor", "chat", "posts", "markdowns", "latch", "admin", "video-studio", "iosdist", "teams", "invite", "projects", "prompts"];

function serveHtml(name, opts) {
  const status = (opts && opts.status) || 200;
  return (req, res) => {
    const filePath = path.join(__dirname, UI_STATIC_DIR, `${name}.html`);
    let html;
    try {
      html = fs.readFileSync(filePath, "utf8");
    } catch {
      // Fallback to a static 404.html if the requested page is missing.
      // serve404 handles its own status code so we don't recurse.
      return serve404(req, res);
    }
    // Inject cache-busting version into .js and .css references.
    html = html
      .replace(/(src="\/scripts\/[^"]+\.js)(")/g, `$1?v=${BUILD_HASH}$2`)
      .replace(/(href="\/[^"]+\.css)(")/g, `$1?v=${BUILD_HASH}$2`);
    res.status(status);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  };
}

// serve404 reads /404.html from the static dir and emits it with a
// 404 status. Used both by serveHtml (when a known route maps to a
// missing template) and by the catch-all at the bottom of the
// pipeline (any unmatched path).
function serve404(req, res) {
  const filePath = path.join(__dirname, UI_STATIC_DIR, "404.html");
  try {
    let html = fs.readFileSync(filePath, "utf8");
    html = html.replace(/(href="\/[^"]+\.css)(")/g, `$1?v=${BUILD_HASH}$2`);
    res.status(404);
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch {
    res.status(404).type("text/plain").send("404 — page not found");
  }
}

app.get("/login", (req, res) => res.redirect("/login.html"));
app.get("/register", (req, res) => res.redirect("/register.html"));
app.get("/dashboard", (req, res) => res.redirect("/dashboard.html"));
app.get("/editor", (req, res) => res.redirect("/editor.html"));
app.get("/admin", (req, res) => res.redirect("/admin.html"));

for (const name of HTML_PAGES) {
  app.get(`/${name}.html`, serveHtml(name));
}

app.use(express.static(UI_STATIC_DIR, { etag: false, lastModified: false }));

function proxyRequest(req, res) {
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    method: req.method,
    path: req.originalUrl,
    headers: {
      ...req.headers,
      host: target.host,
    },
  };

  const proxy = client.request(options, (proxyRes) => {
    // Rewrite Set-Cookie so the upstream's Domain=... (and Secure on HTTPS-only
    // dev) doesn't make the browser drop cookies on http://localhost.
    const headers = { ...proxyRes.headers };
    const sc = proxyRes.headers["set-cookie"];
    if (sc) {
      headers["set-cookie"] = sc.map((c) =>
        c
          .replace(/;\s*Domain=[^;]+/i, "")
          .replace(/;\s*Secure/i, "")
      );
    }
    res.writeHead(proxyRes.statusCode || 500, headers);
    proxyRes.pipe(res);
  });

  proxy.on("error", () => {
    res.status(502).send("Bad Gateway");
  });

  req.pipe(proxy);
}

app.use("/api", proxyRequest);
app.use("/uploads", proxyRequest);
// iOS distribution module owns several non-/api server-rendered routes
// (plaza, public share page, OTA manifest + install). Without this the
// dev server returns Express's default 404.
app.use("/iosdist", proxyRequest);

// Catch-all 404 handler. Anything not matched by an HTML route, the
// /api proxy, the /uploads proxy, the /iosdist proxy, or static
// assets falls through here. We serve the themed /404.html (which
// also reapplies the user's theme preference) instead of the bare
// "Cannot GET ..." Express default. Out-of-scope: production
// nginx — that's configured separately.
app.use((req, res) => serve404(req, res));

const server = app.listen(PORT, () => {
  console.log(`UI running on http://localhost:${PORT}`);
  console.log(`Serving static files from ${UI_STATIC_DIR}`);
  console.log(`Proxying to ${API_BASE}`);
});

server.on("upgrade", (req, socket, head) => {
  if (!req.url || !req.url.startsWith("/ws/")) {
    socket.destroy();
    return;
  }

  const port =
    target.port || (target.protocol === "https:" ? "443" : "80");
  const connect =
    target.protocol === "https:"
      ? tls.connect
      : net.connect;
  const upstream = connect(port, target.hostname, () => {
    const forwardedHeaders = Object.entries(req.headers)
      .filter(([key]) => key.toLowerCase() !== "host")
      .map(([key, value]) => `${key}: ${value}`);
    const headerLines = [
      `GET ${req.url} HTTP/1.1`,
      `Host: ${target.host}`,
      ...forwardedHeaders,
      "",
      "",
    ];
    upstream.write(headerLines.join("\r\n"));
    if (head && head.length > 0) {
      upstream.write(head);
    }
  });

  upstream.on("error", () => {
    socket.destroy();
  });
  socket.on("error", () => {
    upstream.destroy();
  });

  upstream.pipe(socket);
  socket.pipe(upstream);
});
