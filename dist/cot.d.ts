export interface ThoughtStep {
    id: string;
    thought: string;
    result: any;
    confidence?: number;
    durationMs?: number;
}
export interface CoTResult {
    steps: ThoughtStep[];
    conclusion: any;
    totalSteps: number;
    confidence?: number;
}
/**
 * ChainOfThought — AI 단계별 추론 런타임
 *
 * 사용 예:
 *   const cot = new ChainOfThought();
 *   cot.step("숫자 더하기", () => 2 + 3);
 *   cot.step("결과 두 배", () => 10);
 *   const result = cot.conclude(steps => steps[steps.length - 1].result);
 */
export declare class ChainOfThought {
    private steps;
    /**
     * 추론 단계 추가 + 즉시 실행
     * @param thought 이 단계에서 하는 생각 (설명)
     * @param fn      실행할 함수. prev는 이전 단계 결과.
     * @param confidence 선택적 확신도 (0.0~1.0)
     */
    step(thought: string, fn: (prev?: any) => any, confidence?: number): this;
    /**
     * 결론 도출 — 모든 단계 완료 후 최종 결론 계산
     * @param fn 모든 steps 배열을 받아 결론 반환
     */
    conclude(fn: (steps: ThoughtStep[]) => any): CoTResult;
    /** 현재까지 쌓인 단계 배열 반환 */
    getSteps(): ThoughtStep[];
    /**
     * 추론 과정을 마크다운으로 시각화
     */
    toMarkdown(): string;
    /** JSON 직렬화 */
    toJSON(): object;
    /** 내부 steps 초기화 (재사용용) */
    reset(): this;
}
/**
 * FL 인터프리터용 COT 폼 평가기
 *
 * FL 문법:
 *   (COT
 *     :step "질문 이해" (parse-question $input)
 *     :step "분석" (analyze $facts)
 *     :conclude (fn [$steps] (synthesize $steps)))
 *
 * - :step "설명" expr — 단계 추가 + 실행
 * - :conclude fn — 결론 도출 fn (steps 배열 받음)
 * - 각 step에서 $prev로 이전 단계 결과 참조 가능
 */
export declare function evalCotForm(args: any[], evalFn: (node: any) => any, setVar: (name: string, value: any) => void, getVar: (name: string) => any): CoTResult;
//# sourceMappingURL=cot.d.ts.map