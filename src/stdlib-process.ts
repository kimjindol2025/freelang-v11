// FreeLang v9: Process Standard Library
// SIGTERM graceful shutdown + .env file loading

import * as fs from "fs";
import * as path from "path";

type ShutdownCallback = () => void | Promise<void>;

let sigtermRegistered = false;
const shutdownCallbacks: ShutdownCallback[] = [];

function runShutdown(signal: string): void {
  if (shutdownCallbacks.length === 0) {
    process.exit(0);
    return;
  }
  Promise.all(shutdownCallbacks.map((cb) => Promise.resolve(cb())))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[FreeLang] Shutdown handler error (${signal}):`, err);
      process.exit(1);
    });
}

/**
 * Create the process module for FreeLang v9.
 * Provides: env_load, env_get, env_require, on_sigterm, on_exit, process_pid, process_exit
 */
export function createProcessModule() {
  return {
    // env_load path? -> map (load .env file into process.env, returns loaded keys)
    "env_load": (envPath?: string): Record<string, string> => {
      const filePath = envPath
        ? path.resolve(envPath)
        : path.resolve(process.cwd(), ".env");

      if (!fs.existsSync(filePath)) {
        return {};
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const loaded: Record<string, string> = {};

      for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;

        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();

        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (key) {
          process.env[key] = value;
          loaded[key] = value;
        }
      }

      return loaded;
    },

    // env_get key -> string (get env var, empty string if missing)
    "env_get": (key: string): string => {
      return process.env[key] ?? "";
    },

    // env_require key -> string (throws if env var is missing)
    "env_require": (key: string): string => {
      const val = process.env[key];
      if (val === undefined || val === "") {
        throw new Error(`Required env var missing: ${key}`);
      }
      return val;
    },

    // on_sigterm handlerFn? -> void (register graceful shutdown handler)
    // Default = undefined so Function.length === 0, allowing call with no args
    "on_sigterm": (callback: ShutdownCallback | undefined = undefined): void => {
      if (callback) shutdownCallbacks.push(callback);

      if (!sigtermRegistered) {
        sigtermRegistered = true;
        process.on("SIGTERM", () => runShutdown("SIGTERM"));
        process.on("SIGINT",  () => runShutdown("SIGINT"));
      }
    },

    // on_exit handlerFn -> void (add another shutdown callback)
    "on_exit": (callback: ShutdownCallback | undefined = undefined): void => {
      if (callback) shutdownCallbacks.push(callback);
      if (!sigtermRegistered) {
        sigtermRegistered = true;
        process.on("SIGTERM", () => runShutdown("SIGTERM"));
        process.on("SIGINT",  () => runShutdown("SIGINT"));
      }
    },

    // process_pid -> number
    "process_pid": (): number => process.pid,

    // process_exit code? -> never
    "process_exit": (code?: number): never => process.exit(code ?? 0),

    // process_argv -> array of string
    "process_argv": (): string[] => process.argv.slice(2),
  };
}
