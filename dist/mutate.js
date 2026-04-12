"use strict";
// mutate.ts — FreeLang v9 Phase 132: [MUTATE] 코드 변이 + 선택
// AI가 해법을 변이시켜 탐색 공간을 확장한다
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalMutator = exports.Mutator = void 0;
exports.mutateNumbers = mutateNumbers;
exports.mutateString = mutateString;
exports.selectBest = selectBest;
const DEFAULT_CONFIG = {
    rate: 0.1,
    strength: 0.1,
    type: 'random',
};
// 문자 집합 (문자열 변이용)
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
class Mutator {
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    getConfig() {
        return { ...this.config };
    }
    // 숫자 배열 변이
    mutateNumbers(arr) {
        const original = [...arr];
        const mutated = [...arr];
        let mutations = 0;
        const type = this.config.type;
        if (type === 'swap') {
            return this.swapMutation(arr);
        }
        if (type === 'flip') {
            return this.flipMutation(arr);
        }
        for (let i = 0; i < mutated.length; i++) {
            if (Math.random() < this.config.rate) {
                if (type === 'gaussian') {
                    // Gaussian 변이: Box-Muller 변환
                    const u1 = Math.random();
                    const u2 = Math.random();
                    const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                    mutated[i] = mutated[i] + gaussian * this.config.strength * (Math.abs(mutated[i]) || 1);
                }
                else {
                    // random 변이: strength 범위 내 랜덤 변화
                    const delta = (Math.random() * 2 - 1) * this.config.strength * (Math.abs(mutated[i]) || 1);
                    mutated[i] = mutated[i] + delta;
                }
                mutations++;
            }
        }
        return { original, mutated, mutations, mutationType: type };
    }
    // 문자열 변이
    mutateString(s) {
        const original = s;
        const type = this.config.type;
        let mutated = s;
        let mutations = 0;
        if (type === 'insert') {
            // 문자 삽입
            const chars = s.split('');
            const newChars = [];
            for (let i = 0; i < chars.length; i++) {
                newChars.push(chars[i]);
                if (Math.random() < this.config.rate) {
                    const randChar = CHARS[Math.floor(Math.random() * CHARS.length)];
                    newChars.push(randChar);
                    mutations++;
                }
            }
            mutated = newChars.join('');
        }
        else if (type === 'delete') {
            // 문자 삭제
            const chars = s.split('');
            const kept = [];
            for (const ch of chars) {
                if (Math.random() < this.config.rate) {
                    mutations++;
                    // skip (delete)
                }
                else {
                    kept.push(ch);
                }
            }
            mutated = kept.join('');
        }
        else if (type === 'swap') {
            // 인접 문자 교환
            const chars = s.split('');
            for (let i = 0; i < chars.length - 1; i++) {
                if (Math.random() < this.config.rate) {
                    const tmp = chars[i];
                    chars[i] = chars[i + 1];
                    chars[i + 1] = tmp;
                    mutations++;
                    i++; // 교환 후 다음 위치 건너뜀
                }
            }
            mutated = chars.join('');
        }
        else {
            // random/replace: 문자 치환
            const chars = s.split('');
            for (let i = 0; i < chars.length; i++) {
                if (Math.random() < this.config.rate) {
                    chars[i] = CHARS[Math.floor(Math.random() * CHARS.length)];
                    mutations++;
                }
            }
            mutated = chars.join('');
        }
        return { original, mutated, mutations, mutationType: type };
    }
    // 제네릭 객체 변이 (JSON-safe)
    mutateObject(obj) {
        const original = JSON.parse(JSON.stringify(obj));
        const mutated = JSON.parse(JSON.stringify(obj));
        let mutations = 0;
        const type = this.config.type;
        for (const key of Object.keys(mutated)) {
            if (Math.random() < this.config.rate) {
                const val = mutated[key];
                if (typeof val === 'number') {
                    const delta = (Math.random() * 2 - 1) * this.config.strength * (Math.abs(val) || 1);
                    mutated[key] = val + delta;
                    mutations++;
                }
                else if (typeof val === 'string') {
                    // 문자열 값: 랜덤 문자 하나 치환
                    if (val.length > 0) {
                        const pos = Math.floor(Math.random() * val.length);
                        const newChar = CHARS[Math.floor(Math.random() * CHARS.length)];
                        mutated[key] = val.slice(0, pos) + newChar + val.slice(pos + 1);
                        mutations++;
                    }
                }
                else if (typeof val === 'boolean') {
                    mutated[key] = !val;
                    mutations++;
                }
            }
        }
        return { original, mutated, mutations, mutationType: type };
    }
    // 배열 요소 교환 (swap mutation)
    swapMutation(arr) {
        const original = [...arr];
        const mutated = [...arr];
        let mutations = 0;
        for (let i = 0; i < mutated.length - 1; i++) {
            if (Math.random() < this.config.rate) {
                const j = Math.floor(Math.random() * (mutated.length - i - 1)) + i + 1;
                const tmp = mutated[i];
                mutated[i] = mutated[j];
                mutated[j] = tmp;
                mutations++;
            }
        }
        return { original, mutated, mutations, mutationType: 'swap' };
    }
    // 비트 플립 (0 ↔ 1)
    flipMutation(bits) {
        const original = [...bits];
        const mutated = [...bits];
        let mutations = 0;
        for (let i = 0; i < mutated.length; i++) {
            if (Math.random() < this.config.rate) {
                mutated[i] = mutated[i] === 0 ? 1 : 0;
                mutations++;
            }
        }
        return { original, mutated, mutations, mutationType: 'flip' };
    }
    // 적합도 기반 선택 (높은 적합도 우선)
    select(candidates, n) {
        const sorted = [...candidates].sort((a, b) => b.fitness - a.fitness);
        return sorted.slice(0, n).map(c => c.value);
    }
}
exports.Mutator = Mutator;
// 전역 싱글톤 변이기
exports.globalMutator = new Mutator();
// 편의 함수
function mutateNumbers(arr, rate = 0.1) {
    const m = new Mutator({ rate });
    return m.mutateNumbers(arr);
}
function mutateString(s, rate = 0.1) {
    const m = new Mutator({ rate });
    return m.mutateString(s);
}
function selectBest(items, ratio = 0.5) {
    const n = Math.max(1, Math.round(items.length * ratio));
    return exports.globalMutator.select(items, n);
}
//# sourceMappingURL=mutate.js.map