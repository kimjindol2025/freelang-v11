import { ASTNode, Block } from "./ast";
/**
 * 노드에서 모든 심볼을 재귀적으로 추출
 * 심볼: Symbol 리터럴 또는 변수 이름
 */
export declare function extractSymbols(node: ASTNode): string[];
/**
 * 블록 배열에서 모든 FUNC 블록 추출
 */
export declare function extractFunctions(blocks: ASTNode[]): Block[];
/**
 * 파라미터 배열을 정규화된 문자열 배열로 변환
 * - 문자열: 그대로 사용 ("$a" → "a")
 * - 변수: 이름 추출 ({kind: "variable", name: "a"} → "a")
 * - 리터럴: 값으로 변환 ({kind: "literal", value: 5} → "5")
 */
export declare function extractParamNames(params: any): string[];
/**
 * 블록에서 특정 필드 추출
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 필드값 또는 undefined
 */
export declare function extractBlockField(block: Block, fieldName: string): ASTNode | ASTNode[] | undefined;
/**
 * 블록에서 문자열 필드 추출 (리터럴)
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 문자열값 또는 undefined
 */
export declare function extractStringField(block: Block, fieldName: string): string | undefined;
/**
 * 블록에서 배열 필드 추출
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 배열 또는 빈 배열
 */
export declare function extractArrayField(block: Block, fieldName: string): ASTNode[];
/**
 * 여러 블록에서 공통 속성 추출
 * 예: [블록1, 블록2, 블록3]에서 모두 "FUNC"인지 확인
 */
export declare function extractCommonType(blocks: Block[]): string | undefined;
/**
 * 의존성 그래프 빌드 (간단한 버전)
 * 함수 간의 호출 관계를 분석
 */
export interface FunctionDependency {
    functionName: string;
    dependencies: string[];
}
export declare function buildDependencyGraph(blocks: Block[]): FunctionDependency[];
/**
 * 함수 호출 순서 결정 (위상 정렬)
 * 의존성을 고려하여 올바른 함수 정의 순서 반환
 */
export declare function topologicalSort(dependencies: FunctionDependency[]): string[];
//# sourceMappingURL=ast-helpers.d.ts.map