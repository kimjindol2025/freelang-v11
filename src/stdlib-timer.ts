// FreeLang v11: Timer Standard Library
// Provides periodic and one-time timers
// Essential for periodic tasks like checkpoint and WAL rotation

type TimerCallback = () => void;

// Global timer registry
const timerRegistry: Map<number, NodeJS.Timer> = new Map();
let nextTimerId = 2000; // Start from 2000 to avoid conflicts

/**
 * Create the timer module for FreeLang
 * Provides: set_interval, clear_interval, set_timeout, clear_timeout
 *
 * Note: Callbacks are function names that will be looked up and invoked
 * by the interpreter environment
 */
export function createTimerModule(interpreter: any) {
  return {
    // set_interval fn ms -> number (fn: function name string, ms: interval)
    "set_interval": (fnName: string | any, ms: number): number => {
      try {
        const isFnObj = fnName && typeof fnName === "object" && fnName.body !== undefined;
        if (typeof fnName !== "string" && !isFnObj) {
          throw new Error(`Function name must be string or function, got ${typeof fnName}`);
        }
        if (typeof ms !== "number" || ms < 1) {
          throw new Error(`Interval must be positive number, got ${ms}`);
        }

        const timerId = nextTimerId++;

        const callback = () => {
          try {
            if (isFnObj) {
              interpreter.callFunction(fnName, []);
            } else {
              interpreter.callUserFunction(fnName as string, []);
            }
          } catch (err: any) {
            const label = isFnObj ? "<fn>" : fnName;
            console.error(`set_interval callback error for '${label}':`, err.message);
          }
        };

        const nodeTimer = setInterval(callback, ms);
        timerRegistry.set(timerId, nodeTimer);
        return timerId;
      } catch (err: any) {
        throw new Error(`set_interval failed: ${err.message}`);
      }
    },

    // clear_interval timerId -> boolean (stop periodic timer)
    "clear_interval": (timerId: number): boolean => {
      try {
        const nodeTimer = timerRegistry.get(timerId);
        if (nodeTimer === undefined) {
          return false; // Timer not found
        }
        clearInterval(nodeTimer);
        timerRegistry.delete(timerId);
        return true;
      } catch (err: any) {
        throw new Error(`clear_interval failed: ${err.message}`);
      }
    },

    // set_timeout fn ms -> number (fn: function name string, ms: delay)
    "set_timeout": (fnName: string, ms: number): number => {
      try {
        if (typeof fnName !== "string") {
          throw new Error(`Function name must be string, got ${typeof fnName}`);
        }
        if (typeof ms !== "number" || ms < 1) {
          throw new Error(`Timeout must be positive number, got ${ms}`);
        }

        const timerId = nextTimerId++;

        // Create a wrapper that calls the FreeLang function once
        const callback = () => {
          try {
            interpreter.callUserFunction(fnName, []);
          } catch (err: any) {
            console.error(`set_timeout callback error for '${fnName}':`, err.message);
          }
          // Auto-cleanup after execution
          timerRegistry.delete(timerId);
        };

        const nodeTimer = setTimeout(callback, ms);
        timerRegistry.set(timerId, nodeTimer);
        return timerId;
      } catch (err: any) {
        throw new Error(`set_timeout failed: ${err.message}`);
      }
    },

    // clear_timeout timerId -> boolean (cancel one-time timer)
    "clear_timeout": (timerId: number): boolean => {
      try {
        const nodeTimer = timerRegistry.get(timerId);
        if (nodeTimer === undefined) {
          return false; // Timer not found
        }
        clearTimeout(nodeTimer);
        timerRegistry.delete(timerId);
        return true;
      } catch (err: any) {
        throw new Error(`clear_timeout failed: ${err.message}`);
      }
    },

    // timer_count -> number (returns count of active timers)
    "timer_count": (): number => {
      return timerRegistry.size;
    },

    // timer_clear_all -> boolean (clear all active timers)
    "timer_clear_all": (): boolean => {
      try {
        for (const nodeTimer of timerRegistry.values()) {
          clearInterval(nodeTimer);
          clearTimeout(nodeTimer);
        }
        timerRegistry.clear();
        return true;
      } catch (err: any) {
        throw new Error(`timer_clear_all failed: ${err.message}`);
      }
    },

    // fl-timeout ms fn -> number — (fl-timeout 1000 (fn [] ...))
    "fl-timeout": (ms: number, fn: any): number => {
      if (typeof ms !== "number" || ms < 0) throw new Error(`fl-timeout: ms must be non-negative number, got ${ms}`);
      if (!fn) throw new Error(`fl-timeout: fn required`);
      const timerId = nextTimerId++;
      const callback = () => {
        try { interpreter.callFunctionValue(fn, []); } catch (err: any) { console.error(`fl-timeout[${timerId}] error:`, err.message); }
        timerRegistry.delete(timerId);
      };
      timerRegistry.set(timerId, setTimeout(callback, ms));
      return timerId;
    },

    // fl-interval ms fn -> number — (fl-interval 1000 (fn [] ...))
    "fl-interval": (ms: number, fn: any): number => {
      if (typeof ms !== "number" || ms < 1) throw new Error(`fl-interval: ms must be positive number, got ${ms}`);
      if (!fn) throw new Error(`fl-interval: fn required`);
      const timerId = nextTimerId++;
      const callback = () => {
        try { interpreter.callFunctionValue(fn, []); } catch (err: any) { console.error(`fl-interval[${timerId}] error:`, err.message); }
      };
      timerRegistry.set(timerId, setInterval(callback, ms));
      return timerId;
    },

    // fl-cancel-timer id -> boolean — cancels both timeout and interval
    "fl-cancel-timer": (timerId: number): boolean => {
      const nodeTimer = timerRegistry.get(timerId);
      if (nodeTimer === undefined) return false;
      clearTimeout(nodeTimer as any);
      clearInterval(nodeTimer as any);
      timerRegistry.delete(timerId);
      return true;
    },

    // fl-run-loop ms -> number — setInterval 기반 자동 event queue drain (S41)
    // 매 ms마다 __flEventQueue를 완전히 비운다. TCP 서버와 함께 사용.
    "fl-run-loop": (ms: number): number => {
      if (typeof ms !== "number" || ms < 1) throw new Error(`fl-run-loop: ms must be positive, got ${ms}`);
      const timerId = nextTimerId++;
      const callback = () => {
        const q: any[] = (globalThis as any).__flEventQueue ?? [];
        if (!((globalThis as any).__flErrorQueue)) (globalThis as any).__flErrorQueue = [];
        while (q.length > 0) {
          const ev = q.shift();
          try {
            const r = interpreter.callUserFunction(ev.handler, ev.args);
            const o = r != null ? String(r) : "";
            if (o && ev.sock && !ev.sock.destroyed) {
              try { ev.sock.write(o.endsWith("\n") ? o : o + "\n"); } catch (we: any) {
                (globalThis as any).__flErrorQueue.push(["io-err", "recoverable", "write", we.message]);
              }
            }
          } catch (e: any) {
            const isFatal = e.message?.includes("Maximum call stack") || e.message?.includes("out of memory");
            (globalThis as any).__flErrorQueue.push(["io-err", isFatal ? "fatal" : "recoverable", "handler", e.message]);
            if (ev.sock && !ev.sock.destroyed) try { ev.sock.write(`ERR ${e.message}\n`); } catch {}
          }
        }
      };
      timerRegistry.set(timerId, setInterval(callback, ms));
      return timerId;
    },

    // fl-run-loop-stop id -> boolean — run-loop 중단
    "fl-run-loop-stop": (timerId: number): boolean => {
      const nodeTimer = timerRegistry.get(timerId);
      if (nodeTimer === undefined) return false;
      clearInterval(nodeTimer as any);
      timerRegistry.delete(timerId);
      return true;
    },
  };
}
