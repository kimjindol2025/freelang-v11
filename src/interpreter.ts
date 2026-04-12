// FreeLang v9: Interpreter
// AST → 실행 (Express 서버 포함)

import * as fs from "fs";
import * as path from "path";
import { lex } from "./lexer";
import { parse } from "./parser";
import { ASTNode, Block, Literal, Variable, SExpr, Keyword, TypeAnnotation, Pattern, PatternMatch, MatchCase, LiteralPattern, VariablePattern, WildcardPattern, ListPattern, StructPattern, OrPattern, ModuleBlock, ImportBlock, OpenBlock, SearchBlock, LearnBlock, ReasoningBlock, ReasoningSequence, AsyncFunction, AwaitExpression, TryBlock, CatchClause, ThrowExpression, TypeClass, TypeClassInstance, TypeClassMethod, isModuleBlock, isImportBlock, isOpenBlock, isSearchBlock, isLearnBlock, isReasoningBlock, isReasoningSequence, isTryBlock, isThrowExpression, isFuncBlock, isBlock, isControlBlock } from "./ast";
import { TypeChecker, createTypeChecker } from "./type-checker";
import { ModuleNotFoundError, SelectiveImportError, FunctionRegistrationError } from "./errors";
import { Logger, StructuredLogger, getGlobalLogger } from "./logger";
import { extractParamNames, extractFunctions } from "./ast-helpers";
import { FreeLangPromise, resolvedPromise, rejectedPromise } from "./async-runtime";
import { ScopeStack } from "./interpreter-scope"; // Phase A: 렉시컬 스코프
import { WebSearchAdapter } from "./web-search-adapter"; // Phase 9a: WebSearch integration
import { LearnedFactsStore } from "./learned-facts-store"; // Phase 9b: Learning persistence
import { createFileModule } from "./stdlib-file"; // Phase 10: File I/O
import { createErrorModule } from "./stdlib-error"; // Phase 11: Error handling
import { createHttpModule } from "./stdlib-http"; // Phase 12: HTTP Client
import { createShellModule } from "./stdlib-shell"; // Phase 12: Shell execution
import { createDataModule } from "./stdlib-data"; // Phase 13: Data Transform
import { createCollectionModule } from "./stdlib-collection"; // Phase 14: Collection + Control
import { createAgentModule } from "./stdlib-agent"; // Phase 15: AI Agent State Machine
import { createTimeModule } from "./stdlib-time"; // Phase 16: Time + Logging + Monitoring
import { createCryptoModule } from "./stdlib-crypto"; // Phase 17: Crypto + UUID + Regex
import { createWorkflowModule } from "./stdlib-workflow"; // Phase 18: Workflow Engine
import { createResourceModule } from "./stdlib-resource"; // Phase 19: Server Resource Search
import { createHttpServerModule } from "./stdlib-http-server"; // Phase 4a: Pure HTTP Server (Express-free)
import { createDbModule } from "./stdlib-db";          // Phase 20: DB Driver
import { createWsModule } from "./stdlib-ws";          // Phase 21: WebSocket
import { createWscModule } from "./stdlib-wsc";        // Phase 57: WebSocket Client (Tunnel)
import { createAuthModule } from "./stdlib-auth";      // Phase 21: Auth (JWT, API key, hash)
import { createCacheModule } from "./stdlib-cache";    // Phase 21: In-memory TTL cache
import { createPubSubModule } from "./stdlib-pubsub";  // Phase 21: Pub/Sub events
import { createProcessModule } from "./stdlib-process"; // Phase 22: Process (env + SIGTERM)
import { createAsyncModule } from "./stdlib-async";     // Phase 23: Async/await primitives
import { createModuleSystem } from "./stdlib-module";   // Phase 24: Module system
import { pgBuiltins } from "./stdlib-pg";               // PostgreSQL + JWT + AI
import { evalBuiltin } from "./eval-builtins";                       // Phase 57: Built-in functions
import { evalAiBlock } from "./eval-ai-blocks";                       // Phase 57: AI blocks
import { evalSpecialForm } from "./eval-special-forms";               // Phase 57: Special forms
import { handleReasoningSequence } from "./eval-reasoning-sequence";  // Phase 57: Reasoning sequence
import { handleSearchBlock as _handleSearchBlock, handleLearnBlock as _handleLearnBlock, handleReasoningBlock as _handleReasoningBlock } from "./eval-ai-handlers"; // Phase 57: AI handlers
import { evalModuleBlock as _evalModuleBlock, evalImportBlock as _evalImportBlock, evalImportFromFile as _evalImportFromFile, evalOpenBlock as _evalOpenBlock } from "./eval-module-system"; // Phase 57: Module system

// ExecutionContext: 런타임 상태 관리
export interface ExecutionContext {
  functions: Map<string, FreeLangFunction>;
  routes: Map<string, FreeLangRoute>;
  intents: Map<string, Intent>;
  variables: ScopeStack;
  server?: any;
  middleware: FreeLangMiddleware[];
  errorHandlers: ErrorHandler;
  startTime: number;
  lastValue?: any; // Last evaluated value (for REPL/testing)
  typeChecker?: TypeChecker; // Phase 3: Type system
  typeClasses?: Map<string, TypeClassInfo>; // Phase 5 Week 2: Type class registry
  typeClassInstances?: Map<string, TypeClassInstanceInfo>; // Phase 5 Week 2: Type class instances
  modules?: Map<string, ModuleInfo>; // Phase 6: Module registry
  cache?: Map<string, any>; // Phase 9a: Search result caching
  learned?: Map<string, any>; // Phase 9b: Learned data storage (key -> data)
  reasoning?: Map<string, any>; // Phase 9c: Reasoning state storage (stage-timestamp -> reasoning state)
  currentSearches?: Map<string, any>; // Phase 9a: Current reasoning sequence search results
  currentLearned?: Map<string, any>; // Phase 9b: Current reasoning sequence learned data
}

export interface FreeLangFunction {
  name: string;
  params: string[];
  body: ASTNode;
  generics?: string[]; // Generic type variables: [T, K, V] (Phase 4)
  paramTypes?: TypeAnnotation[]; // Parameter types for type checking (Phase 3)
  returnType?: TypeAnnotation; // Return type for type checking (Phase 3)
  capturedEnv?: Map<string, any>; // Phase A: 클로저 환경 (fn으로 define된 함수)
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

// Phase 5 Week 2: Type Class System
export interface TypeClassInfo {
  name: string;
  typeParams: string[];
  methods: Map<string, string>;  // method name → type signature
}

export interface TypeClassInstanceInfo {
  className: string;
  concreteType: string;
  implementations: Map<string, any>;  // method name → implementation function
}

// Phase 6: Module System
export interface ModuleInfo {
  name: string;
  exports: string[];  // 내보낸 함수 이름들
  functions: Map<string, FreeLangFunction>;  // 모듈 내 정의된 함수들
}

// Interpreter class
export class Interpreter {
  public context: ExecutionContext; // Public for testing
  public logger: Logger;
  public searchAdapter: WebSearchAdapter; // Phase 9a: WebSearch
  public learnedFactsStore: LearnedFactsStore; // Phase 9b: Learning persistence
  public currentLine = 0; // FreeLang source line tracking
  public callDepth = 0;
  public static readonly MAX_CALL_DEPTH = 500;
  // Phase 52: FL 파일 import 지원
  public importedFiles: Set<string> = new Set();
  public currentFilePath: string = process.cwd();

  constructor(logger?: Logger) {
    this.logger = logger || getGlobalLogger();
    this.context = {
      functions: new Map(),
      routes: new Map(),
      intents: new Map(),
      variables: new ScopeStack(),
      middleware: [],
      errorHandlers: { handlers: new Map() },
      startTime: Date.now(),
      typeChecker: createTypeChecker(), // Phase 3: Initialize type checker
      typeClasses: new Map(),             // Phase 5 Week 2: Type class registry
      typeClassInstances: new Map(),      // Phase 5 Week 2: Type class instance registry
      modules: new Map(),                 // Phase 6: Module registry
    };

    // Phase 9a: Initialize WebSearchAdapter (mock mode by default)
    // Production: Use BRAVE_SEARCH_KEY or SERPER_API_KEY from env
    const apiKey = process.env.BRAVE_SEARCH_KEY || process.env.SERPER_API_KEY;
    const provider = process.env.BRAVE_SEARCH_KEY ? "brave" : process.env.SERPER_API_KEY ? "serper" : "mock";
    this.searchAdapter = new WebSearchAdapter(apiKey, provider as any);

    // Phase 9b: Initialize LearnedFactsStore (persistent learning)
    this.learnedFactsStore = new LearnedFactsStore("./data/learned-facts.json", 30);

    // Phase 10-20: Register all stdlib modules
    this.registerModule(createFileModule());
    this.registerModule(createErrorModule());
    this.registerModule(createHttpModule());
    this.registerModule(createShellModule());
    this.registerModule(createDataModule());
    this.registerModule(createCollectionModule());
    this.registerModule(createAgentModule());
    this.registerModule(createTimeModule());
    this.registerModule(createCryptoModule());
    this.registerModule(createWorkflowModule());
    this.registerModule(createResourceModule());
    // Phase 4a: Pure HTTP Server (overrides Express version)
    this.registerModule(createHttpServerModule(
      (n, a) => this.callUserFunction(n, a),
      (fnValue, a) => this.callFunctionValue(fnValue, a)
    ));
    this.registerModule(createDbModule());
    this.registerModule(createWsModule((n, a) => this.callUserFunction(n, a)));
    this.registerModule(createWscModule((n, a) => this.callUserFunction(n, a))); // Phase 57: WebSocket Client
    this.registerModule(createAuthModule());
    this.registerModule(createCacheModule());
    this.registerModule(createPubSubModule((n, a) => this.callUserFunction(n, a)));
    this.registerModule(createProcessModule()); // Phase 22: env_load, on_sigterm
    this.registerModule(createAsyncModule((n, a) => this.callUserFunction(n, a))); // Phase 23: async_call, promise_*
    this.registerModule(createModuleSystem());  // Phase 24: module_*, namespace_*
    this.registerModule(pgBuiltins);            // PostgreSQL + JWT + AI

    // Phase 49: FL 표준 라이브러리 (fl-map, fl-filter, fl-reduce, Maybe, Result 등)
    this.loadFlStdlib();

    // Phase 5 Week 2: Register built-in type classes and instances
    this.registerBuiltinTypeClasses();
  }

  // Phase 49: freelang-stdlib.fl 로드 — fl-map, fl-filter, fl-reduce 등
  // TS 내장 some/none/ok/err({tag,kind,value})와 FL 배열 표현["some",v]이 다르므로
  // array util만 로드하고, Maybe/Result는 TS 내장 + ts-compat helper를 제공
  private loadFlStdlib(): void {
    try {
      const stdlibPath = path.join(__dirname, "freelang-stdlib.fl");
      if (!fs.existsSync(stdlibPath)) return;
      const src = fs.readFileSync(stdlibPath, "utf-8");
      this.interpret(parse(lex(src)));
    } catch {
      // stdlib 로드 실패 시 조용히 스킵 (런타임은 계속 동작)
    }

    // TS 내장 {tag,kind,value} 표현용 Maybe/Result helpers
    // TS built-in: (ok v)→{tag:"Ok",...}  (some v)→{tag:"Some",...}  etc.
    const isSomeVal = (m: any) => Array.isArray(m) ? m[0] === "some" : m?.tag === "Some";
    const getVal    = (m: any) => Array.isArray(m) ? m[1] : m?.value;
    const callFn    = (fn: any, v: any) =>
      typeof fn === "string" ? this.callUserFunction(fn, [v]) : fn(v);

    const tsHelpers: Record<string, (...a: any[]) => any> = {
      "ok?":          (r: any) => r?.tag === "Ok",
      "err?":         (r: any) => r?.tag === "Err",
      "some?":        (m: any) => isSomeVal(m),
      "none?":        (m: any) => Array.isArray(m) ? m[0] === "none" : m?.tag === "None",
      "maybe-or":     (m: any, d: any) => isSomeVal(m) ? getVal(m) : d,
      "maybe-map":    (m: any, fn: any) => isSomeVal(m)
        ? { tag: "Some", kind: "Option", value: callFn(fn, getVal(m)) }
        : m,
      "maybe-chain":  (m: any, fn: any) => isSomeVal(m) ? callFn(fn, getVal(m)) : m,
      "result-or":    (r: any, d: any) => r?.tag === "Ok" ? r.value : d,
      "result-map":   (r: any, fn: any) => r?.tag === "Ok"
        ? { tag: "Ok", kind: "Result", value: callFn(fn, r.value) }
        : r,
      "result-chain": (r: any, fn: any) => r?.tag === "Ok" ? callFn(fn, r.value) : r,
    };
    for (const [name, fn] of Object.entries(tsHelpers)) {
      this.context.functions.set(name, { name, params: [], body: fn as any });
    }
  }

  private registerModule(module: Record<string, unknown>): void {
    for (const [name, fn] of Object.entries(module)) {
      this.context.functions.set(name, { name, params: [], body: fn as any });
      if (this.context.typeChecker) {
        const paramTypes = Array((fn as Function).length).fill({ kind: "type" as const, name: "any" });
        this.context.typeChecker.registerFunction(name, paramTypes, { kind: "type" as const, name: "any" });
      }
    }
  }

  interpret(blocks: ASTNode[]): ExecutionContext {
    try {
      for (const node of blocks) {
        if (isImportBlock(node)) {
          this.evalImportBlock(node);
        } else if (isOpenBlock(node)) {
          this.evalOpenBlock(node);
        } else if (isSearchBlock(node)) {
          this.context.lastValue = this.handleSearchBlock(node);
        } else if (isLearnBlock(node)) {
          this.context.lastValue = this.handleLearnBlock(node);
        } else if (isReasoningBlock(node)) {
          this.context.lastValue = this.handleReasoningBlock(node);
        } else if (isReasoningSequence(node)) {
          this.context.lastValue = this.handleReasoningSequence(node);
        } else if (isModuleBlock(node)) {
          this.evalModuleBlock(node);
        } else if (isBlock(node)) {
          this.evalBlock(node);
        } else {
          this.context.lastValue = this.eval(node);
        }
      }
    } catch (e: any) {
      if (e instanceof Error && this.currentLine > 0 && !e.message.includes("FreeLang line")) {
        e.message = `FreeLang line ${this.currentLine}: ${e.message}`;
      }
      throw e;
    }

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

  private serverConfig: { port: number; host: string } | null = null;

  private handleServerBlock(block: Block): void {
    // [SERVER name :port 3009 :host "0.0.0.0" ...]
    const port = Number(this.getFieldValue(block, "port") || 3009);
    const host = String(this.getFieldValue(block, "host") || "0.0.0.0");
    this.serverConfig = { port, host };
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
            // Normalize to $-prefix so callUserFunction stores correctly
            return item.name.startsWith("$") ? item.name : "$" + item.name;
          }
          // Fallback
          return item.name ? (item.name.startsWith("$") ? item.name : "$" + item.name) : "$unknown";
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

  eval(node: ASTNode): any {
    if (!node) return null;

    // Literal values
    if ((node as any).kind === "literal") {
      const lit = node as Literal;
      // 문자열 보간: "Hello {$name}!" 또는 "결과: {(+ $a $b)}"
      if (lit.type === "string" && typeof lit.value === "string" &&
          (lit.value.includes("{$") || lit.value.includes("{("))) {
        return this.interpolateString(lit.value as string);
      }
      // Self-hosting: bare symbol (without $) as variable reference
      // e.g. (define i 0) then (+ i 1) → looks up $i
      if (lit.type === "symbol" && typeof lit.value === "string") {
        // true/false/null always evaluate to their proper JS values
        if (lit.value === "true")  return true;
        if (lit.value === "false") return false;
        if (lit.value === "null")  return null;
        const varName = "$" + lit.value;
        if (this.context.variables.has(varName)) {
          return this.context.variables.get(varName);
        }
      }
      return lit.value;
    }

    // Variables
    if ((node as any).kind === "variable") {
      let varName = (node as Variable).name;
      // Self-hosting: dot field access — "env.vars" → resolve "env", then access "vars"
      if (varName.includes(".")) {
        const parts = varName.split(".");
        let obj = this.context.variables.has("$" + parts[0])
          ? this.context.variables.get("$" + parts[0])
          : this.context.variables.get(parts[0]);
        for (let p = 1; p < parts.length; p++) {
          if (obj === null || obj === undefined) return null;
          obj = typeof obj === "object" ? obj[parts[p]] : null;
        }
        return obj ?? null;
      }
      // Phase 4: Handle variable name resolution
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

      // Control blocks (FUNC, SERVER, ROUTE, etc.) must NOT be eval'd here
      // They should be handled by interpret() or evalBlock(), not eval()
      if (isBlock(block) && isControlBlock(block)) {
        throw new Error(`Control block [${block.type}] should not be eval'd directly. This block must be processed by interpret() or evalBlock().`);
      }

      if (block.type === "Array") {
        const items = block.fields.get("items");
        if (Array.isArray(items)) {
          return items.map((item) => this.eval(item));
        }
      }
      // Phase 9d: Map literal: {:key1 value1 :key2 value2 ...}
      if (block.type === "Map") {
        const result: Record<string, any> = {};
        for (const [key, value] of block.fields) {
          result[key] = Array.isArray(value) ? value.map((v) => this.eval(v)) : this.eval(value);
        }
        return result;
      }
      // For other block types (should only be Array/Map), throw error
      throw new Error(`Unknown block type: ${block.type}`);
    }

    // Pattern matching (Phase 4 Week 3-4)
    if ((node as any).kind === "pattern-match") {
      return this.evalPatternMatch(node as PatternMatch);
    }

    // Function value (Phase 4 Week 1: First-class functions)
    if ((node as any).kind === "function-value") {
      return node; // Return the function value as-is
    }

    // Type Class (Phase 5 Week 2: Type Classes)
    if ((node as any).kind === "type-class") {
      return this.evalTypeClass(node as TypeClass);
    }

    // Type Class Instance (Phase 5 Week 2: Type Classes)
    if ((node as any).kind === "type-class-instance") {
      return this.evalInstance(node as TypeClassInstance);
    }

    // Try-catch-finally blocks (Phase 11)
    if ((node as any).kind === "try-block") {
      return this.evalTryBlock(node as TryBlock);
    }

    // Throw expressions (Phase 11)
    if ((node as any).kind === "throw") {
      return this.evalThrow(node as ThrowExpression);
    }

    return null;
  }

  private evalSExpr(expr: SExpr): any {
    if (expr.line !== undefined) this.currentLine = expr.line;
    const op = expr.op;

    // Phase 5 Week 2: Method dispatch (ClassName:methodName pattern)
    if (typeof op === "string" && op.includes(":")) {
      const [className, methodName] = op.split(":");

      // For now, assume the first argument is the concrete type value
      // In future, we can extract the type from the value itself
      if (expr.args.length > 0) {
        const concreteValue = this.eval(expr.args[0]);
        const concreteType = this.getConcreteType(concreteValue);

        if (concreteType) {
          const method = this.resolveMethod(className, concreteType, methodName);
          if (method) {
            // Evaluate remaining arguments
            const args = expr.args.slice(1).map((arg) => this.eval(arg));

            // Call the method with the concrete value as first argument
            if ((method as any).kind === "function-value") {
              return this.callFunctionValue(method, [concreteValue, ...args]);
            } else if (typeof method === "function") {
              return method(concreteValue, ...args);
            }
          }
        }
      }

      // If method dispatch fails, fall through to standard function lookup
    }

    // Phase 57: Dispatch to specialized modules
    const AI_OPS = new Set(["search","fetch","learn","recall","remember","forget","observe","analyze","decide","act","verify","await"]);
    const SPECIAL_OPS = new Set(["fn","async","set!","define","func-ref","call","compose","pipe","let","set","if","cond","do","begin","progn","loop","recur","while","and","or"]);

    if (AI_OPS.has(op)) return evalAiBlock(this, op, expr);
    if (SPECIAL_OPS.has(op)) return evalSpecialForm(this, op, expr);

    // map (3-arg comprehension form) → evalSpecialForm; otherwise falls through to builtins
    if (op === "map" && expr.args.length === 3) {
      const mapResult = evalSpecialForm(this, op, expr);
      if (mapResult !== undefined) return mapResult;
    }

    // Evaluate args for builtins
    const args = expr.args.map((arg) => this.eval(arg));

    // Phase 52: qualified function call (module:func pattern) — check BEFORE switch
    if (args.length >= 1 && typeof args[0] === "string") {
      const qualifiedName = `${op}:${args[0]}`;
      if (this.context.functions.has(qualifiedName)) {
        return this.callUserFunction(qualifiedName, args.slice(1));
      }
    }

    return evalBuiltin(this, op, args, expr);
  }

  // 문자열 보간 처리: {$var} 와 {(expr)} 모두 지원
  public interpolateString(template: string): string {
    let result = "";
    let i = 0;
    while (i < template.length) {
      if (template[i] === "{" && i + 1 < template.length) {
        const next = template[i + 1];
        if (next === "$") {
          // {$varName} 패턴
          const end = template.indexOf("}", i);
          if (end > i) {
            const varName = template.slice(i + 2, end);
            let val: any;
            if (varName.includes(".")) {
              const parts = varName.split(".");
              val = this.context.variables.has("$" + parts[0])
                ? this.context.variables.get("$" + parts[0])
                : this.context.variables.get(parts[0]);
              for (let p = 1; p < parts.length; p++) {
                if (val === null || val === undefined) { val = null; break; }
                val = typeof val === "object" ? val[parts[p]] : null;
              }
            } else {
              val = this.context.variables.has("$" + varName)
                ? this.context.variables.get("$" + varName)
                : this.context.variables.get(varName);
            }
            result += val === null || val === undefined ? "" : String(val);
            i = end + 1;
            continue;
          }
        } else if (next === "(") {
          // {(expr)} 패턴 — 균형 잡힌 괄호 탐색
          let depth = 0;
          let j = i + 1; // '{' 이후
          while (j < template.length) {
            if (template[j] === "(") depth++;
            else if (template[j] === ")") { depth--; if (depth === 0) break; }
            j++;
          }
          if (j < template.length && j + 1 < template.length && template[j + 1] === "}") {
            const exprStr = template.slice(i + 1, j + 1); // "(expr)"
            try {
              const tokens = lex(exprStr);
              const ast = parse(tokens);
              const val = ast.length > 0 ? this.eval(ast[0]) : null;
              result += val === null || val === undefined ? "" : String(val);
            } catch {
              result += template.slice(i, j + 2); // 오류 시 원본 유지
            }
            i = j + 2; // ')' + '}' 건너뜀
            continue;
          }
        }
      }
      result += template[i];
      i++;
    }
    return result;
  }

  // 값을 사람/AI가 읽기 좋은 문자열로 변환
  public toDisplayString(val: any): string {
    if (val === null || val === undefined) return "null";
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (Array.isArray(val)) return "[" + val.map((v) => this.toDisplayString(v)).join(", ") + "]";
    if (typeof val === "object") {
      if (val.kind === "function-value") return `<fn:${val.name || "λ"}>`;
      const entries = Object.entries(val)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => `${k}: ${this.toDisplayString(v)}`);
      return "{" + entries.join(", ") + "}";
    }
    return String(val);
  }

  public callUserFunction(name: string, args: any[]): any {
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
      // Skip type check for dynamically defined inner functions (define inside function body)
      if (!validation.valid && validation.message !== `Unknown function: ${baseName}`) {
        throw new Error(`Type error in call to '${baseName}': ${validation.message}`);
      }
    }

    // Native JS function (Phase 10/11 builtins): call directly with args
    if (typeof func.body === "function") {
      return (func.body as Function)(...args);
    }

    // Validate arg count for user-defined functions
    if (func.params.length > args.length) {
      throw new Error(`Function '${baseName}' expects ${func.params.length} args, got ${args.length}`);
    }

    if (this.callDepth >= Interpreter.MAX_CALL_DEPTH) {
      throw new Error(`FreeLang line ${this.currentLine}: Maximum call depth exceeded (${Interpreter.MAX_CALL_DEPTH}) — possible infinite recursion in '${baseName}'`);
    }

    // Phase 54: For namespaced functions (list:mean), temporarily expose same-prefix
    // functions without prefix so internal cross-calls (sum $arr) resolve correctly
    const prefixMatch = baseName.match(/^([^:]+):/);
    const tempAliases: string[] = [];
    if (prefixMatch) {
      const prefix = prefixMatch[1] + ":";
      for (const [fname, fval] of this.context.functions) {
        if (fname.startsWith(prefix)) {
          const unqualified = fname.slice(prefix.length);
          if (!this.context.functions.has(unqualified)) {
            this.context.functions.set(unqualified, fval);
            tempAliases.push(unqualified);
          }
        }
      }
    }

    // 클로저: capturedEnv가 있으면 해당 환경에서 실행
    if (func.capturedEnv) {
      const savedStack = this.context.variables.saveStack();
      this.callDepth++;
      try {
        this.context.variables.fromSnapshot(func.capturedEnv);
        for (let i = 0; i < func.params.length; i++) {
          this.context.variables.set(func.params[i], args[i]);
        }
        return this.eval(func.body);
      } finally {
        this.callDepth--;
        this.context.variables.restoreStack(savedStack);
        for (const alias of tempAliases) {
          this.context.functions.delete(alias);
        }
      }
    }

    // 일반 함수: 새 렉시컬 스코프 생성 — 함수 내 define이 전역 오염 방지
    this.context.variables.push();
    this.callDepth++;

    try {
      for (let i = 0; i < func.params.length; i++) {
        this.context.variables.set(func.params[i], args[i]);
      }
      return this.eval(func.body);
    } finally {
      this.callDepth--;
      this.context.variables.pop();
      for (const alias of tempAliases) {
        this.context.functions.delete(alias);
      }
    }
  }

  public callFunctionValue(fn: any, args: any[]): any {
    if ((fn as any).kind !== "function-value") {
      throw new Error(`Expected function-value, got ${(fn as any).kind}`);
    }

    if (this.callDepth >= Interpreter.MAX_CALL_DEPTH) {
      throw new Error(`FreeLang line ${this.currentLine}: Maximum call depth exceeded (${Interpreter.MAX_CALL_DEPTH}) — possible infinite recursion`);
    }

    const savedStack = this.context.variables.saveStack();
    this.callDepth++;

    try {
      this.context.variables.fromSnapshot(fn.capturedEnv);
      for (let i = 0; i < fn.params.length; i++) {
        this.context.variables.set(fn.params[i], args[i]);
      }
      return this.eval(fn.body);
    } finally {
      this.callDepth--;
      this.context.variables.restoreStack(savedStack);
    }
  }

  public callAsyncFunctionValue(fn: any, args: any[]): FreeLangPromise {
    // Phase 7: Call an async function value (closure that returns Promise)
    if ((fn as any).kind !== "async-function-value") {
      throw new Error(`Expected async-function-value, got ${(fn as any).kind}`);
    }

    // Return a new Promise that executes the async function
    return new FreeLangPromise((resolve, reject) => {
      const savedStack = this.context.variables.saveStack();
      try {
        this.context.variables.fromSnapshot(fn.capturedEnv);
        for (let i = 0; i < fn.params.length; i++) {
          this.context.variables.set(fn.params[i], args[i]);
        }
        const result = this.eval(fn.body);
        if (result instanceof FreeLangPromise) {
          result
            .then((value) => resolve(value))
            .catch((error) => reject(error));
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(error as Error);
      } finally {
        this.context.variables.restoreStack(savedStack);
      }
    });
  }

  public callFunction(fn: any, args: any[]): any {
    // Phase 4 Week 2: Universal function caller
    // Handles: function-value, JavaScript functions, FreeLangFunction
    // Phase 7: Also handles builtin-function wrappers (Promise resolve/reject)
    if ((fn as any).kind === "builtin-function") {
      // Phase 7: Built-in wrapper function (for Promise resolve/reject)
      return (fn as any).fn(args.map((arg) => this.eval(arg)));
    } else if ((fn as any).kind === "function-value") {
      return this.callFunctionValue(fn, args);
    } else if ((fn as any).kind === "async-function-value") {
      // Phase 7: Handle async function calls
      return this.callAsyncFunctionValue(fn, args);
    } else if (typeof fn === "function") {
      return fn(...args);
    } else if ((fn as any).params && (fn as any).body) {
      // FreeLangFunction
      return this.callUserFunction(fn.name || "anonymous", args);
    } else {
      throw new Error(`Cannot call ${typeof fn}`);
    }
  }

  private getFieldValue(block: Block, key: string, defaultValue: any = null): any {
    const field = block.fields.get(key);
    if (field === undefined) {
      return defaultValue;
    }
    return this.eval(field as ASTNode);
  }

  // ===== Pattern Matching (Phase 4 Week 3-4) =====

  public evalPatternMatch(match: PatternMatch): any {
    // Evaluate the value to match
    const value = this.eval(match.value);

    // Try each case in order
    for (const caseItem of match.cases) {
      // Try to match pattern (only save/restore pattern-binding variables, not all state)
      const matchResult = this.matchPattern(caseItem.pattern, value);

      if (matchResult.matched) {
        this.context.variables.push();
        for (const [varName] of matchResult.bindings) {
          this.context.variables.set("$" + varName, matchResult.bindings.get(varName));
        }

        // Check guard condition if present
        if (caseItem.guard) {
          const guardResult = this.eval(caseItem.guard);
          if (!guardResult) {
            this.context.variables.pop();
            continue;
          }
        }

        try {
          return this.eval(caseItem.body);
        } finally {
          this.context.variables.pop();
        }
      }
    }

    // No case matched, try default case
    if (match.defaultCase) {
      return this.eval(match.defaultCase);
    }

    // No match found
    throw new Error("Pattern match exhausted without matching case");
  }

  // Phase 11: Evaluate try-catch-finally blocks
  public evalTryBlock(tryBlock: TryBlock): any {
    let result: any;
    let errorCaught = false;

    try {
      // Execute try body
      result = this.eval(tryBlock.body);
    } catch (error: any) {
      errorCaught = true;
      let handled = false;

      // Try each catch clause
      if (tryBlock.catchClauses && tryBlock.catchClauses.length > 0) {
        for (const catchClause of tryBlock.catchClauses) {
          // For now, all catch clauses handle all errors (no pattern matching)
          // In future, could support typed catch (catch [IOException e] ...)

          this.context.variables.push();
          if (catchClause.variable) {
            this.context.variables.set("$" + catchClause.variable, error);
          }

          try {
            result = this.eval(catchClause.handler);
            handled = true;
            break;
          } catch (innerError: any) {
            throw innerError;
          } finally {
            this.context.variables.pop();
          }
        }
      }

      // If no catch clause handled it, re-throw
      if (!handled) {
        throw error;
      }
    } finally {
      // Always execute finally block if present
      if (tryBlock.finallyBlock) {
        this.eval(tryBlock.finallyBlock);
      }
    }

    return result;
  }

  // Phase 11: Evaluate throw expressions
  public evalThrow(throwExpr: ThrowExpression): any {
    const error = this.eval(throwExpr.argument);

    // Throw the evaluated error value
    if (error instanceof Error) {
      throw error;
    } else if (typeof error === "string") {
      throw new Error(error);
    } else if (error && typeof error === "object" && error.message) {
      throw new Error(error.message);
    } else {
      throw new Error(String(error));
    }
  }

  // Try to match a pattern against a value
  // Returns {matched: boolean, bindings: Map<string, any>}
  public matchPattern(pattern: Pattern, value: any): { matched: boolean; bindings: Map<string, any> } {
    const bindings = new Map<string, any>();

    // Literal pattern: match exact value
    if ((pattern as any).kind === "literal-pattern") {
      const litPattern = pattern as LiteralPattern;
      if (litPattern.value === value) {
        return { matched: true, bindings };
      }
      return { matched: false, bindings };
    }

    // Variable pattern: always matches, binds variable
    if ((pattern as any).kind === "variable-pattern") {
      const varPattern = pattern as VariablePattern;
      bindings.set(varPattern.name, value);
      return { matched: true, bindings };
    }

    // Wildcard pattern: always matches, no binding
    if ((pattern as any).kind === "wildcard-pattern") {
      return { matched: true, bindings };
    }

    // List pattern: match array elements
    if ((pattern as any).kind === "list-pattern") {
      const listPattern = pattern as ListPattern;

      // Value must be an array
      if (!Array.isArray(value)) {
        return { matched: false, bindings };
      }

      // Match elements
      const elements = listPattern.elements;
      let matchedCount = 0;

      for (let i = 0; i < elements.length; i++) {
        if (i >= value.length) {
          // Not enough elements
          return { matched: false, bindings };
        }

        const elemResult = this.matchPattern(elements[i], value[i]);
        if (!elemResult.matched) {
          return { matched: false, bindings };
        }

        // Merge bindings
        for (const [name, val] of elemResult.bindings) {
          bindings.set(name, val);
        }

        matchedCount++;
      }

      // Handle rest element: [x & rest]
      if (listPattern.restElement) {
        const restValues = value.slice(matchedCount);
        bindings.set(listPattern.restElement, restValues);
      } else if (matchedCount < value.length) {
        // If no rest element, must match exact length
        return { matched: false, bindings };
      }

      return { matched: true, bindings };
    }

    // Struct pattern: match object fields
    if ((pattern as any).kind === "struct-pattern") {
      const structPattern = pattern as StructPattern;

      // Value must be an object
      if (typeof value !== "object" || value === null) {
        return { matched: false, bindings };
      }

      // Match each field
      for (const [fieldName, fieldPattern] of structPattern.fields) {
        const fieldValue = value[fieldName];
        const fieldResult = this.matchPattern(fieldPattern, fieldValue);
        if (!fieldResult.matched) {
          return { matched: false, bindings };
        }

        // Merge bindings
        for (const [name, val] of fieldResult.bindings) {
          bindings.set(name, val);
        }
      }

      return { matched: true, bindings };
    }

    // Or pattern: try alternatives until one matches
    if ((pattern as any).kind === "or-pattern") {
      const orPattern = pattern as OrPattern;

      for (const alternative of orPattern.alternatives) {
        const altResult = this.matchPattern(alternative, value);
        if (altResult.matched) {
          return altResult; // Return first matching alternative
        }
      }

      // None of the alternatives matched
      return { matched: false, bindings };
    }

    // Unknown pattern type
    return { matched: false, bindings };
  }

  // Utility: Get context
  getContext(): ExecutionContext {
    return this.context;
  }

  // Utility: Set variable
  setVariable(name: string, value: any): void {
    this.context.variables.set(name, value);
  }

  // Phase 5 Week 2: Register built-in type classes and instances
  public registerBuiltinTypeClasses(): void {
    if (!this.context.typeClasses || !this.context.typeClassInstances) {
      return;
    }

    // Define Monad type class
    this.context.typeClasses.set("Monad", {
      name: "Monad",
      typeParams: ["M"],
      methods: new Map([
        ["pure", "fn [a] (M a)"],
        ["bind", "fn [m f] (M b)"],
        ["map", "fn [m f] (M b)"],
      ]),
    });

    // Define Functor type class
    this.context.typeClasses.set("Functor", {
      name: "Functor",
      typeParams: ["F"],
      methods: new Map([["fmap", "fn [f a] (F a)"]]),
    });

    // Instance: Result → Monad
    this.context.typeClassInstances.set("Monad[Result]", {
      className: "Monad",
      concreteType: "Result",
      implementations: new Map([
        ["pure", (x: any) => ({ tag: "Ok", value: x, kind: "Result" })],
        ["bind", this.bindMonad.bind(this)],
        ["map", this.mapResult.bind(this)],
      ]),
    });

    // Instance: Option → Monad
    this.context.typeClassInstances.set("Monad[Option]", {
      className: "Monad",
      concreteType: "Option",
      implementations: new Map([
        ["pure", (x: any) => ({ tag: "Some", value: x, kind: "Option" })],
        ["bind", this.bindMonad.bind(this)],
        ["map", this.mapOption.bind(this)],
      ]),
    });

    // Instance: List → Monad (FlatMap)
    this.context.typeClassInstances.set("Monad[List]", {
      className: "Monad",
      concreteType: "List",
      implementations: new Map([
        ["pure", (x: any) => [x]],
        ["bind", this.bindList.bind(this)],
        ["map", this.mapList.bind(this)],
      ]),
    });

    // Instance: Result → Functor
    this.context.typeClassInstances.set("Functor[Result]", {
      className: "Functor",
      concreteType: "Result",
      implementations: new Map([["fmap", this.mapResult.bind(this)]]),
    });

    // Instance: Option → Functor
    this.context.typeClassInstances.set("Functor[Option]", {
      className: "Functor",
      concreteType: "Option",
      implementations: new Map([["fmap", this.mapOption.bind(this)]]),
    });

    // Instance: List → Functor
    this.context.typeClassInstances.set("Functor[List]", {
      className: "Functor",
      concreteType: "List",
      implementations: new Map([["fmap", this.mapList.bind(this)]]),
    });
  }

  // Helper methods for type class instances
  private bindMonad(monad: any, fn: any): any {
    if ((monad as any).kind === "Result") {
      if ((monad as any).tag === "Ok") {
        return this.callFunction(fn, [(monad as any).value]);
      }
      return monad;
    }
    if ((monad as any).kind === "Option") {
      if ((monad as any).tag === "Some") {
        return this.callFunction(fn, [(monad as any).value]);
      }
      return monad;
    }
    return monad;
  }

  private bindList(list: any[], fn: any): any[] {
    let result: any[] = [];
    for (const item of list) {
      const transformed = this.callFunction(fn, [item]);
      if (Array.isArray(transformed)) {
        result = result.concat(transformed);
      } else {
        result.push(transformed);
      }
    }
    return result;
  }

  private mapResult(result: any, fn: any): any {
    if ((result as any).tag === "Ok") {
      return { tag: "Ok", value: this.callFunction(fn, [(result as any).value]), kind: "Result" };
    }
    return result;
  }

  private mapOption(option: any, fn: any): any {
    if ((option as any).tag === "Some") {
      return { tag: "Some", value: this.callFunction(fn, [(option as any).value]), kind: "Option" };
    }
    return option;
  }

  private mapList(list: any[], fn: any): any[] {
    return list.map((item: any) => this.callFunction(fn, [item]));
  }

  // Get type class
  getTypeClass(name: string): TypeClassInfo | undefined {
    return this.context.typeClasses?.get(name);
  }

  // Get type class instance
  getTypeClassInstance(className: string, concreteType: string): TypeClassInstanceInfo | undefined {
    return this.context.typeClassInstances?.get(`${className}[${concreteType}]`);
  }

  // Check if a type satisfies a type class constraint
  satisfiesConstraint(type: string, constraintClass: string): boolean {
    return !!this.getTypeClassInstance(constraintClass, type);
  }

  // Phase 5 Week 2: Get concrete type from a value
  public getConcreteType(value: any): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    if (value.tag === "Ok" || value.tag === "Err") return "Result";
    if (value.tag === "Some" || value.tag === "None") return "Option";
    if (Array.isArray(value)) return "List";
    if (value.kind === "Result") return "Result";
    if (value.kind === "Option") return "Option";
    if (value.kind === "List") return "List";
    return undefined;
  }

  // Phase 5 Week 2: Resolve method for a given className and concreteType
  public resolveMethod(className: string, concreteType: string, methodName: string): any {
    const instance = this.getTypeClassInstance(className, concreteType);
    if (!instance) {
      return undefined;
    }
    return instance.implementations.get(methodName);
  }

  // Phase 6 Step 4: Helper to ensure modules map exists
  public getModules(): Map<string, ModuleInfo> {
    if (!this.context.modules) {
      this.context.modules = new Map();
    }
    return this.context.modules;
  }

  // Phase 57: delegated to eval-module-system.ts
  public evalModuleBlock(moduleBlock: ModuleBlock): void { _evalModuleBlock(this, moduleBlock); }
  public evalImportBlock(importBlock: ImportBlock): void { _evalImportBlock(this, importBlock); }
  public evalImportFromFile(relPath: string, prefix: string, selective: string[] | undefined, alias: string | undefined): void {
    _evalImportFromFile(this, relPath, prefix, selective, alias);
  }
  public evalOpenBlock(openBlock: OpenBlock): void { _evalOpenBlock(this, openBlock); }
  // Phase 57: delegated to eval-ai-handlers.ts
  public handleSearchBlock(searchBlock: SearchBlock): any {
    return _handleSearchBlock(this, searchBlock);
  }

  // Phase 57: delegated to eval-ai-handlers.ts
  public handleLearnBlock(learnBlock: LearnBlock): any {
    return _handleLearnBlock(this, learnBlock);
  }
  // Phase 57: delegated to eval-ai-handlers.ts
  public handleReasoningBlock(reasoningBlock: ReasoningBlock): any {
    return _handleReasoningBlock(this, reasoningBlock);
  }
  // Phase 57: handleReasoningSequence delegated to eval-reasoning-sequence.ts
  public handleReasoningSequence(reasoningSeq: ReasoningSequence): any {
    return handleReasoningSequence(this, reasoningSeq);
  }

  // Phase 5 Week 2: Evaluate Type Class definition
  public evalTypeClass(typeClass: TypeClass): void {
    const info: TypeClassInfo = {
      name: typeClass.name,
      typeParams: typeClass.typeParams,
      methods: new Map(),
    };

    // Extract method signatures from typeClass.methods Map
    if (typeClass.methods) {
      typeClass.methods.forEach((method, methodName) => {
        // Store method signature (for now, just the method name)
        info.methods.set(methodName, methodName);
      });
    }

    // Register type class in context
    this.context.typeClasses!.set(typeClass.name, info);

    this.logger.info(
      `✅ Registered TYPECLASS "${typeClass.name}" with type params [${typeClass.typeParams.join(
        ", "
      )}] and ${info.methods.size} method(s)`
    );
  }

  // Phase 5 Week 2: Evaluate Type Class Instance definition
  public evalInstance(instance: TypeClassInstance): void {
    const key = `${instance.className}[${instance.concreteType}]`;

    const implementations = new Map<string, any>();

    // Extract method implementations from instance.implementations Map
    if (instance.implementations) {
      instance.implementations.forEach((value, methodName) => {
        // Evaluate each method implementation
        const impl = this.eval(value);
        implementations.set(methodName, impl);
      });
    }

    const info: TypeClassInstanceInfo = {
      className: instance.className,
      concreteType: instance.concreteType,
      implementations,
    };

    // Register type class instance in context
    this.context.typeClassInstances!.set(key, info);

    this.logger.info(
      `✅ Registered INSTANCE of "${instance.className}" for type "${instance.concreteType}" with ${implementations.size} method(s)`
    );
  }

  /**
   * Cleanup: Destroy all resources and stop timers
   * Call this when shutting down the interpreter to prevent memory leaks
   * (e.g., after all tests complete or on process exit)
   */
  destroy(): void {
    // Clean up LearnedFactsStore timer
    this.learnedFactsStore.destroy();

    // Close HTTP server if running
    if (this.context.server) {
      this.context.server.close();
    }

    this.logger.info("Interpreter cleanup completed");
  }
}

// Global interpreter reference for cleanup on process exit
let globalInterpreterInstance: Interpreter | null = null;

export function interpret(blocks: ASTNode[], logger?: Logger): ExecutionContext {
  const interpreter = new Interpreter(logger);
  globalInterpreterInstance = interpreter;

  // Register cleanup handler on first interpret() call
  if (!process.listeners("exit").some(l => l.name === "cleanupInterpreter")) {
    const cleanupInterpreter = function() {
      if (globalInterpreterInstance) {
        globalInterpreterInstance.destroy();
        globalInterpreterInstance = null;
      }
    };
    Object.defineProperty(cleanupInterpreter, "name", { value: "cleanupInterpreter" });
    process.on("exit", cleanupInterpreter);
  }

  return interpreter.interpret(blocks);
}
