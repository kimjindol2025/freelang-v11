// FreeLang v9: Interpreter
// AST → 실행 (Express 서버 포함)

import express from "express";
import { ASTNode, Block, Literal, Variable, SExpr, Keyword, TypeAnnotation } from "./ast";
import { TypeChecker, createTypeChecker } from "./type-checker";

// ExecutionContext: 런타임 상태 관리
export interface ExecutionContext {
  functions: Map<string, FreeLangFunction>;
  routes: Map<string, FreeLangRoute>;
  intents: Map<string, Intent>;
  variables: Map<string, any>;
  app: express.Express;
  server?: any;
  middleware: FreeLangMiddleware[];
  errorHandlers: ErrorHandler;
  startTime: number;
  typeChecker?: TypeChecker; // Phase 3: Type system
}

export interface FreeLangFunction {
  name: string;
  params: string[];
  body: ASTNode;
  generics?: string[]; // Generic type variables: [T, K, V] (Phase 4)
  paramTypes?: TypeAnnotation[]; // Parameter types for type checking (Phase 3)
  returnType?: TypeAnnotation; // Return type for type checking (Phase 3)
}

export interface FreeLangRoute {
  name: string;
  method: string;
  path: string;
  handler: ASTNode;
}

export interface Intent {
  name: string;
  fields: Map<string, ASTNode>;
}

export interface FreeLangMiddleware {
  name: string;
  config: Map<string, any>;
}

export interface ErrorHandler {
  handlers: Map<number | "default", ASTNode>;
}

// Interpreter class
export class Interpreter {
  private context: ExecutionContext;

  constructor(app: express.Express = express()) {
    this.context = {
      functions: new Map(),
      routes: new Map(),
      intents: new Map(),
      variables: new Map(),
      app,
      middleware: [],
      errorHandlers: { handlers: new Map() },
      startTime: Date.now(),
      typeChecker: createTypeChecker(), // Phase 3: Initialize type checker
    };
  }

  interpret(blocks: Block[]): ExecutionContext {
    // Process all blocks
    for (const block of blocks) {
      this.evalBlock(block);
    }

    // Setup Express routes
    this.setupExpressRoutes();

    return this.context;
  }

  private evalBlock(block: Block): void {
    switch (block.type) {
      case "SERVER":
        this.handleServerBlock(block);
        break;
      case "ROUTE":
        this.handleRouteBlock(block);
        break;
      case "FUNC":
        this.handleFuncBlock(block);
        break;
      case "INTENT":
        this.handleIntentBlock(block);
        break;
      case "MIDDLEWARE":
        this.handleMiddlewareBlock(block);
        break;
      case "WEBSOCKET":
        this.handleWebSocketBlock(block);
        break;
      case "ERROR-HANDLER":
        this.handleErrorHandlerBlock(block);
        break;
      default:
        // Unknown block type, skip
        break;
    }
  }

  private handleServerBlock(block: Block): void {
    // [SERVER name :port 3009 :host "localhost" ...]
    const port = this.getFieldValue(block, "port") || 3009;
    const host = this.getFieldValue(block, "host") || "localhost";
    // Store server config (implement later)
  }

  private handleRouteBlock(block: Block): void {
    // [ROUTE name :method "GET" :path "/api/health" :handler (json-response ...)]
    const method = this.getFieldValue(block, "method", "GET");
    const path = this.getFieldValue(block, "path", "/");
    const handler = block.fields.get("handler") as ASTNode;

    if (!handler) {
      throw new Error(`[ROUTE ${block.name}] Missing :handler`);
    }

    this.context.routes.set(block.name, {
      name: block.name,
      method: method.toLowerCase(),
      path,
      handler,
    });
  }

  private handleFuncBlock(block: Block): void {
    // [FUNC name :params [$x $y] :body (+ $x $y)]
    // Phase 3: [FUNC name :params [[$x int] [$y int]] :return int :body (+ $x $y)]
    const paramsField = block.fields.get("params");
    const params: string[] = [];

    if (paramsField && (paramsField as any).kind === "variable") {
      params.push(((paramsField as any) as any).name);
    } else if ((paramsField as any)?.kind === "block" && (paramsField as any).type === "Array") {
      const items = (paramsField as any).fields.get("items");
      if (Array.isArray(items)) {
        params.push(...items.map((item: any) => {
          // Phase 3: New syntax [[$x int] [$y string]] or [[x int] [y string]] - item is an Array block with [Name, Type]
          if (item.kind === "block" && item.type === "Array") {
            const innerItems = item.fields.get("items");
            if (Array.isArray(innerItems) && innerItems.length > 0) {
              const firstItem = innerItems[0];
              if (firstItem.kind === "variable") {
                return firstItem.name; // Extract parameter name from Variable ($x)
              }
              // Phase 4: Support symbol literals as parameter names (x without $)
              if (firstItem.kind === "literal" && firstItem.type === "symbol") {
                return "$" + firstItem.value; // Convert symbol to variable: x → $x
              }
            }
          }
          // Old syntax [$x $y] - item is a Variable directly
          if (item.kind === "variable") {
            return item.name;
          }
          // Fallback
          return item.name || "$unknown";
        }));
      }
    }

    const body = block.fields.get("body") as ASTNode;
    if (!body) {
      throw new Error(`[FUNC ${block.name}] Missing :body`);
    }

    // Get parameter types from typeAnnotations
    let paramTypes: TypeAnnotation[] = [];
    let returnType: TypeAnnotation = { kind: "type" as const, name: "any" };

    if (block.typeAnnotations && this.context.typeChecker) {
      const paramsTypeAnnotations = block.typeAnnotations.get("params");
      if (Array.isArray(paramsTypeAnnotations)) {
        paramTypes = paramsTypeAnnotations;
      } else {
        paramTypes = params.map(() => ({ kind: "type" as const, name: "any" }));
      }

      const returnTypeAnnotation = block.typeAnnotations.get("return");
      if (returnTypeAnnotation) {
        returnType = returnTypeAnnotation as TypeAnnotation;
      }
    }

    // Phase 4: Register generic function if :generics present
    const isGeneric = block.generics && block.generics.length > 0;

    this.context.functions.set(block.name, {
      name: block.name,
      params,
      body,
      generics: block.generics, // Store generic type variables
      paramTypes,
      returnType,
    });

    // Phase 3-4: Register function type in type checker
    if (this.context.typeChecker) {
      if (isGeneric && block.generics) {
        // Phase 4: Register generic function
        this.context.typeChecker.registerGenericFunction(block.name, block.generics, paramTypes, returnType);
      } else {
        // Phase 3: Register regular function
        this.context.typeChecker.registerFunction(block.name, paramTypes, returnType);
      }
    }
  }

  private handleIntentBlock(block: Block): void {
    // [INTENT name :key1 val1 :key2 val2 ...]
    const intentFields = new Map<string, ASTNode>();
    for (const [key, value] of block.fields) {
      if (key.startsWith(":")) {
        intentFields.set(key, value as ASTNode);
      }
    }

    this.context.intents.set(block.name, {
      name: block.name,
      fields: intentFields,
    });
  }

  private handleMiddlewareBlock(block: Block): void {
    const config = new Map<string, any>();
    for (const [key, value] of block.fields) {
      if (key.startsWith(":")) {
        config.set(key, this.eval(value as ASTNode));
      }
    }

    this.context.middleware.push({
      name: block.name,
      config,
    });
  }

  private handleWebSocketBlock(block: Block): void {
    // [WEBSOCKET name :path "/ws/events" :on-connect ... :on-message ... :on-disconnect ...]
    // WebSocket support (implement later)
  }

  private handleErrorHandlerBlock(block: Block): void {
    // [ERROR-HANDLER name :on-404 ... :on-500 ...]
    const on404 = block.fields.get("on-404");
    const on500 = block.fields.get("on-500");

    if (on404) this.context.errorHandlers.handlers.set(404, on404 as ASTNode);
    if (on500) this.context.errorHandlers.handlers.set(500, on500 as ASTNode);
  }

  private setupExpressRoutes(): void {
    for (const [, route] of this.context.routes) {
      const method = route.method.toLowerCase();
      const handler = (req: express.Request, res: express.Response) => {
        try {
          this.context.variables.set("request", req);
          this.context.variables.set("response", res);

          const result = this.eval(route.handler);

          // If handler returns an object, send as JSON
          if (typeof result === "object") {
            res.json(result);
          } else {
            res.send(result);
          }
        } catch (error) {
          res.status(500).json({ error: (error as Error).message });
        }
      };

      if (method === "get") {
        this.context.app.get(route.path, handler);
      } else if (method === "post") {
        this.context.app.post(route.path, handler);
      } else if (method === "put") {
        this.context.app.put(route.path, handler);
      } else if (method === "delete") {
        this.context.app.delete(route.path, handler);
      }
    }
  }

  eval(node: ASTNode): any {
    if (!node) return null;

    // Literal values
    if ((node as any).kind === "literal") {
      return (node as Literal).value;
    }

    // Variables
    if ((node as any).kind === "variable") {
      let varName = (node as Variable).name;
      // Phase 4: Handle variable name resolution
      // Lexer removes $ prefix, so variable.name is "x" not "$x"
      // But we store variables with "$" prefix in scope
      // Try both with and without prefix
      if (this.context.variables.has("$" + varName)) {
        return this.context.variables.get("$" + varName);
      }
      return this.context.variables.get(varName);
    }

    // Keywords
    if ((node as any).kind === "keyword") {
      return (node as Keyword).name;
    }

    // S-expressions: (op arg1 arg2 ...)
    if ((node as any).kind === "sexpr") {
      return this.evalSExpr(node as SExpr);
    }

    // Blocks (nested structures)
    if ((node as any).kind === "block") {
      const block = node as Block;
      if (block.type === "Array") {
        const items = block.fields.get("items");
        if (Array.isArray(items)) {
          return items.map((item) => this.eval(item));
        }
      }
      // For other block types, return as object
      const result: Record<string, any> = {};
      for (const [key, value] of block.fields) {
        result[key] = Array.isArray(value) ? value.map((v) => this.eval(v)) : this.eval(value);
      }
      return result;
    }

    return null;
  }

  private evalSExpr(expr: SExpr): any {
    const op = expr.op;
    const args = expr.args.map((arg) => this.eval(arg));

    // Built-in functions
    switch (op) {
      // Arithmetic
      case "+":
        return args.reduce((a: number, b: number) => a + b, 0);
      case "-":
        return args.length === 1 ? -args[0] : args.reduce((a: number, b: number) => a - b);
      case "*":
        return args.reduce((a: number, b: number) => a * b, 1);
      case "/":
        return args.length === 1 ? 1 / args[0] : args.reduce((a: number, b: number) => a / b);

      // Comparison
      case "=":
        return args[0] === args[1];
      case "<":
        return args[0] < args[1];
      case ">":
        return args[0] > args[1];
      case "<=":
        return args[0] <= args[1];
      case ">=":
        return args[0] >= args[1];
      case "!=":
        return args[0] !== args[1];

      // Logical
      case "and":
        return args.every((a) => a);
      case "or":
        return args.some((a) => a);
      case "not":
        return !args[0];

      // String
      case "concat":
        return args.join("");
      case "upper":
        return args[0]?.toString().toUpperCase();
      case "lower":
        return args[0]?.toString().toLowerCase();
      case "length":
        return args[0]?.length || 0;

      // Array/Collection
      case "list":
        return args;
      case "first":
        return args[0]?.[0];
      case "rest":
        return args[0]?.slice(1);
      case "append":
        return [...(args[0] || []), ...args.slice(1)];
      case "reverse":
        return [...(args[0] || [])].reverse();
      case "map":
        // (map fn [1 2 3]) → apply fn to each
        if (typeof args[0] === "function") {
          return (args[1] || []).map(args[0]);
        }
        return args;

      // HTTP responses
      case "json-response":
        // Convert arguments to object
        // If single argument that's already an object, use it
        if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
          return args[0];
        }
        // If it's an array (from list), convert keyword-value pairs to object
        if (Array.isArray(args[0])) {
          const obj: Record<string, any> = {};
          for (let i = 0; i < args[0].length; i += 2) {
            let key = args[0][i];
            const value = args[0][i + 1];
            // Remove leading colon if present
            if (typeof key === "string" && key.startsWith(":")) {
              key = key.substring(1);
            }
            if (typeof key === "string") {
              obj[key] = value;
            }
          }
          return obj;
        }
        return args[0];
      case "html-response":
        return { html: args[0] };

      // Time
      case "now":
        return new Date().toISOString();
      case "server-uptime":
        return Date.now() - this.context.startTime;

      // Control flow
      case "let":
        // (let [[var1 val1] [var2 val2]] body)
        return this.evalLet(expr.args);
      case "if":
        // (if condition then-branch else-branch)
        return args[0] ? this.eval(expr.args[1]) : (expr.args[2] ? this.eval(expr.args[2]) : null);
      case "cond":
        // (cond [test1 result1] [test2 result2] [else default])
        return this.evalCond(expr.args);

      // String/Character Operations (Phase 3 W2: Self-hosting support)
      case "char-at":
        // (char-at "hello" 1) → "e"
        return typeof args[0] === "string" && typeof args[1] === "number"
          ? args[0][Math.floor(args[1])] || ""
          : "";
      case "char-code":
        // (char-code "A") → 65
        if (typeof args[0] === "string" && args[0].length > 0) {
          return args[0].charCodeAt(0);
        }
        throw new Error(`char-code expects non-empty string, got ${typeof args[0]}`);
      case "substring":
        // (substring "hello" 1 4) → "ell"
        return typeof args[0] === "string"
          ? args[0].substring(Math.floor(args[1] || 0), Math.floor(args[2] || args[0].length))
          : "";
      case "is-whitespace?":
        // (is-whitespace? " ") → true
        return /^\s$/.test(String(args[0]));
      case "is-digit?":
        // (is-digit? "5") → true
        return /^\d$/.test(String(args[0]));
      case "is-symbol?":
        // (is-symbol? "add") → true (letters, underscores, dashes)
        return /^[a-zA-Z_\-][a-zA-Z0-9_\-?!]*$/.test(String(args[0]));
      case "split":
        // (split "a,b,c" ",") → ["a" "b" "c"]
        return typeof args[0] === "string" && typeof args[1] === "string"
          ? args[0].split(args[1])
          : [];
      case "join":
        // (join ["a" "b" "c"] ",") → "a,b,c"
        return Array.isArray(args[0]) ? args[0].join(args[1] || "") : "";
      case "trim":
        // (trim "  hello  ") → "hello"
        return typeof args[0] === "string" ? args[0].trim() : "";
      case "uppercase":
        // (uppercase "hello") → "HELLO"
        return typeof args[0] === "string" ? args[0].toUpperCase() : "";
      case "lowercase":
        // (lowercase "HELLO") → "hello"
        return typeof args[0] === "string" ? args[0].toLowerCase() : "";
      case "contains?":
        // (contains? "hello world" "world") → true or (contains? [1 2 3] 2) → true
        if (typeof args[0] === "string" && typeof args[1] === "string") {
          return args[0].includes(args[1]);
        }
        if (Array.isArray(args[0])) {
          return args[0].includes(args[1]);
        }
        return false;
      case "starts-with?":
        // (starts-with? "hello" "he") → true
        return typeof args[0] === "string" && typeof args[1] === "string"
          ? args[0].startsWith(args[1])
          : false;
      case "ends-with?":
        // (ends-with? "hello" "lo") → true
        return typeof args[0] === "string" && typeof args[1] === "string"
          ? args[0].endsWith(args[1])
          : false;
      case "index-of":
        // (index-of "hello world" "o") → 4
        return typeof args[0] === "string" && typeof args[1] === "string"
          ? args[0].indexOf(args[1])
          : -1;
      case "replace":
        // (replace "hello world" "world" "there") → "hello there"
        return typeof args[0] === "string" && typeof args[1] === "string" && typeof args[2] === "string"
          ? args[0].replace(args[1], args[2])
          : "";
      case "repeat":
        // (repeat "a" 3) → "aaa"
        return typeof args[0] === "string" && typeof args[1] === "number"
          ? args[0].repeat(args[1])
          : "";

      // Array Operations
      case "filter":
        // (filter [1 2 3 4] (lambda [$x] (> $x 2))) → [3 4]
        if (!Array.isArray(args[0]) || typeof args[1] !== "function") {
          return args[0] || [];
        }
        return args[0].filter(args[1]);
      case "find":
        // (find [1 2 3] value-to-find) → index or (find [1 2 3] (lambda [$x] ...)) → value
        if (Array.isArray(args[0])) {
          if (typeof args[1] === "function") {
            return args[0].find(args[1]) || null;
          } else {
            // Find index of value
            return args[0].indexOf(args[1]);
          }
        }
        return -1;

      // Array Operations (Phase 3 W4: Standard Library)
      case "first":
        // (first [1 2 3]) → 1
        return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : null;
      case "last":
        // (last [1 2 3]) → 3
        return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
      case "get":
        // (get [1 2 3] 1) → 2
        return Array.isArray(args[0]) && typeof args[1] === "number" ? args[0][args[1]] || null : null;
      case "reverse":
        // (reverse [1 2 3]) → [3 2 1]
        return Array.isArray(args[0]) ? [...args[0]].reverse() : [];
      case "flatten":
        // (flatten [[1 2] [3 4]]) → [1 2 3 4]
        if (!Array.isArray(args[0])) return [];
        const flatten = (arr: any[]): any[] => arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
        return flatten(args[0]);
      case "unique":
        // (unique [1 2 2 3 3 3]) → [1 2 3]
        return Array.isArray(args[0]) ? [...new Set(args[0])] : [];
      case "sort":
        // (sort [3 1 2]) → [1 2 3]
        if (!Array.isArray(args[0])) return [];
        return [...args[0]].sort((a, b) => {
          if (typeof a === "number" && typeof b === "number") return a - b;
          return String(a).localeCompare(String(b));
        });
      case "concat":
        // (concat [1 2] [3 4]) → [1 2 3 4]
        if (!Array.isArray(args[0])) return args[1] || [];
        if (!Array.isArray(args[1])) return args[0] || [];
        return args[0].concat(args[1]);
      case "push":
        // (push [1 2] 3) → [1 2 3]
        if (!Array.isArray(args[0])) return [args[1]];
        return [...args[0], args[1]];
      case "pop":
        // (pop [1 2 3]) → 3 (returns last element)
        return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
      case "shift":
        // (shift [1 2 3]) → 1 (returns first element)
        return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : null;
      case "unshift":
        // (unshift [1 2] 0) → [0 1 2]
        if (!Array.isArray(args[0])) return [args[1]];
        return [args[1], ...args[0]];

      // Type/Utility
      case "typeof":
        return typeof args[0];
      case "str":
        return String(args[0]);
      case "num":
        return Number(args[0]);
      case "bool":
        return Boolean(args[0]);

      // Math Functions (Phase 3 W4: Standard Library)
      case "abs":
        return Math.abs(args[0]);
      case "min":
        return Math.min(...args);
      case "max":
        return Math.max(...args);
      case "floor":
        return Math.floor(args[0]);
      case "ceil":
        return Math.ceil(args[0]);
      case "round":
        return Math.round(args[0]);
      case "sqrt":
        return Math.sqrt(args[0]);
      case "pow":
        return Math.pow(args[0], args[1]);
      case "log":
        return Math.log(args[0]);
      case "exp":
        return Math.exp(args[0]);
      case "sin":
        return Math.sin(args[0]);
      case "cos":
        return Math.cos(args[0]);
      case "tan":
        return Math.tan(args[0]);
      case "random":
        return Math.random();
      case "clamp":
        return Math.max(args[1], Math.min(args[2], args[0]));

      // Function call
      default:
        // Check if it's a user-defined function (regular or generic)
        // Phase 4: Try full name first (op might be "identity[int]")
        if (this.context.functions.has(op)) {
          return this.callUserFunction(op, args);
        }
        // Phase 4: If full name fails, extract base name and try again (for generic calls)
        const bracketMatch = op.match(/^([\w\-]+)\[([^\]]+)\]$/);
        if (bracketMatch && this.context.functions.has(bracketMatch[1])) {
          return this.callUserFunction(op, args);
        }
        throw new Error(`Unknown operator: ${op}`);
    }
  }

  private evalLet(args: ASTNode[]): any {
    if (args.length < 2) {
      throw new Error(`let requires at least 2 arguments`);
    }

    // (let [[var1 val1] [var2 val2]] body)
    const bindings = args[0];
    const body = args[1];

    // Parse bindings
    if ((bindings as any).kind === "block" && (bindings as any).type === "Array") {
      const items = (bindings as any).fields.get("items");
      if (Array.isArray(items)) {
        for (const item of items) {
          if ((item as any).kind === "block" && (item as any).type === "Array") {
            const bindingItems = (item as any).fields.get("items");
            if (Array.isArray(bindingItems) && bindingItems.length >= 2) {
              const varName = (bindingItems[0] as any).name;
              const value = this.eval(bindingItems[1]);
              this.context.variables.set(varName, value);
            }
          }
        }
      }
    }

    // Evaluate body
    return this.eval(body);
  }

  private evalCond(args: ASTNode[]): any {
    // (cond [test1 result1] [test2 result2] ... [else default])
    for (const arg of args) {
      if ((arg as any).kind === "block" && (arg as any).type === "Array") {
        const items = (arg as any).fields.get("items");
        if (Array.isArray(items) && items.length >= 2) {
          const test = this.eval(items[0]);
          if (test) {
            return this.eval(items[1]);
          }
        }
      }
    }
    return null;
  }

  private callUserFunction(name: string, args: any[]): any {
    // Phase 4: Check if this is a generic function call (e.g., identity[int] or first-of-pair[int, string])
    let baseName = name;
    let typeArgs: TypeAnnotation[] | null = null;

    // Match: function-name[T] or function-name[T, K, V] (allow hyphens and alphanumerics)
    const bracketMatch = name.match(/^([\w\-]+)\[([^\]]+)\]$/);
    if (bracketMatch) {
      baseName = bracketMatch[1];
      const typeArgStr = bracketMatch[2];
      // Parse type arguments (comma-separated type names, may have spaces)
      typeArgs = typeArgStr.split(",").map((t) => ({
        kind: "type" as const,
        name: t.trim(),
      }));
    }

    const func = this.context.functions.get(baseName);
    if (!func) {
      throw new Error(`Function not found: ${baseName}`);
    }

    // Phase 4: Handle generic function instantiation
    let isGenericCall = false;
    if (func.generics && func.generics.length > 0) {
      if (!typeArgs) {
        throw new Error(`Generic function '${baseName}' requires type arguments, e.g., ${baseName}[int] or ${baseName}[int string]`);
      }

      if (this.context.typeChecker) {
        const instantiation = this.context.typeChecker.instantiateGenericFunction(baseName, typeArgs);
        if (!instantiation.valid) {
          throw new Error(`Cannot instantiate generic function '${baseName}': ${instantiation.message}`);
        }
      }
      // Mark as generic call to skip standard type checking
      // (instantiation already validated the types)
      isGenericCall = true;
    }

    // Phase 3: Type check function call (skip for generic calls, as instantiation already validated)
    if (!isGenericCall && this.context.typeChecker) {
      const argTypes = args.map((arg) => {
        // Infer type from argument value
        if (typeof arg === "number") return { kind: "type" as const, name: "int" };
        if (typeof arg === "string") return { kind: "type" as const, name: "string" };
        if (typeof arg === "boolean") return { kind: "type" as const, name: "bool" };
        if (Array.isArray(arg)) return { kind: "type" as const, name: "array<any>" };
        if (typeof arg === "function") return { kind: "type" as const, name: "function" };
        return { kind: "type" as const, name: "any" };
      });

      const validation = this.context.typeChecker.checkFunctionCall(baseName, argTypes);
      if (!validation.valid) {
        throw new Error(`Type error in call to '${baseName}': ${validation.message}`);
      }
    }

    // Create new scope
    const savedVars = new Map(this.context.variables);

    // Bind parameters
    for (let i = 0; i < func.params.length; i++) {
      this.context.variables.set(func.params[i], args[i]);
    }

    // Execute body
    const result = this.eval(func.body);

    // Restore scope
    this.context.variables = savedVars;

    return result;
  }

  private getFieldValue(block: Block, key: string, defaultValue: any = null): any {
    const field = block.fields.get(key);
    if (field === undefined) {
      return defaultValue;
    }
    return this.eval(field as ASTNode);
  }

  // Utility: Get context
  getContext(): ExecutionContext {
    return this.context;
  }

  // Utility: Set variable
  setVariable(name: string, value: any): void {
    this.context.variables.set(name, value);
  }
}

export function interpret(blocks: Block[], app?: express.Express): ExecutionContext {
  const interpreter = new Interpreter(app);
  return interpreter.interpret(blocks);
}
