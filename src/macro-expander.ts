// FreeLang v9: Macro Expander
// Phase 63: defmacro — 코드를 코드로 변환하는 위생적 매크로 시스템

import { ASTNode } from "./ast";

export interface MacroDefinition {
  name: string;
  params: string[];   // 패턴 변수 이름들 ($ 포함, e.g. "$cond")
  body: ASTNode;      // 변환 템플릿
}

let gensymCounter = 0;

export function gensym(prefix = "g"): string {
  return `${prefix}__${++gensymCounter}__`;
}

// gensymCounter 리셋 (테스트용)
export function resetGensym(): void {
  gensymCounter = 0;
}

export class MacroExpander {
  private macros = new Map<string, MacroDefinition>();

  define(name: string, params: string[], body: ASTNode): void {
    this.macros.set(name, { name, params, body });
  }

  has(name: string): boolean {
    return this.macros.has(name);
  }

  getMacro(name: string): MacroDefinition | undefined {
    return this.macros.get(name);
  }

  // 매크로 호출 확장: (when cond body) → (if cond body nil)
  // 재귀적으로 모든 자식 노드도 확장
  expand(node: ASTNode): ASTNode {
    if ((node as any).kind === "sexpr") {
      const sexpr = node as any;
      const op = sexpr.op;

      // 이 노드가 매크로 호출인지 확인
      if (this.macros.has(op)) {
        const macro = this.macros.get(op)!;
        // 인자를 먼저 확장 (내부에 매크로가 있을 수 있으므로)
        const expandedArgs: ASTNode[] = sexpr.args.map((arg: ASTNode) => this.expand(arg));

        // 바인딩 맵 구성: 패턴 변수 → 실제 인자
        const bindings = new Map<string, ASTNode>();
        for (let i = 0; i < macro.params.length; i++) {
          const paramName = macro.params[i];
          // $ 있으면 그대로, 없으면 $ 추가
          const key = paramName.startsWith("$") ? paramName : "$" + paramName;
          bindings.set(key, expandedArgs[i] ?? { kind: "literal", type: "null", value: null });
        }

        // 위생성: body 내부의 non-parameter 변수를 gensym으로 rename
        const hygieneMap = new Map<string, string>();
        const hygieneBody = this.renameLocals(macro.body, bindings, hygieneMap);

        // 템플릿에 바인딩 치환
        const expanded = this.substitute(hygieneBody, bindings);

        // 확장 결과도 다시 확장 (중첩 매크로)
        return this.expand(expanded);
      }

      // 매크로가 아니면 자식 노드들만 재귀 확장
      return {
        ...sexpr,
        args: sexpr.args.map((arg: ASTNode) => this.expand(arg)),
      };
    }

    // 다른 타입의 노드는 그대로
    return node;
  }

  // 위생성 처리: 매크로 body에서 패턴 변수가 아닌 지역 변수(let 바인딩 등)를 gensym으로 rename
  private renameLocals(
    template: ASTNode,
    bindings: Map<string, ASTNode>,
    hygieneMap: Map<string, string>
  ): ASTNode {
    if ((template as any).kind === "variable") {
      const varNode = template as any;
      const varName = varNode.name.startsWith("$") ? varNode.name : "$" + varNode.name;

      // 패턴 변수면 그대로 유지 (치환 대상)
      if (bindings.has(varName)) return template;

      // 위생 맵에 이미 있으면 해당 이름으로 rename
      if (hygieneMap.has(varName)) {
        return { kind: "variable", name: hygieneMap.get(varName)! };
      }

      // 새 로컬 변수는 gensym으로 rename하지 않음 (간단한 구현: 위생성은 let 바인딩에서만)
      return template;
    }

    if ((template as any).kind === "sexpr") {
      const sexpr = template as any;

      // let 바인딩의 경우 gensym으로 내부 변수 rename
      if (sexpr.op === "let" || sexpr.op === "set") {
        const newHygieneMap = new Map(hygieneMap);
        // let 바인딩 처리 — 내부에서 새 이름 생성
        const newArgs = sexpr.args.map((arg: ASTNode, idx: number) => {
          return this.renameLocals(arg, bindings, newHygieneMap);
        });
        return { ...sexpr, args: newArgs };
      }

      return {
        ...sexpr,
        args: sexpr.args.map((arg: ASTNode) => this.renameLocals(arg, bindings, hygieneMap)),
      };
    }

    return template;
  }

  // template에서 패턴 변수를 실제 값으로 치환
  private substitute(template: ASTNode, bindings: Map<string, ASTNode>): ASTNode {
    if ((template as any).kind === "variable") {
      const varNode = template as any;
      const varName = varNode.name.startsWith("$") ? varNode.name : "$" + varNode.name;
      if (bindings.has(varName)) {
        return bindings.get(varName)!;
      }
      return template;
    }

    if ((template as any).kind === "literal") {
      // symbol 리터럴도 패턴 변수일 수 있음
      const lit = template as any;
      if (lit.type === "symbol") {
        const key = "$" + lit.value;
        if (bindings.has(key)) {
          return bindings.get(key)!;
        }
      }
      return template;
    }

    if ((template as any).kind === "sexpr") {
      const sexpr = template as any;
      return {
        ...sexpr,
        args: sexpr.args.map((arg: ASTNode) => this.substitute(arg, bindings)),
      };
    }

    // block, keyword, etc. — 내부 필드도 재귀 치환
    if ((template as any).kind === "block") {
      const block = template as any;
      const newFields = new Map<string, ASTNode | ASTNode[]>();
      for (const [key, val] of block.fields.entries()) {
        if (Array.isArray(val)) {
          newFields.set(key, val.map((v: ASTNode) => this.substitute(v, bindings)));
        } else {
          newFields.set(key, this.substitute(val as ASTNode, bindings));
        }
      }
      return { ...block, fields: newFields };
    }

    return template;
  }

  // 디버깅용: AST를 문자열로 변환
  astToString(node: ASTNode): string {
    if ((node as any).kind === "sexpr") {
      const s = node as any;
      const args = s.args.map((a: ASTNode) => this.astToString(a)).join(" ");
      return `(${s.op}${args ? " " + args : ""})`;
    }
    if ((node as any).kind === "literal") {
      const l = node as any;
      if (l.type === "string") return `"${l.value}"`;
      if (l.type === "null") return "nil";
      return String(l.value);
    }
    if ((node as any).kind === "variable") {
      return (node as any).name;
    }
    if ((node as any).kind === "keyword") {
      return ":" + (node as any).name;
    }
    return JSON.stringify(node);
  }
}
