// FreeLang v9: Phase 74 — 7가지 Lint 규칙
// Rule 1: undefined-vars
// Rule 2: unused-bindings
// Rule 3: shadowed-vars
// Rule 4: arity-check
// Rule 5: empty-body
// Rule 6: unreachable-match
// Rule 7: dead-code

import { ASTNode, Block } from "./ast";
import { LintDiagnostic, LintRule, LintContext, walkAST } from "./linter";

// ──────────────────────────────────────────────
// 유틸: AST에서 Variable 노드를 모두 수집
// ──────────────────────────────────────────────

function collectVariables(nodes: ASTNode[]): Array<{ name: string; line?: number }> {
  const vars: Array<{ name: string; line?: number }> = [];
  walkAST(nodes, (node) => {
    if (node.kind === "variable") {
      vars.push({ name: node.name });
    }
  });
  return vars;
}

/**
 * FUNC 블록의 파라미터 이름 목록 추출
 */
function getFuncParams(block: Block): string[] {
  const paramsField = block.fields.get("params");
  if (!paramsField) return [];
  const params = Array.isArray(paramsField) ? paramsField : [paramsField];

  // Array 블록 형태: :params [[$x] [$y]]
  if (params.length === 1 && (params[0] as any).kind === "block" && (params[0] as any).type === "Array") {
    const items = (params[0] as any).fields?.get("items") as ASTNode[];
    if (!Array.isArray(items)) return [];
    const result: string[] = [];
    for (const item of items) {
      if (item.kind === "variable") result.push(item.name);
      // [[name type]] 형태
      else if ((item as any).kind === "block" && (item as any).type === "Array") {
        const inner = (item as any).fields?.get("items") as ASTNode[];
        if (inner && inner[0]?.kind === "variable") result.push(inner[0].name);
      }
    }
    return result;
  }

  // 직접 변수 배열 형태
  return params.filter((p: any) => p.kind === "variable").map((p: any) => p.name);
}

/**
 * FUNC 블록의 body AST 노드들 추출
 */
function getFuncBody(block: Block): ASTNode[] {
  const bodyField = block.fields.get("body");
  if (!bodyField) return [];
  return Array.isArray(bodyField) ? bodyField : [bodyField];
}

/**
 * let 바인딩에서 변수 이름 수집: (let [$x val] body)
 */
function collectLetBindings(nodes: ASTNode[]): Array<{ name: string; line?: number }> {
  const bindings: Array<{ name: string; line?: number }> = [];
  walkAST(nodes, (node) => {
    if (
      node.kind === "sexpr" &&
      (node.op === "let" || node.op === "let*" || node.op === "letrec") &&
      node.args.length >= 1
    ) {
      const bindingsNode = node.args[0];
      if (bindingsNode.kind === "block" && bindingsNode.type === "Array") {
        const items = bindingsNode.fields.get("items");
        if (Array.isArray(items)) {
          for (const item of items) {
            // 각 binding은 [$name value] 형태의 Array 블록
            if (item.kind === "block" && item.type === "Array") {
              const subItems = item.fields.get("items");
              if (Array.isArray(subItems) && subItems[0]?.kind === "variable") {
                bindings.push({ name: (subItems[0] as any).name });
              }
            } else if (item.kind === "variable") {
              bindings.push({ name: item.name });
            }
          }
        }
      }
    }
  });
  return bindings;
}

// ──────────────────────────────────────────────
// Rule 1: undefined-vars
// $x를 참조하는데 define/param에 없음
// ──────────────────────────────────────────────

export const undefinedVars: LintRule = {
  name: "undefined-vars",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    // 전역 스코프에서 알려진 이름들 수집
    const globalScope = new Set<string>(ctx.variables);

    // FUNC 이름들도 참조 가능한 변수로 포함
    for (const fn of ctx.functions) {
      globalScope.add("$" + fn);
      globalScope.add(fn);
    }

    for (const node of ast) {
      if (node.kind === "block" && node.type === "FUNC") {
        // FUNC 내부에서만 체크
        const localScope = new Set<string>(globalScope);

        // 파라미터 추가
        for (const p of getFuncParams(node)) {
          localScope.add(p);
        }

        // body 수집
        const body = getFuncBody(node);

        // let 바인딩도 로컬 스코프에 추가
        for (const b of collectLetBindings(body)) {
          localScope.add(b.name);
        }

        // define 바인딩도 추가
        walkAST(body, (n) => {
          if (n.kind === "sexpr" && n.op === "define" && n.args[0]?.kind === "variable") {
            localScope.add((n.args[0] as any).name);
          }
        });

        // Variable 노드 체크
        walkAST(body, (n) => {
          if (n.kind === "variable") {
            const name = n.name;
            // "$name" 또는 "name" 형태로 체크
            const stripped = name.startsWith("$") ? name.slice(1) : name;
            if (!localScope.has(name) && !localScope.has(stripped) &&
                !localScope.has("$" + stripped)) {
              diagnostics.push({
                rule: "undefined-vars",
                severity: "warn",
                message: `미정의 변수 참조: ${name} (FUNC ${node.name} 내)`,
                line: node.line,
              });
            }
          }
        });

      } else if (node.kind === "sexpr") {
        // 전역 스코프에서 변수 참조 체크
        walkAST([node], (n) => {
          if (n.kind === "variable") {
            const name = n.name;
            const stripped = name.startsWith("$") ? name.slice(1) : name;
            if (!globalScope.has(name) && !globalScope.has(stripped) &&
                !globalScope.has("$" + stripped) && !ctx.functions.has(stripped)) {
              diagnostics.push({
                rule: "undefined-vars",
                severity: "warn",
                message: `미정의 변수 참조: ${name}`,
              });
            }
          }
        });
      }
    }

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// Rule 2: unused-bindings
// let/define했는데 사용 안 함
// ──────────────────────────────────────────────

export const unusedBindings: LintRule = {
  name: "unused-bindings",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    for (const node of ast) {
      if (node.kind !== "block" || node.type !== "FUNC") continue;

      const body = getFuncBody(node);

      // let 바인딩 수집
      const letBindings: Array<{ name: string }> = [];

      walkAST(body, (n) => {
        if (
          n.kind === "sexpr" &&
          (n.op === "let" || n.op === "let*") &&
          n.args.length >= 1
        ) {
          const bindNode = n.args[0];
          if (bindNode.kind === "block" && bindNode.type === "Array") {
            const items = bindNode.fields.get("items");
            if (Array.isArray(items)) {
              for (const item of items) {
                if (item.kind === "block" && item.type === "Array") {
                  const subItems = item.fields.get("items");
                  if (Array.isArray(subItems) && subItems[0]?.kind === "variable") {
                    letBindings.push({ name: (subItems[0] as any).name });
                  }
                }
              }
            }
          }
        }
      });

      // define 바인딩 수집
      const defineBindings: Array<{ name: string }> = [];
      walkAST(body, (n) => {
        if (n.kind === "sexpr" && n.op === "define" && n.args[0]?.kind === "variable") {
          defineBindings.push({ name: (n.args[0] as any).name });
        }
      });

      // 사용된 변수 이름 수집
      const usedVars = new Set<string>();
      walkAST(body, (n) => {
        if (n.kind === "variable") {
          usedVars.add(n.name);
          // $name 형태로도 저장
          usedVars.add(n.name.replace(/^\$/, ""));
        }
      });

      // let 바인딩 중 사용 안 된 것
      for (const binding of letBindings) {
        const bare = binding.name.replace(/^\$/, "");
        // 정의 자체 제외하고 사용되는지 체크
        // 간단히: usedVars에서 bare 이름이 있는지 확인하되,
        // let 바인딩 자체는 define 위치이므로 1회 이상 사용 여부 체크
        let useCount = 0;
        walkAST(body, (n) => {
          if (n.kind === "variable") {
            const vbare = n.name.replace(/^\$/, "");
            if (vbare === bare) useCount++;
          }
        });
        // 바인딩 자신의 정의(LHS)가 1번이므로 2번 이상이어야 실제 사용
        if (useCount < 2) {
          diagnostics.push({
            rule: "unused-bindings",
            severity: "warn",
            message: `미사용 let 바인딩: ${binding.name} (FUNC ${node.name} 내)`,
          });
        }
      }

      // define 바인딩 중 사용 안 된 것
      for (const binding of defineBindings) {
        const bare = binding.name.replace(/^\$/, "");
        let useCount = 0;
        walkAST(body, (n) => {
          if (n.kind === "variable") {
            const vbare = n.name.replace(/^\$/, "");
            if (vbare === bare) useCount++;
          }
        });
        if (useCount < 2) {
          diagnostics.push({
            rule: "unused-bindings",
            severity: "warn",
            message: `미사용 define 바인딩: ${binding.name} (FUNC ${node.name} 내)`,
          });
        }
      }
    }

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// Rule 3: shadowed-vars
// 상위 스코프 변수를 let으로 덮어씀
// ──────────────────────────────────────────────

export const shadowedVars: LintRule = {
  name: "shadowed-vars",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    for (const node of ast) {
      if (node.kind !== "block" || node.type !== "FUNC") continue;

      const paramNames = new Set(getFuncParams(node).map(p => p.replace(/^\$/, "")));
      const body = getFuncBody(node);

      // let 바인딩에서 파라미터와 같은 이름 체크
      walkAST(body, (n) => {
        if (n.kind === "sexpr" && (n.op === "let" || n.op === "let*") && n.args.length >= 1) {
          const bindNode = n.args[0];
          if (bindNode.kind === "block" && bindNode.type === "Array") {
            const items = bindNode.fields.get("items");
            if (Array.isArray(items)) {
              for (const item of items) {
                if (item.kind === "block" && item.type === "Array") {
                  const subItems = item.fields.get("items");
                  if (Array.isArray(subItems) && subItems[0]?.kind === "variable") {
                    const vname = (subItems[0] as any).name.replace(/^\$/, "");
                    if (paramNames.has(vname)) {
                      diagnostics.push({
                        rule: "shadowed-vars",
                        severity: "warn",
                        message: `변수 섀도잉: $${vname}는 파라미터를 덮어씁니다 (FUNC ${node.name})`,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      });

      // 전역 변수와 파라미터 이름 충돌 체크
      for (const param of paramNames) {
        if (ctx.variables.has("$" + param) || ctx.variables.has(param)) {
          diagnostics.push({
            rule: "shadowed-vars",
            severity: "info",
            message: `파라미터 $${param}이 전역 변수를 섀도잉합니다 (FUNC ${node.name})`,
          });
        }
      }
    }

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// Rule 4: arity-check
// 알려진 함수에 잘못된 인자 수
// ──────────────────────────────────────────────

export const arityCheck: LintRule = {
  name: "arity-check",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    // 가변 인자를 허용하는 내장 함수 목록
    const variadic = new Set([
      "print", "println", "list", "array", "concat", "str", "+", "-", "*", "/",
      "and", "or", "do", "begin", "cond", "if", "let", "let*", "define",
      "match", "fn", "map", "filter", "each", "reduce", "range",
    ]);

    function checkCallArgs(sexpr: ASTNode): void {
      if (sexpr.kind !== "sexpr") return;

      const fnName = sexpr.op;
      if (variadic.has(fnName)) return;

      const expectedArity = ctx.funcArity.get(fnName);
      if (expectedArity === undefined) return; // 알 수 없는 함수는 스킵

      const actualArgs = sexpr.args.length;
      if (actualArgs !== expectedArity) {
        diagnostics.push({
          rule: "arity-check",
          severity: "warn",
          message: `함수 ${fnName}: ${expectedArity}개 인자 필요, ${actualArgs}개 전달됨`,
          line: (sexpr as any).line,
        });
      }

      // 재귀적으로 인자도 체크
      for (const arg of sexpr.args) {
        if (arg.kind === "sexpr") checkCallArgs(arg);
      }
    }

    walkAST(ast, (node) => {
      if (node.kind === "sexpr") {
        checkCallArgs(node);
      }
    });

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// Rule 5: empty-body
// (define f []) 또는 [FUNC f :params [] :body []] 빈 바디
// ──────────────────────────────────────────────

export const emptyBody: LintRule = {
  name: "empty-body",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    for (const node of ast) {
      if (node.kind !== "block" || node.type !== "FUNC") continue;

      const bodyField = node.fields.get("body");

      let isEmpty = false;
      if (!bodyField) {
        isEmpty = true;
      } else if (Array.isArray(bodyField) && bodyField.length === 0) {
        isEmpty = true;
      } else if (!Array.isArray(bodyField) && (bodyField as any).kind === "block" &&
                 (bodyField as any).type === "Array") {
        const items = (bodyField as any).fields?.get("items");
        if (!items || (Array.isArray(items) && items.length === 0)) {
          isEmpty = true;
        }
      }

      if (isEmpty) {
        diagnostics.push({
          rule: "empty-body",
          severity: "warn",
          message: `빈 함수 바디: FUNC ${node.name}`,
          line: node.line,
        });
      }
    }

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// Rule 6: unreachable-match
// cond/match에서 else/true 이후 케이스
// ──────────────────────────────────────────────

export const unreachableMatch: LintRule = {
  name: "unreachable-match",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    walkAST(ast, (node) => {
      // (cond [cond1 val1] [else val2] [more ...]) 패턴 체크
      if (node.kind === "sexpr" && node.op === "cond") {
        let elseFound = false;
        for (let i = 0; i < node.args.length; i++) {
          const clause = node.args[i];

          if (elseFound) {
            // else 이후에 케이스가 있으면 unreachable
            diagnostics.push({
              rule: "unreachable-match",
              severity: "warn",
              message: `도달 불가 cond 케이스: else 이후 케이스 발견 (인덱스 ${i})`,
              line: (node as any).line,
            });
            break;
          }

          // else 케이스 감지: (else val) 또는 (true val) 형태
          if (clause.kind === "block" && clause.type === "Array") {
            const items = clause.fields.get("items");
            if (Array.isArray(items) && items.length >= 1) {
              const condExpr = items[0];
              if (
                (condExpr.kind === "literal" && condExpr.value === true) ||
                (condExpr.kind === "literal" && condExpr.type === "symbol" && condExpr.value === "else") ||
                (condExpr.kind === "sexpr" && condExpr.op === "else")
              ) {
                elseFound = true;
              }
            }
          } else if (clause.kind === "sexpr" && clause.op === "else") {
            elseFound = true;
          }
        }
      }

      // (match val ...) 패턴의 defaultCase 이후 체크
      if (node.kind === "pattern-match") {
        // defaultCase가 있으면서 cases가 더 있는 경우
        // PatternMatch 구조에서는 defaultCase가 마지막이므로
        // cases 내에서 wildcard 패턴 이후에 케이스가 있는지 체크
        let wildcardFound = false;
        for (let i = 0; i < node.cases.length; i++) {
          const c = node.cases[i];
          if (wildcardFound) {
            diagnostics.push({
              rule: "unreachable-match",
              severity: "warn",
              message: `도달 불가 match 케이스: wildcard 이후 케이스 (인덱스 ${i})`,
            });
            break;
          }
          if (c.pattern.kind === "wildcard-pattern") {
            wildcardFound = true;
          }
        }
      }
    });

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// Rule 7: dead-code
// do 블록에서 마지막 표현식 제외 모든 순수값 (부작용 없음)
// ──────────────────────────────────────────────

export const deadCode: LintRule = {
  name: "dead-code",
  check(ast: ASTNode[], ctx: LintContext): LintDiagnostic[] {
    const diagnostics: LintDiagnostic[] = [];

    // 순수값(side-effect 없는) 표현식 판단
    function isPureValue(node: ASTNode): boolean {
      if (node.kind === "literal") return true;
      if (node.kind === "variable") return true;
      if (node.kind === "keyword") return true;
      // 순수 연산 (부작용 없는 수학/비교 연산)
      if (node.kind === "sexpr") {
        const pureFns = new Set(["+", "-", "*", "/", "%", "<", ">", "<=", ">=", "=", "!=",
                                  "and", "or", "not", "str", "num", "bool",
                                  "list", "array", "get", "length", "count",
                                  "first", "rest", "keys", "values",
                                  "concat", "append", "reverse"]);
        if (pureFns.has(node.op)) {
          return node.args.every(a => isPureValue(a));
        }
      }
      return false;
    }

    walkAST(ast, (node) => {
      if (node.kind === "sexpr" && node.op === "do") {
        // do 블록의 모든 표현식에서 마지막 제외하고 순수값이면 dead code
        const stmts = node.args;
        for (let i = 0; i < stmts.length - 1; i++) {
          if (isPureValue(stmts[i])) {
            diagnostics.push({
              rule: "dead-code",
              severity: "warn",
              message: `Dead code: do 블록에서 결과가 사용되지 않는 순수 표현식 (인덱스 ${i})`,
              line: (node as any).line,
            });
          }
        }
      }
    });

    return diagnostics;
  }
};

// ──────────────────────────────────────────────
// 모든 규칙 묶음
// ──────────────────────────────────────────────

export const ALL_RULES: LintRule[] = [
  undefinedVars,
  unusedBindings,
  shadowedVars,
  arityCheck,
  emptyBody,
  unreachableMatch,
  deadCode,
];

/**
 * 이름으로 규칙 찾기
 */
export function getRuleByName(name: string): LintRule | undefined {
  return ALL_RULES.find(r => r.name === name);
}
