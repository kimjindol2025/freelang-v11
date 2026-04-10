"use strict";
// FreeLang v9: Process Standard Library
// SIGTERM graceful shutdown + .env file loading
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProcessModule = createProcessModule;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function createProcessModule() {
    // Closure-scoped state — isolated per Interpreter instance
    let sigtermRegistered = false;
    const shutdownCallbacks = [];
    function runShutdown(signal) {
        Promise.all(shutdownCallbacks.map((cb) => Promise.resolve(cb())))
            .then(() => process.exit(0))
            .catch((err) => {
            console.error(`[FreeLang] Shutdown handler error (${signal}):`, err);
            process.exit(1);
        });
    }
    function registerShutdown(callback) {
        if (callback)
            shutdownCallbacks.push(callback);
        if (!sigtermRegistered) {
            sigtermRegistered = true;
            process.on("SIGTERM", () => runShutdown("SIGTERM"));
            process.on("SIGINT", () => runShutdown("SIGINT"));
        }
    }
    return {
        "env_load": (envPath) => {
            const filePath = envPath
                ? path.resolve(envPath)
                : path.resolve(process.cwd(), ".env");
            const loaded = {};
            let content;
            try {
                content = fs.readFileSync(filePath, "utf-8");
            }
            catch (err) {
                if (err.code === "ENOENT")
                    return {};
                throw err;
            }
            for (const rawLine of content.split("\n")) {
                const line = rawLine.trim();
                if (!line || line.startsWith("#"))
                    continue;
                const eqIdx = line.indexOf("=");
                if (eqIdx === -1)
                    continue;
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
        "env_get": (key) => process.env[key] ?? "",
        "env_require": (key) => {
            const val = process.env[key];
            if (!val)
                throw new Error(`Required env var missing: ${key}`);
            return val;
        },
        // Default = undefined so Function.length === 0, allowing call with no args
        "on_sigterm": (callback = undefined) => registerShutdown(callback),
        "on_exit": (callback = undefined) => registerShutdown(callback),
        "process_pid": () => process.pid,
        "process_exit": (code) => process.exit(code ?? 0),
        "process_argv": () => process.argv.slice(2),
    };
}
//# sourceMappingURL=stdlib-process.js.map