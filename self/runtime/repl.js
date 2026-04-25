// self/runtime/repl.js — Y4-3 단계B
//
// readline + Interpreter wrapper. self/runtime/interpreter.js 에 의존.
// bootstrap.js 의존 없는 REPL 진입점.
//
// 사용:
//   node self/runtime/repl.js
//
// 명령:
//   :q / :quit / :exit  — 종료
//   :clear              — 입력 버퍼 초기화
//   :reset              — 세션 (변수/함수) 초기화
//   :help               — 도움말
//   :ls                 — 정의된 함수 목록
//   :stack              — callStack (최근 20개)
//   :locals             — 현재 변수 dump
//
// src/cli.ts cmdRepl 의 핵심 로직을 단순화. fl_history (~/.fl_history) 보존.

const readline = require("readline");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { Interpreter, lex, parse } = require("./interpreter");

const historyPath = (() => {
  try { return path.join(os.homedir(), ".fl_history"); }
  catch { return null; }
})();

let initialHistory = [];
if (historyPath) {
  try {
    if (fs.existsSync(historyPath)) {
      initialHistory = fs.readFileSync(historyPath, "utf8")
        .split("\n").filter(l => l.trim()).slice(-500).reverse();
    }
  } catch {}
}

console.log(`FreeLang v11 REPL (self/runtime)  (\x1b[2m:q 종료  :help 도움말  :reset 세션 초기화\x1b[0m)`);
console.log(`─────────────────────────────────────────`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "\x1b[36mfl>\x1b[0m ",
  terminal: true,
  history: initialHistory,
  historySize: 500,
});

let buffer = "";
let sessionInterp = new Interpreter();

function countBalance(s) {
  let balance = 0;
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      let bs = 0, j = i - 1;
      while (j >= 0 && s[j] === "\\") { bs++; j--; }
      if (bs % 2 === 0) inStr = !inStr;
    }
    if (!inStr) {
      if (ch === "(" || ch === "[" || ch === "{") balance++;
      if (ch === ")" || ch === "]" || ch === "}") balance--;
    }
  }
  return balance;
}

rl.prompt();

rl.on("line", (line) => {
  const trimmed = line.trim();

  if (trimmed === ":q" || trimmed === ":quit" || trimmed === ":exit") {
    console.log("bye.");
    rl.close();
    return;
  }
  if (trimmed === ":help") {
    console.log([
      "  :q / :quit    종료",
      "  :clear        버퍼 초기화",
      "  :reset        세션 초기화",
      "  :help         이 도움말",
      "  :ls           정의된 함수 목록",
      "  :stack        callStack (최근 20개)",
      "  :locals       현재 변수 dump",
    ].join("\n"));
    rl.prompt();
    return;
  }
  if (trimmed === ":clear") {
    buffer = "";
    console.log("  버퍼 초기화됨.");
    rl.prompt();
    return;
  }
  if (trimmed === ":reset") {
    buffer = "";
    sessionInterp = new Interpreter();
    console.log("  세션 초기화됨.");
    rl.prompt();
    return;
  }
  if (trimmed === ":ls") {
    const fns = [...sessionInterp.context.functions.keys()];
    console.log(fns.length === 0 ? "(함수 없음)" : fns.slice(0, 50).join("  "));
    if (fns.length > 50) console.log(`  ... 외 ${fns.length - 50}개`);
    rl.prompt();
    return;
  }
  if (trimmed === ":stack") {
    const stack = sessionInterp.callStack || [];
    if (stack.length === 0) console.log("  (callStack 비어있음)");
    else {
      const tail = stack.slice(-20);
      for (let i = 0; i < tail.length; i++) {
        const argsStr = tail[i].args ? `(${tail[i].args.join(", ")})` : "";
        console.log(`  #${stack.length - tail.length + i}: ${tail[i].fn}${argsStr} (line ${tail[i].line})`);
      }
    }
    rl.prompt();
    return;
  }
  if (trimmed === ":locals") {
    const snap = sessionInterp.context.variables.snapshot
      ? sessionInterp.context.variables.snapshot()
      : new Map();
    if (snap.size === 0) console.log("  (변수 없음)");
    else {
      let count = 0;
      for (const [k, v] of snap) {
        if (count++ >= 30) { console.log(`  ... ${snap.size - 30}개 더`); break; }
        const valStr = typeof v === "function" ? "<function>"
          : v && v.kind === "function-value" ? "<fn-value>"
          : (() => { try { return JSON.stringify(v)?.slice(0, 60); } catch { return "<unserializable>"; } })();
        console.log(`  ${k} = ${valStr}`);
      }
    }
    rl.prompt();
    return;
  }
  if (trimmed.startsWith(";")) {
    rl.prompt();
    return;
  }

  buffer += (buffer ? "\n" : "") + line;
  if (countBalance(buffer) > 0) {
    process.stdout.write("\x1b[2m  …\x1b[0m ");
    return;
  }

  const source = buffer.trim();
  buffer = "";
  if (!source) { rl.prompt(); return; }

  try {
    const ast = parse(lex(source));
    const ctx = sessionInterp.interpret(ast);
    const val = ctx.lastValue;
    if (val !== null && val !== undefined) {
      if (typeof val === "object") {
        console.log("\x1b[33m=>\x1b[0m", JSON.stringify(val, null, 2));
      } else {
        console.log("\x1b[33m=>\x1b[0m", String(val));
      }
    }
  } catch (err) {
    console.error("\x1b[31merror:\x1b[0m", err && err.message ? err.message : String(err));
  }

  if (historyPath && source) {
    try { fs.appendFileSync(historyPath, source.replace(/\n/g, " ") + "\n"); } catch {}
  }

  rl.prompt();
});

rl.on("close", () => process.exit(0));
