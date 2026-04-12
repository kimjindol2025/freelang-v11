export interface CIStep {
    name: string;
    run: () => Promise<CIResult>;
}
export interface CIResult {
    passed: boolean;
    output: string;
    durationMs: number;
}
export interface CIStepResult {
    name: string;
    passed: boolean;
    output: string;
    durationMs: number;
    skipped: boolean;
}
export interface CISummary {
    passed: boolean;
    steps: CIStepResult[];
    totalMs: number;
}
export declare class CIPipeline {
    private steps;
    private failFast;
    constructor(opts?: {
        failFast?: boolean;
    });
    setFailFast(value: boolean): this;
    addStep(step: CIStep): this;
    run(): Promise<CISummary>;
}
/**
 * fmt-check step: 파일들이 이미 포맷됐는지 확인
 */
export declare function createFmtCheckStep(files: string[]): CIStep;
/**
 * lint step: linter 실행, error 있으면 실패
 */
export declare function createLintStep(files: string[]): CIStep;
/**
 * type-check step: npx tsc --noEmit
 */
export declare function createTypeCheckStep(): CIStep;
/**
 * test step: ts-node로 테스트 파일 실행
 */
export declare function createTestStep(testFile: string): CIStep;
/**
 * 기본 CI 파이프라인 생성:
 * 1. fmt-check
 * 2. lint
 * 3. type-check
 */
export declare function createDefaultPipeline(files: string[], opts?: {
    failFast?: boolean;
}): CIPipeline;
//# sourceMappingURL=ci-runner.d.ts.map