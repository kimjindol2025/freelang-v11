export type TraceNodeType = 'thought' | 'action' | 'observation' | 'decision' | 'error' | 'result';
export interface TraceNode {
    id: string;
    type: TraceNodeType;
    label: string;
    value?: any;
    children: TraceNode[];
    depth: number;
    timestamp: number;
    duration?: number;
}
export declare class ReasoningTrace {
    private root;
    private current;
    private stack;
    private nodeCounter;
    constructor(label: string);
    private makeNode;
    add(type: TraceNodeType, label: string, value?: any): TraceNode;
    enter(type: TraceNodeType, label: string, value?: any): TraceNode;
    exit(result?: any): void;
    toMarkdown(): string;
    toTree(): string;
    getRoot(): TraceNode;
    getCurrent(): TraceNode;
    depth(): number;
    nodeCount(): number;
}
export declare function createTrace(label: string): {
    id: string;
    trace: ReasoningTrace;
};
export declare function getTrace(id: string): ReasoningTrace | null;
export declare function deleteTrace(id: string): boolean;
export declare function listTraces(): string[];
//# sourceMappingURL=reasoning-debugger.d.ts.map