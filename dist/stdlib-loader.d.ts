interface InterpreterLike {
    registerModule(module: Record<string, unknown>): void;
    callUserFunction(name: string, args: any[]): any;
    callFunctionValue(fnValue: any, args: any[]): any;
}
/**
 * 20개 stdlib 모듈을 interpreter에 등록
 * interpreter.ts constructor 대신 이 함수 한 줄로 호출
 */
export declare function loadAllStdlib(interp: InterpreterLike): void;
export {};
//# sourceMappingURL=stdlib-loader.d.ts.map