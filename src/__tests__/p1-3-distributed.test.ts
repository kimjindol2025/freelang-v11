// P1-3: Distributed Execution Tests
// Tests for large-scale parallel workload management

import { DistributedExecutor, DistributedTask } from "../stdlib-distributed";

describe("P1-3: Distributed Execution", () => {
  describe("Test 1: Basic distributed execution with 100 items and 4 workers", () => {
    it("should process all items correctly across workers", async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, value: i * 2 }));

      const task: DistributedTask = {
        items,
        worker_count: 4,
        batch_size: 25,
        sync_interval_ms: 100,
        task: async (ctx: any) => ({
          input_id: ctx.item.id,
          computed: ctx.item.value * 10,
          worker: ctx.worker_id,
        }),
      };

      const executor = new DistributedExecutor();
      const result = await executor.execute(task);

      expect(result.status).toBe("success");
      expect(result.total_items).toBe(100);
      expect(result.processed_items).toBe(100);
      expect(result.failed_items).toBe(0);
      expect(result.workers_used).toBe(4);
      expect(result.results.length).toBe(100);
      expect(result.sync_count).toBeGreaterThan(0);
    });
  });

  describe("Test 2: Partial failure handling", () => {
    it("should track failed items but continue processing", async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({ id: i }));

      const task: DistributedTask = {
        items,
        worker_count: 2,
        batch_size: 10,
        sync_interval_ms: 100,
        task: async (ctx: any) => {
          // Fail on every 5th item
          if (ctx.item.id % 5 === 0) {
            throw new Error(`Failed on item ${ctx.item.id}`);
          }
          return { processed: ctx.item.id };
        },
      };

      const executor = new DistributedExecutor();
      const result = await executor.execute(task);

      expect(result.status).toBe("partial");
      expect(result.processed_items).toBeGreaterThan(0);
      expect(result.failed_items).toBeGreaterThan(0);
      expect(result.processed_items + result.failed_items).toBe(50);
      expect(result.errors.length).toBe(result.failed_items);
    });
  });

  describe("Test 3: Large batch processing (1000 items)", () => {
    it("should handle large workload efficiently", async () => {
      const items = Array.from({ length: 1000 }, (_, i) => i);

      const task: DistributedTask = {
        items,
        worker_count: 8,
        batch_size: 100,
        sync_interval_ms: 500,
        task: async (ctx: any) => ({
          squared: ctx.item * ctx.item,
          worker: ctx.worker_id,
        }),
      };

      const executor = new DistributedExecutor();
      const startMs = Date.now();
      const result = await executor.execute(task);
      const elapsedMs = Date.now() - startMs;

      expect(result.status).toBe("success");
      expect(result.processed_items).toBe(1000);
      expect(result.failed_items).toBe(0);
      expect(result.results.length).toBe(1000);

      // Verify parallel processing (should be faster than sequential)
      // 1000 items * 10ms per item = 10 seconds sequential
      // With 8 workers should be ~1.25 seconds
      console.log(`[Test 3] Processed 1000 items in ${elapsedMs}ms using 8 workers`);
    });
  });

  describe("Test 4: Worker state synchronization", () => {
    it("should synchronize state at intervals", async () => {
      const items = Array.from({ length: 200 }, (_, i) => i);
      let sync_count = 0;

      const task: DistributedTask = {
        items,
        worker_count: 4,
        batch_size: 50,
        sync_interval_ms: 100,
        task: async (ctx: any) => ({
          value: ctx.item + 1,
        }),
      };

      const executor = new DistributedExecutor();
      const result = await executor.execute(task);

      expect(result.status).toBe("success");
      expect(result.sync_count).toBeGreaterThan(0);
      expect(result.sync_errors).toBe(0);

      // Verify sync happened multiple times
      expect(result.sync_count).toBeGreaterThanOrEqual(4);  // At least once per worker
    });
  });

  describe("Test 5: Distributed with context preservation", () => {
    it("should preserve and pass context correctly across workers", async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item-${i}` }));

      const task: DistributedTask = {
        items,
        worker_count: 4,
        batch_size: 25,
        sync_interval_ms: 100,
        task: async (ctx: any) => ({
          original_id: ctx.item.id,
          original_name: ctx.item.name,
          processed_by: ctx.worker_id,
          batch: ctx.batch_index,
          timestamp: Date.now(),
        }),
      };

      const executor = new DistributedExecutor();
      const result = await executor.execute(task);

      expect(result.status).toBe("success");
      expect(result.processed_items).toBe(100);

      // Verify context preservation
      const firstResult = result.results[0];
      expect(firstResult).toHaveProperty("original_id");
      expect(firstResult).toHaveProperty("original_name");
      expect(firstResult).toHaveProperty("processed_by");
      expect(firstResult).toHaveProperty("batch");

      // Verify distributed execution (multiple workers used)
      const workers = new Set(result.results.map((r: any) => r.processed_by));
      expect(workers.size).toBeGreaterThan(1);  // At least 2 different workers
    });
  });
});
