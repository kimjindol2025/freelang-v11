// FreeLang v9: Function Call Evaluation
// Phase 58: interpreter.ts에서 분리된 함수 호출 로직

import { TypeAnnotation } from "./ast";
import { FreeLangPromise } from "./async-runtime";
import { suggestSimilar } from "./error-formatter";
import { FunctionNotFoundError } from "./errors";

// Minimal Interpreter interface (순환 import 방지)
interface InterpreterLike {
  eval(node: any): any;
  currentLine: number;
  currentFilePath: string;
  callDepth: number;
  context: {
    functions: Map<string, any>;
    variables: {
      push(): void;
      pop(): void;
      set(name: string, value: any): void;
      get(name: string): any;
      has(name: string): boolean;
      saveStack(): any;
      restoreStack(snapshot: any): void;
      fromSnapshot(snapshot: any): void;
    };
    typeChecker?: any;
    runtimeTypeChecker?: any;
  };
}

const MAX_CALL_DEPTH = 500;

export function callUserFunction(interp: InterpreterLike, name: string, args: any[]): any {
  let baseName = name;
  let typeArgs: TypeAnnotation[] | null = null;

  const bracketMatch = name.match(/^([\w\-]+)\[([^\]]+)\]$/);
  if (bracketMatch) {
    baseName = bracketMatch[1];
    const typeArgStr = bracketMatch[2];
    typeArgs = typeArgStr.split(",").map((t) => ({
      kind: "type" as const,
      name: t.trim(),
    }));
  }

  const func = interp.context.functions.get(baseName);
  if (!func) {
    const candidates = [...interp.context.functions.keys()];
    const similar = suggestSimilar(baseName, candidates);
    const hint = similar
      ? `'${baseName}'를 찾을 수 없습니다. 혹시 '${similar}'를 말씀하신 건가요?`
      : `'${baseName}'를 찾을 수 없습니다. 함수가 정의되어 있는지 확인하세요.`;
    throw new FunctionNotFoundError(
      baseName,
      interp.currentFilePath,
      interp.currentLine > 0 ? interp.currentLine : undefined,
      undefined,
      hint
    );
  }

  let isGenericCall = false;
  if (func.generics && func.generics.length > 0) {
    if (!typeArgs) {
      throw new Error(`Generic function '${baseName}' requires type arguments, e.g., ${baseName}[int] or ${baseName}[int string]`);
    }
    if (interp.context.typeChecker) {
      const instantiation = interp.context.typeChecker.instantiateGenericFunction(baseName, typeArgs);
      if (!instantiation.valid) {
        throw new Error(`Cannot instantiate generic function '${baseName}': ${instantiation.message}`);
      }
    }
    isGenericCall = true;
  }

  if (!isGenericCall && interp.context.runtimeTypeChecker) {
    interp.context.runtimeTypeChecker.checkCall(baseName, args);
  }

  // Native JS function
  if (typeof func.body === "function") {
    return (func.body as Function)(...args);
  }

  if (func.params.length > args.length) {
    throw new Error(`Function '${baseName}' expects ${func.params.length} args, got ${args.length}`);
  }

  if (interp.callDepth >= MAX_CALL_DEPTH) {
    throw new Error(`FreeLang line ${interp.currentLine}: Maximum call depth exceeded (${MAX_CALL_DEPTH}) — possible infinite recursion in '${baseName}'`);
  }

  // Phase 54: For namespaced functions (list:mean), temporarily expose same-prefix functions
  const prefixMatch = baseName.match(/^([^:]+):/);
  const tempAliases: string[] = [];
  if (prefixMatch) {
    const prefix = prefixMatch[1] + ":";
    for (const [fname, fval] of interp.context.functions) {
      if (fname.startsWith(prefix)) {
        const unqualified = fname.slice(prefix.length);
        if (!interp.context.functions.has(unqualified)) {
          interp.context.functions.set(unqualified, fval);
          tempAliases.push(unqualified);
        }
      }
    }
  }

  // 클로저: capturedEnv가 있으면 해당 환경에서 실행
  if (func.capturedEnv) {
    const savedStack = interp.context.variables.saveStack();
    interp.callDepth++;
    try {
      interp.context.variables.fromSnapshot(func.capturedEnv);
      for (let i = 0; i < func.params.length; i++) {
        interp.context.variables.set(func.params[i], args[i]);
      }
      return interp.eval(func.body);
    } finally {
      interp.callDepth--;
      interp.context.variables.restoreStack(savedStack);
      for (const alias of tempAliases) interp.context.functions.delete(alias);
    }
  }

  // 일반 함수: 새 렉시컬 스코프
  interp.context.variables.push();
  interp.callDepth++;
  try {
    for (let i = 0; i < func.params.length; i++) {
      interp.context.variables.set(func.params[i], args[i]);
    }
    return interp.eval(func.body);
  } finally {
    interp.callDepth--;
    interp.context.variables.pop();
    for (const alias of tempAliases) interp.context.functions.delete(alias);
  }
}

export function callFunctionValue(interp: InterpreterLike, fn: any, args: any[]): any {
  if (fn.kind !== "function-value") {
    throw new Error(`Expected function-value, got ${fn.kind}`);
  }
  if (interp.callDepth >= MAX_CALL_DEPTH) {
    throw new Error(`FreeLang line ${interp.currentLine}: Maximum call depth exceeded (${MAX_CALL_DEPTH}) — possible infinite recursion`);
  }
  const savedStack = interp.context.variables.saveStack();
  interp.callDepth++;
  try {
    interp.context.variables.fromSnapshot(fn.capturedEnv);
    for (let i = 0; i < fn.params.length; i++) {
      interp.context.variables.set(fn.params[i], args[i]);
    }
    return interp.eval(fn.body);
  } finally {
    interp.callDepth--;
    interp.context.variables.restoreStack(savedStack);
  }
}

export function callAsyncFunctionValue(interp: InterpreterLike, fn: any, args: any[]): FreeLangPromise {
  if (fn.kind !== "async-function-value") {
    throw new Error(`Expected async-function-value, got ${fn.kind}`);
  }
  return new FreeLangPromise((resolve, reject) => {
    const savedStack = interp.context.variables.saveStack();
    try {
      interp.context.variables.fromSnapshot(fn.capturedEnv);
      for (let i = 0; i < fn.params.length; i++) {
        interp.context.variables.set(fn.params[i], args[i]);
      }
      const result = interp.eval(fn.body);
      if (result instanceof FreeLangPromise) {
        result.then((value) => resolve(value)).catch((error) => reject(error));
      } else {
        resolve(result);
      }
    } catch (error) {
      reject(error as Error);
    } finally {
      interp.context.variables.restoreStack(savedStack);
    }
  });
}

export function callFunction(interp: InterpreterLike, fn: any, args: any[]): any {
  if (fn.kind === "builtin-function") {
    return fn.fn(args.map((arg: any) => interp.eval(arg)));
  } else if (fn.kind === "function-value") {
    return callFunctionValue(interp, fn, args);
  } else if (fn.kind === "async-function-value") {
    return callAsyncFunctionValue(interp, fn, args);
  } else if (typeof fn === "function") {
    return fn(...args);
  } else if (fn.params && fn.body) {
    return callUserFunction(interp, fn.name || "anonymous", args);
  } else {
    throw new Error(`Cannot call ${typeof fn}`);
  }
}
