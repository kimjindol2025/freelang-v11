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

// Phase P2: stdlib alias lint (advisory) — 빌드 시 누락 alias 정보성 출력
try {
  const { spawnSync } = require("child_process");
  const r = spawnSync("node", [path.join(__dirname, "lint-stdlib-aliases.js"), "--quiet"], { encoding: "utf8" });
  // exit code 0 (advisory)이라 빌드 막지 않음. 사용자가 make lint-aliases로 상세 확인.
} catch (e) {
  console.warn(`alias_lint=skipped (${e.message})`);
}

// AI 시스템 프롬프트 자동 갱신 (시그니처 추출 직후, AI-1 통합)
try {
  require(path.join(__dirname, "gen-ai-prompt.js"));
} catch (e) {
  console.warn(`ai_prompt=skipped (${e.message})`);
}

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
    "__dirname": '"/"',
    "__filename": '"browser.js"',
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
