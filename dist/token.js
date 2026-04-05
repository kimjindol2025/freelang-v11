"use strict";
// FreeLang v9: Token types
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    // Literals
    TokenType["Number"] = "Number";
    TokenType["String"] = "String";
    TokenType["Symbol"] = "Symbol";
    TokenType["Keyword"] = "Keyword";
    TokenType["Variable"] = "Variable";
    // Delimiters
    TokenType["LBracket"] = "LBracket";
    TokenType["RBracket"] = "RBracket";
    TokenType["LParen"] = "LParen";
    TokenType["RParen"] = "RParen";
    // Special
    TokenType["Colon"] = "Colon";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
//# sourceMappingURL=token.js.map