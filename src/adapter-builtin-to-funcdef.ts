// DU (Dispatch Unification) Phase 1: Adapter Layer
// builtin과 user function을 통일된 FunctionDefinition으로 변환
//
// 설계: docs/DU-STRATEGY.md
// 목표: "제거"가 아니라 "흡수" — 기존 builtin을 FunctionDefinition으로 통합

import type { InterpreterLike } from "./types";
import { lookupBuiltinEffects } from "./builtin-effects";

/**
 * 통일된 함수 정의 구조
 * builtin과 user function을 동일하게 취급하기 위한 인터페이스
 */
export interface FunctionDefinition {
  name: string;
  arity: number; // -1이면 가변 인자
  impl: (args: any[]) => any; // 실행 함수
  effects: string[]; // effect 태그 배열
  source: "builtin" | "user";
  meta?: {
    nativeBuiltin?: boolean;
    deprecation?: { message: string; since: string };
  };
}

/**
 * builtin 함수를 FunctionDefinition으로 변환하는 어댑터
 *
 * **핵심**: impl은 아직 evalBuiltin을 호출 (DU-2에서 분리)
 * 이 단계에서는 "구조만 통일"하고, "로직은 유지"
 */
export function builtinToFunctionDef(
  interp: InterpreterLike,
  name: string
): FunctionDefinition | null {
  // builtin effect 메타데이터 조회
  const effectEntry = lookupBuiltinEffects(name);
  if (effectEntry === undefined) {
    return null; // builtin이 아님
  }

  // effect 태그를 배열로 변환
  const effectTags: string[] = [];
  if (effectEntry && effectEntry instanceof Set) {
    effectTags.push(...Array.from(effectEntry));
  }

  // builtin 실행 함수: evalBuiltin 호출 (DU-2에서 분리 예정)
  const impl = (args: any[]) => {
    // DU-1: evalBuiltin은 아직 호출 (circular import 방지를 위해 dynamic require)
    // DU-2에서 builtin impl을 분리하면 직접 호출로 변경
    const evalBuiltinModule = require("./eval-builtins");
    const evalBuiltinFunc = evalBuiltinModule.evalBuiltin || evalBuiltinModule.default;
    return evalBuiltinFunc(interp, name, args, null);
  };

  return {
    name,
    arity: -1, // builtin은 arity 정보 부족 (DU-2에서 개선)
    impl,
    effects: effectTags,
    source: "builtin",
    meta: {
      nativeBuiltin: true,
    },
  };
}

/**
 * user 함수를 FunctionDefinition으로 변환하는 어댑터
 *
 * fnMetaRegistry의 함수 정의를 통일 구조로 감싼다.
 */
export function userFunctionToDef(
  name: string,
  funcObj: any
): FunctionDefinition | null {
  if (!funcObj) return null;

  // user 함수의 effect 메타데이터 추출
  const effectTags: string[] = [];
  if (funcObj.effects && funcObj.effects instanceof Set) {
    effectTags.push(...Array.from(funcObj.effects));
  } else if (funcObj.effects && Array.isArray(funcObj.effects)) {
    effectTags.push(...funcObj.effects);
  }

  // user 함수 실행
  const impl = (args: any[]) => {
    // 실제 호출은 callUserFunction이 담당
    // 이곳에서는 함수 객체 정보만 사용
    return null; // placeholder
  };

  return {
    name,
    arity: funcObj.params ? funcObj.params.length : -1,
    impl,
    effects: effectTags,
    source: "user",
    meta: {
      nativeBuiltin: false,
    },
  };
}

/**
 * 통일된 함수 해석 (resolution) — 단일 dispatch 포인트
 *
 * 우선순위:
 * 1. User 함수 (fnMetaRegistry)
 * 2. Builtin 함수 (builtinRegistry)
 */
export function resolveFunction(
  interp: InterpreterLike,
  name: string
): FunctionDefinition | null {
  // DU-1 디버깅: 모든 호출 로그
  if (process.env.DU_DEBUG) {
    console.log(`[DU] resolveFunction("${name}")`);
  }

  // 1. User 함수 우선 (fnMetaRegistry)
  let baseName = name;
  let typeArgs = null;

  // 타입 인자 파싱 (name[T1,T2] 형태)
  const bracketMatch = name.match(/^([\w\-]+)\[([^\]]+)\]$/);
  if (bracketMatch) {
    baseName = bracketMatch[1];
    typeArgs = bracketMatch[2];
  }

  const userFunc = interp.context.functions?.get(baseName);
  if (userFunc) {
    if (process.env.DU_DEBUG) console.log(`[DU] Found user function: ${baseName}`);
    return userFunctionToDef(baseName, userFunc);
  }
  if (process.env.DU_DEBUG) console.log(`[DU] No user function for: ${baseName}`);

  // AI-First #3: snake_case → kebab-case 자동 변환
  const normalizedName = baseName.replace(/_/g, "-");
  if (normalizedName !== baseName) {
    const userFuncNorm = interp.context.functions?.get(normalizedName);
    if (userFuncNorm) {
      return userFunctionToDef(normalizedName, userFuncNorm);
    }
  }

  // 2. Builtin 함수 (builtinRegistry)
  const builtinDef = builtinToFunctionDef(interp, normalizedName);
  if (builtinDef) {
    return builtinDef;
  }

  return null;
}

/**
 * 통일된 함수 호출 (callFunction)
 *
 * 모든 함수 호출을 이 포인트로 통합
 * effect 검증은 fn.effects 기준만 사용
 *
 * DU-1 특징:
 * - user function은 기존 callUserFunction으로 호출 (frame 관리 위해)
 * - builtin은 evalBuiltin 호출 (DU-2에서 분리)
 * - 단일 resolve 포인트: resolveFunction
 */
export function callFunction(
  interp: InterpreterLike,
  name: string,
  args: any[],
  span?: any
): any {
  const fn = resolveFunction(interp, name);
  if (!fn) {
    // resolveFunction이 못 찾으면, 상위 호출자(interpreter)가 처리하도록 null 반환
    return null;
  }

  // Effect 검증 (fn.effects 기준만)
  if (fn.effects && fn.effects.length > 0) {
    const { _enforceEffect } = require("./effect-enforcer");
    const spanInfo = span
      ? { file: span.file ?? "", line: span.line ?? 0, col: span.col ?? 0 }
      : { file: "", line: 0, col: 0 };
    _enforceEffect(fn.effects, spanInfo);
  }

  // 함수 실행
  if (fn.source === "builtin") {
    // builtin: impl이 evalBuiltin 호출
    return fn.impl(args);
  } else if (fn.source === "user") {
    // user: callUserFunction 호출 (기존 frame 관리 유지)
    const { callUserFunction } = require("./eval-call-function");
    return callUserFunction(interp, fn.name, args);
  }

  return null;
}
