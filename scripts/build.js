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

esbuild
  .build({
    entryPoints: ["src/cli.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "bootstrap.js",
    loader: { ".json": "json" },  // JSON embed
    logLevel: "info",
  })
  .then(() => {
    console.log("bootstrap=built");
  })
  .catch((err) => {
    console.error("bootstrap=failed error=" + err.message);
    process.exit(1);
  });
