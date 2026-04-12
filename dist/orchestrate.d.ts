export interface OrchestrateTask {
    id: string;
    input: any;
    dependsOn?: string[];
}
export interface OrchestrateAgent {
    id: string;
    run: (input: any) => any;
}
export interface OrchestrateResult {
    outputs: Record<string, any>;
    order: string[];
    duration: number;
    success: boolean;
}
export declare class Orchestrator {
    private agents;
    /** 에이전트 등록 */
    register(agent: OrchestrateAgent): void;
    /** 등록된 에이전트 ID 목록 */
    list(): string[];
    /**
     * 위상 정렬 — 의존성이 먼저 오도록 실행 순서 결정
     * 순환 의존성: visited Set으로 재방문 방지 (사이클 무시, 첫 방문 경로만 사용)
     */
    private topSort;
    /**
     * 태스크 목록 실행 — 위상 정렬 후 순서대로 실행
     * 선행 태스크의 output을 다음 태스크 input의 deps 필드에 주입
     */
    run(tasks: OrchestrateTask[]): OrchestrateResult;
    /** 실행 순서만 반환 (dry run) */
    getOrder(tasks: OrchestrateTask[]): string[];
}
/** 싱글톤 글로벌 오케스트레이터 */
export declare const globalOrchestrator: Orchestrator;
/**
 * createOrchestrateBuiltins — FL 인터프리터에 등록할 오케스트레이터 빌트인 함수
 */
export declare function createOrchestrateBuiltins(interp: {
    callFunctionValue: (fn: any, args: any[]) => any;
}): Record<string, (...args: any[]) => any>;
//# sourceMappingURL=orchestrate.d.ts.map