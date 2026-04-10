type ShutdownCallback = () => void | Promise<void>;
export declare function createProcessModule(): {
    env_load: (envPath?: string) => Record<string, string>;
    env_get: (key: string) => string;
    env_require: (key: string) => string;
    on_sigterm: (callback?: ShutdownCallback | undefined) => void;
    on_exit: (callback?: ShutdownCallback | undefined) => void;
    process_pid: () => number;
    process_exit: (code?: number) => never;
    process_argv: () => string[];
};
export {};
//# sourceMappingURL=stdlib-process.d.ts.map