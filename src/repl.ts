// FreeLang v9: REPL 2.0
// Phase 75: 히스토리, :cmd 명령어, 기본 자동완성

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

// REPL 전용 평가 결과 타입
export interface ReplResult {
  value: any;
  error?: string;
}

// 단위 테스트용: readline 없이 동작하는 핵심 로직
export class FreeLangReplCore {
  public interp: Interpreter;
  public history: string[] = [];

  constructor(interp?: Interpreter) {
    this.interp = interp ?? new Interpreter();
  }

  /**
   * 소스 라인 평가 (eval 핵심)
   */
  evalLine(src: string): ReplResult {
    try {
      const ctx = this.interp.interpret(parse(lex(src)));
      return { value: ctx.lastValue };
    } catch (e: any) {
      return { value: undefined, error: e.message };
    }
  }

  /**
   * :cmd 명령어 처리
   * 반환값: 출력할 문자열 (undefined = 출력 없음)
   */
  handleCmd(cmd: string): string | undefined {
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
        if (fns.length === 0) return "(함수 없음)";
        return fns.join("  ");
      }

      case "src": {
        const fnName = args[0];
        if (!fnName) return "사용법: :src <함수명>";
        const fn = this.interp.context.functions.get(fnName);
        if (!fn) return `함수 '${fnName}' 없음`;
        const params = fn.params.join(" ");
        return `(defn ${fn.name} [${params}] ...)`;
      }

      case "inspect": {
        const varName = args[0];
        if (!varName) return "사용법: :inspect <변수명>";
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
        if (!expr) return "사용법: :time <표현식>";
        const start = Date.now();
        const result = this.evalLine(expr);
        const elapsed = Date.now() - start;
        if (result.error) return `오류: ${result.error} (${elapsed}ms)`;
        return `→ ${JSON.stringify(result.value)} (${elapsed}ms)`;
      }

      case "clear": {
        this.interp = new Interpreter();
        return "상태 초기화 완료";
      }

      case "load": {
        const filePath = args[0];
        if (!filePath) return "사용법: :load <파일경로>";
        const absPath = path.resolve(filePath);
        if (!fs.existsSync(absPath)) return `파일 없음: ${absPath}`;
        try {
          const src = fs.readFileSync(absPath, "utf-8");
          const result = this.evalLine(src);
          if (result.error) return `로드 오류: ${result.error}`;
          return `로드 완료: ${absPath}`;
        } catch (e: any) {
          return `로드 오류: ${e.message}`;
        }
      }

      case "hist": {
        if (this.history.length === 0) return "(히스토리 없음)";
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
  processLine(line: string): { output: string | null; isError: boolean } {
    const trimmed = line.trim();
    if (!trimmed) return { output: null, isError: false };

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

/**
 * 인터랙티브 REPL (readline 사용)
 */
export class FreeLangRepl {
  private core: FreeLangReplCore;
  private rl!: readline.Interface;

  constructor() {
    this.core = new FreeLangReplCore();
  }

  start(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      completer: (line: string) => this.completer(line),
    });

    console.log("FreeLang v9 REPL — :help 로 명령어 확인");
    this.prompt();
  }

  private completer(line: string): [string[], string] {
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

  private prompt(): void {
    this.rl.question("fl> ", (line) => {
      const { output, isError } = this.core.processLine(line);
      if (output !== null) {
        if (isError) {
          console.error(output);
        } else {
          console.log(output);
        }
      }
      this.prompt();
    });
  }
}
