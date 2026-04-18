// FreeLang v9: Shell Execution Standard Library
// Phase 12: Shell commands for AI-native system interaction

import { spawnSync } from "child_process";

/**
 * Create the shell execution module for FreeLang v9
 * Provides: shell, shell_status, shell_pipe, shell_capture, shell_exists
 */
export function createShellModule() {
  return {
    // shell cmd -> string (run command, return stdout)
    "shell": (cmd: string): string => {
      const result = spawnSync("sh", ["-c", cmd], { timeout: 30000 });
      if (result.error) throw new Error(`shell failed: ${result.error.message}`);
      if ((result.status ?? 1) !== 0) {
        const stderr = result.stderr?.toString().trim() ?? "";
        throw new Error(`shell failed (exit ${result.status})${stderr ? ": " + stderr : ""}`);
      }
      return result.stdout?.toString() ?? "";
    },

    // shell_status cmd -> number (run command, return exit code)
    "shell_status": (cmd: string): number => {
      const result = spawnSync("sh", ["-c", cmd], { timeout: 30000 });
      return result.status ?? 1;
    },

    // shell_ok cmd -> boolean (returns true if exit code is 0)
    "shell_ok": (cmd: string): boolean => {
      const result = spawnSync("sh", ["-c", cmd], { timeout: 30000 });
      return (result.status ?? 1) === 0;
    },

    // shell_pipe cmd1 cmd2 -> string (pipe output of cmd1 into cmd2)
    "shell_pipe": (cmd1: string, cmd2: string): string => {
      const result = spawnSync("sh", ["-c", `${cmd1} | ${cmd2}`], { timeout: 30000 });
      if (result.error) throw new Error(`shell_pipe failed: ${result.error.message}`);
      if ((result.status ?? 1) !== 0) {
        const stderr = result.stderr?.toString().trim() ?? "";
        throw new Error(`shell_pipe failed (exit ${result.status})${stderr ? ": " + stderr : ""}`);
      }
      return result.stdout?.toString() ?? "";
    },

    // shell_capture cmd -> {stdout, stderr, code} (capture all output)
    "shell_capture": (cmd: string): Record<string, any> => {
      const result = spawnSync("sh", ["-c", cmd], {
        encoding: "utf-8",
        timeout: 30000,
      });
      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        code: result.status ?? 1,
      };
    },

    // shell_exists program -> boolean (check if a program is in PATH)
    "shell_exists": (program: string): boolean => {
      const result = spawnSync("which", [program], { timeout: 5000 });
      return (result.status ?? 1) === 0;
    },

    // shell_env varname -> string (get environment variable)
    "shell_env": (varname: string): string => {
      return process.env[varname] ?? "";
    },

    // shell_cwd -> string (current working directory)
    "shell_cwd": (): string => {
      return process.cwd();
    },
  };
}
