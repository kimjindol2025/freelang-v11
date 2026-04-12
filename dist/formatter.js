"use strict";
// FreeLang v9: Phase 73 — AST 기반 자동 포매터
// 들여쓰기 2칸, 80칸 줄바꿈, 멱등성 보장
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLFormatter = void 0;
exports.formatFL = formatFL;
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
function extractComments(src) {
    const result = [];
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith(";")) {
            result.push({ line: i + 1, text: trimmed });
        }
        else {
            // 인라인 주석 (아직 미지원 — 줄 맨 앞 주석만 보존)
            const idx = lines[i].indexOf(";");
            if (idx >= 0) {
                // 문자열 안인지 간단 체크
                const before = lines[i].slice(0, idx);
                const quoteCount = (before.match(/(?<!\\)"/g) || []).length;
                if (quoteCount % 2 === 0) {
                    result.push({ line: i + 1, text: lines[i].slice(idx).trim() });
                }
            }
        }
    }
    return result;
}
// ─────────────────────────────────────────────────────────────────
// FLFormatter 클래스
// ─────────────────────────────────────────────────────────────────
class FLFormatter {
    constructor() {
        this.indentStr = "  "; // 2칸
        this.maxWidth = 80;
    }
    /** 소스 코드를 정형화된 문자열로 변환 */
    format(src) {
        // 빈 소스 처리
        const trimmed = src.trim();
        if (!trimmed)
            return "";
        // 주석만 있는 줄 사전 보존
        const comments = extractComments(src);
        // lex → parse → AST
        const tokens = (0, lexer_1.lex)(src);
        const nodes = (0, parser_1.parse)(tokens);
        // 각 최상위 노드를 포맷
        const parts = [];
        for (const node of nodes) {
            parts.push(this.formatNode(node, 0));
        }
        // 최상위 노드들을 빈 줄 없이 합치되, Block 타입은 앞에 빈 줄 추가
        const lines = [];
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const node = nodes[i];
            if (i > 0 && (node.kind === "block" || node.kind === "module")) {
                lines.push("");
            }
            lines.push(part);
        }
        return lines.join("\n") + "\n";
    }
    // ───────────────────────────────────────
    // 노드 포맷 디스패처
    // ───────────────────────────────────────
    formatNode(node, depth) {
        switch (node.kind) {
            case "literal": return this.formatLiteral(node);
            case "variable": return `$${node.name}`;
            case "keyword": return `:${node.name}`;
            case "sexpr": return this.formatSExpr(node, depth);
            case "block": return this.formatBlock(node, depth);
            case "pattern-match": return this.formatPatternMatch(node, depth);
            case "function-value": return this.formatFunctionValue(node, depth);
            case "type-class": return this.formatTypeClass(node, depth);
            case "type-class-instance": return this.formatTypeClassInstance(node, depth);
            case "module": return this.formatModuleBlock(node, depth);
            case "import": return this.formatImportBlock(node);
            case "open": return this.formatOpenBlock(node);
            case "search-block": return this.formatSearchBlock(node, depth);
            case "learn-block": return this.formatLearnBlock(node, depth);
            case "reasoning-block": return this.formatReasoningBlock(node, depth);
            case "reasoning-sequence": return this.formatReasoningSequence(node, depth);
            case "async-function": return this.formatAsyncFunction(node, depth);
            case "await": return this.formatAwait(node, depth);
            case "try-block": return this.formatTryBlock(node, depth);
            case "catch-clause": return this.formatCatchClause(node, depth);
            case "throw": return this.formatThrow(node, depth);
            case "type-variable": return node.name;
            default:
                return String(node.value ?? "");
        }
    }
    // ───────────────────────────────────────
    // Literal
    // ───────────────────────────────────────
    formatLiteral(node) {
        if (node.type === "string") {
            // 이미 이스케이프된 문자열 그대로
            return `"${String(node.value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
        }
        if (node.type === "null")
            return "null";
        if (node.type === "boolean")
            return String(node.value);
        if (node.type === "symbol")
            return String(node.value);
        return String(node.value);
    }
    // ───────────────────────────────────────
    // SExpr: (op arg1 arg2 ...)
    // ───────────────────────────────────────
    formatSExpr(node, depth) {
        const op = node.op;
        const args = node.args;
        if (args.length === 0) {
            return `(${op})`;
        }
        // 특수 폼별 처리
        if (op === "fn" || op === "lambda") {
            return this.formatFn(op, args, depth);
        }
        if (op === "define" || op === "def") {
            return this.formatDefine(op, args, depth);
        }
        if (op === "let") {
            return this.formatLet(args, depth);
        }
        if (op === "if") {
            return this.formatIf(args, depth);
        }
        if (op === "do" || op === "begin") {
            return this.formatDo(op, args, depth);
        }
        if (op === "cond") {
            return this.formatCond(args, depth);
        }
        if (op === "match") {
            return this.formatMatch(args, depth);
        }
        // 기본 SExpr: 한 줄 시도 → 초과하면 여러 줄
        const inlineArgs = args.map((a) => this.formatNode(a, depth));
        const inline = `(${op} ${inlineArgs.join(" ")})`;
        const indent = this.ind(depth);
        if (inline.length <= this.maxWidth - depth * 2) {
            return inline;
        }
        // 여러 줄: 첫 arg는 op와 같은 줄, 나머지는 들여쓰기
        const innerIndent = this.ind(depth + 1);
        const formatted = args.map((a) => innerIndent + this.formatNode(a, depth + 1));
        return `(${op}\n${formatted.join("\n")})`;
    }
    // fn/lambda 포맷
    formatFn(op, args, depth) {
        if (args.length < 2) {
            return `(${op} ${args.map((a) => this.formatNode(a, depth)).join(" ")})`;
        }
        const params = this.formatNode(args[0], depth);
        const bodyParts = args.slice(1).map((a) => this.formatNode(a, depth + 1));
        const innerIndent = this.ind(depth + 1);
        const inline = `(${op} ${params} ${bodyParts.join(" ")})`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        return `(${op} ${params}\n${bodyParts.map((b) => innerIndent + b).join("\n")})`;
    }
    // define/def 포맷
    formatDefine(op, args, depth) {
        if (args.length === 0)
            return `(${op})`;
        const nameNode = args[0];
        const name = this.formatNode(nameNode, depth);
        if (args.length === 1)
            return `(${op} ${name})`;
        const rest = args.slice(1).map((a) => this.formatNode(a, depth + 1));
        const inline = `(${op} ${name} ${rest.join(" ")})`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        const innerIndent = this.ind(depth + 1);
        return `(${op} ${name}\n${rest.map((r) => innerIndent + r).join("\n")})`;
    }
    // let 포맷: (let [[$x val] ...] body)
    formatLet(args, depth) {
        if (args.length === 0)
            return "(let)";
        const bindingsNode = args[0];
        const body = args.slice(1).map((a) => this.formatNode(a, depth + 1));
        const bindings = this.formatNode(bindingsNode, depth + 1);
        const inline = `(let ${bindings} ${body.join(" ")})`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        const innerIndent = this.ind(depth + 1);
        return `(let ${bindings}\n${body.map((b) => innerIndent + b).join("\n")})`;
    }
    // if 포맷
    formatIf(args, depth) {
        const parts = args.map((a) => this.formatNode(a, depth + 1));
        const inline = `(if ${parts.join(" ")})`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        const innerIndent = this.ind(depth + 1);
        return `(if ${parts[0]}\n${parts
            .slice(1)
            .map((p) => innerIndent + p)
            .join("\n")})`;
    }
    // do/begin 포맷
    formatDo(op, args, depth) {
        const innerIndent = this.ind(depth + 1);
        const parts = args.map((a) => innerIndent + this.formatNode(a, depth + 1));
        return `(${op}\n${parts.join("\n")})`;
    }
    // cond 포맷
    formatCond(args, depth) {
        const innerIndent = this.ind(depth + 1);
        const parts = args.map((a) => innerIndent + this.formatNode(a, depth + 1));
        return `(cond\n${parts.join("\n")})`;
    }
    // match 포맷
    formatMatch(args, depth) {
        if (args.length === 0)
            return "(match)";
        const subject = this.formatNode(args[0], depth);
        const innerIndent = this.ind(depth + 1);
        const cases = args
            .slice(1)
            .map((a) => innerIndent + this.formatNode(a, depth + 1));
        return `(match ${subject}\n${cases.join("\n")})`;
    }
    // ───────────────────────────────────────
    // Block: [TYPE name :key val ...]
    // Array Block: [$a $b $c] — items 배열
    // ───────────────────────────────────────
    formatBlock(node, depth) {
        // Array Block 특수 처리: [$a $b ...] 형태로 재생성
        if (node.type === "Array") {
            const items = node.fields.get("items");
            if (items) {
                return this.formatNodeArray(items, depth);
            }
            return "[]";
        }
        const innerIndent = this.ind(depth + 1);
        const lines = [];
        // 헤더
        const header = `[${node.type} ${node.name}`;
        // fields 처리 — Array Block 값도 올바르게 포맷
        const fieldParts = [];
        for (const [key, val] of node.fields) {
            const formattedVal = Array.isArray(val)
                ? this.formatNodeArray(val, depth + 1)
                : this.formatNode(val, depth + 1);
            fieldParts.push(`:${key}`, formattedVal);
        }
        // 한 줄로 시도
        const inline = fieldParts.length > 0
            ? `${header} ${fieldParts.join(" ")}]`
            : `${header}]`;
        const limit = this.maxWidth - depth * 2;
        if (inline.length <= limit) {
            return inline;
        }
        // 여러 줄
        lines.push(header);
        for (let i = 0; i < fieldParts.length; i += 2) {
            const key = fieldParts[i];
            const val = fieldParts[i + 1];
            lines.push(`${innerIndent}${key} ${val}`);
        }
        return lines.join("\n") + "]";
    }
    // 배열 노드들을 [...] 형태로 포맷
    formatNodeArray(nodes, depth) {
        if (nodes.length === 0)
            return "[]";
        const parts = nodes.map((n) => this.formatNode(n, depth));
        const inline = `[${parts.join(" ")}]`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        const innerIndent = this.ind(depth + 1);
        return `[\n${parts.map((p) => innerIndent + p).join("\n")}\n${this.ind(depth)}]`;
    }
    // ───────────────────────────────────────
    // PatternMatch: (match val cases...)
    // ───────────────────────────────────────
    formatPatternMatch(node, depth) {
        const subject = this.formatNode(node.value, depth + 1);
        const innerIndent = this.ind(depth + 1);
        const cases = node.cases.map((c) => innerIndent + this.formatMatchCase(c, depth + 1));
        let result = `(match ${subject}\n${cases.join("\n")}`;
        if (node.defaultCase) {
            result += `\n${innerIndent}(_ ${this.formatNode(node.defaultCase, depth + 1)})`;
        }
        return result + ")";
    }
    formatMatchCase(mc, depth) {
        const pat = this.formatPattern(mc.pattern);
        const body = this.formatNode(mc.body, depth);
        if (mc.guard) {
            const guard = this.formatNode(mc.guard, depth);
            return `(${pat} :when ${guard} ${body})`;
        }
        return `(${pat} ${body})`;
    }
    formatPattern(pat) {
        switch (pat.kind) {
            case "literal-pattern": return String(pat.value);
            case "variable-pattern": return `$${pat.name}`;
            case "wildcard-pattern": return "_";
            case "list-pattern": {
                const elems = pat.elements.map((e) => this.formatPattern(e));
                if (pat.restElement)
                    elems.push(`& $${pat.restElement}`);
                return `[${elems.join(" ")}]`;
            }
            case "struct-pattern": {
                const fields = [];
                for (const [k, v] of pat.fields) {
                    fields.push(`:${k} ${this.formatPattern(v)}`);
                }
                let s = `{${fields.join(" ")}}`;
                if (pat.asBinding)
                    s += ` :as $${pat.asBinding}`;
                return s;
            }
            case "or-pattern":
                return pat.alternatives.map((a) => this.formatPattern(a)).join(" | ");
            case "range-pattern":
                return `(range ${pat.min} ${pat.max})`;
            default:
                return "_";
        }
    }
    // ───────────────────────────────────────
    // FunctionValue
    // ───────────────────────────────────────
    formatFunctionValue(node, depth) {
        const params = node.params.map((p) => `$${p}`).join(" ");
        const body = this.formatNode(node.body, depth + 1);
        const inline = `(fn [${params}] ${body})`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        const innerIndent = this.ind(depth + 1);
        return `(fn [${params}]\n${innerIndent}${body})`;
    }
    // ───────────────────────────────────────
    // TypeClass / Instance
    // ───────────────────────────────────────
    formatTypeClass(node, depth) {
        const innerIndent = this.ind(depth + 1);
        const typeParams = node.typeParams.join(" ");
        const methods = [];
        for (const [name, method] of node.methods) {
            methods.push(`${innerIndent}:${name} ${this.formatNode(method.type, depth + 1)}`);
        }
        return `[TYPECLASS ${node.name} [${typeParams}]\n${innerIndent}:methods [\n${methods.join("\n")}\n${innerIndent}]\n${this.ind(depth)}]`;
    }
    formatTypeClassInstance(node, depth) {
        const innerIndent = this.ind(depth + 1);
        const impls = [];
        for (const [name, impl] of node.implementations) {
            impls.push(`${innerIndent}:${name} ${this.formatNode(impl, depth + 1)}`);
        }
        return `[INSTANCE (${node.className} ${node.concreteType})\n${impls.join("\n")}\n${this.ind(depth)}]`;
    }
    // ───────────────────────────────────────
    // Module / Import / Open
    // ───────────────────────────────────────
    formatModuleBlock(node, depth) {
        const innerIndent = this.ind(depth + 1);
        const exports = `[${node.exports.join(" ")}]`;
        const body = node.body.map((b) => innerIndent + this.formatNode(b, depth + 1)).join("\n");
        return `[MODULE ${node.name}\n${innerIndent}:exports ${exports}\n${innerIndent}:body [\n${body}\n${innerIndent}]\n${this.ind(depth)}]`;
    }
    formatImportBlock(node) {
        let s = `(import ${node.moduleName}`;
        if (node.source)
            s += ` :from "${node.source}"`;
        if (node.selective)
            s += ` :only [${node.selective.join(" ")}]`;
        if (node.alias)
            s += ` :as ${node.alias}`;
        return s + ")";
    }
    formatOpenBlock(node) {
        let s = `(open ${node.moduleName}`;
        if (node.source)
            s += ` :from "${node.source}"`;
        return s + ")";
    }
    // ───────────────────────────────────────
    // Search / Learn / Reasoning
    // ───────────────────────────────────────
    formatSearchBlock(node, depth) {
        let s = `[search "${node.query}" :source "${node.source}"`;
        if (node.cache !== undefined)
            s += ` :cache ${node.cache}`;
        if (node.limit !== undefined)
            s += ` :limit ${node.limit}`;
        if (node.name)
            s += ` :name "${node.name}"`;
        return s + "]";
    }
    formatLearnBlock(node, depth) {
        let s = `(learn "${node.key}" ${JSON.stringify(node.data)}`;
        if (node.source)
            s += ` :source "${node.source}"`;
        if (node.confidence !== undefined)
            s += ` :confidence ${node.confidence}`;
        return s + ")";
    }
    formatReasoningBlock(node, depth) {
        const innerIndent = this.ind(depth + 1);
        const parts = [];
        for (const [k, v] of node.data) {
            parts.push(`${innerIndent}:${k} ${JSON.stringify(v)}`);
        }
        if (parts.length === 0)
            return `(${node.stage})`;
        return `(${node.stage}\n${parts.join("\n")})`;
    }
    formatReasoningSequence(node, depth) {
        const innerIndent = this.ind(depth + 1);
        const stages = node.stages.map((s) => innerIndent + this.formatNode(s, depth + 1));
        return `(reasoning-sequence\n${stages.join("\n")})`;
    }
    // ───────────────────────────────────────
    // Async / Await / Try / Throw
    // ───────────────────────────────────────
    formatAsyncFunction(node, depth) {
        const params = node.params.map((p) => `$${p.name}`).join(" ");
        const body = this.formatNode(node.body, depth + 1);
        const innerIndent = this.ind(depth + 1);
        const inline = `[async ${node.name} [${params}] ${body}]`;
        if (inline.length <= this.maxWidth - depth * 2)
            return inline;
        return `[async ${node.name} [${params}]\n${innerIndent}${body}]`;
    }
    formatAwait(node, depth) {
        return `(await ${this.formatNode(node.argument, depth)})`;
    }
    formatTryBlock(node, depth) {
        const innerIndent = this.ind(depth + 1);
        const body = this.formatNode(node.body, depth + 1);
        let s = `(try\n${innerIndent}${body}`;
        if (node.catchClauses) {
            for (const c of node.catchClauses) {
                s += `\n${innerIndent}${this.formatCatchClause(c, depth + 1)}`;
            }
        }
        if (node.finallyBlock) {
            s += `\n${innerIndent}(finally ${this.formatNode(node.finallyBlock, depth + 1)})`;
        }
        return s + ")";
    }
    formatCatchClause(node, depth) {
        const handler = this.formatNode(node.handler, depth);
        if (node.pattern) {
            return `(catch [${this.formatPattern(node.pattern)}${node.variable ? ` $${node.variable}` : ""}] ${handler})`;
        }
        if (node.variable) {
            return `(catch [$${node.variable}] ${handler})`;
        }
        return `(catch ${handler})`;
    }
    formatThrow(node, depth) {
        return `(throw ${this.formatNode(node.argument, depth)})`;
    }
    // ───────────────────────────────────────
    // 유틸
    // ───────────────────────────────────────
    ind(depth) {
        return this.indentStr.repeat(depth);
    }
}
exports.FLFormatter = FLFormatter;
// ─────────────────────────────────────────────────────────────────
// 편의 함수
// ─────────────────────────────────────────────────────────────────
function formatFL(src) {
    return new FLFormatter().format(src);
}
//# sourceMappingURL=formatter.js.map