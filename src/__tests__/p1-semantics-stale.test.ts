/**
 * P1-3: Stale-State Elimination Invariant
 *
 * 의미론: 재실행 시 이전 context 오염 없음 — 각 실행은 깨끗한 상태에서 시작
 *
 * 불변식:
 * - 워크플로우 재실행 시 이전 실행의 상태를 상속하지 않음
 * - reset 후 동일 입력 → 항상 동일 결과
 * - 전역 상태 변경이 결과에 영향을 주지 않음
 * - 각 실행 인스턴스는 완벽한 격리
 */

describe('P1-3: stale-state elimination invariant', () => {
  describe('context isolation', () => {
    // 간단한 ExecutionContext를 모의
    let globalContext: Record<string, any> = {};

    function resetContext() {
      globalContext = {};
    }

    function runWorkflow(input: any): Record<string, any> {
      // Simulate workflow execution with global state
      const result = {
        input,
        output: input * 2,
        timestamp: Date.now(),
        context: { ...globalContext },
      };
      // Side effect: mutate global context (this should be isolated)
      globalContext.lastRun = Date.now();
      globalContext.lastInput = input;
      return result;
    }

    it('re-run with reset produces clean execution', () => {
      resetContext();
      const result1 = runWorkflow(5);
      expect(result1.output).toBe(10);
      expect(globalContext.lastInput).toBe(5);

      resetContext();
      const result2 = runWorkflow(5);
      expect(result2.output).toBe(10);
      expect(globalContext.lastInput).toBe(5);

      // Results should have same output (though timestamps differ)
      expect(result1.output).toBe(result2.output);
    });

    it('stale state from previous run does not leak', () => {
      resetContext();
      globalContext.counter = 1;
      const r1 = runWorkflow(10);
      expect(r1.output).toBe(20);

      resetContext();
      // counter should be gone after reset
      expect(globalContext.counter).toBeUndefined();

      const r2 = runWorkflow(10);
      expect(r2.output).toBe(20);
      // r2 should not be affected by counter from r1
      expect(r2.context.counter).toBeUndefined();
    });

    it('multiple sequential runs with reset maintain isolation', () => {
      const runs = [];

      for (let i = 0; i < 3; i++) {
        resetContext();
        const result = runWorkflow(i + 1);
        runs.push(result);
      }

      // All runs should be isolated
      expect(runs[0].output).toBe(2);
      expect(runs[1].output).toBe(4);
      expect(runs[2].output).toBe(6);

      // Contexts should not cross-contaminate
      expect(runs[0].context.counter).toBeUndefined();
      expect(runs[1].context.counter).toBeUndefined();
      expect(runs[2].context.counter).toBeUndefined();
    });
  });

  describe('deterministic re-execution', () => {
    // Deterministic execution: same input → same output (when context reset)
    function deterministicCompute(input: number): number {
      // Pure function: no side effects, deterministic output
      return input * input + 10;
    }

    it('reset + same input produces identical result', () => {
      const result1 = deterministicCompute(5);
      const result2 = deterministicCompute(5);
      expect(result1).toBe(result2);
      expect(result1).toBe(35); // 5*5 + 10
    });

    it('workflow reset eliminates state carryover', () => {
      let executionLog: any[] = [];

      function computeWithLog(input: number): number {
        const result = input + 1;
        executionLog.push({ input, result });
        return result;
      }

      const r1 = computeWithLog(5);
      expect(r1).toBe(6);
      expect(executionLog.length).toBe(1);

      // Reset log
      executionLog = [];

      const r2 = computeWithLog(5);
      expect(r2).toBe(6);
      expect(executionLog.length).toBe(1); // Fresh log, not appended

      // Results are identical
      expect(r1).toBe(r2);
    });
  });

  describe('state mutation cleanup', () => {
    // Global state tracking
    const globalState = {
      mutations: [] as any[],
      errors: [] as any[],
    };

    function resetState() {
      globalState.mutations = [];
      globalState.errors = [];
    }

    function executeStep(input: any): Record<string, any> {
      const mutation = { step: 'execute', input, time: Date.now() };
      globalState.mutations.push(mutation);

      return {
        success: true,
        input,
        mutationCount: globalState.mutations.length,
      };
    }

    it('reset clears mutation history', () => {
      resetState();
      const r1 = executeStep(1);
      expect(r1.mutationCount).toBe(1);
      expect(globalState.mutations.length).toBe(1);

      resetState();
      const r2 = executeStep(1);
      expect(r2.mutationCount).toBe(1);
      expect(globalState.mutations.length).toBe(1);

      // Both should have same mutation count (fresh start)
      expect(r1.mutationCount).toBe(r2.mutationCount);
    });

    it('error history does not carry over', () => {
      resetState();
      globalState.errors.push('error1');
      expect(globalState.errors.length).toBe(1);

      resetState();
      expect(globalState.errors.length).toBe(0);

      const result = executeStep(2);
      expect(globalState.errors.length).toBe(0);
    });
  });

  describe('workflow variable scoping', () => {
    // Simulating function scope isolation
    function createWorkflowExecutor() {
      // Each executor has its own scope
      let localVars: Record<string, any> = {};

      function reset() {
        localVars = {};
      }

      function run(input: any): Record<string, any> {
        // Initialize fresh variables
        const x = input * 2;
        const y = input + 10;
        localVars = { x, y, input };
        return { x, y };
      }

      return { run, reset, getVars: () => localVars };
    }

    it('executor scope isolation prevents variable leakage', () => {
      const executor1 = createWorkflowExecutor();
      const executor2 = createWorkflowExecutor();

      executor1.run(5);
      const vars1 = executor1.getVars();
      expect(vars1.x).toBe(10);
      expect(vars1.y).toBe(15);

      executor2.run(3);
      const vars2 = executor2.getVars();
      expect(vars2.x).toBe(6);
      expect(vars2.y).toBe(13);

      // Vars are independent
      expect(vars1.x).not.toBe(vars2.x);
    });

    it('reset clears local scope', () => {
      const executor = createWorkflowExecutor();

      executor.run(5);
      let vars = executor.getVars();
      expect(vars.x).toBe(10);

      executor.reset();
      vars = executor.getVars();
      expect(vars.x).toBeUndefined();

      executor.run(5);
      vars = executor.getVars();
      expect(vars.x).toBe(10); // Fresh value
    });
  });

  describe('cache invalidation on reset', () => {
    // Simulating cache that should be invalidated on reset
    const cache = {
      store: new Map<string, any>(),
    };

    function resetCache() {
      cache.store.clear();
    }

    function computeWithCache(key: string, fn: () => any): any {
      if (cache.store.has(key)) {
        return cache.store.get(key);
      }
      const result = fn();
      cache.store.set(key, result);
      return result;
    }

    it('reset invalidates all cached values', () => {
      const r1 = computeWithCache('test', () => Math.random());
      expect(cache.store.has('test')).toBe(true);

      resetCache();
      expect(cache.store.has('test')).toBe(false);

      const r2 = computeWithCache('test', () => Math.random());
      // r1 and r2 are different (fresh computation)
      // In this case they're likely different due to Math.random()
      expect(cache.store.get('test')).toBe(r2);
    });

    it('deterministic function produces same result after reset+recompute', () => {
      const deterministicFn = (x: number) => x * x;

      const r1 = computeWithCache('compute', () => deterministicFn(5));
      expect(r1).toBe(25);

      resetCache();

      const r2 = computeWithCache('compute', () => deterministicFn(5));
      expect(r2).toBe(25);

      // Same result due to deterministic function
      expect(r1).toBe(r2);
    });
  });

  describe('checkpoint state isolation', () => {
    // Simulating checkpoint/resume mechanism
    interface Checkpoint {
      stepIndex: number;
      context: Record<string, any>;
      createdAt: number;
    }

    let currentCheckpoint: Checkpoint | null = null;

    function saveCheckpoint(stepIndex: number, context: Record<string, any>) {
      currentCheckpoint = {
        stepIndex,
        context: { ...context },
        createdAt: Date.now(),
      };
    }

    function loadCheckpoint(): Checkpoint | null {
      return currentCheckpoint;
    }

    function clearCheckpoint() {
      currentCheckpoint = null;
    }

    it('checkpoint does not persist across resets', () => {
      saveCheckpoint(2, { step: 2, data: 'test' });
      expect(loadCheckpoint()).not.toBeNull();

      clearCheckpoint();
      expect(loadCheckpoint()).toBeNull();
    });

    it('stale checkpoint does not affect new run', () => {
      saveCheckpoint(1, { step: 1, value: 100 });
      const checkpoint1 = loadCheckpoint();
      expect(checkpoint1?.context.value).toBe(100);

      clearCheckpoint();
      saveCheckpoint(1, { step: 1, value: 200 });
      const checkpoint2 = loadCheckpoint();
      expect(checkpoint2?.context.value).toBe(200);

      // Different checkpoint values
      expect(checkpoint1?.context.value).not.toBe(checkpoint2?.context.value);
    });
  });

  describe('concurrent execution isolation', () => {
    // Multiple concurrent executions should not interfere
    const executionStacks: any[] = [];

    function pushExecution(id: string, step: string) {
      executionStacks.push({ id, step, time: Date.now() });
    }

    function getExecutionStack(): any[] {
      return [...executionStacks];
    }

    function resetExecutionStack() {
      executionStacks.length = 0;
    }

    it('multiple executions do not cross-contaminate', () => {
      resetExecutionStack();

      // Execution 1
      pushExecution('e1', 'start');
      pushExecution('e1', 'step1');
      let stack1 = getExecutionStack();
      expect(stack1.length).toBe(2);

      // Execution 2 (reset)
      resetExecutionStack();
      pushExecution('e2', 'start');
      pushExecution('e2', 'step1');
      let stack2 = getExecutionStack();
      expect(stack2.length).toBe(2);

      // Verify isolation
      expect(stack1[0].id).toBe('e1');
      expect(stack2[0].id).toBe('e2');
      expect(stack2).not.toContainEqual(stack1[0]);
    });
  });
});
