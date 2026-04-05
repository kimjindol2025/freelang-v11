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
        const nodes = [];
        while (!this.isAtEnd()) {
            if (this.check(token_1.TokenType.EOF))
                break;
            // Phase 6: Handle both blocks and S-expressions at top level
            if (this.check(token_1.TokenType.LBracket)) {
                nodes.push(this.parseBlock());
            }
            else if (this.check(token_1.TokenType.LParen)) {
                nodes.push(this.parseSExpr());
            }
            else {
                throw this.error(`Expected block or S-expression, got ${this.peek().type}`, this.peek());
            }
        }
        return nodes;
    }
    // [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
    // Phase 6: BLOCK_TYPE can be Symbol (old) or keyword token (MODULE, TYPECLASS, INSTANCE)
    parseBlock() {
        this.expect(token_1.TokenType.LBracket);
        const typeToken = this.advance();
        let blockType;
        if (typeToken.type === token_1.TokenType.Symbol) {
            blockType = typeToken.value;
        }
        else if (typeToken.type === token_1.TokenType.Module) {
            blockType = "MODULE";
        }
        else if (typeToken.type === token_1.TokenType.TypeClass) {
            blockType = "TYPECLASS";
        }
        else if (typeToken.type === token_1.TokenType.Instance) {
            blockType = "INSTANCE";
        }
        else {
            throw this.error(`Expected block type (symbol or keyword), got ${typeToken.type}`, typeToken);
        }
        const nameToken = this.advance();
        if (nameToken.type !== token_1.TokenType.Symbol) {
            throw this.error(`Expected block name (symbol), got ${nameToken.type}`, nameToken);
        }
        const blockName = nameToken.value;
        const fields = new Map();
        const typeAnnotations = new Map();
        let generics;
        // Parse fields: :key value :key value ... (Phase 6: T.Colon + T.Symbol instead of T.Keyword)
        while (!this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
            // Expect a keyword at the start of each field
            // Phase 6: Accept T.Colon (new) or T.Keyword (backward compat with Phase 5)
            let keyName;
            const startToken = this.peek(); // Save token for error reporting
            if (this.check(token_1.TokenType.Colon)) {
                // Phase 6 syntax: T.Colon + T.Symbol
                this.advance(); // consume ':'
                if (!this.check(token_1.TokenType.Symbol)) {
                    throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
                }
                const keyToken = this.advance();
                keyName = keyToken.value;
            }
            else if (this.check(token_1.TokenType.Keyword)) {
                // Phase 5 backward compatibility: T.Keyword
                const keyToken = this.advance();
                keyName = keyToken.value; // e.g., ":body" or ":params"
                // Remove leading ':' if present
                if (keyName.startsWith(":")) {
                    keyName = keyName.substring(1);
                }
            }
            else {
                throw this.error(`Expected keyword field (starting with :), got ${this.peek().type}`, this.peek());
            }
            // Collect values for this key (parse until next keyword or closing bracket)
            const values = [];
            // Single value case (most common): :key value
            if (!this.check(token_1.TokenType.Keyword) && !this.check(token_1.TokenType.Colon) && !this.check(token_1.TokenType.RBracket)) {
                values.push(this.parseValue());
            }
            // Multiple values case: :key val1 val2 ... (until next keyword/colon or ])
            while (!this.check(token_1.TokenType.Keyword) && !this.check(token_1.TokenType.Colon) && !this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
                values.push(this.parseValue());
            }
            // Store field
            if (values.length === 0) {
                throw this.error(`Expected at least one value for keyword ${keyName}`, startToken);
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
        // Phase 6: If this is a MODULE block, convert it to ModuleBlock
        if (blockType === "MODULE") {
            const block = (0, ast_1.makeBlock)(blockType, blockName, fields);
            return this.convertBlockToModuleBlock(block);
        }
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
    // Phase 6: Convert Block to ModuleBlock
    convertBlockToModuleBlock(block) {
        const exports = [];
        const bodyNodes = [];
        // Extract :exports field (should be an array of symbol names)
        const exportsField = block.fields?.get("exports");
        if (exportsField) {
            if (exportsField.kind === "block" && exportsField.type === "Array") {
                // :exports [name1 name2 ...]
                const items = exportsField.fields?.get("items");
                if (Array.isArray(items)) {
                    items.forEach((item) => {
                        if (item.kind === "literal" && item.type === "symbol") {
                            exports.push(item.value);
                        }
                    });
                }
            }
            else if (exportsField.kind === "literal" && exportsField.type === "symbol") {
                // Single export
                exports.push(exportsField.value);
            }
        }
        // Extract :body field (should be an array of blocks)
        const bodyField = block.fields?.get("body");
        if (bodyField) {
            if (bodyField.kind === "block" && bodyField.type === "Array") {
                // :body [blocks...]
                const items = bodyField.fields?.get("items");
                if (Array.isArray(items)) {
                    bodyNodes.push(...items);
                }
            }
            else if (Array.isArray(bodyField)) {
                // Multiple body items
                bodyNodes.push(...bodyField);
            }
            else {
                // Single body item
                bodyNodes.push(bodyField);
            }
        }
        return {
            kind: "module",
            name: block.name,
            exports,
            body: bodyNodes,
            path: undefined,
        };
    }
    // Parse any value: literal, variable, block, S-expr, pattern-match, or array
    parseValue() {
        // Check for S-expression or match expression: (op arg1 arg2 ...) or (match ...)
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
            const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE"];
            if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === token_1.TokenType.Symbol) {
                const potentialType = this.tokens[nextIdx].value;
                // Check if it's a known block type (uppercase) or looks like a block name followed by a keyword
                const isKnownType = knownBlockTypes.includes(potentialType.toUpperCase());
                const nextNextIdx = nextIdx + 1;
                const hasKeywordAfterName = nextNextIdx < this.tokens.length &&
                    (this.tokens[nextNextIdx].type === token_1.TokenType.Keyword || this.tokens[nextNextIdx].type === token_1.TokenType.Colon);
                if (isKnownType || hasKeywordAfterName) {
                    // It's a block
                    return this.parseBlock();
                }
                else {
                    // It's a value array: [val1 val2 ...]
                    return this.parseArray();
                }
            }
            else if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === token_1.TokenType.Module) {
                // Phase 6: MODULE keyword token
                const result = this.parseBlock();
                // parseBlock() already converts MODULE to ModuleBlock
                if (result.kind === "module") {
                    return result;
                }
                // Should not reach here
                throw this.error(`Expected ModuleBlock from parseBlock with MODULE token`, this.peek());
            }
            else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === token_1.TokenType.TypeClass || this.tokens[nextIdx].type === token_1.TokenType.Instance)) {
                // Phase 6: TYPECLASS/INSTANCE keyword tokens
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
    // Check if next is an array literal (not generic function type args)
    // Array literal: [$x ...] or [1 2 3] or [value ...]
    // Generic syntax: [int string] (all symbols)
    isArrayLiteralStart() {
        if (!this.check(token_1.TokenType.LBracket))
            return false;
        const peekPos = this.pos + 1;
        if (peekPos >= this.tokens.length)
            return false;
        const nextToken = this.tokens[peekPos];
        // If next token is a variable or non-symbol value, it's an array literal
        return nextToken.type === token_1.TokenType.Variable || nextToken.type === token_1.TokenType.Number || nextToken.type === token_1.TokenType.String || nextToken.type === token_1.TokenType.RBracket;
    }
    // Parse S-expression: (op arg1 arg2 ...) or (op[T] arg1 arg2 ...) for generic functions
    // Also handles match expressions: (match value (pattern body) ...)
    // Phase 6: Also handles import and open expressions
    parseSExpr() {
        this.expect(token_1.TokenType.LParen);
        let op;
        const opToken = this.advance();
        // Phase 6: Handle import/open keyword tokens
        if (opToken.type === token_1.TokenType.Import) {
            op = "import";
        }
        else if (opToken.type === token_1.TokenType.Open) {
            op = "open";
        }
        else if (opToken.type !== token_1.TokenType.Symbol) {
            throw this.error(`Expected operator (symbol or keyword) in S-expression, got ${opToken.type}`, opToken);
        }
        else {
            op = opToken.value;
        }
        // Special case: import expressions
        if (op === "import") {
            const importBlock = this.parseImportExpression();
            this.expect(token_1.TokenType.RParen);
            return importBlock;
        }
        // Special case: open expressions
        if (op === "open") {
            const openBlock = this.parseOpenExpression();
            this.expect(token_1.TokenType.RParen);
            return openBlock;
        }
        // Special case: match expressions
        if (op === "match") {
            const matchExpr = this.parsePatternMatch();
            this.expect(token_1.TokenType.RParen);
            return matchExpr;
        }
        // Special case: certain operators always use array literal syntax
        // Never generic function syntax: fn, let, if, cond, match, etc.
        const specialFormsForbiddingGeneric = new Set([
            "fn", "let", "if", "cond", "match", "do", "try", "catch",
            "let*", "letrec", "define"
        ]);
        if (!specialFormsForbiddingGeneric.has(op) && this.check(token_1.TokenType.LBracket) && !this.isArrayLiteralStart()) {
            // Phase 4: Handle generic function syntax: (identity[int] ...) or (fn[T] ...)
            // But not array literals: (fn [$x] ...) - those are parsed as regular values
            this.advance(); // consume [
            const typeArgs = [];
            while (!this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
                const typeToken = this.advance();
                if (typeToken.type === token_1.TokenType.Symbol) {
                    typeArgs.push(typeToken.value);
                }
                // Skip commas if present
                if (this.check(token_1.TokenType.Symbol) && this.peek().value === ",") {
                    this.advance();
                }
            }
            this.expect(token_1.TokenType.RBracket);
            // Build generic function name: identity[int] or first-of-pair[int string]
            if (typeArgs.length > 0) {
                op = `${op}[${typeArgs.join(", ")}]`;
            }
        }
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
    // ===== Pattern Matching (Phase 4 Week 3-4) =====
    // Parse pattern: literal, variable, wildcard, list, struct, or or-pattern
    parsePattern() {
        const firstPattern = this.parseAtomicPattern();
        // Check for or-pattern: pat1 | pat2 | pat3
        if (this.check(token_1.TokenType.Symbol) && this.peek().value === "|") {
            const alternatives = [firstPattern];
            while (this.check(token_1.TokenType.Symbol) && this.peek().value === "|") {
                this.advance(); // consume |
                alternatives.push(this.parseAtomicPattern());
            }
            return (0, ast_1.makeOrPattern)(alternatives);
        }
        return firstPattern;
    }
    // Parse atomic pattern (without or-alternatives)
    parseAtomicPattern() {
        // Wildcard pattern: _
        if (this.check(token_1.TokenType.Symbol) && this.peek().value === "_") {
            this.advance();
            return (0, ast_1.makeWildcardPattern)();
        }
        // Variable pattern: x, y, name (but not |, &, etc)
        if (this.check(token_1.TokenType.Symbol) && !["&", "|"].includes(this.peek().value)) {
            const nameToken = this.advance();
            return (0, ast_1.makeVariablePattern)(nameToken.value);
        }
        // Literal pattern: number, string, boolean
        if (this.check(token_1.TokenType.Number)) {
            const token = this.advance();
            return (0, ast_1.makeLiteralPattern)("number", parseFloat(token.value));
        }
        if (this.check(token_1.TokenType.String)) {
            const token = this.advance();
            return (0, ast_1.makeLiteralPattern)("string", token.value);
        }
        // List pattern: [x y z] or [x & rest]
        if (this.check(token_1.TokenType.LBracket)) {
            this.advance(); // consume [
            const elements = [];
            let restElement;
            while (!this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
                // Check for rest element: & name
                if (this.check(token_1.TokenType.Symbol) && this.peek().value === "&") {
                    this.advance(); // consume &
                    if (this.check(token_1.TokenType.Symbol)) {
                        const nameToken = this.advance();
                        restElement = nameToken.value;
                    }
                    break; // rest element must be last
                }
                elements.push(this.parsePattern());
            }
            this.expect(token_1.TokenType.RBracket);
            return (0, ast_1.makeListPattern)(elements, restElement);
        }
        // Struct pattern: {:name :age} (not fully implemented yet)
        if (this.check(token_1.TokenType.Keyword)) {
            const fields = new Map();
            while (this.check(token_1.TokenType.Keyword) && !this.isAtEnd()) {
                const keyToken = this.advance();
                const fieldName = keyToken.value; // e.g., ":name"
                const pattern = this.parsePattern();
                fields.set(fieldName, pattern);
            }
            return (0, ast_1.makeStructPattern)(fields);
        }
        throw this.error(`Expected pattern, got ${this.peek().type}`, this.peek());
    }
    // Parse match expression: (match value (pattern body) (pattern body) ... [default])
    // Note: Opening paren '(' already consumed by parseSExpr
    parsePatternMatch() {
        // 'match' keyword already consumed by parseSExpr
        // Just parse the value to match and cases
        // Parse value to match
        const value = this.parseValue();
        // Parse cases: (pattern body) (pattern body) ...
        const cases = [];
        let defaultCase;
        while (this.check(token_1.TokenType.LParen) && !this.isAtEnd()) {
            this.advance(); // consume (
            // Check for default case: (default body)
            if (this.check(token_1.TokenType.Symbol) && this.peek().value === "default") {
                this.advance(); // consume 'default'
                defaultCase = this.parseValue();
                this.expect(token_1.TokenType.RParen);
                break; // default must be last
            }
            // Parse pattern
            const pattern = this.parsePattern();
            // Check for optional guard: (if condition)
            let guard;
            if (this.check(token_1.TokenType.LParen) && this.peekNext()?.value === "if") {
                this.advance(); // consume (
                this.advance(); // consume 'if'
                guard = this.parseValue();
                this.expect(token_1.TokenType.RParen);
            }
            // Parse body
            const body = this.parseValue();
            cases.push((0, ast_1.makeMatchCase)(pattern, body, guard));
            this.expect(token_1.TokenType.RParen);
        }
        // Note: Closing paren will be consumed by parseSExpr
        return (0, ast_1.makePatternMatch)(value, cases, defaultCase);
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
    // Phase 6: Parse import expression (import math :from "./math.fl" :as m :only [add])
    parseImportExpression() {
        // Module name is next (qualified identifier: math or a:b or a:b:c)
        const moduleName = this.parseQualifiedIdentifier();
        // Parse optional clauses: :from, :only, :as
        let source;
        let selective;
        let alias;
        while (!this.check(token_1.TokenType.RParen) && !this.isAtEnd()) {
            if (this.check(token_1.TokenType.Colon)) {
                this.advance(); // consume ':'
                if (!this.check(token_1.TokenType.Symbol)) {
                    throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
                }
                const clauseName = this.advance().value;
                switch (clauseName) {
                    case "from":
                        // :from "path"
                        if (!this.check(token_1.TokenType.String)) {
                            throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
                        }
                        source = this.advance().value;
                        break;
                    case "only":
                        // :only [func1 func2 ...]
                        if (!this.check(token_1.TokenType.LBracket)) {
                            throw this.error(`Expected [ after :only, got ${this.peek().type}`, this.peek());
                        }
                        selective = this.parseSelectiveImport();
                        break;
                    case "as":
                        // :as alias
                        if (!this.check(token_1.TokenType.Symbol)) {
                            throw this.error(`Expected symbol after :as, got ${this.peek().type}`, this.peek());
                        }
                        alias = this.advance().value;
                        break;
                    default:
                        throw this.error(`Unknown import clause: ${clauseName}`, this.peek());
                }
            }
            else {
                throw this.error(`Expected ':' in import expression, got ${this.peek().type}`, this.peek());
            }
        }
        return (0, ast_1.makeImportBlock)(moduleName, source, selective, alias);
    }
    // Phase 6: Parse open expression (open math :from "./math.fl")
    parseOpenExpression() {
        // Module name is next (qualified identifier)
        const moduleName = this.parseQualifiedIdentifier();
        // Parse optional :from clause
        let source;
        while (!this.check(token_1.TokenType.RParen) && !this.isAtEnd()) {
            if (this.check(token_1.TokenType.Colon)) {
                this.advance(); // consume ':'
                if (!this.check(token_1.TokenType.Symbol)) {
                    throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
                }
                const clauseName = this.advance().value;
                if (clauseName === "from") {
                    if (!this.check(token_1.TokenType.String)) {
                        throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
                    }
                    source = this.advance().value;
                }
                else {
                    throw this.error(`Unknown open clause: ${clauseName}`, this.peek());
                }
            }
            else {
                throw this.error(`Expected ':' in open expression, got ${this.peek().type}`, this.peek());
            }
        }
        return (0, ast_1.makeOpenBlock)(moduleName, source);
    }
    // Phase 6: Parse qualified identifier (math or math:add or utils:double:helper)
    // IMPORTANT: Stop when encountering keyword colons like :from, :as, :only
    parseQualifiedIdentifier() {
        if (!this.check(token_1.TokenType.Symbol)) {
            throw this.error(`Expected symbol, got ${this.peek().type}`, this.peek());
        }
        const parts = [];
        parts.push(this.advance().value);
        // Keyword colons that should NOT be consumed as part of qualified identifiers
        const keywordColons = new Set(["from", "as", "only", "to", "body", "params", "exports"]);
        // Check for additional parts separated by colons
        while (this.check(token_1.TokenType.Colon)) {
            // Peek ahead to see if the next symbol is a keyword
            const peekPos = this.pos + 1;
            if (peekPos >= this.tokens.length)
                break;
            const nextToken = this.tokens[peekPos];
            // If next token is a keyword, stop parsing qualified identifier
            if (nextToken.type === token_1.TokenType.Symbol && keywordColons.has(nextToken.value)) {
                break;
            }
            this.advance(); // consume ':'
            if (!this.check(token_1.TokenType.Symbol)) {
                throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
            }
            parts.push(this.advance().value);
        }
        return parts.join(":");
    }
    // Phase 6: Parse selective import list: [func1 func2 ...]
    parseSelectiveImport() {
        this.expect(token_1.TokenType.LBracket);
        const names = [];
        while (!this.check(token_1.TokenType.RBracket) && !this.isAtEnd()) {
            if (!this.check(token_1.TokenType.Symbol)) {
                throw this.error(`Expected symbol in import list, got ${this.peek().type}`, this.peek());
            }
            names.push(this.advance().value);
        }
        this.expect(token_1.TokenType.RBracket);
        return names;
    }
}
exports.Parser = Parser;
function parse(tokens) {
    const parser = new Parser(tokens);
    return parser.parse();
}
//# sourceMappingURL=parser.js.map