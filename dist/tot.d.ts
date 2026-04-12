export interface ThoughtBranch {
    id: string;
    hypothesis: string;
    result: any;
    score: number;
    pruned: boolean;
}
export interface ToTResult {
    branches: ThoughtBranch[];
    best: ThoughtBranch;
    explored: number;
    pruned: number;
}
export declare class TreeOfThought {
    private _branches;
    private _scoreFn;
    private _pruneThreshold;
    private _executed;
    /**
     * 분기 추가: 가설 이름과 실행 함수
     */
    branch(hypothesis: string, fn: () => any): this;
    /**
     * 점수 함수 등록: result → 0~1 점수
     */
    evaluate(scoreFn: (result: any) => number): this;
    /**
     * 가지치기 임계값 설정: threshold 이하 점수는 pruned = true
     */
    prune(threshold: number): this;
    /**
     * 탐색 실행 후 결과 선택
     * strategy: 'best' = 최고 점수 하나, 'top-k' = 상위 k개
     */
    select(strategy?: 'best' | 'top-k', k?: number): ToTResult;
    /**
     * 분기 트리를 Markdown으로 시각화
     */
    toMarkdown(): string;
}
/**
 * [TOT
 *   :branch "가설A" (approach-a $problem)
 *   :branch "가설B" (approach-b $problem)
 *   :eval (fn [$result] (score-quality $result))
 *   :prune 0.3
 *   :select best]
 *
 * evalTotBlock(interp, block) → ToTResult
 */
export declare function evalTotBlock(interp: any, // Interpreter — circular import 방지를 위해 any
block: any): ToTResult;
//# sourceMappingURL=tot.d.ts.map