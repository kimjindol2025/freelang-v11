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
  SearchBlock,
  LearnBlock,
  ReasoningBlock,
  ReasoningSequence,
  ReasoningTransition,
  AsyncFunction,
  AwaitExpression,
  TryBlock,
  CatchClause,
  ThrowExpression,
  TypeClass,
  TypeClassInstance,
  TypeClassMethod,
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
  makeAsyncFunction,
  makeAwaitExpression,
  makeTryBlock,
  makeCatchClause,
  makeThrowExpression,
  makeReasoningBlock,
  makeReasoningTransition,
  makeReasoningSequence,
  makeTypeClass,
  makeTypeClassInstance,
} from "./ast";

export class ParserError extends Error {
  constructor(
    message: string,
    public line: number,
    public col: number,
    public hint?: string
  ) {
    const loc = `[${line}:${col}]`;
    const hintLine = hint ? `\n  힌트: ${hint}` : "";
    super(`${loc} ${message}${hintLine}`);
  }
}

// 에러 메시지 힌트 테이블
const ERROR_HINTS: Record<string, string> = {
  "Expected RParen, got Symbol":        "괄호가 닫히지 않았거나 와일드카드 패턴에 괄호가 필요합니다: _ expr → (_ expr)",
  "Expected RParen, got EOF":           "괄호가 닫히지 않았습니다. 여는 ( 와 닫는 ) 수를 확인하세요.",
  "Expected operator":                  "S-expression의 첫 요소는 함수명이어야 합니다: (함수명 인자...)",
  "Expected ':' keyword in map literal": "맵 리터럴의 키는 :으로 시작해야 합니다: {:key value}",
  "Unexpected token: Colon":            "콜론 키워드 (:key)는 맵 리터럴 또는 블록 필드에서만 사용할 수 있습니다.",
  "Expected block type":                "블록은 [FUNC name :params [...] :body ...] 형식이어야 합니다.",
  "Unterminated string":                "문자열이 닫히지 않았습니다. 닫는 \" 를 추가하세요.",
};

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

      // Phase 6: Handle blocks, arrays, and S-expressions at top level
      if (this.check(T.LBracket)) {
        // Distinguish between block [TYPE ...] and array [val1 val2 ...]
        const nextIdx = this.pos + 1;
        const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE"];

        if (nextIdx < this.tokens.length) {
          const nextToken = this.tokens[nextIdx];
          const isBlockKeyword = nextToken.type === T.Module || nextToken.type === T.TypeClass || nextToken.type === T.Instance;
          const isKnownBlockType = nextToken.type === T.Symbol && knownBlockTypes.includes(nextToken.value.toUpperCase());
          const hasKeywordAfter = nextIdx + 1 < this.tokens.length &&
            (this.tokens[nextIdx + 1].type === T.Keyword || this.tokens[nextIdx + 1].type === T.Colon);

          if (isBlockKeyword || isKnownBlockType || hasKeywordAfter) {
            // It's a block
            nodes.push(this.parseBlock());
          } else {
            // It's an array
            nodes.push(this.parseArray());
          }
        } else {
          // Empty or end of tokens, treat as block (will error)
          nodes.push(this.parseBlock());
        }
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
  private parseBlock(): Block | ModuleBlock | TypeClass | TypeClassInstance {
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

    // Phase 5: If this is a TYPECLASS block, convert it to TypeClass
    if (blockType === "TYPECLASS") {
      const block = makeBlock(blockType, blockName, fields);
      return this.convertBlockToTypeClass(block);
    }

    // Phase 5: If this is an INSTANCE block, convert it to TypeClassInstance
    if (blockType === "INSTANCE") {
      const block = makeBlock(blockType, blockName, fields);
      return this.convertBlockToInstance(block);
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

  // Phase 5: Convert Block to TypeClass
  private convertBlockToTypeClass(block: Block): TypeClass {
    const methods = new Map<string, TypeClassMethod>();
    let typeParams: string[] = [];

    // Extract :typeParams field (optional, e.g., [M] or [F])
    const typeParamsField = block.fields?.get("typeParams");
    if (typeParamsField) {
      if ((typeParamsField as any).kind === "block" && (typeParamsField as any).type === "Array") {
        // :typeParams [M F ...]  (Array block)
        const items = (typeParamsField as any).fields?.get("items") as ASTNode[];
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if ((item as any).kind === "literal" && (item as any).type === "symbol") {
              typeParams.push((item as any).value);
            }
          });
        }
      } else if ((typeParamsField as any).kind === "literal" && (typeParamsField as any).type === "symbol") {
        // Single type parameter as literal
        typeParams.push((typeParamsField as any).value);
      } else if (Array.isArray(typeParamsField)) {
        // JavaScript array (shouldn't happen, but keep for safety)
        (typeParamsField as any[]).forEach((param) => {
          if ((param as any).kind === "literal" && (param as any).type === "symbol") {
            typeParams.push((param as any).value);
          }
        });
      }
    }

    // Extract :methods field (should be a map of method names to function types)
    const methodsField = block.fields?.get("methods");
    if (methodsField) {
      if ((methodsField as any).kind === "block" && (methodsField as any).type === "Array") {
        // :methods [[:pure (fn [a] (M a))] [:bind (fn [m f] (M b))]]
        const items = (methodsField as any).fields?.get("items") as ASTNode[];
        if (Array.isArray(items)) {
          items.forEach((item) => {
            // Each item should be a 2-element array: [methodName, methodType]
            if ((item as any).kind === "block" && (item as any).type === "Array") {
              const subItems = (item as any).fields?.get("items") as ASTNode[];
              if (Array.isArray(subItems) && subItems.length === 2) {
                const nameNode = subItems[0];
                const typeNode = subItems[1];
                if ((nameNode as any).kind === "literal" && (nameNode as any).type === "symbol") {
                  const methodName = (nameNode as any).value;
                  methods.set(methodName, {
                    name: methodName,
                    type: typeNode,
                  });
                }
              }
            }
          });
        }
      }
    }

    return {
      kind: "type-class",
      name: block.name,
      typeParams,
      methods,
    };
  }

  // Phase 5: Convert Block to TypeClassInstance
  private convertBlockToInstance(block: Block): TypeClassInstance {
    let className: string = "";
    const concreteType: string = block.name;  // Block name is the concrete type (Result, Option, List, etc.)
    const implementations = new Map<string, ASTNode>();

    // Extract :typeclass field - the class name (Monad, Functor, etc.)
    const typeClassField = block.fields?.get("typeclass");
    if (typeClassField) {
      if ((typeClassField as any).kind === "literal" && (typeClassField as any).type === "symbol") {
        className = (typeClassField as any).value;
      }
    }

    // Extract method implementations from fields
    // Each method name like :pure, :bind, :map, :fmap should have a function value
    block.fields?.forEach((value, key) => {
      // Skip special fields
      if (key !== "typeclass") {
        // This is a method implementation
        implementations.set(key, value as ASTNode);
      }
    });

    return {
      kind: "type-class-instance",
      className,
      concreteType,
      implementations,
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

    // Phase 8+: control-flow keywords used as values (e.g. [else ...] in cond)
    if (this.check(T.Else) || this.check(T.Then) || this.check(T.When) ||
        this.check(T.Repeat) || this.check(T.Until) || this.check(T.While)) {
      const token = this.advance();
      return makeLiteral("symbol", token.value);
    }

    // Phase 8+: :symbol (Colon + Symbol) used as keyword/string value in .fl files
    // e.g. (get $parser :pos) → ":pos" as a string key
    if (this.check(T.Colon)) {
      this.advance(); // consume ':'
      if (this.check(T.Symbol)) {
        const token = this.advance();
        return makeLiteral("string", token.value);
      }
      // Bare colon (shouldn't happen in valid code, but handle gracefully)
      return makeLiteral("string", ":");
    }

    // Check for map literal: {:key1 value1 :key2 value2}
    if (this.check(T.LBrace)) {
      return this.parseMap();
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
      // Phase 9c: Special handling for boolean literals (true/false)
      if (token.value === "true") {
        return makeLiteral("boolean", true);
      }
      if (token.value === "false") {
        return makeLiteral("boolean", false);
      }
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

  // Parse map literal: {:key1 value1 :key2 value2 ...}
  private parseMap(): ASTNode {
    this.expect(T.LBrace);
    const mapFields = new Map<string, ASTNode>();

    while (!this.check(T.RBrace) && !this.isAtEnd()) {
      // Expect a keyword as key (:key)
      if (!this.check(T.Colon)) {
        throw this.error(`Expected ':' keyword in map literal`, this.peek());
      }
      this.advance(); // consume ':'

      if (!this.check(T.Symbol)) {
        throw this.error(`Expected symbol after ':' in map literal`, this.peek());
      }
      const key = this.advance().value;

      // Parse the value
      const value = this.parseValue();
      mapFields.set(key, value);
    }

    this.expect(T.RBrace);
    // Return as Map block
    return makeBlock("Map", "$map", mapFields);
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
  // Phase 9a: Also handles search and fetch expressions
  // Phase 9b: Also handles learn and recall expressions
  private parseSExpr(): SExpr | PatternMatch | ImportBlock | OpenBlock | SearchBlock | LearnBlock | ReasoningBlock | ReasoningSequence | TryBlock | ThrowExpression {
    this.expect(T.LParen);

    let op: string;
    const opToken = this.advance();

    // Phase 6: Handle import/open keyword tokens
    // Phase 9a: Handle search keyword token
    // Phase 9b: Handle learn/recall keyword tokens
    if (opToken.type === T.Import) {
      op = "import";
    } else if (opToken.type === T.Open) {
      op = "open";
    } else if (opToken.type === T.Search) {
      op = "search";
    } else if (opToken.type === T.Fetch) {
      op = "fetch";
    } else if (opToken.type === T.Learn) {
      op = "learn";
    } else if (opToken.type === T.Recall) {
      op = "recall";
    } else if (opToken.type === T.Remember) {
      op = "remember";
    } else if (opToken.type === T.Forget) {
      op = "forget";
    } else if (opToken.type === T.Observe) {
      op = "observe";
    } else if (opToken.type === T.Analyze) {
      op = "analyze";
    } else if (opToken.type === T.Decide) {
      op = "decide";
    } else if (opToken.type === T.Act) {
      op = "act";
    } else if (opToken.type === T.Verify) {
      op = "verify";
    } else if (opToken.type === T.If) {
      op = "if";
    } else if (opToken.type === T.When) {
      op = "when";
    } else if (opToken.type === T.Then) {
      op = "then";
    } else if (opToken.type === T.Else) {
      op = "else";
    } else if (opToken.type === T.Repeat) {
      op = "repeat";
    } else if (opToken.type === T.Until) {
      op = "until";
    } else if (opToken.type === T.While) {
      op = "while";
    } else if (opToken.type === T.LParen) {
      // Implicit begin/do block: ( (expr1) (expr2) ... )
      // Used in .fl self-hosting files where :body wraps multiple forms
      this.pos--; // un-advance: treat the inner ( as a value, not operator
      const exprs: ASTNode[] = [];
      while (!this.check(T.RParen) && !this.isAtEnd()) {
        exprs.push(this.parseValue());
      }
      this.expect(T.RParen);
      if (exprs.length === 1) return exprs[0] as SExpr;
      // Multiple exprs: wrap in "do" S-expr
      return { kind: "sexpr" as const, op: "do", args: exprs } as SExpr;
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

    // Special case: search expressions (Phase 9a)
    if (op === "search") {
      const searchBlock = this.parseSearchExpression();
      this.expect(T.RParen);
      return searchBlock;
    }

    // Special case: fetch expressions (Phase 9a)
    if (op === "fetch") {
      const searchBlock = this.parseFetchExpression();
      this.expect(T.RParen);
      return searchBlock;
    }

    // Special case: learn expressions (Phase 9b)
    if (op === "learn") {
      const learnBlock = this.parseLearnExpression();
      this.expect(T.RParen);
      return learnBlock;
    }

    // Special case: recall expressions (Phase 9b)
    if (op === "recall") {
      const learnBlock = this.parseRecallExpression();
      this.expect(T.RParen);
      return learnBlock;
    }

    // Special case: reasoning expressions (Phase 9c)
    if (op === "observe" || opToken.type === T.Observe) {
      const reasoningBlock = this.parseReasoningExpression("observe");
      this.expect(T.RParen);
      return reasoningBlock;
    }

    if (op === "analyze" || opToken.type === T.Analyze) {
      const reasoningBlock = this.parseReasoningExpression("analyze");
      this.expect(T.RParen);
      return reasoningBlock;
    }

    if (op === "decide" || opToken.type === T.Decide) {
      const reasoningBlock = this.parseReasoningExpression("decide");
      this.expect(T.RParen);
      return reasoningBlock;
    }

    if (op === "act" || opToken.type === T.Act) {
      const reasoningBlock = this.parseReasoningExpression("act");
      this.expect(T.RParen);
      return reasoningBlock;
    }

    if (op === "verify" || opToken.type === T.Verify) {
      const reasoningBlock = this.parseReasoningExpression("verify");
      this.expect(T.RParen);
      return reasoningBlock;
    }

    // Special case: reasoning-sequence expressions (Phase 9c Extension)
    if (op === "reasoning-sequence") {
      const reasoningSeq = this.parseReasoningSequenceExpression();
      this.expect(T.RParen);
      return reasoningSeq;
    }

    // Special case: try expressions (Phase 11)
    if (op === "try") {
      const tryBlock = this.parseTryExpression();
      this.expect(T.RParen);
      return tryBlock;
    }

    // Special case: throw expressions (Phase 11)
    if (op === "throw") {
      const throwExpr = this.parseThrowExpression();
      this.expect(T.RParen);
      return throwExpr;
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
      "let*", "letrec", "define", "async", "await"
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
    return makeSExpr(op, args, opToken.line);
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

    // Variable pattern: $x, $y (explicit $ syntax)
    if (this.check(T.Variable)) {
      const varToken = this.advance();
      return makeVariablePattern(varToken.value);
    }

    // Variable pattern: x, y, name (bare symbol, but not |, &, etc)
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

    // Parenthesized pattern: (pattern) - allows grouping
    if (this.check(T.LParen)) {
      this.advance(); // consume (
      const pattern = this.parsePattern();
      this.expect(T.RParen);
      return pattern;
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
    // 힌트 매칭: 메시지 앞부분으로 검색
    const hint = Object.entries(ERROR_HINTS).find(([k]) => message.includes(k))?.[1];
    return new ParserError(message, token.line, token.col, hint);
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

  // Phase 9a: Parse search expression
  // (search query :source "web"|"api"|"kb" :cache true|false :limit 5)
  private parseSearchExpression(): SearchBlock {
    // First argument: query (string)
    let query = "";
    const queryNode = this.parseValue();
    if (queryNode.kind === "literal" && queryNode.type === "string") {
      query = queryNode.value as string;
    } else {
      throw this.error(`Expected string query in search expression`, this.peek());
    }

    // Parse optional keyword arguments
    let source: "web" | "api" | "kb" = "web";
    let cache = false;
    let limit = 10;
    let name: string | undefined;

    while (!this.check(T.RParen) && !this.isAtEnd()) {
      if (this.check(T.Colon)) {
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }

        const clauseName = this.advance().value;

        switch (clauseName) {
          case "source":
            if (!this.check(T.String)) {
              throw this.error(`Expected string after :source`, this.peek());
            }
            const sourceVal = this.advance().value;
            if (sourceVal === "web" || sourceVal === "api" || sourceVal === "kb") {
              source = sourceVal as "web" | "api" | "kb";
            } else {
              throw this.error(`Invalid source: ${sourceVal}`, this.peek());
            }
            break;

          case "cache":
            const cacheVal = this.parseValue();
            if (cacheVal.kind === "literal") {
              cache = cacheVal.value === "true" || cacheVal.value === true;
            }
            break;

          case "limit":
            const limitVal = this.parseValue();
            if (limitVal.kind === "literal" && limitVal.type === "number") {
              limit = limitVal.value as number;
            }
            break;

          case "name":
            if (!this.check(T.Symbol)) {
              throw this.error(`Expected symbol after :name`, this.peek());
            }
            name = this.advance().value;
            break;

          default:
            throw this.error(`Unknown search clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in search expression, got ${this.peek().type}`, this.peek());
      }
    }

    return {
      kind: "search-block",
      query,
      source,
      cache,
      limit,
      name,
    };
  }

  // Phase 9a: Parse fetch expression
  // (fetch url :cache true|false)
  private parseFetchExpression(): SearchBlock {
    // First argument: URL (string)
    let query = "";
    const urlNode = this.parseValue();
    if (urlNode.kind === "literal" && urlNode.type === "string") {
      query = urlNode.value as string;
    } else {
      throw this.error(`Expected string URL in fetch expression`, this.peek());
    }

    // Parse optional keyword arguments
    let cache = false;

    while (!this.check(T.RParen) && !this.isAtEnd()) {
      if (this.check(T.Colon)) {
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }

        const clauseName = this.advance().value;

        if (clauseName === "cache") {
          const cacheVal = this.parseValue();
          if (cacheVal.kind === "literal") {
            cache = cacheVal.value === "true" || cacheVal.value === true;
          }
        } else {
          throw this.error(`Unknown fetch clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in fetch expression, got ${this.peek().type}`, this.peek());
      }
    }

    return {
      kind: "search-block",
      query,
      source: "api",
      cache,
    };
  }

  // Phase 9b: Parse learn expression
  // (learn key data :source "search" :confidence 0.95)
  private parseLearnExpression(): LearnBlock {
    // First argument: key (symbol or string)
    let key = "";
    const keyNode = this.parseValue();
    if (keyNode.kind === "literal" && (keyNode.type === "string" || keyNode.type === "symbol")) {
      key = keyNode.value as string;
    } else if ((keyNode as any).kind === "variable") {
      key = (keyNode as Variable).name;
    } else {
      throw this.error(`Expected symbol/string key in learn expression`, this.peek());
    }

    // Second argument: data (any value)
    // For now, data is optional - if next token is :keyword, skip data parsing
    let data: any = null;
    if (!this.check(T.Colon) && !this.check(T.RParen) && !this.isAtEnd()) {
      data = this.parseValue();
    }

    // Parse optional keyword arguments
    let source: "search" | "feedback" | "analysis" = "search";
    let confidence: number | undefined;
    let timestamp: string | undefined;

    while (!this.check(T.RParen) && !this.isAtEnd()) {
      if (this.check(T.Colon)) {
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }

        const clauseName = this.advance().value;

        switch (clauseName) {
          case "source":
            const sourceVal = this.parseValue();
            if (sourceVal.kind === "literal" && sourceVal.type === "string") {
              const srcStr = sourceVal.value as string;
              if (srcStr === "search" || srcStr === "feedback" || srcStr === "analysis") {
                source = srcStr;
              }
            }
            break;

          case "confidence":
            const confVal = this.parseValue();
            if (confVal.kind === "literal" && confVal.type === "number") {
              confidence = confVal.value as number;
            }
            break;

          case "timestamp":
            const timeVal = this.parseValue();
            if (timeVal.kind === "literal" && timeVal.type === "string") {
              timestamp = timeVal.value as string;
            }
            break;

          default:
            throw this.error(`Unknown learn clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in learn expression, got ${this.peek().type}`, this.peek());
      }
    }

    return {
      kind: "learn-block",
      key,
      data,
      source,
      confidence,
      timestamp,
    };
  }

  // Phase 9b: Parse recall expression
  // (recall key) - retrieves learned data by key
  private parseRecallExpression(): LearnBlock {
    // First argument: key (symbol or string)
    let key = "";
    const keyNode = this.parseValue();
    if (keyNode.kind === "literal" && (keyNode.type === "string" || keyNode.type === "symbol")) {
      key = keyNode.value as string;
    } else if ((keyNode as any).kind === "variable") {
      key = (keyNode as Variable).name;
    } else {
      throw this.error(`Expected symbol/string key in recall expression`, this.peek());
    }

    // Return a recall block (kind="learn-block" with data=null to indicate retrieval)
    return {
      kind: "learn-block",
      key,
      data: null, // null indicates this is a recall operation
      source: "search",
    };
  }

  // Phase 9c: Parse reasoning expression
  // (observe "facts" :confidence 0.9)
  // (analyze :angle1 "perf" :angle2 "security" :selected "angle1")
  // (decide :choice "angle2" :reason "best performance")
  // (act :action "implement" :parameters {...})
  // (verify :result success :evidence [...])
  private parseReasoningExpression(stage: "observe" | "analyze" | "decide" | "act" | "verify"): ReasoningBlock {
    const data = new Map<string, any>();
    const metadata: { startTime?: string; endTime?: string; confidence?: number; feedback?: string } = {
      startTime: new Date().toISOString(),
    };

    let observations: any[] | undefined;
    let analysis: any[] | undefined;
    let decisions: any[] | undefined;
    let actions: any[] | undefined;
    let verifications: any[] | undefined;

    // Parse stage-specific data
    switch (stage) {
      case "observe": {
        // Parse observation data and optional keyword arguments
        // (observe "fact" :confidence 0.9)
        if (!this.check(T.RParen) && !this.check(T.Colon)) {
          const obs = this.parseValue();
          observations = [obs];
          data.set("observation", obs);
        }

        // Parse keyword arguments
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                data.set(clauseName, clauseValue.value);
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(`Expected ':' in observe expression, got ${this.peek().type}`, this.peek());
          }
        }
        break;
      }

      case "analyze": {
        // Parse multiple angles: :angle1 "value1" :angle2 "value2" :selected "angle1"
        const angles = new Map<string, any>();
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            if (clauseName === "selected") {
              const selected = this.parseValue();
              data.set("selected", selected);
            } else {
              // It's an angle
              const angleValue = this.parseValue();
              angles.set(clauseName, angleValue);
            }
          } else {
            throw this.error(`Expected ':' in analyze expression, got ${this.peek().type}`, this.peek());
          }
        }
        data.set("angles", angles);
        analysis = Array.from(angles.values());
        break;
      }

      case "decide": {
        // Parse decision: :choice "angle2" :reason "best performance"
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(`Expected ':' in decide expression, got ${this.peek().type}`, this.peek());
          }
        }
        decisions = [data.get("choice")];
        break;
      }

      case "act": {
        // Parse action: :action "implement" :parameters {...}
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(`Expected ':' in act expression, got ${this.peek().type}`, this.peek());
          }
        }
        actions = [data.get("action")];
        break;
      }

      case "verify": {
        // Parse verification: :result success :evidence [...]
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                metadata.confidence = clauseValue.value as number;
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(`Expected ':' in verify expression, got ${this.peek().type}`, this.peek());
          }
        }
        verifications = [data.get("result")];
        break;
      }
    }

    metadata.endTime = new Date().toISOString();

    return {
      kind: "reasoning-block",
      stage,
      data,
      observations,
      analysis,
      decisions,
      actions,
      verifications,
      metadata,
    };
  }

  // Phase 9c Extension: Parse reasoning-sequence expression
  // (reasoning-sequence (observe ...) (analyze ...) (decide ...) (act ...) (verify ...))
  // Phase 9a/9b: Support search and learn blocks in sequences
  private parseReasoningSequenceExpression(): ReasoningSequence {
    const stages: (ReasoningBlock | SearchBlock | LearnBlock)[] = [];
    const startTime = new Date().toISOString();

    // Parse multiple reasoning blocks in sequence
    let feedbackLoop: any = undefined;

    while (!this.check(T.RParen) && !this.isAtEnd()) {
      // Check for feedback loop configuration (Phase 9c Feedback)
      if (this.check(T.Colon)) {
        this.advance(); // consume ':'
        if (!this.check(T.Symbol)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }

        const keyword = this.advance().value;

        if (keyword === "feedback") {
          feedbackLoop = {
            enabled: false,
            fromStage: "verify",
            toStage: "analyze",
            maxIterations: 3,
            confidenceDamping: 0.1,
          };

          // Parse feedback options
          while (!this.check(T.RParen) && !this.isAtEnd() && this.check(T.Colon)) {
            this.advance(); // consume ':'
            const feedbackKey = this.advance().value;

            switch (feedbackKey) {
              case "enabled":
                const enabledVal = this.parseValue();
                feedbackLoop.enabled =
                  enabledVal.kind === "literal" && enabledVal.value === true;
                break;

              case "from":
                const fromVal = this.parseValue();
                if (fromVal.kind === "literal" && fromVal.type === "string") {
                  feedbackLoop.fromStage = fromVal.value as "verify" | "act";
                }
                break;

              case "to":
                const toVal = this.parseValue();
                if (toVal.kind === "literal" && toVal.type === "string") {
                  feedbackLoop.toStage = toVal.value as "analyze" | "decide";
                }
                break;

              case "max-iterations":
                const maxVal = this.parseValue();
                if (maxVal.kind === "literal" && maxVal.type === "number") {
                  feedbackLoop.maxIterations = maxVal.value as number;
                }
                break;

              case "damping":
                const dampVal = this.parseValue();
                if (dampVal.kind === "literal" && dampVal.type === "number") {
                  feedbackLoop.confidenceDamping = dampVal.value as number;
                }
                break;

              case "condition":
                feedbackLoop.condition = this.parseValue();
                break;

              default:
                throw this.error(`Unknown feedback option: ${feedbackKey}`, this.peek());
            }
          }
        } else {
          throw this.error(`Unknown option: ${keyword}`, this.peek());
        }
      } else if (this.check(T.LParen)) {
        // Phase 9c: Lookahead to check if this is (if ...), (when ...), or (repeat ...) / (while ...)
        if (this.pos + 1 < this.tokens.length) {
          const nextToken = this.tokens[this.pos + 1];
          if (nextToken.type === T.If) {
            // Don't consume '(', let parseConditionalReasoningBlock handle it
            const conditionalBlock = this.parseConditionalReasoningBlock();
            stages.push(conditionalBlock);
            continue;
          }
          if (nextToken.type === T.When) {
            // Don't consume '(', let parseWhenReasoningBlock handle it
            const whenBlock = this.parseWhenReasoningBlock();
            stages.push(whenBlock);
            continue;
          }
          if (nextToken.type === T.Repeat || nextToken.type === T.While) {
            // Don't consume '(', let parseLoopReasoningBlock handle it
            const loopBlock = this.parseLoopReasoningBlock();
            stages.push(loopBlock);
            continue;
          }
          if (nextToken.type === T.Search) {
            // Phase 9a: Don't consume '(', let parseSearchReasoningBlock handle it
            const searchBlock = this.parseSearchReasoningBlock();
            stages.push(searchBlock);
            continue;
          }
          if (nextToken.type === T.Learn) {
            // Phase 9b: Don't consume '(', let parseLearnReasoningBlock handle it
            const learnBlock = this.parseLearnReasoningBlock();
            stages.push(learnBlock);
            continue;
          }
        }

        this.advance(); // consume '('

        // Check for reasoning stage keywords
        const stageToken = this.peek();
        const isReasoningStage =
          stageToken.type === T.Observe ||
          stageToken.type === T.Analyze ||
          stageToken.type === T.Decide ||
          stageToken.type === T.Act ||
          stageToken.type === T.Verify ||
          (stageToken.type === T.Symbol &&
            (stageToken.value === "observe" ||
              stageToken.value === "analyze" ||
              stageToken.value === "decide" ||
              stageToken.value === "act" ||
              stageToken.value === "verify"));

        if (!isReasoningStage) {
          throw this.error(
            `Expected reasoning stage (observe/analyze/decide/act/verify), got ${stageToken.value}`,
            stageToken
          );
        }

        const stageName =
          stageToken.type === T.Observe
            ? "observe"
            : stageToken.type === T.Analyze
            ? "analyze"
            : stageToken.type === T.Decide
            ? "decide"
            : stageToken.type === T.Act
            ? "act"
            : stageToken.type === T.Verify
            ? "verify"
            : stageToken.value;

        this.advance(); // consume stage name
        const reasoningBlock = this.parseReasoningExpressionInternal(
          stageName as "observe" | "analyze" | "decide" | "act" | "verify"
        );
        stages.push(reasoningBlock);
        this.expect(T.RParen);
      } else if (this.check(T.If)) {
        // Phase 9c: Parse if/then/else conditional
        const conditionalBlock = this.parseConditionalReasoningBlock();
        stages.push(conditionalBlock);
      } else if (this.check(T.When)) {
        // Phase 9c: Parse when guard clause
        const whenBlock = this.parseWhenReasoningBlock();
        stages.push(whenBlock);
      } else if (this.check(T.Repeat) || this.check(T.While)) {
        // Phase 9c: Parse loop control (repeat-until or repeat-while)
        const loopBlock = this.parseLoopReasoningBlock();
        stages.push(loopBlock);
      } else {
        throw this.error(
          `Expected '(' before reasoning block, 'if', 'when', 'repeat', 'while', or ':feedback', got ${this.peek().type}`,
          this.peek()
        );
      }
    }

    const endTime = new Date().toISOString();

    return {
      kind: "reasoning-sequence",
      stages,
      metadata: {
        startTime,
        endTime,
        // Phase 9a/9b: Support search/learn blocks in execution path
        executionPath: stages.map((s) => {
          if ("stage" in s) return (s as ReasoningBlock).stage;
          if ((s as any).kind === "search-block") return "search";
          if ((s as any).kind === "learn-block") return "learn";
          return "unknown";
        }),
      },
      feedbackLoop: feedbackLoop?.enabled ? feedbackLoop : undefined,
    };
  }

  // Phase 11: Parse try-catch-finally expressions
  // (try body (catch [pattern] handler) (finally cleanup))
  private parseTryExpression(): TryBlock {
    // 'try' keyword already consumed by parseSExpr
    const body = this.parseValue();

    const catchClauses: CatchClause[] = [];
    let finallyBlock: ASTNode | undefined;

    while (this.check(T.LParen) && !this.isAtEnd()) {
      const clauseToken = this.peek();

      // Check if this is a catch or finally clause
      if (this.pos + 1 < this.tokens.length) {
        const nextToken = this.tokens[this.pos + 1];

        if (nextToken.type === T.Symbol && nextToken.value === "catch") {
          this.advance(); // consume '('
          this.advance(); // consume 'catch'

          // Optional error pattern (can be empty)
          let pattern: Pattern | undefined;
          let variable: string | undefined;

          if (this.check(T.LBracket)) {
            // Pattern specified: (catch [ErrorType] handler) or (catch [err] handler)
            this.advance(); // consume '['
            if (this.check(T.Symbol)) {
              const patternName = this.advance().value;
              // Simple pattern: bind to variable
              variable = patternName;
              pattern = makeVariablePattern(patternName);
            }
            this.expect(T.RBracket);
          }

          // Parse catch handler
          const handler = this.parseValue();
          catchClauses.push(makeCatchClause(handler, pattern, variable));
          this.expect(T.RParen);
        } else if (nextToken.type === T.Symbol && nextToken.value === "finally") {
          this.advance(); // consume '('
          this.advance(); // consume 'finally'
          finallyBlock = this.parseValue();
          this.expect(T.RParen);
          break; // finally must be last
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return makeTryBlock(body, catchClauses.length > 0 ? catchClauses : undefined, finallyBlock);
  }

  // Phase 11: Parse throw expressions
  // (throw error-value)
  private parseThrowExpression(): ThrowExpression {
    // 'throw' keyword already consumed by parseSExpr
    const argument = this.parseValue();
    return makeThrowExpression(argument);
  }

  // Phase 9c: Internal helper for parsing reasoning expressions (used by parseReasoningExpression and parseReasoningSequenceExpression)
  private parseReasoningExpressionInternal(
    stage: "observe" | "analyze" | "decide" | "act" | "verify"
  ): ReasoningBlock {
    const data = new Map<string, any>();
    let observations: any[] = [];
    let analysis: any[] = [];
    let decisions: any[] = [];
    let actions: any[] = [];
    let verifications: any[] = [];
    const metadata: any = { startTime: new Date().toISOString() };

    switch (stage) {
      case "observe": {
        // Parse observation: "message" or :data "message" :confidence 0.9
        if (!this.check(T.RParen)) {
          const firstArg = this.parseValue();
          if (firstArg.kind === "literal" && firstArg.type === "string") {
            data.set("observation", firstArg.value);
            observations.push(firstArg.value);
          }
        }

        // Parse keyword arguments: :confidence, :feedback, etc.
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
            const clauseValue = this.parseValue();

            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                metadata.confidence = clauseValue.value as number;
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(
              `Expected ':' in observe expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        break;
      }

      case "analyze": {
        // Parse analysis: :angle1 "..." :angle2 "..." :selected "..."
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);

            if (clauseName === "selected") {
              analysis.push(clauseValue);
            }
          } else {
            throw this.error(
              `Expected ':' in analyze expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        break;
      }

      case "decide": {
        // Parse decision: :choice "..." :reason "..."
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(
              `Expected ':' in decide expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        decisions = [data.get("choice")];
        break;
      }

      case "act": {
        // Parse action: :action "..." :parameters {...}
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(
              `Expected ':' in act expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        actions = [data.get("action")];
        break;
      }

      case "verify": {
        // Parse verification: :result success :evidence [...]
        while (!this.check(T.RParen) && !this.isAtEnd()) {
          if (this.check(T.Colon)) {
            this.advance();
            const clauseName = this.advance().value;

            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                metadata.confidence = clauseValue.value as number;
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(
              `Expected ':' in verify expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        verifications = [data.get("result")];
        break;
      }
    }

    metadata.endTime = new Date().toISOString();

    return {
      kind: "reasoning-block",
      stage,
      data,
      observations,
      analysis,
      decisions,
      actions,
      verifications,
      metadata,
    };
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

  // Phase 9c: Parse if/then/else conditional reasoning block
  // Format: (if condition (thenBlock) (elseBlock)?)
  private parseConditionalReasoningBlock(): ReasoningBlock {
    this.expect(T.LParen); // consume '('
    this.expect(T.If);      // consume 'if'

    // Parse condition expression
    const condition = this.parseValue();

    // Parse then block
    if (!this.check(T.LParen)) {
      throw this.error(`Expected '(' for then block, got ${this.peek().type}`, this.peek());
    }
    this.advance(); // consume '('

    const thenStageToken = this.peek();
    const thenStageName = this.getReasoningStageName(thenStageToken);
    if (!thenStageName) {
      throw this.error(
        `Expected reasoning stage in then block, got ${thenStageToken.value}`,
        thenStageToken
      );
    }

    this.advance(); // consume stage name
    const thenBlock = this.parseReasoningExpressionInternal(
      thenStageName as "observe" | "analyze" | "decide" | "act" | "verify"
    );
    this.expect(T.RParen);

    // Parse optional else block
    let elseBlock: ReasoningBlock | undefined = undefined;
    if (this.check(T.LParen)) {
      // Lookahead to check if this is an else block or something else
      const nextIdx = this.pos + 1;
      if (nextIdx < this.tokens.length) {
        const nextToken = this.tokens[nextIdx];
        const elseStageName = this.getReasoningStageName(nextToken);
        if (elseStageName) {
          this.advance(); // consume '('
          this.advance(); // consume stage name
          elseBlock = this.parseReasoningExpressionInternal(
            elseStageName as "observe" | "analyze" | "decide" | "act" | "verify"
          );
          this.expect(T.RParen); // close (block)
        }
      }
    }

    this.expect(T.RParen); // close outer (if ...)

    // Return then block with conditional info
    return {
      ...thenBlock,
      conditional: { condition, thenBlock, elseBlock },
    };
  }

  // Phase 9c: Parse when guard clause
  // Format: (when condition (block))
  private parseWhenReasoningBlock(): ReasoningBlock {
    this.expect(T.LParen); // consume '('
    this.expect(T.When);   // consume 'when'

    // Parse guard condition
    const condition = this.parseValue();

    // Parse block
    if (!this.check(T.LParen)) {
      throw this.error(`Expected '(' for when block, got ${this.peek().type}`, this.peek());
    }
    this.advance(); // consume '('

    const stageToken = this.peek();
    const stageName = this.getReasoningStageName(stageToken);
    if (!stageName) {
      throw this.error(`Expected reasoning stage in when block, got ${stageToken.value}`, stageToken);
    }

    this.advance(); // consume stage name
    const block = this.parseReasoningExpressionInternal(
      stageName as "observe" | "analyze" | "decide" | "act" | "verify"
    );
    this.expect(T.RParen); // close (block)

    this.expect(T.RParen); // close outer (when ...)

    // Return block with when guard
    return {
      ...block,
      whenGuard: condition,
    };
  }

  // Phase 9c: Parse loop control (repeat-until or repeat-while)
  // Format: (repeat-until condition (block))
  //         (repeat-while condition (block))
  // Phase 9a: Parse search block in reasoning sequence
  // (search query :source "web"|"api"|"kb" :cache true|false :limit 5)
  private parseSearchReasoningBlock(): SearchBlock {
    this.expect(T.LParen); // consume '('
    this.expect(T.Search); // consume 'search'
    const searchBlock = this.parseSearchExpression();
    this.expect(T.RParen); // consume ')'
    return searchBlock;
  }

  // Phase 9b: Parse learn block in reasoning sequence
  // (learn key data :source "search"|"feedback"|"analysis" :confidence 0.95)
  private parseLearnReasoningBlock(): LearnBlock {
    this.expect(T.LParen); // consume '('
    this.expect(T.Learn); // consume 'learn'
    const learnBlock = this.parseLearnExpression();
    this.expect(T.RParen); // consume ')'
    return learnBlock;
  }

  private parseLoopReasoningBlock(): ReasoningBlock {
    this.expect(T.LParen); // consume '('

    // Check if it's repeat or while
    const loopTypeToken = this.peek();
    const isRepeat = loopTypeToken.type === T.Repeat;
    const isWhile = loopTypeToken.type === T.While;

    if (!isRepeat && !isWhile) {
      throw this.error(
        `Expected 'repeat' or 'while' in loop, got ${loopTypeToken.type}`,
        loopTypeToken
      );
    }

    this.advance(); // consume 'repeat' or 'while'

    // For repeat-until and repeat-while, expect an 'until' or 'while' keyword
    let loopType: "repeat-until" | "repeat-while";

    if (isRepeat) {
      this.expect(T.Until); // consume 'until'
      loopType = "repeat-until";
    } else {
      // already consumed 'while'
      loopType = "repeat-while";
    }

    // Parse loop condition
    const condition = this.parseValue();

    // Parse block (single reasoning stage block)
    if (!this.check(T.LParen)) {
      throw this.error(`Expected '(' for loop block, got ${this.peek().type}`, this.peek());
    }

    this.advance(); // consume '('

    const stageToken = this.peek();
    const stageName = this.getReasoningStageName(stageToken);
    if (!stageName) {
      throw this.error(`Expected reasoning stage in loop block, got ${stageToken.value}`, stageToken);
    }

    this.advance(); // consume stage name
    const block = this.parseReasoningExpressionInternal(
      stageName as "observe" | "analyze" | "decide" | "act" | "verify"
    );
    this.expect(T.RParen); // close (block)

    this.expect(T.RParen); // close outer (repeat/while ...)

    // Return block with loop control info
    return {
      ...block,
      loopControl: {
        type: loopType,
        condition,
      },
    };
  }

  // Helper: Get reasoning stage name from token
  private getReasoningStageName(token: Token): string | null {
    if (token.type === T.Observe) return "observe";
    if (token.type === T.Analyze) return "analyze";
    if (token.type === T.Decide) return "decide";
    if (token.type === T.Act) return "act";
    if (token.type === T.Verify) return "verify";
    if (token.type === T.Symbol) {
      if (token.value === "observe") return "observe";
      if (token.value === "analyze") return "analyze";
      if (token.value === "decide") return "decide";
      if (token.value === "act") return "act";
      if (token.value === "verify") return "verify";
    }
    return null;
  }
}

export function parse(tokens: Token[]): ASTNode[] {
  const parser = new Parser(tokens);
  return parser.parse();
}
