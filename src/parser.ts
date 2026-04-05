// FreeLang v9: Parser
// Token[] → AST (Block[])

import { Token, TokenType as T } from "./token";
import {
  ASTNode,
  Block,
  Literal,
  Variable,
  SExpr,
  Keyword,
  TypeAnnotation,
  TypeVariable,
  Pattern,
  PatternMatch,
  MatchCase,
  ModuleBlock,
  ImportBlock,
  OpenBlock,
  makeBlock,
  makeLiteral,
  makeVariable,
  makeSExpr,
  makeKeyword,
  makeTypeAnnotation,
  makeTypeVariable,
  makeLiteralPattern,
  makeVariablePattern,
  makeWildcardPattern,
  makeListPattern,
  makeStructPattern,
  makeOrPattern,
  makeMatchCase,
  makePatternMatch,
  makeModuleBlock,
  makeImportBlock,
  makeOpenBlock,
} from "./ast";

export class ParserError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number
  ) {
    super(`[${line}:${col}] ${message}`);
  }
}

export class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode[] {
    const nodes: ASTNode[] = [];
    while (!this.isAtEnd()) {
      if (this.check(T.EOF)) break;

      // Phase 6: Handle both blocks and S-expressions at top level
      if (this.check(T.LBracket)) {
        nodes.push(this.parseBlock());
      } else if (this.check(T.LParen)) {
        nodes.push(this.parseSExpr());
      } else {
        throw this.error(
          `Expected block or S-expression, got ${this.peek().type}`,
          this.peek()
        );
      }
    }
    return nodes;
  }

  // [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
  // Phase 6: BLOCK_TYPE can be Symbol (old) or keyword token (MODULE, TYPECLASS, INSTANCE)
  private parseBlock(): Block | ModuleBlock {
    this.expect(T.LBracket);
    const typeToken = this.advance();

    let blockType: string;
    if (typeToken.type === T.Symbol) {
      blockType = typeToken.value;
    } else if (typeToken.type === T.Module) {
      blockType = "MODULE";
    } else if (typeToken.type === T.TypeClass) {
      blockType = "TYPECLASS";
    } else if (typeToken.type === T.Instance) {
      blockType = "INSTANCE";
    } else {
      throw this.error(`Expected block type (symbol or keyword), got ${typeToken.type}`, typeToken);
    }

    const nameToken = this.advance();
    if (nameToken.type !== T.Symbol) {
      throw this.error(`Expected block name (symbol), got ${nameToken.type}`, nameToken);
    }
    const blockName = nameToken.value;

    const fields = new Map<string, ASTNode | ASTNode[]>();
    const typeAnnotations = new Map<string, TypeAnnotation>();
    let generics: string[] | undefined;

    // Parse fields: :key value :key value ... (Phase 6: T.Colon + T.Symbol instead of T.Keyword)
    while (!this.check(T.RBracket) && !this.isAtEnd()) {
      // Expect a keyword at the start of each field
      // Phase 6: Accept T.Colon (new) or T.Keyword (backward compat with Phase 5)
      let keyName: string;
      const startToken = this.peek(); // Save token for error reporting

      if (this.check(T.Colon)) {
        // Phase 6 syntax: T.Colon + T.Symbol
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(
            `Expected symbol after ':', got ${this.peek().type}`,
            this.peek()
          );
        }
        const keyToken = this.advance();
        keyName = keyToken.value;
      } else if (this.check(T.Keyword)) {
        // Phase 5 backward compatibility: T.Keyword
        const keyToken = this.advance();
        keyName = keyToken.value; // e.g., ":body" or ":params"
        // Remove leading ':' if present
        if (keyName.startsWith(":")) {
          keyName = keyName.substring(1);
        }
      } else {
        throw this.error(
          `Expected keyword field (starting with :), got ${this.peek().type}`,
          this.peek()
        );
      }

      // Collect values for this key (parse until next keyword or closing bracket)
      const values: ASTNode[] = [];

      // Single value case (most common): :key value
      if (!this.check(T.Keyword) && !this.check(T.Colon) && !this.check(T.RBracket)) {
        values.push(this.parseValue());
      }

      // Multiple values case: :key val1 val2 ... (until next keyword/colon or ])
      while (!this.check(T.Keyword) && !this.check(T.Colon) && !this.check(T.RBracket) && !this.isAtEnd()) {
        values.push(this.parseValue());
      }

      // Store field
      if (values.length === 0) {
        throw this.error(`Expected at least one value for keyword ${keyName}`, startToken);
      } else if (values.length === 1) {
        fields.set(keyName, values[0]);
      } else {
        fields.set(keyName, values);
      }

      // Phase 3: Extract type annotations from :return field
      if (keyName === "return" && values.length === 1) {
        const returnValue = values[0];
        if ((returnValue as any).kind === "literal" && (returnValue as any).type === "symbol") {
          const typeName = (returnValue as any).value;
          typeAnnotations.set("return", makeTypeAnnotation(typeName));
        }
      }

      // Phase 4: Extract generic type variables from :generics field (new syntax: [T K V])
      if (keyName === "generics" && values.length === 1) {
        const genericsValue = values[0];
        if ((genericsValue as any).kind === "block" && (genericsValue as any).type === "Array") {
          // :generics [T K V]
          const arrayItems = (genericsValue as any).fields?.get("items") as ASTNode[];
          if (Array.isArray(arrayItems)) {
            const gen: string[] = [];
            for (const item of arrayItems) {
              if ((item as any).kind === "literal" && (item as any).type === "symbol") {
                gen.push((item as any).value);
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
        if ((paramsValue as any).kind === "literal" && (paramsValue as any).type === "symbol") {
          // Old syntax: :params [$x $y] (no types)
          // Keep backward compatibility - no type annotation
        } else if ((paramsValue as any).kind === "block" && (paramsValue as any).type === "Array") {
          // New syntax: :params [[$x int] [$y int]]
          // Each item should be [name type] array
          const arrayItems = (paramsValue as any).fields?.get("items") as ASTNode[];
          if (Array.isArray(arrayItems)) {
            const paramTypes: TypeAnnotation[] = [];
            for (const item of arrayItems) {
              if ((item as any).kind === "block" && (item as any).type === "Array") {
                // This is a [name type] pair
                const pairItems = (item as any).fields?.get("items") as ASTNode[];
                if (Array.isArray(pairItems) && pairItems.length === 2) {
                  // pairItems[0] = name ($x), pairItems[1] = type (int)
                  const typeNode = pairItems[1];
                  if ((typeNode as any).kind === "literal" && (typeNode as any).type === "symbol") {
                    const typeName = (typeNode as any).value;
                    paramTypes.push(makeTypeAnnotation(typeName));
                  }
                }
              }
            }
            if (paramTypes.length > 0) {
              // Store params as array of types
              typeAnnotations.set("params", paramTypes as any);
            }
          }
        }
      }
    }

    this.expect(T.RBracket);

    // Phase 6: If this is a MODULE block, convert it to ModuleBlock
    if (blockType === "MODULE") {
      const block = makeBlock(blockType, blockName, fields);
      return this.convertBlockToModuleBlock(block);
    }

    const block = makeBlock(blockType, blockName, fields);
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
  private convertBlockToModuleBlock(block: Block): ModuleBlock {
    const exports: string[] = [];
    const bodyNodes: ASTNode[] = [];

    // Extract :exports field (should be an array of symbol names)
    const exportsField = block.fields?.get("exports");
    if (exportsField) {
      if ((exportsField as any).kind === "block" && (exportsField as any).type === "Array") {
        // :exports [name1 name2 ...]
        const items = (exportsField as any).fields?.get("items") as ASTNode[];
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if ((item as any).kind === "literal" && (item as any).type === "symbol") {
              exports.push((item as any).value);
            }
          });
        }
      } else if ((exportsField as any).kind === "literal" && (exportsField as any).type === "symbol") {
        // Single export
        exports.push((exportsField as any).value);
      }
    }

    // Extract :body field (should be an array of blocks)
    const bodyField = block.fields?.get("body");
    if (bodyField) {
      if ((bodyField as any).kind === "block" && (bodyField as any).type === "Array") {
        // :body [blocks...]
        const items = (bodyField as any).fields?.get("items") as ASTNode[];
        if (Array.isArray(items)) {
          bodyNodes.push(...items);
        }
      } else if (Array.isArray(bodyField)) {
        // Multiple body items
        bodyNodes.push(...(bodyField as ASTNode[]));
      } else {
        // Single body item
        bodyNodes.push(bodyField as ASTNode);
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
  private parseValue(): ASTNode {
    // Check for S-expression or match expression: (op arg1 arg2 ...) or (match ...)
    if (this.check(T.LParen)) {
      return this.parseSExpr();
    }

    // Check for literal number
    if (this.check(T.Number)) {
      const token = this.advance();
      return makeLiteral("number", parseFloat(token.value));
    }

    // Check for literal string
    if (this.check(T.String)) {
      const token = this.advance();
      return makeLiteral("string", token.value);
    }

    // Check for variable: $name
    if (this.check(T.Variable)) {
      const token = this.advance();
      return makeVariable(token.value);
    }

    // Check for keyword: :name (can appear as value in S-expressions)
    if (this.check(T.Keyword)) {
      const token = this.advance();
      return makeKeyword(token.value);
    }

    // Check for block: [TYPE ...]
    if (this.check(T.LBracket)) {
      // Lookahead: is this a block or value array?
      const nextIdx = this.pos + 1;
      const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE"];


      if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === T.Symbol) {
        const potentialType = this.tokens[nextIdx].value;
        // Check if it's a known block type (uppercase) or looks like a block name followed by a keyword
        const isKnownType = knownBlockTypes.includes(potentialType.toUpperCase());
        const nextNextIdx = nextIdx + 1;
        const hasKeywordAfterName = nextNextIdx < this.tokens.length &&
          (this.tokens[nextNextIdx].type === T.Keyword || this.tokens[nextNextIdx].type === T.Colon);

        if (isKnownType || hasKeywordAfterName) {
          // It's a block
          return this.parseBlock();
        } else {
          // It's a value array: [val1 val2 ...]
          return this.parseArray();
        }
      } else if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === T.Module) {
        // Phase 6: MODULE keyword token
        const result = this.parseBlock();
        // parseBlock() already converts MODULE to ModuleBlock
        if (result.kind === "module") {
          return result;
        }
        // Should not reach here
        throw this.error(`Expected ModuleBlock from parseBlock with MODULE token`, this.peek());
      } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === T.TypeClass || this.tokens[nextIdx].type === T.Instance)) {
        // Phase 6: TYPECLASS/INSTANCE keyword tokens
        return this.parseBlock();
      } else {
        // It's a value array: [val1 val2 ...]
        return this.parseArray();
      }
    }

    // Check for symbol (including keywords used as values)
    if (this.check(T.Symbol)) {
      const token = this.advance();
      return makeLiteral("symbol", token.value);
    }

    throw this.error(`Unexpected token: ${this.peek().type}`, this.peek());
  }

  // Parse array: [val1 val2 val3 ...]
  private parseArray(): ASTNode {
    this.expect(T.LBracket);
    const values: ASTNode[] = [];
    while (!this.check(T.RBracket) && !this.isAtEnd()) {
      values.push(this.parseValue());
    }
    this.expect(T.RBracket);
    // Return as synthetic block-like structure
    // Actually, arrays in v9 are represented as special blocks
    const arrayFields = new Map<string, ASTNode | ASTNode[]>();
    arrayFields.set("items", values);
    return makeBlock("Array", "$array", arrayFields);
  }

  // Check if next is an array literal (not generic function type args)
  // Array literal: [$x ...] or [1 2 3] or [value ...]
  // Generic syntax: [int string] (all symbols)
  private isArrayLiteralStart(): boolean {
    if (!this.check(T.LBracket)) return false;
    const peekPos = this.pos + 1;
    if (peekPos >= this.tokens.length) return false;
    const nextToken = this.tokens[peekPos];
    // If next token is a variable or non-symbol value, it's an array literal
    return nextToken.type === T.Variable || nextToken.type === T.Number || nextToken.type === T.String || nextToken.type === T.RBracket;
  }

  // Parse S-expression: (op arg1 arg2 ...) or (op[T] arg1 arg2 ...) for generic functions
  // Also handles match expressions: (match value (pattern body) ...)
  // Phase 6: Also handles import and open expressions
  private parseSExpr(): SExpr | PatternMatch | ImportBlock | OpenBlock {
    this.expect(T.LParen);

    let op: string;
    const opToken = this.advance();

    // Phase 6: Handle import/open keyword tokens
    if (opToken.type === T.Import) {
      op = "import";
    } else if (opToken.type === T.Open) {
      op = "open";
    } else if (opToken.type !== T.Symbol) {
      throw this.error(`Expected operator (symbol or keyword) in S-expression, got ${opToken.type}`, opToken);
    } else {
      op = opToken.value;
    }

    // Special case: import expressions
    if (op === "import") {
      const importBlock = this.parseImportExpression();
      this.expect(T.RParen);
      return importBlock;
    }

    // Special case: open expressions
    if (op === "open") {
      const openBlock = this.parseOpenExpression();
      this.expect(T.RParen);
      return openBlock;
    }

    // Special case: match expressions
    if (op === "match") {
      const matchExpr = this.parsePatternMatch();
      this.expect(T.RParen);
      return matchExpr;
    }

    // Special case: certain operators always use array literal syntax
    // Never generic function syntax: fn, let, if, cond, match, etc.
    const specialFormsForbiddingGeneric = new Set([
      "fn", "let", "if", "cond", "match", "do", "try", "catch",
      "let*", "letrec", "define"
    ]);

    if (!specialFormsForbiddingGeneric.has(op) && this.check(T.LBracket) && !this.isArrayLiteralStart()) {
      // Phase 4: Handle generic function syntax: (identity[int] ...) or (fn[T] ...)
      // But not array literals: (fn [$x] ...) - those are parsed as regular values
      this.advance(); // consume [
      const typeArgs: string[] = [];

      while (!this.check(T.RBracket) && !this.isAtEnd()) {
        const typeToken = this.advance();
        if (typeToken.type === T.Symbol) {
          typeArgs.push(typeToken.value);
        }
        // Skip commas if present
        if (this.check(T.Symbol) && this.peek().value === ",") {
          this.advance();
        }
      }

      this.expect(T.RBracket);

      // Build generic function name: identity[int] or first-of-pair[int string]
      if (typeArgs.length > 0) {
        op = `${op}[${typeArgs.join(", ")}]`;
      }
    }

    const args: ASTNode[] = [];
    while (!this.check(T.RParen) && !this.isAtEnd()) {
      args.push(this.parseValue());
    }

    this.expect(T.RParen);
    return makeSExpr(op, args);
  }

  // Parse type annotation: int, string, bool, array<T>, map<K,V>, T?
  private parseTypeAnnotation(): TypeAnnotation {
    const token = this.advance();
    if (token.type !== T.Symbol) {
      throw this.error(`Expected type annotation (symbol), got ${token.type}`, token);
    }

    let typeName = token.value;
    let generic: TypeAnnotation | undefined = undefined;
    let optional = false;

    // Handle optional type: T?
    if (this.check(T.Symbol) && this.peek().value === "?") {
      this.advance();
      optional = true;
    }

    // Handle generic types: array<T>, map<K,V>
    if (typeName.includes("<") && typeName.includes(">")) {
      // Simple parsing: extract inner type (e.g., "array<int>" → "int")
      const match = typeName.match(/<(.+)>/);
      if (match) {
        const innerTypeName = match[1];
        generic = makeTypeAnnotation(innerTypeName);
        typeName = typeName.substring(0, typeName.indexOf("<"));
      }
    }

    return makeTypeAnnotation(typeName, generic, undefined, optional);
  }

  // ===== Pattern Matching (Phase 4 Week 3-4) =====

  // Parse pattern: literal, variable, wildcard, list, struct, or or-pattern
  private parsePattern(): Pattern {
    const firstPattern = this.parseAtomicPattern();

    // Check for or-pattern: pat1 | pat2 | pat3
    if (this.check(T.Symbol) && this.peek().value === "|") {
      const alternatives: Pattern[] = [firstPattern];

      while (this.check(T.Symbol) && this.peek().value === "|") {
        this.advance(); // consume |
        alternatives.push(this.parseAtomicPattern());
      }

      return makeOrPattern(alternatives);
    }

    return firstPattern;
  }

  // Parse atomic pattern (without or-alternatives)
  private parseAtomicPattern(): Pattern {
    // Wildcard pattern: _
    if (this.check(T.Symbol) && this.peek().value === "_") {
      this.advance();
      return makeWildcardPattern();
    }

    // Variable pattern: x, y, name (but not |, &, etc)
    if (this.check(T.Symbol) && !["&", "|"].includes(this.peek().value)) {
      const nameToken = this.advance();
      return makeVariablePattern(nameToken.value);
    }

    // Literal pattern: number, string, boolean
    if (this.check(T.Number)) {
      const token = this.advance();
      return makeLiteralPattern("number", parseFloat(token.value));
    }

    if (this.check(T.String)) {
      const token = this.advance();
      return makeLiteralPattern("string", token.value);
    }

    // List pattern: [x y z] or [x & rest]
    if (this.check(T.LBracket)) {
      this.advance(); // consume [
      const elements: Pattern[] = [];
      let restElement: string | undefined;

      while (!this.check(T.RBracket) && !this.isAtEnd()) {
        // Check for rest element: & name
        if (this.check(T.Symbol) && this.peek().value === "&") {
          this.advance(); // consume &
          if (this.check(T.Symbol)) {
            const nameToken = this.advance();
            restElement = nameToken.value;
          }
          break; // rest element must be last
        }

        elements.push(this.parsePattern());
      }

      this.expect(T.RBracket);
      return makeListPattern(elements, restElement);
    }

    // Struct pattern: {:name :age} (not fully implemented yet)
    if (this.check(T.Keyword)) {
      const fields = new Map<string, Pattern>();
      while (this.check(T.Keyword) && !this.isAtEnd()) {
        const keyToken = this.advance();
        const fieldName = keyToken.value; // e.g., ":name"
        const pattern = this.parsePattern();
        fields.set(fieldName, pattern);
      }
      return makeStructPattern(fields);
    }

    throw this.error(`Expected pattern, got ${this.peek().type}`, this.peek());
  }

  // Parse match expression: (match value (pattern body) (pattern body) ... [default])
  // Note: Opening paren '(' already consumed by parseSExpr
  private parsePatternMatch(): PatternMatch {
    // 'match' keyword already consumed by parseSExpr
    // Just parse the value to match and cases

    // Parse value to match
    const value = this.parseValue();

    // Parse cases: (pattern body) (pattern body) ...
    const cases: MatchCase[] = [];
    let defaultCase: ASTNode | undefined;

    while (this.check(T.LParen) && !this.isAtEnd()) {
      this.advance(); // consume (

      // Check for default case: (default body)
      if (this.check(T.Symbol) && this.peek().value === "default") {
        this.advance(); // consume 'default'
        defaultCase = this.parseValue();
        this.expect(T.RParen);
        break; // default must be last
      }

      // Parse pattern
      const pattern = this.parsePattern();

      // Check for optional guard: (if condition)
      let guard: ASTNode | undefined;
      if (this.check(T.LParen) && this.peekNext()?.value === "if") {
        this.advance(); // consume (
        this.advance(); // consume 'if'
        guard = this.parseValue();
        this.expect(T.RParen);
      }

      // Parse body
      const body = this.parseValue();
      cases.push(makeMatchCase(pattern, body, guard));

      this.expect(T.RParen);
    }

    // Note: Closing paren will be consumed by parseSExpr

    return makePatternMatch(value, cases, defaultCase);
  }

  // ===== Utility Methods =====

  private peek(): Token {
    if (this.pos >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1]; // EOF
    }
    return this.tokens[this.pos];
  }

  private peekNext(): Token | null {
    if (this.pos + 1 >= this.tokens.length) return null;
    return this.tokens[this.pos + 1];
  }

  private advance(): Token {
    if (this.pos < this.tokens.length) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private check(type: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private expect(type: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    const token = this.peek();
    throw this.error(`Expected ${type}, got ${token.type}`, token);
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private error(message: string, token: Token): ParserError {
    return new ParserError(message, token.line, token.col);
  }

  // Synchronization for error recovery
  private synchronize(): void {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.check(T.LBracket)) return; // Next block start
      this.advance();
    }
  }

  // Phase 6: Parse import expression (import math :from "./math.fl" :as m :only [add])
  private parseImportExpression(): ImportBlock {
    // Module name is next (qualified identifier: math or a:b or a:b:c)
    const moduleName = this.parseQualifiedIdentifier();

    // Parse optional clauses: :from, :only, :as
    let source: string | undefined;
    let selective: string[] | undefined;
    let alias: string | undefined;

    while (!this.check(T.RParen) && !this.isAtEnd()) {
      if (this.check(T.Colon)) {
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(
            `Expected symbol after ':', got ${this.peek().type}`,
            this.peek()
          );
        }

        const clauseName = this.advance().value;

        switch (clauseName) {
          case "from":
            // :from "path"
            if (!this.check(T.String)) {
              throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
            }
            source = this.advance().value;
            break;

          case "only":
            // :only [func1 func2 ...]
            if (!this.check(T.LBracket)) {
              throw this.error(`Expected [ after :only, got ${this.peek().type}`, this.peek());
            }
            selective = this.parseSelectiveImport();
            break;

          case "as":
            // :as alias
            if (!this.check(T.Symbol)) {
              throw this.error(`Expected symbol after :as, got ${this.peek().type}`, this.peek());
            }
            alias = this.advance().value;
            break;

          default:
            throw this.error(`Unknown import clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in import expression, got ${this.peek().type}`, this.peek());
      }
    }

    return makeImportBlock(moduleName, source, selective, alias);
  }

  // Phase 6: Parse open expression (open math :from "./math.fl")
  private parseOpenExpression(): OpenBlock {
    // Module name is next (qualified identifier)
    const moduleName = this.parseQualifiedIdentifier();

    // Parse optional :from clause
    let source: string | undefined;

    while (!this.check(T.RParen) && !this.isAtEnd()) {
      if (this.check(T.Colon)) {
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(
            `Expected symbol after ':', got ${this.peek().type}`,
            this.peek()
          );
        }

        const clauseName = this.advance().value;

        if (clauseName === "from") {
          if (!this.check(T.String)) {
            throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
          }
          source = this.advance().value;
        } else {
          throw this.error(`Unknown open clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in open expression, got ${this.peek().type}`, this.peek());
      }
    }

    return makeOpenBlock(moduleName, source);
  }

  // Phase 6: Parse qualified identifier (math or math:add or utils:double:helper)
  // IMPORTANT: Stop when encountering keyword colons like :from, :as, :only
  private parseQualifiedIdentifier(): string {
    if (!this.check(T.Symbol)) {
      throw this.error(`Expected symbol, got ${this.peek().type}`, this.peek());
    }

    const parts: string[] = [];
    parts.push(this.advance().value);

    // Keyword colons that should NOT be consumed as part of qualified identifiers
    const keywordColons = new Set(["from", "as", "only", "to", "body", "params", "exports"]);

    // Check for additional parts separated by colons
    while (this.check(T.Colon)) {
      // Peek ahead to see if the next symbol is a keyword
      const peekPos = this.pos + 1;
      if (peekPos >= this.tokens.length) break;
      const nextToken = this.tokens[peekPos];

      // If next token is a keyword, stop parsing qualified identifier
      if (nextToken.type === T.Symbol && keywordColons.has(nextToken.value)) {
        break;
      }

      this.advance(); // consume ':'
      if (!this.check(T.Symbol)) {
        throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
      }
      parts.push(this.advance().value);
    }

    return parts.join(":");
  }

  // Phase 6: Parse selective import list: [func1 func2 ...]
  private parseSelectiveImport(): string[] {
    this.expect(T.LBracket);
    const names: string[] = [];

    while (!this.check(T.RBracket) && !this.isAtEnd()) {
      if (!this.check(T.Symbol)) {
        throw this.error(`Expected symbol in import list, got ${this.peek().type}`, this.peek());
      }
      names.push(this.advance().value);
    }

    this.expect(T.RBracket);
    return names;
  }
}

export function parse(tokens: Token[]): ASTNode[] {
  const parser = new Parser(tokens);
  return parser.parse();
}
