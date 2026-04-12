"use strict";
// FreeLang v9 Reasoning Debugger
// Phase 108: AI 추론 과정 추적 + 시각화
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReasoningTrace = void 0;
exports.createTrace = createTrace;
exports.getTrace = getTrace;
exports.deleteTrace = deleteTrace;
exports.listTraces = listTraces;
class ReasoningTrace {
    constructor(label) {
        this.stack = [];
        this.nodeCounter = 0;
        this.root = this.makeNode('thought', label);
        this.current = this.root;
    }
    makeNode(type, label, value) {
        return {
            id: `node-${++this.nodeCounter}`,
            type,
            label,
            value,
            children: [],
            depth: this.stack.length,
            timestamp: Date.now()
        };
    }
    // 새 단계 추가 (현재 노드의 자식)
    add(type, label, value) {
        const node = this.makeNode(type, label, value);
        this.current.children.push(node);
        return node;
    }
    // 들어가기 (자식으로 포커스 이동)
    enter(type, label, value) {
        const node = this.makeNode(type, label, value);
        this.current.children.push(node);
        this.stack.push(this.current);
        this.current = node;
        return node;
    }
    // 나오기 (부모로 복귀)
    exit(result) {
        if (this.stack.length > 0) {
            if (result !== undefined)
                this.current.value = result;
            this.current.duration = Date.now() - this.current.timestamp;
            this.current = this.stack.pop();
        }
    }
    // 마크다운으로 렌더링
    toMarkdown() {
        const lines = ['## Reasoning Trace', ''];
        function render(node, depth) {
            const indent = '  '.repeat(depth);
            const icon = { thought: '💭', action: '⚡', observation: '👁', decision: '🎯', error: '❌', result: '✅' }[node.type];
            const dur = node.duration ? ` (${node.duration}ms)` : '';
            const val = node.value !== undefined ? ` → \`${JSON.stringify(node.value)}\`` : '';
            lines.push(`${indent}${icon} **${node.label}**${val}${dur}`);
            node.children.forEach(c => render(c, depth + 1));
        }
        render(this.root, 0);
        return lines.join('\n');
    }
    // 텍스트 트리
    toTree() {
        const lines = [];
        function render(node, prefix, isLast) {
            const connector = isLast ? '└── ' : '├── ';
            const val = node.value !== undefined ? `: ${JSON.stringify(node.value)}` : '';
            lines.push(`${prefix}${connector}[${node.type}] ${node.label}${val}`);
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            node.children.forEach((c, i) => render(c, childPrefix, i === node.children.length - 1));
        }
        lines.push(`[root] ${this.root.label}`);
        this.root.children.forEach((c, i) => render(c, '', i === this.root.children.length - 1));
        return lines.join('\n');
    }
    getRoot() { return this.root; }
    getCurrent() { return this.current; }
    depth() { return this.stack.length; }
    nodeCount() { return this.nodeCounter; }
}
exports.ReasoningTrace = ReasoningTrace;
// 글로벌 트레이스 레지스트리
const traceRegistry = new Map();
let traceCounter = 0;
function createTrace(label) {
    const id = `trace-${++traceCounter}`;
    const trace = new ReasoningTrace(label);
    traceRegistry.set(id, trace);
    return { id, trace };
}
function getTrace(id) {
    return traceRegistry.get(id) ?? null;
}
function deleteTrace(id) {
    return traceRegistry.delete(id);
}
function listTraces() {
    return Array.from(traceRegistry.keys());
}
//# sourceMappingURL=reasoning-debugger.js.map