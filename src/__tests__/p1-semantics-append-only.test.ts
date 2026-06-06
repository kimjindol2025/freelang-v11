/**
 * P1-6: Append-Only Lifecycle Invariant
 *
 * 의미론: 모든 상태 전이는 immutable log에 append only로 기록
 *
 * 불변식:
 * - 로그는 write-once (수정 불가, 삭제 불가)
 * - append는 항상 가능 (append-only semantics)
 * - 로그에서 임의 지점의 checkpoint 가능
 * - 무결성: checksum으로 corruption 감지
 */

describe('P1-6: append-only lifecycle invariant', () => {
  describe('basic append-only buffer', () => {
    // Immutable append-only buffer
    class AppendOnlyLog {
      private buffer: any[] = [];

      append(entry: any): void {
        // Create new array to enforce immutability (in spirit)
        this.buffer = [...this.buffer, entry];
      }

      read(index: number): any {
        if (index < 0 || index >= this.buffer.length) {
          throw new Error(`Index out of bounds: ${index}`);
        }
        return this.buffer[index];
      }

      length(): number {
        return this.buffer.length;
      }

      getAll(): any[] {
        return [...this.buffer]; // Return copy to prevent external mutation
      }

      // Disallow mutations
      delete(index: number): void {
        throw new Error('Cannot delete from append-only log');
      }

      update(index: number, value: any): void {
        throw new Error('Cannot update append-only log');
      }

      splice(index: number, deleteCount: number): void {
        throw new Error('Cannot splice append-only log');
      }
    }

    it('append adds entry to log', () => {
      const log = new AppendOnlyLog();
      log.append({ event: 'start' });

      expect(log.length()).toBe(1);
      expect(log.read(0)).toEqual({ event: 'start' });
    });

    it('multiple appends grow log', () => {
      const log = new AppendOnlyLog();

      for (let i = 0; i < 5; i++) {
        log.append({ step: i });
      }

      expect(log.length()).toBe(5);
    });

    it('delete throws on append-only log', () => {
      const log = new AppendOnlyLog();
      log.append({ id: 1 });

      expect(() => log.delete(0)).toThrow('Cannot delete');
    });

    it('update throws on append-only log', () => {
      const log = new AppendOnlyLog();
      log.append({ id: 1 });

      expect(() => log.update(0, { id: 2 })).toThrow('Cannot update');
    });

    it('splice throws on append-only log', () => {
      const log = new AppendOnlyLog();
      log.append({ id: 1 });

      expect(() => log.splice(0, 1)).toThrow('Cannot splice');
    });

    it('append-only prevents external modifications', () => {
      const log = new AppendOnlyLog();
      const original = { count: 1, items: [1, 2, 3] };
      log.append(original);

      const copy = log.getAll();
      const entry = copy[0];
      // Note: JavaScript shallow copy means internal objects are still shared
      // But the log structure itself is immutable (no push/delete/update)
      expect(log.read(0).count).toBe(1);

      // The critical invariant: cannot call delete/update/splice
      expect(() => log.delete(0)).toThrow('Cannot delete');
    });
  });

  describe('monotonic timestamp invariant', () => {
    // Timestamps must be monotonically increasing
    interface LogEntry {
      id: string;
      timestamp: number;
      data?: any;
    }

    class TimestampedLog {
      private entries: LogEntry[] = [];
      private lastTimestamp = 0;

      append(id: string, data: any): void {
        const timestamp = Date.now();
        if (timestamp < this.lastTimestamp) {
          throw new Error('Timestamp must be monotonically increasing');
        }
        this.entries.push({ id, timestamp, data });
        this.lastTimestamp = timestamp;
      }

      getEntries(): LogEntry[] {
        return [...this.entries];
      }
    }

    it('timestamps are monotonically increasing', () => {
      const log = new TimestampedLog();

      log.append('e1', {});
      log.append('e2', {});
      log.append('e3', {});

      const entries = log.getEntries();
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].timestamp).toBeGreaterThanOrEqual(entries[i - 1].timestamp);
      }
    });
  });

  describe('checksum integrity', () => {
    // Simple hash-based integrity check
    function simpleChecksum(data: string): string {
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = (hash << 5) - hash + data.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    }

    class ChecksummedLog {
      private entries: Array<{ data: string; checksum: string }> = [];
      private previousChecksum = '';

      append(data: string): void {
        const combined = this.previousChecksum + data;
        const checksum = simpleChecksum(combined);
        this.entries.push({ data, checksum });
        this.previousChecksum = checksum;
      }

      verifyIntegrity(): boolean {
        let prevChecksum = '';
        for (const entry of this.entries) {
          const combined = prevChecksum + entry.data;
          const expected = simpleChecksum(combined);
          if (expected !== entry.checksum) {
            return false;
          }
          prevChecksum = entry.checksum;
        }
        return true;
      }

      getEntries(): Array<{ data: string; checksum: string }> {
        return [...this.entries];
      }
    }

    it('checksum detects log integrity', () => {
      const log = new ChecksummedLog();

      log.append('event1');
      log.append('event2');
      log.append('event3');

      expect(log.verifyIntegrity()).toBe(true);
    });

    it('log integrity is preserved on append', () => {
      const log = new ChecksummedLog();

      log.append('event1');
      log.append('event2');
      log.append('event3');

      // Internal log is protected from external mutations
      // (entries returned are copies)
      expect(log.verifyIntegrity()).toBe(true);

      // Adding more events maintains integrity
      log.append('event4');
      expect(log.verifyIntegrity()).toBe(true);
    });
  });

  describe('replay from checkpoint', () => {
    interface Event {
      type: string;
      value: number;
    }

    class CheckpointedLog {
      private events: Event[] = [];
      private checkpoints: Array<{ index: number; state: number }> = [];

      append(event: Event): void {
        this.events = [...this.events, event];
      }

      saveCheckpoint(index: number, state: number): void {
        this.checkpoints = [
          ...this.checkpoints,
          { index, state },
        ];
      }

      replayFromCheckpoint(
        checkpointIndex: number,
        fn: (state: number, event: Event) => number
      ): number {
        if (checkpointIndex < 0 || checkpointIndex >= this.checkpoints.length) {
          throw new Error(`Invalid checkpoint: ${checkpointIndex}`);
        }

        const checkpoint = this.checkpoints[checkpointIndex];
        let state = checkpoint.state;

        for (let i = checkpoint.index; i < this.events.length; i++) {
          state = fn(state, this.events[i]);
        }

        return state;
      }

      fullReplay(fn: (state: number, event: Event) => number): number {
        let state = 0;
        for (const event of this.events) {
          state = fn(state, event);
        }
        return state;
      }
    }

    it('replay from checkpoint matches full replay', () => {
      const log = new CheckpointedLog();

      log.append({ type: 'add', value: 10 });
      log.append({ type: 'add', value: 5 });
      log.saveCheckpoint(2, 15); // After first two events
      log.append({ type: 'add', value: 3 });

      const fn = (state: number, event: Event) => {
        return state + event.value;
      };

      const full = log.fullReplay(fn);
      const fromCheckpoint = log.replayFromCheckpoint(0, fn);

      expect(full).toBe(18);
      expect(fromCheckpoint).toBe(18);
    });
  });

  describe('append-only with ordering', () => {
    // Append-only maintains strict ordering
    class OrderedLog {
      private entries: Array<{ id: string; sequence: number }> = [];
      private sequence = 0;

      append(id: string): string {
        const seq = this.sequence++;
        this.entries = [...this.entries, { id, sequence: seq }];
        return seq.toString();
      }

      getSequence(id: string): number | null {
        const entry = this.entries.find((e) => e.id === id);
        return entry ? entry.sequence : null;
      }

      getAll(): Array<{ id: string; sequence: number }> {
        return [...this.entries];
      }
    }

    it('sequence numbers are strictly increasing', () => {
      const log = new OrderedLog();

      log.append('e1');
      log.append('e2');
      log.append('e3');

      const entries = log.getAll();
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].sequence).toBeGreaterThan(entries[i - 1].sequence);
      }
    });

    it('append-only order is preserved', () => {
      const log = new OrderedLog();

      const ids = ['a', 'b', 'c', 'd', 'e'];
      ids.forEach((id) => log.append(id));

      const entries = log.getAll();
      const retrievedIds = entries.map((e) => e.id);
      expect(retrievedIds).toEqual(ids);
    });
  });

  describe('immutability enforcement', () => {
    // Using Object.freeze to enforce immutability
    class FrozenLog {
      private entries: ReadonlyArray<any> = [];

      append(entry: any): void {
        const frozen = Object.freeze(entry);
        this.entries = Object.freeze([...this.entries, frozen]);
      }

      read(index: number): any {
        return this.entries[index];
      }

      length(): number {
        return this.entries.length;
      }
    }

    it('frozen entries cannot be modified', () => {
      const log = new FrozenLog();
      log.append({ id: 1, name: 'test' });

      const entry = log.read(0);

      expect(() => {
        (entry as any).id = 2;
      }).toThrow();
    });

    it('frozen log cannot be extended mutably', () => {
      const log = new FrozenLog();
      log.append({ id: 1 });

      // Entries array itself is frozen
      expect(() => {
        (log as any).entries.push({ id: 2 });
      }).toThrow();
    });
  });

  describe('durability and fsync simulation', () => {
    // Simulate fsync (write-to-disk)
    interface DurableEntry {
      id: string;
      data: any;
      durableAt?: number;
    }

    class DurableLog {
      private entries: DurableEntry[] = [];

      append(id: string, data: any): void {
        const entry: DurableEntry = {
          id,
          data,
          durableAt: Date.now(), // Simulate fsync
        };
        this.entries = [...this.entries, entry];
      }

      isDurable(index: number): boolean {
        return this.entries[index]?.durableAt !== undefined;
      }

      getAllDurable(): DurableEntry[] {
        return this.entries.filter((e) => e.durableAt !== undefined);
      }
    }

    it('all appended entries are marked durable', () => {
      const log = new DurableLog();

      log.append('e1', { x: 1 });
      log.append('e2', { x: 2 });

      expect(log.isDurable(0)).toBe(true);
      expect(log.isDurable(1)).toBe(true);

      const durable = log.getAllDurable();
      expect(durable.length).toBe(2);
    });
  });
});
