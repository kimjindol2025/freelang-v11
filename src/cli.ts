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
import { formatFL } from "./formatter";
import { DebugSession, setGlobalDebugSession } from "./debugger"; // Phase 78: 디버거
import { runWithWatch } from "./hot-reload"; // Phase 79: 워치 모드
import { extractDocs } from "./doc-extractor"; // Phase 77: 문서 추출기
import { renderMarkdown } from "./doc-renderer"; // Phase 77: 문서 렌더러
import { createDefaultPipeline, createFmtCheckStep, createLintStep, createTestStep } from "./ci-runner"; // Phase 80: CI

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

function cmdRun(filePath: string, watch: boolean): void {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  function execute(): void {
    const source = fs.readFileSync(absPath, "utf-8");
    const { ok, value } = runSource(source, absPath);
    if (ok && value !== null && value !== undefined) {
      // 마지막 값 출력 (REPL-like)
      if (typeof value === "object") {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(String(value));
      }
    }
    if (!ok && !watch) process.exit(1);
  }

  execute();

  if (watch) {
    console.log(`\x1b[2m  watching ${path.basename(absPath)}...\x1b[0m`);
    let debounce: NodeJS.Timeout | null = null;
    fs.watch(absPath, () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log(`\n\x1b[2m─── 변경 감지, 재실행 ───\x1b[0m`);
        execute();
      }, 100);
    });
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
// repl 커맨드
// ─────────────────────────────────────────

function cmdRepl(): void {
  console.log(`FreeLang v9 REPL  (\x1b[2m:q 종료  :help 도움말\x1b[0m)`);
  console.log(`─────────────────────────────────────────`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\x1b[36mfl>\x1b[0m ",
    terminal: true,
  });

  // 멀티라인: 여는 괄호/대괄호가 남아있으면 계속 입력 받음
  let buffer = "";

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
      const ctx = interpret(ast);
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

function printUsage(): void {
  console.log([
    "",
    "FreeLang v9 CLI",
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
    "  freelang ci                      현재 디렉토리 .fl 파일 전체 CI (Phase 80)",
    "  freelang ci <file.fl>            특정 파일 CI",
    "  freelang ci --no-fail-fast       실패해도 계속 진행",
    "  freelang doc <file.fl>           Markdown 문서 생성 → stdout (Phase 77)",
    "  freelang doc <file.fl> -o out.md 파일로 저장",
    "  freelang doc --dir <dir>         디렉토리 내 모든 .fl 파일 통합 문서화",
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
    cmdRun(filePath, watch);
    break;
  }
  case "check": {
    const filePath = args[1];
    if (!filePath) { printUsage(); process.exit(1); }
    cmdCheck(filePath);
    break;
  }
  case "fmt": {
    cmdFmt(args.slice(1));
    break;
  }
  case "repl":
    cmdRepl();
    break;
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
  default:
    printUsage();
    if (cmd) {
      console.error(`\x1b[31m알 수 없는 커맨드:\x1b[0m ${cmd}`);
      process.exit(1);
    }
    break;
}
