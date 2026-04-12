"use strict";
// eval-special-forms.ts — FreeLang v9 Special Form Evaluation
// Phase 57 리팩토링: interpreter.ts의 특수 폼을 분리
// fn, async, set!, define, func-ref, call, compose, pipe,
// let, set, if, cond, do/begin/progn, loop, recur, while, and, or, map
// Phase 63: defmacro, macroexpand 추가
// Phase 61: TCO 모드에서 꼬리 위치 함수 호출 → TailCall 토큰 반환
// Phase 66: defstruct — 타입이 있는 레코드 타입
Object.defineProperty(exports, "__esModule", { value: true });
exports.evalSpecialForm = evalSpecialForm;
const ast_1 = require("./ast");
const tco_1 = require("./tco");
function evalSpecialForm(interp, op, expr) {
    const ev = (node) => interp.eval(node);
    const callUser = (name, a) => interp.callUserFunction(name, a);
    const callFnVal = (fn, a) => interp.callFunctionValue(fn, a);
    const callAsyncFnVal = (fn, a) => interp.callAsyncFunctionValue(fn, a);
    const callFn = (fn, a) => interp.callFunction(fn, a);
    const ctx = interp.context;
    // ── fn ───────────────────────────────────────────────────────────
    if (op === "fn") {
        if (expr.args.length < 2)
            throw new Error(`fn requires at least 2 arguments (params and body)`);
        const paramsNode = expr.args[0];
        const params = [];
        if (paramsNode.kind === "block" && paramsNode.type === "Array") {
            const items = paramsNode.fields.get("items");
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.kind === "variable")
                        params.push(item.name);
                }
            }
        }
        return {
            kind: "function-value",
            params,
            body: expr.args[1],
            capturedEnv: ctx.variables.snapshot(),
            name: undefined,
        };
    }
    // ── async ─────────────────────────────────────────────────────────
    if (op === "async") {
        if (expr.args.length < 3)
            throw new Error(`async requires name, params, and body`);
        const nameNode = expr.args[0];
        const name = nameNode.name || "async-fn";
        const paramsNode = expr.args[1];
        const params = [];
        if (paramsNode.kind === "block" && paramsNode.type === "Array") {
            const items = paramsNode.fields.get("items");
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.kind === "variable")
                        params.push(item.name);
                }
            }
        }
        return {
            kind: "async-function-value",
            name,
            params,
            body: expr.args[2],
            capturedEnv: ctx.variables.snapshot(),
        };
    }
    // ── set! ──────────────────────────────────────────────────────────
    if (op === "set!") {
        if (expr.args.length < 2)
            throw new Error(`set! requires a name and a value`);
        const nameNode = expr.args[0];
        let name;
        if (nameNode.kind === "variable") {
            name = "$" + nameNode.name;
        }
        else if (nameNode.kind === "literal") {
            name = "$" + nameNode.value;
        }
        else {
            throw new Error(`set!: first argument must be a symbol`);
        }
        const value = ev(expr.args[1]);
        if (!ctx.variables.mutate(name, value))
            ctx.variables.set(name, value);
        return value;
    }
    // ── define ────────────────────────────────────────────────────────
    if (op === "define") {
        if (expr.args.length < 2)
            throw new Error(`define requires a name and a value`);
        const nameNode = expr.args[0];
        let name;
        if (nameNode.kind === "literal") {
            name = nameNode.value;
        }
        else if (nameNode.kind === "variable") {
            name = nameNode.name;
        }
        else {
            throw new Error(`define: first argument must be a symbol or string`);
        }
        // 3-arg form: (define name [params] body) → define function
        if (expr.args.length >= 3) {
            const paramsNode = expr.args[1];
            const bodyNode = expr.args.length === 3
                ? expr.args[2]
                : { kind: "sexpr", op: "do", args: expr.args.slice(2) };
            const items = paramsNode.kind === "block" && paramsNode.type === "Array"
                ? paramsNode.fields.get("items") || []
                : paramsNode.kind === "array"
                    ? paramsNode.items || []
                    : [];
            const params = items.map((item) => {
                if (item.kind === "variable")
                    return item.name.startsWith("$") ? item.name : "$" + item.name;
                if (item.kind === "literal")
                    return "$" + item.value;
                return "$" + (item.name || item.value || "?");
            });
            ctx.functions.set(name, { name, params, body: bodyNode });
            return null;
        }
        const value = ev(expr.args[1]);
        if (value !== null && value !== undefined && value.kind === "function-value") {
            const funcDef = {
                name,
                params: value.params,
                body: value.body,
                capturedEnv: value.capturedEnv,
            };
            ctx.functions.set(name, funcDef);
            if (ctx.typeChecker) {
                const paramTypes = value.params.map(() => ({ kind: "type", name: "any" }));
                ctx.typeChecker.registerFunction(name, paramTypes, { kind: "type", name: "any" });
            }
            return value;
        }
        else {
            ctx.variables.set("$" + name, value);
            return value;
        }
    }
    // ── func-ref ──────────────────────────────────────────────────────
    if (op === "func-ref") {
        if (expr.args.length < 1)
            throw new Error(`func-ref requires function name`);
        const funcName = expr.args[0].name || String(expr.args[0]);
        const func = ctx.functions.get(funcName);
        if (!func)
            throw new Error(`Function not found: ${funcName}`);
        return {
            kind: "function-value",
            params: func.params,
            body: func.body,
            capturedEnv: ctx.variables.snapshot(),
            name: funcName,
        };
    }
    // ── call ──────────────────────────────────────────────────────────
    if (op === "call") {
        if (expr.args.length < 1)
            throw new Error(`call requires function as first argument`);
        const fn = ev(expr.args[0]);
        const evaluatedArgs = expr.args.slice(1).map((a) => ev(a));
        if (fn.kind === "builtin-function")
            return fn.fn(evaluatedArgs);
        if (fn.kind === "function-value")
            return callFnVal(fn, evaluatedArgs);
        if (fn.kind === "async-function-value")
            return callAsyncFnVal(fn, evaluatedArgs);
        if (typeof fn === "string")
            return callUser(fn, evaluatedArgs);
        throw new Error(`call expects function-value, got ${fn.kind || typeof fn}`);
    }
    // ── compose ───────────────────────────────────────────────────────
    if (op === "compose") {
        if (expr.args.length < 2)
            throw new Error(`compose requires at least 2 functions`);
        const funcsToCompose = expr.args.map((arg) => {
            if (arg.kind === "literal" && arg.type === "symbol") {
                const fnName = arg.value;
                if (ctx.functions.has(fnName))
                    return { _isFunctionName: true, name: fnName };
                throw new Error(`compose: '${fnName}' is not a function`);
            }
            else if (arg.kind === "variable") {
                const fnName = arg.name;
                if (ctx.functions.has(fnName))
                    return { _isFunctionName: true, name: fnName };
                const value = ctx.variables.get(fnName);
                if (value && (value.kind === "function-value" || typeof value === "function"))
                    return value;
                throw new Error(`compose: '${fnName}' is not a function`);
            }
            else {
                const fn = ev(arg);
                if (typeof fn !== "function" && fn.kind !== "function-value")
                    throw new Error(`compose: argument is not a function`);
                return fn;
            }
        });
        return (x) => {
            let result = x;
            for (let i = funcsToCompose.length - 1; i >= 0; i--) {
                const fn = funcsToCompose[i];
                if (fn._isFunctionName)
                    result = callUser(fn.name, [result]);
                else
                    result = callFn(fn, [result]);
            }
            return result;
        };
    }
    // ── pipe ──────────────────────────────────────────────────────────
    if (op === "pipe") {
        if (expr.args.length < 2)
            throw new Error(`pipe requires at least a value and one function`);
        let pipeValue = ev(expr.args[0]);
        for (let i = 1; i < expr.args.length; i++) {
            const fnArg = expr.args[i];
            let pipeResult;
            if (fnArg.kind === "literal" && fnArg.type === "symbol") {
                const fnName = fnArg.value;
                if (ctx.functions.has(fnName))
                    pipeResult = callUser(fnName, [pipeValue]);
                else
                    throw new Error(`Unknown function: ${fnName}`);
            }
            else if (fnArg.kind === "variable") {
                const fnName = fnArg.name;
                if (ctx.functions.has(fnName))
                    pipeResult = callUser(fnName, [pipeValue]);
                else if (ctx.variables.has(fnName))
                    pipeResult = callFn(ctx.variables.get(fnName), [pipeValue]);
                else
                    throw new Error(`Unknown function or variable: ${fnName}`);
            }
            else {
                const fn = ev(fnArg);
                pipeResult = callFn(fn, [pipeValue]);
            }
            pipeValue = pipeResult;
        }
        return pipeValue;
    }
    // ── -> (thread-first) ────────────────────────────────────────────
    // (-> val (f1 extra) f2 (f3 a b))
    // => (f3 (f2 (f1 val extra)) a b)
    // val이 각 form의 첫 번째 인자 위치에 삽입됨
    if (op === "->") {
        if (expr.args.length < 2)
            throw new Error(`-> requires at least a value and one step`);
        const TMP_VAR = "__thread_first_tmp__";
        let val = ev(expr.args[0]);
        for (let i = 1; i < expr.args.length; i++) {
            const form = expr.args[i];
            const fk = form.kind;
            if (fk === "sexpr") {
                // (f extra-args...) → (f val extra-args...)
                const sform = form;
                ctx.variables.set(TMP_VAR, val);
                const tmpVar = { kind: "variable", name: TMP_VAR };
                const newSexpr = { kind: "sexpr", op: sform.op, args: [tmpVar, ...sform.args] };
                val = ev(newSexpr);
                ctx.variables.delete(TMP_VAR);
            }
            else if (fk === "variable") {
                const fnName = form.name;
                if (ctx.functions.has(fnName))
                    val = callUser(fnName, [val]);
                else if (ctx.variables.has(fnName))
                    val = callFn(ctx.variables.get(fnName), [val]);
                else
                    throw new Error(`->: unknown function or variable: ${fnName}`);
            }
            else if (fk === "literal" && form.type === "symbol") {
                const fnName = form.value;
                if (ctx.functions.has(fnName))
                    val = callUser(fnName, [val]);
                else
                    throw new Error(`->: unknown function: ${fnName}`);
            }
            else {
                const fn = ev(form);
                val = callFn(fn, [val]);
            }
        }
        return val;
    }
    // ── ->> (thread-last) ────────────────────────────────────────────
    // (->> val (f1 extra) f2 (f3 a b))
    // => (f3 a b (f2 (f1 val extra)))
    // val이 각 form의 마지막 인자 위치에 삽입됨
    if (op === "->>") {
        if (expr.args.length < 2)
            throw new Error(`->> requires at least a value and one step`);
        const TMP_VAR = "__thread_last_tmp__";
        let val = ev(expr.args[0]);
        for (let i = 1; i < expr.args.length; i++) {
            const form = expr.args[i];
            const fk = form.kind;
            if (fk === "sexpr") {
                // (f existing-args...) → (f existing-args... val)
                const sform = form;
                ctx.variables.set(TMP_VAR, val);
                const tmpVar = { kind: "variable", name: TMP_VAR };
                const newSexpr = { kind: "sexpr", op: sform.op, args: [...sform.args, tmpVar] };
                val = ev(newSexpr);
                ctx.variables.delete(TMP_VAR);
            }
            else if (fk === "variable") {
                const fnName = form.name;
                if (ctx.functions.has(fnName))
                    val = callUser(fnName, [val]);
                else if (ctx.variables.has(fnName))
                    val = callFn(ctx.variables.get(fnName), [val]);
                else
                    throw new Error(`->>: unknown function or variable: ${fnName}`);
            }
            else if (fk === "literal" && form.type === "symbol") {
                const fnName = form.value;
                if (ctx.functions.has(fnName))
                    val = callUser(fnName, [val]);
                else
                    throw new Error(`->>: unknown function: ${fnName}`);
            }
            else {
                const fn = ev(form);
                val = callFn(fn, [val]);
            }
        }
        return val;
    }
    // ── |> (simple pipe, alias for pipe) ─────────────────────────────
    // (|> val f1 f2 f3) ≡ (pipe val f1 f2 f3)
    if (op === "|>") {
        if (expr.args.length < 2)
            throw new Error(`|> requires at least a value and one function`);
        let pipeVal = ev(expr.args[0]);
        for (let i = 1; i < expr.args.length; i++) {
            const fnArg = expr.args[i];
            const fk = fnArg.kind;
            if (fk === "literal" && fnArg.type === "symbol") {
                const fnName = fnArg.value;
                if (ctx.functions.has(fnName))
                    pipeVal = callUser(fnName, [pipeVal]);
                else
                    throw new Error(`|>: unknown function: ${fnName}`);
            }
            else if (fk === "variable") {
                const fnName = fnArg.name;
                if (ctx.functions.has(fnName))
                    pipeVal = callUser(fnName, [pipeVal]);
                else if (ctx.variables.has(fnName))
                    pipeVal = callFn(ctx.variables.get(fnName), [pipeVal]);
                else
                    throw new Error(`|>: unknown function or variable: ${fnName}`);
            }
            else {
                const fn = ev(fnArg);
                pipeVal = callFn(fn, [pipeVal]);
            }
        }
        return pipeVal;
    }
    // ── let ───────────────────────────────────────────────────────────
    if (op === "let") {
        return evalLet(interp, expr.args);
    }
    // ── set ───────────────────────────────────────────────────────────
    if (op === "set") {
        if (expr.args.length !== 2)
            throw new Error(`set requires exactly 2 arguments: (set $var new-value)`);
        const varNode = expr.args[0];
        let varName;
        if (varNode.kind === "variable")
            varName = varNode.name;
        else if (varNode.kind === "literal" && varNode.type === "symbol")
            varName = "$" + varNode.value;
        else
            throw new Error(`set: first argument must be a variable`);
        const newValue = ev(expr.args[1]);
        if (!ctx.variables.mutate(varName, newValue))
            throw new Error(`set: variable ${varName} not found in scope`);
        return newValue;
    }
    // ── if ────────────────────────────────────────────────────────────
    if (op === "if") {
        const condition = ev(expr.args[0]);
        const branch = condition ? expr.args[1] : (expr.args[2] || null);
        if (branch === null)
            return null;
        // Phase 61: TCO 모드 — 꼬리 위치의 사용자 함수 호출을 TailCall 토큰으로 반환
        if (interp.tcoMode && branch !== null) {
            const b = branch;
            if (b.kind === "sexpr") {
                const bop = b.op;
                // 사용자 정의 함수이거나 아직 알 수 없는 함수 호출 — 일단 eval해서 확인
                // (builtin이면 그냥 실행, user-func이면 TailCall)
                const ctx = interp.context;
                if (typeof bop === "string" && ctx.functions.has(bop)) {
                    // 꼬리 위치 user-function 호출 → TailCall 토큰 반환 (스택 없이)
                    const tailArgs = b.args.map((a) => ev(a));
                    return (0, tco_1.tailCall)(bop, tailArgs);
                }
            }
        }
        return ev(branch);
    }
    // ── cond ──────────────────────────────────────────────────────────
    if (op === "cond") {
        return evalCond(interp, expr.args);
    }
    // ── do / begin / progn ───────────────────────────────────────────
    if (op === "do" || op === "begin" || op === "progn") {
        let result = null;
        for (const arg of expr.args) {
            if ((0, ast_1.isBlock)(arg) && (0, ast_1.isControlBlock)(arg)) {
                interp.evalBlock(arg);
                result = null;
                continue;
            }
            result = ev(arg);
        }
        return result;
    }
    // ── loop ──────────────────────────────────────────────────────────
    if (op === "loop") {
        const bindingsNode = expr.args[0];
        const bodyNodes = expr.args.slice(1);
        const bindingItems = bindingsNode.kind === "array"
            ? bindingsNode.items || []
            : bindingsNode.kind === "block" && bindingsNode.type === "Array"
                ? bindingsNode.fields?.get?.("items") || []
                : [];
        const loopVars = [];
        const loopInits = [];
        for (let i = 0; i < bindingItems.length; i += 2) {
            const varNode = bindingItems[i];
            const valNode = bindingItems[i + 1];
            const varName = varNode.kind === "variable" ? varNode.name
                : varNode.kind === "literal" ? String(varNode.value)
                    : String(varNode.name || varNode.value);
            loopVars.push(varName);
            loopInits.push(ev(valNode));
        }
        ctx.variables.push();
        for (let i = 0; i < loopVars.length; i++) {
            ctx.variables.set(loopVars[i], loopInits[i]);
        }
        let result = null;
        const maxIter = 100000;
        let iter = 0;
        try {
            while (iter++ < maxIter) {
                let recurred = false;
                for (const bodyNode of bodyNodes) {
                    result = ev(bodyNode);
                    if (result && typeof result === "object" && result.__FL_RECUR__) {
                        const newVals = result.__args;
                        for (let i = 0; i < loopVars.length && i < newVals.length; i++) {
                            ctx.variables.set(loopVars[i], newVals[i]);
                        }
                        recurred = true;
                        break;
                    }
                }
                if (!recurred)
                    break;
            }
        }
        finally {
            ctx.variables.pop();
        }
        return result;
    }
    // ── recur ─────────────────────────────────────────────────────────
    if (op === "recur") {
        const newVals = expr.args.map((a) => ev(a));
        return { __FL_RECUR__: true, __args: newVals };
    }
    // ── while ─────────────────────────────────────────────────────────
    if (op === "while") {
        let result = null;
        while (ev(expr.args[0])) {
            for (let i = 1; i < expr.args.length; i++)
                result = ev(expr.args[i]);
        }
        return result;
    }
    // ── and (short-circuit) ───────────────────────────────────────────
    if (op === "and") {
        let result = true;
        for (const arg of expr.args) {
            result = ev(arg);
            if (!result)
                return result;
        }
        return result;
    }
    // ── or (short-circuit) ────────────────────────────────────────────
    if (op === "or") {
        for (const arg of expr.args) {
            const result = ev(arg);
            if (result)
                return result;
        }
        return false;
    }
    // ── map (inline comprehension, 3-arg form) ────────────────────────
    if (op === "map" && expr.args.length === 3) {
        const arr = ev(expr.args[0]);
        const paramNode = expr.args[1];
        const bodyNode = expr.args[2];
        const items = paramNode.kind === "block" && paramNode.type === "Array"
            ? paramNode.fields.get?.("items") || []
            : paramNode.kind === "array"
                ? paramNode.items || []
                : [];
        const paramNames = items.map((item) => {
            if (item.kind === "variable")
                return item.name;
            if (item.kind === "literal")
                return "$" + item.value;
            return "$" + (item.name || item.value || "_");
        });
        if (Array.isArray(arr) && paramNames.length > 0) {
            return arr.map((elem) => {
                ctx.variables.push();
                ctx.variables.set(paramNames[0], elem);
                try {
                    return ev(bodyNode);
                }
                finally {
                    ctx.variables.pop();
                }
            });
        }
        // Fall through: return undefined (caller will evaluate args and try builtins)
        return undefined;
    }
    // ── defstruct ─────────────────────────────────────────────────────
    // (defstruct Point [:x :float :y :float])
    // 자동 생성:
    //   (Point 1.0 2.0)       → {:x 1.0 :y 2.0 :__type "Point"}
    //   (Point? v)            → true/false
    //   (Point.x v)           → v.x
    if (op === "defstruct") {
        if (expr.args.length < 2) {
            throw new Error(`defstruct requires a name and a field vector`);
        }
        // 1. 이름 추출
        const nameNode = expr.args[0];
        const structName = nameNode.kind === "literal" ? String(nameNode.value)
            : nameNode.kind === "variable" ? nameNode.name
                : String(nameNode.value ?? nameNode.name ?? "");
        if (!structName)
            throw new Error(`defstruct: struct name is required`);
        // 2. 필드 벡터 파싱 [:x :float :y :float]
        const fieldsNode = expr.args[1];
        const fields = [];
        if (fieldsNode.kind === "block" && fieldsNode.type === "Array") {
            const items = fieldsNode.fields.get("items");
            if (Array.isArray(items)) {
                for (let i = 0; i < items.length; i += 2) {
                    const nameItem = items[i];
                    const typeItem = items[i + 1];
                    // 키워드 (:x) or 변수 (x)
                    const fieldName = nameItem.kind === "keyword" ? nameItem.name
                        : nameItem.kind === "variable" ? nameItem.name
                            : nameItem.kind === "literal" ? String(nameItem.value)
                                : "";
                    const fieldType = typeItem === undefined ? "any"
                        : typeItem.kind === "keyword" ? typeItem.name
                            : typeItem.kind === "variable" ? typeItem.name
                                : typeItem.kind === "literal" ? String(typeItem.value)
                                    : "any";
                    if (fieldName)
                        fields.push({ name: fieldName, type: fieldType });
                }
            }
        }
        // 3. StructRegistry에 등록
        const registry = ctx.structs;
        registry.define({ name: structName, fields });
        // 4. constructor 등록 — (Point 1.0 2.0)
        const ctor = registry.makeConstructor(structName);
        ctx.functions.set(structName, {
            name: structName,
            params: fields.map((f) => f.name),
            body: { kind: "literal", type: "null", value: null },
            capturedEnv: new Map([["__struct_ctor__", ctor]]),
        });
        // native 함수로도 등록 (eval-builtins fallback이 아닌 직접 호출)
        ctx[`__native_${structName}`] = ctor;
        // 5. predicate 등록 — (Point? v)
        const pred = registry.makePredicate(structName);
        ctx[`__native_${structName}?`] = pred;
        // 6. field accessor 등록 — (Point.x v), (Point.y v) ...
        for (const field of fields) {
            const accessorName = `${structName}.${field.name}`;
            const acc = registry.makeAccessor(structName, field.name);
            ctx[`__native_${accessorName}`] = acc;
        }
        return null;
    }
    // ── defmacro ──────────────────────────────────────────────────────
    // (defmacro name [$cond $body] (if $cond $body nil))
    if (op === "defmacro") {
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
        ctx.macroExpander.define(macroName, params, body);
        return null;
    }
    // ── macroexpand ───────────────────────────────────────────────────
    // (macroexpand '(when true (println "yes"))) → 확장된 AST 출력 (디버깅용)
    if (op === "macroexpand") {
        if (expr.args.length < 1)
            throw new Error(`macroexpand requires 1 argument`);
        const form = expr.args[0];
        const expanded = ctx.macroExpander.expand(form);
        return ctx.macroExpander.astToString(expanded);
    }
    // ── defprotocol ───────────────────────────────────────────────────
    // (defprotocol Serializable
    //   [serialize [$self] :string]
    //   [deserialize [$data] :any])
    if (op === "defprotocol") {
        if (expr.args.length < 1)
            throw new Error(`defprotocol requires a name`);
        const nameNode = expr.args[0];
        const protoName = nameNode.kind === "variable" ? nameNode.name
            : nameNode.kind === "literal" ? String(nameNode.value)
                : String(nameNode.name ?? nameNode.value ?? "");
        const methods = [];
        for (let i = 1; i < expr.args.length; i++) {
            const sigNode = expr.args[i];
            if (sigNode.kind !== "block" || sigNode.type !== "Array")
                continue;
            const items = sigNode.fields.get("items");
            if (!Array.isArray(items) || items.length < 1)
                continue;
            const methodNameNode = items[0];
            const methodName = methodNameNode.kind === "variable" ? methodNameNode.name
                : methodNameNode.kind === "literal" ? String(methodNameNode.value)
                    : String(methodNameNode.name ?? methodNameNode.value ?? "");
            const params = [];
            if (items.length > 1) {
                const paramsNode = items[1];
                if (paramsNode.kind === "block" && paramsNode.type === "Array") {
                    const pItems = paramsNode.fields.get("items");
                    if (Array.isArray(pItems)) {
                        for (const p of pItems) {
                            if (p.kind === "variable")
                                params.push(p.name);
                            else if (p.kind === "literal")
                                params.push("$" + p.value);
                        }
                    }
                }
            }
            let returnType;
            if (items.length > 2) {
                const rtNode = items[2];
                if (rtNode.kind === "keyword")
                    returnType = rtNode.name;
                else if (rtNode.kind === "literal")
                    returnType = String(rtNode.value);
            }
            methods.push({ name: methodName, params, returnType });
        }
        ctx.protocols.defineProtocol({ name: protoName, methods });
        return null;
    }
    // ── impl ──────────────────────────────────────────────────────────
    // (impl Serializable Point
    //   [serialize [$self] (str "(" $self.x "," $self.y ")")]
    //   [deserialize [$data] {:x 0.0 :y 0.0}])
    if (op === "impl") {
        if (expr.args.length < 3)
            throw new Error(`impl requires protocol name, type name, and at least one method`);
        const protoNameNode = expr.args[0];
        const protoName = protoNameNode.kind === "variable" ? protoNameNode.name
            : protoNameNode.kind === "literal" ? String(protoNameNode.value)
                : String(protoNameNode.name ?? protoNameNode.value ?? "");
        const typeNameNode = expr.args[1];
        const typeName = typeNameNode.kind === "variable" ? typeNameNode.name
            : typeNameNode.kind === "literal" ? String(typeNameNode.value)
                : String(typeNameNode.name ?? typeNameNode.value ?? "");
        const implMethods = new Map();
        for (let i = 2; i < expr.args.length; i++) {
            const implNode = expr.args[i];
            if (implNode.kind !== "block" || implNode.type !== "Array")
                continue;
            const items = implNode.fields.get("items");
            if (!Array.isArray(items) || items.length < 3)
                continue;
            const methodNameNode = items[0];
            const methodName = methodNameNode.kind === "variable" ? methodNameNode.name
                : methodNameNode.kind === "literal" ? String(methodNameNode.value)
                    : String(methodNameNode.name ?? methodNameNode.value ?? "");
            const params = [];
            const paramsNode = items[1];
            if (paramsNode.kind === "block" && paramsNode.type === "Array") {
                const pItems = paramsNode.fields.get("items");
                if (Array.isArray(pItems)) {
                    for (const p of pItems) {
                        if (p.kind === "variable")
                            params.push(p.name);
                        else if (p.kind === "literal")
                            params.push("$" + p.value);
                    }
                }
            }
            const body = items[2];
            implMethods.set(methodName, { params, body });
        }
        ctx.protocols.defineImpl({ protocolName: protoName, typeName, methods: implMethods });
        return null;
    }
    // ── parallel ──────────────────────────────────────────────────────
    // (parallel expr1 expr2 ...) → [result1, result2, ...]
    // 동기 버전: 순차 실행 후 배열 반환 (FreeLangPromise는 resolve 후 반환)
    if (op === "parallel") {
        if (expr.args.length === 0)
            return [];
        const results = [];
        for (const arg of expr.args) {
            let val = ev(arg);
            // FreeLangPromise면 resolved 값 추출 시도
            if (val && typeof val === "object" && typeof val.getValue === "function") {
                try {
                    val = val.getValue();
                }
                catch {
                    val = null;
                }
            }
            results.push(val);
        }
        return results;
    }
    // ── race ──────────────────────────────────────────────────────────
    // (race expr1 expr2 ...) → 첫 번째로 완료된 결과 (동기 버전: 첫 번째 non-null 반환)
    if (op === "race") {
        if (expr.args.length === 0)
            return null;
        let firstResult = undefined;
        for (const arg of expr.args) {
            let val = ev(arg);
            if (val && typeof val === "object" && typeof val.getValue === "function") {
                try {
                    val = val.getValue();
                }
                catch {
                    val = null;
                }
            }
            if (firstResult === undefined)
                firstResult = val;
            if (val !== null && val !== undefined)
                return val;
        }
        return firstResult ?? null;
    }
    // ── with-timeout ──────────────────────────────────────────────────
    // (with-timeout ms expr) → result or null
    // 동기 버전: ms는 무시하고 즉시 실행 (비동기 환경 없으므로)
    if (op === "with-timeout") {
        if (expr.args.length < 2)
            return null;
        // expr.args[0] = ms (무시), expr.args[1] = expression
        try {
            let val = ev(expr.args[1]);
            if (val && typeof val === "object" && typeof val.getValue === "function") {
                try {
                    val = val.getValue();
                }
                catch {
                    val = null;
                }
            }
            return val;
        }
        catch {
            return null;
        }
    }
    throw new Error(`evalSpecialForm: unknown op "${op}"`);
}
// ── Helper: evalLet ───────────────────────────────────────────────
function evalLet(interp, args) {
    if (args.length < 2)
        throw new Error(`let requires at least 2 arguments`);
    const bindings = args[0];
    const ctx = interp.context;
    const ev = (node) => interp.eval(node);
    ctx.variables.push();
    if (bindings.kind === "block" && bindings.type === "Array") {
        const items = bindings.fields.get("items");
        if (Array.isArray(items)) {
            for (const item of items) {
                if (item.kind === "block" && item.type === "Array") {
                    const bindingItems = item.fields.get("items");
                    if (Array.isArray(bindingItems) && bindingItems.length >= 2) {
                        let varName;
                        const varNode = bindingItems[0];
                        if (varNode.kind === "variable")
                            varName = varNode.name;
                        else if (varNode.kind === "literal" && varNode.type === "symbol")
                            varName = "$" + varNode.value;
                        else
                            throw new Error(`Invalid binding variable: expected symbol or variable`);
                        ctx.variables.set(varName, ev(bindingItems[1]));
                    }
                }
            }
        }
    }
    let result = null;
    try {
        for (let bodyIdx = 1; bodyIdx < args.length; bodyIdx++) {
            result = ev(args[bodyIdx]);
        }
    }
    finally {
        ctx.variables.pop();
    }
    return result;
}
// ── Helper: evalCond ──────────────────────────────────────────────
function evalCond(interp, args) {
    const ev = (node) => interp.eval(node);
    for (const arg of args) {
        let testNode = null;
        let bodyNodes = [];
        // [test result...] Array block 형식
        if (arg.kind === "block" && arg.type === "Array") {
            const items = arg.fields.get("items");
            if (Array.isArray(items) && items.length >= 2) {
                testNode = items[0];
                bodyNodes = items.slice(1);
            }
        }
        // ((test-expr) body...) → parser creates SExpr{op:"do", args:[test, body...]}
        else if (arg.kind === "sexpr" && arg.op === "do" && arg.args.length >= 2) {
            testNode = arg.args[0];
            bodyNodes = arg.args.slice(1);
        }
        // (test body) → SExpr where op is test symbol and args is rest
        // e.g. (true result) → SExpr{op:"true", args:[result]}
        else if (arg.kind === "sexpr" && arg.args.length >= 1) {
            const s = arg;
            testNode = { kind: "literal", type: "boolean", value: s.op === "true" ? true : s.op === "false" ? false : s.op === "else" ? true : undefined };
            if (testNode.value === undefined) {
                // op is a symbol test — reconstruct as variable lookup or literal
                testNode = { kind: "variable", name: s.op.startsWith("$") ? s.op : "$" + s.op };
            }
            bodyNodes = s.args;
        }
        if (testNode && bodyNodes.length >= 1) {
            const test = ev(testNode);
            if (test) {
                let result = null;
                for (const b of bodyNodes)
                    result = ev(b);
                return result;
            }
        }
    }
    return null;
}
//# sourceMappingURL=eval-special-forms.js.map