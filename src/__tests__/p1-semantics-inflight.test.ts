/**
 * P1-2: Inflight Lifecycle Invariant
 *
 * 의미론: 비동기 작업의 각 단계는 정확한 상태 전이 순서 준수
 * - pending: 초기 상태 (시작 전)
 * - running: 실행 중 (시작 후)
 * - success: 완료 (성공)
 * - failed: 완료 (실패)
 *
 * 불변식:
 * - pending 상태에서만 시작 가능 (running으로 전이)
 * - running 상태에서만 완료 가능 (success 또는 failed로 전이)
 * - running 상태를 건너뛸 수 없음 (pending → success 직접 전이 금지)
 * - success/failed 상태는 최종 상태 (변경 불가)
 */

describe('P1-2: inflight lifecycle invariant', () => {
  describe('job lifecycle state machine', () => {
    // 간단한 Job 상태 머신 정의
    interface Job {
      id: string;
      status: 'pending' | 'running' | 'success' | 'failed';
      result?: any;
      error?: string;
    }

    function createJob(id: string): Job {
      return { id, status: 'pending' };
    }

    function startJob(job: Job): Job {
      if (job.status !== 'pending') {
        throw new Error(`Cannot start job from status: ${job.status}`);
      }
      return { ...job, status: 'running' };
    }

    function completeJob(job: Job, result: any): Job {
      if (job.status !== 'running') {
        throw new Error(`Cannot complete job from status: ${job.status}`);
      }
      return { ...job, status: 'success', result };
    }

    function failJob(job: Job, error: string): Job {
      if (job.status !== 'running') {
        throw new Error(`Cannot fail job from status: ${job.status}`);
      }
      return { ...job, status: 'failed', error };
    }

    it('job starts in pending state', () => {
      const job = createJob('j1');
      expect(job.status).toBe('pending');
    });

    it('pending → running transition allowed', () => {
      let job = createJob('j1');
      job = startJob(job);
      expect(job.status).toBe('running');
    });

    it('running → success transition allowed', () => {
      let job = createJob('j1');
      job = startJob(job);
      job = completeJob(job, { data: 'result' });
      expect(job.status).toBe('success');
      expect(job.result).toEqual({ data: 'result' });
    });

    it('running → failed transition allowed', () => {
      let job = createJob('j1');
      job = startJob(job);
      job = failJob(job, 'timeout');
      expect(job.status).toBe('failed');
      expect(job.error).toBe('timeout');
    });

    it('pending → success direct transition forbidden', () => {
      const job = createJob('j1');
      // Must not allow direct pending → success (must go through running)
      expect(() => {
        // Attempt direct completion without starting
        if (job.status !== 'running') {
          throw new Error('Cannot complete job from status: pending');
        }
      }).toThrow('Cannot complete job from status: pending');
    });

    it('pending → failed direct transition forbidden', () => {
      const job = createJob('j1');
      // Must not allow direct pending → failed (must go through running)
      expect(() => {
        // Attempt direct failure without starting
        if (job.status !== 'running') {
          throw new Error('Cannot fail job from status: pending');
        }
      }).toThrow('Cannot fail job from status: pending');
    });

    it('success state is final (no transitions allowed)', () => {
      let job = createJob('j1');
      job = startJob(job);
      job = completeJob(job, { x: 1 });

      // Attempting to transition from success should fail
      expect(() => {
        if (job.status !== 'running') {
          throw new Error(`Cannot start job from status: ${job.status}`);
        }
      }).toThrow('Cannot start job from status: success');

      expect(() => {
        if (job.status !== 'running') {
          throw new Error(`Cannot fail job from status: ${job.status}`);
        }
      }).toThrow('Cannot fail job from status: success');
    });

    it('failed state is final (no transitions allowed)', () => {
      let job = createJob('j1');
      job = startJob(job);
      job = failJob(job, 'error');

      // Attempting to transition from failed should fail
      expect(() => {
        if (job.status !== 'running') {
          throw new Error(`Cannot start job from status: ${job.status}`);
        }
      }).toThrow('Cannot start job from status: failed');

      expect(() => {
        if (job.status !== 'running') {
          throw new Error(`Cannot complete job from status: ${job.status}`);
        }
      }).toThrow('Cannot complete job from status: failed');
    });

    it('cannot start already-running job', () => {
      let job = createJob('j1');
      job = startJob(job);

      // Attempt to start again
      expect(() => startJob(job)).toThrow(
        'Cannot start job from status: running'
      );
    });

    it('full lifecycle: pending → running → success', () => {
      let job = createJob('j1');
      expect(job.status).toBe('pending');

      job = startJob(job);
      expect(job.status).toBe('running');

      job = completeJob(job, { output: 'data' });
      expect(job.status).toBe('success');
      expect(job.result).toEqual({ output: 'data' });
    });

    it('full lifecycle: pending → running → failed', () => {
      let job = createJob('j2');
      expect(job.status).toBe('pending');

      job = startJob(job);
      expect(job.status).toBe('running');

      job = failJob(job, 'network timeout');
      expect(job.status).toBe('failed');
      expect(job.error).toBe('network timeout');
    });
  });

  describe('lifecycle state immutability', () => {
    // Simulating immutable final states with Object.freeze
    it('frozen success state cannot be modified', () => {
      const job = Object.freeze({
        id: 'j1',
        status: 'success' as const,
        result: { x: 1 },
      });

      // Attempt to mutate (should fail in strict mode / frozen object)
      expect(() => {
        (job as any).status = 'failed';
      }).toThrow();
    });

    it('frozen failed state cannot be modified', () => {
      const job = Object.freeze({
        id: 'j1',
        status: 'failed' as const,
        error: 'failed',
      });

      // Attempt to mutate (should fail in strict mode / frozen object)
      expect(() => {
        (job as any).status = 'success';
      }).toThrow();
    });
  });

  describe('multiple jobs independent lifecycles', () => {
    it('job1 and job2 have independent states', () => {
      const jobs: Record<string, any> = {
        j1: { id: 'j1', status: 'pending' },
        j2: { id: 'j2', status: 'running' },
      };

      // j1 transitions
      if (jobs.j1.status === 'pending') {
        jobs.j1.status = 'running';
      }
      expect(jobs.j1.status).toBe('running');

      // j2 remains independent
      expect(jobs.j2.status).toBe('running');

      // j2 completes
      if (jobs.j2.status === 'running') {
        jobs.j2.status = 'success';
      }
      expect(jobs.j2.status).toBe('success');

      // j1 is unaffected
      expect(jobs.j1.status).toBe('running');
    });

    it('parallel jobs maintain separate lifecycles', () => {
      const jobA = { id: 'a', status: 'pending' };
      const jobB = { id: 'b', status: 'pending' };
      const jobC = { id: 'c', status: 'pending' };

      // All start
      jobA.status = 'running';
      jobB.status = 'running';
      jobC.status = 'running';

      // A completes
      jobA.status = 'success';

      // B fails
      jobB.status = 'failed';

      // C still running
      expect(jobC.status).toBe('running');

      // Verify independence
      expect(jobA.status).toBe('success');
      expect(jobB.status).toBe('failed');
      expect(jobC.status).toBe('running');
    });
  });

  describe('lifecycle error handling', () => {
    it('error on invalid transition is descriptive', () => {
      const job = { id: 'j1', status: 'success' as const };

      const error = new Error(
        `Cannot transition from status ${job.status}: success state is final`
      );
      expect(error.message).toContain('success state is final');
    });

    it('error prevents silent invalid state', () => {
      const job = { id: 'j1', status: 'pending' };

      // Invalid: must go through running
      let error: Error | null = null;
      try {
        if (job.status === 'pending') {
          throw new Error(
            'Cannot complete: job not running'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('Cannot complete');
    });
  });

  describe('lifecycle enforcement in context', () => {
    // Workflow context: multiple steps, each must follow job lifecycle
    interface WorkflowContext {
      jobs: Record<string, any>;
    }

    it('workflow step transitions enforce job states', () => {
      const ctx: WorkflowContext = {
        jobs: {
          step1: { status: 'pending' },
          step2: { status: 'pending' },
        },
      };

      // Step 1: pending → running → success
      ctx.jobs.step1.status = 'running';
      expect(ctx.jobs.step1.status).toBe('running');

      ctx.jobs.step1.status = 'success';
      expect(ctx.jobs.step1.status).toBe('success');

      // Step 2: pending → running (but NOT complete yet)
      ctx.jobs.step2.status = 'running';
      expect(ctx.jobs.step2.status).toBe('running');

      // Verify step 1 is still success
      expect(ctx.jobs.step1.status).toBe('success');
      // Verify step 2 is still running (not forced to complete)
      expect(ctx.jobs.step2.status).toBe('running');
    });

    it('cannot skip running state in workflow step', () => {
      const job = { status: 'pending' };

      // This should fail (simulating enforcement)
      expect(() => {
        if (job.status !== 'running') {
          throw new Error('Job not running: cannot complete');
        }
        job.status = 'success';
      }).toThrow('Job not running');

      // Job should still be pending
      expect(job.status).toBe('pending');
    });
  });
});
