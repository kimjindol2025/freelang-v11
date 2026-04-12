"use strict";
// FreeLang v9: Interpreter
// AST → 실행 (Express 서버 포함)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interpreter = void 0;
exports.interpret = interpret;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const ast_1 = require("./ast");
const type_checker_1 = require("./type-checker");
const type_system_1 = require("./type-system"); // Phase 60: 런타임 타입 검증
const logger_1 = require("./logger");
const interpreter_scope_1 = require("./interpreter-scope"); // Phase A: 렉시컬 스코프
const web_search_adapter_1 = require("./web-search-adapter"); // Phase 9a: WebSearch integration
const learned_facts_store_1 = require("./learned-facts-store"); // Phase 9b: Learning persistence
const eval_builtins_1 = require("./eval-builtins"); // Phase 57: Built-in functions
const eval_ai_blocks_1 = require("./eval-ai-blocks"); // Phase 57: AI blocks
const eval_special_forms_1 = require("./eval-special-forms"); // Phase 57: Special forms
const eval_reasoning_sequence_1 = require("./eval-reasoning-sequence"); // Phase 57: Reasoning sequence
const eval_ai_handlers_1 = require("./eval-ai-handlers"); // Phase 57: AI handlers
const eval_module_system_1 = require("./eval-module-system"); // Phase 57: Module system
const stdlib_loader_1 = require("./stdlib-loader"); // Phase 58: Stdlib 로딩 분리
const eval_pattern_match_1 = require("./eval-pattern-match"); // Phase 58: Pattern matching 분리
const eval_type_classes_1 = require("./eval-type-classes"); // Phase 58: Type class 분리
const eval_call_function_1 = require("./eval-call-function"); // Phase 58+61: Function call 분리 + TCO
const macro_expander_1 = require("./macro-expander"); // Phase 63: 매크로 시스템
const protocol_1 = require("./protocol"); // Phase 64: 프로토콜 시스템
const struct_system_1 = require("./struct-system"); // Phase 66: 구조체 시스템
const lazy_seq_1 = require("./lazy-seq"); // Phase 69: 레이지 시퀀스
// Interpreter class
class Interpreter {
    constructor(logger, options) {
        this.currentLine = 0; // FreeLang source line tracking
        this.callDepth = 0;
        // Phase 61: TCO 모드 — eval이 꼬리 위치 함수 호출을 TailCall 토큰으로 반환
        this.tcoMode = false;
        // Phase 52: FL 파일 import 지원
        this.importedFiles = new Set();
        this.currentFilePath = process.cwd();
        this.serverConfig = null;
        this.logger = logger || (0, logger_1.getGlobalLogger)();
        // Phase 60: strict 모드 — 환경변수 FREELANG_STRICT=1 또는 options.strict=true
        const strictMode = options?.strict ?? process.env.FREELANG_STRICT === "1";
        this.context = {
            functions: new Map(),
            routes: new Map(),
            intents: new Map(),
            variables: new interpreter_scope_1.ScopeStack(),
            middleware: [],
            errorHandlers: { handlers: new Map() },
            startTime: Date.now(),
            typeChecker: (0, type_checker_1.createTypeChecker)(), // Phase 3: Initialize type checker
            runtimeTypeChecker: new type_system_1.RuntimeTypeChecker(strictMode), // Phase 60: 런타임 타입 검증
            typeClasses: new Map(), // Phase 5 Week 2: Type class registry
            typeClassInstances: new Map(), // Phase 5 Week 2: Type class instance registry
            modules: new Map(), // Phase 6: Module registry
            macroExpander: new macro_expander_1.MacroExpander(), // Phase 63: 매크로 시스템
            protocols: new protocol_1.ProtocolRegistry(), // Phase 64: 프로토콜 시스템
            structs: new struct_system_1.StructRegistry(), // Phase 66: 구조체/레코드 타입 시스템
        };
        // Phase 9a: Initialize WebSearchAdapter (mock mode by default)
        // Production: Use BRAVE_SEARCH_KEY or SERPER_API_KEY from env
        const apiKey = process.env.BRAVE_SEARCH_KEY || process.env.SERPER_API_KEY;
        const provider = process.env.BRAVE_SEARCH_KEY ? "brave" : process.env.SERPER_API_KEY ? "serper" : "mock";
        this.searchAdapter = new web_search_adapter_1.WebSearchAdapter(apiKey, provider);
        // Phase 9b: Initialize LearnedFactsStore (persistent learning)
        this.learnedFactsStore = new learned_facts_store_1.LearnedFactsStore("./data/learned-facts.json", 30);
        // Phase 58: 모든 stdlib 모듈 등록 (stdlib-loader.ts로 분리)
        (0, stdlib_loader_1.loadAllStdlib)(this);
        // Phase 49: FL 표준 라이브러리 (fl-map, fl-filter, fl-reduce, Maybe, Result 등)
        this.loadFlStdlib();
        // Phase 5 Week 2: Register built-in type classes and instances
        this.registerBuiltinTypeClasses();
        // Phase 63: 표준 매크로 등록 (when, unless, and2)
        this.registerStandardMacros();
    }
    // Phase 63: 표준 매크로 등록
    registerStandardMacros() {
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
    loadFlStdlib() {
        try {
            const stdlibPath = path.join(__dirname, "freelang-stdlib.fl");
            if (!fs.existsSync(stdlibPath))
                return;
            const src = fs.readFileSync(stdlibPath, "utf-8");
            this.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
        }
        catch {
            // stdlib 로드 실패 시 조용히 스킵 (런타임은 계속 동작)
        }
        // TS 내장 {tag,kind,value} 표현용 Maybe/Result helpers
        // TS built-in: (ok v)→{tag:"Ok",...}  (some v)→{tag:"Some",...}  etc.
        const isSomeVal = (m) => Array.isArray(m) ? m[0] === "some" : m?.tag === "Some";
        const getVal = (m) => Array.isArray(m) ? m[1] : m?.value;
        const callFn = (fn, v) => typeof fn === "string" ? this.callUserFunction(fn, [v]) : fn(v);
        const tsHelpers = {
            "ok?": (r) => r?.tag === "Ok",
            "err?": (r) => r?.tag === "Err",
            "some?": (m) => isSomeVal(m),
            "none?": (m) => Array.isArray(m) ? m[0] === "none" : m?.tag === "None",
            "maybe-or": (m, d) => isSomeVal(m) ? getVal(m) : d,
            "maybe-map": (m, fn) => isSomeVal(m)
                ? { tag: "Some", kind: "Option", value: callFn(fn, getVal(m)) }
                : m,
            "maybe-chain": (m, fn) => isSomeVal(m) ? callFn(fn, getVal(m)) : m,
            "result-or": (r, d) => r?.tag === "Ok" ? r.value : d,
            "result-map": (r, fn) => r?.tag === "Ok"
                ? { tag: "Ok", kind: "Result", value: callFn(fn, r.value) }
                : r,
            "result-chain": (r, fn) => r?.tag === "Ok" ? callFn(fn, r.value) : r,
        };
        for (const [name, fn] of Object.entries(tsHelpers)) {
            this.context.functions.set(name, { name, params: [], body: fn });
        }
    }
    registerModule(module) {
        for (const [name, fn] of Object.entries(module)) {
            this.context.functions.set(name, { name, params: [], body: fn });
            if (this.context.typeChecker) {
                const paramTypes = Array(fn.length).fill({ kind: "type", name: "any" });
                this.context.typeChecker.registerFunction(name, paramTypes, { kind: "type", name: "any" });
            }
        }
    }
    interpret(blocks) {
        try {
            // Phase 63: 매크로 확장 전처리 — defmacro 먼저 처리, 나머지는 확장
            // 1단계: defmacro 노드 선처리
            for (const node of blocks) {
                if (node.kind === "sexpr" && node.op === "defmacro") {
                    this.evalDefmacro(node);
                }
            }
            // 2단계: defmacro가 아닌 노드는 매크로 확장 후 실행
            blocks = blocks.map((node) => {
                if (node.kind === "sexpr" && node.op === "defmacro")
                    return node;
                return this.context.macroExpander.expand(node);
            });
            for (const node of blocks) {
                if (node.kind === "sexpr" && node.op === "defmacro")
                    continue; // 이미 처리됨
                if ((0, ast_1.isImportBlock)(node)) {
                    this.evalImportBlock(node);
                }
                else if ((0, ast_1.isOpenBlock)(node)) {
                    this.evalOpenBlock(node);
                }
                else if ((0, ast_1.isSearchBlock)(node)) {
                    this.context.lastValue = this.handleSearchBlock(node);
                }
                else if ((0, ast_1.isLearnBlock)(node)) {
                    this.context.lastValue = this.handleLearnBlock(node);
                }
                else if ((0, ast_1.isReasoningBlock)(node)) {
                    this.context.lastValue = this.handleReasoningBlock(node);
                }
                else if ((0, ast_1.isReasoningSequence)(node)) {
                    this.context.lastValue = this.handleReasoningSequence(node);
                }
                else if ((0, ast_1.isModuleBlock)(node)) {
                    this.evalModuleBlock(node);
                }
                else if ((0, ast_1.isBlock)(node)) {
                    this.evalBlock(node);
                }
                else {
                    this.context.lastValue = this.eval(node);
                }
            }
        }
        catch (e) {
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
    run(source) {
        return this.interpret((0, parser_1.parse)((0, lexer_1.lex)(source)));
    }
    evalBlock(block) {
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
    handleServerBlock(block) {
        // [SERVER name :port 3009 :host "0.0.0.0" ...]
        const port = Number(this.getFieldValue(block, "port") || 3009);
        const host = String(this.getFieldValue(block, "host") || "0.0.0.0");
        this.serverConfig = { port, host };
    }
    handleRouteBlock(block) {
        // [ROUTE name :method "GET" :path "/api/health" :handler (json-response ...)]
        const method = this.getFieldValue(block, "method", "GET");
        const path = this.getFieldValue(block, "path", "/");
        const handler = block.fields.get("handler");
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
    handleFuncBlock(block) {
        // [FUNC name :params [$x $y] :body (+ $x $y)]
        // Phase 3: [FUNC name :params [[$x int] [$y int]] :return int :body (+ $x $y)]
        const paramsField = block.fields.get("params");
        const params = [];
        if (paramsField && paramsField.kind === "variable") {
            params.push(paramsField.name);
        }
        else if (paramsField?.kind === "block" && paramsField.type === "Array") {
            const items = paramsField.fields.get("items");
            if (Array.isArray(items)) {
                params.push(...items.map((item) => {
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
        const body = block.fields.get("body");
        if (!body) {
            throw new Error(`[FUNC ${block.name}] Missing :body`);
        }
        // Get parameter types from typeAnnotations
        let paramTypes = [];
        let returnType = { kind: "type", name: "any" };
        if (block.typeAnnotations && this.context.typeChecker) {
            const paramsTypeAnnotations = block.typeAnnotations.get("params");
            if (Array.isArray(paramsTypeAnnotations)) {
                paramTypes = paramsTypeAnnotations;
            }
            else {
                paramTypes = params.map(() => ({ kind: "type", name: "any" }));
            }
            const returnTypeAnnotation = block.typeAnnotations.get("return");
            if (returnTypeAnnotation) {
                returnType = returnTypeAnnotation;
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
            }
            else {
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
    handleIntentBlock(block) {
        // [INTENT name :key1 val1 :key2 val2 ...]
        const intentFields = new Map();
        for (const [key, value] of block.fields) {
            if (key.startsWith(":")) {
                intentFields.set(key, value);
            }
        }
        this.context.intents.set(block.name, {
            name: block.name,
            fields: intentFields,
        });
    }
    handleMiddlewareBlock(block) {
        const config = new Map();
        for (const [key, value] of block.fields) {
            if (key.startsWith(":")) {
                config.set(key, this.eval(value));
            }
        }
        this.context.middleware.push({
            name: block.name,
            config,
        });
    }
    handleWebSocketBlock(block) {
        // [WEBSOCKET name :path "/ws/events" :on-connect ... :on-message ... :on-disconnect ...]
        // WebSocket support (implement later)
    }
    handleErrorHandlerBlock(block) {
        // [ERROR-HANDLER name :on-404 ... :on-500 ...]
        const on404 = block.fields.get("on-404");
        const on500 = block.fields.get("on-500");
        if (on404)
            this.context.errorHandlers.handlers.set(404, on404);
        if (on500)
            this.context.errorHandlers.handlers.set(500, on500);
    }
    eval(node) {
        if (!node)
            return null;
        // Literal values
        if (node.kind === "literal") {
            const lit = node;
            // 문자열 보간: "Hello {$name}!" 또는 "결과: {(+ $a $b)}"
            if (lit.type === "string" && typeof lit.value === "string" &&
                (lit.value.includes("{$") || lit.value.includes("{("))) {
                return this.interpolateString(lit.value);
            }
            // Self-hosting: bare symbol (without $) as variable reference
            // e.g. (define i 0) then (+ i 1) → looks up $i
            if (lit.type === "symbol" && typeof lit.value === "string") {
                // true/false/null always evaluate to their proper JS values
                if (lit.value === "true")
                    return true;
                if (lit.value === "false")
                    return false;
                if (lit.value === "null")
                    return null;
                const varName = "$" + lit.value;
                if (this.context.variables.has(varName)) {
                    return this.context.variables.get(varName);
                }
            }
            return lit.value;
        }
        // Variables
        if (node.kind === "variable") {
            let varName = node.name;
            // Self-hosting: dot field access — "env.vars" → resolve "env", then access "vars"
            if (varName.includes(".")) {
                const parts = varName.split(".");
                let obj = this.context.variables.has("$" + parts[0])
                    ? this.context.variables.get("$" + parts[0])
                    : this.context.variables.get(parts[0]);
                for (let p = 1; p < parts.length; p++) {
                    if (obj === null || obj === undefined)
                        return null;
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
        if (node.kind === "keyword") {
            return node.name;
        }
        // S-expressions: (op arg1 arg2 ...)
        if (node.kind === "sexpr") {
            return this.evalSExpr(node);
        }
        // Blocks (nested structures)
        if (node.kind === "block") {
            const block = node;
            // Control blocks (FUNC, SERVER, ROUTE, etc.) must NOT be eval'd here
            // They should be handled by interpret() or evalBlock(), not eval()
            if ((0, ast_1.isBlock)(block) && (0, ast_1.isControlBlock)(block)) {
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
                const result = {};
                for (const [key, value] of block.fields) {
                    result[key] = Array.isArray(value) ? value.map((v) => this.eval(v)) : this.eval(value);
                }
                return result;
            }
            // For other block types (should only be Array/Map), throw error
            throw new Error(`Unknown block type: ${block.type}`);
        }
        // Pattern matching (Phase 4 Week 3-4)
        if (node.kind === "pattern-match") {
            return this.evalPatternMatch(node);
        }
        // Function value (Phase 4 Week 1: First-class functions)
        if (node.kind === "function-value") {
            return node; // Return the function value as-is
        }
        // Type Class (Phase 5 Week 2: Type Classes)
        if (node.kind === "type-class") {
            return this.evalTypeClass(node);
        }
        // Type Class Instance (Phase 5 Week 2: Type Classes)
        if (node.kind === "type-class-instance") {
            return this.evalInstance(node);
        }
        // Try-catch-finally blocks (Phase 11)
        if (node.kind === "try-block") {
            return this.evalTryBlock(node);
        }
        // Throw expressions (Phase 11)
        if (node.kind === "throw") {
            return this.evalThrow(node);
        }
        return null;
    }
    evalSExpr(expr) {
        if (expr.line !== undefined)
            this.currentLine = expr.line;
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
                        if (method.kind === "function-value") {
                            return this.callFunctionValue(method, [concreteValue, ...args]);
                        }
                        else if (typeof method === "function") {
                            return method(concreteValue, ...args);
                        }
                    }
                }
            }
            // If method dispatch fails, fall through to standard function lookup
        }
        // Phase 57: Dispatch to specialized modules
        const AI_OPS = new Set(["search", "fetch", "learn", "recall", "remember", "forget", "observe", "analyze", "decide", "act", "verify", "await"]);
        const SPECIAL_OPS = new Set(["fn", "async", "set!", "define", "func-ref", "call", "compose", "pipe", "->", "->>", "|>", "let", "set", "if", "cond", "do", "begin", "progn", "loop", "recur", "while", "and", "or", "defmacro", "macroexpand", "defstruct", "defprotocol", "impl", "parallel", "race", "with-timeout"]);
        if (AI_OPS.has(op))
            return (0, eval_ai_blocks_1.evalAiBlock)(this, op, expr);
        if (SPECIAL_OPS.has(op))
            return (0, eval_special_forms_1.evalSpecialForm)(this, op, expr);
        // map (3-arg comprehension form) → evalSpecialForm; otherwise falls through to builtins
        if (op === "map" && expr.args.length === 3) {
            const mapResult = (0, eval_special_forms_1.evalSpecialForm)(this, op, expr);
            if (mapResult !== undefined)
                return mapResult;
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
                    const methodDef = impl.methods.get(op);
                    return this.callProtocolMethod(methodDef, selfVal, args.slice(1));
                }
            }
        }
        // Phase 66: struct native 함수 dispatch (constructor, predicate, accessor)
        const nativeKey = `__native_${op}`;
        if (this.context[nativeKey] !== undefined) {
            const nativeFn = this.context[nativeKey];
            return nativeFn(...args);
        }
        return (0, eval_builtins_1.evalBuiltin)(this, op, args, expr);
    }
    // Phase 64: 프로토콜 메서드 호출 — $self + 나머지 인자 바인딩
    callProtocolMethod(methodDef, selfVal, restArgs) {
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
        }
        finally {
            this.context.variables.pop();
        }
    }
    // 문자열 보간 처리: {$var} 와 {(expr)} 모두 지원
    interpolateString(template) {
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
                        let val;
                        if (varName.includes(".")) {
                            const parts = varName.split(".");
                            val = this.context.variables.has("$" + parts[0])
                                ? this.context.variables.get("$" + parts[0])
                                : this.context.variables.get(parts[0]);
                            for (let p = 1; p < parts.length; p++) {
                                if (val === null || val === undefined) {
                                    val = null;
                                    break;
                                }
                                val = typeof val === "object" ? val[parts[p]] : null;
                            }
                        }
                        else {
                            val = this.context.variables.has("$" + varName)
                                ? this.context.variables.get("$" + varName)
                                : this.context.variables.get(varName);
                        }
                        result += val === null || val === undefined ? "" : String(val);
                        i = end + 1;
                        continue;
                    }
                }
                else if (next === "(") {
                    // {(expr)} 패턴 — 균형 잡힌 괄호 탐색
                    let depth = 0;
                    let j = i + 1; // '{' 이후
                    while (j < template.length) {
                        if (template[j] === "(")
                            depth++;
                        else if (template[j] === ")") {
                            depth--;
                            if (depth === 0)
                                break;
                        }
                        j++;
                    }
                    if (j < template.length && j + 1 < template.length && template[j + 1] === "}") {
                        const exprStr = template.slice(i + 1, j + 1); // "(expr)"
                        try {
                            const tokens = (0, lexer_1.lex)(exprStr);
                            const ast = (0, parser_1.parse)(tokens);
                            const val = ast.length > 0 ? this.eval(ast[0]) : null;
                            result += val === null || val === undefined ? "" : String(val);
                        }
                        catch {
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
    toDisplayString(val) {
        if (val === null || val === undefined)
            return "null";
        if (typeof val === "string")
            return val;
        if (typeof val === "number" || typeof val === "boolean")
            return String(val);
        if (Array.isArray(val))
            return "[" + val.map((v) => this.toDisplayString(v)).join(", ") + "]";
        // Phase 69: 레이지 시퀀스 — 앞 3개만 미리보기
        if ((0, lazy_seq_1.isLazySeq)(val)) {
            const preview = (0, lazy_seq_1.take)(3, val).map((v) => this.toDisplayString(v)).join(", ");
            return `<lazy-seq: ${preview}...>`;
        }
        if (typeof val === "object") {
            if (val.kind === "function-value")
                return `<fn:${val.name || "λ"}>`;
            const entries = Object.entries(val)
                .filter(([k]) => !k.startsWith("_"))
                .map(([k, v]) => `${k}: ${this.toDisplayString(v)}`);
            return "{" + entries.join(", ") + "}";
        }
        return String(val);
    }
    // Phase 58: 함수 호출 로직 eval-call-function.ts로 분리
    callUserFunction(name, args) { return (0, eval_call_function_1.callUserFunction)(this, name, args); }
    callFunctionValue(fn, args) { return (0, eval_call_function_1.callFunctionValue)(this, fn, args); }
    callAsyncFunctionValue(fn, args) { return (0, eval_call_function_1.callAsyncFunctionValue)(this, fn, args); }
    callFunction(fn, args) { return (0, eval_call_function_1.callFunction)(this, fn, args); }
    // Phase 61: TCO 메서드 — 꼬리 재귀를 반복문으로 (100만 재귀 스택 없이)
    callUserFunctionTCO(name, args) { return (0, eval_call_function_1.callUserFunctionTCO)(this, name, args); }
    callFunctionValueTCO(fn, args) { return (0, eval_call_function_1.callFunctionValueTCO)(this, fn, args); }
    // trampoline용 raw 메서드 (TailCall 토큰 그대로 반환)
    callUserFunctionRaw(name, args) { return (0, eval_call_function_1.callUserFunctionRaw)(this, name, args); }
    callFunctionValueRaw(fn, args) { return (0, eval_call_function_1.callFunctionValueRaw)(this, fn, args); }
    getFieldValue(block, key, defaultValue = null) {
        const field = block.fields.get(key);
        if (field === undefined) {
            return defaultValue;
        }
        return this.eval(field);
    }
    // ===== Pattern Matching (Phase 4 Week 3-4) — Phase 58: eval-pattern-match.ts로 분리 =====
    evalPatternMatch(match) { return (0, eval_pattern_match_1.evalPatternMatch)(this, match); }
    evalTryBlock(tryBlock) { return (0, eval_pattern_match_1.evalTryBlock)(this, tryBlock); }
    evalThrow(throwExpr) { return (0, eval_pattern_match_1.evalThrow)(this, throwExpr); }
    matchPattern(pattern, value) {
        return (0, eval_pattern_match_1.matchPattern)(this, pattern, value);
    }
    // Utility: Get context
    getContext() {
        return this.context;
    }
    // Utility: Set variable
    setVariable(name, value) {
        this.context.variables.set(name, value);
    }
    // Phase 63: defmacro 처리 (interpret() 선처리용)
    evalDefmacro(expr) {
        if (expr.args.length < 3)
            throw new Error(`defmacro requires name, params, and body`);
        const nameNode = expr.args[0];
        const macroName = nameNode.kind === "literal" ? String(nameNode.value)
            : nameNode.kind === "variable" ? nameNode.name
                : String(nameNode.value ?? nameNode.name ?? "");
        const paramsNode = expr.args[1];
        const params = [];
        if (paramsNode.kind === "block" && paramsNode.type === "Array") {
            const items = paramsNode.fields.get("items");
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.kind === "variable")
                        params.push(item.name.startsWith("$") ? item.name : "$" + item.name);
                    else if (item.kind === "literal")
                        params.push("$" + item.value);
                }
            }
        }
        const body = expr.args[2];
        this.context.macroExpander.define(macroName, params, body);
    }
    // Phase 5 Week 2: Register built-in type classes and instances
    // Phase 58: Type class 관련 로직 eval-type-classes.ts로 분리
    registerBuiltinTypeClasses() { (0, eval_type_classes_1.registerBuiltinTypeClasses)(this); }
    evalTypeClass(typeClass) { (0, eval_type_classes_1.evalTypeClass)(this, typeClass); }
    evalInstance(instance) { (0, eval_type_classes_1.evalInstance)(this, instance); }
    // Type class query helpers
    getTypeClass(name) {
        return this.context.typeClasses?.get(name);
    }
    getTypeClassInstance(className, concreteType) {
        return this.context.typeClassInstances?.get(`${className}[${concreteType}]`);
    }
    satisfiesConstraint(type, constraintClass) {
        return !!this.getTypeClassInstance(constraintClass, type);
    }
    getConcreteType(value) {
        if (!value || typeof value !== "object")
            return undefined;
        if (value.tag === "Ok" || value.tag === "Err")
            return "Result";
        if (value.tag === "Some" || value.tag === "None")
            return "Option";
        if (Array.isArray(value))
            return "List";
        if (value.kind === "Result")
            return "Result";
        if (value.kind === "Option")
            return "Option";
        if (value.kind === "List")
            return "List";
        return undefined;
    }
    resolveMethod(className, concreteType, methodName) {
        const instance = this.getTypeClassInstance(className, concreteType);
        return instance?.implementations.get(methodName);
    }
    // Phase 6 Step 4: Helper to ensure modules map exists
    getModules() {
        if (!this.context.modules) {
            this.context.modules = new Map();
        }
        return this.context.modules;
    }
    // Phase 57: delegated to eval-module-system.ts
    evalModuleBlock(moduleBlock) { (0, eval_module_system_1.evalModuleBlock)(this, moduleBlock); }
    evalImportBlock(importBlock) { (0, eval_module_system_1.evalImportBlock)(this, importBlock); }
    evalImportFromFile(relPath, prefix, selective, alias) {
        (0, eval_module_system_1.evalImportFromFile)(this, relPath, prefix, selective, alias);
    }
    evalOpenBlock(openBlock) { (0, eval_module_system_1.evalOpenBlock)(this, openBlock); }
    // Phase 57: delegated to eval-ai-handlers.ts
    handleSearchBlock(searchBlock) { return (0, eval_ai_handlers_1.handleSearchBlock)(this, searchBlock); }
    handleLearnBlock(learnBlock) { return (0, eval_ai_handlers_1.handleLearnBlock)(this, learnBlock); }
    handleReasoningBlock(reasoningBlock) { return (0, eval_ai_handlers_1.handleReasoningBlock)(this, reasoningBlock); }
    handleReasoningSequence(reasoningSeq) { return (0, eval_reasoning_sequence_1.handleReasoningSequence)(this, reasoningSeq); }
    /**
     * Cleanup: Destroy all resources and stop timers
     * Call this when shutting down the interpreter to prevent memory leaks
     * (e.g., after all tests complete or on process exit)
     */
    destroy() {
        // Clean up LearnedFactsStore timer
        this.learnedFactsStore.destroy();
        // Close HTTP server if running
        if (this.context.server) {
            this.context.server.close();
        }
        this.logger.info("Interpreter cleanup completed");
    }
}
exports.Interpreter = Interpreter;
Interpreter.MAX_CALL_DEPTH = 5000; // Phase 61: 상향 (trampoline이 100만 재귀 처리)
// Global interpreter reference for cleanup on process exit
let globalInterpreterInstance = null;
function interpret(blocks, logger) {
    const interpreter = new Interpreter(logger);
    globalInterpreterInstance = interpreter;
    // Register cleanup handler on first interpret() call
    if (!process.listeners("exit").some(l => l.name === "cleanupInterpreter")) {
        const cleanupInterpreter = function () {
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
//# sourceMappingURL=interpreter.js.map