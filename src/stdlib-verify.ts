// FreeLang v11: Code Verification Standard Library
// Phase F-2: AI 코드 생성 자동 검증
//
// 목적: AI(Claude 등)가 FreeLang 코드를 생성할 때
//       괄호 짝/구조 오류를 즉시 자동 감지
// 인간 배제: AI 생성 코드 파이프라인 전용

interface ParenError {
  line: number;
  col: number;
  message: string;
  context: string;
}

interface VerifyResult {
  valid: boolean;
  errors: ParenError[];
  depth_max: number;
  paren_count: number;
  fixed?: string;
}

function checkParens(code: string): VerifyResult {
  const errors: ParenError[] = [];
  const stack: Array<{ line: number; col: number; ch: string }> = [];
  const lines = code.split("\n");
  let depth_max = 0;
  let paren_count = 0;
  let inString = false;
  let inComment = false;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    inComment = false;

    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];

      // 문자열 처리
      if (ch === '"' && !inComment) {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      // 줄 주석
      if (ch === ';' && !inString) {
        inComment = true;
        break;
      }
      if (inComment) break;

      if (ch === '(' || ch === '[') {
        stack.push({ line: li + 1, col: ci + 1, ch });
        depth_max = Math.max(depth_max, stack.length);
        paren_count++;
      } else if (ch === ')' || ch === ']') {
        if (stack.length === 0) {
          const context = line.trim().slice(0, 40);
          errors.push({
            line: li + 1,
            col: ci + 1,
            message: `닫는 '${ch}' 대응하는 여는 괄호 없음`,
            context,
          });
        } else {
          const open = stack.pop()!;
          // 괄호 짝 불일치
          const expected = open.ch === '(' ? ')' : ']';
          if (ch !== expected) {
            errors.push({
              line: li + 1,
              col: ci + 1,
              message: `괄호 불일치: '${open.ch}' (${open.line}:${open.col}) → '${ch}' 닫음`,
              context: line.trim().slice(0, 40),
            });
          }
        }
      }
    }
  }

  // 닫히지 않은 괄호
  for (const unclosed of stack) {
    errors.push({
      line: unclosed.line,
      col: unclosed.col,
      message: `'${unclosed.ch}' 닫히지 않음 (${stack.length}개 미닫힘)`,
      context: lines[unclosed.line - 1]?.trim().slice(0, 40) ?? "",
    });
  }

  // 자동 수정 시도 (닫는 괄호 부족한 경우만)
  let fixed: string | undefined;
  if (errors.length > 0 && stack.length > 0) {
    const closing = stack
      .slice()
      .reverse()
      .map(s => (s.ch === '(' ? ')' : ']'))
      .join("");
    fixed = code.trimEnd() + "\n" + closing;
  }

  return {
    valid: errors.length === 0,
    errors,
    depth_max,
    paren_count,
    fixed,
  };
}

export function createVerifyModule() {
  return {
    // check_parens code -> VerifyResult
    "check_parens": (code: string): Map<string, any> => {
      const r = checkParens(code);
      const m = new Map<string, any>();
      m.set("valid", r.valid);
      m.set("errors", r.errors.map(e => {
        const em = new Map<string, any>();
        em.set("line", e.line);
        em.set("col", e.col);
        em.set("message", e.message);
        em.set("context", e.context);
        return em;
      }));
      m.set("depth_max", r.depth_max);
      m.set("paren_count", r.paren_count);
      if (r.fixed !== undefined) m.set("fixed", r.fixed);
      return m;
    },

    // verify_code code -> {valid, error_count, first_error}
    "verify_code": (code: string): Map<string, any> => {
      const r = checkParens(code);
      const m = new Map<string, any>();
      m.set("valid", r.valid);
      m.set("error_count", r.errors.length);
      m.set("depth_max", r.depth_max);
      m.set("paren_count", r.paren_count);
      if (r.errors.length > 0) {
        const first = r.errors[0];
        m.set("first_error", `line ${first.line}:${first.col} — ${first.message}`);
        m.set("all_errors", r.errors.map(e => `line ${e.line}:${e.col} — ${e.message}`));
      }
      if (r.fixed) m.set("fixed", r.fixed);
      return m;
    },

    // fix_parens code -> 자동 수정된 코드 (or original if already valid)
    "fix_parens": (code: string): string => {
      const r = checkParens(code);
      if (r.valid) return code;
      return r.fixed ?? code;
    },

    // count_parens code -> {open, close, balanced}
    "count_parens": (code: string): Map<string, any> => {
      let open = 0, close = 0;
      let inStr = false, inCmt = false;
      for (const line of code.split("\n")) {
        inCmt = false;
        for (const ch of line) {
          if (ch === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (ch === ';') { inCmt = true; break; }
          if (inCmt) break;
          if (ch === '(' || ch === '[') open++;
          if (ch === ')' || ch === ']') close++;
        }
      }
      const m = new Map<string, any>();
      m.set("open", open);
      m.set("close", close);
      m.set("balanced", open === close);
      m.set("diff", open - close);
      return m;
    },
  };
}
