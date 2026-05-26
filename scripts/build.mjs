import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const srcDir = path.join(rootDir, "src");
const distDir = path.join(rootDir, "dist");
const pkgPath = path.join(rootDir, "package.json");
const tsconfigPath = path.join(rootDir, "tsconfig.json");
const publicScriptsDir = path.join(publicDir, "scripts");

async function runTypeScriptCheck() {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(rootDir, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        tsconfigPath,
        "--noEmit",
      ],
      { cwd: rootDir, stdio: "inherit" }
    );
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`TypeScript type check failed with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function collectEntryPoints() {
  // Top-level src/*.ts (and src/*.tsx, for React-powered pages like
  // console.tsx) — each maps 1:1 to a bundled JS in public/scripts/.
  // Files ending in `.ts.bak` are legacy/backup and ignored.
  const files = await readdir(srcDir);
  return files
    .filter((name) => (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".ts.bak"))
    .map((name) => path.join(srcDir, name));
}

function esbuildOptions(entries) {
  return {
    entryPoints: entries,
    bundle: true,
    format: "esm",
    // es2022 unlocks top-level await, which @novnc/novnc 1.7+ uses for
    // its WebCodecs H264 feature probe (core/util/browser.js).
    // All currently-supported Safari / Chrome / Firefox understand it.
    target: ["es2022"],
    platform: "browser",
    outdir: publicScriptsDir,
    outExtension: { ".js": ".js" },
    sourcemap: "linked",
    logLevel: "info",
    // splitting:true so esbuild can move modules with top-level await
    // (noVNC 1.7's WebCodecs H264 probe) into separate chunks; without
    // it, esbuild emits the TLA inside a non-async wrapper and the
    // resulting bundle is unparseable in Safari ("await unexpected
    // identifier"). Side-effect: many small chunk files alongside the
    // entry bundles; nginx + dock both serve any .js path under
    // /scripts/, so chunk fetches just work.
    splitting: true,
    minify: true,
    // keepNames preserves function/class `.name` properties through
    // minification. xterm.js (and some other libs we ship) depend on
    // class identity at runtime — e.g. its keyboard-event pipeline
    // looks up handlers by class name and silently drops events when
    // the names get rewritten. Without this, shell panes open and
    // render output fine, but operator typing goes nowhere.
    // Same fix as commit ca6eb5e on feat/host-macmon-grafana-embed.
    keepNames: true,
    legalComments: "none",
    tsconfig: tsconfigPath,
  };
}

async function runEsbuild() {
  const entries = await collectEntryPoints();
  await esbuild.build(esbuildOptions(entries));
}

async function clean() {
  await rm(distDir, { recursive: true, force: true });
  await rm(publicScriptsDir, { recursive: true, force: true });
  console.log("Cleaned ui/dist and ui/public/scripts");
}

async function build() {
  await runTypeScriptCheck();
  await rm(publicScriptsDir, { recursive: true, force: true });
  await runEsbuild();

  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const builtAt = new Date().toISOString();
  const buildHash = Date.now().toString(36);

  const meta = {
    name: pkg.name,
    version: pkg.version,
    builtAt,
    buildHash,
    output: "dist",
    deployHint: "Copy the contents of ui/dist into your web server ui directory.",
  };

  await writeFile(
    path.join(distDir, "build-meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(publicDir, "build-meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8"
  );

  console.log(`Built UI into ui/dist (hash: ${buildHash})`);
}

async function watch() {
  // Watch mode: skip the heavy tsc --noEmit check on every keystroke
  // (esbuild does its own TS handling) and stage everything into dist
  // up front so nginx (or whichever server is pointing at dist) picks
  // up changes the moment esbuild rebuilds.
  await rm(publicScriptsDir, { recursive: true, force: true });
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const entries = await collectEntryPoints();
  const ctx = await esbuild.context({
    ...esbuildOptions(entries),
    plugins: [
      {
        name: "polar-watch-syncer",
        setup(build) {
          build.onEnd(async (result) => {
            const errs = result?.errors?.length ?? 0;
            if (errs > 0) {
              console.log(`✗ rebuild failed (${errs} error${errs > 1 ? "s" : ""})`);
              return;
            }
            // Republish dist so a server that's serving dist directly
            // (nginx pointing at ui/dist) sees fresh JS + HTML even if
            // a non-ts file under public/ changed too.
            try {
              await cp(publicDir, distDir, { recursive: true });
              const stamp = new Date().toLocaleTimeString();
              console.log(`✓ rebuilt + dist synced (${stamp})`);
            } catch (err) {
              console.log(`✗ dist sync failed: ${err.message}`);
            }
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log("👀 watching ui/src + ui/public — Ctrl-C to stop");
  // Keep the process alive — esbuild's watch doesn't block on its own.
  await new Promise(() => {});
}

if (process.argv.includes("--clean")) {
  await clean();
} else if (process.argv.includes("--watch")) {
  await watch();
} else {
  await build();
}
