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
    "set_interval": (fnName: string, ms: number): number => {
      try {
        if (typeof fnName !== "string") {
          throw new Error(`Function name must be string, got ${typeof fnName}`);
        }
        if (typeof ms !== "number" || ms < 1) {
          throw new Error(`Interval must be positive number, got ${ms}`);
        }

        const timerId = nextTimerId++;

        // Create a wrapper that calls the FreeLang function
        const callback = () => {
          try {
            // Look up and call the function from the interpreter environment
            const fn = interpreter.env?.get(fnName);
            if (typeof fn === "function") {
              fn();
            } else {
              console.warn(`set_interval: function '${fnName}' not found or not callable`);
              // Don't clear the interval, let user code handle it
            }
          } catch (err: any) {
            console.error(`set_interval callback error for '${fnName}':`, err.message);
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
            const fn = interpreter.env?.get(fnName);
            if (typeof fn === "function") {
              fn();
            } else {
              console.warn(`set_timeout: function '${fnName}' not found or not callable`);
            }
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
  };
}
