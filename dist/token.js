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
    TokenType["LBrace"] = "LBrace";
    TokenType["RBrace"] = "RBrace";
    // Phase 6 Keywords
    TokenType["Module"] = "Module";
    TokenType["TypeClass"] = "TypeClass";
    TokenType["Instance"] = "Instance";
    TokenType["Import"] = "Import";
    TokenType["Open"] = "Open";
    // Phase 9a Keywords (Search)
    TokenType["Search"] = "Search";
    TokenType["Fetch"] = "Fetch";
    TokenType["Browse"] = "Browse";
    TokenType["Cache"] = "Cache";
    // Phase 9b Keywords (Learning)
    TokenType["Learn"] = "Learn";
    TokenType["Recall"] = "Recall";
    TokenType["Remember"] = "Remember";
    TokenType["Forget"] = "Forget";
    // Phase 9c Keywords (Reasoning)
    TokenType["Observe"] = "Observe";
    TokenType["Analyze"] = "Analyze";
    TokenType["Decide"] = "Decide";
    TokenType["Act"] = "Act";
    TokenType["Verify"] = "Verify";
    // Phase 9c Keywords (Conditional)
    TokenType["If"] = "If";
    TokenType["When"] = "When";
    TokenType["Then"] = "Then";
    TokenType["Else"] = "Else";
    // Phase 9c Keywords (Loop Control)
    TokenType["Repeat"] = "Repeat";
    TokenType["Until"] = "Until";
    TokenType["While"] = "While";
    // Special
    TokenType["Colon"] = "Colon";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
//# sourceMappingURL=token.js.map