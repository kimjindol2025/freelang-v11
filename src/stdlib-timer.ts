// FreeLang v11: Timer Standard Library
// Provides periodic and one-time timers
// Essential for periodic tasks like checkpoint and WAL rotation

type TimerCallback = () => void;
import { sisEmit, sisStats, E_TIMER_EXCEPTION } from "./sis-bus";

// Global timer registry
const timerRegistry: Map<number, NodeJS.Timer> = new Map();
let nextTimerId = 2000; // Start from 2000 to avoid conflicts

// FL-P1 fix (ROS Round 9): missed-tick observability.
// Before: a throwing interval callback was swallowed to stderr only — the
// daemon kept running while a cycle was silently skipped (P-01 Silent Blindness).
// After: every skipped tick is recorded in observable state, queryable via
// interval_stats. This MOVEs the seam from stderr-only to a first-class status
// value; an external watchdog can ABSORB it (P-08).
interface IntervalStat {
  ticks: number;        // total callback fires
  missed: number;       // fires that threw (silently skipped work)
  lastError: string | null;
  lastErrorAt: number;  // epoch ms of last skip (0 = never)
}
const intervalStats: Map<number, IntervalStat> = new Map();

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
        intervalStats.set(timerId, { ticks: 0, missed: 0, lastError: null, lastErrorAt: 0 });

        const callback = () => {
          const st = intervalStats.get(timerId);
          if (st) st.ticks++;
          try {
            if (isFnObj) {
              interpreter.callFunction(fnName, []);
            } else {
              interpreter.callUserFunction(fnName as string, []);
            }
          } catch (err: any) {
            // FL-P1: record the silently-skipped cycle as observable state
            if (st) { st.missed++; st.lastError = err.message; st.lastErrorAt = Date.now(); }
            // SIS Phase 2: 실제 timer 실패를 Evidence Bus로 (E_TIMER_EXCEPTION)
            sisEmit(E_TIMER_EXCEPTION, { timer_id: timerId, exception_count: st ? st.missed : 0 });
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
        intervalStats.delete(timerId);
        return true;
      } catch (err: any) {
        throw new Error(`clear_interval failed: ${err.message}`);
      }
    },

    // interval_stats [timerId] -> stat | {id: stat,...}  (FL-P1 / ROS R9)
    // Exposes silently-skipped ticks. healthy = (missed === 0).
    // No arg: returns all live interval stats. Unknown id: nil.
    // A watchdog polls this and alarms when missed > 0 or ticks stop advancing.
    "interval_stats": (timerId?: number): any => {
      if (timerId === undefined || timerId === null) {
        const out: Record<string, any> = {};
        for (const [id, st] of intervalStats) {
          out[String(id)] = { ...st, healthy: st.missed === 0 };
        }
        return out;
      }
      const st = intervalStats.get(timerId);
      if (st === undefined) return null;
      return { ...st, healthy: st.missed === 0 };
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
    // SIS Phase 2: Evidence Bus 통계 노출(검증/관측용)
    "sis_stats": (): any => sisStats(),

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
  };
}
