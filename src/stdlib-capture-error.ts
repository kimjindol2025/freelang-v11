// FreeLang v11: Error Capture & Tracking Standard Library
// Phase F-4: AI 에이전트 에러 추적 — 스택 수집 + 구조화된 에러 맵

interface CapturedError {
  message: string;
  name: string;
  stack: string[];
  timestamp: number;
  context?: string;
  code?: string | number;
}

const errorLog: CapturedError[] = [];
const MAX_LOG = 100;

function parseStack(stack: string = ""): string[] {
  return stack
    .split("\n")
    .slice(1) // 첫 줄은 메시지
    .map(l => l.trim())
    .filter(l => l.startsWith("at "))
    .slice(0, 10); // 최대 10 프레임
}

function captureError(e: any, context?: string): CapturedError {
  const err: CapturedError = {
    message: e?.message ?? String(e),
    name: e?.name ?? "Error",
    stack: parseStack(e?.stack),
    timestamp: Date.now(),
  };
  if (context) err.context = context;
  if (e?.code !== undefined) err.code = e.code;
  if (errorLog.length >= MAX_LOG) errorLog.shift();
  errorLog.push(err);
  return err;
}

function errToMap(err: CapturedError): Record<string, any> {
  const m: Record<string, any> = {
    message: err.message,
    name: err.name,
    stack: err.stack,
    timestamp: err.timestamp,
  };
  if (err.context) m.context = err.context;
  if (err.code !== undefined) m.code = err.code;
  return m;
}

type CallFnValue = (fn: any, args: any[]) => any;

export function createCaptureErrorModule(callFnValue?: CallFnValue) {
  return {
    // capture_error fn context? -> {ok, result, error?}
    // (capture_error (fn [] (/ 1 0)) "division-check")
    "capture_error": (fn: any, context?: string): Map<string, any> => {
      const m = new Map<string, any>();
      try {
        let result: any;
        if (typeof fn === "function") {
          result = fn();
        } else if (fn?.kind === "function-value" && callFnValue) {
          result = callFnValue(fn, []);
        } else {
          throw new Error("capture_error: 첫 번째 인자는 함수여야 합니다");
        }
        m.set("ok", true);
        m.set("result", result);
      } catch (e: any) {
        const captured = captureError(e, context);
        m.set("ok", false);
        m.set("error", errToMap(captured));
      }
      return m;
    },

    // capture_error_args fn args context? -> {ok, result, error?}
    "capture_error_args": (fn: any, args: any[], context?: string): Map<string, any> => {
      const m = new Map<string, any>();
      const argsArr = Array.isArray(args) ? args : [];
      try {
        let result: any;
        if (typeof fn === "function") {
          result = fn(...argsArr);
        } else if (fn?.kind === "function-value" && callFnValue) {
          result = callFnValue(fn, argsArr);
        } else {
          throw new Error("첫 번째 인자는 함수여야 합니다");
        }
        m.set("ok", true);
        m.set("result", result);
      } catch (e: any) {
        const captured = captureError(e, context);
        m.set("ok", false);
        m.set("error", errToMap(captured));
      }
      return m;
    },

    // error_log -> [{message, name, stack, timestamp, context?}, ...]
    "error_log": (): Map<string, any>[] => errorLog.map(errToMap),

    // error_log_clear -> count cleared
    "error_log_clear": (): number => {
      const count = errorLog.length;
      errorLog.length = 0;
      return count;
    },

    // error_log_last n? -> last n errors (default 10)
    "error_log_last": (n: number = 10): Map<string, any>[] => {
      const last = errorLog.slice(-Math.abs(n));
      return last.map(errToMap);
    },

    // error_count -> number of captured errors
    "error_count": (): number => errorLog.length,

    // make_error message name? code? -> plain object
    "make_error": (message: string, name?: string, code?: any): Record<string, any> => {
      const m: Record<string, any> = {
        message,
        name: name ?? "Error",
        stack: [],
        timestamp: Date.now(),
      };
      if (code !== undefined) m.code = code;
      return m;
    },

    // error_message err -> string
    "error_message": (err: any): string => {
      if (err && typeof err === "object") return String(err.message ?? err.get?.("message") ?? "");
      if (err instanceof Error) return err.message;
      return String(err ?? "");
    },

    // error_stack err -> [string]
    "error_stack": (err: any): string[] => {
      if (err && typeof err === "object") return (err.stack as string[]) ?? err.get?.("stack") ?? [];
      if (err instanceof Error) return parseStack(err.stack);
      return [];
    },

    // retry fn attempts delay_ms? -> {ok, result, attempts_used, error?}
    "retry": (fn: any, attempts: number = 3, delayMs: number = 0): Map<string, any> => {
      const m = new Map<string, any>();
      let lastErr: any;
      const maxAttempts = Math.max(1, Math.floor(attempts));

      for (let i = 1; i <= maxAttempts; i++) {
        try {
          let result: any;
          if (typeof fn === "function") {
            result = fn();
          } else if (fn?.kind === "function-value" && callFnValue) {
            result = callFnValue(fn, []);
          } else {
            throw new Error("retry: 첫 번째 인자는 함수여야 합니다");
          }
          m.set("ok", true);
          m.set("result", result);
          m.set("attempts_used", i);
          return m;
        } catch (e: any) {
          lastErr = e;
          if (i < maxAttempts && delayMs > 0) {
            // 동기 sleep (주의: 블로킹 — 짧은 retry에만 사용)
            const end = Date.now() + delayMs;
            while (Date.now() < end) { /* spin */ }
          }
        }
      }

      const captured = captureError(lastErr, `retry(${maxAttempts})`);
      m.set("ok", false);
      m.set("attempts_used", maxAttempts);
      m.set("error", errToMap(captured));
      return m;
    },
  };
}
