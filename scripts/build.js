#!/usr/bin/env node
// FreeLang v11 build script — Node API로 esbuild 호출 (bin wrapper 우회)
const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: ["src/cli.ts"],
    bundle: true,
    platform: "node",
    target: "node18",
    outfile: "bootstrap.js",
    logLevel: "info",
  })
  .then(() => {
    console.log("✅ bootstrap.js 빌드 완료");
  })
  .catch((err) => {
    console.error("❌ 빌드 실패:", err.message);
    process.exit(1);
  });
