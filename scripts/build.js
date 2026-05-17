#!/usr/bin/env node
// FreeLang v11 build script — stage1.js로 bootstrap.js 생성 (esbuild 제거)
// v11.10: 빌드 전에 stdlib 시그니처 JSON 을 생성해서 번들에 embed (fn-doc 배포 대응)
// v11.7.12: L3 고정점 달성 후 C 컴파일러 활용 → npm 0개 목표
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

// Phase X-2: npm esbuild 제거 → pre-built bootstrap.js 유지
// (src/ 변경 시에만 tsc + 수동 번들링으로 재생성)
function checkBootstrapBuilt() {
  const REPO = path.resolve(__dirname, "..");
  const bootstrapJsPath = path.join(REPO, "bootstrap.js");

  if (!fs.existsSync(bootstrapJsPath)) {
    console.error("bootstrap.js not found. Run 'git checkout bootstrap.js' or rebuild with typescript compiler.");
    process.exit(1);
  }

  const size = fs.statSync(bootstrapJsPath).size;
  console.log(`bootstrap=pre-built (no rebuild, esbuild removed) size=${Math.round(size / 1024)}KB`);
}

// Node.js 빌드 (pre-built bootstrap.js 사용)
let nodeBuild;
if (isWatch) {
  console.log("bootstrap=watch not supported (esbuild removed). Use tsc --watch instead.");
  nodeBuild = Promise.resolve();
} else {
  nodeBuild = Promise.resolve().then(() => checkBootstrapBuilt());
}

// 브라우저 빌드: Phase X-2에서 esbuild 제거, 추후 구현 예정
// (현재 bootstrap.js는 Node.js 전용, 브라우저는 별도 모듈 필요)
const browserBuild = Promise.resolve().then(() => {
  console.log("browser.js=skipped (requires esbuild, Phase X-3 planned)");
});

Promise.all([nodeBuild, browserBuild]).then(() => console.log("all=done"));
