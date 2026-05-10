// FreeLang v9: Pattern Matching
// Phase 58: interpreter.ts에서 분리된 패턴 매칭 로직

import { PatternMatch, TryBlock, ThrowExpression, Pattern, LiteralPattern, VariablePattern, WildcardPattern, ListPattern, StructPattern, OrPattern, RangePattern } from "./ast";
import { isReturnSignal } from "./return-signal";

// Minimal Interpreter interface (순환 import 방지)
interface InterpreterLike {
  eval(node: any): any;
  callFunction(fn: any, args: any[]): any;
  context: {
    variables: {
      push(): void;
      pop(): void;
      set(name: string, value: any): void;
      get(name: string): any;
    };
  };
}

export function evalPatternMatch(interp: InterpreterLike, match: PatternMatch): any {
  const value = interp.eval(match.value);

  for (const caseItem of match.cases) {
    const matchResult = matchPattern(interp, caseItem.pattern, value);

    if (matchResult.matched) {
      interp.context.variables.push();
      for (const [varName] of matchResult.bindings) {
        interp.context.variables.set("$" + varName, matchResult.bindings.get(varName));
      }
      // Phase 65: as binding — bind entire matched value
      if (matchResult.asBinding) {
        interp.context.variables.set("$" + matchResult.asBinding, value);
      }

      if (caseItem.guard) {
        const guardResult = interp.eval(caseItem.guard);
        if (!guardResult) {
          interp.context.variables.pop();
          continue;
        }
      }

      try {
        return interp.eval(caseItem.body);
      } finally {
        interp.context.variables.pop();
      }
    }
  }

  if (match.defaultCase) {
    return interp.eval(match.defaultCase);
  }

  throw new Error("Pattern match exhausted without matching case");
}

export function evalTryBlock(interp: InterpreterLike, tryBlock: TryBlock): any {
  let result: any;

  try {
    result = interp.eval(tryBlock.body);
  } catch (error: any) {
    // ReturnSignal은 try/catch가 가로채지 않음 — 함수 경계까지 전파
    if (isReturnSignal(error)) throw error;
    let handled = false;

    if (tryBlock.catchClauses && tryBlock.catchClauses.length > 0) {
      for (const catchClause of tryBlock.catchClauses) {
        interp.context.variables.push();
        if (catchClause.variable) {
          // FreeLang error object: 일반 JS 객체로 wrapping (get/assoc 등이 바로 접근 가능)
          const errObj: Record<string, any> = {};
          if (typeof error === "string") {
            errObj["message"] = error;
            errObj["type"] = "RuntimeError";
          } else if (error instanceof Error) {
            // FreeLang이 에러 메시지를 형식화한 경우 원본 메시지 추출
            // 형식 1: "[op] original (at line N, col M)"
            // 형식 2: "FreeLang line N: original"
            let rawMessage = error.message;
            const flLineMatch = rawMessage.match(/^FreeLang line \d+:\s*/);
            if (flLineMatch) rawMessage = rawMessage.slice(flLineMatch[0].length);
            const flOpAtMatch = rawMessage.match(/^\[[^\]]+\]\s*(.*?)(?:\s*\(at line \d+.*)?$/s);
            if (flOpAtMatch) rawMessage = flOpAtMatch[1].trim();
            else {
              const atLineMatch = rawMessage.match(/^(.*?)\s*\(at line \d+/s);
              if (atLineMatch) rawMessage = atLineMatch[1].trim();
            }
            errObj["message"] = rawMessage || error.message;
            // constructor 이름이 "Error"이면 "RuntimeError"로 정규화
            const ctorName = error.constructor?.name ?? "RuntimeError";
            errObj["type"] = ctorName === "Error" ? "RuntimeError" : ctorName;
            // Extract line number from FL error messages like "(at line N, col M)"
            const lineMatch = error.message.match(/\(at line (\d+)/);
            if (lineMatch) errObj["line"] = parseInt(lineMatch[1], 10);
            // Extract FLRuntimeError fields
            const flErr = error as any;
            if (flErr.file) errObj["file"] = flErr.file;
            const code = flErr.code ?? null;
            if (code) errObj["code"] = code;
            if (flErr.hint) errObj["hint"] = flErr.hint;
            // stack (optional)
            if (error.stack) errObj["stack"] = error.stack;
            // category: code -> category direct map (no message inference)
            const CODE_TO_CATEGORY: Record<string, string> = {
              "E_TYPE_NIL":          "TypeError",
              "E_TYPE_MISMATCH":     "TypeError",
              "E_ARG_COUNT":         "ArityError",
              "E_FN_NOT_FOUND":      "ReferenceError",
              "E_UNDEFINED_VAR":     "ReferenceError",
              "E_UNRESOLVED_SYMBOL": "ReferenceError",
              "E_DIV_BY_ZERO":       "RuntimeError",
              "E_INDEX_OOB":         "RuntimeError",
              "E_INVALID_FORM":      "RuntimeError",
              "E_PURE_VIOLATION":    "RuntimeError",
              "E_STACK_OVERFLOW":    "RuntimeError",
              "E_RUNTIME":           "RuntimeError",
            };
            if (flErr.category || code) {
              errObj["type"] = (code ? CODE_TO_CATEGORY[code] : null) ?? flErr.category ?? "RuntimeError";
            }
          } else if (error && typeof error === "object") {
            // Already a FreeLang error map — pass through
            errObj["message"] = error.message ?? String(error);
            errObj["type"] = error.type ?? "RuntimeError";
            if (error.stack) errObj["stack"] = error.stack;
          } else {
            errObj["message"] = String(error);
            errObj["type"] = "RuntimeError";
          }
          errObj["raw"] = error;
          interp.context.variables.set("$" + catchClause.variable, errObj);
        }

        try {
          result = interp.eval(catchClause.handler);
          handled = true;
          break;
        } catch (innerError: any) {
          throw innerError;
        } finally {
          interp.context.variables.pop();
        }
      }
    }

    if (!handled) {
      throw error;
    }
  } finally {
    if (tryBlock.finallyBlock) {
      interp.eval(tryBlock.finallyBlock);
    }
  }

  return result;
}

export function evalThrow(interp: InterpreterLike, throwExpr: ThrowExpression): any {
  const error = interp.eval(throwExpr.argument);

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

export function matchPattern(
  interp: InterpreterLike,
  pattern: Pattern,
  value: any
): { matched: boolean; bindings: Map<string, any>; asBinding?: string } {
  const bindings = new Map<string, any>();

  if ((pattern as any).kind === "literal-pattern") {
    const litPattern = pattern as LiteralPattern;
    return { matched: litPattern.value === value, bindings };
  }

  if ((pattern as any).kind === "variable-pattern") {
    const varPattern = pattern as VariablePattern;
    bindings.set(varPattern.name, value);
    return { matched: true, bindings };
  }

  if ((pattern as any).kind === "wildcard-pattern") {
    return { matched: true, bindings };
  }

  if ((pattern as any).kind === "list-pattern") {
    const listPattern = pattern as ListPattern;

    if (!Array.isArray(value)) {
      return { matched: false, bindings };
    }

    const elements = listPattern.elements;
    let matchedCount = 0;

    for (let i = 0; i < elements.length; i++) {
      if (i >= value.length) {
        return { matched: false, bindings };
      }

      const elemResult = matchPattern(interp, elements[i], value[i]);
      if (!elemResult.matched) {
        return { matched: false, bindings };
      }

      for (const [name, val] of elemResult.bindings) {
        bindings.set(name, val);
      }

      matchedCount++;
    }

    if (listPattern.restElement) {
      const restValues = value.slice(matchedCount);
      bindings.set(listPattern.restElement, restValues);
    } else if (matchedCount < value.length) {
      return { matched: false, bindings };
    }

    return { matched: true, bindings };
  }

  if ((pattern as any).kind === "struct-pattern") {
    const structPattern = pattern as StructPattern;

    if (typeof value !== "object" || value === null) {
      return { matched: false, bindings };
    }

    for (const [fieldName, fieldPattern] of structPattern.fields) {
      // Support nested object patterns: strip leading colon from field key
      const key = fieldName.startsWith(":") ? fieldName.slice(1) : fieldName;
      const fieldValue = value[key] !== undefined ? value[key] : value[fieldName];
      const fieldResult = matchPattern(interp, fieldPattern, fieldValue);
      if (!fieldResult.matched) {
        return { matched: false, bindings };
      }

      for (const [name, val] of fieldResult.bindings) {
        bindings.set(name, val);
      }
    }

    // Phase 65: as binding
    return { matched: true, bindings, asBinding: structPattern.asBinding };
  }

  if ((pattern as any).kind === "or-pattern") {
    const orPattern = pattern as OrPattern;

    for (const alternative of orPattern.alternatives) {
      const altResult = matchPattern(interp, alternative, value);
      if (altResult.matched) {
        return altResult;
      }
    }

    return { matched: false, bindings };
  }

  // Phase 65: Range pattern — matches min <= val < max
  if ((pattern as any).kind === "range-pattern") {
    const rangePattern = pattern as RangePattern;
    const matched = typeof value === "number" && value >= rangePattern.min && value < rangePattern.max;
    return { matched, bindings };
  }

  return { matched: false, bindings };
}
