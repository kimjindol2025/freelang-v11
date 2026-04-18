// FreeLang v9 Reasoning Debugger
// Phase 108: AI 추론 과정 추적 + 시각화

export type TraceNodeType = 'thought' | 'action' | 'observation' | 'decision' | 'error' | 'result';

export interface TraceNode {
  id: string;
  type: TraceNodeType;
  label: string;
  value?: any;
  children: TraceNode[];
  depth: number;
  timestamp: number;
  duration?: number;  // ms
}

export class ReasoningTrace {
  private root: TraceNode;
  private current: TraceNode;
  private stack: TraceNode[] = [];
  private nodeCounter = 0;

  constructor(label: string) {
    this.root = this.makeNode('thought', label);
    this.current = this.root;
  }

  private makeNode(type: TraceNodeType, label: string, value?: any): TraceNode {
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
  add(type: TraceNodeType, label: string, value?: any): TraceNode {
    const node = this.makeNode(type, label, value);
    this.current.children.push(node);
    return node;
  }

  // 들어가기 (자식으로 포커스 이동)
  enter(type: TraceNodeType, label: string, value?: any): TraceNode {
    const node = this.makeNode(type, label, value);
    this.current.children.push(node);
    this.stack.push(this.current);
    this.current = node;
    return node;
  }

  // 나오기 (부모로 복귀)
  exit(result?: any): void {
    if (this.stack.length > 0) {
      if (result !== undefined) this.current.value = result;
      this.current.duration = Date.now() - this.current.timestamp;
      this.current = this.stack.pop()!;
    }
  }

  // 마크다운으로 렌더링
  toMarkdown(): string {
    const lines: string[] = ['## Reasoning Trace', ''];
    function render(node: TraceNode, depth: number) {
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
  toTree(): string {
    const lines: string[] = [];
    function render(node: TraceNode, prefix: string, isLast: boolean) {
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

  getRoot(): TraceNode { return this.root; }
  getCurrent(): TraceNode { return this.current; }
  depth(): number { return this.stack.length; }
  nodeCount(): number { return this.nodeCounter; }
}

// 글로벌 트레이스 레지스트리
const traceRegistry = new Map<string, ReasoningTrace>();
let traceCounter = 0;

export function createTrace(label: string): { id: string; trace: ReasoningTrace } {
  const id = `trace-${++traceCounter}`;
  const trace = new ReasoningTrace(label);
  traceRegistry.set(id, trace);
  return { id, trace };
}

export function getTrace(id: string): ReasoningTrace | null {
  return traceRegistry.get(id) ?? null;
}

export function deleteTrace(id: string): boolean {
  return traceRegistry.delete(id);
}

export function listTraces(): string[] {
  return Array.from(traceRegistry.keys());
}
