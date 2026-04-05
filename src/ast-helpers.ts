// FreeLang v9: AST Helper Functions
// Phase 6: AST Extraction and Manipulation Utilities

import { ASTNode, Block, Literal, Variable, SExpr, isFuncBlock, isVariable, isLiteral, isSymbolLiteral } from "./ast";

/**
 * 노드에서 모든 심볼을 재귀적으로 추출
 * 심볼: Symbol 리터럴 또는 변수 이름
 */
export function extractSymbols(node: ASTNode): string[] {
  const symbols: string[] = [];

  function traverse(n: ASTNode): void {
    if (isSymbolLiteral(n)) {
      symbols.push(String(n.value));
    } else if (isVariable(n)) {
      symbols.push(n.name);
    } else if (typeof n === "object" && n !== null) {
      // SExpr, Block 등 객체 타입
      const obj = n as any;
      if (Array.isArray(obj.args)) {
        obj.args.forEach((arg: ASTNode) => traverse(arg));
      }
      if (obj.fields instanceof Map) {
        obj.fields.forEach((value: any) => {
          if (Array.isArray(value)) {
            value.forEach((v) => traverse(v));
          } else if (value && typeof value === "object") {
            traverse(value);
          }
        });
      }
    }
  }

  traverse(node);
  return [...new Set(symbols)]; // 중복 제거
}

/**
 * 블록 배열에서 모든 FUNC 블록 추출
 */
export function extractFunctions(blocks: ASTNode[]): Block[] {
  const functions: Block[] = [];

  for (const block of blocks) {
    if (isFuncBlock(block)) {
      functions.push(block);
    }
  }

  return functions;
}

/**
 * 파라미터 배열을 정규화된 문자열 배열로 변환
 * - 문자열: 그대로 사용 ("$a" → "a")
 * - 변수: 이름 추출 ({kind: "variable", name: "a"} → "a")
 * - 리터럴: 값으로 변환 ({kind: "literal", value: 5} → "5")
 */
export function extractParamNames(params: any): string[] {
  if (!Array.isArray(params)) {
    return [];
  }

  return params.map((p) => {
    if (typeof p === "string") {
      // "$a" → "a"
      return p.startsWith("$") ? p.substring(1) : p;
    }
    if (isVariable(p)) {
      return p.name;
    }
    if (isLiteral(p)) {
      return String(p.value);
    }
    // 예상하지 못한 타입
    return "";
  }).filter((name) => name.length > 0);
}

/**
 * 블록에서 특정 필드 추출
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 필드값 또는 undefined
 */
export function extractBlockField(block: Block, fieldName: string): ASTNode | ASTNode[] | undefined {
  return block.fields?.get(fieldName);
}

/**
 * 블록에서 문자열 필드 추출 (리터럴)
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 문자열값 또는 undefined
 */
export function extractStringField(block: Block, fieldName: string): string | undefined {
  const field = block.fields?.get(fieldName);
  if (isLiteral(field) && field.type === "string") {
    return String(field.value);
  }
  return undefined;
}

/**
 * 블록에서 배열 필드 추출
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 배열 또는 빈 배열
 */
export function extractArrayField(block: Block, fieldName: string): ASTNode[] {
  const field = block.fields?.get(fieldName);
  if (Array.isArray(field)) {
    return field;
  }
  return [];
}

/**
 * 여러 블록에서 공통 속성 추출
 * 예: [블록1, 블록2, 블록3]에서 모두 "FUNC"인지 확인
 */
export function extractCommonType(blocks: Block[]): string | undefined {
  if (blocks.length === 0) return undefined;

  const firstType = blocks[0].type;
  const allSameType = blocks.every((block) => block.type === firstType);

  return allSameType ? firstType : undefined;
}

/**
 * 의존성 그래프 빌드 (간단한 버전)
 * 함수 간의 호출 관계를 분석
 */
export interface FunctionDependency {
  functionName: string;
  dependencies: string[];
}

export function buildDependencyGraph(blocks: Block[]): FunctionDependency[] {
  const functions = extractFunctions(blocks);
  const dependencies: FunctionDependency[] = [];

  for (const func of functions) {
    const body = func.fields?.get("body");
    if (!body) continue;

    // body에서 호출되는 함수명 추출
    const calledFunctions = extractSymbols(body as ASTNode)
      .filter((symbol) => functions.some((f) => f.name === symbol));

    dependencies.push({
      functionName: func.name,
      dependencies: [...new Set(calledFunctions)],
    });
  }

  return dependencies;
}

/**
 * 함수 호출 순서 결정 (위상 정렬)
 * 의존성을 고려하여 올바른 함수 정의 순서 반환
 */
export function topologicalSort(dependencies: FunctionDependency[]): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      // 순환 의존성 감지 (현재는 경고만 출력)
      console.warn(`⚠️ Circular dependency detected: ${name}`);
      return;
    }

    visiting.add(name);

    const dep = dependencies.find((d) => d.functionName === name);
    if (dep) {
      for (const depName of dep.dependencies) {
        visit(depName);
      }
    }

    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const dep of dependencies) {
    visit(dep.functionName);
  }

  return sorted;
}
