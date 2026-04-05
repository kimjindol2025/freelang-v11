"use strict";
// FreeLang v9: Interpreter
// AST → 실행 (Express 서버 포함)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Interpreter = void 0;
exports.interpret = interpret;
const express_1 = __importDefault(require("express"));
const type_checker_1 = require("./type-checker");
// Interpreter class
class Interpreter {
    constructor(app = (0, express_1.default)()) {
        this.context = {
            functions: new Map(),
            routes: new Map(),
            intents: new Map(),
            variables: new Map(),
            app,
            middleware: [],
            errorHandlers: { handlers: new Map() },
            startTime: Date.now(),
            typeChecker: (0, type_checker_1.createTypeChecker)(), // Phase 3: Initialize type checker
            typeClasses: new Map(), // Phase 5 Week 2: Type class registry
            typeClassInstances: new Map(), // Phase 5 Week 2: Type class instance registry
            modules: new Map(), // Phase 6: Module registry
        };
        // Phase 5 Week 2: Register built-in type classes and instances
        this.registerBuiltinTypeClasses();
    }
    interpret(blocks) {
        // Process all blocks/nodes
        for (const node of blocks) {
            // Phase 6: Handle both Block types and new S-expression based types
            if (node.kind === "block" || node.type) {
                this.evalBlock(node);
            }
            else if (node.kind === "import") {
                this.evalImportBlock(node);
            }
            else if (node.kind === "open") {
                this.evalOpenBlock(node);
            }
            else if (node.kind === "module") {
                this.evalModuleBlock(node);
            }
            else {
                // Other ASTNode types (SExpr, PatternMatch, etc.)
                this.eval(node);
            }
        }
        // Setup Express routes
        this.setupExpressRoutes();
        return this.context;
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
        // [SERVER name :port 3009 :host "localhost" ...]
        const port = this.getFieldValue(block, "port") || 3009;
        const host = this.getFieldValue(block, "host") || "localhost";
        // Store server config (implement later)
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
                        return item.name;
                    }
                    // Fallback
                    return item.name || "$unknown";
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
    setupExpressRoutes() {
        for (const [, route] of this.context.routes) {
            const method = route.method.toLowerCase();
            const handler = (req, res) => {
                try {
                    this.context.variables.set("request", req);
                    this.context.variables.set("response", res);
                    const result = this.eval(route.handler);
                    // If handler returns an object, send as JSON
                    if (typeof result === "object") {
                        res.json(result);
                    }
                    else {
                        res.send(result);
                    }
                }
                catch (error) {
                    res.status(500).json({ error: error.message });
                }
            };
            if (method === "get") {
                this.context.app.get(route.path, handler);
            }
            else if (method === "post") {
                this.context.app.post(route.path, handler);
            }
            else if (method === "put") {
                this.context.app.put(route.path, handler);
            }
            else if (method === "delete") {
                this.context.app.delete(route.path, handler);
            }
        }
    }
    eval(node) {
        if (!node)
            return null;
        // Literal values
        if (node.kind === "literal") {
            return node.value;
        }
        // Variables
        if (node.kind === "variable") {
            let varName = node.name;
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
            if (block.type === "Array") {
                const items = block.fields.get("items");
                if (Array.isArray(items)) {
                    return items.map((item) => this.eval(item));
                }
            }
            // For other block types, return as object
            const result = {};
            for (const [key, value] of block.fields) {
                result[key] = Array.isArray(value) ? value.map((v) => this.eval(v)) : this.eval(value);
            }
            return result;
        }
        // Pattern matching (Phase 4 Week 3-4)
        if (node.kind === "pattern-match") {
            return this.evalPatternMatch(node);
        }
        // Function value (Phase 4 Week 1: First-class functions)
        if (node.kind === "function-value") {
            return node; // Return the function value as-is
        }
        return null;
    }
    evalSExpr(expr) {
        const op = expr.op;
        // Phase 4 Week 1: First-class functions - handle before arg evaluation
        if (op === "fn") {
            // (fn [$x $y] (+ $x $y))
            // expr.args[0] = params (array of variable names)
            // expr.args[1] = body
            if (expr.args.length < 2) {
                throw new Error(`fn requires at least 2 arguments (params and body)`);
            }
            const paramsNode = expr.args[0];
            const params = [];
            // Extract parameter names from array block
            if (paramsNode.kind === "block" && paramsNode.type === "Array") {
                const items = paramsNode.fields.get("items");
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item.kind === "variable") {
                            params.push(item.name);
                        }
                    }
                }
            }
            // Create function value with captured environment
            return {
                kind: "function-value",
                params,
                body: expr.args[1],
                capturedEnv: new Map(this.context.variables),
                name: undefined,
            };
        }
        if (op === "func-ref") {
            // (func-ref function-name) - get function as value
            if (expr.args.length < 1) {
                throw new Error(`func-ref requires function name`);
            }
            const funcName = expr.args[0].name || String(expr.args[0]);
            const func = this.context.functions.get(funcName);
            if (!func) {
                throw new Error(`Function not found: ${funcName}`);
            }
            return {
                kind: "function-value",
                params: func.params,
                body: func.body,
                capturedEnv: new Map(this.context.variables),
                name: funcName,
            };
        }
        if (op === "call") {
            // (call function-value arg1 arg2 ...)
            if (expr.args.length < 1) {
                throw new Error(`call requires function as first argument`);
            }
            const fn = this.eval(expr.args[0]);
            const args = expr.args.slice(1).map((arg) => this.eval(arg));
            if (fn.kind === "function-value") {
                return this.callFunctionValue(fn, args);
            }
            else {
                throw new Error(`call expects function-value, got ${typeof fn}`);
            }
        }
        // Evaluate all arguments for normal operations
        const args = expr.args.map((arg) => this.eval(arg));
        // Built-in functions
        switch (op) {
            // Arithmetic
            case "+":
                return args.reduce((a, b) => a + b, 0);
            case "-":
                return args.length === 1 ? -args[0] : args.reduce((a, b) => a - b);
            case "*":
                return args.reduce((a, b) => a * b, 1);
            case "/":
                return args.length === 1 ? 1 / args[0] : args.reduce((a, b) => a / b);
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
            case "fn":
                // Phase 4 Week 1: (fn [$param1 $param2 ...] body)
                // Create a function value with captured environment
                // expr.args[0] is the parameter array AST (unevaluated list of variables)
                // expr.args[1] is the body AST
                let params = [];
                const paramNode = expr.args[0];
                // paramNode should be an object with structure like: { kind: 'literal', value: [...Variable nodes...] }
                // OR it could be a raw array if parsed differently
                // We need to extract the variable names from the parameter list
                // Case 1: paramNode is parsed as a literal with value = array of Variable nodes
                if (paramNode && typeof paramNode === 'object' && 'kind' in paramNode && paramNode.kind === 'literal' && Array.isArray(paramNode.value)) {
                    const paramValues = paramNode.value;
                    params = paramValues.map(p => {
                        if (p && typeof p === 'object' && 'kind' in p && p.kind === 'variable') {
                            return p.name;
                        }
                        throw new Error(`fn parameter must be a variable, got ${p.kind}`);
                    });
                }
                // Case 2: paramNode is a Variable node (single parameter)
                else if (paramNode && typeof paramNode === 'object' && 'kind' in paramNode && paramNode.kind === 'variable') {
                    params = [paramNode.name];
                }
                // Case 3: paramNode was somehow evaluated (shouldn't happen)
                else if (Array.isArray(paramNode)) {
                    // This shouldn't happen in normal operation
                    // But if it does, try to extract names
                    params = paramNode.map(p => typeof p === 'string' ? p : String(p));
                }
                else {
                    throw new Error(`fn expects parameter array, got ${paramNode && typeof paramNode === 'object' && 'kind' in paramNode ? paramNode.kind : typeof paramNode}`);
                }
                const body = expr.args[1]; // Get unevaluated body
                return {
                    kind: "function-value",
                    params: params,
                    body: body,
                    capturedEnv: new Map(this.context.variables),
                };
            case "reduce":
                // Phase 4 Week 2: (reduce [1 2 3 4] 0 (fn [acc x] (+ acc x)))
                // args[0] = array, args[1] = initial accumulator, args[2] = function
                if (!Array.isArray(args[0])) {
                    throw new Error(`reduce expects array as first argument, got ${typeof args[0]}`);
                }
                let accumulator = args[1];
                const reduceFn = args[2];
                for (const item of args[0]) {
                    accumulator = this.callFunction(reduceFn, [accumulator, item]);
                }
                return accumulator;
            // HTTP responses
            case "json-response":
                // Convert arguments to object
                // If single argument that's already an object, use it
                if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
                    return args[0];
                }
                // If it's an array (from list), convert keyword-value pairs to object
                if (Array.isArray(args[0])) {
                    const obj = {};
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
                    }
                    else {
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
                if (!Array.isArray(args[0]))
                    return [];
                const flatten = (arr) => arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
                return flatten(args[0]);
            case "unique":
                // (unique [1 2 2 3 3 3]) → [1 2 3]
                return Array.isArray(args[0]) ? [...new Set(args[0])] : [];
            case "sort":
                // (sort [3 1 2]) → [1 2 3]
                if (!Array.isArray(args[0]))
                    return [];
                return [...args[0]].sort((a, b) => {
                    if (typeof a === "number" && typeof b === "number")
                        return a - b;
                    return String(a).localeCompare(String(b));
                });
            case "concat":
                // (concat [1 2] [3 4]) → [1 2 3 4]
                if (!Array.isArray(args[0]))
                    return args[1] || [];
                if (!Array.isArray(args[1]))
                    return args[0] || [];
                return args[0].concat(args[1]);
            case "push":
                // (push [1 2] 3) → [1 2 3]
                if (!Array.isArray(args[0]))
                    return [args[1]];
                return [...args[0], args[1]];
            case "pop":
                // (pop [1 2 3]) → 3 (returns last element)
                return Array.isArray(args[0]) && args[0].length > 0 ? args[0][args[0].length - 1] : null;
            case "shift":
                // (shift [1 2 3]) → 1 (returns first element)
                return Array.isArray(args[0]) && args[0].length > 0 ? args[0][0] : null;
            case "unshift":
                // (unshift [1 2] 0) → [0 1 2]
                if (!Array.isArray(args[0]))
                    return [args[1]];
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
            // Phase 4 Week 2: Monad Operations
            case "ok":
                // (ok value) → Result Ok
                return { tag: "Ok", value: args[0], kind: "Result" };
            case "err":
                // (err message) → Result Err
                return { tag: "Err", value: args[0], kind: "Result" };
            case "some":
                // (some value) → Option Some
                return { tag: "Some", value: args[0], kind: "Option" };
            case "none":
                // (none) → Option None
                return { tag: "None", value: null, kind: "Option" };
            case "pure":
                // (pure value) → wraps value in default monad
                return { tag: "Pure", value: args[0], kind: "Monad" };
            // Phase 5 Week 4: Either monad
            case "left":
                // (left error) → Either Left (error value)
                return { tag: "Left", value: args[0], kind: "Either" };
            case "right":
                // (right value) → Either Right (success value)
                return { tag: "Right", value: args[0], kind: "Either" };
            // Phase 5 Week 4: Validation monad
            case "failure":
                // (failure errors) → Validation Failure
                const errors = Array.isArray(args[0]) ? args[0] : [args[0]];
                return { tag: "Failure", value: errors, kind: "Validation" };
            case "success":
                // (success value) → Validation Success
                return { tag: "Success", value: args[0], kind: "Validation" };
            // Phase 5 Week 4: Writer monad
            case "tell":
                // (tell log) → Writer with empty value and log
                return { kind: "Writer", value: null, log: String(args[0]) };
            case "return-writer":
            case "pure-writer":
                // (return-writer value) or (pure-writer value) → Writer with value and empty log
                return { kind: "Writer", value: args[0], log: "" };
            case "bind":
                // Phase 4 Week 2: Monadic bind operation
                // (bind monad transform-fn)
                if (expr.args.length < 2) {
                    throw new Error(`bind requires monad and transform function`);
                }
                const monad = this.eval(expr.args[0]);
                const transformFn = this.eval(expr.args[1]);
                if (monad.kind === "Result") {
                    if (monad.tag === "Ok") {
                        return this.callFunction(transformFn, [monad.value]);
                    }
                    return monad; // Return Error unchanged
                }
                if (monad.kind === "Option") {
                    if (monad.tag === "Some") {
                        return this.callFunction(transformFn, [monad.value]);
                    }
                    return monad; // Return None unchanged
                }
                if (Array.isArray(monad)) {
                    // List monad: flatMap
                    let result = [];
                    for (const item of monad) {
                        const transformed = this.callFunction(transformFn, [item]);
                        if (Array.isArray(transformed)) {
                            result = result.concat(transformed);
                        }
                        else {
                            result.push(transformed);
                        }
                    }
                    return result;
                }
                // Phase 5 Week 4: Either monad
                if (monad.kind === "Either") {
                    if (monad.tag === "Right") {
                        return this.callFunction(transformFn, [monad.value]);
                    }
                    return monad; // Return Left unchanged
                }
                // Phase 5 Week 4: Validation monad
                if (monad.kind === "Validation") {
                    if (monad.tag === "Success") {
                        const result = this.callFunction(transformFn, [monad.value]);
                        // If result is also a Validation, flatten it
                        if (result.kind === "Validation" && result.tag === "Failure") {
                            // Error accumulation could go here in more advanced version
                            return result;
                        }
                        return result;
                    }
                    return monad; // Return Failure unchanged
                }
                // Phase 5 Week 4: Writer monad
                if (monad.kind === "Writer") {
                    const result = this.callFunction(transformFn, [monad.value]);
                    if (result.kind === "Writer") {
                        // Concatenate logs
                        return {
                            kind: "Writer",
                            value: result.value,
                            log: monad.log + result.log
                        };
                    }
                    return result;
                }
                throw new Error(`bind: unsupported monad type`);
            // Phase 5 Week 1: Function Composition
            case "compose":
                // (compose f g h) → function that applies h, then g, then f (right-to-left)
                // Result: a function that takes one argument and applies functions in reverse order
                if (expr.args.length < 2) {
                    throw new Error(`compose requires at least 2 functions`);
                }
                const funcsToCompose = expr.args.map(arg => this.eval(arg));
                // Validate that all are functions
                for (let i = 0; i < funcsToCompose.length; i++) {
                    if (typeof funcsToCompose[i] !== "function" && funcsToCompose[i].kind !== "function-value") {
                        throw new Error(`compose: argument ${i} is not a function`);
                    }
                }
                // Return a function that applies all functions in reverse order
                return (x) => {
                    let result = x;
                    // Apply functions from right to left
                    for (let i = funcsToCompose.length - 1; i >= 0; i--) {
                        result = this.callFunction(funcsToCompose[i], [result]);
                    }
                    return result;
                };
            case "pipe":
                // (pipe value f g h) → applies f, then g, then h to value (left-to-right)
                // Result: the final value after applying all functions
                if (expr.args.length < 2) {
                    throw new Error(`pipe requires at least a value and one function`);
                }
                let pipeValue = this.eval(expr.args[0]);
                // Apply each function in order (left to right)
                for (let i = 1; i < expr.args.length; i++) {
                    const fn = this.eval(expr.args[i]);
                    pipeValue = this.callFunction(fn, [pipeValue]);
                }
                return pipeValue;
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
    evalLet(args) {
        if (args.length < 2) {
            throw new Error(`let requires at least 2 arguments`);
        }
        // (let [[var1 val1] [var2 val2]] body)
        const bindings = args[0];
        const body = args[1];
        // Parse bindings
        if (bindings.kind === "block" && bindings.type === "Array") {
            const items = bindings.fields.get("items");
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.kind === "block" && item.type === "Array") {
                        const bindingItems = item.fields.get("items");
                        if (Array.isArray(bindingItems) && bindingItems.length >= 2) {
                            const varName = bindingItems[0].name;
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
    evalCond(args) {
        // (cond [test1 result1] [test2 result2] ... [else default])
        for (const arg of args) {
            if (arg.kind === "block" && arg.type === "Array") {
                const items = arg.fields.get("items");
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
    callUserFunction(name, args) {
        // Phase 4: Check if this is a generic function call (e.g., identity[int] or first-of-pair[int, string])
        let baseName = name;
        let typeArgs = null;
        // Match: function-name[T] or function-name[T, K, V] (allow hyphens and alphanumerics)
        const bracketMatch = name.match(/^([\w\-]+)\[([^\]]+)\]$/);
        if (bracketMatch) {
            baseName = bracketMatch[1];
            const typeArgStr = bracketMatch[2];
            // Parse type arguments (comma-separated type names, may have spaces)
            typeArgs = typeArgStr.split(",").map((t) => ({
                kind: "type",
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
                if (typeof arg === "number")
                    return { kind: "type", name: "int" };
                if (typeof arg === "string")
                    return { kind: "type", name: "string" };
                if (typeof arg === "boolean")
                    return { kind: "type", name: "bool" };
                if (Array.isArray(arg))
                    return { kind: "type", name: "array<any>" };
                if (typeof arg === "function")
                    return { kind: "type", name: "function" };
                return { kind: "type", name: "any" };
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
    callFunctionValue(fn, args) {
        // Phase 4 Week 1: Call a function value (closure)
        if (fn.kind !== "function-value") {
            throw new Error(`Expected function-value, got ${fn.kind}`);
        }
        // Save current scope
        const savedVars = new Map(this.context.variables);
        // Restore captured environment from function definition
        this.context.variables = new Map(fn.capturedEnv);
        // Bind parameters
        for (let i = 0; i < fn.params.length; i++) {
            this.context.variables.set(fn.params[i], args[i]);
        }
        // Execute body
        const result = this.eval(fn.body);
        // Restore scope
        this.context.variables = savedVars;
        return result;
    }
    callFunction(fn, args) {
        // Phase 4 Week 2: Universal function caller
        // Handles: function-value, JavaScript functions, FreeLangFunction
        if (fn.kind === "function-value") {
            return this.callFunctionValue(fn, args);
        }
        else if (typeof fn === "function") {
            return fn(...args);
        }
        else if (fn.params && fn.body) {
            // FreeLangFunction
            return this.callUserFunction(fn.name || "anonymous", args);
        }
        else {
            throw new Error(`Cannot call ${typeof fn}`);
        }
    }
    getFieldValue(block, key, defaultValue = null) {
        const field = block.fields.get(key);
        if (field === undefined) {
            return defaultValue;
        }
        return this.eval(field);
    }
    // ===== Pattern Matching (Phase 4 Week 3-4) =====
    evalPatternMatch(match) {
        // Evaluate the value to match
        const value = this.eval(match.value);
        // Try each case in order
        for (const caseItem of match.cases) {
            // Save current variable scope
            const savedVars = new Map(this.context.variables);
            // Try to match pattern
            const matchResult = this.matchPattern(caseItem.pattern, value);
            if (matchResult.matched) {
                // Bind matched variables
                for (const [varName, varValue] of matchResult.bindings) {
                    this.context.variables.set("$" + varName, varValue);
                }
                // Check guard condition if present
                if (caseItem.guard) {
                    const guardResult = this.eval(caseItem.guard);
                    if (!guardResult) {
                        // Guard failed, restore and try next case
                        this.context.variables = savedVars;
                        continue;
                    }
                }
                // Execute body
                const result = this.eval(caseItem.body);
                // Restore variables and return result
                this.context.variables = savedVars;
                return result;
            }
            // Restore variables for next iteration
            this.context.variables = savedVars;
        }
        // No case matched, try default case
        if (match.defaultCase) {
            return this.eval(match.defaultCase);
        }
        // No match found
        throw new Error("Pattern match exhausted without matching case");
    }
    // Try to match a pattern against a value
    // Returns {matched: boolean, bindings: Map<string, any>}
    matchPattern(pattern, value) {
        const bindings = new Map();
        // Literal pattern: match exact value
        if (pattern.kind === "literal-pattern") {
            const litPattern = pattern;
            if (litPattern.value === value) {
                return { matched: true, bindings };
            }
            return { matched: false, bindings };
        }
        // Variable pattern: always matches, binds variable
        if (pattern.kind === "variable-pattern") {
            const varPattern = pattern;
            bindings.set(varPattern.name, value);
            return { matched: true, bindings };
        }
        // Wildcard pattern: always matches, no binding
        if (pattern.kind === "wildcard-pattern") {
            return { matched: true, bindings };
        }
        // List pattern: match array elements
        if (pattern.kind === "list-pattern") {
            const listPattern = pattern;
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
            }
            else if (matchedCount < value.length) {
                // If no rest element, must match exact length
                return { matched: false, bindings };
            }
            return { matched: true, bindings };
        }
        // Struct pattern: match object fields
        if (pattern.kind === "struct-pattern") {
            const structPattern = pattern;
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
        if (pattern.kind === "or-pattern") {
            const orPattern = pattern;
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
    getContext() {
        return this.context;
    }
    // Utility: Set variable
    setVariable(name, value) {
        this.context.variables.set(name, value);
    }
    // Phase 5 Week 2: Register built-in type classes and instances
    registerBuiltinTypeClasses() {
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
                ["pure", (x) => ({ tag: "Ok", value: x, kind: "Result" })],
                ["bind", this.bindMonad.bind(this)],
                ["map", this.mapResult.bind(this)],
            ]),
        });
        // Instance: Option → Monad
        this.context.typeClassInstances.set("Monad[Option]", {
            className: "Monad",
            concreteType: "Option",
            implementations: new Map([
                ["pure", (x) => ({ tag: "Some", value: x, kind: "Option" })],
                ["bind", this.bindMonad.bind(this)],
                ["map", this.mapOption.bind(this)],
            ]),
        });
        // Instance: List → Monad (FlatMap)
        this.context.typeClassInstances.set("Monad[List]", {
            className: "Monad",
            concreteType: "List",
            implementations: new Map([
                ["pure", (x) => [x]],
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
    bindMonad(monad, fn) {
        if (monad.kind === "Result") {
            if (monad.tag === "Ok") {
                return this.callFunction(fn, [monad.value]);
            }
            return monad;
        }
        if (monad.kind === "Option") {
            if (monad.tag === "Some") {
                return this.callFunction(fn, [monad.value]);
            }
            return monad;
        }
        return monad;
    }
    bindList(list, fn) {
        let result = [];
        for (const item of list) {
            const transformed = this.callFunction(fn, [item]);
            if (Array.isArray(transformed)) {
                result = result.concat(transformed);
            }
            else {
                result.push(transformed);
            }
        }
        return result;
    }
    mapResult(result, fn) {
        if (result.tag === "Ok") {
            return { tag: "Ok", value: this.callFunction(fn, [result.value]), kind: "Result" };
        }
        return result;
    }
    mapOption(option, fn) {
        if (option.tag === "Some") {
            return { tag: "Some", value: this.callFunction(fn, [option.value]), kind: "Option" };
        }
        return option;
    }
    mapList(list, fn) {
        return list.map((item) => this.callFunction(fn, [item]));
    }
    // Get type class
    getTypeClass(name) {
        return this.context.typeClasses?.get(name);
    }
    // Get type class instance
    getTypeClassInstance(className, concreteType) {
        return this.context.typeClassInstances?.get(`${className}[${concreteType}]`);
    }
    // Check if a type satisfies a type class constraint
    satisfiesConstraint(type, constraintClass) {
        return !!this.getTypeClassInstance(constraintClass, type);
    }
    // Phase 6 Step 4: Evaluate module block
    // Module 정의를 등록하고 내부 함수들을 평가
    evalModuleBlock(moduleBlock) {
        const moduleName = moduleBlock.name;
        const exports = moduleBlock.exports || [];
        const moduleBody = moduleBlock.body || [];
        // 모듈 내 함수 맵 생성
        const moduleFunctions = new Map();
        // 모듈 body 내의 블록들을 평가 (함수 등록)
        for (const node of moduleBody) {
            const block = node;
            if (block.type === "FUNC") {
                const funcName = block.name;
                const params = block.fields?.get("params") || [];
                const paramNames = Array.isArray(params)
                    ? params.map((p) => (typeof p === "string" ? p : p.value))
                    : [];
                const body = block.fields?.get("body");
                const func = {
                    name: funcName,
                    params: paramNames,
                    body,
                };
                moduleFunctions.set(funcName, func);
            }
        }
        // 모듈 정보 생성 및 등록
        const moduleInfo = {
            name: moduleName,
            exports,
            functions: moduleFunctions,
        };
        if (!this.context.modules) {
            this.context.modules = new Map();
        }
        this.context.modules.set(moduleName, moduleInfo);
        console.log(`✅ Module registered: ${moduleName} (exports: ${exports.join(", ")})`);
    }
    // Phase 6 Step 4: Evaluate import block
    // 모듈에서 함수를 선택적으로 가져오기
    evalImportBlock(importBlock) {
        const moduleName = importBlock.moduleName;
        const source = importBlock.source; // "./math.fl" 등
        const selective = importBlock.selective; // :only [add multiply]
        const alias = importBlock.alias; // :as m
        if (!this.context.modules) {
            this.context.modules = new Map();
        }
        // 모듈 찾기
        const module = this.context.modules.get(moduleName);
        if (!module) {
            throw new Error(`Module not found: ${moduleName} (from ${source || "inline"})`);
        }
        // 가져올 함수 목록 결정
        let functionsToImport = [];
        if (selective && selective.length > 0) {
            // :only 지정된 함수만 가져오기
            functionsToImport = selective.filter((name) => module.exports.includes(name));
            // 존재하지 않는 함수 검증
            selective.forEach((name) => {
                if (!module.exports.includes(name)) {
                    console.warn(`⚠️  Warning: Function "${name}" not exported from module "${moduleName}"`);
                }
            });
        }
        else {
            // 모든 export된 함수 가져오기
            functionsToImport = [...module.exports];
        }
        // 함수들을 context.functions에 추가
        functionsToImport.forEach((funcName) => {
            const func = module.functions.get(funcName);
            if (func) {
                if (alias) {
                    // :as 별칭 사용: (import math :as m) → m:add
                    const qualifiedName = `${alias}:${funcName}`;
                    this.context.functions.set(qualifiedName, func);
                }
                else {
                    // 별칭 없음: moduleName:funcName 형식으로 등록
                    const qualifiedName = `${moduleName}:${funcName}`;
                    this.context.functions.set(qualifiedName, func);
                }
            }
        });
        const importedCount = functionsToImport.length;
        const aliasStr = alias ? ` as ${alias}` : "";
        const selectStr = selective ? ` (${selective.join(", ")})` : "";
        console.log(`✅ Imported ${importedCount} function(s) from "${moduleName}"${selectStr}${aliasStr}`);
    }
    // Phase 6 Step 4: Evaluate open block
    // 모듈의 모든 export된 함수를 전역 네임스페이스에 추가
    evalOpenBlock(openBlock) {
        const moduleName = openBlock.moduleName;
        const source = openBlock.source; // "./math.fl" 등
        if (!this.context.modules) {
            this.context.modules = new Map();
        }
        // 모듈 찾기
        const module = this.context.modules.get(moduleName);
        if (!module) {
            throw new Error(`Module not found: ${moduleName} (from ${source || "inline"})`);
        }
        // 모든 export된 함수를 전역으로 추가
        module.exports.forEach((funcName) => {
            const func = module.functions.get(funcName);
            if (func) {
                // 전역 네임스페이스에 직접 추가 (별칭 없음)
                this.context.functions.set(funcName, func);
            }
        });
        console.log(`✅ Opened module "${moduleName}" (${module.exports.length} function(s) available globally)`);
    }
}
exports.Interpreter = Interpreter;
function interpret(blocks, app) {
    const interpreter = new Interpreter(app);
    return interpreter.interpret(blocks);
}
//# sourceMappingURL=interpreter.js.map