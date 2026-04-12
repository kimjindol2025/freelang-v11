"use strict";
// FreeLang v9: REPL 2.0
// Phase 75: 히스토리, :cmd 명령어, 기본 자동완성
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
exports.FreeLangRepl = exports.FreeLangReplCore = void 0;
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
// 단위 테스트용: readline 없이 동작하는 핵심 로직
class FreeLangReplCore {
    constructor(interp) {
        this.history = [];
        this.interp = interp ?? new interpreter_1.Interpreter();
    }
    /**
     * 소스 라인 평가 (eval 핵심)
     */
    evalLine(src) {
        try {
            const ctx = this.interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
            return { value: ctx.lastValue };
        }
        catch (e) {
            return { value: undefined, error: e.message };
        }
    }
    /**
     * :cmd 명령어 처리
     * 반환값: 출력할 문자열 (undefined = 출력 없음)
     */
    handleCmd(cmd) {
        const parts = cmd.slice(1).trim().split(/\s+/);
        const name = parts[0];
        const args = parts.slice(1);
        switch (name) {
            case "help":
                return [
                    "FreeLang v9 REPL 명령어:",
                    "  :help          — 이 도움말",
                    "  :ls            — 정의된 함수 목록",
                    "  :src <이름>    — 함수 소스(파라미터) 보기",
                    "  :inspect <변수> — 변수 현재 값",
                    "  :time <표현식> — 실행 시간 측정",
                    "  :clear         — 인터프리터 상태 초기화",
                    "  :load <파일>   — .fl 파일 로드",
                    "  :hist          — 히스토리 출력",
                    "  :quit / :exit  — 종료",
                ].join("\n");
            case "ls": {
                const fns = [...this.interp.context.functions.keys()];
                if (fns.length === 0)
                    return "(함수 없음)";
                return fns.join("  ");
            }
            case "src": {
                const fnName = args[0];
                if (!fnName)
                    return "사용법: :src <함수명>";
                const fn = this.interp.context.functions.get(fnName);
                if (!fn)
                    return `함수 '${fnName}' 없음`;
                const params = fn.params.join(" ");
                return `(defn ${fn.name} [${params}] ...)`;
            }
            case "inspect": {
                const varName = args[0];
                if (!varName)
                    return "사용법: :inspect <변수명>";
                // variables는 $-prefix로 저장됨 (define x 42 → $x)
                const key = varName.startsWith("$") ? varName : "$" + varName;
                const val = this.interp.context.variables.get(key);
                if (val === undefined && !this.interp.context.variables.has(key)) {
                    return `변수 '${varName}' 없음`;
                }
                return `${varName} = ${JSON.stringify(val)}`;
            }
            case "time": {
                const expr = args.join(" ");
                if (!expr)
                    return "사용법: :time <표현식>";
                const start = Date.now();
                const result = this.evalLine(expr);
                const elapsed = Date.now() - start;
                if (result.error)
                    return `오류: ${result.error} (${elapsed}ms)`;
                return `→ ${JSON.stringify(result.value)} (${elapsed}ms)`;
            }
            case "clear": {
                this.interp = new interpreter_1.Interpreter();
                return "상태 초기화 완료";
            }
            case "load": {
                const filePath = args[0];
                if (!filePath)
                    return "사용법: :load <파일경로>";
                const absPath = path.resolve(filePath);
                if (!fs.existsSync(absPath))
                    return `파일 없음: ${absPath}`;
                try {
                    const src = fs.readFileSync(absPath, "utf-8");
                    const result = this.evalLine(src);
                    if (result.error)
                        return `로드 오류: ${result.error}`;
                    return `로드 완료: ${absPath}`;
                }
                catch (e) {
                    return `로드 오류: ${e.message}`;
                }
            }
            case "hist": {
                if (this.history.length === 0)
                    return "(히스토리 없음)";
                return this.history
                    .map((h, i) => `  ${String(i + 1).padStart(3)}: ${h}`)
                    .join("\n");
            }
            case "quit":
            case "exit":
                process.exit(0);
            default:
                return `알 수 없는 명령어: :${name} (:help 참조)`;
        }
    }
    /**
     * 한 줄 처리 (히스토리 누적 + :cmd 분기)
     * 반환: { output, isError }
     */
    processLine(line) {
        const trimmed = line.trim();
        if (!trimmed)
            return { output: null, isError: false };
        this.history.push(trimmed);
        if (trimmed.startsWith(":")) {
            const out = this.handleCmd(trimmed);
            return { output: out ?? null, isError: false };
        }
        const result = this.evalLine(trimmed);
        if (result.error) {
            return { output: `오류: ${result.error}`, isError: true };
        }
        if (result.value !== null && result.value !== undefined) {
            return { output: `→ ${JSON.stringify(result.value)}`, isError: false };
        }
        return { output: null, isError: false };
    }
}
exports.FreeLangReplCore = FreeLangReplCore;
/**
 * 인터랙티브 REPL (readline 사용)
 */
class FreeLangRepl {
    constructor() {
        this.core = new FreeLangReplCore();
    }
    start() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
            completer: (line) => this.completer(line),
        });
        console.log("FreeLang v9 REPL — :help 로 명령어 확인");
        this.prompt();
    }
    completer(line) {
        // :cmd 자동완성
        const cmds = [":help", ":ls", ":src", ":inspect", ":time", ":clear", ":load", ":hist", ":quit", ":exit"];
        if (line.startsWith(":")) {
            const hits = cmds.filter((c) => c.startsWith(line));
            return [hits.length ? hits : cmds, line];
        }
        // 함수명 자동완성
        const fns = [...this.core.interp.context.functions.keys()];
        const hits = fns.filter((f) => f.startsWith(line));
        return [hits, line];
    }
    prompt() {
        this.rl.question("fl> ", (line) => {
            const { output, isError } = this.core.processLine(line);
            if (output !== null) {
                if (isError) {
                    console.error(output);
                }
                else {
                    console.log(output);
                }
            }
            this.prompt();
        });
    }
}
exports.FreeLangRepl = FreeLangRepl;
//# sourceMappingURL=repl.js.map