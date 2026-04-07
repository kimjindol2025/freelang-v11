"use strict";
// FreeLang v9: AST Helper Functions
// Phase 6: AST Extraction and Manipulation Utilities
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSymbols = extractSymbols;
exports.extractFunctions = extractFunctions;
exports.extractParamNames = extractParamNames;
exports.extractBlockField = extractBlockField;
exports.extractStringField = extractStringField;
exports.extractArrayField = extractArrayField;
exports.extractCommonType = extractCommonType;
exports.buildDependencyGraph = buildDependencyGraph;
exports.topologicalSort = topologicalSort;
const ast_1 = require("./ast");
/**
 * 노드에서 모든 심볼을 재귀적으로 추출
 * 심볼: Symbol 리터럴 또는 변수 이름
 */
function extractSymbols(node) {
    const symbols = [];
    function traverse(n) {
        if ((0, ast_1.isSymbolLiteral)(n)) {
            symbols.push(String(n.value));
        }
        else if ((0, ast_1.isVariable)(n)) {
            symbols.push(n.name);
        }
        else if (typeof n === "object" && n !== null) {
            // SExpr, Block 등 객체 타입
            const obj = n;
            if (Array.isArray(obj.args)) {
                obj.args.forEach((arg) => traverse(arg));
            }
            if (obj.fields instanceof Map) {
                obj.fields.forEach((value) => {
                    if (Array.isArray(value)) {
                        value.forEach((v) => traverse(v));
                    }
                    else if (value && typeof value === "object") {
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
function extractFunctions(blocks) {
    const functions = [];
    for (const block of blocks) {
        if ((0, ast_1.isFuncBlock)(block)) {
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
function extractParamNames(params) {
    if (!Array.isArray(params)) {
        return [];
    }
    return params.map((p) => {
        if (typeof p === "string") {
            // "$a" → "a"
            return p.startsWith("$") ? p.substring(1) : p;
        }
        if ((0, ast_1.isVariable)(p)) {
            return p.name;
        }
        if ((0, ast_1.isLiteral)(p)) {
            return String(p.value);
        }
        // 예상하지 못한 타입
        throw new Error(`extractParamNames: unknown param node type '${p?.kind ?? typeof p}'`);
    });
}
/**
 * 블록에서 특정 필드 추출
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 필드값 또는 undefined
 */
function extractBlockField(block, fieldName) {
    return block.fields?.get(fieldName);
}
/**
 * 블록에서 문자열 필드 추출 (리터럴)
 * @param block - Block 객체
 * @param fieldName - 추출할 필드명
 * @returns 문자열값 또는 undefined
 */
function extractStringField(block, fieldName) {
    const field = block.fields?.get(fieldName);
    if ((0, ast_1.isLiteral)(field) && field.type === "string") {
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
function extractArrayField(block, fieldName) {
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
function extractCommonType(blocks) {
    if (blocks.length === 0)
        return undefined;
    const firstType = blocks[0].type;
    const allSameType = blocks.every((block) => block.type === firstType);
    return allSameType ? firstType : undefined;
}
function buildDependencyGraph(blocks) {
    const functions = extractFunctions(blocks);
    const dependencies = [];
    for (const func of functions) {
        const body = func.fields?.get("body");
        if (!body)
            continue;
        // body에서 호출되는 함수명 추출
        const calledFunctions = extractSymbols(body)
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
function topologicalSort(dependencies) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    function visit(name) {
        if (visited.has(name))
            return;
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
//# sourceMappingURL=ast-helpers.js.map