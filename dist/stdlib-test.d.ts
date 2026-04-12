export interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}
export interface TestReport {
    passed: number;
    failed: number;
    total: number;
    results: TestResult[];
}
/**
 * FL 네이티브 테스트 모듈 생성
 * callFn: FreeLang function value를 실제로 호출하는 콜백 (interpreter에서 주입)
 */
export declare function createTestModule(callFn: (fnValue: any, args: any[]) => any): Record<string, Function>;
//# sourceMappingURL=stdlib-test.d.ts.map