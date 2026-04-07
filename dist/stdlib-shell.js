"use strict";
// FreeLang v9: Shell Execution Standard Library
// Phase 12: Shell commands for AI-native system interaction
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShellModule = createShellModule;
const child_process_1 = require("child_process");
/**
 * Create the shell execution module for FreeLang v9
 * Provides: shell, shell_status, shell_pipe, shell_capture, shell_exists
 */
function createShellModule() {
    return {
        // shell cmd -> string (run command, return stdout)
        "shell": (cmd) => {
            try {
                return (0, child_process_1.execSync)(cmd, { encoding: "utf-8", timeout: 30000 });
            }
            catch (err) {
                throw new Error(`shell failed: ${err.message}`);
            }
        },
        // shell_status cmd -> number (run command, return exit code)
        "shell_status": (cmd) => {
            const result = (0, child_process_1.spawnSync)("sh", ["-c", cmd], { timeout: 30000 });
            return result.status ?? 1;
        },
        // shell_ok cmd -> boolean (returns true if exit code is 0)
        "shell_ok": (cmd) => {
            const result = (0, child_process_1.spawnSync)("sh", ["-c", cmd], { timeout: 30000 });
            return (result.status ?? 1) === 0;
        },
        // shell_pipe cmd1 cmd2 -> string (pipe output of cmd1 into cmd2)
        "shell_pipe": (cmd1, cmd2) => {
            try {
                return (0, child_process_1.execSync)(`${cmd1} | ${cmd2}`, { encoding: "utf-8", timeout: 30000 });
            }
            catch (err) {
                throw new Error(`shell_pipe failed: ${err.message}`);
            }
        },
        // shell_capture cmd -> {stdout, stderr, code} (capture all output)
        "shell_capture": (cmd) => {
            const result = (0, child_process_1.spawnSync)("sh", ["-c", cmd], {
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
        "shell_exists": (program) => {
            const result = (0, child_process_1.spawnSync)("which", [program], { timeout: 5000 });
            return (result.status ?? 1) === 0;
        },
        // shell_env varname -> string (get environment variable)
        "shell_env": (varname) => {
            return process.env[varname] ?? "";
        },
        // shell_cwd -> string (current working directory)
        "shell_cwd": () => {
            return process.cwd();
        },
    };
}
//# sourceMappingURL=stdlib-shell.js.map