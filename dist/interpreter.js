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
        };
    }
    interpret(blocks) {
        // Process all blocks
        for (const block of blocks) {
            this.evalBlock(block);
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
                    // Phase 3: New syntax [[$x int] [$y string]] - item is an Array block with [Variable, Type]
                    if (item.kind === "block" && item.type === "Array") {
                        const innerItems = item.fields.get("items");
                        if (Array.isArray(innerItems) && innerItems.length > 0) {
                            const firstItem = innerItems[0];
                            if (firstItem.kind === "variable") {
                                return firstItem.name; // Extract parameter name from Variable
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
        this.context.functions.set(block.name, {
            name: block.name,
            params,
            body,
        });
        // Phase 3: Register function type in type checker if type annotations present
        if (block.typeAnnotations && this.context.typeChecker) {
            // Get parameter types from typeAnnotations (new syntax: [[$x int] [$y int]])
            let paramTypes = [];
            const paramsTypeAnnotations = block.typeAnnotations.get("params");
            if (Array.isArray(paramsTypeAnnotations)) {
                // New syntax: parameter types extracted from parser
                paramTypes = paramsTypeAnnotations;
            }
            else {
                // Old syntax or no param types: default to 'any'
                paramTypes = params.map(() => ({ kind: "type", name: "any" }));
            }
            // Get return type (optional, defaults to 'any')
            const returnType = block.typeAnnotations.get("return") || { kind: "type", name: "any" };
            this.context.typeChecker.registerFunction(block.name, paramTypes, returnType);
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
            const varName = node.name;
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
        return null;
    }
    evalSExpr(expr) {
        const op = expr.op;
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
                // (contains? "hello world" "world") → true
                return typeof args[0] === "string" && typeof args[1] === "string"
                    ? args[0].includes(args[1])
                    : false;
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
                // (find [1 2 3] (lambda [$x] (= $x 2))) → 2
                if (!Array.isArray(args[0]) || typeof args[1] !== "function") {
                    return null;
                }
                return args[0].find(args[1]) || null;
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
                // Check if it's a user-defined function
                if (this.context.functions.has(op)) {
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
        const func = this.context.functions.get(name);
        if (!func) {
            throw new Error(`Function not found: ${name}`);
        }
        // Phase 3: Type check function call
        if (this.context.typeChecker) {
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
            const validation = this.context.typeChecker.checkFunctionCall(name, argTypes);
            if (!validation.valid) {
                throw new Error(`Type error in call to '${name}': ${validation.message}`);
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
    getFieldValue(block, key, defaultValue = null) {
        const field = block.fields.get(key);
        if (field === undefined) {
            return defaultValue;
        }
        return this.eval(field);
    }
    // Utility: Get context
    getContext() {
        return this.context;
    }
    // Utility: Set variable
    setVariable(name, value) {
        this.context.variables.set(name, value);
    }
}
exports.Interpreter = Interpreter;
function interpret(blocks, app) {
    const interpreter = new Interpreter(app);
    return interpreter.interpret(blocks);
}
//# sourceMappingURL=interpreter.js.map