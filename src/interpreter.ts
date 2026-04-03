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
        params.push(...items.map((item: any) => item.name));
      }
    }

    const body = block.fields.get("body") as ASTNode;
    if (!body) {
      throw new Error(`[FUNC ${block.name}] Missing :body`);
    }

    this.context.functions.set(block.name, {
      name: block.name,
      params,
      body,
    });

    // Phase 3: Register function type in type checker if type annotations present
    if (block.typeAnnotations && block.typeAnnotations.has("return") && this.context.typeChecker) {
      const returnType = block.typeAnnotations.get("return") || { kind: "type" as const, name: "any" };
      // For now, register with empty param types (can be enhanced to parse :params types)
      const paramTypes: TypeAnnotation[] = params.map(() => ({ kind: "type" as const, name: "any" }));
      this.context.typeChecker.registerFunction(block.name, paramTypes, returnType as TypeAnnotation);
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
      const varName = (node as Variable).name;
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

      // Type/Utility
      case "typeof":
        return typeof args[0];
      case "str":
        return String(args[0]);
      case "num":
        return Number(args[0]);
      case "bool":
        return Boolean(args[0]);

      // Function call
      default:
        // Check if it's a user-defined function
        if (this.context.functions.has(op)) {
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
    const func = this.context.functions.get(name);
    if (!func) {
      throw new Error(`Function not found: ${name}`);
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
