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

    // self-hosting 경로에서 bootstrap parser가 생성한 JS Map 형태의 AST fields를
    // FL 코드가 순회할 수 있도록 노출. 기존 AST 구조 변경 없음, 관찰 인터페이스만 추가.
    // map-entries m -> [[k,v],...] (introspection primitive — JS Map/plain object 모두 열거)
    "map-entries": (m: any): any[] => {
      if (m instanceof Map) return [...m.entries()].map(([k, v]) => [k, v]);
      if (m && typeof m === "object" && !Array.isArray(m)) return Object.entries(m).map(([k, v]) => [k, v]);
      return [];
    },
    // map_entries m -> [[k,v],...] (alias for map-entries)
    "map_entries": (m: any): any[] => {
      if (m instanceof Map) return [...m.entries()].map(([k, v]) => [k, v]);
      if (m && typeof m === "object" && !Array.isArray(m)) return Object.entries(m).map(([k, v]) => [k, v]);
      return [];
    },

    // json_parse str -> object (parse JSON string to object)
    "json_parse": (str: string): any => {
      try {
        return JSON.parse(str);
      } catch (e: any) {
        throw new Error(`json_parse: invalid JSON: ${e.message}`);
      }
    },

    // json_str obj -> string (serialize to JSON string)
    "json_str": (obj: any): string => {
      return JSON.stringify(obj);
    },

    // json_stringify obj -> string (alias for json_str)
    "json_stringify": (obj: any): string => {
      return JSON.stringify(obj);
    },

    // json_pretty obj -> string (pretty-print JSON)
    "json_pretty": (obj: any): string => {
      const o = typeof obj === "string" ? JSON.parse(obj) : obj;
      return JSON.stringify(o, null, 2);
    },

    // ── Hyphen alias (Phase 후속 — Claude 평가에서 발견된 자주 틀리는 함수명) ──
    // AI가 Lisp 관례 따라 hyphen으로 작성하는 경우 호환
    "json-parse": (str: string): any => { try { return JSON.parse(str); } catch (e: any) { throw new Error(`json-parse: invalid JSON: ${e.message}`); } },
    "json-stringify": (obj: any): string => JSON.stringify(obj),
    "json-str": (obj: any): string => JSON.stringify(obj),
    "json-pretty": (obj: any): string => { const o = typeof obj === "string" ? JSON.parse(obj) : obj; return JSON.stringify(o, null, 2); },
    "json-merge": (a: any, b: any): any => {
      const x = typeof a === "string" ? JSON.parse(a) : a;
      const y = typeof b === "string" ? JSON.parse(b) : b;
      return { ...x, ...y };
    },
    "json-get": (obj: any, path: string): any => {
      const parts = String(path).split(".");
      let cur = typeof obj === "string" ? JSON.parse(obj) : obj;
      for (const p of parts) {
        if (cur === null || cur === undefined) return null;
        cur = Array.isArray(cur) ? cur[parseInt(p, 10)] : cur[p];
      }
      return cur ?? null;
    },
    "json-set": (obj: any, path: string, value: any): any => {
      const parsed = typeof obj === "string" ? JSON.parse(obj) : obj;
      const clone = JSON.parse(JSON.stringify(parsed));
      const parts = String(path).split(".");
      let cur = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        const p = parts[i];
        if (cur[p] === undefined || cur[p] === null) cur[p] = {};
        cur = cur[p];
      }
      cur[parts[parts.length - 1]] = value;
      return clone;
    },
    "json-keys": (obj: any): string[] => obj && typeof obj === "object" && !Array.isArray(obj) ? Object.keys(obj) : [],
    "json-vals": (obj: any): any[] => obj && typeof obj === "object" && !Array.isArray(obj) ? Object.values(obj) : [],
    "json-values": (obj: any): any[] => obj && typeof obj === "object" && !Array.isArray(obj) ? Object.values(obj) : [],

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

    // ── Number formatting (accounting) ────────────────────────

    // number_format num decimals -> string  (1234567 0 -> "1,234,567")
    "number_format": (num: number, decimals: number = 0): string => {
      const n = Number(num);
      if (isNaN(n)) return "0";
      const fixed = n.toFixed(decimals);
      const [intPart, decPart] = fixed.split(".");
      const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return decPart ? `${withComma}.${decPart}` : withComma;
    },

    // to_fixed num decimals -> string  (3.14159 2 -> "3.14")
    "to_fixed": (num: number, decimals: number = 2): string => {
      const n = Number(num);
      if (isNaN(n)) return "0";
      return n.toFixed(decimals);
    },

    // format_currency num code -> string  (1234567 "KRW" -> "₩1,234,567")
    "format_currency": (num: number, code: string = "KRW"): string => {
      const n = Number(num);
      if (isNaN(n)) return "0";
      const symbol: Record<string, string> = { KRW: "₩", USD: "$", EUR: "€", JPY: "¥", CNY: "¥", GBP: "£" };
      const decimals = code === "KRW" || code === "JPY" ? 0 : 2;
      const fixed = n.toFixed(decimals);
      const [intPart, decPart] = fixed.split(".");
      const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      const sign = symbol[code] ?? code + " ";
      return decPart ? `${sign}${withComma}.${decPart}` : `${sign}${withComma}`;
    },

    // ── str_ 확장 (Python str 47개 수준) ──────────────────────
    "str_upper": (s: string) => String(s).toUpperCase(),
    "str_lower": (s: string) => String(s).toLowerCase(),
    "str_capitalize": (s: string) => { const t = String(s); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); },
    "str_title": (s: string) => String(s).replace(/\b\w/g, (c) => c.toUpperCase()),
    "str_swapcase": (s: string) => String(s).split("").map((c) => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(""),
    "str_reverse": (s: string) => String(s).split("").reverse().join(""),
    "str_repeat": (s: string, n: number) => String(s).repeat(Number(n)),
    "str_pad_left": (s: string, width: number, ch: string = " ") => String(s).padStart(Number(width), ch || " "),
    "str_pad_right": (s: string, width: number, ch: string = " ") => String(s).padEnd(Number(width), ch || " "),
    "str_center": (s: string, width: number, ch: string = " ") => {
      const t = String(s); const w = Number(width); if (t.length >= w) return t;
      const pad = w - t.length; const left = Math.floor(pad / 2); const right = pad - left;
      return (ch || " ").repeat(left) + t + (ch || " ").repeat(right);
    },
    "str_zfill": (s: string, width: number) => String(s).padStart(Number(width), "0"),
    "str_lstrip": (s: string, ch?: string) => ch ? String(s).replace(new RegExp(`^[${ch.replace(/[-\\]]/g,"\\$&")}]+`), "") : String(s).trimStart(),
    "str_rstrip": (s: string, ch?: string) => ch ? String(s).replace(new RegExp(`[${ch.replace(/[-\\]]/g,"\\$&")}]+$`), "") : String(s).trimEnd(),
    "str_replace": (s: string, old: string, rep: string, count?: number) => {
      let t = String(s); const n = count !== undefined ? Number(count) : Infinity; let i = 0;
      return t.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), "g"), (m) => i++ < n ? rep : m);
    },
    "str_starts": (s: string, prefix: string) => String(s).startsWith(prefix),
    "str_ends": (s: string, suffix: string) => String(s).endsWith(suffix),
    "str_includes": (s: string, sub: string) => String(s).includes(sub),
    "str_find": (s: string, sub: string, start: number = 0) => String(s).indexOf(sub, Number(start)),
    "str_rfind": (s: string, sub: string) => String(s).lastIndexOf(sub),
    "str_index": (s: string, sub: string, start: number = 0) => {
      const i = String(s).indexOf(sub, Number(start));
      if (i === -1) throw new Error(`str_index: substring "${sub}" not found`);
      return i;
    },
    "str_split": (s: string, sep: string, maxsplit?: number) => {
      const t = String(s); if (maxsplit !== undefined) { const parts = []; let i = 0, n = Number(maxsplit);
        while (n-- > 0) { const j = sep ? t.indexOf(sep, i) : i + 1; if (j === -1) break; parts.push(t.slice(i, j)); i = j + (sep?.length || 1); }
        parts.push(t.slice(i)); return parts; }
      return sep ? t.split(sep) : t.split("");
    },
    "str_rsplit": (s: string, sep: string, maxsplit?: number) => {
      const t = String(s); if (maxsplit === undefined) return sep ? t.split(sep) : t.split("");
      const parts = []; let i = t.length; let n = Number(maxsplit);
      while (n-- > 0) { const j = t.lastIndexOf(sep, i - 1); if (j === -1) break; parts.unshift(t.slice(j + sep.length, i)); i = j; }
      parts.unshift(t.slice(0, i)); return parts;
    },
    "str_join": (a: any, b: any) => {
      // P0 자잘 #5 (2026-04-25): 인자 순서 자동 감지 (filter 패턴과 동일)
      // (str_join sep arr) 또는 (str_join arr sep) 모두 허용
      if (Array.isArray(a)) return a.join(String(b ?? ""));
      if (Array.isArray(b)) return b.join(String(a ?? ""));
      return "";
    },
    "str-join": (a: any, b: any) => {
      if (Array.isArray(a)) return a.join(String(b ?? ""));
      if (Array.isArray(b)) return b.join(String(a ?? ""));
      return "";
    },
    "str_partition": (s: string, sep: string) => {
      const i = String(s).indexOf(sep); if (i === -1) return [s, "", ""];
      return [s.slice(0, i), sep, s.slice(i + sep.length)];
    },
    "str_rpartition": (s: string, sep: string) => {
      const i = String(s).lastIndexOf(sep); if (i === -1) return ["", "", s];
      return [s.slice(0, i), sep, s.slice(i + sep.length)];
    },
    "str_slice": (s: string, start: number, end?: number) => String(s).slice(Number(start), end !== undefined ? Number(end) : undefined),
    "str_removeprefix": (s: string, prefix: string) => { const t = String(s); return t.startsWith(prefix) ? t.slice(prefix.length) : t; },
    "str_removesuffix": (s: string, suffix: string) => { const t = String(s); return t.endsWith(suffix) ? t.slice(0, -suffix.length) : t; },
    "str_expandtabs": (s: string, tabsize: number = 8) => String(s).replace(/\t/g, " ".repeat(Number(tabsize))),
    "str_isalpha": (s: string) => /^[a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ]+$/.test(String(s)),
    "str_isdigit": (s: string) => /^\d+$/.test(String(s)),
    "str_isalnum": (s: string) => /^[a-zA-Z0-9가-힣]+$/.test(String(s)),
    "str_islower": (s: string) => { const t = String(s); return t === t.toLowerCase() && t !== t.toUpperCase(); },
    "str_isupper": (s: string) => { const t = String(s); return t === t.toUpperCase() && t !== t.toLowerCase(); },
    "str_isspace": (s: string) => /^\s+$/.test(String(s)),
    "str_istitle": (s: string) => String(s) === String(s).replace(/\b\w/g, (c) => c.toUpperCase()),
    "str_encode_base64": (s: string) => btoa(unescape(encodeURIComponent(s))),
    "str_decode_base64": (s: string) => decodeURIComponent(escape(atob(s))),
    "str_encode_uri": (s: string) => encodeURIComponent(String(s)),
    "str_decode_uri": (s: string) => decodeURIComponent(String(s)),

    // str_fmt template map → 문자열 보간
    // (str_fmt "안녕 {name}, {age}살" {:name "김진돌" :age 30})
    // → "안녕 김진돌, 30살"
    "str_fmt": (template: string, vars: any): string => {
      if (typeof template !== "string") return String(template);
      const get = (obj: any, key: string): any =>
        obj instanceof Map ? (obj.get(key) ?? obj.get(":" + key)) : obj?.[key];
      return template.replace(/\{(\w+)\}/g, (_, key) => {
        const v = get(vars, key);
        return v !== undefined && v !== null ? String(v) : `{${key}}`;
      });
    },

    // str/fmt alias
    "str/fmt": (template: string, vars: any): string => {
      if (typeof template !== "string") return String(template);
      const get = (obj: any, key: string): any =>
        obj instanceof Map ? (obj.get(key) ?? obj.get(":" + key)) : obj?.[key];
      return template.replace(/\{(\w+)\}/g, (_, key) => {
        const v = get(vars, key);
        return v !== undefined && v !== null ? String(v) : `{${key}}`;
      });
    },
  };
}
