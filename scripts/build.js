#!/usr/bin/env node
// FreeLang v11 build script — Node API로 esbuild 호출 (bin wrapper 우회)
// v11.10: 빌드 전에 stdlib 시그니처 JSON 을 생성해서 번들에 embed (fn-doc 배포 대응)
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

// 1) stdlib 시그니처 추출 → src/_stdlib-signatures.json
function extractSignatures() {
  const srcDir = path.resolve(__dirname, "..", "src");
  const files = fs.readdirSync(srcDir)
    .filter((f) => f.startsWith("stdlib-") && f.endsWith(".ts"))
    .map((f) => path.join(srcDir, f));
  const entries = [];
  for (const file of files) {
    const modName = path.basename(file, ".ts").replace(/^stdlib-/, "");
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].trim().match(/^\/\/\s*([a-z_][a-z0-9_\-!?]*)\s+(.*?)\s*->\s*(.+)$/i);
      if (!m) continue;
      const [, name, params, ret] = m;
      const next = (lines[i + 1] || "").trim();
      const defMatch = next.match(/^"([^"]+)"\s*:/);
      if (!defMatch || defMatch[1] !== name) continue;
      entries.push({ module: modName, name, params: params.trim(), returns: ret.trim() });
    }
  }
  const out = path.resolve(srcDir, "_stdlib-signatures.json");
  fs.writeFileSync(out, JSON.stringify(entries), "utf8");
  console.log(`stdlib_signatures=${entries.length} file=${out}`);
}

extractSignatures();

// Node.js 빌드
const nodeBuild = esbuild.build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "bootstrap.js",
  loader: { ".json": "json" },
  logLevel: "info",
}).then(() => console.log("bootstrap=built"))
  .catch((err) => { console.error("bootstrap=failed error=" + err.message); process.exit(1); });

// 브라우저 빌드
const browserBuild = esbuild.build({
  entryPoints: ["src/browser-entry.ts"],
  bundle: true,
  platform: "browser",
  target: ["chrome90", "firefox88", "safari14"],
  outfile: "browser.js",
  globalName: "FreeLang",
  loader: { ".json": "json" },
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": '"production"',
    "global": "globalThis",
    "process.env": "{}",
  },
  // Node.js 내장 모듈 → 브라우저 스텁으로 대체
  alias: {
    "fs":              "./src/browser-stubs/node-stubs",
    "path":            "./src/browser-stubs/path-stubs",
    "crypto":          "./src/browser-stubs/crypto-stubs",
    "child_process":   "./src/browser-stubs/child-process-stubs",
    "readline":        "./src/browser-stubs/misc-stubs",
    "net":             "./src/browser-stubs/misc-stubs",
    "os":              "./src/browser-stubs/misc-stubs",
    "http":            "./src/browser-stubs/misc-stubs",
    "https":           "./src/browser-stubs/misc-stubs",
    "events":          "./src/browser-stubs/misc-stubs",
    "stream":          "./src/browser-stubs/misc-stubs",
    "url":             "./src/browser-stubs/misc-stubs",
    "util":            "./src/browser-stubs/misc-stubs",
    "buffer":          "./src/browser-stubs/misc-stubs",
    "vm":              "./src/browser-stubs/misc-stubs",
    "tty":             "./src/browser-stubs/misc-stubs",
    "assert":          "./src/browser-stubs/misc-stubs",
  },
}).then(() => console.log("browser.js=built"))
  .catch((err) => { console.error("browser.js=failed error=" + err.message); });

Promise.all([nodeBuild, browserBuild]).then(() => console.log("all=done"));
