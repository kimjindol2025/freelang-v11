"use strict";
// FreeLang v9: Lexer for S-Expression
Object.defineProperty(exports, "__esModule", { value: true });
exports.lex = lex;
const token_1 = require("./token");
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
        // Comment: ;; to end of line
        if (ch === ";" && source[i + 1] === ";") {
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
        // Colon: keyword prefix
        if (ch === ":") {
            const start = i;
            const startCol = col;
            i++;
            col++;
            // Read keyword name
            let keyword = "";
            while (i < source.length && /[a-zA-Z0-9_-]/.test(source[i])) {
                keyword += source[i];
                i++;
                col++;
            }
            if (keyword.length === 0) {
                throw new Error(`Expected keyword name after : at line ${line}, col ${startCol}`);
            }
            tokens.push({ type: token_1.TokenType.Keyword, value: keyword, line, col: startCol });
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
        // Symbol: letters, hyphens, etc.
        if (/[a-zA-Z_<>=!+\-*/]/.test(ch)) {
            const start = i;
            const startCol = col;
            while (i < source.length && /[a-zA-Z0-9_<>=!+\-*/?]/.test(source[i])) {
                i++;
                col++;
            }
            const value = source.slice(start, i);
            tokens.push({ type: token_1.TokenType.Symbol, value, line, col: startCol });
            continue;
        }
        throw new Error(`Unexpected character '${ch}' at line ${line}, col ${col}`);
    }
    tokens.push({ type: token_1.TokenType.EOF, value: "", line, col });
    return tokens;
}
//# sourceMappingURL=lexer.js.map