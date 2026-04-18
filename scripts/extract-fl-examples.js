#!/usr/bin/env node
// FreeLang v11.1: CLAUDE.md / README.md 의 ```lisp 코드 블록을 추출하여 stdout으로 출력.
// CI 에서 `node bootstrap.js check -` 로 파이프해 파서 검증용.

const fs = require("fs");
const path = require("path");

function extract(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const blocks = [];
  const re = /```(lisp|fl|freelang)\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const code = m[2].trim();
    if (code) blocks.push(`; ─── ${path.basename(filePath)} ─────\n${code}\n`);
  }
  return blocks.join("\n");
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: extract-fl-examples.js <file.md> [<file.md>...]");
  process.exit(1);
}

for (const f of files) {
  if (!fs.existsSync(f)) { console.error(`[skip] ${f} not found`); continue; }
  process.stdout.write(extract(f));
}
