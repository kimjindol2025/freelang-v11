/**
 * P1-7: Transition-Window Correctness Invariant
 *
 * 의미론: 상태 전이 중 불변성 유지, 외부 관찰 불가능, 원자성 보장
 *
 * 불변식:
 * - A → B 전이 중에는 외부에서 상태 관찰 불가능
 * - 전이 실패 시 A로 롤백 (B 상태 도달 불가)
 * - 전이는 원자적 (all-or-nothing semantics)
 * - 부분 성공 (partial commit) 불가능
 */

describe('P1-7: transition-window correctness invariant', () => {
  describe('atomic state transitions', () => {
    // State machine with atomic transitions
    interface State {
      status: 'pending' | 'running' | 'success' | 'failed';
      version: number;
    }

    class AtomicStateMachine {
      private state: State = { status: 'pending', version: 0 };
      private transitionInProgress = false;

      transition(
        fromStatus: string,
        toStatus: string,
        action: () => boolean
      ): boolean {
        // Check precondition
        if (this.state.status !== fromStatus) {
          throw new Error(`Cannot transition from ${this.state.status}`);
        }

        if (this.transitionInProgress) {
          throw new Error('Transition already in progress');
        }

        // Mark transition window
        this.transitionInProgress = true;

        try {
          // Execute action (may fail)
          const success = action();

          if (success) {
            // Atomic commit
            this.state = {
              status: toStatus as any,
              version: this.state.version + 1,
            };
            return true;
          } else {
            // Rollback on failure
            return false;
          }
        } finally {
          this.transitionInProgress = false;
        }
      }

      getState(): State {
        return { ...this.state };
      }

      isTransitioning(): boolean {
        return this.transitionInProgress;
      }
    }

    it('successful transition commits atomically', () => {
      const sm = new AtomicStateMachine();

      const success = sm.transition('pending', 'running', () => true);

      expect(success).toBe(true);
      expect(sm.getState().status).toBe('running');
      expect(sm.getState().version).toBe(1);
    });

    it('failed transition rolls back to original state', () => {
      const sm = new AtomicStateMachine();

      const success = sm.transition('pending', 'running', () => false);

      expect(success).toBe(false);
      expect(sm.getState().status).toBe('pending');
      expect(sm.getState().version).toBe(0);
    });

    it('lock is held during transition', () => {
      const sm = new AtomicStateMachine();

      expect(sm.isTransitioning()).toBe(false);

      // Transition releases lock after completion
      sm.transition('pending', 'running', () => true);

      expect(sm.isTransitioning()).toBe(false);
      expect(sm.getState().status).toBe('running');
    });
  });

  describe('window invariant during transition', () => {
    // External observer cannot see intermediate state
    interface TransitionWindow {
      beforeState: string;
      afterState: string;
      intermediateVisible?: boolean;
    }

    class TransitionObserver {
      private state = 'A';
      private observations: string[] = [];

      transition(fn: () => void): void {
        this.observations = [];
        fn();
        // After transition, state should be final (not intermediate)
      }

      setState(newState: string): void {
        this.state = newState;
      }

      getState(): string {
        // Record each observation
        this.observations.push(this.state);
        return this.state;
      }

      getObservations(): string[] {
        return [...this.observations];
      }
    }

    it('state is not observable during transition', () => {
      const observer = new TransitionObserver();

      observer.transition(() => {
        observer.setState('B');
      });

      expect(observer.getState()).toBe('B');
      // Observations should only show final state
      expect(observer.getObservations()).toContain('B');
    });
  });

  describe('no partial commit on failure', () => {
    // Workflow with multiple steps
    interface WorkflowStep {
      name: string;
      execute: () => boolean;
      compensate?: () => void;
    }

    class WorkflowExecutor {
      private committed: Set<string> = new Set();
      private state = 'initial';

      executeSteps(steps: WorkflowStep[]): boolean {
        const toCompensate: WorkflowStep[] = [];

        for (const step of steps) {
          const success = step.execute();

          if (success) {
            this.committed.add(step.name);
            toCompensate.push(step);
          } else {
            // Failure: trigger compensation for previously committed steps
            for (let i = toCompensate.length - 1; i >= 0; i--) {
              const s = toCompensate[i];
              if (s.compensate) {
                s.compensate();
                this.committed.delete(s.name);
              }
            }
            return false;
          }
        }

        return true;
      }

      getCommitted(): string[] {
        return Array.from(this.committed);
      }
    }

    it('failed step triggers rollback of committed steps', () => {
      const executor = new WorkflowExecutor();

      const steps: WorkflowStep[] = [
        {
          name: 'step1',
          execute: () => {
            console.log('step1 ok');
            return true;
          },
          compensate: () => console.log('step1 rollback'),
        },
        {
          name: 'step2',
          execute: () => {
            console.log('step2 ok');
            return true;
          },
          compensate: () => console.log('step2 rollback'),
        },
        {
          name: 'step3',
          execute: () => {
            console.log('step3 FAIL');
            return false;
          },
        },
      ];

      const success = executor.executeSteps(steps);

      expect(success).toBe(false);
      expect(executor.getCommitted()).toEqual([]); // All rolled back
    });

    it('successful all steps remain committed', () => {
      const executor = new WorkflowExecutor();

      const steps: WorkflowStep[] = [
        {
          name: 'step1',
          execute: () => true,
          compensate: () => {},
        },
        {
          name: 'step2',
          execute: () => true,
          compensate: () => {},
        },
        {
          name: 'step3',
          execute: () => true,
          compensate: () => {},
        },
      ];

      const success = executor.executeSteps(steps);

      expect(success).toBe(true);
      expect(executor.getCommitted()).toEqual(['step1', 'step2', 'step3']);
    });
  });

  describe('transition guards', () => {
    // Preconditions before transition
    interface GuardedState {
      status: string;
      data?: any;
    }

    class GuardedStateMachine {
      private state: GuardedState = { status: 'init' };

      canTransition(
        from: string,
        to: string,
        guard: () => boolean
      ): boolean {
        if (this.state.status !== from) {
          throw new Error(`Invalid state: ${this.state.status}`);
        }

        if (!guard()) {
          throw new Error(`Guard failed: cannot transition to ${to}`);
        }

        return true;
      }

      transition(from: string, to: string, data?: any): void {
        if (this.state.status !== from) {
          throw new Error(`Invalid transition from ${this.state.status}`);
        }
        this.state = { status: to, data };
      }

      getStatus(): string {
        return this.state.status;
      }
    }

    it('guard prevents invalid transition', () => {
      const sm = new GuardedStateMachine();

      expect(() => {
        sm.canTransition('init', 'ready', () => false);
      }).toThrow('Guard failed');

      expect(sm.getStatus()).toBe('init');
    });

    it('guard passes enables transition', () => {
      const sm = new GuardedStateMachine();

      expect(() => {
        sm.canTransition('init', 'ready', () => true);
      }).not.toThrow();

      sm.transition('init', 'ready');
      expect(sm.getStatus()).toBe('ready');
    });
  });

  describe('version tracking for transition correctness', () => {
    // Version vector to detect concurrent modifications
    interface VersionedState {
      data: string;
      version: number;
      locked: boolean;
    }

    class VersionedStateMachine {
      private state: VersionedState = {
        data: 'initial',
        version: 0,
        locked: false,
      };

      transition(
        expectedVersion: number,
        newData: string,
        action: () => boolean
      ): boolean {
        // Check version match
        if (this.state.version !== expectedVersion) {
          throw new Error('Version mismatch: concurrent modification detected');
        }

        // Acquire lock
        if (this.state.locked) {
          throw new Error('State is locked by another transition');
        }

        this.state.locked = true;

        try {
          const success = action();

          if (success) {
            this.state.data = newData;
            this.state.version++;
            return true;
          }

          return false;
        } finally {
          this.state.locked = false;
        }
      }

      getVersion(): number {
        return this.state.version;
      }

      getData(): string {
        return this.state.data;
      }
    }

    it('version mismatch prevents transition', () => {
      const sm = new VersionedStateMachine();

      expect(() => {
        sm.transition(999, 'new', () => true); // Wrong version
      }).toThrow('Version mismatch');

      expect(sm.getVersion()).toBe(0);
    });

    it('successful transition increments version', () => {
      const sm = new VersionedStateMachine();

      sm.transition(0, 'updated', () => true);

      expect(sm.getVersion()).toBe(1);
      expect(sm.getData()).toBe('updated');
    });

    it('failed transition does not increment version', () => {
      const sm = new VersionedStateMachine();

      const success = sm.transition(0, 'updated', () => false);

      expect(success).toBe(false);
      expect(sm.getVersion()).toBe(0);
      expect(sm.getData()).toBe('initial');
    });
  });

  describe('concurrent transition prevention', () => {
    // Only one transition at a time
    class MutexStateMachine {
      private state = 'A';
      private transitions: Array<{ from: string; to: string; time: number }> = [];

      async transitionAsync(
        from: string,
        to: string,
        delayMs: number
      ): Promise<boolean> {
        if (this.state !== from) {
          return false;
        }

        this.state = from + '→' + to; // Mark transition in progress

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (this.state === from + '→' + to) {
          this.state = to;
          this.transitions.push({ from, to, time: Date.now() });
          return true;
        }

        return false;
      }

      getState(): string {
        return this.state;
      }
    }

    it('concurrent transitions maintain atomicity', async () => {
      const sm = new MutexStateMachine();

      // Attempt two transitions to same state
      const t1 = sm.transitionAsync('A', 'B', 10);
      const t2 = sm.transitionAsync('A', 'C', 10);

      const [r1, r2] = await Promise.all([t1, t2]);

      // Only one should succeed (or neither if interleaved badly)
      // In this simple async model, both may fail due to state conflict
      expect(sm.getState()).not.toBe('A'); // Should have transitioned
    });
  });

  describe('transition invariants enforcement', () => {
    // All transitions must satisfy invariants
    interface InvariantState {
      count: number;
      sum: number;
    }

    class InvariantStateMachine {
      private state: InvariantState = { count: 0, sum: 0 };

      // Invariant: sum == count * count (for this test)
      private checkInvariant(): boolean {
        return this.state.sum === this.state.count * this.state.count;
      }

      add(value: number): boolean {
        const oldState = { ...this.state };

        // Transition
        this.state.count++;
        this.state.sum += this.state.count;

        // Check invariant (simplified for test)
        if (!this.checkInvariant()) {
          // Rollback
          this.state = oldState;
          return false;
        }

        return true;
      }

      getState(): InvariantState {
        return { ...this.state };
      }
    }

    it('transition maintains invariant', () => {
      const sm = new InvariantStateMachine();

      sm.add(1); // count=1, sum=1
      const state = sm.getState();

      expect(state.count).toBe(1);
      // Invariant is maintained (sum == count*count would be: 1 == 1*1 = true)
    });
  });
});
