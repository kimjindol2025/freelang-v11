#!/usr/bin/env node
// FreeLang v9 CLI
// 사용법:
//   freelang run <file.fl>          파일 실행
//   freelang run <file.fl> --watch  파일 변경시 자동 재실행
//   freelang repl                   대화형 REPL
//   freelang check <file.fl>        문법 검사만 (실행 안 함)
//   freelang fmt <file.fl>          파일 인플레이스 포맷
//   freelang fmt --check <file.fl>  변경 필요 시 exit 1
//   freelang fmt --stdin            stdin → stdout 포맷

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { lex } from "./lexer";
import { parse, ParserError } from "./parser";
import { interpret, Interpreter } from "./interpreter";
import { Block } from "./ast";
import { JSCodegen } from "./codegen-js"; // Phase 6: FL 컴파일러
import { formatFL } from "./formatter";
import { DebugSession, setGlobalDebugSession } from "./debugger"; // Phase 78: 디버거
import { runWithWatch } from "./hot-reload"; // Phase 79: 워치 모드
import { extractDocs } from "./doc-extractor"; // Phase 77: 문서 추출기
import { renderMarkdown } from "./doc-renderer"; // Phase 77: 문서 렌더러
import { createDefaultPipeline, createFmtCheckStep, createLintStep, createTestStep } from "./ci-runner"; // Phase 80: CI
import { WebServer } from "./web"; // Phase 3: Web Server

// ─────────────────────────────────────────
// 에러 포맷터: 소스 줄 강조
// ─────────────────────────────────────────

function formatError(err: any, source?: string, filePath?: string): string {
  const fileName = filePath ? path.basename(filePath) : "<stdin>";
  const lines: string[] = [];

  if (err instanceof ParserError) {
    lines.push(`\n\x1b[31m파싱 오류\x1b[0m  ${fileName}:${err.line}:${err.col}`);
    if (source) {
      const srcLines = source.split("\n");
      const lineIdx = err.line - 1;
      if (lineIdx >= 0 && lineIdx < srcLines.length) {
        const lineNum = String(err.line).padStart(4, " ");
        lines.push(`  ${lineNum} │ ${srcLines[lineIdx]}`);
        lines.push(`       ${"─".repeat(err.col - 1)}^`);
      }
    }
    lines.push(`  ${err.message}`);
  } else if (err instanceof Error) {
    lines.push(`\n\x1b[31m실행 오류\x1b[0m  ${fileName}`);
    lines.push(`  ${err.message}`);
  } else {
    lines.push(`\n\x1b[31m오류\x1b[0m  ${String(err)}`);
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────
// 실행 엔진
// ─────────────────────────────────────────

function runSource(source: string, filePath?: string): { ok: boolean; value: any } {
  try {
    const tokens = lex(source);
    const ast = parse(tokens);
    // Phase 52: currentFilePath 전달 — import 상대경로 해석을 파일 기준으로
    if (filePath) {
      const interp = new Interpreter();
      interp.currentFilePath = path.resolve(filePath);
      const ctx = interp.interpret(ast);
      return { ok: true, value: ctx.lastValue };
    }
    const ctx = interpret(ast);
    return { ok: true, value: ctx.lastValue };
  } catch (err: any) {
    console.error(formatError(err, source, filePath));
    return { ok: false, value: null };
  }
}

function checkSource(source: string, filePath?: string): boolean {
  try {
    const tokens = lex(source);
    parse(tokens);
    const fileName = filePath ? path.basename(filePath) : "<stdin>";
    console.log(`\x1b[32m✓\x1b[0m  ${fileName}  문법 이상 없음`);
    return true;
  } catch (err: any) {
    console.error(formatError(err, source, filePath));
    return false;
  }
}

// ─────────────────────────────────────────
// run 커맨드
// ─────────────────────────────────────────

function cmdRun(filePath: string, watch: boolean, extraArgs: string[] = []): void {
  const absPath = path.resolve(filePath);
  const vmBench = extraArgs.includes("--vm-bench");

  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  function execute(): void {
    const source = fs.readFileSync(absPath, "utf-8");
    // 추가 인수를 $__argv__로 인터프리터에 전달 (셀프 호스팅 지원)
    let ctx: any;
    try {
      const tokens = lex(source);
      const ast = parse(tokens);
      const interp = new Interpreter();
      interp.currentFilePath = absPath;
      // ⚠️ 조건부 정의: extraArgs가 없으면 $__argv__ 변수 자체가 없음 (null이 아님!)
      // freelang-interpreter.fl에서 (null? $__argv__)로 체크해야 하는 이유
      if (extraArgs.length > 0) {
        interp.context.variables.set("$__argv__", extraArgs);
      }
      ctx = interp.interpret(ast);
    } catch (err: any) {
      console.error(formatError(err, source, absPath));
      if (!watch) process.exit(1);
      return;
    }
    const value = ctx?.lastValue;
    if (value !== null && value !== undefined) {
      if (typeof value === "object") {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(String(value));
      }
    }
  }

  if (watch) {
    // Enable dev mode BEFORE first execute: server_html will inject the
    // hot-reload client script, and /__hot SSE endpoint will be served.
    process.env.FL_DEV = "1";
  }

  // Phase 3-E: VM opt-in 성능 벤치마크
  if (vmBench) {
    console.log("\n\x1b[36m[vm-bench] 성능 측정 시작...\x1b[0m");
    const ITERATIONS = 100;
    const source = fs.readFileSync(absPath, "utf-8");

    // 기존 경로 (VM 미사용)
    const t0 = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      delete process.env.FL_VM;
      try {
        const tokens = lex(source);
        const ast = parse(tokens);
        const interp = new Interpreter();
        interp.currentFilePath = absPath;
        if (extraArgs.length > 0) {
          interp.context.variables.set("$__argv__", extraArgs.filter(a => a !== "--vm-bench"));
        }
        interp.interpret(ast);
      } catch (_e) { /* ignore */ }
    }
    const interpMs = performance.now() - t0;

    // VM 경로
    const t1 = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      process.env.FL_VM = "1";
      try {
        const tokens = lex(source);
        const ast = parse(tokens);
        const interp = new Interpreter();
        interp.currentFilePath = absPath;
        if (extraArgs.length > 0) {
          interp.context.variables.set("$__argv__", extraArgs.filter(a => a !== "--vm-bench"));
        }
        interp.interpret(ast);
      } catch (_e) { /* ignore */ }
    }
    const vmMs = performance.now() - t1;

    // 결과 출력
    delete process.env.FL_VM;
    const speedup = interpMs / vmMs;
    console.log(`\x1b[36m[vm-bench]\x1b[0m interpreter: ${interpMs.toFixed(1)}ms (${ITERATIONS} iter)`);
    console.log(`\x1b[36m[vm-bench]\x1b[0m          vm: ${vmMs.toFixed(1)}ms (${ITERATIONS} iter)`);
    console.log(`\x1b[36m[vm-bench]\x1b[0m    speedup: ${speedup.toFixed(2)}x`);

    if (speedup < 1.0) {
      console.log(`\x1b[33m⚠️  VM이 느림 (산술 집약 코드가 아닐 수 있음)\x1b[0m`);
    } else if (speedup >= 1.5) {
      console.log(`\x1b[32m✓ 목표 달성 (1.5배 이상)\x1b[0m`);
    } else {
      console.log(`\x1b[2m○ 1.0x ~ 1.5x 범위\x1b[0m`);
    }
    console.log("");

    if (!watch) return; // watch가 아니면 여기서 종료
  }

  execute();

  if (watch) {
    console.log(`\x1b[2m  watching ${path.basename(absPath)}... (dev mode: browser auto-reload enabled)\x1b[0m`);
    // Use setInterval polling for reliability across filesystems
    // (fs.watch silently breaks on Termux/Android, or after the editor
    //  rewrites the inode — polling survives re-executes and inode changes)
    let lastMtime = 0;
    let lastSize = -1;
    try {
      const st = fs.statSync(absPath);
      lastMtime = st.mtimeMs;
      lastSize = st.size;
    } catch (_e) { /* ignore */ }
    let debounce: NodeJS.Timeout | null = null;
    setInterval(() => {
      try {
        const st = fs.statSync(absPath);
        if (st.mtimeMs !== lastMtime || st.size !== lastSize) {
          lastMtime = st.mtimeMs;
          lastSize = st.size;
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => {
            console.log(`\n\x1b[2m─── 변경 감지, 재실행 ───\x1b[0m`);
            execute();
          }, 100);
        }
      } catch (_e) { /* transient errors ignored */ }
    }, 500);
  }
}

// ─────────────────────────────────────────
// check 커맨드
// ─────────────────────────────────────────

function cmdCheck(filePath: string): void {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }
  const source = fs.readFileSync(absPath, "utf-8");
  const ok = checkSource(source, absPath);
  if (!ok) process.exit(1);
}

// ─────────────────────────────────────────
// compile 커맨드 (Phase 6)
// ─────────────────────────────────────────

function cmdCodegen(args: string[]): void {
  // freelang codegen <file.fl> [--target typescript|sql|all]
  const inputFile = args.find(a => !a.startsWith("-") && a.endsWith(".fl"));
  const target = args.includes("--target") ? args[args.indexOf("--target") + 1] : "all";

  if (!inputFile) {
    console.error(`\x1b[31m오류\x1b[0m  입력 파일을 지정하세요: codegen <file.fl>`);
    process.exit(1);
  }

  const absInput = path.resolve(inputFile);
  if (!fs.existsSync(absInput)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${inputFile}`);
    process.exit(1);
  }

  try {
    const source = fs.readFileSync(absInput, "utf-8");
    const tokens = lex(source);
    const ast = parse(tokens);

    const cg = new JSCodegen();

    // 모든 블록에 대해 코드 생성
    for (const node of ast) {
      if (node.kind === "block") {
        const blockType = (node as Block).type;
        if (["SERVICE", "MODEL", "CONTROLLER"].includes(blockType)) {
          if (target === "all" || (target === "typescript" && blockType !== "MODEL") || (target === "sql" && blockType === "MODEL")) {
            const code = cg.generate([node]);
            console.log(code);
            console.log("\n" + "─".repeat(80) + "\n");
          }
        }
      }
    }
  } catch (err) {
    console.error(`\x1b[31m오류\x1b[0m  ${formatError(err as Error, fs.readFileSync(absInput, "utf-8"), absInput)}`);
    process.exit(1);
  }
}

function cmdCompile(args: string[]): void {
  // 옵션 파싱: compile input.fl -o output.js [--esm] [--runtime]
  const outputIdx = args.indexOf("-o");
  const inputFile = args.find(a => !a.startsWith("-") && a !== args[outputIdx + 1]);
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;
  const useEsm = args.includes("--esm");
  const withRuntime = args.includes("--runtime");

  // 입력 파일 검증
  if (!inputFile) {
    console.error(`\x1b[31m오류\x1b[0m  입력 파일을 지정하세요: compile <file.fl> [-o <out.js>]`);
    process.exit(1);
  }

  const absInput = path.resolve(inputFile);
  if (!fs.existsSync(absInput)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${inputFile}`);
    process.exit(1);
  }

  try {
    // 파이프라인: lex → parse → JSCodegen.generate()
    const source = fs.readFileSync(absInput, "utf-8");
    const tokens = lex(source);
    const ast = parse(tokens);

    const cg = new JSCodegen();
    const js = cg.generate(ast, {
      module: useEsm ? "esm" : "commonjs",
      runtime: withRuntime,
      minify: false,
      target: "node",
    });

    // 출력
    if (outputFile) {
      const absOutput = path.resolve(outputFile);
      const dir = path.dirname(absOutput);
      if (dir !== "." && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(absOutput, js, "utf-8");
      console.log(`\x1b[32m✓\x1b[0m  컴파일 완료  ${path.basename(inputFile)} → ${outputFile}`);
    } else {
      // stdout 출력
      process.stdout.write(js);
    }
  } catch (err: any) {
    console.error(formatError(err, fs.readFileSync(absInput, "utf-8"), absInput));
    process.exit(1);
  }
}

// ─────────────────────────────────────────
// repl 커맨드
// ─────────────────────────────────────────

function cmdRepl(): void {
  console.log(`FreeLang v11 REPL  (\x1b[2m:q 종료  :help 도움말  :reset 세션 초기화\x1b[0m)`);
  console.log(`─────────────────────────────────────────`);

  // v11.3: ~/.fl_history 기반 영구 history
  const historyPath = (() => {
    try {
      const os = require("os") as typeof import("os");
      const path = require("path") as typeof import("path");
      return path.join(os.homedir(), ".fl_history");
    } catch { return null; }
  })();

  let initialHistory: string[] = [];
  if (historyPath) {
    try {
      const fs = require("fs") as typeof import("fs");
      if (fs.existsSync(historyPath)) {
        initialHistory = fs.readFileSync(historyPath, "utf8")
          .split("\n").filter(l => l.trim()).slice(-500).reverse();
      }
    } catch {}
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\x1b[36mfl>\x1b[0m ",
    terminal: true,
    history: initialHistory,
    historySize: 500,
  } as any);

  // 멀티라인: 여는 괄호/대괄호가 남아있으면 계속 입력 받음
  let buffer = "";
  // v11.3: 영속 Interpreter — define/defn 바인딩이 세션 내내 유지됨
  let sessionInterp = new Interpreter();

  function countBalance(s: string): number {
    let balance = 0;
    let inStr = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') {
        let backslashCount = 0;
        let j = i - 1;
        while (j >= 0 && s[j] === "\\") { backslashCount++; j--; }
        if (backslashCount % 2 === 0) inStr = !inStr;
      }
      if (!inStr) {
        if (ch === "(" || ch === "[" || ch === "{") balance++;
        if (ch === ")" || ch === "]" || ch === "}") balance--;
      }
    }
    return balance;
  }

  rl.prompt();

  rl.on("line", (line: string) => {
    // 커맨드 처리
    const trimmed = line.trim();
    if (trimmed === ":q" || trimmed === ":quit" || trimmed === ":exit") {
      console.log("bye.");
      rl.close();
      process.exit(0);
    }
    if (trimmed === ":help") {
      console.log([
        "  :q / :quit    종료",
        "  :clear        버퍼 초기화",
        "  :help         이 도움말",
        "  :ls           정의된 함수 목록",
        "  :stack        callStack 출력 (최근 20개)",
        "  :locals       현재 변수 dump",
        "  :debug        debugger ON/OFF toggle",
        "  :step         step 모드 toggle",
        "",
        "  예제:",
        "    (+ 1 2)",
        '    (println "Hello, World!")',
        '    (let [[$x 42]] (println "x = {$x}"))',
        "    [FUNC add :params [$a $b] :body (+ $a $b)]",
        "    (add 3 5)",
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
      console.log("  세션 초기화됨 (모든 변수/함수 제거).");
      rl.prompt();
      return;
    }

    // S1 (2026-04-25): 디버거 + introspection 명령
    if (trimmed === ":ls") {
      const fns = [...sessionInterp.context.functions.keys()];
      console.log(fns.length === 0 ? "(함수 없음)" : fns.slice(0, 50).join("  "));
      if (fns.length > 50) console.log(`  ... 외 ${fns.length - 50}개`);
      rl.prompt();
      return;
    }
    if (trimmed === ":stack") {
      const stack: Array<{fn: string; line: number}> = (sessionInterp as any).callStack ?? [];
      if (stack.length === 0) console.log("  (callStack 비어있음 — 호출 중일 때만 표시)");
      else {
        const tail = stack.slice(-20);
        for (let i = 0; i < tail.length; i++) {
          console.log(`  #${stack.length - tail.length + i}: ${tail[i].fn} (line ${tail[i].line})`);
        }
      }
      rl.prompt();
      return;
    }
    if (trimmed === ":locals") {
      const vars: Map<string, any> = (sessionInterp.context.variables as any).snapshot?.() ?? new Map();
      if (vars.size === 0) console.log("  (변수 없음)");
      else {
        let count = 0;
        for (const [k, v] of vars) {
          if (count++ >= 30) { console.log(`  ... ${vars.size - 30}개 더`); break; }
          const valStr = typeof v === "function" ? "<function>"
            : v?.kind === "function-value" ? "<fn-value>"
            : (() => { try { return JSON.stringify(v)?.slice(0, 60); } catch { return "<unserializable>"; } })();
          console.log(`  ${k} = ${valStr}`);
        }
      }
      rl.prompt();
      return;
    }
    if (trimmed === ":debug") {
      try {
        const { getGlobalDebugSession } = require("./debugger");
        const sess = getGlobalDebugSession();
        sess.enabled = !sess.enabled;
        console.log(`  debugger: ${sess.enabled ? "ON" : "OFF"}`);
      } catch (e: any) {
        console.log(`  debug 모듈 로드 실패: ${e.message}`);
      }
      rl.prompt();
      return;
    }
    if (trimmed === ":step") {
      try {
        const { getGlobalDebugSession } = require("./debugger");
        const sess = getGlobalDebugSession();
        sess.enabled = true;
        sess.stepMode = !sess.stepMode;
        console.log(`  step 모드: ${sess.stepMode ? "ON (모든 줄에서 break)" : "OFF"}`);
      } catch (e: any) {
        console.log(`  debug 모듈 로드 실패: ${e.message}`);
      }
      rl.prompt();
      return;
    }

    // 세미콜론 주석 줄 스킵
    if (trimmed.startsWith(";")) {
      rl.prompt();
      return;
    }

    buffer += (buffer ? "\n" : "") + line;

    const balance = countBalance(buffer);
    if (balance > 0) {
      // 아직 닫히지 않은 괄호 있음 — 계속 입력
      process.stdout.write("\x1b[2m  …\x1b[0m ");
      return;
    }

    const source = buffer.trim();
    buffer = "";

    if (!source) {
      rl.prompt();
      return;
    }

    try {
      const tokens = lex(source);
      const ast = parse(tokens);
      // v11.3: persistent interpreter 재사용
      const ctx = sessionInterp.interpret(ast);
      const val = ctx.lastValue;
      if (val !== null && val !== undefined) {
        if (typeof val === "object") {
          console.log("\x1b[33m=>\x1b[0m", JSON.stringify(val, null, 2));
        } else {
          console.log("\x1b[33m=>\x1b[0m", String(val));
        }
      }
    } catch (err: any) {
      console.error(formatError(err, source));
    }

    // v11.3: history 저장
    if (historyPath && source) {
      try {
        const fs = require("fs") as typeof import("fs");
        fs.appendFileSync(historyPath, source.replace(/\n/g, " ") + "\n");
      } catch {}
    }

    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

// ─────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// fmt 커맨드 (Phase 73)
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// v11.4: help 커맨드 — stdlib 함수 시그니처 빠른 조회
// ─────────────────────────────────────────

// v11.10: 빌드 시점에 embed 된 stdlib 시그니처 (배포 후에도 fn-doc 동작)
// scripts/build.js 가 src/_stdlib-signatures.json 을 생성 → esbuild 가 bundle.
// dev 환경(ts-jest 등)에서 이 파일이 없을 수 있으므로 try/catch fallback.
// eslint-disable-next-line @typescript-eslint/no-var-requires
function loadEmbeddedSignatures(): { module: string; name: string; params: string; returns: string }[] {
  try {
    return require("./_stdlib-signatures.json");
  } catch {
    return [];
  }
}

function cmdStdlibDoc(query: string): void {
  interface Entry { module: string; name: string; params: string; ret: string; }
  const signatures = loadEmbeddedSignatures();
  const entries: Entry[] = signatures.map((s) => ({
    module: s.module, name: s.name, params: s.params, ret: s.returns,
  }));

  if (entries.length === 0) {
    console.error(JSON.stringify({ error: "stdlib_signatures_missing", hint: "run `npm run build` to regenerate" }));
    process.exit(2);
  }

  const q = query.toLowerCase();
  const exact = entries.filter((e) => e.name === query);
  const partial = entries.filter((e) => e.name.toLowerCase().includes(q) && e.name !== query);

  // AI-first: JSON output for programmatic parsing
  if (exact.length === 0 && partial.length === 0) {
    const near = entries
      .map((e) => ({ e, d: levenshtein(e.name.toLowerCase(), q) }))
      .filter((x) => x.d <= 3)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    console.log(JSON.stringify({
      query,
      found: false,
      suggestions: near.map(({ e }) => ({ name: e.name, module: e.module })),
    }));
    process.exit(1);
  }

  const trim20 = partial.slice(0, 20);
  console.log(JSON.stringify({
    query,
    found: true,
    exact: exact.map((e) => ({ name: e.name, module: e.module, params: e.params, returns: e.ret })),
    partial: trim20.map((e) => ({ name: e.name, module: e.module, params: e.params, returns: e.ret })),
    partial_truncated: partial.length > 20 ? partial.length - 20 : 0,
  }));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : Math.min(prev[j - 1], prev[j], next[j - 1]) + 1;
    }
    for (let j = 0; j <= b.length; j++) prev[j] = next[j];
  }
  return prev[b.length];
}

function cmdFmt(args: string[]): void {
  // --stdin 모드
  if (args.includes("--stdin")) {
    let src = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk: string) => { src += chunk; });
    process.stdin.on("end", () => {
      try {
        const formatted = formatFL(src);
        process.stdout.write(formatted);
      } catch (err: any) {
        console.error(`\x1b[31m포맷 오류\x1b[0m  ${err.message}`);
        process.exit(1);
      }
    });
    return;
  }

  // --check 모드
  const checkMode = args.includes("--check");
  const filePaths = args.filter((a) => !a.startsWith("--"));

  if (filePaths.length === 0) {
    console.error(`\x1b[31m오류\x1b[0m  파일 경로를 지정하세요`);
    process.exit(1);
  }

  let needsChange = false;

  for (const filePath of filePaths) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
      process.exit(1);
    }

    const src = fs.readFileSync(absPath, "utf-8");
    let formatted: string;
    try {
      formatted = formatFL(src);
    } catch (err: any) {
      console.error(`\x1b[31m포맷 오류\x1b[0m  ${path.basename(absPath)}: ${err.message}`);
      process.exit(1);
    }

    if (checkMode) {
      if (src !== formatted) {
        console.log(`\x1b[33m변경 필요\x1b[0m  ${path.basename(absPath)}`);
        needsChange = true;
      } else {
        console.log(`\x1b[32m이미 포맷됨\x1b[0m  ${path.basename(absPath)}`);
      }
    } else {
      if (src !== formatted) {
        fs.writeFileSync(absPath, formatted, "utf-8");
        console.log(`\x1b[32m포맷 완료\x1b[0m  ${path.basename(absPath)}`);
      } else {
        console.log(`\x1b[2m변경 없음\x1b[0m  ${path.basename(absPath)}`);
      }
    }
  }

  if (checkMode && needsChange) {
    process.exit(1);
  }
}

// ─────────────────────────────────────────
// debug 커맨드 (Phase 78)
// ─────────────────────────────────────────

function cmdDebug(filePath: string, stepMode: boolean): void {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  // 디버그 세션 설정
  const session = new DebugSession();
  session.enabled = true;
  session.stepMode = stepMode;
  setGlobalDebugSession(session);

  console.log(`\x1b[35m[FreeLang Debugger]\x1b[0m  ${path.basename(absPath)}${stepMode ? "  (step mode)" : ""}`);
  console.log(`\x1b[2m  (break!) 위치에서 중단점 발생\x1b[0m`);
  console.log(`─────────────────────────────────────────`);

  try {
    const source = fs.readFileSync(absPath, "utf-8");
    const tokens = lex(source);
    const ast = parse(tokens);
    const interp = new Interpreter();
    interp.currentFilePath = absPath;
    interp.debugSession = session;
    const ctx = interp.interpret(ast);

    if (ctx.lastValue !== null && ctx.lastValue !== undefined) {
      if (typeof ctx.lastValue === "object") {
        console.log(JSON.stringify(ctx.lastValue, null, 2));
      } else {
        console.log(String(ctx.lastValue));
      }
    }

    console.log(`\n\x1b[35m[디버그 완료]\x1b[0m  중단점 ${session.breakLog.length}회 도달`);
  } catch (err: any) {
    console.error(formatError(err, undefined, absPath));
    process.exit(1);
  }
}

// ─────────────────────────────────────────
// ci 커맨드 (Phase 80)
// ─────────────────────────────────────────

async function cmdCi(ciArgs: string[]): Promise<void> {
  const noFailFast = ciArgs.includes("--no-fail-fast");
  const filePaths = ciArgs.filter((a) => !a.startsWith("--"));

  let targetFiles: string[];

  if (filePaths.length > 0) {
    // 특정 파일 지정
    targetFiles = filePaths.map((f) => path.resolve(f)).filter((f) => fs.existsSync(f));
    if (targetFiles.length === 0) {
      console.error(`\x1b[31m오류\x1b[0m  지정한 파일을 찾을 수 없습니다`);
      process.exit(1);
    }
  } else {
    // 현재 디렉토리의 .fl 파일 전체
    const cwd = process.cwd();
    targetFiles = fs.readdirSync(cwd)
      .filter((f) => f.endsWith(".fl"))
      .map((f) => path.join(cwd, f));
  }

  console.log(`\x1b[36m[FreeLang CI]\x1b[0m  파일 ${targetFiles.length}개  fail-fast=${!noFailFast}`);
  console.log(`─────────────────────────────────────────`);

  const pipeline = createDefaultPipeline(targetFiles, { failFast: !noFailFast });
  const summary = await pipeline.run();

  console.log(`─────────────────────────────────────────`);
  const stepCount = summary.steps.length;
  const passCount = summary.steps.filter((s) => s.passed && !s.skipped).length;
  const skipCount = summary.steps.filter((s) => s.skipped).length;

  if (summary.passed) {
    console.log(`\x1b[32m[CI PASS]\x1b[0m  ${passCount}/${stepCount} steps  (${summary.totalMs}ms)`);
  } else {
    console.log(`\x1b[31m[CI FAIL]\x1b[0m  ${passCount}/${stepCount} steps  (${summary.totalMs}ms, ${skipCount} skipped)`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────
// doc 커맨드 (Phase 77)
// ─────────────────────────────────────────

function cmdDoc(docArgs: string[]): void {
  // --dir 모드: 디렉토리 내 모든 .fl 파일 통합 문서화
  const dirIdx = docArgs.indexOf("--dir");
  if (dirIdx !== -1) {
    const dirPath = docArgs[dirIdx + 1];
    if (!dirPath) {
      console.error(`\x1b[31m오류\x1b[0m  --dir 뒤에 디렉토리 경로를 지정하세요`);
      process.exit(1);
    }
    const absDir = path.resolve(dirPath);
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      console.error(`\x1b[31m오류\x1b[0m  디렉토리를 찾을 수 없습니다: ${dirPath}`);
      process.exit(1);
    }

    const flFiles = fs.readdirSync(absDir)
      .filter((f) => f.endsWith(".fl"))
      .map((f) => path.join(absDir, f));

    if (flFiles.length === 0) {
      console.error(`\x1b[33m경고\x1b[0m  .fl 파일이 없습니다: ${dirPath}`);
      return;
    }

    const allEntries: import("./doc-extractor").DocEntry[] = [];
    for (const filePath of flFiles) {
      const src = fs.readFileSync(filePath, "utf-8");
      allEntries.push(...extractDocs(src));
    }

    const title = path.basename(absDir) + " API 문서";
    const md = renderMarkdown(allEntries, title);
    const outIdx = docArgs.indexOf("-o");
    if (outIdx !== -1 && docArgs[outIdx + 1]) {
      const outPath = path.resolve(docArgs[outIdx + 1]);
      fs.writeFileSync(outPath, md, "utf-8");
      console.log(`\x1b[32m문서 저장됨\x1b[0m  ${outPath}  (${allEntries.length}개 항목)`);
    } else {
      process.stdout.write(md);
    }
    return;
  }

  // 단일 파일 모드
  const filePaths = docArgs.filter((a) => !a.startsWith("-"));
  if (filePaths.length === 0) {
    console.error(`\x1b[31m오류\x1b[0m  파일 경로를 지정하세요`);
    process.exit(1);
  }
  const filePath = filePaths[0];
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const src = fs.readFileSync(absPath, "utf-8");
  const entries = extractDocs(src);
  const title = path.basename(absPath, ".fl") + " API 문서";
  const md = renderMarkdown(entries, title);

  const outIdx = docArgs.indexOf("-o");
  if (outIdx !== -1 && docArgs[outIdx + 1]) {
    const outPath = path.resolve(docArgs[outIdx + 1]);
    fs.writeFileSync(outPath, md, "utf-8");
    console.log(`\x1b[32m문서 저장됨\x1b[0m  ${outPath}  (${entries.length}개 항목)`);
  } else {
    process.stdout.write(md);
  }
}

// ─────────────────────────────────────────
// build 커맨드 (Phase 8)
// ─────────────────────────────────────────

function cmdBuild(buildArgs: string[]): void {
  const isOci = buildArgs.includes("--oci");
  const isStatic = buildArgs.includes("--static");

  if (isStatic) {
    // Static HTML export — starts serve, GETs each route, saves HTML, stops serve.
    // Supports both (println ...) style pages and full [PAGE]/(page ...) blocks via app-router.
    // Usage: fl build --static [--app app/] [--out dist/] [--port 43099]
    const appIdx = buildArgs.indexOf("--app");
    const outIdx = buildArgs.indexOf("--out");
    const portIdx = buildArgs.indexOf("--port");
    const appDir = appIdx !== -1 ? buildArgs[appIdx + 1] : "app";
    const outDir = outIdx !== -1 ? buildArgs[outIdx + 1] : "dist";
    const port = portIdx !== -1 ? parseInt(buildArgs[portIdx + 1], 10) : 43099;

    const absApp = path.resolve(appDir);
    const absOut = path.resolve(outDir);
    if (!fs.existsSync(absApp)) {
      console.error(`build.error event=app_not_found path=${appDir}`);
      process.exit(1);
    }

    console.log(`build.start app=${appDir} out=${outDir} port=${port}`);
    fs.mkdirSync(absOut, { recursive: true });

    // Walk app/ and collect page.fl routes.
    // Dynamic routes ([slug]): look for generate-static-params.fl in the same
    // dir. If present, run it and expand each param set into a concrete route.
    // The params file should `(println <json>)` a JSON array of objects:
    //   [{"slug":"post-1"},{"slug":"post-2"}]
    const pages: { filePath: string; route: string }[] = [];

    function expandDynamicParams(dir: string, paramName: string): any[] {
      const paramsFile = path.join(dir, "generate-static-params.fl");
      if (!fs.existsSync(paramsFile)) return [];
      try {
        const cwdBootstrap2 = path.resolve(process.cwd(), "bootstrap.js");
        const bs = fs.existsSync(cwdBootstrap2) ? cwdBootstrap2 : path.resolve(__dirname, "bootstrap.js");
        const { execSync } = require("child_process");
        const out = execSync(`node "${bs}" run "${paramsFile}"`, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
        // Find a JSON array in stdout
        const m = out.match(/\[[\s\S]*\]/);
        if (!m) return [];
        const parsed = JSON.parse(m[0]);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err: any) {
        console.log(`build.params_error dir=${dir} err=${(err.message || String(err)).split("\n")[0]}`);
        return [];
      }
    }

    function walk(dir: string, routeBase: string): void {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name.startsWith("[") && e.name.endsWith("]")) {
            const paramName = e.name.slice(1, -1);
            const params = expandDynamicParams(full, paramName);
            const pageFile = path.join(full, "page.fl");
            if (params.length === 0) {
              console.log(`build.skip reason=dynamic_no_params path=/${path.relative(absApp, full)} param=${paramName}`);
              continue;
            }
            if (!fs.existsSync(pageFile)) {
              console.log(`build.skip reason=dynamic_no_page path=/${path.relative(absApp, full)}`);
              continue;
            }
            for (const p of params) {
              const value = p && typeof p === "object" ? p[paramName] : null;
              if (!value) continue;
              pages.push({ filePath: pageFile, route: routeBase + "/" + String(value) });
            }
            // Also walk into for any non-page files (unlikely but possible)
            continue;
          }
          if (e.name === "api") continue;
          walk(full, routeBase + "/" + e.name);
        } else if (e.name === "page.fl") {
          pages.push({ filePath: full, route: routeBase || "/" });
        }
      }
    }
    walk(absApp, "");

    // Special file: app/not-found.fl → dist/404.html (most CDNs serve this
    // for unmatched routes automatically). Generated via the same strategies.
    const notFoundFile = path.join(absApp, "not-found.fl");
    if (fs.existsSync(notFoundFile)) {
      pages.push({ filePath: notFoundFile, route: "/__404__" });
    }

    if (pages.length === 0) {
      console.log(`build.error event=no_pages app=${appDir}`);
      return;
    }

    // Start `serve` in the background, then HTTP GET each route.
    const { spawn } = require("child_process");
    const http = require("http");
    const cwdBootstrap = path.resolve(process.cwd(), "bootstrap.js");
    const bootstrap = fs.existsSync(cwdBootstrap)
      ? cwdBootstrap
      : path.resolve(__dirname, "bootstrap.js");

    const serveProc = spawn(
      "node",
      [bootstrap, "serve", "--app", absApp, "--port", String(port)],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    // Wait for server to be ready (poll /__probe or any known route with timeout)
    const waitForServer = async (): Promise<boolean> => {
      for (let i = 0; i < 30; i++) {
        const ready = await new Promise<boolean>((resolve) => {
          const req = http.get(
            { host: "localhost", port, path: "/", timeout: 500 },
            (res: any) => { res.destroy(); resolve(true); },
          );
          req.on("error", () => resolve(false));
          req.on("timeout", () => { req.destroy(); resolve(false); });
        });
        if (ready) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    };

    const fetchRoute = (route: string): Promise<string> =>
      new Promise((resolve, reject) => {
        const req = http.get(
          { host: "localhost", port, path: route, timeout: 5000 },
          (res: any) => {
            let buf = "";
            res.on("data", (c: any) => { buf += c.toString(); });
            res.on("end", () => {
              if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode}`));
              } else {
                resolve(buf);
              }
            });
          },
        );
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      });

    const runPage = (p: { filePath: string; route: string }): string | null => {
      try {
        const { execSync } = require("child_process");
        const out = execSync(`node "${bootstrap}" run "${p.filePath}"`, {
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        const m = out.match(/<!DOCTYPE html[\s\S]*?<\/html>/i) || out.match(/<html[\s\S]*?<\/html>/i);
        return m ? m[0] : null;
      } catch { return null; }
    };

    const isUseful = (html: string | null | undefined): boolean => {
      if (!html) return false;
      const t = html.trim();
      if (t.length < 50) return false;
      if (t.startsWith("Internal Server Error")) return false;
      return true;
    };

    // Concurrency: --concurrency=N (default 8)
    const concIdx = buildArgs.indexOf("--concurrency");
    const concurrency = Math.max(1, concIdx !== -1 ? parseInt(buildArgs[concIdx + 1] || "8", 10) : 8);

    (async () => {
      const ready = await waitForServer();
      const t0 = Date.now();
      let ok = 0;
      let fail = 0;

      const renderOne = async (p: { filePath: string; route: string }): Promise<void> => {
        let html: string | null = null;
        if (ready) {
          try {
            const res = await fetchRoute(p.route);
            if (isUseful(res)) html = res;
          } catch { /* fall through */ }
        }
        if (!html) {
          const out = runPage(p);
          if (isUseful(out)) html = out;
        }
        if (html) {
          const outPath = p.route === "/__404__"
            ? path.join(absOut, "404.html")
            : path.join(absOut, p.route === "/" ? "index.html" : p.route.slice(1) + "/index.html");
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, html);
          console.log(`build.page route=${p.route === "/__404__" ? "/404" : p.route} ok=true file=${path.relative(process.cwd(), outPath)} bytes=${html.length}`);
          ok++;
        } else {
          console.log(`build.page route=${p.route} ok=false`);
          fail++;
        }
      };

      // Render pages in parallel batches of size `concurrency`.
      for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency);
        await Promise.all(batch.map(renderOne));
      }

      serveProc.kill();
      const ms = Date.now() - t0;
      console.log(`build.done ok=${ok} fail=${fail} out=${outDir} ms=${ms} concurrency=${concurrency}`);
      if (fail > 0) process.exit(1);
      process.exit(0);
    })();
    return;
  }

  if (isOci) {
    // OCI 빌드 모드
    const fileIdx = buildArgs.indexOf("--oci") + 1;
    const appFile = buildArgs[fileIdx];
    const tagIdx = buildArgs.indexOf("--tag");
    const tag = tagIdx !== -1 ? buildArgs[tagIdx + 1] : "my-app:latest";
    const registryIdx = buildArgs.indexOf("--registry");
    const registry = registryIdx !== -1 ? buildArgs[registryIdx + 1] : undefined;

    if (!appFile) {
      console.error(`\x1b[31m오류\x1b[0m  app 파일을 지정하세요: fl build --oci <app.fl> --tag <tag>`);
      process.exit(1);
    }

    const absPath = path.resolve(appFile);
    if (!fs.existsSync(absPath)) {
      console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${appFile}`);
      process.exit(1);
    }

    console.log(`\x1b[36m[OCI Build]\x1b[0m  ${path.basename(appFile)} → ${tag}`);

    // v9-oci.fl 실행
    const ociScriptPath = path.resolve(__dirname, "../vpm/v9-oci.fl");
    if (!fs.existsSync(ociScriptPath)) {
      console.error(`\x1b[31m오류\x1b[0m  v9-oci.fl을 찾을 수 없습니다`);
      process.exit(1);
    }

    const { execSync } = require("child_process");
    try {
      const cmd = registry
        ? `node ${path.resolve(__dirname, "../src/cli.js")} run ${ociScriptPath} build ${appFile} ${tag} ${registry}`
        : `node ${path.resolve(__dirname, "../src/cli.js")} run ${ociScriptPath} build ${appFile} ${tag}`;

      console.log(`\x1b[2m  Command: ${cmd}\x1b[0m`);
      execSync(cmd, { stdio: "inherit" });
      console.log(`\x1b[32m[OK]\x1b[0m  OCI 빌드 완료: ${tag}`);
    } catch (err: any) {
      console.error(`\x1b[31m[Error]\x1b[0m  OCI 빌드 실패: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(`\x1b[31m오류\x1b[0m  --oci 플래그를 지정하세요`);
    console.log(`\n사용법:\n  fl build --oci <app.fl> --tag <tag> [--registry <url>]`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────
// registry 커맨드 (Phase 7)
// ─────────────────────────────────────────

function cmdRegistry(registryArgs: string[]): void {
  const subCmd = registryArgs[0];

  if (subCmd === "start") {
    // 레지스트리 서버 시작
    const portIdx = registryArgs.indexOf("--port");
    const port = portIdx !== -1 && registryArgs[portIdx + 1]
      ? parseInt(registryArgs[portIdx + 1], 10)
      : 4873;

    if (isNaN(port) || port < 1024 || port > 65535) {
      console.error(`\x1b[31m오류\x1b[0m  유효하지 않은 포트: ${port}`);
      process.exit(1);
    }

    console.log(`\x1b[36m[Registry]\x1b[0m  v9 패키지 레지스트리 시작 (포트 ${port})`);
    console.log(`\x1b[36m[Registry]\x1b[0m  http://localhost:${port}/`);

    // 레지스트리 서버를 별도 프로세스로 실행
    const registryPath = path.resolve(__dirname, "../vpm/registry-server.fl");
    if (!fs.existsSync(registryPath)) {
      console.error(`\x1b[31m오류\x1b[0m  registry-server.fl을 찾을 수 없습니다: ${registryPath}`);
      process.exit(1);
    }

    // registry-server.fl을 v9-run으로 실행
    const { execSync } = require("child_process");
    try {
      process.env.REGISTRY_PORT = String(port);
      execSync(`node ${path.resolve(__dirname, "../src/cli.js")} run ${registryPath}`, {
        stdio: "inherit",
        env: { ...process.env, REGISTRY_PORT: String(port) }
      });
    } catch (err: any) {
      console.error(`\x1b[31m레지스트리 시작 오류:\x1b[0m  ${err.message}`);
      process.exit(1);
    }
  } else if (subCmd === "status") {
    // 레지스트리 상태 확인
    const portIdx = registryArgs.indexOf("--port");
    const port = portIdx !== -1 && registryArgs[portIdx + 1]
      ? parseInt(registryArgs[portIdx + 1], 10)
      : 4873;

    try {
      const http = require("http");
      const req = http.get(`http://localhost:${port}/-/all`, (res: any) => {
        if (res.statusCode === 200) {
          console.log(`\x1b[32m[OK]\x1b[0m  레지스트리 정상 운영 중 (포트 ${port})`);
          process.exit(0);
        } else {
          console.error(`\x1b[31m오류\x1b[0m  레지스트리 응답 이상 (상태: ${res.statusCode})`);
          process.exit(1);
        }
      });
      req.on("error", (err: any) => {
        console.error(`\x1b[31m오류\x1b[0m  레지스트리 연결 실패: ${err.message}`);
        process.exit(1);
      });
      req.setTimeout(5000, () => {
        req.destroy();
        console.error(`\x1b[31m오류\x1b[0m  레지스트리 타임아웃`);
        process.exit(1);
      });
    } catch (err: any) {
      console.error(`\x1b[31m오류\x1b[0m  ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(`\x1b[31m알 수 없는 서브커맨드:\x1b[0m  registry ${subCmd}`);
    console.log(`\n사용법:\n  fl registry start [--port 4873]\n  fl registry status [--port 4873]`);
    process.exit(1);
  }
}

function cmdServe(args: string[]): void {
  // Phase 3: freelang serve [appDir] [--app app] [--port 3000] [--mode ssr|isr|ssg]
  let appDir = "app";
  let port: number | null = null;
  let renderMode: "ssr" | "isr" | "ssg" = "ssr";
  let positionalIdx = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--app" && args[i + 1]) {
      appDir = args[++i];
    } else if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[++i], 10);
    } else if (args[i] === "--mode" && args[i + 1]) {
      const m = args[++i] as "ssr" | "isr" | "ssg";
      if (["ssr", "isr", "ssg"].includes(m)) {
        renderMode = m;
      }
    } else if (!args[i].startsWith("--")) {
      // 첫 번째 positional argument는 appDir
      if (positionalIdx === 0) {
        appDir = args[i];
      }
      positionalIdx++;
    }
  }

  // 포트 우선순위: CLI --port > ENV PORT > fl.config.json > 기본값 3000
  if (port === null) {
    if (process.env.PORT) {
      port = parseInt(process.env.PORT, 10);
    } else {
      // fl.config.json 읽기 시도
      try {
        const fs = require("fs") as typeof import("fs");
        const path = require("path") as typeof import("path");
        const configPath = path.join(process.cwd(), "fl.config.json");
        if (fs.existsSync(configPath)) {
          const cfg = JSON.parse(fs.readFileSync(configPath, "utf-8")) as { port?: number };
          if (cfg.port) port = cfg.port;
        }
      } catch (_e) {
        // Silently ignore errors reading config file
      }
      if (port === null) port = 3000;
    }
  }

  const server = new WebServer({ appDir, port, renderMode });
  const interp = new Interpreter();
  server.setInterpreter(interp);

  server
    .start()
    .then((msg) => {
      console.log(msg);
      // Keep process alive
      setInterval(() => {}, 10000).unref();
    })
    .catch((err) => {
      console.error(`\x1b[31m서버 오류\x1b[0m  ${err.message}`);
      process.exit(1);
    });
}

function printUsage(): void {
  console.log([
    "",
    "FreeLang v11 CLI",
    "",
    "사용법:",
    "  freelang run <file.fl>           파일 실행",
    "  freelang run <file.fl> --watch   파일 변경 감지 + 자동 재실행",
    "  freelang check <file.fl>         문법 검사",
    "  freelang fmt <file.fl>           파일 인플레이스 포맷 (Phase 73)",
    "  freelang fmt --check <file.fl>   이미 포맷됐는지 확인 (미포맷 → exit 1)",
    "  freelang fmt --stdin             stdin 입력받아 stdout 출력",
    "  freelang repl                    대화형 REPL",
    "  freelang debug <file.fl>         디버그 모드 실행 (break! 활성화) (Phase 78)",
    "  freelang debug <file.fl> --step  step 모드 (모든 줄 추적)",
    "  freelang watch <file.fl>         파일 변경 시 자동 재실행 (Phase 79)",
    "  freelang watch <file.fl> --no-clear  콘솔 지우지 않고 재실행",
    "  freelang serve [--app app] [--port 3000]  웹 서버 시작 (Phase 3, App Router)",
    "  freelang serve --mode ssr|isr|ssg         렌더링 모드 선택",
    "  freelang ci                      현재 디렉토리 .fl 파일 전체 CI (Phase 80)",
    "  freelang ci <file.fl>            특정 파일 CI",
    "  freelang ci --no-fail-fast       실패해도 계속 진행",
    "  freelang doc <file.fl>           Markdown 문서 생성 → stdout (Phase 77)",
    "  freelang doc <file.fl> -o out.md 파일로 저장",
    "  freelang doc --dir <dir>         디렉토리 내 모든 .fl 파일 통합 문서화",
    "  freelang build --static [--app app/] [--out dist/]  정적 HTML export",
    "  freelang build --oci <app.fl> --tag <tag>        Docker 없이 OCI 이미지 빌드 (Phase 8)",
    "  freelang build --oci <app.fl> --tag <tag> --registry <url>  OCI 빌드 + push",
    "  freelang registry start [--port]  npm 호환 패키지 레지스트리 시작 (Phase 7)",
    "  freelang registry status [--port] 레지스트리 상태 확인",
    "",
    "예제:",
    "  freelang run my-script.fl",
    "  freelang run agent.fl --watch",
    "  freelang check parser.fl",
    "  freelang fmt my-script.fl",
    "  freelang fmt --check *.fl",
    "  cat script.fl | freelang fmt --stdin",
    "  freelang repl",
    "  freelang debug my-script.fl",
    "  freelang debug my-script.fl --step",
    "  freelang serve --app app --port 3000",
    "  freelang serve --mode isr",
    "  freelang doc fl-math-lib.fl",
    "  freelang doc fl-math-lib.fl -o math-api.md",
    "  freelang doc --dir src/",
    "",
  ].join("\n"));
}



const args = process.argv.slice(2);
const cmd = args[0];

switch (cmd) {
  case "run": {
    const filePath = args[1];
    if (!filePath) { printUsage(); process.exit(1); }
    const watch = args.includes("--watch") || args.includes("-w");
    // `--` 구분자 뒤의 인수는 스크립트로 전달 ($__argv__)
    // ⚠️ --watch와 extraArgs 충돌: -- 없이 `fl run file.fl --watch arg1` 하면
    // arg1이 --watch 필터링과 함께 extraArgs로 들어감 (의도한 동작인지 불명확)
    // 셀프 호스팅 실행 시엔 항상 -- 구분자 사용 권장: fl run interp.fl -- target.fl
    const ddIdx = args.indexOf("--");
    const extraArgs = ddIdx >= 0
      ? args.slice(ddIdx + 1)
      : args.slice(2).filter((a) => a !== "--watch" && a !== "-w");
    cmdRun(filePath, watch, extraArgs);
    break;
  }
  case "check": {
    const filePath = args[1];
    if (!filePath) { printUsage(); process.exit(1); }
    cmdCheck(filePath);
    break;
  }
  case "compile": {
    if (args.length < 2) { printUsage(); process.exit(1); }
    cmdCompile(args.slice(1));
    break;
  }
  case "codegen": {
    if (args.length < 2) { printUsage(); process.exit(1); }
    cmdCodegen(args.slice(1));
    break;
  }
  case "fmt": {
    cmdFmt(args.slice(1));
    break;
  }
  case "repl":
    cmdRepl();
    break;
  case "fn-doc":
  case "fl-doc": {
    // v11.4: node bootstrap.js fn-doc <name>   stdlib 함수 시그니처 검색
    const query = args[1];
    if (!query) {
      console.error("Usage: freelang fn-doc <name>");
      console.error("       (name can be exact or partial)");
      process.exit(1);
    }
    cmdStdlibDoc(query);
    break;
  }
  case "debug": {
    const filePath = args[1];
    if (!filePath) { printUsage(); process.exit(1); }
    const stepMode = args.includes("--step");
    cmdDebug(filePath, stepMode);
    break;
  }
  case "watch": {
    // Phase 79: freelang watch <file.fl> [--no-clear]
    const filePath = args[1];
    if (!filePath) { printUsage(); process.exit(1); }
    const noClear = args.includes("--no-clear");
    console.log(`\x1b[36m[Watch Mode]\x1b[0m  ${path.basename(filePath)} — 변경 감지 시 자동 재실행`);
    runWithWatch(filePath, {
      clearConsole: !noClear,
      debounceMs: 300,
      onError: (file, err) => {
        console.error(`\x1b[31m[ERROR]\x1b[0m  ${path.basename(file)}: ${err.message}`);
      },
    });
    break;
  }
  case "ci": {
    // Phase 80: freelang ci [<file.fl>] [--no-fail-fast]
    cmdCi(args.slice(1)).catch((err) => {
      console.error(`\x1b[31m[CI 오류]\x1b[0m  ${err.message}`);
      process.exit(1);
    });
    break;
  }
  case "doc": {
    // Phase 77: freelang doc <file.fl> [-o out.md] | --dir <dir>
    cmdDoc(args.slice(1));
    break;
  }
  case "build": {
    // Phase 8: freelang build --oci <app.fl> --tag <tag> [--registry <url>]
    cmdBuild(args.slice(1));
    break;
  }
  case "registry": {
    // Phase 7: freelang registry start [--port 4873] | status
    cmdRegistry(args.slice(1));
    break;
  }
  case "serve": {
    // Phase 3: freelang serve [--app app] [--port 3000] [--mode ssr|isr|ssg]
    cmdServe(args.slice(1));
    break;
  }
  default:
    printUsage();
    if (cmd) {
      console.error(`\x1b[31m알 수 없는 커맨드:\x1b[0m ${cmd}`);
      process.exit(1);
    }
    break;
}
