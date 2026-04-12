"use strict";
// FreeLang v9 Crossover — 두 해법 교배
// Phase 133: [CROSSOVER] 유전 알고리즘 기반 교배 연산자
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalCrossover = exports.Crossover = void 0;
exports.crossoverNumbers = crossoverNumbers;
exports.crossoverStrings = crossoverStrings;
class Crossover {
    constructor(config) {
        this.config = {
            type: config?.type ?? 'single-point',
            rate: config?.rate ?? 0.7,
            blendAlpha: config?.blendAlpha ?? 0.5,
        };
    }
    // 단일점 교배 (배열)
    singlePoint(a, b) {
        const len = Math.min(a.length, b.length);
        const point = len <= 1 ? 0 : Math.floor(Math.random() * (len - 1)) + 1;
        const child1 = [...a.slice(0, point), ...b.slice(point)];
        const child2 = [...b.slice(0, point), ...a.slice(point)];
        // 길이 맞추기
        while (child1.length < a.length)
            child1.push(a[child1.length]);
        while (child2.length < b.length)
            child2.push(b[child2.length]);
        return {
            parent1: [...a],
            parent2: [...b],
            child1: child1.slice(0, a.length),
            child2: child2.slice(0, b.length),
            crossoverPoint: point,
            type: 'single-point',
        };
    }
    // 두 점 교배 (배열)
    twoPoint(a, b) {
        const len = Math.min(a.length, b.length);
        let p1 = len <= 2 ? 0 : Math.floor(Math.random() * (len - 1));
        let p2 = len <= 2 ? len : Math.floor(Math.random() * (len - p1 - 1)) + p1 + 1;
        if (p1 >= p2) {
            p2 = Math.min(p1 + 1, len);
        }
        const child1 = [
            ...a.slice(0, p1),
            ...b.slice(p1, p2),
            ...a.slice(p2),
        ];
        const child2 = [
            ...b.slice(0, p1),
            ...a.slice(p1, p2),
            ...b.slice(p2),
        ];
        return {
            parent1: [...a],
            parent2: [...b],
            child1: child1.slice(0, a.length),
            child2: child2.slice(0, b.length),
            crossoverPoints: [p1, p2],
            type: 'two-point',
        };
    }
    // 균등 교배 (각 요소를 50% 확률로 선택)
    uniform(a, b) {
        const len = Math.max(a.length, b.length);
        const child1 = [];
        const child2 = [];
        for (let i = 0; i < len; i++) {
            const ai = i < a.length ? a[i] : b[i];
            const bi = i < b.length ? b[i] : a[i];
            if (Math.random() < 0.5) {
                child1.push(ai);
                child2.push(bi);
            }
            else {
                child1.push(bi);
                child2.push(ai);
            }
        }
        return {
            parent1: [...a],
            parent2: [...b],
            child1: child1.slice(0, a.length),
            child2: child2.slice(0, b.length),
            type: 'uniform',
        };
    }
    // 산술 교배 (숫자 배열: alpha*a + (1-alpha)*b)
    arithmetic(a, b, alpha) {
        const al = alpha ?? this.config.blendAlpha ?? 0.5;
        const child1 = a.map((v, i) => al * v + (1 - al) * (b[i] ?? 0));
        const child2 = a.map((v, i) => (1 - al) * v + al * (b[i] ?? 0));
        return {
            parent1: [...a],
            parent2: [...b],
            child1,
            child2,
            type: 'arithmetic',
        };
    }
    // 문자열 교배 (단일점)
    crossoverStrings(a, b) {
        const aArr = a.split('');
        const bArr = b.split('');
        const result = this.singlePoint(aArr, bArr);
        return {
            parent1: a,
            parent2: b,
            child1: result.child1.join(''),
            child2: result.child2.join(''),
            crossoverPoint: result.crossoverPoint,
            type: 'single-point',
        };
    }
    // 객체 교배 (키 기반)
    crossoverObjects(a, b) {
        const allKeys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
        const child1 = {};
        const child2 = {};
        for (const key of allKeys) {
            if (Math.random() < 0.5) {
                child1[key] = key in a ? a[key] : b[key];
                child2[key] = key in b ? b[key] : a[key];
            }
            else {
                child1[key] = key in b ? b[key] : a[key];
                child2[key] = key in a ? a[key] : b[key];
            }
        }
        return {
            parent1: { ...a },
            parent2: { ...b },
            child1,
            child2,
            type: 'uniform',
        };
    }
    // 자동 교배 (타입 감지)
    cross(a, b) {
        if (Array.isArray(a) && Array.isArray(b)) {
            const isNumeric = a.every((v) => typeof v === 'number');
            if (isNumeric) {
                return this.arithmetic(a, b);
            }
            const result = this.singlePoint(a, b);
            return result;
        }
        if (typeof a === 'string' && typeof b === 'string') {
            return this.crossoverStrings(a, b);
        }
        if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
            return this.crossoverObjects(a, b);
        }
        // 기본: arithmetic for numbers
        if (typeof a === 'number' && typeof b === 'number') {
            const alpha = this.config.blendAlpha ?? 0.5;
            return {
                parent1: a,
                parent2: b,
                child1: (alpha * a + (1 - alpha) * b),
                child2: ((1 - alpha) * a + alpha * b),
                type: 'arithmetic',
            };
        }
        // fallback
        return {
            parent1: a,
            parent2: b,
            child1: a,
            child2: b,
            type: this.config.type,
        };
    }
}
exports.Crossover = Crossover;
exports.globalCrossover = new Crossover();
function crossoverNumbers(a, b) {
    return exports.globalCrossover.arithmetic(a, b);
}
function crossoverStrings(a, b) {
    return exports.globalCrossover.crossoverStrings(a, b);
}
//# sourceMappingURL=crossover.js.map