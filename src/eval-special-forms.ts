// eval-special-forms.ts — FreeLang v9 Special Form Evaluation
// Phase 57 리팩토링: interpreter.ts의 특수 폼을 분리
// fn, async, set!, define, func-ref, call, compose, pipe,
// let, set, if, cond, do/begin/progn, loop, recur, while, and, or, map

import { Interpreter } from "./interpreter";
import { SExpr, ASTNode, Variable, Literal } from "./ast";
import { isBlock, isControlBlock } from "./ast";

export function evalSpecialForm(interp: Interpreter, op: string, expr: SExpr): any {
  const ev = (node: any) => (interp as any).eval(node);
  const callUser = (name: string, a: any[]) => (interp as any).callUserFunction(name, a);
  const callFnVal = (fn: any, a: any[]) => (interp as any).callFunctionValue(fn, a);
  const callAsyncFnVal = (fn: any, a: any[]) => (interp as any).callAsyncFunctionValue(fn, a);
  const callFn = (fn: any, a: any[]) => (interp as any).callFunction(fn, a);
  const ctx = interp.context;

  // ── fn ───────────────────────────────────────────────────────────
  if (op === "fn") {
    if (expr.args.length < 2) throw new Error(`fn requires at least 2 arguments (params and body)`);
    const paramsNode = expr.args[0];
    const params: string[] = [];
    if ((paramsNode as any).kind === "block" && (paramsNode as any).type === "Array") {
      const items = (paramsNode as any).fields.get("items");
      if (Array.isArray(items)) {
        for (const item of items) {
          if ((item as any).kind === "variable") params.push((item as Variable).name);
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
    if (expr.args.length < 3) throw new Error(`async requires name, params, and body`);
    const nameNode = expr.args[0];
    const name = (nameNode as Variable).name || "async-fn";
    const paramsNode = expr.args[1];
    const params: string[] = [];
    if ((paramsNode as any).kind === "block" && (paramsNode as any).type === "Array") {
      const items = (paramsNode as any).fields.get("items");
      if (Array.isArray(items)) {
        for (const item of items) {
          if ((item as any).kind === "variable") params.push((item as Variable).name);
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
    if (expr.args.length < 2) throw new Error(`set! requires a name and a value`);
    const nameNode = expr.args[0];
    let name: string;
    if ((nameNode as any).kind === "variable") {
      name = "$" + (nameNode as any).name;
    } else if ((nameNode as any).kind === "literal") {
      name = "$" + (nameNode as any).value;
    } else {
      throw new Error(`set!: first argument must be a symbol`);
    }
    const value = ev(expr.args[1]);
    if (!ctx.variables.mutate(name, value)) ctx.variables.set(name, value);
    return value;
  }

  // ── define ────────────────────────────────────────────────────────
  if (op === "define") {
    if (expr.args.length < 2) throw new Error(`define requires a name and a value`);
    const nameNode = expr.args[0];
    let name: string;
    if ((nameNode as any).kind === "literal") {
      name = (nameNode as Literal).value as string;
    } else if ((nameNode as any).kind === "variable") {
      name = (nameNode as Variable).name;
    } else {
      throw new Error(`define: first argument must be a symbol or string`);
    }

    // 3-arg form: (define name [params] body) → define function
    if (expr.args.length >= 3) {
      const paramsNode = expr.args[1];
      const bodyNode = expr.args.length === 3
        ? expr.args[2]
        : { kind: "sexpr" as const, op: "do", args: expr.args.slice(2) };
      const items = (paramsNode as any).kind === "block" && (paramsNode as any).type === "Array"
        ? (paramsNode as any).fields.get("items") || []
        : (paramsNode as any).kind === "array"
          ? (paramsNode as any).items || []
          : [];
      const params = (items as any[]).map((item: any) => {
        if (item.kind === "variable") return item.name.startsWith("$") ? item.name : "$" + item.name;
        if (item.kind === "literal") return "$" + item.value;
        return "$" + (item.name || item.value || "?");
      });
      ctx.functions.set(name, { name, params, body: bodyNode });
      return null;
    }

    const value = ev(expr.args[1]);
    if ((value as any).kind === "function-value") {
      const funcDef = {
        name,
        params: (value as any).params,
        body: (value as any).body,
        capturedEnv: (value as any).capturedEnv,
      };
      ctx.functions.set(name, funcDef);
      if (ctx.typeChecker) {
        const paramTypes = (value as any).params.map(() => ({ kind: "type" as const, name: "any" }));
        ctx.typeChecker.registerFunction(name, paramTypes, { kind: "type" as const, name: "any" });
      }
      return value;
    } else {
      ctx.variables.set("$" + name, value);
      return value;
    }
  }

  // ── func-ref ──────────────────────────────────────────────────────
  if (op === "func-ref") {
    if (expr.args.length < 1) throw new Error(`func-ref requires function name`);
    const funcName = (expr.args[0] as any).name || String(expr.args[0]);
    const func = ctx.functions.get(funcName);
    if (!func) throw new Error(`Function not found: ${funcName}`);
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
    if (expr.args.length < 1) throw new Error(`call requires function as first argument`);
    const fn = ev(expr.args[0]);
    const evaluatedArgs = expr.args.slice(1).map((a) => ev(a));
    if ((fn as any).kind === "builtin-function") return (fn as any).fn(evaluatedArgs);
    if ((fn as any).kind === "function-value") return callFnVal(fn, evaluatedArgs);
    if ((fn as any).kind === "async-function-value") return callAsyncFnVal(fn, evaluatedArgs);
    if (typeof fn === "string") return callUser(fn, evaluatedArgs);
    throw new Error(`call expects function-value, got ${(fn as any).kind || typeof fn}`);
  }

  // ── compose ───────────────────────────────────────────────────────
  if (op === "compose") {
    if (expr.args.length < 2) throw new Error(`compose requires at least 2 functions`);
    const funcsToCompose = expr.args.map((arg) => {
      if ((arg as any).kind === "literal" && (arg as any).type === "symbol") {
        const fnName = (arg as Literal).value as string;
        if (ctx.functions.has(fnName)) return { _isFunctionName: true, name: fnName };
        throw new Error(`compose: '${fnName}' is not a function`);
      } else if ((arg as any).kind === "variable") {
        const fnName = (arg as Variable).name;
        if (ctx.functions.has(fnName)) return { _isFunctionName: true, name: fnName };
        const value = ctx.variables.get(fnName);
        if (value && ((value as any).kind === "function-value" || typeof value === "function")) return value;
        throw new Error(`compose: '${fnName}' is not a function`);
      } else {
        const fn = ev(arg);
        if (typeof fn !== "function" && (fn as any).kind !== "function-value") throw new Error(`compose: argument is not a function`);
        return fn;
      }
    });
    return (x: any) => {
      let result = x;
      for (let i = funcsToCompose.length - 1; i >= 0; i--) {
        const fn = funcsToCompose[i];
        if ((fn as any)._isFunctionName) result = callUser((fn as any).name, [result]);
        else result = callFn(fn, [result]);
      }
      return result;
    };
  }

  // ── pipe ──────────────────────────────────────────────────────────
  if (op === "pipe") {
    if (expr.args.length < 2) throw new Error(`pipe requires at least a value and one function`);
    let pipeValue = ev(expr.args[0]);
    for (let i = 1; i < expr.args.length; i++) {
      const fnArg = expr.args[i];
      let pipeResult: any;
      if ((fnArg as any).kind === "literal" && (fnArg as any).type === "symbol") {
        const fnName = (fnArg as Literal).value as string;
        if (ctx.functions.has(fnName)) pipeResult = callUser(fnName, [pipeValue]);
        else throw new Error(`Unknown function: ${fnName}`);
      } else if ((fnArg as any).kind === "variable") {
        const fnName = (fnArg as Variable).name;
        if (ctx.functions.has(fnName)) pipeResult = callUser(fnName, [pipeValue]);
        else if (ctx.variables.has(fnName)) pipeResult = callFn(ctx.variables.get(fnName), [pipeValue]);
        else throw new Error(`Unknown function or variable: ${fnName}`);
      } else {
        const fn = ev(fnArg);
        pipeResult = callFn(fn, [pipeValue]);
      }
      pipeValue = pipeResult;
    }
    return pipeValue;
  }

  // ── let ───────────────────────────────────────────────────────────
  if (op === "let") {
    return evalLet(interp, expr.args);
  }

  // ── set ───────────────────────────────────────────────────────────
  if (op === "set") {
    if (expr.args.length !== 2) throw new Error(`set requires exactly 2 arguments: (set $var new-value)`);
    const varNode = expr.args[0] as any;
    let varName: string;
    if (varNode.kind === "variable") varName = varNode.name;
    else if (varNode.kind === "literal" && varNode.type === "symbol") varName = "$" + varNode.value;
    else throw new Error(`set: first argument must be a variable`);
    const newValue = ev(expr.args[1]);
    if (!ctx.variables.mutate(varName, newValue)) throw new Error(`set: variable ${varName} not found in scope`);
    return newValue;
  }

  // ── if ────────────────────────────────────────────────────────────
  if (op === "if") {
    const condition = ev(expr.args[0]);
    return condition ? ev(expr.args[1]) : (expr.args[2] ? ev(expr.args[2]) : null);
  }

  // ── cond ──────────────────────────────────────────────────────────
  if (op === "cond") {
    return evalCond(interp, expr.args);
  }

  // ── do / begin / progn ───────────────────────────────────────────
  if (op === "do" || op === "begin" || op === "progn") {
    let result: any = null;
    for (const arg of expr.args) {
      if (isBlock(arg) && isControlBlock(arg as any)) {
        (interp as any).evalBlock(arg);
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
    const bindingItems: any[] =
      (bindingsNode as any).kind === "array"
        ? (bindingsNode as any).items || []
        : (bindingsNode as any).kind === "block" && (bindingsNode as any).type === "Array"
          ? (bindingsNode as any).fields?.get?.("items") || []
          : [];

    const loopVars: string[] = [];
    const loopInits: any[] = [];
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

    let result: any = null;
    const maxIter = 100000;
    let iter = 0;
    try {
      while (iter++ < maxIter) {
        let recurred = false;
        for (const bodyNode of bodyNodes) {
          result = ev(bodyNode);
          if (result && typeof result === "object" && result.__FL_RECUR__) {
            const newVals = result.__args as any[];
            for (let i = 0; i < loopVars.length && i < newVals.length; i++) {
              ctx.variables.set(loopVars[i], newVals[i]);
            }
            recurred = true;
            break;
          }
        }
        if (!recurred) break;
      }
    } finally {
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
    let result: any = null;
    while (ev(expr.args[0])) {
      for (let i = 1; i < expr.args.length; i++) result = ev(expr.args[i]);
    }
    return result;
  }

  // ── and (short-circuit) ───────────────────────────────────────────
  if (op === "and") {
    let result: any = true;
    for (const arg of expr.args) {
      result = ev(arg);
      if (!result) return result;
    }
    return result;
  }

  // ── or (short-circuit) ────────────────────────────────────────────
  if (op === "or") {
    for (const arg of expr.args) {
      const result = ev(arg);
      if (result) return result;
    }
    return false;
  }

  // ── map (inline comprehension, 3-arg form) ────────────────────────
  if (op === "map" && expr.args.length === 3) {
    const arr = ev(expr.args[0]);
    const paramNode = expr.args[1];
    const bodyNode = expr.args[2];
    const items: any[] =
      (paramNode as any).kind === "block" && (paramNode as any).type === "Array"
        ? (paramNode as any).fields.get?.("items") || []
        : (paramNode as any).kind === "array"
          ? (paramNode as any).items || []
          : [];
    const paramNames = items.map((item: any) => {
      if (item.kind === "variable") return item.name;
      if (item.kind === "literal") return "$" + item.value;
      return "$" + (item.name || item.value || "_");
    });
    if (Array.isArray(arr) && paramNames.length > 0) {
      return arr.map((elem: any) => {
        ctx.variables.push();
        ctx.variables.set(paramNames[0], elem);
        try {
          return ev(bodyNode);
        } finally {
          ctx.variables.pop();
        }
      });
    }
    // Fall through: return undefined (caller will evaluate args and try builtins)
    return undefined;
  }

  throw new Error(`evalSpecialForm: unknown op "${op}"`);
}

// ── Helper: evalLet ───────────────────────────────────────────────
function evalLet(interp: Interpreter, args: ASTNode[]): any {
  if (args.length < 2) throw new Error(`let requires at least 2 arguments`);
  const bindings = args[0];
  const ctx = interp.context;
  const ev = (node: any) => (interp as any).eval(node);

  ctx.variables.push();

  if ((bindings as any).kind === "block" && (bindings as any).type === "Array") {
    const items = (bindings as any).fields.get("items");
    if (Array.isArray(items)) {
      for (const item of items) {
        if ((item as any).kind === "block" && (item as any).type === "Array") {
          const bindingItems = (item as any).fields.get("items");
          if (Array.isArray(bindingItems) && bindingItems.length >= 2) {
            let varName: string;
            const varNode = bindingItems[0] as any;
            if (varNode.kind === "variable") varName = varNode.name;
            else if (varNode.kind === "literal" && varNode.type === "symbol") varName = "$" + (varNode.value as string);
            else throw new Error(`Invalid binding variable: expected symbol or variable`);
            ctx.variables.set(varName, ev(bindingItems[1]));
          }
        }
      }
    }
  }

  let result: any = null;
  try {
    for (let bodyIdx = 1; bodyIdx < args.length; bodyIdx++) {
      result = ev(args[bodyIdx]);
    }
  } finally {
    ctx.variables.pop();
  }
  return result;
}

// ── Helper: evalCond ──────────────────────────────────────────────
function evalCond(interp: Interpreter, args: ASTNode[]): any {
  const ev = (node: any) => (interp as any).eval(node);
  for (const arg of args) {
    if ((arg as any).kind === "block" && (arg as any).type === "Array") {
      const items = (arg as any).fields.get("items");
      if (Array.isArray(items) && items.length >= 2) {
        const test = ev(items[0]);
        if (test) {
          let result: any = null;
          for (let i = 1; i < items.length; i++) result = ev(items[i]);
          return result;
        }
      }
    }
  }
  return null;
}
