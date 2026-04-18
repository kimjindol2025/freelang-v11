// FreeLang v9: Pattern Matching
// Phase 58: interpreter.ts에서 분리된 패턴 매칭 로직

import { PatternMatch, TryBlock, ThrowExpression, Pattern, LiteralPattern, VariablePattern, WildcardPattern, ListPattern, StructPattern, OrPattern, RangePattern } from "./ast";

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
    let handled = false;

    if (tryBlock.catchClauses && tryBlock.catchClauses.length > 0) {
      for (const catchClause of tryBlock.catchClauses) {
        interp.context.variables.push();
        if (catchClause.variable) {
          interp.context.variables.set("$" + catchClause.variable, error);
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
