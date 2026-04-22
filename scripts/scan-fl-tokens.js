#!/usr/bin/env node
// scan-fl-tokens.js — FL Token Remnant Detector
// 생성 JS에서 FL 고유 토큰/표현이 남아있는지 검사
// Usage: node scan-fl-tokens.js <file.js> [<file2.js> ...]

const fs = require("fs");
const path = require("path");

// 탐지 패턴 목록 (순서대로 검사)
const PATTERNS = [
  {
    name: "물음표 함수 (FL builtin)",
    regex: /\b[A-Za-z0-9_\-]+\?\b/g,
    severity: "error",
  },
  {
    name: "null? 함수",
    regex: /\bnull\?\b/g,
    severity: "error",
  },
  {
    name: "is-digit? 패턴",
    regex: /\bis-digit\?\b/g,
    severity: "error",
  },
  {
    name: "let-as-expression 잔재 (return let ...)",
    regex: /return\s+let\s+[A-Za-z_\$][A-Za-z0-9_\$]*\b/g,
    severity: "error",
  },
  {
    name: "control-block 표기",
    regex: /\[FUNC\]|\[SERVER\]|\[PRELUDE\]/g,
    severity: "error",
  },
  {
    name: "FL parser 호출",
    regex: /\bfl_parse\b/g,
    severity: "error",
  },
];

// 문자열과 주석 제거하는 간단한 전처리
function stripStringsAndComments(code) {
  let result = "";
  let i = 0;

  while (i < code.length) {
    // 문자열 (double quote)
    if (code[i] === '"') {
      result += " ";
      i++;
      while (i < code.length && code[i] !== '"') {
        if (code[i] === "\\") i += 2;
        else i++;
      }
      i++; // closing quote
      continue;
    }

    // 문자열 (single quote)
    if (code[i] === "'") {
      result += " ";
      i++;
      while (i < code.length && code[i] !== "'") {
        if (code[i] === "\\") i += 2;
        else i++;
      }
      i++; // closing quote
      continue;
    }

    // 블록 주석
    if (code[i] === "/" && code[i + 1] === "*") {
      result += " ";
      i += 2;
      while (i < code.length - 1) {
        if (code[i] === "*" && code[i + 1] === "/") {
          i += 2;
          break;
        }
        if (code[i] === "\n") result += "\n";
        else result += " ";
        i++;
      }
      continue;
    }

    // 라인 주석
    if (code[i] === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") {
        i++;
      }
      continue;
    }

    result += code[i];
    i++;
  }

  return result;
}

// 파일 검사 및 리포트
function scanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return false;
  }

  const code = fs.readFileSync(filePath, "utf8");
  const stripped = stripStringsAndComments(code);
  const lines = code.split("\n");

  let hasIssues = false;

  for (const pattern of PATTERNS) {
    const matches = [...stripped.matchAll(pattern.regex)];

    for (const match of matches) {
      hasIssues = true;

      // 매칭 위치로부터 라인 번호 찾기
      const beforeMatch = stripped.substring(0, match.index);
      const lineNum = beforeMatch.split("\n").length;
      const line = lines[lineNum - 1] || "";

      const colNum = match.index - beforeMatch.lastIndexOf("\n");

      console.log(
        `❌ [${pattern.severity.toUpperCase()}] ${path.basename(filePath)}:${lineNum}:${colNum}`
      );
      console.log(`   Pattern: ${pattern.name}`);
      console.log(`   Found: "${match[0]}"`);
      console.log(`   Line: ${line.trim().substring(0, 80)}`);
      console.log("");
    }
  }

  return !hasIssues;
}

// 메인 로직
const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: node scan-fl-tokens.js <file.js> [<file2.js> ...]");
  process.exit(1);
}

console.log("════════════════════════════════════════════");
console.log("  FL Token Remnant Scanner");
console.log("════════════════════════════════════════════\n");

let allClean = true;

for (const file of files) {
  if (!scanFile(file)) {
    allClean = false;
  }
}

console.log("════════════════════════════════════════════");
if (allClean) {
  console.log("✅ All files clean — no FL tokens found");
  process.exit(0);
} else {
  console.log("❌ FL token remnants detected in generated JS");
  process.exit(1);
}
