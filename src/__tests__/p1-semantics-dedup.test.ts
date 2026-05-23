/**
 * P1-4: Duplicate Collapse Invariant
 *
 * 의미론: 같은 eventId를 가진 이벤트를 두 번 emit하면 한 번만 기록됨
 *
 * 불변식:
 * - eventId는 전역 유일 식별자
 * - 같은 eventId 두 번 push → 두 번째 무시 (또는 첫 번째만 유지)
 * - dedup은 자동 적용 (명시적 제어 불필요)
 * - idempotent event emission: 같은 eventId를 여러 번 emit해도 결과 동일
 */

describe('P1-4: duplicate collapse invariant', () => {
  describe('event deduplication', () => {
    // 간단한 EventBuffer 구현
    interface Event {
      eventId: string;
      type: string;
      data?: any;
      timestamp: number;
    }

    class EventBuffer {
      private events: Event[] = [];
      private seenIds: Set<string> = new Set();

      emit(event: Event): void {
        if (this.seenIds.has(event.eventId)) {
          // Duplicate: ignore
          return;
        }
        this.events.push(event);
        this.seenIds.add(event.eventId);
      }

      getEvents(): Event[] {
        return [...this.events];
      }

      reset(): void {
        this.events = [];
        this.seenIds.clear();
      }

      count(): number {
        return this.events.length;
      }
    }

    it('unique eventId is stored', () => {
      const buf = new EventBuffer();
      buf.emit({
        eventId: 'e1',
        type: 'test',
        timestamp: Date.now(),
      });

      expect(buf.count()).toBe(1);
      expect(buf.getEvents()[0].eventId).toBe('e1');
    });

    it('duplicate eventId is collapsed (second ignored)', () => {
      const buf = new EventBuffer();

      buf.emit({
        eventId: 'e1',
        type: 'test',
        timestamp: Date.now(),
      });

      buf.emit({
        eventId: 'e1', // Same ID
        type: 'test',
        timestamp: Date.now(),
      });

      expect(buf.count()).toBe(1);
      const events = buf.getEvents();
      expect(events.filter((e) => e.eventId === 'e1')).toHaveLength(1);
    });

    it('multiple duplicates all collapsed to one', () => {
      const buf = new EventBuffer();

      // Emit same ID 5 times
      for (let i = 0; i < 5; i++) {
        buf.emit({
          eventId: 'e1',
          type: 'test',
          timestamp: Date.now(),
        });
      }

      expect(buf.count()).toBe(1);
    });

    it('different eventIds are all stored', () => {
      const buf = new EventBuffer();

      for (let i = 0; i < 5; i++) {
        buf.emit({
          eventId: `e${i}`,
          type: 'test',
          timestamp: Date.now(),
        });
      }

      expect(buf.count()).toBe(5);
    });

    it('duplicate within unique events', () => {
      const buf = new EventBuffer();

      // e1, e2, e1 (duplicate), e3, e2 (duplicate)
      const ids = ['e1', 'e2', 'e1', 'e3', 'e2'];

      ids.forEach((id) => {
        buf.emit({
          eventId: id,
          type: 'test',
          timestamp: Date.now(),
        });
      });

      expect(buf.count()).toBe(3);
      const stored = buf.getEvents().map((e) => e.eventId);
      expect(new Set(stored)).toEqual(new Set(['e1', 'e2', 'e3']));
    });
  });

  describe('idempotent event emission', () => {
    // Idempotency: f(x) = f(f(x))
    function applyDedup(events: Array<{ id: string }>): Array<{ id: string }> {
      const seen = new Set<string>();
      return events.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    }

    it('applying dedup once equals applying twice', () => {
      const events = [
        { id: 'e1' },
        { id: 'e2' },
        { id: 'e1' },
        { id: 'e3' },
        { id: 'e2' },
      ];

      const dedup1 = applyDedup(events);
      const dedup2 = applyDedup(dedup1);

      expect(dedup1).toEqual(dedup2);
      expect(dedup1.length).toBe(3);
    });

    it('dedup is idempotent for any event sequence', () => {
      const testCases = [
        [{ id: 'a' }, { id: 'a' }],
        [{ id: 'a' }, { id: 'b' }, { id: 'a' }],
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'a' }, { id: 'b' }],
        [{ id: 'x' }],
        [],
      ];

      testCases.forEach((events) => {
        const once = applyDedup(events);
        const twice = applyDedup(once);
        expect(once).toEqual(twice);
      });
    });
  });

  describe('dedup ordering', () => {
    // Dedup maintains first-occurrence order
    class OrderedEventBuffer {
      private events: Array<{ id: string; value: any }> = [];
      private seenIds: Set<string> = new Set();

      emit(id: string, value: any): void {
        if (!this.seenIds.has(id)) {
          this.events.push({ id, value });
          this.seenIds.add(id);
        }
      }

      getEvents(): Array<{ id: string; value: any }> {
        return [...this.events];
      }
    }

    it('first occurrence determines order', () => {
      const buf = new OrderedEventBuffer();

      buf.emit('e1', 'first');
      buf.emit('e2', 'second');
      buf.emit('e1', 'first-again'); // Ignored
      buf.emit('e3', 'third');

      const events = buf.getEvents();
      expect(events.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
      expect(events[0].value).toBe('first'); // Original value
    });

    it('dedup preserves event causality (order)', () => {
      const buf = new OrderedEventBuffer();

      const sequence = [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'a', value: 10 }, // Ignored (duplicate)
        { id: 'c', value: 3 },
        { id: 'b', value: 20 }, // Ignored (duplicate)
      ];

      sequence.forEach((e) => buf.emit(e.id, e.value));

      const final = buf.getEvents();
      expect(final).toEqual([
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'c', value: 3 },
      ]);
    });
  });

  describe('dedup with different event payloads', () => {
    // Same ID, different data → first payload wins
    class PayloadDedup {
      private store: Map<string, any> = new Map();
      private order: string[] = [];

      emit(id: string, payload: any): void {
        if (!this.store.has(id)) {
          this.store.set(id, payload);
          this.order.push(id);
        }
        // else: duplicate ignored, payload discarded
      }

      get(id: string): any {
        return this.store.get(id);
      }

      getAll(): Array<{ id: string; payload: any }> {
        return this.order.map((id) => ({ id, payload: this.store.get(id)! }));
      }
    }

    it('duplicate with different payload ignores new payload', () => {
      const dedup = new PayloadDedup();

      dedup.emit('e1', { value: 100 });
      dedup.emit('e1', { value: 200 }); // Duplicate, ignored

      expect(dedup.get('e1')).toEqual({ value: 100 });
    });

    it('payload immutability on dedup', () => {
      const dedup = new PayloadDedup();

      const payload1 = { count: 1 };
      const payload2 = { count: 2 };

      dedup.emit('e1', payload1);
      dedup.emit('e1', payload2); // Ignored

      const stored = dedup.get('e1');
      expect(stored).toBe(payload1); // Same object reference
      expect(stored.count).toBe(1);
    });
  });

  describe('dedup correctness properties', () => {
    // Dedup must satisfy three properties:
    // 1. Completeness: all unique IDs preserved
    // 2. Uniqueness: no duplicate IDs in result
    // 3. Order: first occurrence position maintained

    function dedup(events: Array<{ id: string }>): Array<{ id: string }> {
      const seen = new Set<string>();
      return events.filter((e) => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });
    }

    it('dedup completeness: all unique IDs preserved', () => {
      const input = [
        { id: 'a' },
        { id: 'b' },
        { id: 'a' },
        { id: 'c' },
        { id: 'b' },
        { id: 'd' },
      ];
      const result = dedup(input);
      const resultIds = result.map((e) => e.id);
      expect(new Set(resultIds)).toEqual(new Set(['a', 'b', 'c', 'd']));
    });

    it('dedup uniqueness: no duplicate IDs', () => {
      const input = [
        { id: 'x' },
        { id: 'y' },
        { id: 'x' },
        { id: 'z' },
        { id: 'y' },
      ];
      const result = dedup(input);
      const ids = result.map((e) => e.id);
      expect(ids).toEqual([...new Set(ids)]); // No duplicates
    });

    it('dedup order: first occurrence positions maintained', () => {
      const input = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
        { id: 'a' },
        { id: 'b' },
      ];
      const result = dedup(input);

      // Positions of first occurrences: a@0, b@1, c@2
      expect(result.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });

    it('dedup correctness on pathological input', () => {
      // All same ID
      const input = [{ id: 'x' }, { id: 'x' }, { id: 'x' }];
      const result = dedup(input);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('x');

      // All different IDs
      const input2 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      const result2 = dedup(input2);
      expect(result2).toHaveLength(3);

      // Empty
      const input3: Array<{ id: string }> = [];
      const result3 = dedup(input3);
      expect(result3).toHaveLength(0);
    });
  });
});
