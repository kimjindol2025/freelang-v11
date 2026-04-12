"use strict";
// FreeLang v9 External AI SDK
// Phase 110: 외부 AI가 FL을 쓰는 SDK
// 외부 AI(Claude API, OpenAI API 등)가 FL 코드를 실행하거나 FL 블록을 생성할 수 있도록 SDK 제공
Object.defineProperty(exports, "__esModule", { value: true });
exports.sdk = exports.FLSDK = exports.FLCodeBuilder = void 0;
// FL 코드 생성 헬퍼 (AI가 FL 코드를 쉽게 생성하도록)
class FLCodeBuilder {
    constructor() {
        this.lines = [];
    }
    // 기본 폼
    define(name, value) {
        this.lines.push(`(define ${name} ${value})`);
        return this;
    }
    defn(name, params, body) {
        this.lines.push(`(defn ${name} [${params.map(p => '$' + p).join(' ')}] ${body})`);
        return this;
    }
    call(fn, ...args) {
        this.lines.push(`(${fn} ${args.join(' ')})`);
        return this;
    }
    // AI 블록
    cot(goal, steps) {
        const stepStr = steps.map(s => `:step "${s}" nil`).join(' ');
        this.lines.push(`[COT :goal "${goal}" ${stepStr} :conclude identity]`);
        return this;
    }
    agent(goal, maxSteps = 5) {
        this.lines.push(`[AGENT :goal "${goal}" :max-steps ${maxSteps} :step (fn [$s] $s)]`);
        return this;
    }
    maybe(confidence, value) {
        this.lines.push(`(maybe ${confidence} ${value})`);
        return this;
    }
    result(type, value, errCode) {
        if (type === 'ok')
            this.lines.push(`(ok ${value})`);
        else
            this.lines.push(`(err "${errCode ?? 'ERROR'}" ${value})`);
        return this;
    }
    pipe(...fns) {
        this.lines.push(`(-> $data ${fns.join(' ')})`);
        return this;
    }
    comment(text) {
        this.lines.push(`; ${text}`);
        return this;
    }
    build() {
        return this.lines.join('\n');
    }
    reset() {
        this.lines = [];
        return this;
    }
    lineCount() { return this.lines.length; }
}
exports.FLCodeBuilder = FLCodeBuilder;
// FL SDK 메인 클래스
class FLSDK {
    constructor() {
        this.version = '9.0.0';
        this.features = [
            'maybe', 'cot', 'tot', 'reflect', 'context',
            'result', 'fl-try', 'use-tool', 'agent', 'self-improve',
            'memory', 'rag', 'multi-agent', 'try-reason',
            'streaming', 'quality-loop', 'tutor', 'debugger',
            'prompt-compiler'
        ];
    }
    // 코드 빌더 생성
    builder() {
        return new FLCodeBuilder();
    }
    // FL 코드 블록 만들기
    block(type, code, description) {
        return { type, code, description };
    }
    // 피처 지원 여부
    supports(feature) {
        return this.features.includes(feature);
    }
    // FL 코드 검증 (간단한 괄호 밸런스 체크)
    validate(code) {
        const errors = [];
        let depth = 0;
        for (const ch of code) {
            if (ch === '(' || ch === '[')
                depth++;
            else if (ch === ')' || ch === ']') {
                depth--;
                if (depth < 0) {
                    errors.push('Unexpected closing bracket');
                    break;
                }
            }
        }
        if (depth > 0)
            errors.push(`Unclosed brackets: ${depth}`);
        return { valid: errors.length === 0, errors };
    }
    // 빠른 스니펫 생성
    snippet(concept) {
        const snippets = {
            'maybe': '(maybe 0.8 "result")',
            'ok': '(ok 42)',
            'err': '(err "NOT_FOUND" "Item not found")',
            'cot': '[COT :step "analyze" nil :conclude identity]',
            'agent': '[AGENT :goal "task" :max-steps 5 :step (fn [$s] $s)]',
            'reflect': '[REFLECT :output $result :criteria [accuracy] :threshold 0.8]',
            'pipe': '(-> $data parse transform output)',
            'memory': '(mem-remember "key" "value")',
            'rag': '(rag-add "doc1" "content")',
        };
        return snippets[concept] ?? `; ${concept} snippet not found`;
    }
    getConfig() {
        return { version: this.version, features: [...this.features] };
    }
}
exports.FLSDK = FLSDK;
exports.sdk = new FLSDK();
exports.default = exports.sdk;
//# sourceMappingURL=fl-sdk.js.map