// FreeLang v9: 테이블 조작 모듈
// Phase 10: CSV/JSON 기반 데이터 조작 (Pandas 유사)

import * as fs from "fs";
import * as path from "path";

interface TableData {
  headers: string[];
  rows: Record<string, any>[];
}

export function createTableModule() {
  return {
    // table_load_csv(path) → {headers, rows}
    "table_load_csv": (filePath: string): TableData => {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter(l => l.trim());
        const headers = lines[0].split(",").map(h => h.trim());

        const rows = lines.slice(1).map(line => {
          const values = line.split(",").map(v => v.trim());
          const row: Record<string, any> = {};
          headers.forEach((h, i) => {
            const val = values[i];
            row[h] = isNaN(Number(val)) ? val : Number(val);
          });
          return row;
        });

        return { headers, rows };
      } catch (err: any) {
        throw new Error(`table_load_csv failed: ${err.message}`);
      }
    },

    // table_load_json(path) → {headers, rows}
    "table_load_json": (filePath: string): TableData => {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          throw new Error("JSON must be array of objects");
        }

        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        return { headers, rows: data };
      } catch (err: any) {
        throw new Error(`table_load_json failed: ${err.message}`);
      }
    },

    // table_save_csv(data, path) → boolean
    "table_save_csv": (data: TableData, filePath: string): boolean => {
      try {
        const csv = [
          data.headers.join(","),
          ...data.rows.map(row =>
            data.headers.map(h => row[h] ?? "").join(",")
          )
        ].join("\n");

        fs.writeFileSync(filePath, csv, "utf-8");
        return true;
      } catch (err: any) {
        throw new Error(`table_save_csv failed: ${err.message}`);
      }
    },

    // table_select(data, cols[]) → filtered data
    "table_select": (data: TableData, cols: string[]): TableData => {
      try {
        const validCols = cols.filter(c => data.headers.includes(c));
        const rows = data.rows.map(row => {
          const newRow: Record<string, any> = {};
          validCols.forEach(c => newRow[c] = row[c]);
          return newRow;
        });
        return { headers: validCols, rows };
      } catch (err: any) {
        throw new Error(`table_select failed: ${err.message}`);
      }
    },

    // table_filter(data, predicate) → filtered data
    "table_filter": (data: TableData, predicate: (row: any) => boolean): TableData => {
      try {
        const rows = data.rows.filter(predicate);
        return { headers: data.headers, rows };
      } catch (err: any) {
        throw new Error(`table_filter failed: ${err.message}`);
      }
    },

    // table_map(data, fn) → transformed data
    "table_map": (data: TableData, fn: (row: any) => any): TableData => {
      try {
        const rows = data.rows.map(fn);
        return { headers: data.headers, rows };
      } catch (err: any) {
        throw new Error(`table_map failed: ${err.message}`);
      }
    },

    // table_sort(data, col, order) → sorted data
    "table_sort": (data: TableData, col: string, order: "asc" | "desc" = "asc"): TableData => {
      try {
        const rows = [...data.rows].sort((a, b) => {
          const aVal = a[col];
          const bVal = b[col];
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return order === "desc" ? -cmp : cmp;
        });
        return { headers: data.headers, rows };
      } catch (err: any) {
        throw new Error(`table_sort failed: ${err.message}`);
      }
    },

    // table_group_by(data, col) → {key: rows[]}
    "table_group_by": (data: TableData, col: string): Record<string, any[]> => {
      try {
        const groups: Record<string, any[]> = {};
        data.rows.forEach(row => {
          const key = String(row[col]);
          if (!groups[key]) groups[key] = [];
          groups[key].push(row);
        });
        return groups;
      } catch (err: any) {
        throw new Error(`table_group_by failed: ${err.message}`);
      }
    },

    // table_aggregate(data, col, func) → number
    "table_aggregate": (data: TableData, col: string, func: "sum" | "mean" | "min" | "max" | "count"): number => {
      try {
        const values = data.rows.map(r => r[col]).filter(v => v !== null && v !== undefined);

        if (func === "count") return values.length;
        if (values.length === 0) return 0;

        if (func === "sum") return values.reduce((a, b) => a + b, 0);
        if (func === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
        if (func === "min") return Math.min(...values);
        if (func === "max") return Math.max(...values);

        return 0;
      } catch (err: any) {
        throw new Error(`table_aggregate failed: ${err.message}`);
      }
    },

    // table_join(data1, data2, on) → joined data
    "table_join": (data1: TableData, data2: TableData, onCol: string): TableData => {
      try {
        const joinMap = new Map();
        data2.rows.forEach(r => joinMap.set(r[onCol], r));

        const rows = data1.rows.map(r1 => {
          const r2 = joinMap.get(r1[onCol]);
          return r2 ? { ...r1, ...r2 } : r1;
        });

        const headers = [...new Set([...data1.headers, ...data2.headers])];
        return { headers, rows };
      } catch (err: any) {
        throw new Error(`table_join failed: ${err.message}`);
      }
    },

    // table_head(data, n) → first n rows
    "table_head": (data: TableData, n: number = 5): TableData => {
      try {
        return { headers: data.headers, rows: data.rows.slice(0, n) };
      } catch (err: any) {
        throw new Error(`table_head failed: ${err.message}`);
      }
    },

    // table_tail(data, n) → last n rows
    "table_tail": (data: TableData, n: number = 5): TableData => {
      try {
        return { headers: data.headers, rows: data.rows.slice(-n) };
      } catch (err: any) {
        throw new Error(`table_tail failed: ${err.message}`);
      }
    },

    // table_shape(data) → {rows, cols}
    "table_shape": (data: TableData): any => {
      try {
        return { rows: data.rows.length, cols: data.headers.length };
      } catch (err: any) {
        throw new Error(`table_shape failed: ${err.message}`);
      }
    }
  };
}
