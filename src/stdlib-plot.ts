// FreeLang v9: 시각화 모듈
// Phase 10: ASCII 기반 차트 생성

import * as fs from "fs";

export function createPlotModule() {
  return {
    // plot_histogram(values, options) → ASCII chart string
    "plot_histogram": (values: number[], options?: any): string => {
      try {
        const opts = options || {};
        const bins = opts.bins || 10;
        const title = opts.title || "Histogram";

        if (!Array.isArray(values) || values.length === 0) {
          return `${title}\n(no data)`;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const binWidth = range / bins;

        const buckets: number[] = Array(bins).fill(0);
        values.forEach(v => {
          const binIdx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
          buckets[binIdx]++;
        });

        const maxCount = Math.max(...buckets);
        const height = 10;

        let chart = `${title}\n`;
        for (let h = height; h > 0; h--) {
          let row = "";
          for (let b = 0; b < bins; b++) {
            const barHeight = Math.round((buckets[b] / maxCount) * height);
            row += barHeight >= h ? "█" : " ";
          }
          chart += row + "\n";
        }

        return chart;
      } catch (err: any) {
        throw new Error(`plot_histogram failed: ${err.message}`);
      }
    },

    // plot_bar(labels, values, options) → ASCII bar chart
    "plot_bar": (labels: string[], values: number[], options?: any): string => {
      try {
        const opts = options || {};
        const title = opts.title || "Bar Chart";

        if (!Array.isArray(labels) || !Array.isArray(values) || labels.length === 0 || labels.length !== values.length) {
          return `${title}\n(invalid data)`;
        }

        const maxValue = Math.max(...values);
        const maxLabelLen = Math.max(...labels.map(l => String(l).length));
        const barWidth = 30;

        let chart = `${title}\n`;
        labels.forEach((label, i) => {
          const barLen = Math.round((values[i] / maxValue) * barWidth);
          const bar = "█".repeat(barLen);
          chart += `${String(label).padEnd(maxLabelLen)} │ ${bar} ${values[i]}\n`;
        });

        return chart;
      } catch (err: any) {
        throw new Error(`plot_bar failed: ${err.message}`);
      }
    },

    // plot_line(x, y, options) → ASCII line chart
    "plot_line": (x: number[], y: number[], options?: any): string => {
      try {
        const opts = options || {};
        const title = opts.title || "Line Chart";

        if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
          return `${title}\n(invalid data)`;
        }

        const minX = Math.min(...x);
        const maxX = Math.max(...x);
        const minY = Math.min(...y);
        const maxY = Math.max(...y);

        const width = 40;
        const height = 10;

        const grid: string[][] = Array(height)
          .fill(null)
          .map(() => Array(width).fill(" "));

        x.forEach((xi, i) => {
          const col = Math.round(((xi - minX) / (maxX - minX || 1)) * (width - 1));
          const row = Math.round(((maxY - y[i]) / (maxY - minY || 1)) * (height - 1));
          if (col >= 0 && col < width && row >= 0 && row < height) {
            grid[row][col] = "•";
          }
        });

        let chart = `${title}\n`;
        grid.forEach(row => {
          chart += row.join("") + "\n";
        });

        return chart;
      } catch (err: any) {
        throw new Error(`plot_line failed: ${err.message}`);
      }
    },

    // plot_scatter(x, y, options) → ASCII scatter plot
    "plot_scatter": (x: number[], y: number[], options?: any): string => {
      try {
        const opts = options || {};
        const title = opts.title || "Scatter Plot";

        if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) {
          return `${title}\n(invalid data)`;
        }

        const minX = Math.min(...x);
        const maxX = Math.max(...x);
        const minY = Math.min(...y);
        const maxY = Math.max(...y);

        const width = 40;
        const height = 10;

        const grid: string[][] = Array(height)
          .fill(null)
          .map(() => Array(width).fill("."));

        x.forEach((xi, i) => {
          const col = Math.round(((xi - minX) / (maxX - minX || 1)) * (width - 1));
          const row = Math.round(((maxY - y[i]) / (maxY - minY || 1)) * (height - 1));
          if (col >= 0 && col < width && row >= 0 && row < height) {
            grid[row][col] = "*";
          }
        });

        let chart = `${title}\n`;
        grid.forEach(row => {
          chart += row.join("") + "\n";
        });

        return chart;
      } catch (err: any) {
        throw new Error(`plot_scatter failed: ${err.message}`);
      }
    },

    // plot_heatmap(matrix) → ASCII heatmap
    "plot_heatmap": (matrix: number[][]): string => {
      try {
        if (!Array.isArray(matrix) || matrix.length === 0) {
          return "(no data)";
        }

        const flat = matrix.flat();
        const min = Math.min(...flat);
        const max = Math.max(...flat);
        const range = max - min || 1;

        const chars = [" ", "░", "▒", "▓", "█"];

        let heatmap = "Heatmap\n";
        matrix.forEach(row => {
          heatmap += row.map(v => {
            const idx = Math.floor(((v - min) / range) * (chars.length - 1));
            return chars[idx];
          }).join("") + "\n";
        });

        return heatmap;
      } catch (err: any) {
        throw new Error(`plot_heatmap failed: ${err.message}`);
      }
    },

    // plot_save(chart, path) → boolean
    "plot_save": (chart: string, filePath: string): boolean => {
      try {
        fs.writeFileSync(filePath, chart, "utf-8");
        return true;
      } catch (err: any) {
        throw new Error(`plot_save failed: ${err.message}`);
      }
    }
  };
}
