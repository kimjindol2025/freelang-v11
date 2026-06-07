var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-content.ts
var ext_content_exports = {};
__export(ext_content_exports, {
  createBlogModule: () => createBlogModule,
  createMarkdownModule: () => createMarkdownModule,
  createMiddlewareModule: () => createMiddlewareModule,
  createTableModule: () => createTableModule,
  createValidationModule: () => createValidationModule
});
module.exports = __toCommonJS(ext_content_exports);

// src/stdlib-markdown.ts
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function parseFrontmatter(src) {
  const fm = {};
  if (!src.startsWith("---\n") && !src.startsWith("---\r\n")) {
    return { fm, body: src };
  }
  const rest = src.replace(/^---\r?\n/, "");
  const match = rest.match(/\n---[ \t]*(\r?\n|$)/);
  const end = match ? rest.indexOf(match[0]) : -1;
  if (end < 0) return { fm, body: src };
  const block = rest.slice(0, end);
  const body = rest.slice(end).replace(/^\n---\r?\n?/, "");
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (/^(true|false)$/i.test(String(val))) val = String(val).toLowerCase() === "true";
    else if (/^-?\d+(\.\d+)?$/.test(String(val))) val = Number(val);
    else if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    fm[m[1]] = val;
  }
  return { fm, body };
}
function renderInline(s) {
  const codeSlots = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code) => {
    codeSlots.push(`<code>${escapeHtml(code)}</code>`);
    return `\0C${codeSlots.length - 1}\0`;
  });
  s = escapeHtml(s);
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, alt, url, title) => title ? `<img src="${url}" alt="${alt}" title="${title}" loading="lazy" decoding="async">` : `<img src="${url}" alt="${alt}" loading="lazy" decoding="async">`
  );
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (_m, text, url, title) => title ? `<a href="${url}" title="${title}">${text}</a>` : `<a href="${url}">${text}</a>`
  );
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\x00C(\d+)\x00/g, (_m, i) => codeSlots[Number(i)] || "");
  return s;
}
function tokenize(body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const fenceOpen = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/);
    if (fenceOpen) {
      const lang = fenceOpen[1] || "";
      i++;
      const codeLines = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      out.push({ kind: "code", lang, text: codeLines.join("\n") });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push({ kind: "hr" });
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      out.push({ kind: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push({ kind: "quote", lines: quoteLines });
      continue;
    }
    const ulMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items = [];
      const re = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
      while (i < lines.length) {
        const m = lines[i].match(re);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }
    const paraLines = [line];
    i++;
    while (i < lines.length) {
      const n = lines[i];
      if (/^\s*$/.test(n)) break;
      if (/^#{1,6}\s/.test(n)) break;
      if (/^```/.test(n)) break;
      if (/^>\s?/.test(n)) break;
      if (/^\s*[-*+]\s+/.test(n)) break;
      if (/^\s*\d+\.\s+/.test(n)) break;
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(n)) break;
      paraLines.push(n);
      i++;
    }
    out.push({ kind: "paragraph", text: paraLines.join(" ") });
  }
  return out;
}
function renderBlock(b) {
  switch (b.kind) {
    case "heading":
      return `<h${b.level}>${renderInline(b.text)}</h${b.level}>`;
    case "paragraph":
      return `<p>${renderInline(b.text)}</p>`;
    case "code":
      return b.lang ? `<pre><code class="language-${escapeHtml(b.lang)}">${escapeHtml(b.text)}</code></pre>` : `<pre><code>${escapeHtml(b.text)}</code></pre>`;
    case "quote": {
      const inner = tokenize(b.lines.join("\n")).map(renderBlock).join("");
      return `<blockquote>${inner}</blockquote>`;
    }
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items.map((it) => `<li>${renderInline(it)}</li>`).join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "hr":
      return `<hr>`;
  }
}
function createMarkdownModule() {
  return {
    // markdown_to_html md -> html string
    "markdown_to_html": (src) => {
      if (typeof src !== "string") return "";
      const { body } = parseFrontmatter(src);
      return tokenize(body).map(renderBlock).join("");
    },
    // markdown_frontmatter md -> { fm: {...}, body: "..." }
    "markdown_frontmatter": (src) => {
      if (typeof src !== "string") return { fm: {}, body: "" };
      return parseFrontmatter(src);
    },
    // markdown_render_full md -> { fm, html }
    "markdown_render_full": (src) => {
      if (typeof src !== "string") return { fm: {}, html: "" };
      const { fm, body } = parseFrontmatter(src);
      const html = tokenize(body).map(renderBlock).join("");
      return { fm, html };
    }
  };
}

// src/stdlib-blog.ts
function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").replace(/\s+/g, " ").trim();
}
function createBlogModule() {
  return {
    // blog_all_tags [posts] → [tag1, tag2, ...] unique, sorted by count desc
    "blog_all_tags": (posts) => {
      const counts = /* @__PURE__ */ new Map();
      for (const p of posts || []) {
        for (const t of p.tags || []) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map((e) => e[0]);
    },
    // blog_posts_by_tag [posts] tag → posts with that tag, newest first
    "blog_posts_by_tag": (posts, tag) => {
      const filtered = (posts || []).filter((p) => (p.tags || []).includes(tag));
      return filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },
    // blog_tag_counts [posts] → {tag: count, ...}
    "blog_tag_counts": (posts) => {
      const counts = {};
      for (const p of posts || []) {
        for (const t of p.tags || []) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
      return counts;
    },
    // blog_related [posts] currentSlug limit → posts sharing most tags,
    // excluding the current post, newest as tiebreak.
    "blog_related": (posts, currentSlug, limit = 5) => {
      const current = (posts || []).find((p) => p.slug === currentSlug);
      if (!current) return [];
      const currentTags = new Set(current.tags || []);
      const scored = (posts || []).filter((p) => p.slug !== currentSlug).map((p) => ({
        post: p,
        score: (p.tags || []).filter((t) => currentTags.has(t)).length,
        date: p.date || ""
      })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
      return scored.slice(0, Math.max(0, limit)).map((x) => x.post);
    },
    // blog_search_index [posts] → [{slug, title, url, body_terms}] compact JSON
    // body_terms: space-joined normalized words, limited to 500 chars.
    "blog_search_index": (posts) => {
      return (posts || []).map((p) => ({
        slug: p.slug,
        title: p.title,
        url: p.url || `/blog/${p.slug}`,
        terms: normalize(`${p.title} ${p.summary || ""} ${p.body || ""}`).slice(0, 500)
      }));
    },
    // blog_search [index] query → top matches by term overlap score
    "blog_search": (index, query, limit = 10) => {
      const q = normalize(query);
      if (!q) return [];
      const terms = q.split(" ").filter(Boolean);
      const results = (index || []).map((entry) => {
        let score = 0;
        for (const t of terms) {
          if (entry.title.toLowerCase().includes(t)) score += 3;
          if (entry.terms.includes(t)) score += 1;
        }
        return { entry, score };
      }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, Math.max(0, limit)).map((r) => ({ slug: r.entry.slug, title: r.entry.title, url: r.entry.url, score: r.score }));
      return results;
    },
    // blog_posts_sorted [posts] → newest first
    "blog_posts_sorted": (posts) => {
      return [...posts || []].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    },
    // blog_paginate [posts] page per-page → {items, total, page, pages}
    "blog_paginate": (posts, page = 1, perPage = 10) => {
      const all = posts || [];
      const pp = Math.max(1, perPage);
      const pages = Math.max(1, Math.ceil(all.length / pp));
      const p = Math.min(Math.max(1, page), pages);
      const start = (p - 1) * pp;
      return {
        items: all.slice(start, start + pp),
        total: all.length,
        page: p,
        pages,
        perPage: pp,
        hasPrev: p > 1,
        hasNext: p < pages
      };
    }
  };
}

// src/stdlib-table.ts
var fs = __toESM(require("fs"));
function createTableModule() {
  return {
    // table_load_csv(path) → {headers, rows}
    "table_load_csv": (filePath) => {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").filter((l) => l.trim());
        const headers = lines[0].split(",").map((h) => h.trim());
        const rows = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim());
          const row = {};
          headers.forEach((h, i) => {
            const val = values[i];
            row[h] = isNaN(Number(val)) ? val : Number(val);
          });
          return row;
        });
        return { headers, rows };
      } catch (err) {
        throw new Error(`table_load_csv failed: ${err.message}`);
      }
    },
    // table_load_json(path) → {headers, rows}
    "table_load_json": (filePath) => {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);
        if (!Array.isArray(data)) {
          throw new Error("JSON must be array of objects");
        }
        const headers = data.length > 0 ? Object.keys(data[0]) : [];
        return { headers, rows: data };
      } catch (err) {
        throw new Error(`table_load_json failed: ${err.message}`);
      }
    },
    // table_save_csv(data, path) → boolean
    "table_save_csv": (data, filePath) => {
      try {
        const csv = [
          data.headers.join(","),
          ...data.rows.map(
            (row) => data.headers.map((h) => row[h] ?? "").join(",")
          )
        ].join("\n");
        fs.writeFileSync(filePath, csv, "utf-8");
        return true;
      } catch (err) {
        throw new Error(`table_save_csv failed: ${err.message}`);
      }
    },
    // table_select(data, cols[]) → filtered data
    "table_select": (data, cols) => {
      try {
        const validCols = cols.filter((c) => data.headers.includes(c));
        const rows = data.rows.map((row) => {
          const newRow = {};
          validCols.forEach((c) => newRow[c] = row[c]);
          return newRow;
        });
        return { headers: validCols, rows };
      } catch (err) {
        throw new Error(`table_select failed: ${err.message}`);
      }
    },
    // table_filter(data, predicate) → filtered data
    "table_filter": (data, predicate) => {
      try {
        const rows = data.rows.filter(predicate);
        return { headers: data.headers, rows };
      } catch (err) {
        throw new Error(`table_filter failed: ${err.message}`);
      }
    },
    // table_map(data, fn) → transformed data
    "table_map": (data, fn) => {
      try {
        const rows = data.rows.map(fn);
        return { headers: data.headers, rows };
      } catch (err) {
        throw new Error(`table_map failed: ${err.message}`);
      }
    },
    // table_sort(data, col, order) → sorted data
    "table_sort": (data, col, order = "asc") => {
      try {
        const rows = [...data.rows].sort((a, b) => {
          const aVal = a[col];
          const bVal = b[col];
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return order === "desc" ? -cmp : cmp;
        });
        return { headers: data.headers, rows };
      } catch (err) {
        throw new Error(`table_sort failed: ${err.message}`);
      }
    },
    // table_group_by(data, col) → {key: rows[]}
    "table_group_by": (data, col) => {
      try {
        const groups = {};
        data.rows.forEach((row) => {
          const key = String(row[col]);
          if (!groups[key]) groups[key] = [];
          groups[key].push(row);
        });
        return groups;
      } catch (err) {
        throw new Error(`table_group_by failed: ${err.message}`);
      }
    },
    // table_aggregate(data, col, func) → number
    "table_aggregate": (data, col, func) => {
      try {
        const values = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== void 0);
        if (func === "count") return values.length;
        if (values.length === 0) return 0;
        if (func === "sum") return values.reduce((a, b) => a + b, 0);
        if (func === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
        if (func === "min") return Math.min(...values);
        if (func === "max") return Math.max(...values);
        return 0;
      } catch (err) {
        throw new Error(`table_aggregate failed: ${err.message}`);
      }
    },
    // table_join(data1, data2, on) → joined data
    "table_join": (data1, data2, onCol) => {
      try {
        const joinMap = /* @__PURE__ */ new Map();
        data2.rows.forEach((r) => joinMap.set(r[onCol], r));
        const rows = data1.rows.map((r1) => {
          const r2 = joinMap.get(r1[onCol]);
          return r2 ? { ...r1, ...r2 } : r1;
        });
        const headers = [.../* @__PURE__ */ new Set([...data1.headers, ...data2.headers])];
        return { headers, rows };
      } catch (err) {
        throw new Error(`table_join failed: ${err.message}`);
      }
    },
    // table_head(data, n) → first n rows
    "table_head": (data, n = 5) => {
      try {
        return { headers: data.headers, rows: data.rows.slice(0, n) };
      } catch (err) {
        throw new Error(`table_head failed: ${err.message}`);
      }
    },
    // table_tail(data, n) → last n rows
    "table_tail": (data, n = 5) => {
      try {
        return { headers: data.headers, rows: data.rows.slice(-n) };
      } catch (err) {
        throw new Error(`table_tail failed: ${err.message}`);
      }
    },
    // table_shape(data) → {rows, cols}
    "table_shape": (data) => {
      try {
        return { rows: data.rows.length, cols: data.headers.length };
      } catch (err) {
        throw new Error(`table_shape failed: ${err.message}`);
      }
    }
  };
}

// src/stdlib-validation.ts
function createValidationModule() {
  const schemas = /* @__PURE__ */ new Map();
  return {
    // schema_define(name, fields) → schema
    "schema_define": (name, fields) => {
      try {
        const schema = { name, fields };
        schemas.set(name, schema);
        return schema;
      } catch (err) {
        throw new Error(`schema_define failed: ${err.message}`);
      }
    },
    // schema_validate(schema, data) → {valid: boolean, errors: []}
    "schema_validate": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }
        const errors = [];
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule);
          errors.push(...fieldErrors);
        }
        return {
          valid: errors.length === 0,
          errors,
          data: errors.length === 0 ? data : null
        };
      } catch (err) {
        throw new Error(`schema_validate failed: ${err.message}`);
      }
    },
    // schema_is_valid(schema, data) → boolean
    "schema_is_valid": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          return false;
        }
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const errors = validateField(fieldName, value, rule);
          if (errors.length > 0) {
            return false;
          }
        }
        return true;
      } catch (err) {
        return false;
      }
    },
    // schema_validate_or_throw(schema, data) → data or throws error
    "schema_validate_or_throw": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }
        const errors = [];
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule);
          errors.push(...fieldErrors);
        }
        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join(", ")}`);
        }
        return data;
      } catch (err) {
        throw new Error(`schema_validate_or_throw failed: ${err.message}`);
      }
    },
    // schema_get_errors(schema, data) → [error messages]
    "schema_get_errors": (schemaName, data) => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }
        const errors = [];
        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule);
          errors.push(...fieldErrors);
        }
        return errors;
      } catch (err) {
        throw new Error(`schema_get_errors failed: ${err.message}`);
      }
    },
    // schema_get(name) → schema definition
    "schema_get": (name) => {
      try {
        return schemas.get(name) || null;
      } catch (err) {
        throw new Error(`schema_get failed: ${err.message}`);
      }
    },
    // validate_email(email) → boolean
    "validate_email": (email) => {
      try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      } catch {
        return false;
      }
    },
    // validate_string(value, minLen, maxLen) → boolean
    "validate_string": (value, minLen, maxLen) => {
      try {
        if (typeof value !== "string") return false;
        if (minLen !== void 0 && value.length < minLen) return false;
        if (maxLen !== void 0 && value.length > maxLen) return false;
        return true;
      } catch {
        return false;
      }
    },
    // validate_number(value, min, max) → boolean
    "validate_number": (value, min, max) => {
      try {
        if (typeof value !== "number") return false;
        if (min !== void 0 && value < min) return false;
        if (max !== void 0 && value > max) return false;
        return true;
      } catch {
        return false;
      }
    },
    // validate_regex(value, pattern) → boolean
    "validate_regex": (value, pattern) => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(String(value));
      } catch {
        return false;
      }
    }
  };
}
function validateField(fieldName, value, rule) {
  const errors = [];
  if (rule.required && (value === void 0 || value === null || value === "")) {
    errors.push(`${fieldName} is required`);
    return errors;
  }
  if (value === void 0 || value === null) {
    return errors;
  }
  if (rule.type === "string" && typeof value !== "string") {
    errors.push(`${fieldName} must be string`);
  } else if (rule.type === "number" && typeof value !== "number") {
    errors.push(`${fieldName} must be number`);
  } else if (rule.type === "integer" && !Number.isInteger(value)) {
    errors.push(`${fieldName} must be integer`);
  } else if (rule.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${fieldName} must be boolean`);
  } else if (rule.type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(`${fieldName} must be valid email`);
    }
  }
  if (typeof value === "string") {
    if (rule.min !== void 0 && value.length < rule.min) {
      errors.push(`${fieldName} minimum length is ${rule.min}`);
    }
    if (rule.max !== void 0 && value.length > rule.max) {
      errors.push(`${fieldName} maximum length is ${rule.max}`);
    }
  }
  if (typeof value === "number") {
    if (rule.min !== void 0 && value < rule.min) {
      errors.push(`${fieldName} minimum value is ${rule.min}`);
    }
    if (rule.max !== void 0 && value > rule.max) {
      errors.push(`${fieldName} maximum value is ${rule.max}`);
    }
  }
  if (rule.pattern) {
    try {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(String(value))) {
        errors.push(`${fieldName} does not match pattern`);
      }
    } catch {
      errors.push(`${fieldName} pattern is invalid`);
    }
  }
  return errors;
}

// src/stdlib-middleware.ts
function createMiddlewareModule() {
  const middlewares = /* @__PURE__ */ new Map();
  const chains = [];
  return {
    // middleware_define(name, condition, handler, onFail) → middleware
    "middleware_define": (name, condition, handler, onFail) => {
      try {
        const mw = {
          name,
          condition: typeof condition === "function" ? condition : void 0,
          handler: typeof handler === "function" ? handler : () => handler,
          onFail: typeof onFail === "function" ? onFail : void 0
        };
        middlewares.set(name, mw);
        return {
          name,
          defined: true,
          hasCondition: !!mw.condition,
          hasOnFail: !!mw.onFail
        };
      } catch (err) {
        throw new Error(`middleware_define failed: ${err.message}`);
      }
    },
    // middleware_create_chain(middlewares[]) → chain
    "middleware_create_chain": (names) => {
      try {
        const chain = names.filter((name) => middlewares.has(name));
        chains.push(chain);
        return chain;
      } catch (err) {
        throw new Error(`middleware_create_chain failed: ${err.message}`);
      }
    },
    // middleware_apply_chain(chainId, request) → {passed: boolean, result: any, errors: []}
    "middleware_apply_chain": (chainId, request) => {
      try {
        const chain = chains[chainId];
        if (!chain) {
          throw new Error(`Chain not found: ${chainId}`);
        }
        const errors = [];
        let currentRequest = request;
        let passed = true;
        for (const middlewareName of chain) {
          const mw = middlewares.get(middlewareName);
          if (!mw) continue;
          if (mw.condition && !mw.condition(currentRequest)) {
            if (mw.onFail) {
              const result = mw.onFail(currentRequest);
              if (result && typeof result === "object" && "error" in result) {
                errors.push(`${middlewareName}: condition failed`);
                passed = false;
                break;
              }
            } else {
              errors.push(`${middlewareName}: condition not met`);
              passed = false;
              break;
            }
          } else {
            try {
              currentRequest = mw.handler(currentRequest);
            } catch (err) {
              errors.push(`${middlewareName}: ${err.message}`);
              passed = false;
              if (mw.onFail) {
                mw.onFail(currentRequest);
              }
              break;
            }
          }
        }
        return {
          passed,
          request: currentRequest,
          errors,
          chainLength: chain.length,
          executedMiddlewares: chain.length - (errors.length > 0 ? 1 : 0)
        };
      } catch (err) {
        throw new Error(`middleware_apply_chain failed: ${err.message}`);
      }
    },
    // middleware_add_to_chain(chainId, middleware) → chain
    "middleware_add_to_chain": (chainId, middlewareName) => {
      try {
        const chain = chains[chainId];
        if (!chain) {
          throw new Error(`Chain not found: ${chainId}`);
        }
        if (middlewares.has(middlewareName)) {
          chain.push(middlewareName);
        }
        return chain;
      } catch (err) {
        throw new Error(`middleware_add_to_chain failed: ${err.message}`);
      }
    },
    // middleware_get(name) → middleware
    "middleware_get": (name) => {
      try {
        const mw = middlewares.get(name);
        if (!mw) {
          return null;
        }
        return {
          name: mw.name,
          hasCondition: !!mw.condition,
          hasOnFail: !!mw.onFail
        };
      } catch (err) {
        throw new Error(`middleware_get failed: ${err.message}`);
      }
    },
    // 내장 미들웨어: 인증 체크
    "middleware_auth_check": (token) => {
      return {
        name: "auth-check",
        condition: (req) => {
          const authHeader = req.headers?.authorization || req.auth;
          return !!authHeader && authHeader.startsWith("Bearer ");
        },
        handler: (req) => {
          const authHeader = req.headers?.authorization || req.auth;
          const token2 = authHeader.replace("Bearer ", "");
          return { ...req, user: { token: token2 } };
        },
        onFail: (req) => ({ error: "UNAUTHORIZED", statusCode: 401 })
      };
    },
    // 내장 미들웨어: 요청 로깅
    "middleware_logging": () => {
      return {
        name: "logging",
        handler: (req) => {
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          console.log(`[${timestamp}] ${req.method || "GET"} ${req.path || "/"}`);
          return req;
        }
      };
    },
    // 내장 미들웨어: 요청 제한 (Rate limiting)
    "middleware_rate_limit": (limit = 100, windowMs = 6e4) => {
      const requestCounts = /* @__PURE__ */ new Map();
      return {
        name: "rate-limit",
        handler: (req) => {
          const clientId = req.ip || req.headers?.["x-forwarded-for"] || "unknown";
          const now = Date.now();
          const windowStart = now - windowMs;
          if (!requestCounts.has(clientId)) {
            requestCounts.set(clientId, []);
          }
          const requests = requestCounts.get(clientId);
          const recentRequests = requests.filter((t) => t > windowStart);
          if (recentRequests.length >= limit) {
            throw new Error(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`);
          }
          recentRequests.push(now);
          requestCounts.set(clientId, recentRequests);
          return { ...req, rateLimit: { remaining: limit - recentRequests.length } };
        },
        onFail: (req) => ({ error: "TOO_MANY_REQUESTS", statusCode: 429 })
      };
    },
    // 내장 미들웨어: CORS
    "middleware_cors": (allowOrigin) => {
      return {
        name: "cors",
        handler: (req) => {
          return {
            ...req,
            headers: {
              ...req.headers,
              "Access-Control-Allow-Origin": allowOrigin || "*",
              "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type,Authorization"
            }
          };
        }
      };
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createBlogModule,
  createMarkdownModule,
  createMiddlewareModule,
  createTableModule,
  createValidationModule
});
