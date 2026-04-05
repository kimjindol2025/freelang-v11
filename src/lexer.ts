// FreeLang v9: Lexer for S-Expression

import { Token, TokenType as T } from "./token";

// Phase 6: Map keywords to token types
// Phase 9a: Added search, fetch keywords
const KEYWORDS: Map<string, T> = new Map([
  ["MODULE", T.Module],
  ["TYPECLASS", T.TypeClass],
  ["INSTANCE", T.Instance],
  ["import", T.Import],
  ["open", T.Open],
  // Phase 9a: Search functionality keywords
  ["search", T.Search],
  ["fetch", T.Fetch],
  // Note: browse, browse, cache are treated as regular symbols, not keywords
]);

function getKeywordTokenType(text: string): T | null {
  return KEYWORDS.get(text) ?? null;
}

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0, line = 1, col = 1;

  while (i < source.length) {
    const ch = source[i];

    // Whitespace
    if (/\s/.test(ch)) {
      if (ch === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
      continue;
    }

    // Comment: ;; to end of line
    if (ch === ";" && source[i + 1] === ";") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

    // String: "..."
    if (ch === '"') {
      const start = i;
      const startCol = col;
      i++;
      col++;
      let value = "";

      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) {
          i++;
          col++;
          const esc = source[i];
          switch (esc) {
            case "n": value += "\n"; break;
            case "t": value += "\t"; break;
            case "\\": value += "\\"; break;
            case '"': value += '"'; break;
            default: value += esc;
          }
          i++;
          col++;
        } else {
          if (source[i] === "\n") {
            line++;
            col = 1;
          } else {
            col++;
          }
          value += source[i];
          i++;
        }
      }

      if (i >= source.length) {
        throw new Error(`Unterminated string at line ${line}, col ${startCol}`);
      }

      i++; col++; // closing "
      tokens.push({ type: T.String, value, line, col: startCol });
      continue;
    }

    // Brackets
    if (ch === "[") {
      tokens.push({ type: T.LBracket, value: "[", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: T.RBracket, value: "]", line, col });
      i++;
      col++;
      continue;
    }

    // Parentheses
    if (ch === "(") {
      tokens.push({ type: T.LParen, value: "(", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: T.RParen, value: ")", line, col });
      i++;
      col++;
      continue;
    }

    // Pipe: Or-pattern separator
    if (ch === "|") {
      const startCol = col;
      tokens.push({ type: T.Symbol, value: "|", line, col: startCol });
      i++;
      col++;
      continue;
    }

    // Colon: Phase 6 token separator (not keyword prefix)
    if (ch === ":") {
      const startCol = col;
      tokens.push({ type: T.Colon, value: ":", line, col: startCol });
      i++;
      col++;
      continue;
    }

    // Variable: $varname
    if (ch === "$") {
      const start = i;
      const startCol = col;
      i++;
      col++;

      let varname = "";
      while (i < source.length && /[a-zA-Z0-9_-]/.test(source[i])) {
        varname += source[i];
        i++;
        col++;
      }

      if (varname.length === 0) {
        throw new Error(`Expected variable name after $ at line ${line}, col ${startCol}`);
      }

      tokens.push({ type: T.Variable, value: varname, line, col: startCol });
      continue;
    }

    // Number: digits with optional decimal
    if (/\d/.test(ch)) {
      const start = i;
      const startCol = col;

      while (i < source.length && /[\d.]/.test(source[i])) {
        i++;
        col++;
      }

      const value = source.slice(start, i);
      tokens.push({ type: T.Number, value, line, col: startCol });
      continue;
    }

    // Symbol: letters, hyphens, etc. (includes & for pattern rest element)
    // NOTE: ':' excluded - it's a separate Colon token for qualified identifiers
    // NOTE: '|' excluded - it's a separate Pipe token for or-patterns
    if (/[a-zA-Z_<>=!+\-*&/]/.test(ch)) {
      const start = i;
      const startCol = col;

      while (i < source.length && /[a-zA-Z0-9_<>=!+\-*/?&]/.test(source[i])) {
        i++;
        col++;
      }

      const value = source.slice(start, i);

      // Phase 6: Check for keywords
      const keywordType = getKeywordTokenType(value);
      const tokenType = keywordType ?? T.Symbol;

      tokens.push({ type: tokenType, value, line, col: startCol });
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at line ${line}, col ${col}`);
  }

  tokens.push({ type: T.EOF, value: "", line, col });
  return tokens;
}
