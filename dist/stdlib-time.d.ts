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
    laps: Array<{
        label: string;
        elapsed: number;
    }>;
}
export interface Metrics {
    name: string;
    values: Record<string, number[]>;
    counters: Record<string, number>;
    timers: Record<string, number[]>;
}
export declare function createTimeModule(): {
    now: () => number;
    now_iso: () => string;
    now_unix: () => number;
    time_diff: (t1: number, t2: number) => number;
    time_since: (ts: number) => number;
    time_ago: (ts: number) => string;
    format_date: (ts: number, fmt: string) => string;
    date_parts: (ts: number) => Record<string, number>;
    date_add: (ts: number, unit: string, n: number) => number;
    sleep_ms: (ms: number) => void;
    timer_start: (label: string) => Timer;
    timer_lap: (timer: Timer, label: string) => Timer;
    timer_elapsed: (timer: Timer) => number;
    timer_stop: (timer: Timer) => Record<string, any>;
    log_create: (name: string, level?: LogLevel) => Logger;
    log_entry: (logger: Logger, level: LogLevel, msg: string, data?: any) => Logger;
    log_info: (logger: Logger, msg: string) => Logger;
    log_warn: (logger: Logger, msg: string) => Logger;
    log_error: (logger: Logger, msg: string) => Logger;
    log_debug: (logger: Logger, msg: string) => Logger;
    log_filter: (logger: Logger, level: LogLevel) => LogEntry[];
    log_count: (logger: Logger, level: LogLevel) => number;
    log_last: (logger: Logger, n: number) => LogEntry[];
    log_dump: (logger: Logger) => void;
    metrics_create: (name: string) => Metrics;
    metrics_record: (m: Metrics, key: string, value: number) => Metrics;
    metrics_inc: (m: Metrics, key: string) => Metrics;
    metrics_inc_by: (m: Metrics, key: string, n: number) => Metrics;
    metrics_count: (m: Metrics, key: string) => number;
    metrics_avg: (m: Metrics, key: string) => number;
    metrics_min: (m: Metrics, key: string) => number;
    metrics_max: (m: Metrics, key: string) => number;
    metrics_p95: (m: Metrics, key: string) => number;
    metrics_summary: (m: Metrics) => Record<string, any>;
};
//# sourceMappingURL=stdlib-time.d.ts.map