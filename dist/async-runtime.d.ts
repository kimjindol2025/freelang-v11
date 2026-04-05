export type PromiseState = "pending" | "resolved" | "rejected";
export declare class FreeLangPromise {
    private state;
    private value;
    private error;
    private resolvers;
    private rejecters;
    constructor(executor: (resolve: (value: any) => void, reject: (error: Error) => void) => void);
    /**
     * Promise 상태 확인
     */
    getState(): PromiseState;
    /**
     * Promise 값 추출 (resolved 상태일 때만)
     */
    getValue(): any;
    /**
     * Promise 에러 추출 (rejected 상태일 때만)
     */
    getError(): Error | null;
    /**
     * resolve 핸들러 호출
     */
    resolve(value: any): void;
    /**
     * reject 핸들러 호출
     */
    reject(error: Error): void;
    /**
     * Promise 체이닝: then 메서드
     * onFulfilled가 성공했을 때 호출되고, 새로운 Promise 반환
     */
    then(onFulfilled: (value: any) => any): FreeLangPromise;
    /**
     * Promise 에러 처리: catch 메서드
     * onRejected가 에러일 때 호출되고, 새로운 Promise 반환
     */
    catch(onRejected: (error: Error) => any): FreeLangPromise;
    /**
     * finally 메서드: 성공/실패 상관없이 항상 실행
     */
    finally(onFinally: () => void): FreeLangPromise;
    /**
     * 모든 Promise가 완료될 때까지 대기
     */
    static all(promises: FreeLangPromise[]): FreeLangPromise;
    /**
     * 첫 번째로 완료된 Promise 반환
     */
    static race(promises: FreeLangPromise[]): FreeLangPromise;
}
/**
 * 즉시 resolve되는 Promise 생성
 */
export declare function resolvedPromise(value: any): FreeLangPromise;
/**
 * 즉시 reject되는 Promise 생성
 */
export declare function rejectedPromise(error: Error): FreeLangPromise;
/**
 * 지연된 Promise 생성 (setTimeout 스타일)
 */
export declare function delayedPromise(ms: number, value: any): FreeLangPromise;
//# sourceMappingURL=async-runtime.d.ts.map