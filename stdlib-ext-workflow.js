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

// src/ext-workflow.ts
var ext_workflow_exports = {};
__export(ext_workflow_exports, {
  createResourceModule: () => createResourceModule,
  createServiceModule: () => createServiceModule,
  createWorkflowModule: () => createWorkflowModule
});
module.exports = __toCommonJS(ext_workflow_exports);

// src/stdlib-time.ts
var LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3 };
function createTimeModule() {
  return {
    // ── Time ──────────────────────────────────────────────────
    // now -> number (current timestamp ms)
    "now": () => Date.now(),
    // now_ms -> number (ms since epoch, always returns number)
    "now_ms": () => Date.now(),
    // now_iso -> string (ISO 8601)
    "now_iso": () => (/* @__PURE__ */ new Date()).toISOString(),
    // now_unix -> number (seconds since epoch)
    "now_unix": () => Math.floor(Date.now() / 1e3),
    // time_diff t1 t2 -> number (ms, positive if t2 > t1)
    "time_diff": (t1, t2) => t2 - t1,
    // time_since ts -> number (ms elapsed since ts)
    "time_since": (ts) => Date.now() - ts,
    // time_ago ts -> string (human-readable: "3s ago", "2m ago", "1h ago")
    "time_ago": (ts) => {
      const ms = Date.now() - ts;
      if (ms < 1e3) return `${ms}ms ago`;
      if (ms < 6e4) return `${Math.floor(ms / 1e3)}s ago`;
      if (ms < 36e5) return `${Math.floor(ms / 6e4)}m ago`;
      if (ms < 864e5) return `${Math.floor(ms / 36e5)}h ago`;
      return `${Math.floor(ms / 864e5)}d ago`;
    },
    // format_date ts fmt -> string  (simple date formatting)
    // fmt tokens: YYYY MM DD HH mm ss SSS
    "format_date": (ts, fmt) => {
      const d = new Date(ts);
      return fmt.replace("YYYY", String(d.getFullYear())).replace("MM", String(d.getMonth() + 1).padStart(2, "0")).replace("DD", String(d.getDate()).padStart(2, "0")).replace("HH", String(d.getHours()).padStart(2, "0")).replace("mm", String(d.getMinutes()).padStart(2, "0")).replace("ss", String(d.getSeconds()).padStart(2, "0")).replace("SSS", String(d.getMilliseconds()).padStart(3, "0"));
    },
    // date_parts ts -> {year,month,day,hour,min,sec,ms,weekday}
    "date_parts": (ts) => {
      const d = new Date(ts);
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        min: d.getMinutes(),
        sec: d.getSeconds(),
        ms: d.getMilliseconds(),
        weekday: d.getDay()
      };
    },
    // date_add ts unit n -> number  (unit: "ms"|"s"|"m"|"h"|"d"|"days"|"hours"|"minutes"|"months"|"years"|"weeks"|"seconds")
    "date_add": (ts, unit, n) => {
      const u = String(unit).replace(/^:/, "");
      const mul = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 };
      if (mul[u] !== void 0) return ts + n * mul[u];
      const d = new Date(Number(ts));
      if (u === "days" || u === "day") {
        d.setDate(d.getDate() + Number(n));
        return d.getTime();
      }
      if (u === "hours" || u === "hour") {
        d.setHours(d.getHours() + Number(n));
        return d.getTime();
      }
      if (u === "minutes" || u === "minute") {
        d.setMinutes(d.getMinutes() + Number(n));
        return d.getTime();
      }
      if (u === "months" || u === "month") {
        d.setMonth(d.getMonth() + Number(n));
        return d.getTime();
      }
      if (u === "years" || u === "year") {
        d.setFullYear(d.getFullYear() + Number(n));
        return d.getTime();
      }
      if (u === "seconds" || u === "second") {
        d.setSeconds(d.getSeconds() + Number(n));
        return d.getTime();
      }
      if (u === "weeks" || u === "week") {
        d.setDate(d.getDate() + Number(n) * 7);
        return d.getTime();
      }
      throw new Error(`date_add: unknown unit "${unit}". Use: ms/s/m/h/d/days/hours/minutes/months/years/weeks`);
    },
    // date_parse str -> number  ("2026-04-23" | "2026-04-23T12:00:00Z" -> timestamp ms)
    "date_parse": (str) => {
      const ts = Date.parse(str);
      if (isNaN(ts)) throw new Error(`date_parse: invalid date string "${str}"`);
      return ts;
    },
    // sleep_ms ms -> void  (synchronous spin-wait, short durations only)
    "sleep_ms": (ms) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
      }
    },
    // ── Timer ─────────────────────────────────────────────────
    // timer_start label -> Timer
    "timer_start": (label) => ({
      start: Date.now(),
      label,
      laps: []
    }),
    // timer_lap timer label -> Timer (record a lap time)
    "timer_lap": (timer, label) => ({
      ...timer,
      laps: [...timer.laps, { label, elapsed: Date.now() - timer.start }]
    }),
    // timer_elapsed timer -> number (ms since start)
    "timer_elapsed": (timer) => Date.now() - timer.start,
    // timer_stop timer -> {label, total_ms, laps}
    "timer_stop": (timer) => ({
      label: timer.label,
      total_ms: Date.now() - timer.start,
      laps: timer.laps
    }),
    // ── Logger ────────────────────────────────────────────────
    // log_create name level -> Logger  (level = minimum level to record)
    "log_create": (name, level = "info") => ({
      name,
      entries: [],
      level
    }),
    // log_entry logger level msg data? -> Logger
    "log_entry": (logger, level, msg, data) => {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[logger.level]) return logger;
      const entry = { ts: Date.now(), level, msg };
      if (data !== void 0) entry.data = data;
      return { ...logger, entries: [...logger.entries, entry] };
    },
    // log_info logger msg -> Logger
    "log_info": (logger, msg) => {
      if (LEVEL_ORDER["info"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "info", msg }] };
    },
    // log_warn logger msg -> Logger
    "log_warn": (logger, msg) => {
      if (LEVEL_ORDER["warn"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "warn", msg }] };
    },
    // log_error logger msg -> Logger
    "log_error": (logger, msg) => ({
      ...logger,
      entries: [...logger.entries, { ts: Date.now(), level: "error", msg }]
    }),
    // log_debug logger msg -> Logger
    "log_debug": (logger, msg) => {
      if (LEVEL_ORDER["debug"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "debug", msg }] };
    },
    // log_filter logger level -> [LogEntry]  (entries at or above level)
    "log_filter": (logger, level) => logger.entries.filter((e) => LEVEL_ORDER[e.level] >= LEVEL_ORDER[level]),
    // log_count logger level -> number
    "log_count": (logger, level) => logger.entries.filter((e) => e.level === level).length,
    // log_last logger n -> [LogEntry]
    "log_last": (logger, n) => logger.entries.slice(-n),
    // log_dump logger -> void  (print all entries to stdout)
    "log_dump": (logger) => {
      const pad = (s) => s.padEnd(5);
      for (const e of logger.entries) {
        const ts = new Date(e.ts).toISOString().slice(11, 23);
        const lvl = `[${pad(e.level.toUpperCase())}]`;
        const data = e.data !== void 0 ? ` | ${JSON.stringify(e.data)}` : "";
        console.log(`${ts} ${lvl} [${logger.name}] ${e.msg}${data}`);
      }
    },
    // ── Metrics ───────────────────────────────────────────────
    // metrics_create name -> Metrics
    "metrics_create": (name) => ({
      name,
      values: {},
      counters: {},
      timers: {}
    }),
    // metrics_record metrics key value -> Metrics
    "metrics_record": (m, key, value) => ({
      ...m,
      values: { ...m.values, [key]: [...m.values[key] ?? [], value] }
    }),
    // metrics_inc metrics key -> Metrics  (increment counter by 1)
    "metrics_inc": (m, key) => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + 1 }
    }),
    // metrics_inc_by metrics key n -> Metrics
    "metrics_inc_by": (m, key, n) => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + n }
    }),
    // metrics_count metrics key -> number
    "metrics_count": (m, key) => m.counters[key] ?? 0,
    // metrics_avg metrics key -> number
    "metrics_avg": (m, key) => {
      const vals = m.values[key] ?? [];
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },
    // metrics_min metrics key -> number
    "metrics_min": (m, key) => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.min(...vals) : 0;
    },
    // metrics_max metrics key -> number
    "metrics_max": (m, key) => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.max(...vals) : 0;
    },
    // metrics_p95 metrics key -> number  (95th percentile)
    "metrics_p95": (m, key) => {
      const vals = [...m.values[key] ?? []].sort((a, b) => a - b);
      if (vals.length === 0) return 0;
      return vals[Math.floor(vals.length * 0.95)];
    },
    // metrics_summary metrics -> {key: {count, avg, min, max}}
    "metrics_summary": (m) => {
      const result = {};
      for (const [key, vals] of Object.entries(m.values)) {
        const sorted = [...vals].sort((a, b) => a - b);
        result[key] = {
          count: vals.length,
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p95: sorted[Math.floor(sorted.length * 0.95)]
        };
      }
      for (const [key, count] of Object.entries(m.counters)) {
        result[`counter.${key}`] = { count };
      }
      return result;
    }
  };
}

// src/stdlib-agent.ts
function createAgentModule() {
  return {
    // ── Agent Lifecycle ──────────────────────────────────────
    // agent_create name -> AgentState
    "agent_create": (name) => ({
      name,
      state: {},
      history: [],
      tools: {},
      steps: 0,
      status: "running"
    }),
    // agent_set agent key value -> AgentState (immutable update)
    "agent_set": (agent, key, value) => ({
      ...agent,
      state: { ...agent.state, [key]: value }
    }),
    // agent_get agent key -> any
    "agent_get": (agent, key) => {
      return agent.state[key] ?? null;
    },
    // agent_update agent updates -> AgentState (merge multiple keys)
    "agent_update": (agent, updates) => ({
      ...agent,
      state: { ...agent.state, ...updates }
    }),
    // agent_steps agent -> number
    "agent_steps": (agent) => agent.steps,
    // agent_status agent -> string
    "agent_status": (agent) => agent.status,
    // agent_done agent -> boolean
    "agent_done": (agent) => agent.status === "done" || agent.status === "error" || agent.status === "max_steps",
    // ── Tool Registry ────────────────────────────────────────
    // agent_add_tool agent toolName fn -> AgentState
    "agent_add_tool": (agent, toolName, fn) => ({
      ...agent,
      tools: { ...agent.tools, [toolName]: fn }
    }),
    // agent_call_tool agent toolName ...args -> any
    "agent_call_tool": (agent, toolName, ...args) => {
      const tool = agent.tools[toolName];
      if (!tool) throw new Error(`Tool not found: "${toolName}". Available: ${Object.keys(agent.tools).join(", ")}`);
      return tool(...args);
    },
    // agent_tools agent -> [string] (list registered tool names)
    "agent_tools": (agent) => Object.keys(agent.tools),
    // ── History ──────────────────────────────────────────────
    // agent_push_history agent entry -> AgentState
    "agent_push_history": (agent, entry) => ({
      ...agent,
      history: [...agent.history, { ...entry, step: agent.steps, timestamp: Date.now() }]
    }),
    // agent_history agent -> [AgentHistoryEntry]
    "agent_history": (agent) => agent.history,
    // agent_history_last agent n -> [AgentHistoryEntry] (last n entries)
    "agent_history_last": (agent, n) => agent.history.slice(-n),
    // agent_history_type agent type -> [AgentHistoryEntry] (filter by type)
    "agent_history_type": (agent, type) => agent.history.filter((e) => e.type === type),
    // ── Loop Execution ───────────────────────────────────────
    // agent_loop agent goalFn stepFn maxSteps -> AgentState
    // goalFn(state) -> boolean: return true to stop
    // stepFn(agent) -> AgentState: perform one step, return updated agent
    "agent_loop": (agent, goalFn, stepFn, maxSteps) => {
      let cur = agent;
      while (cur.steps < maxSteps) {
        if (goalFn(cur.state)) {
          return { ...cur, status: "done" };
        }
        try {
          cur = stepFn({ ...cur, steps: cur.steps + 1 });
        } catch (err) {
          return {
            ...cur,
            status: "error",
            state: { ...cur.state, _error: err.message }
          };
        }
      }
      return { ...cur, status: "max_steps" };
    },
    // agent_run_until state condition action maxSteps -> final_state
    // Simpler version: just a value + condition + transform loop
    "agent_run_until": (state, condition, action, maxSteps) => {
      let cur = state;
      let steps = 0;
      while (!condition(cur) && steps < maxSteps) {
        cur = action(cur);
        steps++;
      }
      return cur;
    },
    // ── Plan Tracking ─────────────────────────────────────────
    // plan_create steps -> Plan
    "plan_create": (steps) => ({
      steps,
      current: 0,
      done: false,
      results: {}
    }),
    // plan_next plan -> string | null (current step or null if done)
    "plan_next": (plan) => {
      if (plan.done || plan.current >= plan.steps.length) return null;
      return plan.steps[plan.current];
    },
    // plan_advance plan result -> Plan (mark current step done, move to next)
    "plan_advance": (plan, result) => {
      const step = plan.steps[plan.current];
      const newCurrent = plan.current + 1;
      return {
        ...plan,
        current: newCurrent,
        done: newCurrent >= plan.steps.length,
        results: { ...plan.results, [step]: result }
      };
    },
    // plan_done plan -> boolean
    "plan_done": (plan) => plan.done || plan.current >= plan.steps.length,
    // plan_progress plan -> number (0.0 - 1.0)
    "plan_progress": (plan) => {
      if (plan.steps.length === 0) return 1;
      return plan.current / plan.steps.length;
    },
    // plan_results plan -> {step: result}
    "plan_results": (plan) => plan.results,
    // ── Observation / Context ────────────────────────────────
    // observe key value context -> context (accumulate observations)
    "observe": (key, value, context) => ({
      ...context,
      [key]: value
    }),
    // summarize context -> string (human/AI readable summary of context)
    "summarize": (context) => {
      return Object.entries(context).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n");
    },
    // context_create -> {} (empty context)
    "context_create": () => ({}),
    // context_merge ctx1 ctx2 -> context
    "context_merge": (ctx1, ctx2) => ({
      ...ctx1,
      ...ctx2
    })
  };
}

// src/stdlib-crypto.ts
var nodeCrypto = __toESM(require("crypto"));
function createCryptoModule() {
  return {
    // ── Hash ──────────────────────────────────────────────────
    // sha256 str -> string (hex digest)
    "sha256": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex"),
    // sha256_short str -> string (first 8 chars, useful as short ID)
    "sha256_short": (str) => nodeCrypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 8),
    // md5 str -> string (hex digest, for checksums only)
    "md5": (str) => nodeCrypto.createHash("md5").update(str, "utf8").digest("hex"),
    // sha1 str -> string
    "sha1": (str) => nodeCrypto.createHash("sha1").update(str, "utf8").digest("hex"),
    // hmac_sha256 key msg -> string (hex digest)
    "hmac_sha256": (key, msg) => nodeCrypto.createHmac("sha256", key).update(msg, "utf8").digest("hex"),
    // hash_eq hash1 hash2 -> boolean (timing-safe compare)
    "hash_eq": (h1, h2) => {
      if (h1.length !== h2.length) return false;
      try {
        return nodeCrypto.timingSafeEqual(Buffer.from(h1, "hex"), Buffer.from(h2, "hex"));
      } catch {
        return false;
      }
    },
    // ── Encoding ──────────────────────────────────────────────
    // base64_encode str -> string
    "base64_encode": (str) => Buffer.from(str, "utf8").toString("base64"),
    // base64_decode str -> string
    "base64_decode": (str) => Buffer.from(str, "base64").toString("utf8"),
    // base64url_encode str -> string (URL-safe, no padding)
    "base64url_encode": (str) => Buffer.from(str, "utf8").toString("base64url"),
    // base64url_decode str -> string (URL-safe Base64 → UTF-8)
    "base64url_decode": (str) => Buffer.from(str, "base64url").toString("utf8"),
    // hex_encode str -> string
    "hex_encode": (str) => Buffer.from(str, "utf8").toString("hex"),
    // hex_decode hex -> string
    "hex_decode": (hex) => Buffer.from(hex, "hex").toString("utf8"),
    // ── Random ────────────────────────────────────────────────
    // random_bytes n -> string (hex, n bytes of randomness)
    "random_bytes": (n) => nodeCrypto.randomBytes(n).toString("hex"),
    // random_int min max -> number (inclusive)
    "random_int": (min, max) => {
      const range = max - min + 1;
      return min + nodeCrypto.randomInt(range);
    },
    // random_float -> number (0.0 - 1.0)
    "random_float": () => {
      const buf = nodeCrypto.randomBytes(4);
      return buf.readUInt32BE(0) / 4294967295;
    },
    // ── UUID ──────────────────────────────────────────────────
    // uuid_v4 -> string (random UUID)
    "uuid_v4": () => nodeCrypto.randomUUID(),
    // uuid_short -> string (8-char short ID from random bytes)
    "uuid_short": () => nodeCrypto.randomBytes(4).toString("hex"),
    // uuid_from_str str -> string (deterministic ID from string content)
    "uuid_from_str": (str) => {
      const hash = nodeCrypto.createHash("sha256").update(str).digest("hex");
      return [hash.slice(0, 8), hash.slice(8, 12), "5" + hash.slice(13, 16), hash.slice(16, 20), hash.slice(20, 32)].join("-");
    },
    // is_uuid str -> boolean
    "is_uuid": (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str),
    // ── Regex ─────────────────────────────────────────────────
    // regex_match str pattern -> boolean
    "regex_match": (str, pattern) => {
      try {
        return new RegExp(pattern).test(str);
      } catch (e) {
        throw new Error(`regex_match: invalid pattern "${pattern}": ${e.message}`);
      }
    },
    // regex_match_i str pattern -> boolean (case insensitive)
    "regex_match_i": (str, pattern) => {
      try {
        return new RegExp(pattern, "i").test(str);
      } catch (e) {
        throw new Error(`regex_match_i: invalid pattern: ${e.message}`);
      }
    },
    // regex_find str pattern -> string|null (first match)
    "regex_find": (str, pattern) => {
      const m = str.match(new RegExp(pattern));
      return m ? m[0] : null;
    },
    // regex_find_all str pattern -> [string] (all non-overlapping matches)
    "regex_find_all": (str, pattern) => {
      const matches = str.match(new RegExp(pattern, "g"));
      return matches ?? [];
    },
    // regex_replace str pattern replacement -> string
    "regex_replace": (str, pattern, replacement) => str.replace(new RegExp(pattern, "g"), replacement),
    // regex_replace_first str pattern replacement -> string (only first match)
    "regex_replace_first": (str, pattern, replacement) => str.replace(new RegExp(pattern), replacement),
    // regex_extract str pattern -> [string] (capture groups of first match)
    "regex_extract": (str, pattern) => {
      const m = str.match(new RegExp(pattern));
      return m ? m.slice(1) : [];
    },
    // regex_extract_all str pattern -> [[string]] (all matches with groups)
    "regex_extract_all": (str, pattern) => {
      const results = [];
      const re = new RegExp(pattern, "g");
      let m;
      while ((m = re.exec(str)) !== null) {
        results.push(m.slice(1));
      }
      return results;
    },
    // regex_split str pattern -> [string]
    "regex_split": (str, pattern) => str.split(new RegExp(pattern)),
    // regex_count str pattern -> number (count of matches)
    "regex_count": (str, pattern) => {
      const m = str.match(new RegExp(pattern, "g"));
      return m ? m.length : 0;
    },
    // ── AI Text Parsing Helpers ───────────────────────────────
    // extract_json str -> any|null  (extract first JSON object/array from text)
    "extract_json": (str) => {
      const m = str.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    },
    // extract_code str lang -> string|null  (extract code block from markdown)
    "extract_code": (str, lang) => {
      const pattern = lang ? `\`\`\`${lang}\\n([\\s\\S]*?)\`\`\`` : `\`\`\`(?:\\w+)?\\n([\\s\\S]*?)\`\`\``;
      const m = str.match(new RegExp(pattern));
      return m ? m[1].trim() : null;
    },
    // extract_emails str -> [string]
    "extract_emails": (str) => str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [],
    // extract_urls str -> [string]
    "extract_urls": (str) => str.match(/https?:\/\/[^\s"'<>)]+/g) ?? [],
    // extract_numbers str -> [number]
    "extract_numbers": (str) => (str.match(/-?\d+\.?\d*/g) ?? []).map(Number),
    // is_email str -> boolean
    "is_email": (str) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str),
    // is_url str -> boolean
    "is_url": (str) => {
      try {
        new URL(str);
        return true;
      } catch {
        return false;
      }
    }
  };
}

// src/stdlib-checkpoint.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function saveCheckpoint(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const toSerializable = (obj) => {
      if (obj instanceof Map) return Object.fromEntries(obj);
      if (Array.isArray(obj)) return obj.map(toSerializable);
      if (typeof obj === "object" && obj !== null) {
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
          result[k] = toSerializable(v);
        }
        return result;
      }
      return obj;
    };
    fs.writeFileSync(filePath, JSON.stringify(toSerializable(data), null, 2), "utf-8");
  } catch (err) {
    console.error(`[Checkpoint] Failed to save: ${err.message}`);
    throw err;
  }
}
function loadCheckpoint(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return data;
  } catch (err) {
    console.error(`[Checkpoint] Failed to load: ${err.message}`);
    return null;
  }
}
function deleteCheckpoint(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[Checkpoint] Failed to delete: ${err.message}`);
  }
}

// src/stdlib-workflow.ts
var T = createTimeModule();
var A = createAgentModule();
var X = createCryptoModule();
function categorizeError(message) {
  const msg = message.toLowerCase();
  if (msg.includes("timeout")) return "TIMEOUT";
  if (msg.includes("enoent") || msg.includes("not found")) return "NOT_FOUND";
  if (msg.includes("eacces") || msg.includes("permission")) return "PERMISSION";
  if (msg.includes("econnrefused") || msg.includes("connection refused")) return "CONNECTION";
  if (msg.includes("econnreset") || msg.includes("connection reset")) return "CONNECTION";
  if (msg.includes("parse") || msg.includes("json")) return "PARSE_ERROR";
  if (msg.includes("type") || msg.includes("typeof")) return "TYPE_ERROR";
  if (msg.includes("null") || msg.includes("undefined")) return "NULL_ERROR";
  if (msg.includes("network") || msg.includes("http")) return "NETWORK";
  if (msg.includes("io error")) return "IO_ERROR";
  return "UNKNOWN";
}
function createWorkflowModule() {
  return {
    // ── Workflow Definition ───────────────────────────────────
    // workflow_create name steps -> Workflow object
    "workflow_create": (name, steps) => ({
      id: X.uuid_from_str(name + Date.now()),
      name,
      steps,
      created_at: T.now()
    }),
    // workflow_step name fn options -> WorkflowStep  (helper for defining steps)
    "workflow_step": (name, fn, options = {}) => ({
      name,
      fn,
      retry: options.retry ?? 0,
      required: options.required ?? true,
      on_error: options.on_error,
      on_timeout: options.on_timeout,
      fallback: options.fallback,
      timeout_ms: options.timeout_ms,
      if: options.if,
      parallel_tasks: options.parallel_tasks,
      merge_strategy: options.merge_strategy,
      compensate: options.compensate,
      on_partial: options.on_partial,
      distributed: options.distributed
    }),
    // ── Workflow Execution ────────────────────────────────────
    // workflow_run workflow initial_ctx options -> WorkflowResult (P0, no parallel support)
    // Use workflow_run_async for P1-1 parallel task support
    "workflow_run": (workflow, initialCtx = {}, options) => {
      const startMs = T.now();
      const runId = X.uuid_short();
      const checkpointPath = options?.checkpoint_path;
      const checkpointEvery = options?.checkpoint_every ?? 0;
      const autoResume = options?.auto_resume ?? true;
      let startFromStep = 0;
      let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
      if (autoResume && checkpointPath) {
        const checkpoint = loadCheckpoint(checkpointPath);
        if (checkpoint && checkpoint.workflow_id === workflow.id) {
          startFromStep = checkpoint.step_index;
          ctx = { ...checkpoint.context, _workflow: workflow.name, _run_id: runId };
          console.log(`[Checkpoint] Resuming from step ${startFromStep} (${checkpoint.step_names.length} completed)`);
        }
      }
      const log = [];
      const errors = [];
      let stepsOk = 0;
      let stepsFailed = 0;
      const steps = workflow.steps;
      const completedStepNames = [];
      for (let stepIndex = startFromStep; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        if (step.parallel_tasks && step.parallel_tasks.length > 0) {
          return {
            id: runId,
            name: workflow.name,
            status: "failed",
            context: ctx,
            steps_run: stepsOk + stepsFailed,
            steps_ok: stepsOk,
            steps_failed: stepsFailed,
            total_ms: T.now() - startMs,
            log,
            errors: ["Parallel tasks detected. Use workflow_run_async() instead of workflow_run()"]
          };
        }
        if (step.if !== void 0) {
          try {
            const shouldRun = step.if(ctx);
            if (!shouldRun) {
              log.push({
                step: step.name,
                status: "skipped",
                ms: 0,
                trace_id: traceId,
                metrics: { wall_time_ms: 0 }
              });
              continue;
            }
          } catch (condErr) {
            errors.push(`[${step.name}] Condition failed: ${condErr.message}`);
            if (step.required !== false) {
              return {
                id: runId,
                name: workflow.name,
                status: "failed",
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: T.now() - startMs,
                log,
                errors
              };
            }
            continue;
          }
        }
        const stepStart = T.now();
        let success = false;
        let lastErr = "";
        const maxAttempts = (step.retry ?? 0) + 1;
        let stepResult = void 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            stepResult = step.fn(ctx);
            ctx = { ...ctx, ...stepResult };
            success = true;
            break;
          } catch (err) {
            lastErr = err.message;
            if (attempt < maxAttempts - 1) {
              const wait = 50 * (attempt + 1);
              const end = Date.now() + wait;
              while (Date.now() < end) {
              }
            }
          }
        }
        const stepMs = T.now() - stepStart;
        if (success) {
          stepsOk++;
          completedStepNames.push(step.name);
          log.push({ step: step.name, status: "ok", ms: stepMs });
          ctx[`_step_${step.name}_ms`] = stepMs;
          if (checkpointPath && checkpointEvery > 0 && completedStepNames.length % checkpointEvery === 0) {
            const checkpoint = {
              workflow_id: workflow.id,
              workflow_name: workflow.name,
              step_index: stepIndex + 1,
              context: ctx,
              timestamp: T.now(),
              step_names: completedStepNames,
              steps_completed: completedStepNames.length
            };
            saveCheckpoint(checkpointPath, checkpoint);
          }
        } else {
          stepsFailed++;
          let fallbackValue = void 0;
          const errorCategory = categorizeError(lastErr);
          if (step.on_error) {
            try {
              fallbackValue = step.on_error({ error: lastErr, attempts: maxAttempts, step_name: step.name });
              ctx = { ...ctx, ...fallbackValue };
              success = true;
              errors.push(`[${step.name}] ${lastErr} (handled by on_error)`);
              log.push({
                step: step.name,
                status: "error_handled",
                ms: stepMs,
                error: lastErr,
                category: errorCategory,
                attempted: maxAttempts
              });
              stepsOk++;
              stepsFailed--;
              ctx[`_step_${step.name}_ms`] = stepMs;
              continue;
            } catch (handlerErr) {
              errors.push(`[${step.name}] ${lastErr} \u2192 on_error handler also failed: ${handlerErr.message}`);
            }
          }
          if (step.fallback !== void 0) {
            try {
              fallbackValue = typeof step.fallback === "function" ? step.fallback() : step.fallback;
              ctx = { ...ctx, ...fallbackValue };
              success = true;
              errors.push(`[${step.name}] ${lastErr} (fallback used)`);
              log.push({
                step: step.name,
                status: "fallback_used",
                ms: stepMs,
                error: lastErr,
                category: errorCategory,
                attempted: maxAttempts
              });
              stepsOk++;
              stepsFailed--;
              ctx[`_step_${step.name}_ms`] = stepMs;
              continue;
            } catch (fallbackErr) {
              errors.push(`[${step.name}] ${lastErr} \u2192 fallback also failed: ${fallbackErr.message}`);
            }
          }
          if (!success) {
            errors.push(`[${step.name}] ${lastErr}`);
            log.push({
              step: step.name,
              status: "failed",
              ms: stepMs,
              error: lastErr,
              category: errorCategory,
              attempted: maxAttempts
            });
            if (step.required !== false) {
              return {
                id: runId,
                name: workflow.name,
                status: "failed",
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: T.now() - startMs,
                log,
                errors
              };
            }
          }
        }
      }
      const totalMs = T.now() - startMs;
      const status = stepsFailed === 0 ? "success" : "partial";
      if ((status === "success" || status === "partial") && checkpointPath) {
        deleteCheckpoint(checkpointPath);
      }
      return {
        id: runId,
        name: workflow.name,
        status,
        context: ctx,
        steps_run: stepsOk + stepsFailed,
        steps_ok: stepsOk,
        steps_failed: stepsFailed,
        total_ms: totalMs,
        log,
        errors
      };
    },
    // workflow_run_async workflow initial_ctx options -> Promise<WorkflowResult>
    // P1-1 async version supporting parallel tasks
    // P1-4: Enhanced observability with trace_id and metrics
    // options: {checkpoint_path, checkpoint_every, auto_resume}
    "workflow_run_async": async (workflow, initialCtx = {}, options) => {
      const startMs = T.now();
      const runId = X.uuid_short();
      const traceId2 = X.uuid_short();
      const checkpointPath = options?.checkpoint_path;
      const checkpointEvery = options?.checkpoint_every ?? 0;
      const autoResume = options?.auto_resume ?? true;
      let startFromStep = 0;
      let ctx = { ...initialCtx, _workflow: workflow.name, _run_id: runId };
      if (autoResume && checkpointPath) {
        const checkpoint = loadCheckpoint(checkpointPath);
        if (checkpoint && checkpoint.workflow_id === workflow.id) {
          startFromStep = checkpoint.step_index;
          ctx = { ...checkpoint.context, _workflow: workflow.name, _run_id: runId };
          console.log(`[Checkpoint] Resuming from step ${startFromStep} (${checkpoint.step_names.length} completed)`);
        }
      }
      const log = [];
      const errors = [];
      let stepsOk = 0;
      let stepsFailed = 0;
      const steps = workflow.steps;
      const completedStepNames = [];
      const completedSteps = [];
      const compensations = [];
      const executeStep = async (step, currentCtx) => {
        const stepStart = T.now();
        let success = false;
        let lastErr = "";
        const maxAttempts = (step.retry ?? 0) + 1;
        let stepResult = void 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            stepResult = step.fn(currentCtx);
            success = true;
            break;
          } catch (err) {
            lastErr = err.message;
            if (attempt < maxAttempts - 1) {
              const wait = 50 * (attempt + 1);
              const end = Date.now() + wait;
              while (Date.now() < end) {
              }
            }
          }
        }
        const stepMs = T.now() - stepStart;
        return { success, result: stepResult, error: lastErr, ms: stepMs };
      };
      const executeParallelTasks = async (parallelTasks, mergeStrategy, currentCtx) => {
        const taskExecutions = parallelTasks.map((task) => executeStep(task, currentCtx));
        const taskResults = await Promise.all(taskExecutions);
        const mergedResults = {};
        const taskErrors = [];
        let allSuccess = true;
        let anySuccess = false;
        taskResults.forEach((result, index) => {
          const taskName = parallelTasks[index].name;
          if (result.success) {
            mergedResults[taskName] = result.result;
            anySuccess = true;
          } else {
            taskErrors.push(`${taskName}: ${result.error}`);
            allSuccess = false;
          }
        });
        let strategySuccess = false;
        if (mergeStrategy === "all-success") {
          strategySuccess = allSuccess;
        } else if (mergeStrategy === "first-success") {
          strategySuccess = anySuccess;
        } else if (mergeStrategy === "any-partial") {
          strategySuccess = true;
        } else {
          strategySuccess = allSuccess;
        }
        return { success: strategySuccess, results: mergedResults, errors: taskErrors };
      };
      const applyCompensations = async (completedSteps2, currentCtx) => {
        for (let i = completedSteps2.length - 1; i >= 0; i--) {
          const step = completedSteps2[i];
          if (step.compensate) {
            try {
              const compensationResult = await step.compensate(currentCtx);
              compensations.push({
                step: step.name,
                action: "applied",
                result: compensationResult
              });
            } catch (compErr) {
              compensations.push({
                step: step.name,
                action: "pending",
                error: compErr.message
              });
            }
          }
        }
      };
      for (let stepIndex = startFromStep; stepIndex < steps.length; stepIndex++) {
        const step = steps[stepIndex];
        if (step.if !== void 0) {
          try {
            const shouldRun = step.if(ctx);
            if (!shouldRun) {
              log.push({
                step: step.name,
                status: "skipped",
                ms: 0,
                trace_id: traceId2,
                metrics: { wall_time_ms: 0 }
              });
              continue;
            }
          } catch (condErr) {
            errors.push(`[${step.name}] Condition failed: ${condErr.message}`);
            if (step.required !== false) {
              await applyCompensations(completedSteps, ctx);
              return {
                id: runId,
                name: workflow.name,
                status: "failed",
                context: ctx,
                steps_run: stepsOk + stepsFailed,
                steps_ok: stepsOk,
                steps_failed: stepsFailed,
                total_ms: T.now() - startMs,
                log,
                errors,
                compensations
              };
            }
            continue;
          }
        }
        const stepStart = T.now();
        let success = false;
        let lastErr = "";
        let stepResult = void 0;
        let stepMs = 0;
        if (step.parallel_tasks && step.parallel_tasks.length > 0) {
          const mergeStrategy = step.merge_strategy ?? "all-success";
          const parallelResult = await executeParallelTasks(step.parallel_tasks, mergeStrategy, ctx);
          stepMs = T.now() - stepStart;
          if (parallelResult.success) {
            success = true;
            stepResult = { [step.name]: parallelResult.results };
            ctx = { ...ctx, ...stepResult };
            stepsOk++;
            completedStepNames.push(step.name);
            completedSteps.push(step);
            log.push({
              step: step.name,
              status: "ok",
              ms: stepMs,
              trace_id: traceId2,
              metrics: { wall_time_ms: stepMs }
            });
            ctx[`_step_${step.name}_ms`] = stepMs;
          } else {
            stepsFailed++;
            lastErr = parallelResult.errors.join("; ");
            const errorCategory = categorizeError(lastErr);
            if (step.fallback !== void 0) {
              try {
                const fallbackValue = typeof step.fallback === "function" ? step.fallback() : step.fallback;
                ctx = { ...ctx, ...fallbackValue };
                success = true;
                errors.push(`[${step.name}] Parallel tasks failed (fallback used)`);
                log.push({ step: step.name, status: "fallback_used", ms: stepMs, error: lastErr, category: errorCategory });
                stepsOk++;
                stepsFailed--;
                completedSteps.push(step);
                ctx[`_step_${step.name}_ms`] = stepMs;
              } catch (fallbackErr) {
                errors.push(`[${step.name}] Parallel tasks failed: ${lastErr}`);
                log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr, category: errorCategory });
                if (step.required !== false) {
                  await applyCompensations(completedSteps, ctx);
                  return {
                    id: runId,
                    name: workflow.name,
                    status: "failed",
                    context: ctx,
                    steps_run: stepsOk + stepsFailed,
                    steps_ok: stepsOk,
                    steps_failed: stepsFailed,
                    total_ms: T.now() - startMs,
                    log,
                    errors,
                    compensations
                  };
                }
              }
            } else {
              errors.push(`[${step.name}] Parallel tasks failed: ${lastErr}`);
              log.push({ step: step.name, status: "failed", ms: stepMs, error: lastErr, category: categorizeError(lastErr) });
              if (step.required !== false) {
                await applyCompensations(completedSteps, ctx);
                return {
                  id: runId,
                  name: workflow.name,
                  status: "failed",
                  context: ctx,
                  steps_run: stepsOk + stepsFailed,
                  steps_ok: stepsOk,
                  steps_failed: stepsFailed,
                  total_ms: T.now() - startMs,
                  log,
                  errors,
                  compensations
                };
              }
            }
          }
        } else {
          const execResult = await executeStep(step, ctx);
          stepMs = execResult.ms;
          success = execResult.success;
          lastErr = execResult.error;
          stepResult = execResult.result;
          if (success) {
            stepsOk++;
            completedStepNames.push(step.name);
            completedSteps.push(step);
            log.push({
              step: step.name,
              status: "ok",
              ms: stepMs,
              trace_id: traceId2,
              metrics: { wall_time_ms: stepMs }
            });
            ctx = { ...ctx, ...stepResult };
            ctx[`_step_${step.name}_ms`] = stepMs;
            if (checkpointPath && checkpointEvery > 0 && completedStepNames.length % checkpointEvery === 0) {
              const checkpoint = {
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                step_index: stepIndex + 1,
                context: ctx,
                timestamp: T.now(),
                step_names: completedStepNames,
                steps_completed: completedStepNames.length
              };
              saveCheckpoint(checkpointPath, checkpoint);
            }
          } else {
            stepsFailed++;
            let fallbackValue = void 0;
            const errorCategory = categorizeError(lastErr);
            if (step.on_error) {
              try {
                fallbackValue = step.on_error({ error: lastErr, attempts: 1, step_name: step.name });
                ctx = { ...ctx, ...fallbackValue };
                success = true;
                errors.push(`[${step.name}] ${lastErr} (handled by on_error)`);
                log.push({
                  step: step.name,
                  status: "error_handled",
                  ms: stepMs,
                  error: lastErr,
                  category: errorCategory,
                  attempted: 1
                });
                stepsOk++;
                stepsFailed--;
                completedSteps.push(step);
                ctx[`_step_${step.name}_ms`] = stepMs;
                continue;
              } catch (handlerErr) {
                errors.push(`[${step.name}] ${lastErr} \u2192 on_error handler also failed: ${handlerErr.message}`);
              }
            }
            if (step.fallback !== void 0) {
              try {
                fallbackValue = typeof step.fallback === "function" ? step.fallback() : step.fallback;
                ctx = { ...ctx, ...fallbackValue };
                success = true;
                errors.push(`[${step.name}] ${lastErr} (fallback used)`);
                log.push({
                  step: step.name,
                  status: "fallback_used",
                  ms: stepMs,
                  error: lastErr,
                  category: errorCategory,
                  attempted: 1
                });
                stepsOk++;
                stepsFailed--;
                completedSteps.push(step);
                ctx[`_step_${step.name}_ms`] = stepMs;
                continue;
              } catch (fallbackErr) {
                errors.push(`[${step.name}] ${lastErr} \u2192 fallback also failed: ${fallbackErr.message}`);
              }
            }
            if (!success) {
              errors.push(`[${step.name}] ${lastErr}`);
              log.push({
                step: step.name,
                status: "failed",
                ms: stepMs,
                error: lastErr,
                category: errorCategory,
                attempted: 1
              });
              if (step.required !== false) {
                await applyCompensations(completedSteps, ctx);
                return {
                  id: runId,
                  name: workflow.name,
                  status: "failed",
                  context: ctx,
                  steps_run: stepsOk + stepsFailed,
                  steps_ok: stepsOk,
                  steps_failed: stepsFailed,
                  total_ms: T.now() - startMs,
                  log,
                  errors,
                  compensations
                };
              }
            }
          }
        }
      }
      const totalMs = T.now() - startMs;
      const status = stepsFailed === 0 ? "success" : "partial";
      if ((status === "success" || status === "partial") && checkpointPath) {
        deleteCheckpoint(checkpointPath);
      }
      const normalizedLog = log.map((entry) => ({
        ...entry,
        trace_id: entry.trace_id || traceId2,
        metrics: entry.metrics || { wall_time_ms: entry.ms || 0 }
      }));
      const parallelStepsCount = completedSteps.filter((s) => s.parallel_tasks && s.parallel_tasks.length > 0).length;
      const totalSteps = stepsOk + stepsFailed;
      const totalCompensations = compensations?.length ?? 0;
      return {
        id: runId,
        name: workflow.name,
        status,
        context: ctx,
        steps_run: stepsOk + stepsFailed,
        steps_ok: stepsOk,
        steps_failed: stepsFailed,
        total_ms: totalMs,
        log: normalizedLog,
        errors,
        compensations,
        // P1-2: Include compensation results
        // P1-4: Observability metrics
        metrics: {
          total_ms: totalMs,
          parallel_ratio: totalSteps > 0 ? parallelStepsCount / totalSteps : 0,
          error_ratio: totalSteps > 0 ? stepsFailed / totalSteps : 0,
          compensation_ratio: totalSteps > 0 ? Math.min(totalCompensations / totalSteps, 1) : 0
        }
      };
    },
    // ── P0-1: Error Handling Helpers ──────────────────────────
    // step-with-error step handler-fn -> WorkflowStep (add error handler)
    "step-with-error": (step, handler) => ({
      ...step,
      on_error: handler
    }),
    // step-with-fallback step value-or-fn -> WorkflowStep (add fallback)
    "step-with-fallback": (step, value) => ({
      ...step,
      fallback: value
    }),
    // step-with-timeout step ms -> WorkflowStep (add timeout)
    "step-with-timeout": (step, ms) => ({
      ...step,
      timeout_ms: ms
    }),
    // ── P0-2: Conditional Execution Helpers ──────────────────
    // step-when step condition-fn -> WorkflowStep (add conditional)
    "step-when": (step, condition) => ({
      ...step,
      if: condition
    }),
    // ── Result Inspection ─────────────────────────────────────
    // workflow_ok result -> boolean
    "workflow_ok": (result) => result.status !== "failed",
    // workflow_get result key -> any  (get value from result context)
    "workflow_get": (result, key) => result.context[key] ?? null,
    // workflow_summary result -> string  (human/AI readable summary)
    "workflow_summary": (result) => {
      const lines = [
        `Workflow: ${result.name} [${result.status.toUpperCase()}]`,
        `Run ID:   ${result.id}`,
        `Steps:    ${result.steps_ok}/${result.steps_run} ok, ${result.steps_failed} failed`,
        `Time:     ${result.total_ms}ms`
      ];
      if (result.errors.length > 0) {
        lines.push(`Errors:`);
        result.errors.forEach((e) => lines.push(`  - ${e}`));
      }
      lines.push(`Step log:`);
      result.log.forEach((l) => {
        const err = l.error ? ` \u2014 ${l.error}` : "";
        lines.push(`  [${l.status.padEnd(6)}] ${l.step} (${l.ms}ms)${err}`);
      });
      return lines.join("\n");
    },
    // ── Task Tracker ──────────────────────────────────────────
    // task_create goal -> Task
    "task_create": (goal) => ({
      id: X.uuid_v4(),
      goal,
      status: "pending",
      subtasks: [],
      completed: [],
      result: null,
      created_at: T.now()
    }),
    // task_add_subtask task name -> task
    "task_add_subtask": (task, name) => ({
      ...task,
      subtasks: [...task.subtasks, name]
    }),
    // task_complete_subtask task name result -> task
    "task_complete_subtask": (task, name, result) => ({
      ...task,
      completed: [...task.completed, name],
      [`result_${name}`]: result
    }),
    // task_finish task result -> task
    "task_finish": (task, result) => ({
      ...task,
      status: "done",
      result,
      finished_at: T.now(),
      duration_ms: T.now() - task.created_at
    }),
    // task_progress task -> number (0.0-1.0)
    "task_progress": (task) => {
      if (task.subtasks.length === 0) return task.status === "done" ? 1 : 0;
      return task.completed.length / task.subtasks.length;
    },
    // ── Report Builder ────────────────────────────────────────
    // report_create title -> Report
    "report_create": (title) => ({
      title,
      sections: [],
      created_at: T.now_iso()
    }),
    // report_add report section_name data -> Report
    "report_add": (report, sectionName, data) => ({
      ...report,
      sections: [...report.sections, { name: sectionName, data }]
    }),
    // report_render report -> string  (formatted text report)
    "report_render": (report) => {
      const divider = "\u2500".repeat(50);
      const lines = [
        divider,
        `  ${report.title}`,
        `  Generated: ${report.created_at}`,
        divider
      ];
      for (const section of report.sections) {
        lines.push(`
## ${section.name}`);
        const d = section.data;
        if (typeof d === "string") {
          lines.push(d);
        } else if (Array.isArray(d)) {
          d.forEach((item, i) => {
            lines.push(`  ${i + 1}. ${typeof item === "object" ? JSON.stringify(item) : item}`);
          });
        } else if (typeof d === "object") {
          Object.entries(d).forEach(([k, v]) => {
            lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
          });
        } else {
          lines.push(String(d));
        }
      }
      lines.push("\n" + divider);
      return lines.join("\n");
    }
  };
}

// src/stdlib-resource.ts
var import_child_process = require("child_process");
var os = __toESM(require("os"));
function run(cmd, timeout = 1e4) {
  try {
    return (0, import_child_process.execSync)(cmd, { encoding: "utf-8", timeout, stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}
function runLines(cmd) {
  const out = run(cmd);
  return out ? out.split("\n").map((l) => l.trim()).filter(Boolean) : [];
}
function parseKv(lines, sep = ":") {
  const obj = {};
  for (const line of lines) {
    const idx = line.indexOf(sep);
    if (idx > 0) {
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      obj[k] = v;
    }
  }
  return obj;
}
function createResourceModule() {
  return {
    // ── CPU ─────────────────────────────────────────────────────
    // res_cpu_load -> [1m, 5m, 15m]
    "res_cpu_load": () => {
      return os.loadavg();
    },
    // res_cpu_count -> number
    "res_cpu_count": () => {
      return os.cpus().length;
    },
    // res_cpu_model -> string
    "res_cpu_model": () => {
      const cpus2 = os.cpus();
      return cpus2.length > 0 ? cpus2[0].model : "unknown";
    },
    // res_cpu_pct -> number (1-min loadavg based, avoids busy wait)
    "res_cpu_pct": () => {
      const load = os.loadavg()[0];
      const cpus2 = os.cpus().length;
      return Math.min(100, Math.round(load / cpus2 * 100));
    },
    // ── Memory ──────────────────────────────────────────────────
    // res_mem -> {total_mb, used_mb, free_mb, buffers_mb, cached_mb, available_mb}
    "res_mem": () => {
      const total = Math.round(os.totalmem() / 1024 / 1024);
      const free = Math.round(os.freemem() / 1024 / 1024);
      const used = total - free;
      const lines = runLines("cat /proc/meminfo");
      const kv = parseKv(lines);
      const parseKb = (k) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
      return {
        total_mb: total,
        used_mb: used,
        free_mb: free,
        available_mb: parseKb("MemAvailable"),
        buffers_mb: parseKb("Buffers"),
        cached_mb: parseKb("Cached"),
        swap_total_mb: parseKb("SwapTotal"),
        swap_used_mb: parseKb("SwapTotal") - parseKb("SwapFree")
      };
    },
    // res_mem_pct -> number (used %)
    "res_mem_pct": () => {
      const total = os.totalmem();
      const free = os.freemem();
      return total > 0 ? Math.round((1 - free / total) * 100) : 0;
    },
    // ── Disk ────────────────────────────────────────────────────
    // res_disk -> DiskInfo[]
    "res_disk": () => {
      const lines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
      return lines.filter((l) => l.startsWith("/")).map((line) => {
        const [device, mount, total, used, avail, pct] = line.split(/\s+/);
        return {
          device,
          mount,
          total_gb: parseInt(total) || 0,
          used_gb: parseInt(used) || 0,
          avail_gb: parseInt(avail) || 0,
          use_pct: parseInt(pct) || 0
        };
      });
    },
    // res_disk_usage path -> {total_gb, used_gb, avail_gb, use_pct}
    "res_disk_usage": (path2) => {
      const line = run(`df -BG --output=size,used,avail,pcent "${path2}" 2>/dev/null | tail -1`);
      if (!line) return { total_gb: 0, used_gb: 0, avail_gb: 0, use_pct: 0 };
      const [total, used, avail, pct] = line.trim().split(/\s+/);
      return {
        total_gb: parseInt(total) || 0,
        used_gb: parseInt(used) || 0,
        avail_gb: parseInt(avail) || 0,
        use_pct: parseInt(pct) || 0
      };
    },
    // ── Processes ───────────────────────────────────────────────
    // res_procs -> ProcessInfo[]  (top 20 by CPU)
    "res_procs": () => {
      const lines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -21 | tail -20");
      return lines.map((line) => {
        const parts = line.split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          user: parts[1] || "",
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          state: parts[4] || "",
          name: parts[5] || "",
          cmd: parts.slice(6).join(" ")
        };
      });
    },
    // res_find_proc name -> ProcessInfo[]  (search by name substring)
    "res_find_proc": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const lines = runLines(`ps axo pid,user,pcpu,pmem,stat,comm,args 2>/dev/null | grep -i "${safeName}" | grep -v grep`);
      return lines.map((line) => {
        const parts = line.split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          user: parts[1] || "",
          cpu: parseFloat(parts[2]) || 0,
          mem: parseFloat(parts[3]) || 0,
          state: parts[4] || "",
          name: parts[5] || "",
          cmd: parts.slice(6).join(" ")
        };
      });
    },
    // res_proc_exists name -> boolean
    "res_proc_exists": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const result = (0, import_child_process.spawnSync)("sh", ["-c", `pgrep -f "${safeName}" > /dev/null 2>&1`]);
      return (result.status ?? 1) === 0;
    },
    // res_proc_pid name -> number | null
    "res_proc_pid": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const out = run(`pgrep -f "${safeName}" | head -1`);
      const pid = parseInt(out);
      return isNaN(pid) ? null : pid;
    },
    // res_proc_count name -> number  (how many instances running)
    "res_proc_count": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const out = run(`pgrep -fc "${safeName}" 2>/dev/null || echo 0`);
      return parseInt(out) || 0;
    },
    // ── Ports ───────────────────────────────────────────────────
    // res_ports -> PortInfo[]  (all listening ports)
    "res_ports": () => {
      const lines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
      return lines.map((line) => {
        const parts = line.split(/\s+/);
        const state = parts[0] || "";
        const local = parts[3] || "";
        const proc = line.match(/pid=(\d+)/)?.[1];
        const name = line.match(/\"([^\"]+)\"/)?.[1] || "";
        const colonIdx = local.lastIndexOf(":");
        const addr = local.slice(0, colonIdx);
        const port = parseInt(local.slice(colonIdx + 1)) || 0;
        return {
          port,
          protocol: "tcp",
          state,
          pid: proc ? parseInt(proc) : null,
          name,
          addr
        };
      }).filter((p) => p.port > 0);
    },
    // res_port_used port -> boolean
    "res_port_used": (port) => {
      const result = (0, import_child_process.spawnSync)("sh", ["-c", `ss -tlnp 2>/dev/null | grep -q ":${port} "`]);
      return (result.status ?? 1) === 0;
    },
    // res_port_info port -> PortInfo | null
    "res_port_info": (port) => {
      const line = run(`ss -tlnp 2>/dev/null | grep ":${port} "`);
      if (!line) return null;
      const parts = line.split(/\s+/);
      const proc = line.match(/pid=(\d+)/)?.[1];
      const name = line.match(/\"([^\"]+)\"/)?.[1] || "";
      return {
        port,
        protocol: "tcp",
        state: parts[0] || "LISTEN",
        pid: proc ? parseInt(proc) : null,
        name,
        addr: parts[3]?.split(":").slice(0, -1).join(":") || ""
      };
    },
    // res_find_free_port start end -> number | null  (first free port in range)
    "res_find_free_port": (start, end) => {
      const usedLine = run(`ss -tlnp 2>/dev/null | awk '{print $4}' | grep -oP ':\\d+' | tr -d ':'`);
      const used = new Set(usedLine.split("\n").map((s) => parseInt(s)).filter((n) => !isNaN(n)));
      for (let p = start; p <= end; p++) {
        if (!used.has(p)) return p;
      }
      return null;
    },
    // ── Network ─────────────────────────────────────────────────
    // res_net -> NetInterface[]
    "res_net": () => {
      const ifaces = os.networkInterfaces();
      const result = [];
      for (const [name, addrs] of Object.entries(ifaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
          if (addr.family === "IPv4") {
            result.push({
              name,
              addr: addr.address,
              mac: addr.mac,
              up: true
            });
          }
        }
      }
      return result;
    },
    // res_hostname -> string
    "res_hostname": () => os.hostname(),
    // res_uptime_s -> number  (system uptime in seconds)
    "res_uptime_s": () => os.uptime(),
    // ── Services ────────────────────────────────────────────────
    // res_pm2_list -> ServiceInfo[]
    "res_pm2_list": () => {
      const out = run("pm2 jlist 2>/dev/null");
      if (!out) return [];
      try {
        const list = JSON.parse(out);
        return list.map((svc) => ({
          name: svc.name,
          status: svc.pm2_env?.status || "unknown",
          pid: svc.pid || null,
          uptime: svc.pm2_env?.pm_uptime ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1e3)}s` : "0s",
          manager: "pm2"
        }));
      } catch {
        return [];
      }
    },
    // res_pm2_find name -> ServiceInfo | null
    "res_pm2_find": (name) => {
      const out = run("pm2 jlist 2>/dev/null");
      if (!out) return null;
      try {
        const list = JSON.parse(out);
        const svc = list.find((s) => s.name === name);
        if (!svc) return null;
        return {
          name: svc.name,
          status: svc.pm2_env?.status || "unknown",
          pid: svc.pid || null,
          uptime: svc.pm2_env?.pm_uptime ? `${Math.round((Date.now() - svc.pm2_env.pm_uptime) / 1e3)}s` : "0s",
          manager: "pm2"
        };
      } catch {
        return null;
      }
    },
    // res_systemd_status name -> ServiceInfo
    "res_systemd_status": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, "");
      const active = run(`systemctl is-active "${safeName}" 2>/dev/null`);
      const pid = run(`systemctl show "${safeName}" -p MainPID --value 2>/dev/null`);
      return {
        name: safeName,
        status: active || "unknown",
        pid: parseInt(pid) || null,
        uptime: run(`systemctl show "${safeName}" -p ActiveEnterTimestamp --value 2>/dev/null`),
        manager: "systemd"
      };
    },
    // ── kimdb integration ────────────────────────────────────────
    // res_kimdb_project name -> Record | null  (query local kimdb)
    "res_kimdb_project": (name) => {
      const safeName = name.replace(/[^a-zA-Z0-9_\-]/g, "");
      try {
        const out = run(`curl -sf "http://localhost:40000/api/c/projects/${safeName}" 2>/dev/null`, 3e3);
        if (!out) return null;
        const parsed = JSON.parse(out);
        return parsed.data ?? parsed ?? null;
      } catch {
        return null;
      }
    },
    // res_kimdb_projects -> Record[]  (all projects)
    "res_kimdb_projects": () => {
      try {
        const out = run(`curl -sf "http://localhost:40000/api/c/projects" 2>/dev/null`, 5e3);
        if (!out) return [];
        const parsed = JSON.parse(out);
        return Array.isArray(parsed) ? parsed : parsed.data ?? [];
      } catch {
        return [];
      }
    },
    // res_kimdb_health -> boolean
    "res_kimdb_health": () => {
      const out = run(`curl -sf "http://localhost:40000/health" 2>/dev/null`, 2e3);
      return out.includes("ok") || out.includes("healthy") || out.length > 0;
    },
    // ── Full Snapshot ────────────────────────────────────────────
    // res_snapshot -> ResourceSnapshot  (complete server state, ~1s)
    "res_snapshot": () => {
      const memInfo = (() => {
        const total = Math.round(os.totalmem() / 1024 / 1024);
        const free = Math.round(os.freemem() / 1024 / 1024);
        const lines = runLines("cat /proc/meminfo");
        const kv = parseKv(lines);
        const parseKb = (k) => Math.round(parseInt((kv[k] || "0 kB").split(" ")[0]) / 1024);
        return { total, free, used: total - free, swapTotal: parseKb("SwapTotal"), swapFree: parseKb("SwapFree") };
      })();
      const diskLines = runLines("df -BG --output=source,target,size,used,avail,pcent 2>/dev/null | tail -n +2");
      const disk = diskLines.filter((l) => l.startsWith("/")).map((line) => {
        const [device, mount, total, used, avail, pct] = line.split(/\s+/);
        return { device, mount, total_gb: parseInt(total) || 0, used_gb: parseInt(used) || 0, avail_gb: parseInt(avail) || 0, use_pct: parseInt(pct) || 0 };
      });
      const procLines = runLines("ps axo pid,user,pcpu,pmem,stat,comm,args --sort=-pcpu 2>/dev/null | head -6 | tail -5");
      const top_procs = procLines.map((line) => {
        const p = line.split(/\s+/);
        return { pid: parseInt(p[0]) || 0, user: p[1] || "", cpu: parseFloat(p[2]) || 0, mem: parseFloat(p[3]) || 0, state: p[4] || "", name: p[5] || "", cmd: p.slice(6).join(" ") };
      });
      const portLines = runLines("ss -tlnp 2>/dev/null | tail -n +2");
      const ports_listening = portLines.map((line) => {
        const parts = line.split(/\s+/);
        const local = parts[3] || "";
        const colonIdx = local.lastIndexOf(":");
        const port = parseInt(local.slice(colonIdx + 1)) || 0;
        const proc = line.match(/pid=(\d+)/)?.[1];
        return { port, protocol: "tcp", state: parts[0] || "", pid: proc ? parseInt(proc) : null, name: line.match(/\"([^\"]+)\"/)?.[1] || "", addr: local.slice(0, colonIdx) };
      }).filter((p) => p.port > 0);
      return {
        ts: Date.now(),
        hostname: os.hostname(),
        uptime_s: os.uptime(),
        cpu_load: os.loadavg(),
        mem_total_mb: memInfo.total,
        mem_used_mb: memInfo.used,
        mem_free_mb: memInfo.free,
        swap_total_mb: memInfo.swapTotal,
        swap_used_mb: memInfo.swapTotal - memInfo.swapFree,
        disk,
        top_procs,
        ports_listening
      };
    },
    // res_snapshot_report snapshot -> string  (human/AI readable)
    "res_snapshot_report": (snap) => {
      const mem_pct = snap.mem_total_mb > 0 ? Math.round(snap.mem_used_mb / snap.mem_total_mb * 100) : 0;
      const upd = new Date(snap.ts).toISOString();
      const lines = [
        `\u2550\u2550\u2550 Server Resource Snapshot \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,
        `Host:    ${snap.hostname}  |  Time: ${upd}`,
        `Uptime:  ${Math.round(snap.uptime_s / 3600)}h ${Math.round(snap.uptime_s % 3600 / 60)}m`,
        ``,
        `\u2500\u2500 CPU Load \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        `1m: ${snap.cpu_load[0].toFixed(2)}  5m: ${snap.cpu_load[1].toFixed(2)}  15m: ${snap.cpu_load[2].toFixed(2)}`,
        ``,
        `\u2500\u2500 Memory \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        `Used: ${snap.mem_used_mb}MB / ${snap.mem_total_mb}MB  (${mem_pct}%)`,
        `Swap: ${snap.swap_used_mb}MB / ${snap.swap_total_mb}MB`,
        ``,
        `\u2500\u2500 Disk \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        ...snap.disk.map((d) => `${d.mount.padEnd(12)} ${d.used_gb}G/${d.total_gb}G (${d.use_pct}%)  [${d.device}]`),
        ``,
        `\u2500\u2500 Top Processes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        ...snap.top_procs.map((p) => `PID ${String(p.pid).padEnd(7)} CPU:${String(p.cpu).padEnd(6)} MEM:${String(p.mem).padEnd(5)} ${p.name}`),
        ``,
        `\u2500\u2500 Listening Ports \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,
        ...snap.ports_listening.slice(0, 15).map((p) => `${String(p.port).padEnd(7)} ${p.name || "(unknown)"}`),
        ...snap.ports_listening.length > 15 ? [`... ${snap.ports_listening.length - 15} more`] : [],
        `\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`
      ];
      return lines.join("\n");
    },
    // res_health_check -> {ok, warnings, errors}
    "res_health_check": () => {
      const warnings = [];
      const errors = [];
      const mem_pct = Math.round((1 - os.freemem() / os.totalmem()) * 100);
      if (mem_pct > 95) errors.push(`Memory critical: ${mem_pct}%`);
      else if (mem_pct > 80) warnings.push(`Memory high: ${mem_pct}%`);
      const load = os.loadavg();
      const cpus2 = os.cpus().length;
      if (load[0] > cpus2 * 2) errors.push(`CPU load critical: ${load[0].toFixed(2)} (${cpus2} cores)`);
      else if (load[0] > cpus2 * 0.8) warnings.push(`CPU load high: ${load[0].toFixed(2)} (${cpus2} cores)`);
      const diskLines = runLines("df -BG --output=target,pcent 2>/dev/null | tail -n +2");
      for (const line of diskLines) {
        const [mount, pct] = line.split(/\s+/);
        const pctNum = parseInt(pct);
        if (pctNum > 95) errors.push(`Disk ${mount} critical: ${pct}`);
        else if (pctNum > 85) warnings.push(`Disk ${mount} high: ${pct}`);
      }
      return {
        ok: errors.length === 0,
        warnings,
        errors,
        mem_pct,
        cpu_load_1m: load[0],
        cpu_cores: cpus2
      };
    }
  };
}

// src/stdlib-service.ts
function createServiceModule() {
  const services = /* @__PURE__ */ new Map();
  const queues = /* @__PURE__ */ new Map();
  const circuitBreakers = /* @__PURE__ */ new Map();
  const metrics = { requests: 0, errors: 0 };
  return {
    // service_define(name, port, routes) → service
    "service_define": (name, port, routes) => {
      try {
        const service = {
          name,
          port,
          routes: routes || [],
          running: false
        };
        services.set(name, service);
        return service;
      } catch (err) {
        throw new Error(`service_define failed: ${err.message}`);
      }
    },
    // service_start(name) → {running, port}
    "service_start": (name) => {
      try {
        const service = services.get(name);
        if (!service) throw new Error(`Service not found: ${name}`);
        service.running = true;
        return { service: name, running: true, port: service.port };
      } catch (err) {
        throw new Error(`service_start failed: ${err.message}`);
      }
    },
    // service_stop(name) → boolean
    "service_stop": (name) => {
      try {
        const service = services.get(name);
        if (!service) throw new Error(`Service not found: ${name}`);
        service.running = false;
        return true;
      } catch (err) {
        throw new Error(`service_stop failed: ${err.message}`);
      }
    },
    // service_health(name) → {status, uptime, requests}
    "service_health": (name) => {
      try {
        const service = services.get(name);
        if (!service) throw new Error(`Service not found: ${name}`);
        return {
          service: name,
          status: service.running ? "healthy" : "down",
          uptime: service.running ? Math.random() * 3600 : 0,
          requests: metrics.requests
        };
      } catch (err) {
        throw new Error(`service_health failed: ${err.message}`);
      }
    },
    // queue_create(name, type) → queue
    "queue_create": (name, type) => {
      try {
        const queue = { name, type: type || "memory", messages: [] };
        queues.set(name, queue.messages);
        return queue;
      } catch (err) {
        throw new Error(`queue_create failed: ${err.message}`);
      }
    },
    // queue_publish(name, event, data) → boolean
    "queue_publish": (name, event, data) => {
      try {
        const queue = queues.get(name);
        if (!queue) throw new Error(`Queue not found: ${name}`);
        queue.push({ event, data, timestamp: Date.now() });
        return true;
      } catch (err) {
        throw new Error(`queue_publish failed: ${err.message}`);
      }
    },
    // queue_subscribe(name, event, handler) → subscriptionId
    "queue_subscribe": (name, event, handler) => {
      try {
        const subId = `sub-${Math.random().toString(36).substr(2, 9)}`;
        return subId;
      } catch (err) {
        throw new Error(`queue_subscribe failed: ${err.message}`);
      }
    },
    // circuit_breaker_define(name, threshold, timeout, fallback) → breaker
    "circuit_breaker_define": (name, threshold, timeout, fallback) => {
      try {
        const breaker = {
          name,
          state: "CLOSED",
          threshold: threshold || 5,
          timeout: timeout || 3e4,
          failures: 0,
          lastFailure: null,
          fallback
        };
        circuitBreakers.set(name, breaker);
        return breaker;
      } catch (err) {
        throw new Error(`circuit_breaker_define failed: ${err.message}`);
      }
    },
    // circuit_call(name, fn) → result
    "circuit_call": (name, fn) => {
      try {
        const breaker = circuitBreakers.get(name);
        if (!breaker) {
          return fn();
        }
        if (breaker.state === "OPEN") {
          return breaker.fallback ? breaker.fallback() : { error: "Circuit open" };
        }
        try {
          const result = fn();
          breaker.failures = 0;
          breaker.state = "CLOSED";
          return result;
        } catch (err) {
          breaker.failures++;
          breaker.lastFailure = Date.now();
          if (breaker.failures >= breaker.threshold) {
            breaker.state = "OPEN";
          }
          throw err;
        }
      } catch (err) {
        throw new Error(`circuit_call failed: ${err.message}`);
      }
    },
    // observe_metric(name, value, type) → boolean
    "observe_metric": (name, value, type) => {
      try {
        if (!metrics[name]) {
          metrics[name] = 0;
        }
        if (type === "gauge") {
          metrics[name] = value;
        } else {
          metrics[name] += value;
        }
        return true;
      } catch (err) {
        throw new Error(`observe_metric failed: ${err.message}`);
      }
    },
    // observe_log(level, message, data) → boolean
    "observe_log": (level, message, data) => {
      try {
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || "");
        return true;
      } catch (err) {
        throw new Error(`observe_log failed: ${err.message}`);
      }
    },
    // observe_report() → metrics
    "observe_report": () => {
      try {
        return {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          metrics,
          services: Array.from(services.values()).map((s) => ({
            name: s.name,
            port: s.port,
            running: s.running
          })),
          queues: Array.from(queues.keys())
        };
      } catch (err) {
        throw new Error(`observe_report failed: ${err.message}`);
      }
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createResourceModule,
  createServiceModule,
  createWorkflowModule
});
