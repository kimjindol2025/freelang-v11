"use strict";
// FreeLang v9: Parser
// Token[] → AST (Block[])
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = exports.ParserError = void 0;
exports.parse = parse;
const token_1 = require("./token");
const ast_1 = require("./ast");
class ParserError extends Error {
    constructor(message, line, col) {
        super(`[${line}:${col}] ${message}`);
        this.line = line;
        this.col = col;
    }
}
exports.ParserError = ParserError;
class Parser {
    constructor(tokens) {
        this.pos = 0;
        this.tokens = tokens;
    }
    parse() {
        const blocks = [];
        while (!this.isAtEnd()) {
            if (this.check(token_1.TokenType.EOF))
                break;
            blocks.push(this.parseBlock());
        }
        return blocks;
    }
    // [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
    parseBlock() {
        this.expect(token_1.TokenType.LBracket);
        const typeToken = this.advance();
        if (typeToken.type !== token_1.TokenType.Symbol) {
            throw this.error(`Expected block type (symbol), got ${typeToken.type}`, typeToken);
        }
        const blockType = typeToken.value;
        const nameToken = this.advance();
        if (nameToken.type !== token_1.TokenType.Symbol) {
            throw this.error(`Expected block name (symbol), got ${nameToken.type}`, nameToken);
        }
        const blockName = nameToken.value;
        const fields = new Map();
        const typeAnnotations = new Map();
        let generics;
        // Parse fields: :key value :key value ...
        while (!this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
            // Expect a keyword at the start of each field
            if (!this.check(token_1.TokenType.Keyword)) {
                throw this.error(`Expected keyword field (starting with :), got ${this.peek().type}`, this.peek());
            }
            const keyToken = this.advance();
            const keyName = keyToken.value; // e.g., ":body" or ":params"
            // Collect values for this key (parse until next keyword or closing bracket)
            const values = [];
            // Single value case (most common): :key value
            if (!this.check(token_1.TokenType.Keyword) && !this.check(token_1.TokenType.RBracket)) {
                values.push(this.parseValue());
            }
            // Multiple values case: :key val1 val2 ... (until next keyword or ])
            while (!this.check(token_1.TokenType.Keyword) && !this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
                values.push(this.parseValue());
            }
            // Store field
            if (values.length === 0) {
                throw this.error(`Expected at least one value for keyword ${keyName}`, keyToken);
            }
            else if (values.length === 1) {
                fields.set(keyName, values[0]);
            }
            else {
                fields.set(keyName, values);
            }
            // Phase 3: Extract type annotations from :return field
            if (keyName === "return" && values.length === 1) {
                const returnValue = values[0];
                if (returnValue.kind === "literal" && returnValue.type === "symbol") {
                    const typeName = returnValue.value;
                    typeAnnotations.set("return", (0, ast_1.makeTypeAnnotation)(typeName));
                }
            }
            // Phase 4: Extract generic type variables from :generics field (new syntax: [T K V])
            if (keyName === "generics" && values.length === 1) {
                const genericsValue = values[0];
                if (genericsValue.kind === "block" && genericsValue.type === "Array") {
                    // :generics [T K V]
                    const arrayItems = genericsValue.fields?.get("items");
                    if (Array.isArray(arrayItems)) {
                        const gen = [];
                        for (const item of arrayItems) {
                            if (item.kind === "literal" && item.type === "symbol") {
                                gen.push(item.value);
                            }
                        }
                        if (gen.length > 0) {
                            generics = gen;
                        }
                    }
                }
            }
            // Phase 3: Extract type annotations from :params field (new syntax: [[$x int] [$y int]])
            if (keyName === "params" && values.length === 1) {
                const paramsValue = values[0];
                // Check if it's an array (represented as Block with type="Array")
                if (paramsValue.kind === "literal" && paramsValue.type === "symbol") {
                    // Old syntax: :params [$x $y] (no types)
                    // Keep backward compatibility - no type annotation
                }
                else if (paramsValue.kind === "block" && paramsValue.type === "Array") {
                    // New syntax: :params [[$x int] [$y int]]
                    // Each item should be [name type] array
                    const arrayItems = paramsValue.fields?.get("items");
                    if (Array.isArray(arrayItems)) {
                        const paramTypes = [];
                        for (const item of arrayItems) {
                            if (item.kind === "block" && item.type === "Array") {
                                // This is a [name type] pair
                                const pairItems = item.fields?.get("items");
                                if (Array.isArray(pairItems) && pairItems.length === 2) {
                                    // pairItems[0] = name ($x), pairItems[1] = type (int)
                                    const typeNode = pairItems[1];
                                    if (typeNode.kind === "literal" && typeNode.type === "symbol") {
                                        const typeName = typeNode.value;
                                        paramTypes.push((0, ast_1.makeTypeAnnotation)(typeName));
                                    }
                                }
                            }
                        }
                        if (paramTypes.length > 0) {
                            // Store params as array of types
                            typeAnnotations.set("params", paramTypes);
                        }
                    }
                }
            }
        }
        this.expect(token_1.TokenType.RBracket);
        const block = (0, ast_1.makeBlock)(blockType, blockName, fields);
        // Phase 3: Always set typeAnnotations (even if empty) for consistent handling
        // FUNC blocks without :return/:params annotations still need to be registered with default types
        if (blockType === "FUNC" || typeAnnotations.size > 0) {
            block.typeAnnotations = typeAnnotations;
        }
        // Phase 4: Set generics if provided
        if (generics && generics.length > 0) {
            block.generics = generics;
        }
        return block;
    }
    // Parse any value: literal, variable, block, S-expr, or array
    parseValue() {
        // Check for S-expression: (op arg1 arg2 ...)
        if (this.check(token_1.TokenType.LParen)) {
            return this.parseSExpr();
        }
        // Check for literal number
        if (this.check(token_1.TokenType.Number)) {
            const token = this.advance();
            return (0, ast_1.makeLiteral)("number", parseFloat(token.value));
        }
        // Check for literal string
        if (this.check(token_1.TokenType.String)) {
            const token = this.advance();
            return (0, ast_1.makeLiteral)("string", token.value);
        }
        // Check for variable: $name
        if (this.check(token_1.TokenType.Variable)) {
            const token = this.advance();
            return (0, ast_1.makeVariable)(token.value);
        }
        // Check for keyword: :name (can appear as value in S-expressions)
        if (this.check(token_1.TokenType.Keyword)) {
            const token = this.advance();
            return (0, ast_1.makeKeyword)(token.value);
        }
        // Check for block: [TYPE ...]
        if (this.check(token_1.TokenType.LBracket)) {
            // Lookahead: is this a block or value array?
            const nextIdx = this.pos + 1;
            if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === token_1.TokenType.Symbol) {
                // It's a block
                return this.parseBlock();
            }
            else {
                // It's a value array: [val1 val2 ...]
                return this.parseArray();
            }
        }
        // Check for symbol (including keywords used as values)
        if (this.check(token_1.TokenType.Symbol)) {
            const token = this.advance();
            return (0, ast_1.makeLiteral)("symbol", token.value);
        }
        throw this.error(`Unexpected token: ${this.peek().type}`, this.peek());
    }
    // Parse array: [val1 val2 val3 ...]
    parseArray() {
        this.expect(token_1.TokenType.LBracket);
        const values = [];
        while (!this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
            values.push(this.parseValue());
        }
        this.expect(token_1.TokenType.RBracket);
        // Return as synthetic block-like structure
        // Actually, arrays in v9 are represented as special blocks
        const arrayFields = new Map();
        arrayFields.set("items", values);
        return (0, ast_1.makeBlock)("Array", "$array", arrayFields);
    }
    // Parse S-expression: (op arg1 arg2 ...)
    parseSExpr() {
        this.expect(token_1.TokenType.LParen);
        const opToken = this.advance();
        if (opToken.type !== token_1.TokenType.Symbol) {
            throw this.error(`Expected operator (symbol) in S-expression, got ${opToken.type}`, opToken);
        }
        const op = opToken.value;
        const args = [];
        while (!this.check(token_1.TokenType.RParen) && !this.isAtEnd()) {
            args.push(this.parseValue());
        }
        this.expect(token_1.TokenType.RParen);
        return (0, ast_1.makeSExpr)(op, args);
    }
    // Parse type annotation: int, string, bool, array<T>, map<K,V>, T?
    parseTypeAnnotation() {
        const token = this.advance();
        if (token.type !== token_1.TokenType.Symbol) {
            throw this.error(`Expected type annotation (symbol), got ${token.type}`, token);
        }
        let typeName = token.value;
        let generic = undefined;
        let optional = false;
        // Handle optional type: T?
        if (this.check(token_1.TokenType.Symbol) && this.peek().value === "?") {
            this.advance();
            optional = true;
        }
        // Handle generic types: array<T>, map<K,V>
        if (typeName.includes("<") && typeName.includes(">")) {
            // Simple parsing: extract inner type (e.g., "array<int>" → "int")
            const match = typeName.match(/<(.+)>/);
            if (match) {
                const innerTypeName = match[1];
                generic = (0, ast_1.makeTypeAnnotation)(innerTypeName);
                typeName = typeName.substring(0, typeName.indexOf("<"));
            }
        }
        return (0, ast_1.makeTypeAnnotation)(typeName, generic, undefined, optional);
    }
    // ===== Utility Methods =====
    peek() {
        if (this.pos >= this.tokens.length) {
            return this.tokens[this.tokens.length - 1]; // EOF
        }
        return this.tokens[this.pos];
    }
    peekNext() {
        if (this.pos + 1 >= this.tokens.length)
            return null;
        return this.tokens[this.pos + 1];
    }
    advance() {
        if (this.pos < this.tokens.length)
            this.pos++;
        return this.tokens[this.pos - 1];
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    expect(type) {
        if (this.check(type)) {
            return this.advance();
        }
        const token = this.peek();
        throw this.error(`Expected ${type}, got ${token.type}`, token);
    }
    isAtEnd() {
        return this.pos >= this.tokens.length;
    }
    error(message, token) {
        return new ParserError(message, token.line, token.col);
    }
    // Synchronization for error recovery
    synchronize() {
        this.advance();
        while (!this.isAtEnd()) {
            if (this.check(token_1.TokenType.LBracket))
                return; // Next block start
            this.advance();
        }
    }
}
exports.Parser = Parser;
function parse(tokens) {
    const parser = new Parser(tokens);
    return parser.parse();
}
//# sourceMappingURL=parser.js.map