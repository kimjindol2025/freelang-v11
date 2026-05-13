// stdlib-metrics.ts — Prometheus-compatible metrics (Counter, Gauge, Histogram)
// Provides observability: metric collection, statistics, export

// ── Internal helpers ───────────────────────────────────────────────────────

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

// ── Module ─────────────────────────────────────────────────────────────────

export function createMetricsModule() {
  const metrics = new Map<string, any>();

  return {
    // ── Registry management ────────────────────────────────────

    // metrics_registry_create → registry object
    metrics_registry_create: (): any => {
      return {
        counters: new Map<string, any>(),
        gauges: new Map<string, any>(),
        histograms: new Map<string, any>(),
      };
    },

    // ── Counter (monotonic increment) ──────────────────────────

    // metrics_counter_create name help → counter handle
    metrics_counter_create: (name: string, help: string): any => {
      if (typeof name !== "string" || typeof help !== "string") return null;
      const counter = { name, help, value: 0 };
      metrics.set(`counter_${name}`, counter);
      return counter;
    },

    // metrics_inc! counter → counter (increment by 1)
    metrics_inc: (counter: any): any => {
      if (!counter || typeof counter !== "object") return null;
      counter.value = (counter.value || 0) + 1;
      return counter;
    },

    // metrics_inc_by! counter n → counter (increment by n)
    metrics_inc_by: (counter: any, n: number): any => {
      if (!counter || typeof counter !== "object" || typeof n !== "number") return null;
      counter.value = (counter.value || 0) + n;
      return counter;
    },

    // metrics_counter_get counter → number
    metrics_counter_get: (counter: any): number => {
      if (!counter || typeof counter !== "object") return 0;
      return counter.value || 0;
    },

    // ── Gauge (can go up/down) ────────────────────────────────

    // metrics_gauge_create name help → gauge handle
    metrics_gauge_create: (name: string, help: string): any => {
      if (typeof name !== "string" || typeof help !== "string") return null;
      const gauge = { name, help, value: 0 };
      metrics.set(`gauge_${name}`, gauge);
      return gauge;
    },

    // metrics_set! gauge n → gauge
    metrics_set: (gauge: any, n: number): any => {
      if (!gauge || typeof gauge !== "object" || typeof n !== "number") return null;
      gauge.value = n;
      return gauge;
    },

    // metrics_gauge_inc! gauge → gauge (+1)
    metrics_gauge_inc: (gauge: any): any => {
      if (!gauge || typeof gauge !== "object") return null;
      gauge.value = (gauge.value || 0) + 1;
      return gauge;
    },

    // metrics_gauge_dec! gauge → gauge (-1)
    metrics_gauge_dec: (gauge: any): any => {
      if (!gauge || typeof gauge !== "object") return null;
      gauge.value = (gauge.value || 0) - 1;
      return gauge;
    },

    // metrics_gauge_get gauge → number
    metrics_gauge_get: (gauge: any): number => {
      if (!gauge || typeof gauge !== "object") return 0;
      return gauge.value || 0;
    },

    // ── Histogram (distribution) ───────────────────────────────

    // metrics_histogram_create name help buckets → histogram handle
    metrics_histogram_create: (
      name: string,
      help: string,
      buckets?: number[]
    ): any => {
      if (typeof name !== "string" || typeof help !== "string") return null;

      const defaultBuckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
      const bucketsToUse = Array.isArray(buckets) ? buckets : defaultBuckets;

      const histogram = {
        name,
        help,
        buckets: bucketsToUse,
        values: [] as number[],
        bucketCounts: new Map<number, number>(),
      };

      // Initialize bucket counts
      bucketsToUse.forEach((b) => histogram.bucketCounts.set(b, 0));
      histogram.bucketCounts.set(Infinity, 0);

      metrics.set(`histogram_${name}`, histogram);
      return histogram;
    },

    // metrics_observe! histogram value → histogram
    metrics_observe: (histogram: any, value: number): any => {
      if (!histogram || typeof histogram !== "object" || typeof value !== "number") {
        return null;
      }

      histogram.values.push(value);

      // Update bucket counts
      histogram.buckets.forEach((bucket: number) => {
        if (value <= bucket) {
          histogram.bucketCounts.set(bucket, (histogram.bucketCounts.get(bucket) || 0) + 1);
        }
      });
      histogram.bucketCounts.set(Infinity, (histogram.bucketCounts.get(Infinity) || 0) + 1);

      return histogram;
    },

    // metrics_histogram_stats histogram → {count, sum, mean, p50, p95, p99, buckets}
    metrics_histogram_stats: (histogram: any): any => {
      if (!histogram || typeof histogram !== "object") return null;

      const values = histogram.values || [];
      if (values.length === 0) {
        return {
          count: 0,
          sum: 0,
          mean: 0,
          p50: 0,
          p95: 0,
          p99: 0,
          buckets: {},
        };
      }

      const sum = values.reduce((a: number, b: number) => a + b, 0);
      const mean = sum / values.length;

      const bucketsObj: any = {};
      (histogram.buckets || []).forEach((b: number) => {
        bucketsObj[b] = histogram.bucketCounts.get(b) || 0;
      });

      return {
        count: values.length,
        sum,
        mean,
        p50: calculatePercentile(values, 50),
        p95: calculatePercentile(values, 95),
        p99: calculatePercentile(values, 99),
        buckets: bucketsObj,
      };
    },

    // ── Timer utility ──────────────────────────────────────────

    // metrics_timer histogram fn → result (measures execution time in ms)
    metrics_timer: (histogram: any, fn: any): any => {
      if (!histogram || typeof histogram !== "object" || typeof fn !== "function") {
        return null;
      }

      const start = Date.now();
      try {
        const result = fn();
        const elapsed = Date.now() - start;
        histogram.values.push(elapsed);

        // Update bucket counts
        (histogram.buckets || []).forEach((bucket: number) => {
          if (elapsed <= bucket) {
            histogram.bucketCounts.set(bucket, (histogram.bucketCounts.get(bucket) || 0) + 1);
          }
        });
        histogram.bucketCounts.set(Infinity, (histogram.bucketCounts.get(Infinity) || 0) + 1);

        return result;
      } catch (e) {
        const elapsed = Date.now() - start;
        histogram.values.push(elapsed);
        throw e;
      }
    },

    // ── Export ─────────────────────────────────────────────────

    // metrics_snapshot registry → {counters: {...}, gauges: {...}, histograms: {...}}
    metrics_snapshot: (registry: any): any => {
      if (!registry || typeof registry !== "object") return null;

      const snapshot: any = { counters: {}, gauges: {}, histograms: {} };

      // Snapshot counters
      (registry.counters || new Map()).forEach((counter: any, key: string) => {
        snapshot.counters[counter.name] = counter.value || 0;
      });

      // Snapshot gauges
      (registry.gauges || new Map()).forEach((gauge: any, key: string) => {
        snapshot.gauges[gauge.name] = gauge.value || 0;
      });

      // Snapshot histograms
      (registry.histograms || new Map()).forEach((histogram: any, key: string) => {
        const stats = this.metrics_histogram_stats(histogram);
        snapshot.histograms[histogram.name] = stats;
      });

      return snapshot;
    },

    // metrics_prometheus registry → Prometheus text format string
    metrics_prometheus: (registry: any): string => {
      if (!registry || typeof registry !== "object") return "";

      let output = "";

      // Prometheus counters
      const counters = registry.counters || new Map();
      counters.forEach((counter: any) => {
        output += `# HELP ${counter.name} ${counter.help}\n`;
        output += `# TYPE ${counter.name} counter\n`;
        output += `${counter.name} ${counter.value || 0}\n\n`;
      });

      // Prometheus gauges
      const gauges = registry.gauges || new Map();
      gauges.forEach((gauge: any) => {
        output += `# HELP ${gauge.name} ${gauge.help}\n`;
        output += `# TYPE ${gauge.name} gauge\n`;
        output += `${gauge.name} ${gauge.value || 0}\n\n`;
      });

      // Prometheus histograms
      const histograms = registry.histograms || new Map();
      histograms.forEach((histogram: any) => {
        output += `# HELP ${histogram.name} ${histogram.help}\n`;
        output += `# TYPE ${histogram.name} histogram\n`;

        const bucketsMap = histogram.bucketCounts || new Map();
        (histogram.buckets || []).forEach((bucket: number) => {
          output += `${histogram.name}_bucket{le="${bucket}"} ${bucketsMap.get(bucket) || 0}\n`;
        });
        output += `${histogram.name}_bucket{le="+Inf"} ${bucketsMap.get(Infinity) || 0}\n`;

        const values = histogram.values || [];
        const sum = values.reduce((a: number, b: number) => a + b, 0);
        output += `${histogram.name}_sum ${sum}\n`;
        output += `${histogram.name}_count ${values.length}\n\n`;
      });

      return output;
    },
  };
}
