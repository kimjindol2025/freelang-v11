// FreeLang v9: Interpreter
// AST → 실행 (Express 서버 포함)

import * as fs from "fs";
import * as path from "path";
import { lex } from "./lexer";
import { parse } from "./parser";
import { ASTNode, Block, Literal, Variable, SExpr, Keyword, TypeAnnotation, Pattern, PatternMatch, MatchCase, LiteralPattern, VariablePattern, WildcardPattern, ListPattern, StructPattern, OrPattern, ModuleBlock, ImportBlock, OpenBlock, SearchBlock, LearnBlock, ReasoningBlock, ReasoningSequence, AsyncFunction, AwaitExpression, TryBlock, CatchClause, ThrowExpression, TypeClass, TypeClassInstance, TypeClassMethod, isModuleBlock, isImportBlock, isOpenBlock, isSearchBlock, isLearnBlock, isReasoningBlock, isReasoningSequence, isTryBlock, isThrowExpression, isFuncBlock, isBlock, isControlBlock } from "./ast";
import { TypeChecker, createTypeChecker } from "./type-checker";
import { RuntimeTypeChecker } from "./type-system"; // Phase 60: 런타임 타입 검증
import { ModuleNotFoundError, SelectiveImportError, FunctionRegistrationError, FunctionNotFoundError } from "./errors";
import { suggestSimilar } from "./error-formatter";
import { Logger, StructuredLogger, getGlobalLogger } from "./logger";
import { extractParamNames, extractFunctions } from "./ast-helpers";
import { FreeLangPromise, resolvedPromise, rejectedPromise } from "./async-runtime";
import { ScopeStack } from "./interpreter-scope"; // Phase A: 렉시컬 스코프
import { WebSearchAdapter } from "./web-search-adapter"; // Phase 9a: WebSearch integration
import { LearnedFactsStore } from "./learned-facts-store"; // Phase 9b: Learning persistence
import { evalBuiltin } from "./eval-builtins";                       // Phase 57: Built-in functions
import { evalAiBlock } from "./eval-ai-blocks";                       // Phase 57: AI blocks
import { evalSpecialForm } from "./eval-special-forms";               // Phase 57: Special forms
import { handleReasoningSequence } from "./eval-reasoning-sequence";  // Phase 57: Reasoning sequence
import { handleSearchBlock as _handleSearchBlock, handleLearnBlock as _handleLearnBlock, handleReasoningBlock as _handleReasoningBlock } from "./eval-ai-handlers"; // Phase 57: AI handlers
import { evalModuleBlock as _evalModuleBlock, evalImportBlock as _evalImportBlock, evalImportFromFile as _evalImportFromFile, evalOpenBlock as _evalOpenBlock } from "./eval-module-system"; // Phase 57: Module system
import { loadAllStdlib } from "./stdlib-loader"; // Phase 58: Stdlib 로딩 분리
import { evalPatternMatch as _evalPatternMatch, evalTryBlock as _evalTryBlock, evalThrow as _evalThrow, matchPattern as _matchPattern } from "./eval-pattern-match"; // Phase 58: Pattern matching 분리
import { registerBuiltinTypeClasses as _registerBuiltinTypeClasses, evalTypeClass as _evalTypeClass, evalInstance as _evalInstance } from "./eval-type-classes"; // Phase 58: Type class 분리
import { callUserFunction as _callUserFunction, callFunctionValue as _callFunctionValue, callAsyncFunctionValue as _callAsyncFunctionValue, callFunction as _callFunction, callUserFunctionTCO as _callUserFunctionTCO, callFunctionValueTCO as _callFunctionValueTCO, callUserFunctionRaw as _callUserFunctionRaw, callFunctionValueRaw as _callFunctionValueRaw } from "./eval-call-function"; // Phase 58+61: Function call 분리 + TCO
import { MacroExpander } from "./macro-expander"; // Phase 63: 매크로 시스템
import { ProtocolRegistry } from "./protocol"; // Phase 64: 프로토콜 시스템
import { StructRegistry } from "./struct-system"; // Phase 66: 구조체 시스템
import { isLazySeq, take as lazyTake } from "./lazy-seq"; // Phase 69: 레이지 시퀀스
import { DebugSession, getGlobalDebugSession, handleBreak } from "./debugger"; // Phase 78: 디버거
import { evalCotForm } from "./cot"; // Phase 92: Chain-of-Thought
import { evalTotBlock, TreeOfThought } from "./tot"; // Phase 93: Tree-of-Thought
import { evalReflectForm } from "./reflect"; // Phase 94: REFLECT 자기 평가/반성
import { globalToolRegistry, ToolRegistry, type ToolDefinition } from "./tool-registry"; // Phase 97: Tool DSL
import { evalAgentBlock, createAgentBuiltins, type AgentState, type AgentAction } from "./agent"; // Phase 98: AGENT 루프

// Phase 58: 타입 정의는 interpreter-context.ts로 이동, re-export로 호환성 유지
export type {
  ExecutionContext,
  FreeLangFunction,
  FreeLangRoute,
  Intent,
  FreeLangMiddleware,
  ErrorHandler,
  TypeClassInfo,
  TypeClassInstanceInfo,
  ModuleInfo,
} from "./interpreter-context";

// 로컬 사용을 위해 import
import type {
  ExecutionContext,
  FreeLangFunction,
  FreeLangRoute,
  Intent,
  FreeLangMiddleware,
  ErrorHandler,
  TypeClassInfo,
  TypeClassInstanceInfo,
  ModuleInfo,
} from "./interpreter-context";

// Interpreter class
export class Interpreter {
  public context: ExecutionContext; // Public for testing
  public logger: Logger;
  public searchAdapter: WebSearchAdapter; // Phase 9a: WebSearch
  public learnedFactsStore: LearnedFactsStore; // Phase 9b: Learning persistence
  public currentLine = 0; // FreeLang source line tracking
  public callDepth = 0;
  public static readonly MAX_CALL_DEPTH = 5000; // Phase 61: 상향 (trampoline이 100만 재귀 처리)
  // Phase 61: TCO 모드 — eval이 꼬리 위치 함수 호출을 TailCall 토큰으로 반환
  public tcoMode = false;
  // Phase 52: FL 파일 import 지원
  public importedFiles: Set<string> = new Set();
  public currentFilePath: string = process.cwd();
  // Phase 78: 디버거 세션
  public debugSession: DebugSession = getGlobalDebugSession();

  constructor(logger?: Logger, options?: { strict?: boolean }) {
    this.logger = logger || getGlobalLogger();
    // Phase 60: strict 모드 — 환경변수 FREELANG_STRICT=1 또는 options.strict=true
    const strictMode = options?.strict ?? process.env.FREELANG_STRICT === "1";
    this.context = {
      functions: new Map(),
      routes: new Map(),
      intents: new Map(),
      variables: new ScopeStack(),
      middleware: [],
      errorHandlers: { handlers: new Map() },
      startTime: Date.now(),
      typeChecker: createTypeChecker(), // Phase 3: Initialize type checker
      runtimeTypeChecker: new RuntimeTypeChecker(strictMode), // Phase 60: 런타임 타입 검증
      typeClasses: new Map(),             // Phase 5 Week 2: Type class registry
      typeClassInstances: new Map(),      // Phase 5 Week 2: Type class instance registry
      modules: new Map(),                 // Phase 6: Module registry
      macroExpander: new MacroExpander(), // Phase 63: 매크로 시스템
      protocols: new ProtocolRegistry(),  // Phase 64: 프로토콜 시스템
      structs: new StructRegistry(),      // Phase 66: 구조체/레코드 타입 시스템
    };

    // Phase 9a: Initialize WebSearchAdapter (mock mode by default)
    // Production: Use BRAVE_SEARCH_KEY or SERPER_API_KEY from env
    const apiKey = process.env.BRAVE_SEARCH_KEY || process.env.SERPER_API_KEY;
    const provider = process.env.BRAVE_SEARCH_KEY ? "brave" : process.env.SERPER_API_KEY ? "serper" : "mock";
    this.searchAdapter = new WebSearchAdapter(apiKey, provider as any);

    // Phase 9b: Initialize LearnedFactsStore (persistent learning)
    this.learnedFactsStore = new LearnedFactsStore("./data/learned-facts.json", 30);

    // Phase 58: 모든 stdlib 모듈 등록 (stdlib-loader.ts로 분리)
    loadAllStdlib(this);

    // Phase 49: FL 표준 라이브러리 (fl-map, fl-filter, fl-reduce, Maybe, Result 등)
    this.loadFlStdlib();

    // Phase 5 Week 2: Register built-in type classes and instances
    this.registerBuiltinTypeClasses();

    // Phase 63: 표준 매크로 등록 (when, unless, and2)
    this.registerStandardMacros();

    // Phase 98: Agent 빌트인 등록 (agent-new, agent-run, agent-done?, agent-result, ...)
    this.registerAgentBuiltins();
  }

  // Phase 98: Agent 빌트인 함수 등록
  private registerAgentBuiltins(): void {
    const builtins = createAgentBuiltins(this);
    for (const [name, fn] of Object.entries(builtins)) {
      this.context.functions.set(name, { name, params: [], body: fn as any });
    }
  }

  // Phase 63: 표준 매크로 등록
  private registerStandardMacros(): void {
    const expander = this.context.macroExpander;
    // (when $cond $body) → (if $cond $body nil)
    expander.define("when", ["$cond", "$body"], {
      kind: "sexpr",
      op: "if",
      args: [
        { kind: "variable", name: "$cond" },
        { kind: "variable", name: "$body" },
        { kind: "literal", type: "null", value: null },
      ],
    });
    // (unless $cond $body) → (if $cond nil $body)
    expander.define("unless", ["$cond", "$body"], {
      kind: "sexpr",
      op: "if",
      args: [
        { kind: "variable", name: "$cond" },
        { kind: "literal", type: "null", value: null },
        { kind: "variable", name: "$body" },
      ],
    });
    // (and2 $a $b) → (if $a $b false)
    expander.define("and2", ["$a", "$b"], {
      kind: "sexpr",
      op: "if",
      args: [
        { kind: "variable", name: "$a" },
        { kind: "variable", name: "$b" },
        { kind: "literal", type: "boolean", value: false },
      ],
    });
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

  public registerModule(module: Record<string, unknown>): void {
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
      // Phase 63: 매크로 확장 전처리 — defmacro 먼저 처리, 나머지는 확장
      // 1단계: defmacro 노드 선처리
      for (const node of blocks) {
        if ((node as any).kind === "sexpr" && (node as any).op === "defmacro") {
          this.evalDefmacro(node as any);
        }
      }
      // 2단계: defmacro가 아닌 노드는 매크로 확장 후 실행
      blocks = blocks.map((node) => {
        if ((node as any).kind === "sexpr" && (node as any).op === "defmacro") return node;
        return this.context.macroExpander.expand(node);
      });

      for (const node of blocks) {
        if ((node as any).kind === "sexpr" && (node as any).op === "defmacro") continue; // 이미 처리됨
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

  /**
   * Phase 59: 소스 코드 문자열을 받아 lex → parse → interpret 후 ExecutionContext 반환
   * 테스트와 인라인 실행에 편리한 단축 메서드
   */
  run(source: string): ExecutionContext {
    return this.interpret(parse(lex(source)));
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
      case "TOOL":
        // Phase 97: [TOOL name :desc "..." :input {...} :output :T :body expr]
        this.context.lastValue = this.handleToolBlock(block);
        break;
      case "USE-TOOL":
        // Phase 97: [USE-TOOL toolname :args {key val ...}]
        this.context.lastValue = this.handleUseToolBlock(block);
        break;
      case "AGENT":
        // Phase 98: [AGENT :goal "..." :max-steps 10 :step (fn ...) :stop-when (fn ...)]
        this.handleAgentBlock(block);
        break;
      default:
        // Unknown block type, skip
        break;
    }
  }

  // Phase 98: AGENT 블록 처리
  private handleAgentBlock(block: Block): void {
    const interp = this;
    const ev = (node: any) => interp.eval(node);
    const callFnVal = (fn: any, args: any[]) => interp.callFunctionValue(fn, args);
    const state = evalAgentBlock(block.fields as Map<string, any>, ev, callFnVal);
    this.context.lastValue = state;
  }

  // Phase 97: [TOOL name :desc "..." :input {x :number y :number} :output :number :body (+ $x $y)]
  private handleToolBlock(block: any): any {
    const name = block.name as string;
    const desc = block.fields.has("desc") ? this.eval(block.fields.get("desc")) : "";
    const bodyNode = block.fields.get("body");

    // :input 스키마 파싱
    const inputSchema: Record<string, any> = {};
    if (block.fields.has("input")) {
      const inputNode = block.fields.get("input");
      // Map 블록이면 key→keyword value 형태
      if (inputNode?.kind === "block" && inputNode?.type === "Map") {
        const entries = inputNode.fields.get("entries");
        if (Array.isArray(entries)) {
          for (let i = 0; i < entries.length - 1; i += 2) {
            const key = entries[i]?.kind === "keyword" ? entries[i].name
              : entries[i]?.kind === "literal" ? String(entries[i].value)
              : String(entries[i]);
            const valNode = entries[i + 1];
            const valStr = valNode?.kind === "keyword" ? valNode.name
              : valNode?.kind === "literal" ? String(valNode.value)
              : "any";
            inputSchema[key] = valStr;
          }
        }
      }
    }

    // :output 스키마
    let outputSchema: string = "any";
    if (block.fields.has("output")) {
      const outNode = block.fields.get("output");
      outputSchema = outNode?.kind === "keyword" ? outNode.name
        : outNode?.kind === "literal" ? String(outNode.value)
        : "any";
    }

    const interp = this;
    const toolDef: ToolDefinition = {
      name,
      description: String(desc || ""),
      inputSchema,
      outputSchema: outputSchema as any,
      execute: (args: Record<string, any>) => {
        // 인자들을 $key 변수로 바인딩하여 body 실행
        interp.context.variables.push();
        try {
          for (const [k, v] of Object.entries(args)) {
            interp.context.variables.set(`$${k}`, v);
          }
          return interp.eval(bodyNode);
        } finally {
          interp.context.variables.pop();
        }
      },
    };

    globalToolRegistry.register(toolDef);
    return toolDef;
  }

  // Phase 97: [USE-TOOL toolname :args {key val ...}]
  private handleUseToolBlock(block: any): any {
    const name = block.name as string;
    const args: Record<string, any> = {};

    if (block.fields.has("args")) {
      const argsNode = block.fields.get("args");
      if (argsNode?.kind === "block" && argsNode?.type === "Map") {
        const entries = argsNode.fields.get("entries");
        if (Array.isArray(entries)) {
          for (let i = 0; i < entries.length - 1; i += 2) {
            const key = entries[i]?.kind === "keyword" ? entries[i].name
              : entries[i]?.kind === "literal" ? String(entries[i].value)
              : String(entries[i]);
            args[key] = this.eval(entries[i + 1]);
          }
        }
      }
    }

    const result = globalToolRegistry.executeSync(name, args);
    return result.success ? result.output : (() => { throw new Error(result.error || `Tool failed: ${name}`); })();
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

    // Phase 60: RuntimeTypeChecker에도 시그니처 등록 (타입 어노테이션이 있는 함수만)
    // typeAnnotations가 있으면 = 명시적 타입 어노테이션이 있는 함수
    if (this.context.runtimeTypeChecker && block.typeAnnotations) {
      const paramTypeNames = paramTypes.map((p) => p.name || "any");
      const retTypeName = returnType.name || "any";
      this.context.runtimeTypeChecker.registerFunc(block.name, paramTypeNames, retTypeName);
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
    const SPECIAL_OPS = new Set(["fn","async","set!","define","func-ref","call","compose","pipe","->","->>","|>","let","set","if","cond","do","begin","progn","loop","recur","while","and","or","defmacro","macroexpand","defstruct","defprotocol","impl","parallel","race","with-timeout","fl-try"]);

    if (AI_OPS.has(op)) return evalAiBlock(this, op, expr);
    if (SPECIAL_OPS.has(op)) return evalSpecialForm(this, op, expr);

    // Phase 94: REFLECT — 자기 평가/반성 특수 폼
    if (op === "REFLECT") {
      const interp = this;
      const ev = (node: any) => interp.eval(node);
      const callFnVal = (fn: any, args: any[]) => interp.callFunctionValue(fn, args);

      // 키워드 파싱: :output :criteria :threshold :on-fail :revise
      let outputExpr: any = null;
      let criteriaExpr: any = null;
      let thresholdExpr: any = null;
      let onFailExpr: any = null;
      let reviseExpr: any = null;

      // 키워드 추출 헬퍼 — kind="keyword" 또는 kind="literal"(string) 모두 지원
      const getKeyword = (arg: any): string | null => {
        if (arg?.kind === "keyword") return arg.name;
        if (arg?.kind === "literal" && arg?.type === "string") return arg.value;
        return null;
      };

      for (let i = 0; i < expr.args.length; i++) {
        const arg = expr.args[i];
        const kw = getKeyword(arg);
        if (kw !== null && i + 1 < expr.args.length) {
          const next = expr.args[i + 1];
          if (kw === "output") { outputExpr = next; i++; }
          else if (kw === "criteria") { criteriaExpr = next; i++; }
          else if (kw === "threshold") { thresholdExpr = next; i++; }
          else if (kw === "on-fail") { onFailExpr = next; i++; }
          else if (kw === "revise") { reviseExpr = next; i++; }
        }
      }

      // output 실행
      const outputVal = outputExpr != null ? ev(outputExpr) : null;

      // criteria 배열 실행 — 각 원소는 함수 또는 fn 값
      const criteriaFns: Array<(v: any) => number> = [];
      if (criteriaExpr != null) {
        const criteriaRaw = ev(criteriaExpr);
        if (Array.isArray(criteriaRaw)) {
          for (const c of criteriaRaw) {
            if (typeof c === "function") {
              criteriaFns.push(c);
            } else if (c?.kind === "function-value") {
              criteriaFns.push((v: any) => {
                const r = callFnVal(c, [v]);
                return typeof r === "number" ? r : (r ? 1 : 0);
              });
            } else if (typeof c === "number") {
              const score = c;
              criteriaFns.push(() => score);
            }
          }
        }
      }

      // threshold
      const threshold = thresholdExpr != null ? Number(ev(thresholdExpr)) : 0.7;

      // on-fail
      let onFail: ((r: any) => any) | undefined;
      if (onFailExpr != null) {
        const onFailVal = ev(onFailExpr);
        if (onFailVal?.kind === "function-value") {
          onFail = (r: any) => callFnVal(onFailVal, [r]);
        } else if (typeof onFailVal === "function") {
          onFail = onFailVal;
        }
      }

      // revise
      let revise: ((r: any) => any) | undefined;
      if (reviseExpr != null) {
        const reviseVal = ev(reviseExpr);
        if (reviseVal?.kind === "function-value") {
          revise = (r: any) => callFnVal(reviseVal, [r]);
        } else if (typeof reviseVal === "function") {
          revise = reviseVal;
        }
      }

      return evalReflectForm({
        output: outputVal,
        criteria: criteriaFns,
        threshold,
        onFail,
        revise,
      });
    }

    // Phase 92: COT — Chain-of-Thought 특수 폼
    if (op === "COT") {
      const interp = this;
      const result = evalCotForm(
        expr.args,
        (node: any) => interp.eval(node),
        (name: string, value: any) => interp.context.variables.set(name, value),
        (name: string) => interp.context.variables.get(name),
      );
      // conclude fn이 function-value인 경우 실제 호출
      if (result.conclusion?.kind === "function-value") {
        const stepsVar = interp.context.variables.get("$__cot_steps__");
        result.conclusion = interp.callFunctionValue(result.conclusion, [stepsVar]);
      }
      return result;
    }

    // Phase 93: TOT — Tree-of-Thought 특수 폼
    // (TOT :branch "가설A" (expr-a) :branch "가설B" (expr-b) :eval (fn [$r] ...) :prune 0.3 :select best)
    if (op === "TOT") {
      const interp = this;
      const tot = new TreeOfThought();

      // FL 파서에서 :keyword는 두 형태로 올 수 있음:
      // 1. {kind: "keyword", name: "branch"}
      // 2. {kind: "literal", type: "string", value: "branch"}  (Colon + Symbol → string literal)
      function isTotKeyword(node: any, name: string): boolean {
        if (!node) return false;
        if (node.kind === "keyword" && node.name === name) return true;
        if (node.kind === "literal" && node.type === "string" && node.value === name) return true;
        return false;
      }

      const args = expr.args;
      let i = 0;
      let scoreFnNode: any = null;
      let pruneThreshold: number | null = null;
      let selectStrategy: 'best' | 'top-k' = 'best';
      let selectK = 1;

      while (i < args.length) {
        const arg = args[i];
        if (isTotKeyword(arg, "branch")) {
          i++;
          const hypoNode = args[i]; i++;
          const exprNode = args[i]; i++;
          const hypo = String(interp.eval(hypoNode));
          const capturedNode = exprNode;
          tot.branch(hypo, () => interp.eval(capturedNode));
        } else if (isTotKeyword(arg, "eval")) {
          i++;
          scoreFnNode = args[i]; i++;
        } else if (isTotKeyword(arg, "prune")) {
          i++;
          pruneThreshold = Number(interp.eval(args[i])); i++;
        } else if (isTotKeyword(arg, "select")) {
          i++;
          const selVal = interp.eval(args[i]); i++;
          if (selVal === "top-k") selectStrategy = "top-k";
          else selectStrategy = "best";
        } else if (isTotKeyword(arg, "k")) {
          i++;
          selectK = Number(interp.eval(args[i])); i++;
        } else {
          i++;
        }
      }

      if (scoreFnNode != null) {
        const scoreFnVal = interp.eval(scoreFnNode);
        tot.evaluate((result: any) => {
          if (typeof scoreFnVal === "function") return Number(scoreFnVal(result)) || 0;
          if (scoreFnVal?.kind === "function-value") {
            return Number(interp.callFunctionValue(scoreFnVal, [result])) || 0;
          }
          return 0.5;
        });
      }

      if (pruneThreshold !== null && !isNaN(pruneThreshold)) {
        tot.prune(pruneThreshold);
      }

      return tot.select(selectStrategy, selectK);
    }

    // Phase 78: (break!) — 디버그 중단점
    if (op === "break!") {
      const loc = {
        file: this.currentFilePath || "<unknown>",
        line: expr.line ?? this.currentLine,
        col: 0,
      };
      // 현재 환경 스냅샷
      const env: Record<string, any> = {};
      try {
        const snapshot = this.context.variables.snapshot();
        for (const [k, v] of Object.entries(snapshot)) {
          env[k] = v;
        }
      } catch (_) { /* snapshot 실패 시 무시 */ }
      handleBreak(this.debugSession, loc, env);
      return null; // (break!)는 null 반환
    }

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

    // Phase 64: 프로토콜 메서드 dispatch — 함수 미발견 시 프로토콜 레지스트리 탐색
    if (this.context.protocols.hasMethod(op)) {
      // 첫 번째 인자를 $self로 사용해 타입 확인
      if (args.length >= 1) {
        const selfVal = args[0];
        const impl = this.context.protocols.resolveMethod(op, selfVal);
        if (impl) {
          const methodDef = impl.methods.get(op)!;
          return this.callProtocolMethod(methodDef, selfVal, args.slice(1));
        }
      }
    }

    // Phase 66: struct native 함수 dispatch (constructor, predicate, accessor)
    const nativeKey = `__native_${op}`;
    if ((this.context as any)[nativeKey] !== undefined) {
      const nativeFn: (...a: any[]) => any = (this.context as any)[nativeKey];
      return nativeFn(...args);
    }

    return evalBuiltin(this, op, args, expr);
  }

  // Phase 64: 프로토콜 메서드 호출 — $self + 나머지 인자 바인딩
  private callProtocolMethod(methodDef: { params: string[]; body: any }, selfVal: any, restArgs: any[]): any {
    // params: ["$self", "$data", ...] 형태
    const params = methodDef.params;
    this.context.variables.push();
    try {
      // $self 바인딩 (첫 번째 파라미터)
      if (params.length > 0) {
        this.context.variables.set(params[0], selfVal);
      }
      // 나머지 파라미터 바인딩
      for (let i = 1; i < params.length; i++) {
        this.context.variables.set(params[i], restArgs[i - 1] ?? null);
      }
      return this.eval(methodDef.body);
    } finally {
      this.context.variables.pop();
    }
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
    // Phase 69: 레이지 시퀀스 — 앞 3개만 미리보기
    if (isLazySeq(val)) {
      const preview = lazyTake(3, val).map((v) => this.toDisplayString(v)).join(", ");
      return `<lazy-seq: ${preview}...>`;
    }
    if (typeof val === "object") {
      if (val.kind === "function-value") return `<fn:${val.name || "λ"}>`;
      const entries = Object.entries(val)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => `${k}: ${this.toDisplayString(v)}`);
      return "{" + entries.join(", ") + "}";
    }
    return String(val);
  }

  // Phase 58: 함수 호출 로직 eval-call-function.ts로 분리
  public callUserFunction(name: string, args: any[]): any { return _callUserFunction(this, name, args); }
  public callFunctionValue(fn: any, args: any[]): any { return _callFunctionValue(this, fn, args); }
  public callAsyncFunctionValue(fn: any, args: any[]): FreeLangPromise { return _callAsyncFunctionValue(this, fn, args); }
  public callFunction(fn: any, args: any[]): any { return _callFunction(this, fn, args); }

  // Phase 61: TCO 메서드 — 꼬리 재귀를 반복문으로 (100만 재귀 스택 없이)
  public callUserFunctionTCO(name: string, args: any[]): any { return _callUserFunctionTCO(this, name, args); }
  public callFunctionValueTCO(fn: any, args: any[]): any { return _callFunctionValueTCO(this, fn, args); }
  // trampoline용 raw 메서드 (TailCall 토큰 그대로 반환)
  public callUserFunctionRaw(name: string, args: any[]): any { return _callUserFunctionRaw(this, name, args); }
  public callFunctionValueRaw(fn: any, args: any[]): any { return _callFunctionValueRaw(this, fn, args); }

  private getFieldValue(block: Block, key: string, defaultValue: any = null): any {
    const field = block.fields.get(key);
    if (field === undefined) {
      return defaultValue;
    }
    return this.eval(field as ASTNode);
  }

  // ===== Pattern Matching (Phase 4 Week 3-4) — Phase 58: eval-pattern-match.ts로 분리 =====
  public evalPatternMatch(match: PatternMatch): any { return _evalPatternMatch(this, match); }
  public evalTryBlock(tryBlock: TryBlock): any { return _evalTryBlock(this, tryBlock); }
  public evalThrow(throwExpr: ThrowExpression): any { return _evalThrow(this, throwExpr); }
  public matchPattern(pattern: Pattern, value: any): { matched: boolean; bindings: Map<string, any> } {
    return _matchPattern(this, pattern, value);
  }

  // Utility: Get context
  getContext(): ExecutionContext {
    return this.context;
  }

  // Utility: Set variable
  setVariable(name: string, value: any): void {
    this.context.variables.set(name, value);
  }

  // Phase 63: defmacro 처리 (interpret() 선처리용)
  public evalDefmacro(expr: any): void {
    if (expr.args.length < 3) throw new Error(`defmacro requires name, params, and body`);
    const nameNode = expr.args[0] as any;
    const macroName: string = nameNode.kind === "literal" ? String(nameNode.value)
      : nameNode.kind === "variable" ? nameNode.name
      : String(nameNode.value ?? nameNode.name ?? "");

    const paramsNode = expr.args[1] as any;
    const params: string[] = [];
    if (paramsNode.kind === "block" && paramsNode.type === "Array") {
      const items = paramsNode.fields.get("items");
      if (Array.isArray(items)) {
        for (const item of items as any[]) {
          if (item.kind === "variable") params.push(item.name.startsWith("$") ? item.name : "$" + item.name);
          else if (item.kind === "literal") params.push("$" + item.value);
        }
      }
    }
    const body = expr.args[2];
    this.context.macroExpander.define(macroName, params, body);
  }

  // Phase 5 Week 2: Register built-in type classes and instances
  // Phase 58: Type class 관련 로직 eval-type-classes.ts로 분리
  public registerBuiltinTypeClasses(): void { _registerBuiltinTypeClasses(this); }
  public evalTypeClass(typeClass: TypeClass): void { _evalTypeClass(this, typeClass); }
  public evalInstance(instance: TypeClassInstance): void { _evalInstance(this, instance); }

  // Type class query helpers
  getTypeClass(name: string): TypeClassInfo | undefined {
    return this.context.typeClasses?.get(name);
  }
  getTypeClassInstance(className: string, concreteType: string): TypeClassInstanceInfo | undefined {
    return this.context.typeClassInstances?.get(`${className}[${concreteType}]`);
  }
  satisfiesConstraint(type: string, constraintClass: string): boolean {
    return !!this.getTypeClassInstance(constraintClass, type);
  }
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
  public resolveMethod(className: string, concreteType: string, methodName: string): any {
    const instance = this.getTypeClassInstance(className, concreteType);
    return instance?.implementations.get(methodName);
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
  public handleSearchBlock(searchBlock: SearchBlock): any { return _handleSearchBlock(this, searchBlock); }
  public handleLearnBlock(learnBlock: LearnBlock): any { return _handleLearnBlock(this, learnBlock); }
  public handleReasoningBlock(reasoningBlock: ReasoningBlock): any { return _handleReasoningBlock(this, reasoningBlock); }
  public handleReasoningSequence(reasoningSeq: ReasoningSequence): any { return handleReasoningSequence(this, reasoningSeq); }

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
