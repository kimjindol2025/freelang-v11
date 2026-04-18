// FreeLang v9: 통계 함수 모듈
// Phase 10: 기본 통계 연산 (NumPy 유사)

export function createStatsModule() {
  return {
    // stats_mean(list) → average
    "stats_mean": (values: number[]): number => {
      try {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
      } catch (err: any) {
        throw new Error(`stats_mean failed: ${err.message}`);
      }
    },

    // stats_median(list) → middle value
    "stats_median": (values: number[]): number => {
      try {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      } catch (err: any) {
        throw new Error(`stats_median failed: ${err.message}`);
      }
    },

    // stats_mode(list) → most frequent value
    "stats_mode": (values: any[]): any => {
      try {
        if (!Array.isArray(values) || values.length === 0) return null;
        const freq: Record<string, number> = {};
        let maxCount = 0;
        let mode = values[0];

        values.forEach(v => {
          const key = String(v);
          freq[key] = (freq[key] || 0) + 1;
          if (freq[key] > maxCount) {
            maxCount = freq[key];
            mode = v;
          }
        });

        return mode;
      } catch (err: any) {
        throw new Error(`stats_mode failed: ${err.message}`);
      }
    },

    // stats_stddev(list) → standard deviation
    "stats_stddev": (values: number[]): number => {
      try {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const mean = (values as any).reduce((a: number, b: number) => a + b, 0) / values.length;
        const squareDiffs = values.map(v => (v - mean) ** 2);
        const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
        return Math.sqrt(avgSquareDiff);
      } catch (err: any) {
        throw new Error(`stats_stddev failed: ${err.message}`);
      }
    },

    // stats_variance(list) → variance
    "stats_variance": (values: number[]): number => {
      try {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squareDiffs = values.map(v => (v - mean) ** 2);
        return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
      } catch (err: any) {
        throw new Error(`stats_variance failed: ${err.message}`);
      }
    },

    // stats_percentile(list, p) → p-th percentile
    "stats_percentile": (values: number[], p: number): number => {
      try {
        if (!Array.isArray(values) || values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const idx = (p / 100) * (sorted.length - 1);
        const lower = Math.floor(idx);
        const upper = Math.ceil(idx);
        const weight = idx % 1;

        if (lower === upper) return sorted[lower];
        return sorted[lower] * (1 - weight) + sorted[upper] * weight;
      } catch (err: any) {
        throw new Error(`stats_percentile failed: ${err.message}`);
      }
    },

    // stats_correlation(list1, list2) → correlation coefficient
    "stats_correlation": (x: number[], y: number[]): number => {
      try {
        if (x.length !== y.length || x.length === 0) return 0;

        const meanX = x.reduce((a, b) => a + b, 0) / x.length;
        const meanY = y.reduce((a, b) => a + b, 0) / y.length;

        let numerator = 0;
        let denom1 = 0;
        let denom2 = 0;

        for (let i = 0; i < x.length; i++) {
          const dx = x[i] - meanX;
          const dy = y[i] - meanY;
          numerator += dx * dy;
          denom1 += dx * dx;
          denom2 += dy * dy;
        }

        const denom = Math.sqrt(denom1 * denom2);
        return denom === 0 ? 0 : numerator / denom;
      } catch (err: any) {
        throw new Error(`stats_correlation failed: ${err.message}`);
      }
    },

    // stats_normalize(list) → values in [0, 1]
    "stats_normalize": (values: number[]): number[] => {
      try {
        if (!Array.isArray(values) || values.length === 0) return [];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;

        if (range === 0) return values.map(() => 0);
        return values.map(v => (v - min) / range);
      } catch (err: any) {
        throw new Error(`stats_normalize failed: ${err.message}`);
      }
    },

    // stats_zscore(list) → z-score normalized
    "stats_zscore": (values: number[]): number[] => {
      try {
        if (!Array.isArray(values) || values.length === 0) return [];
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const stddev = Math.sqrt(
          values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
        );

        if (stddev === 0) return values.map(() => 0);
        return values.map(v => (v - mean) / stddev);
      } catch (err: any) {
        throw new Error(`stats_zscore failed: ${err.message}`);
      }
    },

    // stats_min(list) → minimum value
    "stats_min": (values: number[]): number => {
      try {
        return Array.isArray(values) && values.length > 0 ? Math.min(...values) : 0;
      } catch (err: any) {
        throw new Error(`stats_min failed: ${err.message}`);
      }
    },

    // stats_max(list) → maximum value
    "stats_max": (values: number[]): number => {
      try {
        return Array.isArray(values) && values.length > 0 ? Math.max(...values) : 0;
      } catch (err: any) {
        throw new Error(`stats_max failed: ${err.message}`);
      }
    }
  };
}
