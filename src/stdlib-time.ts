// FreeLang v9: Time + Logging + Monitoring Standard Library
// Phase 16: Temporal ops + structured logging + metrics — AI observability
//
// AI 에이전트는 "언제", "얼마나", "무엇이 느렸는지" 알아야 한다.
// Phase 16은 에이전트의 내부 관찰 시스템이다.

export interface Logger {
  name: string;
  entries: LogEntry[];
  level: LogLevel;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
  data?: any;
}

export interface Timer {
  start: number;
  label: string;
  laps: Array<{ label: string; elapsed: number }>;
}

export interface Metrics {
  name: string;
  values: Record<string, number[]>;
  counters: Record<string, number>;
  timers: Record<string, number[]>;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createTimeModule() {
  return {
    // ── Time ──────────────────────────────────────────────────

    // now -> number (current timestamp ms)
    "now": (): number => Date.now(),

    // now_ms -> number (ms since epoch, always returns number)
    "now_ms": (): number => Date.now(),

    // now_iso -> string (ISO 8601)
    "now_iso": (): string => new Date().toISOString(),

    // now_unix -> number (seconds since epoch)
    "now_unix": (): number => Math.floor(Date.now() / 1000),

    // time_diff t1 t2 -> number (ms, positive if t2 > t1)
    "time_diff": (t1: number, t2: number): number => t2 - t1,

    // time_since ts -> number (ms elapsed since ts)
    "time_since": (ts: number): number => Date.now() - ts,

    // time_ago ts -> string (human-readable: "3s ago", "2m ago", "1h ago")
    "time_ago": (ts: number): string => {
      const ms = Date.now() - ts;
      if (ms < 1000) return `${ms}ms ago`;
      if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
      if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
      if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
      return `${Math.floor(ms / 86400000)}d ago`;
    },

    // format_date ts fmt -> string  (simple date formatting)
    // fmt tokens: YYYY MM DD HH mm ss SSS
    "format_date": (ts: number, fmt: string): string => {
      const d = new Date(ts);
      return fmt
        .replace("YYYY", String(d.getFullYear()))
        .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
        .replace("DD", String(d.getDate()).padStart(2, "0"))
        .replace("HH", String(d.getHours()).padStart(2, "0"))
        .replace("mm", String(d.getMinutes()).padStart(2, "0"))
        .replace("ss", String(d.getSeconds()).padStart(2, "0"))
        .replace("SSS", String(d.getMilliseconds()).padStart(3, "0"));
    },

    // date_parts ts -> {year,month,day,hour,min,sec,ms,weekday}
    "date_parts": (ts: number): Record<string, number> => {
      const d = new Date(ts);
      return {
        year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
        hour: d.getHours(), min: d.getMinutes(), sec: d.getSeconds(),
        ms: d.getMilliseconds(), weekday: d.getDay(),
      };
    },

    // date_add ts unit n -> number  (unit: "ms"|"s"|"m"|"h"|"d")
    "date_add": (ts: number, unit: string, n: number): number => {
      const mul: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
      if (!mul[unit]) throw new Error(`date_add: unknown unit "${unit}". Use: ms/s/m/h/d`);
      return ts + n * mul[unit];
    },

    // sleep_ms ms -> void  (synchronous spin-wait, short durations only)
    "sleep_ms": (ms: number): void => {
      const end = Date.now() + ms;
      while (Date.now() < end) { /* spin */ }
    },

    // ── Timer ─────────────────────────────────────────────────

    // timer_start label -> Timer
    "timer_start": (label: string): Timer => ({
      start: Date.now(),
      label,
      laps: [],
    }),

    // timer_lap timer label -> Timer (record a lap time)
    "timer_lap": (timer: Timer, label: string): Timer => ({
      ...timer,
      laps: [...timer.laps, { label, elapsed: Date.now() - timer.start }],
    }),

    // timer_elapsed timer -> number (ms since start)
    "timer_elapsed": (timer: Timer): number => Date.now() - timer.start,

    // timer_stop timer -> {label, total_ms, laps}
    "timer_stop": (timer: Timer): Record<string, any> => ({
      label: timer.label,
      total_ms: Date.now() - timer.start,
      laps: timer.laps,
    }),

    // ── Logger ────────────────────────────────────────────────

    // log_create name level -> Logger  (level = minimum level to record)
    "log_create": (name: string, level: LogLevel = "info"): Logger => ({
      name, entries: [], level,
    }),

    // log_entry logger level msg data? -> Logger
    "log_entry": (logger: Logger, level: LogLevel, msg: string, data?: any): Logger => {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[logger.level]) return logger;
      const entry: LogEntry = { ts: Date.now(), level, msg };
      if (data !== undefined) entry.data = data;
      return { ...logger, entries: [...logger.entries, entry] };
    },

    // log_info logger msg -> Logger
    "log_info": (logger: Logger, msg: string): Logger => {
      if (LEVEL_ORDER["info"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "info" as LogLevel, msg }] };
    },

    // log_warn logger msg -> Logger
    "log_warn": (logger: Logger, msg: string): Logger => {
      if (LEVEL_ORDER["warn"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "warn" as LogLevel, msg }] };
    },

    // log_error logger msg -> Logger
    "log_error": (logger: Logger, msg: string): Logger => ({
      ...logger,
      entries: [...logger.entries, { ts: Date.now(), level: "error" as LogLevel, msg }],
    }),

    // log_debug logger msg -> Logger
    "log_debug": (logger: Logger, msg: string): Logger => {
      if (LEVEL_ORDER["debug"] < LEVEL_ORDER[logger.level]) return logger;
      return { ...logger, entries: [...logger.entries, { ts: Date.now(), level: "debug" as LogLevel, msg }] };
    },

    // log_filter logger level -> [LogEntry]  (entries at or above level)
    "log_filter": (logger: Logger, level: LogLevel): LogEntry[] =>
      logger.entries.filter(e => LEVEL_ORDER[e.level] >= LEVEL_ORDER[level]),

    // log_count logger level -> number
    "log_count": (logger: Logger, level: LogLevel): number =>
      logger.entries.filter(e => e.level === level).length,

    // log_last logger n -> [LogEntry]
    "log_last": (logger: Logger, n: number): LogEntry[] => logger.entries.slice(-n),

    // log_dump logger -> void  (print all entries to stdout)
    "log_dump": (logger: Logger): void => {
      const pad = (s: string) => s.padEnd(5);
      for (const e of logger.entries) {
        const ts = new Date(e.ts).toISOString().slice(11, 23);
        const lvl = `[${pad(e.level.toUpperCase())}]`;
        const data = e.data !== undefined ? ` | ${JSON.stringify(e.data)}` : "";
        console.log(`${ts} ${lvl} [${logger.name}] ${e.msg}${data}`);
      }
    },

    // ── Metrics ───────────────────────────────────────────────

    // metrics_create name -> Metrics
    "metrics_create": (name: string): Metrics => ({
      name, values: {}, counters: {}, timers: {},
    }),

    // metrics_record metrics key value -> Metrics
    "metrics_record": (m: Metrics, key: string, value: number): Metrics => ({
      ...m,
      values: { ...m.values, [key]: [...(m.values[key] ?? []), value] },
    }),

    // metrics_inc metrics key -> Metrics  (increment counter by 1)
    "metrics_inc": (m: Metrics, key: string): Metrics => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + 1 },
    }),

    // metrics_inc_by metrics key n -> Metrics
    "metrics_inc_by": (m: Metrics, key: string, n: number): Metrics => ({
      ...m,
      counters: { ...m.counters, [key]: (m.counters[key] ?? 0) + n },
    }),

    // metrics_count metrics key -> number
    "metrics_count": (m: Metrics, key: string): number => m.counters[key] ?? 0,

    // metrics_avg metrics key -> number
    "metrics_avg": (m: Metrics, key: string): number => {
      const vals = m.values[key] ?? [];
      if (vals.length === 0) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    },

    // metrics_min metrics key -> number
    "metrics_min": (m: Metrics, key: string): number => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.min(...vals) : 0;
    },

    // metrics_max metrics key -> number
    "metrics_max": (m: Metrics, key: string): number => {
      const vals = m.values[key] ?? [];
      return vals.length ? Math.max(...vals) : 0;
    },

    // metrics_p95 metrics key -> number  (95th percentile)
    "metrics_p95": (m: Metrics, key: string): number => {
      const vals = [...(m.values[key] ?? [])].sort((a, b) => a - b);
      if (vals.length === 0) return 0;
      return vals[Math.floor(vals.length * 0.95)];
    },

    // metrics_summary metrics -> {key: {count, avg, min, max}}
    "metrics_summary": (m: Metrics): Record<string, any> => {
      const result: Record<string, any> = {};
      for (const [key, vals] of Object.entries(m.values)) {
        const sorted = [...vals].sort((a, b) => a - b);
        result[key] = {
          count: vals.length,
          avg: vals.reduce((a, b) => a + b, 0) / vals.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p95: sorted[Math.floor(sorted.length * 0.95)],
        };
      }
      for (const [key, count] of Object.entries(m.counters)) {
        result[`counter.${key}`] = { count };
      }
      return result;
    },
  };
}
