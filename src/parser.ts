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
  makeBlock,
  makeLiteral,
  makeVariable,
  makeSExpr,
  makeKeyword,
  makeTypeAnnotation,
  makeTypeVariable,
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

  parse(): Block[] {
    const blocks: Block[] = [];
    while (!this.isAtEnd()) {
      if (this.check(T.EOF)) break;
      blocks.push(this.parseBlock());
    }
    return blocks;
  }

  // [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
  private parseBlock(): Block {
    this.expect(T.LBracket);
    const typeToken = this.advance();
    if (typeToken.type !== T.Symbol) {
      throw this.error(`Expected block type (symbol), got ${typeToken.type}`, typeToken);
    }
    const blockType = typeToken.value;

    const nameToken = this.advance();
    if (nameToken.type !== T.Symbol) {
      throw this.error(`Expected block name (symbol), got ${nameToken.type}`, nameToken);
    }
    const blockName = nameToken.value;

    const fields = new Map<string, ASTNode | ASTNode[]>();
    const typeAnnotations = new Map<string, TypeAnnotation>();
    let generics: string[] | undefined;

    // Parse fields: :key value :key value ...
    while (!this.check(T.RBracket) && !this.isAtEnd()) {
      // Expect a keyword at the start of each field
      if (!this.check(T.Keyword)) {
        throw this.error(
          `Expected keyword field (starting with :), got ${this.peek().type}`,
          this.peek()
        );
      }

      const keyToken = this.advance();
      const keyName = keyToken.value; // e.g., ":body" or ":params"

      // Collect values for this key (parse until next keyword or closing bracket)
      const values: ASTNode[] = [];

      // Single value case (most common): :key value
      if (!this.check(T.Keyword) && !this.check(T.RBracket)) {
        values.push(this.parseValue());
      }

      // Multiple values case: :key val1 val2 ... (until next keyword or ])
      while (!this.check(T.Keyword) && !this.check(T.RBracket) && !this.isAtEnd()) {
        values.push(this.parseValue());
      }

      // Store field
      if (values.length === 0) {
        throw this.error(`Expected at least one value for keyword ${keyName}`, keyToken);
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

  // Parse any value: literal, variable, block, S-expr, or array
  private parseValue(): ASTNode {
    // Check for S-expression: (op arg1 arg2 ...)
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
      const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE"];

      if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === T.Symbol) {
        const potentialType = this.tokens[nextIdx].value;
        // Check if it's a known block type (uppercase) or looks like a block name followed by a keyword
        const isKnownType = knownBlockTypes.includes(potentialType.toUpperCase());
        const nextNextIdx = nextIdx + 1;
        const hasKeywordAfterName = nextNextIdx < this.tokens.length && this.tokens[nextNextIdx].type === T.Keyword;

        if (isKnownType || hasKeywordAfterName) {
          // It's a block
          return this.parseBlock();
        } else {
          // It's a value array: [val1 val2 ...]
          return this.parseArray();
        }
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

  // Parse S-expression: (op arg1 arg2 ...) or (op[T] arg1 arg2 ...) for generic functions
  private parseSExpr(): SExpr {
    this.expect(T.LParen);

    const opToken = this.advance();
    if (opToken.type !== T.Symbol) {
      throw this.error(`Expected operator (symbol) in S-expression, got ${opToken.type}`, opToken);
    }
    let op = opToken.value;

    // Phase 4: Handle generic function syntax: (identity[int] ...)
    if (this.check(T.LBracket)) {
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
}

export function parse(tokens: Token[]): Block[] {
  const parser = new Parser(tokens);
  return parser.parse();
}
