#!/usr/bin/env node
// FreeLang v11 build script — esbuild bundle (production build path)
// docs/PLAN-build-pipeline-unify.md (BP-3) — esbuild 정식화 2026-05-21
// docs/BUILD-SYSTEM.md — 3-track 구조 (Production / Runtime / Experimental)
// 빌드 전 stdlib 시그니처 JSON 생성 후 번들에 embed (fn-doc 배포 대응)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

const isWatch = process.argv.includes("--watch") || process.argv.includes("-w");

// bootstrap.js bundle (production build path) — docs/BUILD-SYSTEM.md 참조
const REPO = path.resolve(__dirname, "..");
const NODE_EXTERNALS = [
  "tls", "net", "fs", "path", "child_process", "os",
  "http", "https", "url", "util", "stream", "buffer",
  "crypto", "readline", "events", "vm", "tty", "assert",
  "worker_threads", "zlib", "dgram", "dns", "http2",
  "perf_hooks", "inspector", "v8", "module",
  "better-sqlite3", "sqlite3", "mysql2", "sharp", "mongodb",
];

// Extension 번들 분리:
//   stdlib-ext-http.js     — http-server
//   stdlib-ext-db.js       — mariadb, mongodb, db, orm
//   stdlib-ext-workflow.js — workflow, resource, service
//   stdlib-ext-ws.js       — ws, wsc
//   stdlib-ext-misc.js     — 기타 (mail, totp, webauthn, ...)
//   bootstrap.js + stdlib-lazy-registry → core (stdlib-lazy-registry는 external)

const EXT_COMMON = {
  bundle: true, platform: "node", target: "node18",
  loader: { ".json": "json" }, minify: false, format: "cjs",
  external: NODE_EXTERNALS, logLevel: "warning",
};

const EXT_BUNDLES = [
  { entryPoints: ["src/ext-http.ts"],     outfile: "stdlib-ext-http.js" },
  { entryPoints: ["src/ext-db.ts"],       outfile: "stdlib-ext-db.js" },
  { entryPoints: ["src/ext-workflow.ts"], outfile: "stdlib-ext-workflow.js" },
  { entryPoints: ["src/ext-ws.ts"],       outfile: "stdlib-ext-ws.js" },
  { entryPoints: ["src/ext-auth.ts"],     outfile: "stdlib-ext-auth.js" },
  { entryPoints: ["src/ext-ai.ts"],       outfile: "stdlib-ext-ai.js" },
  { entryPoints: ["src/ext-content.ts"],  outfile: "stdlib-ext-content.js" },
  { entryPoints: ["src/ext-compile.ts"],  outfile: "stdlib-ext-compile.js" },
  { entryPoints: ["src/ext-registry.ts"], outfile: "stdlib-ext-registry.js" },
  { entryPoints: ["src/ext-async.ts"],    outfile: "stdlib-ext-async.js" },
  // misc는 레거시 하위호환 유지 (내부는 비어 있음)
  { entryPoints: ["src/ext-misc.ts"],     outfile: "stdlib-ext-misc.js" },
];

function bootstrapOpts() {
  return {
    absWorkingDir: REPO,
    entryPoints: ["src/cli.ts"],
    bundle: true, platform: "node", target: "node18",
    outfile: "bootstrap.js",
    loader: { ".json": "json" }, minify: false,
    // stdlib-lazy-registry → external: 런타임에 동적 로드
    external: [...NODE_EXTERNALS, "./stdlib-lazy-registry"],
    logLevel: "info",
  };
}

// stdlib-lazy-registry 자체 번들 (bootstrap이 require로 로드)
function lazyRegistryOpts() {
  return {
    absWorkingDir: REPO,
    entryPoints: ["src/stdlib-lazy-registry.ts"],
    bundle: true, platform: "node", target: "node18",
    outfile: "stdlib-extensions.js",   // 하위호환 유지
    loader: { ".json": "json" }, minify: false, format: "cjs",
    external: NODE_EXTERNALS, logLevel: "warning",
  };
}

function buildBootstrap() {
  const esbuild = require("esbuild");
  const builds = [
    // bootstrap (core)
    esbuild.build(bootstrapOpts()).then(() => {
      const size = fs.statSync(path.join(REPO, "bootstrap.js")).size;
      console.log(`bootstrap=built size=${Math.round(size / 1024)}KB`);
    }),
    // lazy-registry dispatcher (하위호환: stdlib-extensions.js)
    esbuild.build(lazyRegistryOpts()).then(() => {
      const size = fs.statSync(path.join(REPO, "stdlib-extensions.js")).size;
      console.log(`stdlib-extensions=built size=${Math.round(size / 1024)}KB`);
    }),
    // 기능별 extension 번들
    ...EXT_BUNDLES.map(b =>
      esbuild.build({ ...EXT_COMMON, absWorkingDir: REPO, ...b }).then(() => {
        const size = fs.statSync(path.join(REPO, b.outfile)).size;
        console.log(`${b.outfile}=built size=${Math.round(size / 1024)}KB`);
      })
    ),
  ];
  return Promise.all(builds);
}

function watchBootstrap() {
  const esbuild = require("esbuild");
  return esbuild.context(bootstrapOpts()).then((ctx) => ctx.watch()).then(() => {
    console.log("bootstrap=watching (Ctrl+C to stop) — extension bundles built once");
    // watch 모드에서는 bootstrap만 watch, extensions는 1회 빌드
    const extBuilds = [lazyRegistryOpts(), ...EXT_BUNDLES.map(b => ({ ...EXT_COMMON, absWorkingDir: REPO, ...b }))];
    return Promise.all(extBuilds.map(o => esbuild.build(o)));
  });
}

// Node.js 빌드
let nodeBuild;
if (isWatch) {
  nodeBuild = watchBootstrap();
} else {
  nodeBuild = buildBootstrap();
}

// 브라우저 빌드: Phase X-2에서 esbuild 제거, 추후 구현 예정
// (현재 bootstrap.js는 Node.js 전용, 브라우저는 별도 모듈 필요)
const browserBuild = Promise.resolve().then(() => {
  console.log("browser.js=skipped (requires esbuild, Phase X-3 planned)");
});

Promise.all([nodeBuild, browserBuild]).then(() => console.log("all=done"));
