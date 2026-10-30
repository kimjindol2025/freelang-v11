/**
 * Phase 3-E: VM Eligible Checker & Function Registry
 * 주어진 AST 노드가 VM으로 처리 가능한지 판별하는 헬퍼 모듈
 *
 * VM이 처리 가능한 표현식:
 * - 산술: +, -, *, /, %, mod
 * - 비교: =, ==, !=, <, >, <=, >=
 * - 논리: and, or, not
 * - 제어: if, do
 * - 데이터: list, get, .
 * - 정의: define (제약 있음)
 * - 함수 호출: defn으로 정의된 VM 함수
 *
 * VM이 처리 불가능한 경우:
 * - 등록되지 않은 함수 호출
 * - 외부 변수 참조 (런타임 오류 → fallback)
 */

import { ASTNode, SExpr } from "./ast";

export const vmFunctionRegistry = new Map<string, any>();

export function registerVMFunction(name: string, vmFunc?: any): void {
  if (vmFunc) {
    vmFunctionRegistry.set(name, vmFunc);
  }
}

export function clearVMFunctions(): void {
  vmFunctionRegistry.clear();
}

const VM_SUPPORTED_OPS = new Set([
  // 산술
  "+", "-", "*", "/", "%", "mod",
  // 비교
  "=", "==", "!=", "<", ">", "<=", ">=",
  // 논리
  "and", "or", "not",
  // 제어
  "if", "do",
  // 데이터
  "list", "get", ".",
  // 정의
  "define",
]);

/**
 * AST 노드가 VM으로 처리 가능한지 재귀적으로 판별
 *
 * 규칙:
 * - literal, variable: true (단, variable은 런타임 오류 가능 → fallback)
 * - sexpr: op가 VM_SUPPORTED_OPS에 포함되고 모든 하위 노드가 eligible
 * - 기타 (block, keyword, pattern-match, try-block 등): false
 */
export function isVMEligible(node: ASTNode): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const kind = (node as any).kind;

  switch (kind) {
    case "literal":
      // 모든 리터럴은 VM eligible
      return true;

    case "variable":
      // 변수 참조도 eligible (런타임 오류 시 fallback)
      return true;

    case "sexpr": {
      const sexpr = node as SExpr;
      if (!sexpr || !sexpr.op) {
        return false;
      }

      // op가 지원되지 않으면 false
      if (!VM_SUPPORTED_OPS.has(sexpr.op)) {
        return false;
      }

      // 모든 하위 노드가 eligible이어야 함 (재귀 검사)
      if (!sexpr.args || !Array.isArray(sexpr.args)) {
        return false;
      }

      return sexpr.args.every((arg) => isVMEligible(arg));
    }

    case "keyword":
      // 키워드는 VM 불가 (값 그대로 반환이므로 VM 필요 없음)
      return false;

    case "block":
      // 배열/맵 리터럴은 VM에서 처리 가능하지만 지금은 복잡하므로 false
      return false;

    case "pattern-match":
    case "try-block":
    case "throw":
    default:
      // 기타 표현식은 VM 불가
      return false;
  }
}
