import { FreeLangPromise } from "./async-runtime";
interface InterpreterLike {
    eval(node: any): any;
    currentLine: number;
    currentFilePath: string;
    callDepth: number;
    context: {
        functions: Map<string, any>;
        variables: {
            push(): void;
            pop(): void;
            set(name: string, value: any): void;
            get(name: string): any;
            has(name: string): boolean;
            mutate(name: string, value: any): boolean;
            snapshot(): Map<string, any>;
            saveStack(): any;
            restoreStack(snapshot: any): void;
            fromSnapshot(snapshot: any): void;
        };
        typeChecker?: any;
        runtimeTypeChecker?: any;
    };
}
export declare function callUserFunction(interp: InterpreterLike, name: string, args: any[]): any;
export declare function callFunctionValue(interp: InterpreterLike, fn: any, args: any[]): any;
export declare function callAsyncFunctionValue(interp: InterpreterLike, fn: any, args: any[]): FreeLangPromise;
export declare function callFunction(interp: InterpreterLike, fn: any, args: any[]): any;
/**
 * callUserFunctionTCO: 꼬리 재귀를 반복문으로 변환
 * - tcoMode=true로 eval 실행 → if 꼬리 위치 함수 호출이 TailCall 토큰 반환
 * - TailCall 토큰이 반환되면 인자만 교체하고 다시 실행
 * - 1,000,000번 반복 가능 (스택 없음)
 */
export declare function callUserFunctionTCO(interp: InterpreterLike, name: string, args: any[]): any;
/**
 * callFunctionValueTCO: function-value (람다/클로저) 꼬리 재귀를 반복문으로
 */
export declare function callFunctionValueTCO(interp: InterpreterLike, fn: any, args: any[]): any;
/**
 * callUserFunctionRaw: trampoline용 — callDepth 체크 없이 단순 실행, TailCall 토큰 그대로 반환
 */
export declare function callUserFunctionRaw(interp: InterpreterLike, name: string, args: any[]): any;
/**
 * callFunctionValueRaw: trampoline용 — TailCall 토큰 그대로 반환
 */
export declare function callFunctionValueRaw(interp: InterpreterLike, fn: any, args: any[]): any;
export {};
//# sourceMappingURL=eval-call-function.d.ts.map