// FreeLang v9: Function Call Evaluation
// Phase 58: interpreter.ts에서 분리된 함수 호출 로직
// Phase 61: TCO (Tail Call Optimization) 추가
// Phase 3-E: VM 함수 호출 경로 추가

import { TypeAnnotation } from "./ast";
import { FreeLangPromise } from "./async-runtime";
import { suggestSimilar, KNOWN_ALIASES } from "./error-formatter";
import { FunctionNotFoundError } from "./errors";
import { isTailCall } from "./tco";
import { globalProfiler } from "./profiler";
import { vmFunctionRegistry } from "./vm-eligible"; // Phase 3-E
import { VM } from "./vm"; // Phase 3-E

const _callVM = new VM(); // Phase 3-E

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
      mutate(name: string, value: any): boolean;
      snapshot(): Map<string, any>;
      saveStack(): any;
      restoreStack(snapshot: any): void;
      fromSnapshot(snapshot: any): void;
    };
    typeChecker?: any;
    runtimeTypeChecker?: any;
  };
}

/**
 * 클로저 실행 후 변경된 변수를 외부 스코프로 역전파.
 * set! 로 변경된 캡처 변수가 외부(savedStack)에도 반영되도록 함.
 * capturedEnv도 갱신하여 동일 클로저의 다음 호출에서도 최신 값 사용.
 */
function propagateMutations(
  interp: InterpreterLike,
  capturedEnv: Map<string, any>,
  paramSet: Set<string>,
  savedStack: Map<string, any>[]
): void {
  const finalState = interp.context.variables.snapshot();
  for (const [key, newVal] of finalState) {
    if (paramSet.has(key)) continue; // 파라미터는 역전파 안 함
    if (!capturedEnv.has(key)) continue; // 캡처된 변수만
    const oldVal = capturedEnv.get(key);
    if (newVal === oldVal) continue; // 변경 없으면 스킵
    // capturedEnv 갱신 (동일 클로저 다음 호출용)
    capturedEnv.set(key, newVal);
    // savedStack(외부 스코프) 갱신
    for (let i = savedStack.length - 1; i >= 0; i--) {
      if (savedStack[i].has(key)) {
        savedStack[i].set(key, newVal);
        break;
      }
    }
  }
}

const MAX_CALL_DEPTH = 5000; // Phase 61: 상향 (trampoline이 처리하므로 안전망 역할)

export function callUserFunction(interp: InterpreterLike, name: string, args: any[]): any {
  // TCO 모드 활성화 시 trampoline으로 라우팅
  if (interp.tcoMode) {
    return callUserFunctionTCO(interp, name, args);
  }

  // Phase 3-E: VM 함수 호출
  if (process.env.FL_VM === "1" && vmFunctionRegistry.has(name)) {
    try {
      const vmFunc = vmFunctionRegistry.get(name)!;
      const initialVars = new Map<string, any>();

      // closure가 있으면 사용, 없으면 현재 변수 스냅샷
      if (vmFunc._closure && Array.isArray(vmFunc._closure) && vmFunc._closure.length > 0) {
        for (const [k, v] of vmFunc._closure) {
          initialVars.set(k, v);
        }
      } else {
        const snapshot = interp.context.variables.snapshot();
        for (const [k, v] of snapshot) {
          initialVars.set(k, v);
        }
      }

      // 모든 VM 함수를 변수로 포함 (재귀 호출 지원)
      for (const [vmName, vmFuncObj] of vmFunctionRegistry) {
        initialVars.set("$" + vmName, vmFuncObj);
        initialVars.set(vmName, vmFuncObj); // op 위치에서 직접 참조
      }

      // 파라미터 바인딩: fnValue.params는 $ 없는 형태 (fn의 params 정규화 참고)
      for (let i = 0; i < vmFunc._params.length; i++) {
        initialVars.set(vmFunc._params[i], args[i] ?? null);
      }

      return _callVM.run(vmFunc._chunk, initialVars);
    } catch {
      // fallback to interpreter path
    }
  }

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

  let func = interp.context.functions.get(baseName);
  // AI-First #3: snake_case ↔ kebab-case 양방향 조회
  if (!func) {
    const alt = baseName.includes('_') ? baseName.replace(/_/g, '-') : baseName.replace(/-/g, '_');
    if (alt !== baseName) func = interp.context.functions.get(alt);
  }
  // P0-2 (2026-04-25): Variable lookup으로 fallback — let-binding된 함수 호출 지원
  // 예: (let [[f (fn [x] (* x 2))]] (f 5)) → 10
  // (defn apply-pred [pred x] (pred x))도 같은 경로
  if (!func) {
    const v = interp.context.variables.get(baseName) ?? interp.context.variables.get("$" + baseName);
    if (v && (v.kind === "function-value" || v.kind === "async-function-value" || typeof v === "function" || (v.params && v.body))) {
      // function-value면 callFunctionValue 사용
      if (v.kind === "function-value") return callFunctionValue(interp, v, args);
      if (v.kind === "async-function-value") return callAsyncFunctionValue(interp, v, args);
      if (typeof v === "function") return v(...args);
      // user function 형태
      func = v;
    }
  }
  if (!func) {
    const candidates = [...interp.context.functions.keys()];
    // AI-First #4: 알려진 aliases 먼저 체크 (정확한 매핑)
    const alias = KNOWN_ALIASES[baseName] ?? KNOWN_ALIASES[baseName.replace(/-/g, '_')] ?? KNOWN_ALIASES[baseName.replace(/_/g, '-')];
    let hint: string;
    if (alias) {
      hint = `'${baseName}'는 없습니다. 대신 '${alias.correct}'를 사용하세요.\n  사용법: ${alias.usage}`;
    } else {
      const similar = suggestSimilar(baseName, candidates);
      hint = similar
        ? `'${baseName}'를 찾을 수 없습니다. 혹시 '${similar}'를 말씀하신 건가요?`
        : `'${baseName}'를 찾을 수 없습니다. 함수가 정의되어 있는지 확인하세요.`;
    }
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
    // Phase E: callStack 마지막 10개 dump
    const _stack: Array<{fn:string;line:number}> = (interp as any).callStack ?? [];
    const tail = _stack.slice(-10).map((s, i) => `  #${_stack.length - 10 + i}: ${s.fn} (line ${s.line})`).join("\n");
    throw new Error(
      `[E_STACK_OVERFLOW] line ${interp.currentLine}: Maximum call depth exceeded (${MAX_CALL_DEPTH}) — possible infinite recursion in '${baseName}'\n` +
      (tail ? `최근 호출 체인:\n${tail}` : "")
    );
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

  // Phase 82: Profiler 연동 (enabled=false 시 no-op)
  const exitProfiler = globalProfiler.enter(baseName);

  // Phase E + 자잘 #3 (2026-04-25): 호출 체인 추적 + 변수 값/타입 dump
  const _callStack: Array<{ fn: string; line: number; args?: any[] }> = (interp as any).callStack ?? [];
  const _argsBrief = args.slice(0, 5).map(a =>
    a === null ? "nil"
    : Array.isArray(a) ? `[${a.length}]`
    : typeof a === "object" ? "{obj}"
    : typeof a === "function" ? "<fn>"
    : typeof a === "string" ? (a.length > 20 ? `"${a.slice(0, 17)}..."` : `"${a}"`)
    : String(a)
  );
  const _stackEntry = { fn: baseName, line: interp.currentLine, args: _argsBrief };
  if (process.env.FL_TRACE === "1") {
    console.error(`[trace] ${"  ".repeat(Math.min(interp.callDepth, 20))}→ ${baseName}(${_argsBrief.join(", ")}) (line ${interp.currentLine})`);
  }

  // 클로저: capturedEnv가 있으면 해당 환경에서 실행
  if (func.capturedEnv) {
    const savedStack = interp.context.variables.saveStack();
    const paramSet = new Set<string>(func.params);
    interp.callDepth++;
    _callStack.push(_stackEntry);
    if (_callStack.length > 100) _callStack.shift(); // CALL_STACK_LIMIT
    let result: any;
    try {
      interp.context.variables.fromSnapshot(func.capturedEnv);
      for (let i = 0; i < func.params.length; i++) {
        interp.context.variables.set(func.params[i], args[i]);
      }
      result = interp.eval(func.body);
      propagateMutations(interp, func.capturedEnv, paramSet, savedStack);
    } finally {
      interp.callDepth--;
      _callStack.pop();
      interp.context.variables.restoreStack(savedStack);
      for (const alias of tempAliases) interp.context.functions.delete(alias);
      exitProfiler();
    }
    return result;
  }

  // 일반 함수: 새 렉시컬 스코프
  interp.context.variables.push();
  interp.callDepth++;
  _callStack.push(_stackEntry);
  if (_callStack.length > 100) _callStack.shift();
  try {
    for (let i = 0; i < func.params.length; i++) {
      interp.context.variables.set(func.params[i], args[i]);
    }
    return interp.eval(func.body);
  } finally {
    interp.callDepth--;
    _callStack.pop();
    interp.context.variables.pop();
    for (const alias of tempAliases) interp.context.functions.delete(alias);
    exitProfiler();
  }
}

export function callFunctionValue(interp: InterpreterLike, fn: any, args: any[]): any {
  // TCO 모드 활성화 시 trampoline으로 라우팅
  if (interp.tcoMode) {
    return callFunctionValueTCO(interp, fn, args);
  }

  if (fn.kind !== "function-value") {
    throw new Error(`Expected function-value, got ${fn.kind}`);
  }
  if (interp.callDepth >= MAX_CALL_DEPTH) {
    throw new Error(`FreeLang line ${interp.currentLine}: Maximum call depth exceeded (${MAX_CALL_DEPTH}) — possible infinite recursion`);
  }
  const savedStack = interp.context.variables.saveStack();
  const paramSet = new Set<string>(fn.params);
  interp.callDepth++;
  let result: any;
  try {
    interp.context.variables.fromSnapshot(fn.capturedEnv);
    for (let i = 0; i < fn.params.length; i++) {
      interp.context.variables.set(fn.params[i], args[i]);
    }
    result = interp.eval(fn.body);
    propagateMutations(interp, fn.capturedEnv, paramSet, savedStack);
  } finally {
    interp.callDepth--;
    interp.context.variables.restoreStack(savedStack);
  }
  return result;
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
  } else if (typeof fn === "string") {
    // Phase 후속 (Claude 평가에서 발견): (reduce + 0 list) 같은 패턴 지원
    // operator 또는 함수명을 sexpr로 변환 후 eval (args는 이미 평가된 값)
    const wrappedArgs = args.map((v: any) => ({
      kind: "literal",
      value: v,
      type: v === null ? "any" : (Array.isArray(v) ? "list" : typeof v),
    }));
    return interp.eval({ kind: "sexpr", op: fn, args: wrappedArgs } as any);
  } else if (fn && fn.params && fn.body) {
    return callUserFunction(interp, fn.name || "anonymous", args);
  } else {
    throw new Error(`Cannot call ${typeof fn}: ${JSON.stringify(fn).slice(0, 100)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Phase 61: TCO (Trampoline 기반) — 스택 없이 100만 재귀 지원
// ─────────────────────────────────────────────────────────────────────

/**
 * callUserFunctionTCO: 꼬리 재귀를 반복문으로 변환
 * - tcoMode=true로 eval 실행 → if 꼬리 위치 함수 호출이 TailCall 토큰 반환
 * - TailCall 토큰이 반환되면 인자만 교체하고 다시 실행
 * - 1,000,000번 반복 가능 (스택 없음)
 */
export function callUserFunctionTCO(interp: InterpreterLike, name: string, args: any[]): any {
  let currentName = name;
  let currentArgs = args;
  // TCO 모드 활성화 (if 꼬리 위치 → TailCall 토큰)
  const prevTcoMode = (interp as any).tcoMode;
  (interp as any).tcoMode = true;

  try {
    for (let i = 0; i < 2_000_000; i++) {
      let baseName = currentName;
      const bracketMatch = currentName.match(/^([\w\-]+)\[([^\]]+)\]$/);
      if (bracketMatch) baseName = bracketMatch[1];

      const func = interp.context.functions.get(baseName);
      if (!func) {
        const candidates = [...interp.context.functions.keys()];
        const similar = suggestSimilar(baseName, candidates);
        const hint = similar
          ? `'${baseName}'를 찾을 수 없습니다. 혹시 '${similar}'를 말씀하신 건가요?`
          : `'${baseName}'를 찾을 수 없습니다. 함수가 정의되어 있는지 확인하세요.`;
        throw new FunctionNotFoundError(baseName, interp.currentFilePath, interp.currentLine > 0 ? interp.currentLine : undefined, undefined, hint);
      }

      // Native JS 함수는 바로 실행
      if (typeof func.body === "function") {
        return (func.body as Function)(...currentArgs);
      }

      // 네임스페이스 함수 임시 alias
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

      let result: any;
      try {
        if (func.capturedEnv) {
          // 클로저
          const savedStack = interp.context.variables.saveStack();
          try {
            interp.context.variables.fromSnapshot(func.capturedEnv);
            for (let j = 0; j < func.params.length; j++) {
              interp.context.variables.set(func.params[j], currentArgs[j]);
            }
            result = interp.eval(func.body);
          } finally {
            interp.context.variables.restoreStack(savedStack);
          }
        } else {
          // 일반 함수
          interp.context.variables.push();
          try {
            for (let j = 0; j < func.params.length; j++) {
              interp.context.variables.set(func.params[j], currentArgs[j]);
            }
            result = interp.eval(func.body);
          } finally {
            interp.context.variables.pop();
          }
        }
      } finally {
        for (const alias of tempAliases) interp.context.functions.delete(alias);
      }

      // TailCall 토큰이면 계속 반복
      if (isTailCall(result)) {
        if (typeof result.fn === "string") {
          currentName = result.fn;
          currentArgs = result.args;
          continue;
        } else {
          // function-value TailCall → callFunctionValueTCO로 위임
          return callFunctionValueTCO(interp, result.fn, result.args);
        }
      }
      return result;
    }
    throw new Error(`TCO: 최대 반복(2,000,000) 초과 — '${currentName}'에서 무한 재귀 가능성`);
  } finally {
    (interp as any).tcoMode = prevTcoMode;
  }
}

/**
 * callFunctionValueTCO: function-value (람다/클로저) 꼬리 재귀를 반복문으로
 */
export function callFunctionValueTCO(interp: InterpreterLike, fn: any, args: any[]): any {
  const prevTcoMode = (interp as any).tcoMode;
  (interp as any).tcoMode = true;  // ← eval 중에 TailCall 토큰 생성 가능

  try {
    let currentFn = fn;
    let currentArgs = args;

    for (let i = 0; i < 1_000_000; i++) {
      if (currentFn.kind !== "function-value") {
        throw new Error(`Expected function-value, got ${currentFn.kind}`);
      }
      const savedStack = interp.context.variables.saveStack();
      let result: any;
      try {
        interp.context.variables.fromSnapshot(currentFn.capturedEnv);
        for (let j = 0; j < currentFn.params.length; j++) {
          interp.context.variables.set(currentFn.params[j], currentArgs[j]);
        }
        result = interp.eval(currentFn.body);
      } finally {
        interp.context.variables.restoreStack(savedStack);
      }

      if (isTailCall(result)) {
        if (typeof result.fn === "string") {
          return callUserFunctionTCO(interp, result.fn, result.args);
        } else {
          currentFn = result.fn;
          currentArgs = result.args;
          continue;
        }
      }
      return result;
    }
    throw new Error("TCO: 최대 반복(1,000,000) 초과 — function-value에서 무한 재귀 가능성");
  } finally {
    (interp as any).tcoMode = prevTcoMode;  // ← 복구
  }
}

/**
 * callUserFunctionRaw: trampoline용 — callDepth 체크 없이 단순 실행, TailCall 토큰 그대로 반환
 */
export function callUserFunctionRaw(interp: InterpreterLike, name: string, args: any[]): any {
  const func = interp.context.functions.get(name);
  if (!func) throw new FunctionNotFoundError(name, interp.currentFilePath, interp.currentLine > 0 ? interp.currentLine : undefined);
  if (typeof func.body === "function") return (func.body as Function)(...args);

  let result: any;
  if (func.capturedEnv) {
    const savedStack = interp.context.variables.saveStack();
    try {
      interp.context.variables.fromSnapshot(func.capturedEnv);
      for (let i = 0; i < func.params.length; i++) {
        interp.context.variables.set(func.params[i], args[i]);
      }
      result = interp.eval(func.body);
    } finally {
      interp.context.variables.restoreStack(savedStack);
    }
  } else {
    interp.context.variables.push();
    try {
      for (let i = 0; i < func.params.length; i++) {
        interp.context.variables.set(func.params[i], args[i]);
      }
      result = interp.eval(func.body);
    } finally {
      interp.context.variables.pop();
    }
  }
  return result;
}

/**
 * callFunctionValueRaw: trampoline용 — TailCall 토큰 그대로 반환
 */
export function callFunctionValueRaw(interp: InterpreterLike, fn: any, args: any[]): any {
  if (fn.kind !== "function-value") throw new Error(`Expected function-value, got ${fn.kind}`);
  const savedStack = interp.context.variables.saveStack();
  try {
    interp.context.variables.fromSnapshot(fn.capturedEnv);
    for (let i = 0; i < fn.params.length; i++) {
      interp.context.variables.set(fn.params[i], args[i]);
    }
    return interp.eval(fn.body);
  } finally {
    interp.context.variables.restoreStack(savedStack);
  }
}
