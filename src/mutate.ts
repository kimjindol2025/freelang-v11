// mutate.ts — FreeLang v9 Phase 132: [MUTATE] 코드 변이 + 선택
// AI가 해법을 변이시켜 탐색 공간을 확장한다

export type MutationType = 'random' | 'gaussian' | 'swap' | 'flip' | 'insert' | 'delete' | 'replace';

export interface MutationConfig {
  rate: number;      // 변이율 (0~1)
  strength: number;  // 변이 강도 (기본 0.1)
  type: MutationType;
}

export interface MutationResult<T> {
  original: T;
  mutated: T;
  mutations: number;       // 실제 변이 발생 횟수
  mutationType: MutationType;
}

const DEFAULT_CONFIG: MutationConfig = {
  rate: 0.1,
  strength: 0.1,
  type: 'random',
};

// 문자 집합 (문자열 변이용)
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class Mutator<T> {
  private config: MutationConfig;

  constructor(config?: Partial<MutationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getConfig(): MutationConfig {
    return { ...this.config };
  }

  // 숫자 배열 변이
  mutateNumbers(arr: number[]): MutationResult<number[]> {
    const original = [...arr];
    const mutated = [...arr];
    let mutations = 0;
    const type = this.config.type;

    if (type === 'swap') {
      return this.swapMutation(arr) as unknown as MutationResult<number[]>;
    }

    if (type === 'flip') {
      return this.flipMutation(arr as unknown as number[]) as unknown as MutationResult<number[]>;
    }

    for (let i = 0; i < mutated.length; i++) {
      if (Math.random() < this.config.rate) {
        if (type === 'gaussian') {
          // Gaussian 변이: Box-Muller 변환
          const u1 = Math.random();
          const u2 = Math.random();
          const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          mutated[i] = mutated[i] + gaussian * this.config.strength * (Math.abs(mutated[i]) || 1);
        } else {
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
  mutateString(s: string): MutationResult<string> {
    const original = s;
    const type = this.config.type;
    let mutated = s;
    let mutations = 0;

    if (type === 'insert') {
      // 문자 삽입
      const chars = s.split('');
      const newChars: string[] = [];
      for (let i = 0; i < chars.length; i++) {
        newChars.push(chars[i]);
        if (Math.random() < this.config.rate) {
          const randChar = CHARS[Math.floor(Math.random() * CHARS.length)];
          newChars.push(randChar);
          mutations++;
        }
      }
      mutated = newChars.join('');
    } else if (type === 'delete') {
      // 문자 삭제
      const chars = s.split('');
      const kept: string[] = [];
      for (const ch of chars) {
        if (Math.random() < this.config.rate) {
          mutations++;
          // skip (delete)
        } else {
          kept.push(ch);
        }
      }
      mutated = kept.join('');
    } else if (type === 'swap') {
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
    } else {
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
  mutateObject(obj: Record<string, unknown>): MutationResult<Record<string, unknown>> {
    const original: Record<string, unknown> = JSON.parse(JSON.stringify(obj));
    const mutated: Record<string, unknown> = JSON.parse(JSON.stringify(obj));
    let mutations = 0;
    const type = this.config.type;

    for (const key of Object.keys(mutated)) {
      if (Math.random() < this.config.rate) {
        const val = mutated[key];
        if (typeof val === 'number') {
          const delta = (Math.random() * 2 - 1) * this.config.strength * (Math.abs(val) || 1);
          mutated[key] = val + delta;
          mutations++;
        } else if (typeof val === 'string') {
          // 문자열 값: 랜덤 문자 하나 치환
          if (val.length > 0) {
            const pos = Math.floor(Math.random() * val.length);
            const newChar = CHARS[Math.floor(Math.random() * CHARS.length)];
            mutated[key] = val.slice(0, pos) + newChar + val.slice(pos + 1);
            mutations++;
          }
        } else if (typeof val === 'boolean') {
          mutated[key] = !val;
          mutations++;
        }
      }
    }

    return { original, mutated, mutations, mutationType: type };
  }

  // 배열 요소 교환 (swap mutation)
  swapMutation<U>(arr: U[]): MutationResult<U[]> {
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
  flipMutation(bits: number[]): MutationResult<number[]> {
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
  select<U>(candidates: Array<{ value: U; fitness: number }>, n: number): U[] {
    const sorted = [...candidates].sort((a, b) => b.fitness - a.fitness);
    return sorted.slice(0, n).map(c => c.value);
  }
}

// 전역 싱글톤 변이기
export const globalMutator: Mutator<unknown> = new Mutator<unknown>();

// 편의 함수
export function mutateNumbers(arr: number[], rate = 0.1): MutationResult<number[]> {
  const m = new Mutator<number[]>({ rate });
  return m.mutateNumbers(arr);
}

export function mutateString(s: string, rate = 0.1): MutationResult<string> {
  const m = new Mutator<string>({ rate });
  return m.mutateString(s);
}

export function selectBest<T>(items: Array<{ value: T; fitness: number }>, ratio = 0.5): T[] {
  const n = Math.max(1, Math.round(items.length * ratio));
  return globalMutator.select(items, n) as T[];
}
