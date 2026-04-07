#!/usr/bin/env node
"use strict";
// FreeLang v9 CLI
// 사용법:
//   freelang run <file.fl>          파일 실행
//   freelang run <file.fl> --watch  파일 변경시 자동 재실행
//   freelang repl                   대화형 REPL
//   freelang check <file.fl>        문법 검사만 (실행 안 함)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
// ─────────────────────────────────────────
// 에러 포맷터: 소스 줄 강조
// ─────────────────────────────────────────
function formatError(err, source, filePath) {
    const fileName = filePath ? path.basename(filePath) : "<stdin>";
    const lines = [];
    if (err instanceof parser_1.ParserError) {
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
    }
    else if (err instanceof Error) {
        lines.push(`\n\x1b[31m실행 오류\x1b[0m  ${fileName}`);
        lines.push(`  ${err.message}`);
    }
    else {
        lines.push(`\n\x1b[31m오류\x1b[0m  ${String(err)}`);
    }
    return lines.join("\n");
}
// ─────────────────────────────────────────
// 실행 엔진
// ─────────────────────────────────────────
function runSource(source, filePath) {
    try {
        const tokens = (0, lexer_1.lex)(source);
        const ast = (0, parser_1.parse)(tokens);
        const ctx = (0, interpreter_1.interpret)(ast);
        return { ok: true, value: ctx.lastValue };
    }
    catch (err) {
        console.error(formatError(err, source, filePath));
        return { ok: false, value: null };
    }
}
function checkSource(source, filePath) {
    try {
        const tokens = (0, lexer_1.lex)(source);
        (0, parser_1.parse)(tokens);
        const fileName = filePath ? path.basename(filePath) : "<stdin>";
        console.log(`\x1b[32m✓\x1b[0m  ${fileName}  문법 이상 없음`);
        return true;
    }
    catch (err) {
        console.error(formatError(err, source, filePath));
        return false;
    }
}
// ─────────────────────────────────────────
// run 커맨드
// ─────────────────────────────────────────
function cmdRun(filePath, watch) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
        process.exit(1);
    }
    function execute() {
        const source = fs.readFileSync(absPath, "utf-8");
        const { ok, value } = runSource(source, absPath);
        if (ok && value !== null && value !== undefined) {
            // 마지막 값 출력 (REPL-like)
            if (typeof value === "object") {
                console.log(JSON.stringify(value, null, 2));
            }
            else {
                console.log(String(value));
            }
        }
        if (!ok && !watch)
            process.exit(1);
    }
    execute();
    if (watch) {
        console.log(`\x1b[2m  watching ${path.basename(absPath)}...\x1b[0m`);
        let debounce = null;
        fs.watch(absPath, () => {
            if (debounce)
                clearTimeout(debounce);
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
function cmdCheck(filePath) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.error(`\x1b[31m오류\x1b[0m  파일을 찾을 수 없습니다: ${filePath}`);
        process.exit(1);
    }
    const source = fs.readFileSync(absPath, "utf-8");
    const ok = checkSource(source, absPath);
    if (!ok)
        process.exit(1);
}
// ─────────────────────────────────────────
// repl 커맨드
// ─────────────────────────────────────────
function cmdRepl() {
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
    function countBalance(s) {
        let balance = 0;
        let inStr = false;
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '"') {
                let backslashCount = 0;
                let j = i - 1;
                while (j >= 0 && s[j] === "\\") {
                    backslashCount++;
                    j--;
                }
                if (backslashCount % 2 === 0)
                    inStr = !inStr;
            }
            if (!inStr) {
                if (ch === "(" || ch === "[" || ch === "{")
                    balance++;
                if (ch === ")" || ch === "]" || ch === "}")
                    balance--;
            }
        }
        return balance;
    }
    rl.prompt();
    rl.on("line", (line) => {
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
            const tokens = (0, lexer_1.lex)(source);
            const ast = (0, parser_1.parse)(tokens);
            const ctx = (0, interpreter_1.interpret)(ast);
            const val = ctx.lastValue;
            if (val !== null && val !== undefined) {
                if (typeof val === "object") {
                    console.log("\x1b[33m=>\x1b[0m", JSON.stringify(val, null, 2));
                }
                else {
                    console.log("\x1b[33m=>\x1b[0m", String(val));
                }
            }
        }
        catch (err) {
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
function printUsage() {
    console.log([
        "",
        "FreeLang v9 CLI",
        "",
        "사용법:",
        "  freelang run <file.fl>           파일 실행",
        "  freelang run <file.fl> --watch   파일 변경 감지 + 자동 재실행",
        "  freelang check <file.fl>         문법 검사",
        "  freelang repl                    대화형 REPL",
        "",
        "예제:",
        "  freelang run my-script.fl",
        "  freelang run agent.fl --watch",
        "  freelang check parser.fl",
        "  freelang repl",
        "",
    ].join("\n"));
}
const args = process.argv.slice(2);
const cmd = args[0];
switch (cmd) {
    case "run": {
        const filePath = args[1];
        if (!filePath) {
            printUsage();
            process.exit(1);
        }
        const watch = args.includes("--watch") || args.includes("-w");
        cmdRun(filePath, watch);
        break;
    }
    case "check": {
        const filePath = args[1];
        if (!filePath) {
            printUsage();
            process.exit(1);
        }
        cmdCheck(filePath);
        break;
    }
    case "repl":
        cmdRepl();
        break;
    default:
        printUsage();
        if (cmd) {
            console.error(`\x1b[31m알 수 없는 커맨드:\x1b[0m ${cmd}`);
            process.exit(1);
        }
        break;
}
//# sourceMappingURL=cli.js.map