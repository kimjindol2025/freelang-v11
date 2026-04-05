"use strict";
// Phase 7: Async Runtime
// FreeLangPromise 구현 - 상태 관리 및 핸들러
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreeLangPromise = void 0;
exports.resolvedPromise = resolvedPromise;
exports.rejectedPromise = rejectedPromise;
exports.delayedPromise = delayedPromise;
class FreeLangPromise {
    constructor(executor) {
        this.state = "pending";
        this.value = undefined;
        this.error = null;
        this.resolvers = [];
        this.rejecters = [];
        try {
            executor(this.resolve.bind(this), this.reject.bind(this));
        }
        catch (e) {
            this.reject(e);
        }
    }
    /**
     * Promise 상태 확인
     */
    getState() {
        return this.state;
    }
    /**
     * Promise 값 추출 (resolved 상태일 때만)
     */
    getValue() {
        if (this.state === "resolved") {
            return this.value;
        }
        throw new Error("Cannot get value from non-resolved Promise");
    }
    /**
     * Promise 에러 추출 (rejected 상태일 때만)
     */
    getError() {
        if (this.state === "rejected") {
            return this.error;
        }
        return null;
    }
    /**
     * resolve 핸들러 호출
     */
    resolve(value) {
        if (this.state !== "pending")
            return;
        this.state = "resolved";
        this.value = value;
        // 모든 대기 중인 resolver 실행
        for (const resolver of this.resolvers) {
            try {
                resolver(value);
            }
            catch (e) {
                // resolver 실행 중 에러는 무시
            }
        }
        this.resolvers = [];
    }
    /**
     * reject 핸들러 호출
     */
    reject(error) {
        if (this.state !== "pending")
            return;
        this.state = "rejected";
        this.error = error;
        // 모든 대기 중인 rejecter 실행
        for (const rejecter of this.rejecters) {
            try {
                rejecter(error);
            }
            catch (e) {
                // rejecter 실행 중 에러는 무시
            }
        }
        this.rejecters = [];
    }
    /**
     * Promise 체이닝: then 메서드
     * onFulfilled가 성공했을 때 호출되고, 새로운 Promise 반환
     */
    then(onFulfilled) {
        return new FreeLangPromise((resolve, reject) => {
            if (this.state === "resolved") {
                try {
                    const result = onFulfilled(this.value);
                    resolve(result);
                }
                catch (e) {
                    reject(e);
                }
            }
            else if (this.state === "rejected") {
                reject(this.error);
            }
            else {
                // pending 상태: resolver 등록
                this.resolvers.push((value) => {
                    try {
                        const result = onFulfilled(value);
                        resolve(result);
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            }
        });
    }
    /**
     * Promise 에러 처리: catch 메서드
     * onRejected가 에러일 때 호출되고, 새로운 Promise 반환
     */
    catch(onRejected) {
        return new FreeLangPromise((resolve, reject) => {
            if (this.state === "rejected") {
                try {
                    const result = onRejected(this.error);
                    resolve(result);
                }
                catch (e) {
                    reject(e);
                }
            }
            else if (this.state === "resolved") {
                resolve(this.value);
            }
            else {
                // pending 상태: rejecter 등록
                this.rejecters.push((error) => {
                    try {
                        const result = onRejected(error);
                        resolve(result);
                    }
                    catch (e) {
                        reject(e);
                    }
                });
            }
        });
    }
    /**
     * finally 메서드: 성공/실패 상관없이 항상 실행
     */
    finally(onFinally) {
        return new FreeLangPromise((resolve, reject) => {
            const executeFinally = () => {
                try {
                    onFinally();
                }
                catch (e) {
                    reject(e);
                    return;
                }
                if (this.state === "resolved") {
                    resolve(this.value);
                }
                else if (this.state === "rejected") {
                    reject(this.error);
                }
            };
            if (this.state !== "pending") {
                executeFinally();
            }
            else {
                this.resolvers.push(() => executeFinally());
                this.rejecters.push(() => executeFinally());
            }
        });
    }
    /**
     * 모든 Promise가 완료될 때까지 대기
     */
    static all(promises) {
        return new FreeLangPromise((resolve, reject) => {
            if (promises.length === 0) {
                resolve([]);
                return;
            }
            const results = [];
            let completedCount = 0;
            for (let i = 0; i < promises.length; i++) {
                const promise = promises[i];
                if (promise.state === "resolved") {
                    results[i] = promise.value;
                    completedCount++;
                }
                else if (promise.state === "rejected") {
                    reject(promise.error);
                    return;
                }
                else {
                    // pending: then/catch 등록
                    promise
                        .then((value) => {
                        results[i] = value;
                        completedCount++;
                        if (completedCount === promises.length) {
                            resolve(results);
                        }
                    })
                        .catch((error) => reject(error));
                }
            }
            if (completedCount === promises.length) {
                resolve(results);
            }
        });
    }
    /**
     * 첫 번째로 완료된 Promise 반환
     */
    static race(promises) {
        return new FreeLangPromise((resolve, reject) => {
            for (const promise of promises) {
                if (promise.state === "resolved") {
                    resolve(promise.value);
                    return;
                }
                else if (promise.state === "rejected") {
                    reject(promise.error);
                    return;
                }
                else {
                    promise
                        .then((value) => resolve(value))
                        .catch((error) => reject(error));
                }
            }
        });
    }
}
exports.FreeLangPromise = FreeLangPromise;
/**
 * 즉시 resolve되는 Promise 생성
 */
function resolvedPromise(value) {
    return new FreeLangPromise((resolve) => {
        resolve(value);
    });
}
/**
 * 즉시 reject되는 Promise 생성
 */
function rejectedPromise(error) {
    return new FreeLangPromise((_, reject) => {
        reject(error);
    });
}
/**
 * 지연된 Promise 생성 (setTimeout 스타일)
 */
function delayedPromise(ms, value) {
    return new FreeLangPromise((resolve) => {
        setTimeout(() => {
            resolve(value);
        }, ms);
    });
}
//# sourceMappingURL=async-runtime.js.map