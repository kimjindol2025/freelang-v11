// v11 Script Lexer: Python-like syntax → Tokens

export type ScriptTokenType =
  | "KEYWORD"  // func, if, while, return, def, etc.
  | "IDENT"    // 변수명, 함수명
  | "NUMBER"   // 123, 45.67
  | "STRING"   // "text"
  | "OPERATOR" // +, -, *, /, ==, >, <, etc.
  | "LPAREN"   // (
  | "RPAREN"   // )
  | "LBRACE"   // {
  | "RBRACE"   // }
  | "LBRACKET" // [
  | "RBRACKET" // ]
  | "COLON"    // :
  | "COMMA"    // ,
  | "ASSIGN"   // =
  | "SEMICOLON"// ;
  | "NEWLINE"  // \n (들여쓰기 감지)
  | "INDENT"   // 들여쓰기 증가
  | "DEDENT"   // 들여쓰기 감소
  | "EOF"
  | "COMMENT"; // # comment

export interface ScriptToken {
  type: ScriptTokenType;
  value: string;
  line: number;
  col: number;
}

const KEYWORDS = new Set([
  "func", "return", "if", "else", "while", "for", "break", "continue",
  "def", "let", "const", "true", "false", "null", "and", "or", "not"
]);

const OPERATORS = new Map([
  ["+", "+"], ["-", "-"], ["*", "*"], ["/", "/"], ["%", "%"],
  ["==", "=="], ["!=", "!="], [">", ">"], ["<", "<"], [">=", ">="], ["<=", "<="],
  ["&&", "&&"], ["||", "||"], ["!", "!"]
]);

export function scriptLex(source: string): ScriptToken[] {
  const tokens: ScriptToken[] = [];
  let i = 0, line = 1, col = 1;
  let indentStack = [0]; // 들여쓰기 스택

  while (i < source.length) {
    const ch = source[i];

    // 줄 시작: 들여쓰기 처리
    if (col === 1 && ch !== "\n" && ch !== "#") {
      const indent = countIndent(source, i);
      const currentIndent = indentStack[indentStack.length - 1];

      if (indent > currentIndent) {
        indentStack.push(indent);
        tokens.push({ type: "INDENT", value: "", line, col });
      } else if (indent < currentIndent) {
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indent) {
          indentStack.pop();
          tokens.push({ type: "DEDENT", value: "", line, col });
        }
      }
      i += indent;
      col += indent;
      continue;
    }

    // 공백 (탭/스페이스, 줄의 중간)
    if (ch === " " || ch === "\t") {
      col += ch === "\t" ? 4 : 1;
      i++;
      continue;
    }

    // 주석
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    // 줄바꿈
    if (ch === "\n") {
      tokens.push({ type: "NEWLINE", value: "\n", line, col });
      line++;
      col = 1;
      i++;
      continue;
    }

    // 문자열
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startCol = col;
      let value = "";
      i++;
      col++;

      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") {
          i++;
          col++;
          const esc = source[i];
          value += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
        } else {
          value += source[i];
        }
        i++;
        col++;
      }
      if (source[i] === quote) {
        i++;
        col++;
      }
      tokens.push({ type: "STRING", value, line, col: startCol });
      continue;
    }

    // 숫자
    if (/\d/.test(ch)) {
      const startCol = col;
      let value = "";
      while (i < source.length && /[\d.]/.test(source[i])) {
        value += source[i];
        i++;
        col++;
      }
      tokens.push({ type: "NUMBER", value, line, col: startCol });
      continue;
    }

    // 식별자 & 키워드
    if (/[a-zA-Z_]/.test(ch)) {
      const startCol = col;
      let value = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        value += source[i];
        i++;
        col++;
      }
      const type = KEYWORDS.has(value) ? "KEYWORD" : "IDENT";
      tokens.push({ type: type as ScriptTokenType, value, line, col: startCol });
      continue;
    }

    // 2글자 연산자 (==, !=, >=, <=, &&, ||)
    if (i + 1 < source.length) {
      const twoChar = source.slice(i, i + 2);
      if (OPERATORS.has(twoChar)) {
        tokens.push({ type: "OPERATOR", value: twoChar, line, col });
        i += 2;
        col += 2;
        continue;
      }
    }

    // 단일 문자 토큰
    const tokenMap: { [key: string]: ScriptTokenType } = {
      "(": "LPAREN", ")": "RPAREN",
      "{": "LBRACE", "}": "RBRACE",
      "[": "LBRACKET", "]": "RBRACKET",
      ":": "COLON", ",": "COMMA",
      "=": "ASSIGN", ";": "SEMICOLON"
    };

    if (tokenMap[ch]) {
      tokens.push({ type: tokenMap[ch], value: ch, line, col });
      i++;
      col++;
      continue;
    }

    // 1글자 연산자
    if (OPERATORS.has(ch)) {
      tokens.push({ type: "OPERATOR", value: ch, line, col });
      i++;
      col++;
      continue;
    }

    // 알 수 없는 문자는 무시
    i++;
    col++;
  }

  // DEDENT 완료
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: "DEDENT", value: "", line, col });
  }

  tokens.push({ type: "EOF", value: "", line, col });
  return tokens;
}

function countIndent(source: string, start: number): number {
  let indent = 0;
  let i = start;
  while (i < source.length && (source[i] === " " || source[i] === "\t")) {
    indent += source[i] === "\t" ? 4 : 1;
    i++;
  }
  return indent;
}
