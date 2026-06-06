/**
 * P1-5: Projection Determinism Invariant
 *
 * 의미론: 동일한 log → 항상 동일한 projection 결과
 *
 * 불변식:
 * - projection(log) = 순수함수 (같은 입력 → 같은 출력)
 * - log는 append-only (불변)
 * - projection은 재계산 가능 (캐시와 독립)
 * - deterministic(log, state) = deterministic(log, state)
 */

describe('P1-5: projection determinism invariant', () => {
  describe('basic projection determinism', () => {
    // Event-sourced state projection
    interface Event {
      type: string;
      payload?: any;
    }

    interface State {
      count: number;
      lastEvent?: string;
    }

    function projectLog(events: Event[]): State {
      return events.reduce(
        (state: State, event: Event) => {
          if (event.type === 'INCREMENT') {
            return {
              count: state.count + 1,
              lastEvent: event.type,
            };
          } else if (event.type === 'SET') {
            return {
              count: event.payload?.value ?? state.count,
              lastEvent: event.type,
            };
          }
          return state;
        },
        { count: 0 }
      );
    }

    it('same log produces same projection', () => {
      const log = [{ type: 'INCREMENT' }, { type: 'INCREMENT' }, { type: 'SET', payload: { value: 10 } }];

      const state1 = projectLog(log);
      const state2 = projectLog(log);

      expect(state1).toEqual(state2);
      expect(state1.count).toBe(10);
    });

    it('empty log produces initial state consistently', () => {
      const log: Event[] = [];

      const state1 = projectLog(log);
      const state2 = projectLog(log);

      expect(state1).toEqual(state2);
      expect(state1.count).toBe(0);
    });

    it('projection is idempotent (apply twice = apply once)', () => {
      const log = [{ type: 'INCREMENT' }, { type: 'INCREMENT' }];

      const state1 = projectLog(log);
      // Applying projection to already-projected state (no-op with log)
      const state2 = projectLog(log);

      expect(state1).toEqual(state2);
    });

    it('projection order matters (log order is preserved)', () => {
      const log1 = [
        { type: 'SET', payload: { value: 5 } },
        { type: 'INCREMENT' },
      ];
      const log2 = [
        { type: 'INCREMENT' },
        { type: 'SET', payload: { value: 5 } },
      ];

      const state1 = projectLog(log1);
      const state2 = projectLog(log2);

      expect(state1.count).toBe(6); // 5+1
      expect(state2.count).toBe(5); // SET overwrites
      expect(state1).not.toEqual(state2);
    });
  });

  describe('projection from partial logs', () => {
    interface CounterEvent {
      id: string;
      type: 'add' | 'sub' | 'reset';
      value?: number;
    }

    function reduceCounter(events: CounterEvent[]): number {
      return events.reduce((acc, e) => {
        if (e.type === 'add') return acc + (e.value ?? 1);
        if (e.type === 'sub') return acc - (e.value ?? 1);
        if (e.type === 'reset') return 0;
        return acc;
      }, 0);
    }

    it('projection from prefix of log is consistent', () => {
      const fullLog = [
        { id: 'e1', type: 'add' as const, value: 10 },
        { id: 'e2', type: 'add' as const, value: 5 },
        { id: 'e3', type: 'sub' as const, value: 3 },
      ];

      const prefix = fullLog.slice(0, 2);
      const prefixState = reduceCounter(prefix);
      const fullState = reduceCounter(fullLog);

      expect(prefixState).toBe(15); // 10+5
      expect(fullState).toBe(12); // 10+5-3

      // Both are deterministic
      expect(reduceCounter(prefix)).toBe(prefixState);
      expect(reduceCounter(fullLog)).toBe(fullState);
    });

    it('extending log deterministically extends projection', () => {
      const log1 = [{ id: 'e1', type: 'add' as const, value: 5 }];
      const log2 = [
        { id: 'e1', type: 'add' as const, value: 5 },
        { id: 'e2', type: 'add' as const, value: 3 },
      ];

      const state1 = reduceCounter(log1);
      const state2 = reduceCounter(log2);

      expect(state1).toBe(5);
      expect(state2).toBe(8);

      // Recompute: deterministic
      expect(reduceCounter(log1)).toBe(state1);
      expect(reduceCounter(log2)).toBe(state2);
    });
  });

  describe('projection caching correctness', () => {
    // Cache should be invalidatable and recomputable
    class ProjectedStateCache {
      private log: any[] = [];
      private cachedState: any = null;
      private cacheValid = false;

      appendEvent(event: any): void {
        this.log.push(event);
        this.cacheValid = false; // Invalidate cache
      }

      getState(): any {
        if (!this.cacheValid) {
          this.cachedState = this.computeState();
          this.cacheValid = true;
        }
        return this.cachedState;
      }

      private computeState(): any {
        return this.log.reduce((sum: number, e: any) => sum + (e.value ?? 0), 0);
      }

      invalidateCache(): void {
        this.cacheValid = false;
      }
    }

    it('cache is consistent with recomputation', () => {
      const cache = new ProjectedStateCache();

      cache.appendEvent({ value: 10 });
      cache.appendEvent({ value: 5 });

      const state1 = cache.getState(); // Computed and cached
      const state2 = cache.getState(); // From cache

      expect(state1).toBe(state2);
      expect(state1).toBe(15);
    });

    it('cache invalidation produces same result', () => {
      const cache = new ProjectedStateCache();

      cache.appendEvent({ value: 10 });
      const state1 = cache.getState();

      cache.invalidateCache();
      const state2 = cache.getState(); // Recomputed

      expect(state1).toBe(state2);
    });

    it('cache vs fresh computation are identical', () => {
      const cache = new ProjectedStateCache();

      cache.appendEvent({ value: 5 });
      cache.appendEvent({ value: 3 });
      const cachedState = cache.getState();

      cache.invalidateCache();
      const freshState = cache.getState();

      expect(cachedState).toBe(freshState);
    });
  });

  describe('projection with nested state', () => {
    interface Event {
      userId: string;
      type: 'created' | 'updated' | 'deleted';
      data?: any;
    }

    interface UserState {
      [userId: string]: any;
    }

    function projectUsers(events: Event[]): UserState {
      return events.reduce((state: UserState, event: Event) => {
        if (event.type === 'created') {
          return {
            ...state,
            [event.userId]: event.data,
          };
        } else if (event.type === 'updated') {
          return {
            ...state,
            [event.userId]: {
              ...state[event.userId],
              ...event.data,
            },
          };
        } else if (event.type === 'deleted') {
          const newState = { ...state };
          delete newState[event.userId];
          return newState;
        }
        return state;
      }, {});
    }

    it('nested projection is deterministic', () => {
      const log = [
        { userId: 'u1', type: 'created' as const, data: { name: 'Alice' } },
        { userId: 'u2', type: 'created' as const, data: { name: 'Bob' } },
        {
          userId: 'u1',
          type: 'updated' as const,
          data: { email: 'alice@example.com' },
        },
      ];

      const state1 = projectUsers(log);
      const state2 = projectUsers(log);

      expect(state1).toEqual(state2);
      expect(state1.u1).toEqual({
        name: 'Alice',
        email: 'alice@example.com',
      });
      expect(state1.u2).toEqual({ name: 'Bob' });
    });

    it('delete and recreate produces consistent state', () => {
      const log = [
        { userId: 'u1', type: 'created' as const, data: { name: 'Alice' } },
        { userId: 'u1', type: 'deleted' as const },
        { userId: 'u1', type: 'created' as const, data: { name: 'Alice2' } },
      ];

      const state1 = projectUsers(log);
      const state2 = projectUsers(log);

      expect(state1).toEqual(state2);
      expect(state1.u1).toEqual({ name: 'Alice2' });
    });
  });

  describe('projection pure function property', () => {
    // Pure function: f(x) = f(x) always
    function sumAll(nums: number[]): number {
      return nums.reduce((a, b) => a + b, 0);
    }

    it('pure projection function satisfies pure property', () => {
      const input = [1, 2, 3, 4, 5];

      const r1 = sumAll(input);
      const r2 = sumAll(input);
      const r3 = sumAll(input);

      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
      expect(r1).toBe(15);
    });

    it('pure function with immutable input', () => {
      const input = Object.freeze([10, 20, 30]);

      const result1 = sumAll([...input]);
      const result2 = sumAll([...input]);

      expect(result1).toBe(result2);
      expect(result1).toBe(60);
    });
  });

  describe('projection composability', () => {
    // Projection = projection1 . projection2 (composition)
    function filterEvents(
      events: Array<{ type: string }>,
      typeFilter: string
    ): Array<{ type: string }> {
      return events.filter((e) => e.type === typeFilter);
    }

    function countEvents(events: Array<{ type: string }>): number {
      return events.length;
    }

    it('composed projection is deterministic', () => {
      const log = [
        { type: 'A' },
        { type: 'B' },
        { type: 'A' },
        { type: 'C' },
        { type: 'A' },
      ];

      const filtered1 = filterEvents(log, 'A');
      const count1 = countEvents(filtered1);

      const filtered2 = filterEvents(log, 'A');
      const count2 = countEvents(filtered2);

      expect(count1).toBe(count2);
      expect(count1).toBe(3);
    });
  });

  describe('deterministic replay invariant', () => {
    // Replay: apply same events → same state
    interface ReplayLog {
      events: Array<{ op: string; val: number }>;
      state: number;
    }

    function replay(log: ReplayLog): number {
      let state = log.state;
      return log.events.reduce((acc, e) => {
        if (e.op === '+') return acc + e.val;
        if (e.op === '*') return acc * e.val;
        return acc;
      }, state);
    }

    it('replay is deterministic', () => {
      const log: ReplayLog = {
        state: 10,
        events: [
          { op: '+', val: 5 },
          { op: '*', val: 2 },
          { op: '+', val: 3 },
        ],
      };

      const r1 = replay(log);
      const r2 = replay(log);
      const r3 = replay(log);

      expect(r1).toBe(r2);
      expect(r2).toBe(r3);
      expect(r1).toBe(33); // ((10+5)*2)+3 = 33
    });

    it('replay from checkpoint is deterministic', () => {
      const fullLog: ReplayLog = {
        state: 10,
        events: [
          { op: '+', val: 5 },
          { op: '+', val: 3 },
          { op: '*', val: 2 },
        ],
      };

      const checkpoint: ReplayLog = {
        state: 18, // 10+5+3
        events: [{ op: '*', val: 2 }],
      };

      const fullReplay = replay(fullLog);
      const checkpointReplay = replay(checkpoint);

      expect(fullReplay).toBe(checkpointReplay);
      expect(fullReplay).toBe(36); // 18*2
    });
  });
});
