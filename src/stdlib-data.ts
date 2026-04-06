// FreeLang v9: Data Transform Standard Library
// Phase 13: JSON manipulation + CSV + template — AI-native data pipeline
//
// AI agents constantly receive/produce structured data.
// These primitives let the language transform it natively.

/**
 * Create the data transform module for FreeLang v9
 */
export function createDataModule() {
  return {
    // ── JSON ──────────────────────────────────────────────────

    // json_get obj path -> any  (dot-path access: "user.name" or "items.0")
    "json_get": (obj: any, path: string): any => {
      const parts = path.split(".");
      let cur = typeof obj === "string" ? JSON.parse(obj) : obj;
      for (const p of parts) {
        if (cur === null || cur === undefined) return null;
        cur = Array.isArray(cur) ? cur[parseInt(p, 10)] : cur[p];
      }
      return cur ?? null;
    },

    // json_set obj path value -> object (immutable update, returns new obj)
    "json_set": (obj: any, path: string, value: any): any => {
      const parsed = typeof obj === "string" ? JSON.parse(obj) : obj;
      const clone = JSON.parse(JSON.stringify(parsed));
      const parts = path.split(".");
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (cur[p] === undefined || cur[p] === null) cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return clone;
    },

    // json_merge obj1 obj2 -> object (shallow merge, obj2 wins on conflict)
    "json_merge": (obj1: any, obj2: any): any => {
      const a = typeof obj1 === "string" ? JSON.parse(obj1) : obj1;
      const b = typeof obj2 === "string" ? JSON.parse(obj2) : obj2;
      return { ...a, ...b };
    },

    // json_deep_merge obj1 obj2 -> object (deep recursive merge)
    "json_deep_merge": (obj1: any, obj2: any): any => {
      const a = typeof obj1 === "string" ? JSON.parse(obj1) : obj1;
      const b = typeof obj2 === "string" ? JSON.parse(obj2) : obj2;
      function deepMerge(x: any, y: any): any {
        if (typeof x !== "object" || x === null || Array.isArray(x)) return y;
        if (typeof y !== "object" || y === null || Array.isArray(y)) return y;
        const result = { ...x };
        for (const k of Object.keys(y)) {
          result[k] = k in x ? deepMerge(x[k], y[k]) : y[k];
        }
        return result;
      }
      return deepMerge(a, b);
    },

    // json_keys obj -> [string] (get keys of object)
    "json_keys": (obj: any): string[] => {
      const o = typeof obj === "string" ? JSON.parse(obj) : obj;
      return Object.keys(o);
    },

    // json_vals obj -> [any] (get values of object)
    "json_vals": (obj: any): any[] => {
      const o = typeof obj === "string" ? JSON.parse(obj) : obj;
      return Object.values(o);
    },

    // json_str obj -> string (serialize to JSON string)
    "json_str": (obj: any): string => {
      return JSON.stringify(obj);
    },

    // json_pretty obj -> string (pretty-print JSON)
    "json_pretty": (obj: any): string => {
      const o = typeof obj === "string" ? JSON.parse(obj) : obj;
      return JSON.stringify(o, null, 2);
    },

    // json_has obj key -> boolean (check if key exists)
    "json_has": (obj: any, key: string): boolean => {
      const o = typeof obj === "string" ? JSON.parse(obj) : obj;
      return key in o;
    },

    // json_del obj key -> object (delete key, returns new obj)
    "json_del": (obj: any, key: string): any => {
      const o = typeof obj === "string" ? JSON.parse(obj) : obj;
      const clone = { ...o };
      delete clone[key];
      return clone;
    },

    // ── CSV ───────────────────────────────────────────────────

    // csv_parse str -> [[string]] (parse CSV string to rows)
    "csv_parse": (str: string): string[][] => {
      const lines = str.trim().split("\n");
      return lines.map(line => {
        const result: string[] = [];
        let cur = "";
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
            else inQuote = !inQuote;
          } else if (ch === "," && !inQuote) {
            result.push(cur); cur = "";
          } else {
            cur += ch;
          }
        }
        result.push(cur);
        return result;
      });
    },

    // csv_write rows -> string (serialize rows to CSV string)
    "csv_write": (rows: string[][]): string => {
      return rows.map(row =>
        row.map(cell => {
          const s = String(cell);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(",")
      ).join("\n");
    },

    // csv_header rows -> [string] (get first row as header)
    "csv_header": (rows: string[][]): string[] => {
      return rows[0] ?? [];
    },

    // csv_to_objects rows -> [{header: value}] (rows to named objects)
    "csv_to_objects": (rows: string[][]): Record<string, string>[] => {
      if (rows.length < 2) return [];
      const headers = rows[0];
      return rows.slice(1).map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
        return obj;
      });
    },

    // ── String Template ───────────────────────────────────────

    // str_template template vars -> string  ({key} → value substitution)
    "str_template": (template: string, vars: Record<string, any>): string => {
      return template.replace(/\{(\w+)\}/g, (_, key) =>
        vars[key] !== undefined ? String(vars[key]) : `{${key}}`
      );
    },

    // str_lines str -> [string] (split into lines)
    "str_lines": (str: string): string[] => {
      return str.split("\n");
    },

    // str_join_lines lines -> string
    "str_join_lines": (lines: string[]): string => {
      return lines.join("\n");
    },

    // str_trim str -> string
    "str_trim": (str: string): string => {
      return str.trim();
    },

    // str_words str -> [string] (split by whitespace)
    "str_words": (str: string): string[] => {
      return str.trim().split(/\s+/);
    },

    // str_count str sub -> number (count occurrences of sub in str)
    "str_count": (str: string, sub: string): number => {
      let count = 0, pos = 0;
      while ((pos = str.indexOf(sub, pos)) !== -1) { count++; pos += sub.length; }
      return count;
    },
  };
}
