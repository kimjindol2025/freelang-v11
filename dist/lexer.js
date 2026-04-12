"use strict";
// FreeLang v9: Lexer for S-Expression
Object.defineProperty(exports, "__esModule", { value: true });
exports.lex = lex;
const token_1 = require("./token");
// Phase 6: Map keywords to token types
// Phase 9a: Added search, fetch keywords
// Phase 9b: Added learn, recall, remember, forget keywords
// Phase 9c: Added observe, analyze, decide, act, verify keywords
const KEYWORDS = new Map([
    ["MODULE", token_1.TokenType.Module],
    ["TYPECLASS", token_1.TokenType.TypeClass],
    ["INSTANCE", token_1.TokenType.Instance],
    ["import", token_1.TokenType.Import],
    ["open", token_1.TokenType.Open],
    // Phase 9a: Search functionality keywords
    ["search", token_1.TokenType.Search],
    ["fetch", token_1.TokenType.Fetch],
    // Phase 9b: Learning functionality keywords
    ["learn", token_1.TokenType.Learn],
    ["recall", token_1.TokenType.Recall],
    ["remember", token_1.TokenType.Remember],
    ["forget", token_1.TokenType.Forget],
    // Phase 9c: Reasoning functionality keywords
    ["observe", token_1.TokenType.Observe],
    ["analyze", token_1.TokenType.Analyze],
    ["decide", token_1.TokenType.Decide],
    ["act", token_1.TokenType.Act],
    ["verify", token_1.TokenType.Verify],
    // Phase 9c: Conditional branching keywords
    ["if", token_1.TokenType.If],
    ["when", token_1.TokenType.When],
    ["then", token_1.TokenType.Then],
    ["else", token_1.TokenType.Else],
    // Phase 9c: Loop control keywords
    ["repeat", token_1.TokenType.Repeat],
    ["until", token_1.TokenType.Until],
    ["while", token_1.TokenType.While],
    // Note: browse, cache are treated as regular symbols, not keywords
]);
function getKeywordTokenType(text) {
    return KEYWORDS.get(text) ?? null;
}
function lex(source) {
    const tokens = [];
    let i = 0, line = 1, col = 1;
    while (i < source.length) {
        const ch = source[i];
        // Whitespace
        if (/\s/.test(ch)) {
            if (ch === "\n") {
                line++;
                col = 1;
            }
            else {
                col++;
            }
            i++;
            continue;
        }
        // Comment: ; or ;; to end of line (single ; for self-hosting .fl files)
        if (ch === ";") {
            while (i < source.length && source[i] !== "\n")
                i++;
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
                        case "n":
                            value += "\n";
                            break;
                        case "t":
                            value += "\t";
                            break;
                        case "r":
                            value += "\r";
                            break;
                        case "\\":
                            value += "\\";
                            break;
                        case '"':
                            value += '"';
                            break;
                        default: value += esc;
                    }
                    i++;
                    col++;
                }
                else {
                    if (source[i] === "\n") {
                        line++;
                        col = 1;
                    }
                    else {
                        col++;
                    }
                    value += source[i];
                    i++;
                }
            }
            if (i >= source.length) {
                throw new Error(`Unterminated string at line ${line}, col ${startCol}`);
            }
            i++;
            col++; // closing "
            tokens.push({ type: token_1.TokenType.String, value, line, col: startCol });
            continue;
        }
        // Brackets
        if (ch === "[") {
            tokens.push({ type: token_1.TokenType.LBracket, value: "[", line, col });
            i++;
            col++;
            continue;
        }
        if (ch === "]") {
            tokens.push({ type: token_1.TokenType.RBracket, value: "]", line, col });
            i++;
            col++;
            continue;
        }
        // Parentheses
        if (ch === "(") {
            tokens.push({ type: token_1.TokenType.LParen, value: "(", line, col });
            i++;
            col++;
            continue;
        }
        if (ch === ")") {
            tokens.push({ type: token_1.TokenType.RParen, value: ")", line, col });
            i++;
            col++;
            continue;
        }
        // Braces: Map literal delimiters
        if (ch === "{") {
            tokens.push({ type: token_1.TokenType.LBrace, value: "{", line, col });
            i++;
            col++;
            continue;
        }
        if (ch === "}") {
            tokens.push({ type: token_1.TokenType.RBrace, value: "}", line, col });
            i++;
            col++;
            continue;
        }
        // Pipe: Or-pattern separator
        if (ch === "|") {
            const startCol = col;
            tokens.push({ type: token_1.TokenType.Symbol, value: "|", line, col: startCol });
            i++;
            col++;
            continue;
        }
        // Colon: Phase 6 token separator (not keyword prefix)
        if (ch === ":") {
            const startCol = col;
            tokens.push({ type: token_1.TokenType.Colon, value: ":", line, col: startCol });
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
            tokens.push({ type: token_1.TokenType.Variable, value: varname, line, col: startCol });
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
            tokens.push({ type: token_1.TokenType.Number, value, line, col: startCol });
            continue;
        }
        // Symbol: letters, hyphens, etc. (includes & for pattern rest element)
        // NOTE: ':' excluded - it's a separate Colon token for qualified identifiers
        // NOTE: '|' excluded - it's a separate Pipe token for or-patterns
        // NOTE: '.' included for field access: env.vars, node.op (self-hosting .fl files)
        if (/[a-zA-Z_<>=!+\-*&/%]/.test(ch)) {
            const start = i;
            const startCol = col;
            while (i < source.length && /[a-zA-Z0-9_<>=!+\-*/?&.%]/.test(source[i])) {
                i++;
                col++;
            }
            const value = source.slice(start, i);
            // Phase 6: Check for keywords
            const keywordType = getKeywordTokenType(value);
            const tokenType = keywordType ?? token_1.TokenType.Symbol;
            tokens.push({ type: tokenType, value, line, col: startCol });
            continue;
        }
        throw new Error(`Unexpected character '${ch}' at line ${line}, col ${col}`);
    }
    tokens.push({ type: token_1.TokenType.EOF, value: "", line, col });
    return tokens;
}
//# sourceMappingURL=lexer.js.map