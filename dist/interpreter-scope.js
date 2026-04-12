"use strict";
// FreeLang v9: ScopeStack — 렉시컬 스코프 구현
// Phase A: Map<string,any> 단일 전역 맵 → 스코프 스택으로 교체
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeStack = void 0;
class ScopeStack {
    constructor() {
        this.stack = [new Map()];
    }
    /** 스코프 체인 역방향 탐색 — 가장 안쪽 스코프 우선 */
    get(name) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].has(name))
                return this.stack[i].get(name);
        }
        return undefined;
    }
    has(name) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].has(name))
                return true;
        }
        return false;
    }
    /** 현재 스코프에 새 바인딩 생성 */
    set(name, val) {
        this.stack[this.stack.length - 1].set(name, val);
    }
    /** 전역(최상위) 스코프에 직접 저장 — 최상위 define용 */
    setGlobal(name, val) {
        this.stack[0].set(name, val);
    }
    /** set!용: 스코프 체인에서 기존 바인딩을 찾아 수정, 없으면 false 반환 */
    mutate(name, val) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].has(name)) {
                this.stack[i].set(name, val);
                return true;
            }
        }
        return false;
    }
    /** 새 함수 스코프 시작 */
    push() {
        this.stack.push(new Map());
    }
    /** 함수 스코프 종료 */
    pop() {
        if (this.stack.length > 1)
            this.stack.pop();
    }
    /** 클로저 캡처용: 현재 스코프 체인 전체를 단일 Map으로 병합 */
    snapshot() {
        const merged = new Map();
        for (const scope of this.stack) {
            for (const [k, v] of scope)
                merged.set(k, v);
        }
        return merged;
    }
    /** 스냅샷 Map으로 스택을 새로 초기화 (callFunctionValue용) */
    fromSnapshot(snap) {
        this.stack = [new Map(snap)];
    }
    /** 전체 스택 저장 (callFunctionValue 복원용) */
    saveStack() {
        return this.stack.map((s) => new Map(s));
    }
    /** 저장된 스택으로 복원 */
    restoreStack(saved) {
        this.stack = saved;
    }
    /** 가장 안쪽 스코프에서 이름 삭제 */
    delete(name) {
        for (let i = this.stack.length - 1; i >= 0; i--) {
            if (this.stack[i].has(name)) {
                this.stack[i].delete(name);
                return;
            }
        }
    }
}
exports.ScopeStack = ScopeStack;
//# sourceMappingURL=interpreter-scope.js.map