"use strict";
// FreeLang v9: Phase 77 — 문서 렌더러 (doc-renderer.ts)
// DocEntry[]를 Markdown으로 렌더링한다.
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMarkdown = renderMarkdown;
exports.renderSummary = renderSummary;
// ─────────────────────────────────────────
// 전체 Markdown 렌더링
// ─────────────────────────────────────────
function renderMarkdown(entries, title) {
    const lines = [];
    const heading = title ?? "FreeLang API 문서";
    // 제목
    lines.push(`# ${heading}`);
    lines.push("");
    if (entries.length === 0) {
        lines.push("(문서화된 항목 없음)");
        return lines.join("\n");
    }
    // 목차
    lines.push("## 목차");
    lines.push("");
    for (const entry of entries) {
        const badge = kindBadge(entry.kind);
        const anchor = toAnchor(entry.name);
        lines.push(`- [${badge} \`${entry.name}\`](#${anchor})`);
    }
    lines.push("");
    // 각 항목 섹션
    for (const entry of entries) {
        lines.push(`## ${entry.name}`);
        lines.push("");
        // 종류 뱃지
        lines.push(`**종류**: ${kindLabel(entry.kind)}`);
        lines.push("");
        // 설명
        if (entry.doc) {
            lines.push(entry.doc);
            lines.push("");
        }
        // 파라미터 테이블
        if (entry.params.length > 0) {
            lines.push("### 파라미터");
            lines.push("");
            lines.push("| 이름 | 설명 |");
            lines.push("|------|------|");
            for (const param of entry.params) {
                lines.push(`| \`${param}\` |  |`);
            }
            lines.push("");
        }
        else if (entry.kind === "function" || entry.kind === "macro") {
            lines.push("*파라미터 없음*");
            lines.push("");
        }
        // 예제 코드 블록
        if (entry.examples.length > 0) {
            lines.push("### 예제");
            lines.push("");
            for (const example of entry.examples) {
                lines.push("```freelang");
                lines.push(example);
                lines.push("```");
                lines.push("");
            }
        }
        // 소스
        lines.push("### 소스");
        lines.push("");
        lines.push("```freelang");
        lines.push(entry.source);
        lines.push("```");
        lines.push("");
        lines.push("---");
        lines.push("");
    }
    return lines.join("\n");
}
// ─────────────────────────────────────────
// 한 줄 요약 목록
// ─────────────────────────────────────────
function renderSummary(entries) {
    if (entries.length === 0) {
        return "(항목 없음)";
    }
    return entries
        .map((e) => {
        const params = e.params.length > 0 ? `(${e.params.join(", ")})` : "()";
        const doc = e.doc ? ` — ${e.doc.split("\n")[0]}` : "";
        return `- **${e.name}**${params} [${kindLabel(e.kind)}]${doc}`;
    })
        .join("\n");
}
// ─────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────
function kindBadge(kind) {
    switch (kind) {
        case "function": return "fn";
        case "macro": return "macro";
        case "struct": return "struct";
        case "protocol": return "protocol";
    }
}
function kindLabel(kind) {
    switch (kind) {
        case "function": return "함수 (FUNC)";
        case "macro": return "매크로 (defmacro)";
        case "struct": return "구조체 (defstruct)";
        case "protocol": return "프로토콜 (defprotocol)";
    }
}
function toAnchor(name) {
    return name.toLowerCase().replace(/[^a-z0-9가-힣]/g, "-");
}
//# sourceMappingURL=doc-renderer.js.map