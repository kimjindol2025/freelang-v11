// FreeLang v9: Process Standard Library
// SIGTERM graceful shutdown + .env file loading

import * as fs from "fs";
import * as path from "path";

type ShutdownCallback = () => void | Promise<void>;

export function createProcessModule() {
  // Closure-scoped state — isolated per Interpreter instance
  let sigtermRegistered = false;
  const shutdownCallbacks: ShutdownCallback[] = [];

  function runShutdown(signal: string): void {
    Promise.all(shutdownCallbacks.map((cb) => Promise.resolve(cb())))
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(`[FreeLang] Shutdown handler error (${signal}):`, err);
        process.exit(1);
      });
  }

  function registerShutdown(callback: ShutdownCallback | undefined): void {
    if (callback) shutdownCallbacks.push(callback);
    if (!sigtermRegistered) {
      sigtermRegistered = true;
      process.on("SIGTERM", () => runShutdown("SIGTERM"));
      process.on("SIGINT",  () => runShutdown("SIGINT"));
    }
  }

  return {
    "env_load": (envPath?: string): Record<string, string> => {
      const filePath = envPath
        ? path.resolve(envPath)
        : path.resolve(process.cwd(), ".env");

      const loaded: Record<string, string> = {};
      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch (err: any) {
        if (err.code === "ENOENT") return {};
        throw err;
      }

      for (const rawLine of content.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;

        const eqIdx = line.indexOf("=");
        if (eqIdx === -1) continue;

        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();

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

    "env_get": (key: string): string => process.env[key] ?? "",

    "env_require": (key: string): string => {
      const val = process.env[key];
      if (!val) throw new Error(`Required env var missing: ${key}`);
      return val;
    },

    // Default = undefined so Function.length === 0, allowing call with no args
    "on_sigterm": (callback: ShutdownCallback | undefined = undefined): void =>
      registerShutdown(callback),

    "on_exit": (callback: ShutdownCallback | undefined = undefined): void =>
      registerShutdown(callback),

    "process_pid": (): number => process.pid,

    "process_exit": (code?: number): never => process.exit(code ?? 0),

    "process_argv": (): string[] => process.argv.slice(2),

    "process_argv_get": (key: string, defaultVal: any = null): any => {
      const args = process.argv.slice(2);
      const idx = args.indexOf(key);
      if (idx === -1 || idx + 1 >= args.length) return defaultVal;
      return args[idx + 1];
    },
  };
}
