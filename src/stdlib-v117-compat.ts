// FreeLang v11.7 compatibility helpers.
// Kept as a separate module so the main stdlib loader remains declarative.

import { fnMetaRegistry } from "./eval-special-forms";

function valueType(value: any): string {
  if (value === null) return "nil";
  if (Array.isArray(value)) return "array";
  if (typeof value === "function") return "function";
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return typeof value;
  }
  return "map";
}

export function createV117CompatModule(): Record<string, (...args: any[]) => any> {
  const module: Record<string, (...args: any[]) => any> = {
    "fn-meta": (name: string): any => {
      const meta = fnMetaRegistry.get(name);
      if (!meta) return null;
      const result = new Map<string, any>();
      if (meta.doc) result.set("doc", meta.doc);
      if (meta.returns) result.set("returns", meta.returns);
      if (meta.context) result.set("context", meta.context);
      if (meta.effects) result.set("effects", meta.effects);
      if (meta.examples) result.set("examples", meta.examples);
      return result;
    },
    "check-arg-type": (arg: any, expected: string): any => {
      const actual = valueType(arg);
      if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
      return arg;
    },
    "validate-args": (args: any[], types: string[]): any[] => {
      const values = Array.isArray(args) ? args : [args];
      const expected = Array.isArray(types) ? types : [types];
      for (let i = 0; i < Math.min(values.length, expected.length); i++) {
        const actual = valueType(values[i]);
        if (actual !== expected[i]) throw new Error(`Argument ${i}: expected ${expected[i]}, got ${actual}`);
      }
      return values;
    },
    "re-match": (pattern: string, value: string): string | null => {
      try { return String(value).match(new RegExp(pattern))?.[0] ?? null; } catch { return null; }
    },
    "re-test": (pattern: string, value: string): boolean => {
      try { return new RegExp(pattern).test(String(value)); } catch { return false; }
    },
    "re-find": (pattern: string, value: string): string | null => {
      try { return String(value).match(new RegExp(pattern))?.[0] ?? null; } catch { return null; }
    },
    "re-find-all": (pattern: string, value: string): string[] => {
      try { return [...String(value).matchAll(new RegExp(pattern, "g"))].map(match => match[0]); } catch { return []; }
    },
    "re-split": (pattern: string, value: string): string[] => {
      try { return String(value).split(new RegExp(pattern)); } catch { return [String(value)]; }
    },
    "re-groups": (pattern: string, value: string): string[] | null => {
      try { const match = String(value).match(new RegExp(pattern)); return match ? [...match] : null; } catch { return null; }
    },
    "str-truncate": (value: any, len: number, suffix = "..."): string => {
      const text = String(value);
      return text.length > len ? text.substring(0, Math.max(0, len - suffix.length)) + suffix : text;
    },
    "format-number": (value: any, decimals = 0): string =>
      Number(value).toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }),
    "format-decimal": (value: any, places = 2): string => Number(value).toFixed(Math.max(0, places)),
    "format-percent": (value: any, decimals = 1): string => `${(Number(value) * 100).toFixed(Math.max(0, decimals))}%`,
    "str-repeat-n": (value: string, count: number): string => String(value).repeat(Math.max(0, count)),
    "nth-last": (arr: any[], n: number): any => {
      const values = Array.isArray(arr) ? arr : [];
      const index = values.length - (Math.max(0, n) + 1);
      return index >= 0 ? values[index] : null;
    },
    "take-last": (arr: any[], n: number): any[] => {
      const values = Array.isArray(arr) ? arr : [];
      const count = Math.max(0, n);
      return count >= values.length ? values : values.slice(-count);
    },
    "starts-with": (value: string, prefix: string): boolean => String(value).startsWith(String(prefix)),
    "ends-with": (value: string, suffix: string): boolean => String(value).endsWith(String(suffix)),
    "flatten-one": (arr: any[]): any[] => Array.isArray(arr) ? arr.flat(1) : [],
    "chunk": (arr: any[], size: number): any[][] => {
      if (!Array.isArray(arr) || size <= 0) return [];
      const chunks: any[][] = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    },
    "compact": (arr: any[]): any[] => Array.isArray(arr)
      ? arr.filter(value => value !== null && value !== undefined && value !== false && value !== "")
      : [],
    "random-element": (arr: any[]): any => Array.isArray(arr) && arr.length > 0
      ? arr[Math.floor(Math.random() * arr.length)]
      : null,
  };

  const aliases: Record<string, string> = {
    "fn_meta": "fn-meta", "check_arg_type": "check-arg-type", "validate_args": "validate-args",
    "re_match": "re-match", "re_test": "re-test", "re_find": "re-find",
    "re_find_all": "re-find-all", "re_split": "re-split", "re_groups": "re-groups",
    "str_truncate": "str-truncate", "format_number": "format-number",
    "format_decimal": "format-decimal", "format_percent": "format-percent",
    "str_repeat_n": "str-repeat-n", "nth_last": "nth-last", "take_last": "take-last",
    "starts_with": "starts-with", "ends_with": "ends-with", "flatten_one": "flatten-one",
  };
  for (const [alias, target] of Object.entries(aliases)) module[alias] = (...args: any[]) => module[target](...args);
  return module;
}
