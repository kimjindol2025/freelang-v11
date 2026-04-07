/**
 * Create the shell execution module for FreeLang v9
 * Provides: shell, shell_status, shell_pipe, shell_capture, shell_exists
 */
export declare function createShellModule(): {
    shell: (cmd: string) => string;
    shell_status: (cmd: string) => number;
    shell_ok: (cmd: string) => boolean;
    shell_pipe: (cmd1: string, cmd2: string) => string;
    shell_capture: (cmd: string) => Record<string, any>;
    shell_exists: (program: string) => boolean;
    shell_env: (varname: string) => string;
    shell_cwd: () => string;
};
//# sourceMappingURL=stdlib-shell.d.ts.map