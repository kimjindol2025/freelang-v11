"use strict";
// FreeLang v9: Phase 77 — 문서 추출기 (doc-extractor.ts)
// FL 소스에서 문서 정보를 추출한다.
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDocs = extractDocs;
function parseDocComment(lines) {
    const docLines = [];
    const examples = [];
    let inExample = false;
    let exampleLines = [];
    for (const line of lines) {
        const stripped = line.replace(/^;;;\s?/, "");
        if (stripped.startsWith("@example")) {
            // 이전 example 저장
            if (exampleLines.length > 0) {
                examples.push(exampleLines.join("\n").trim());
                exampleLines = [];
            }
            inExample = true;
            const rest = stripped.replace(/^@example\s*/, "");
            if (rest)
                exampleLines.push(rest);
        }
        else if (inExample) {
            // @example 이후 줄은 예제에 포함 (;;; 으로 시작하는 한)
            exampleLines.push(stripped);
        }
        else {
            docLines.push(stripped);
        }
    }
    if (exampleLines.length > 0) {
        examples.push(exampleLines.join("\n").trim());
    }
    return {
        doc: docLines.join("\n").trim(),
        examples,
    };
}
// ─────────────────────────────────────────
// 파라미터 추출: :params [$a $b $c] 형식 파싱
// ─────────────────────────────────────────
function extractParams(text) {
    // :params [$a $b $c] 매칭
    const m = text.match(/:params\s*\[([^\]]*)\]/);
    if (!m)
        return [];
    return m[1]
        .split(/\s+/)
        .map((p) => p.trim())
        .filter((p) => p.startsWith("$"))
        .map((p) => p.slice(1)); // $ 제거
}
// ─────────────────────────────────────────
// 소스 스니펫 추출: 괄호/대괄호 균형 맞춰 전체 블록 추출
// ─────────────────────────────────────────
function extractBlock(src, startIdx) {
    let depth = 0;
    let i = startIdx;
    let started = false;
    const openChar = src[startIdx];
    const closeChar = openChar === "[" ? "]" : ")";
    while (i < src.length) {
        const ch = src[i];
        if (ch === '"') {
            i++;
            while (i < src.length && src[i] !== '"') {
                if (src[i] === "\\")
                    i++;
                i++;
            }
        }
        else if (ch === openChar) {
            depth++;
            started = true;
        }
        else if (ch === closeChar) {
            depth--;
            if (started && depth === 0) {
                return src.slice(startIdx, i + 1);
            }
        }
        i++;
    }
    return src.slice(startIdx, i);
}
// ─────────────────────────────────────────
// 메인 추출 함수
// ─────────────────────────────────────────
function extractDocs(src) {
    const entries = [];
    const lines = src.split("\n");
    // 각 줄 위치 인덱스 구축 (줄 번호 → 문자 오프셋)
    const lineOffsets = [];
    let offset = 0;
    for (const line of lines) {
        lineOffsets.push(offset);
        offset += line.length + 1; // +1 for \n
    }
    // 각 줄을 순회하면서 ;;; 주석 블록과 정의 블록을 찾는다
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        // ──────────────────────────────────────────
        // [FUNC name :params [...] :body ...]
        // ──────────────────────────────────────────
        const funcMatch = trimmed.match(/^\[FUNC\s+(\S+)/);
        if (funcMatch) {
            const name = funcMatch[1];
            // 바로 위의 ;;; 주석 수집
            const commentLines = collectCommentAbove(lines, i);
            const { doc, examples } = parseDocComment(commentLines);
            // 소스 스니펫
            const charOffset = lineOffsets[i];
            const blockSrc = extractBlock(src, charOffset + (line.indexOf("[FUNC")));
            const params = extractParams(blockSrc);
            entries.push({ name, kind: "function", params, doc, examples, source: blockSrc });
            i++;
            continue;
        }
        // ──────────────────────────────────────────
        // (defmacro name [...] ...)
        // ──────────────────────────────────────────
        const macroMatch = trimmed.match(/^\(defmacro\s+(\S+)/);
        if (macroMatch) {
            const name = macroMatch[1];
            const commentLines = collectCommentAbove(lines, i);
            const { doc, examples } = parseDocComment(commentLines);
            const charOffset = lineOffsets[i];
            const col = line.indexOf("(defmacro");
            const blockSrc = extractBlock(src, charOffset + col);
            // params: second arg after name
            const paramMatch = blockSrc.match(/\(defmacro\s+\S+\s+\[([^\]]*)\]/);
            const params = paramMatch
                ? paramMatch[1]
                    .split(/\s+/)
                    .map((p) => p.trim())
                    .filter((p) => p.startsWith("$"))
                    .map((p) => p.slice(1))
                : [];
            entries.push({ name, kind: "macro", params, doc, examples, source: blockSrc });
            i++;
            continue;
        }
        // ──────────────────────────────────────────
        // (defstruct Name [...])
        // ──────────────────────────────────────────
        const structMatch = trimmed.match(/^\(defstruct\s+(\S+)/);
        if (structMatch) {
            const name = structMatch[1];
            const commentLines = collectCommentAbove(lines, i);
            const { doc, examples } = parseDocComment(commentLines);
            const charOffset = lineOffsets[i];
            const col = line.indexOf("(defstruct");
            const blockSrc = extractBlock(src, charOffset + col);
            // fields as "params"
            const fieldMatch = blockSrc.match(/\(defstruct\s+\S+\s+\[([^\]]*)\]/);
            const params = fieldMatch
                ? fieldMatch[1]
                    .split(/\s+/)
                    .map((p) => p.trim())
                    .filter((p) => p.startsWith(":"))
                    .map((p) => p.slice(1))
                : [];
            entries.push({ name, kind: "struct", params, doc, examples, source: blockSrc });
            i++;
            continue;
        }
        // ──────────────────────────────────────────
        // (defprotocol Name ...)
        // ──────────────────────────────────────────
        const protoMatch = trimmed.match(/^\(defprotocol\s+(\S+)/);
        if (protoMatch) {
            const name = protoMatch[1];
            const commentLines = collectCommentAbove(lines, i);
            const { doc, examples } = parseDocComment(commentLines);
            const charOffset = lineOffsets[i];
            const col = line.indexOf("(defprotocol");
            const blockSrc = extractBlock(src, charOffset + col);
            entries.push({ name, kind: "protocol", params: [], doc, examples, source: blockSrc });
            i++;
            continue;
        }
        // ──────────────────────────────────────────
        // [MODULE name :exports [...] :body [...]]
        // 모듈 내부의 FUNC도 추출
        // ──────────────────────────────────────────
        const moduleMatch = trimmed.match(/^\[MODULE\s+(\S+)/);
        if (moduleMatch) {
            // 모듈 블록을 추출
            const charOffset = lineOffsets[i];
            const col = line.indexOf("[MODULE");
            const blockSrc = extractBlock(src, charOffset + col);
            // blockSrc 내에서 재귀 추출
            const innerEntries = extractDocs(blockSrc.replace(/^\[MODULE[^\n]*\n/, ""));
            entries.push(...innerEntries);
            i++;
            continue;
        }
        i++;
    }
    return entries;
}
// ─────────────────────────────────────────
// 특정 줄 위에 있는 ;;; 주석 줄들을 수집 (연속된 것만)
// ─────────────────────────────────────────
function collectCommentAbove(lines, lineIdx) {
    const result = [];
    let j = lineIdx - 1;
    // 빈 줄 하나는 허용, 그 이상은 끊기
    while (j >= 0) {
        const t = lines[j].trim();
        if (t.startsWith(";;;")) {
            result.unshift(lines[j].trim());
            j--;
        }
        else if (t === "") {
            // 빈 줄 하나는 건너뜀
            break;
        }
        else {
            break;
        }
    }
    return result;
}
//# sourceMappingURL=doc-extractor.js.map