"use strict";
// FreeLang v9: Phase 79 — 워치 모드 + 핫 리로드
// fs.watch 기반, 외부 의존성 없음
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
exports.FileWatcher = void 0;
exports.createDebounce = createDebounce;
exports.runWithWatch = runWithWatch;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
// ─────────────────────────────────────────
// 내부 유틸: debounce
// ─────────────────────────────────────────
function createDebounce(ms) {
    let timer = null;
    return function debounced(fn) {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        timer = setTimeout(() => {
            timer = null;
            fn();
        }, ms);
    };
}
// ─────────────────────────────────────────
// FileWatcher 클래스
// ─────────────────────────────────────────
class FileWatcher {
    constructor() {
        this.watchers = [];
    }
    /**
     * 단일 파일 감시
     * @returns stop 함수
     */
    watch(file, opts) {
        const debounceMs = opts?.debounceMs ?? 300;
        const clearConsole = opts?.clearConsole ?? true;
        const onReload = opts?.onReload;
        const onError = opts?.onError;
        const debounced = createDebounce(debounceMs);
        let watcher = null;
        try {
            watcher = fs.watch(file, (_event) => {
                debounced(() => {
                    const basename = path.basename(file);
                    if (clearConsole) {
                        process.stdout.write("\x1b[2J\x1b[0f");
                    }
                    console.log(`\x1b[36m[RELOAD]\x1b[0m ${basename} changed`);
                    if (onReload) {
                        try {
                            onReload(file);
                        }
                        catch (err) {
                            if (onError) {
                                onError(file, err instanceof Error ? err : new Error(String(err)));
                            }
                            else {
                                console.error(`\x1b[31m[ERROR]\x1b[0m ${basename}: ${err.message ?? err}`);
                            }
                        }
                    }
                });
            });
            this.watchers.push(watcher);
        }
        catch (_err) {
            // 파일이 존재하지 않아도 stop 함수는 반환
        }
        let stopped = false;
        return () => {
            if (!stopped && watcher) {
                stopped = true;
                try {
                    watcher.close();
                }
                catch (_e) {
                    // 이미 닫혀 있어도 무시
                }
                const idx = this.watchers.indexOf(watcher);
                if (idx !== -1)
                    this.watchers.splice(idx, 1);
            }
        };
    }
    /**
     * 디렉토리 내 pattern에 맞는 파일 감시
     * @returns stop 함수
     */
    watchDir(dir, pattern, opts) {
        const debounceMs = opts?.debounceMs ?? 300;
        const clearConsole = opts?.clearConsole ?? true;
        const onReload = opts?.onReload;
        const onError = opts?.onError;
        const debounced = createDebounce(debounceMs);
        // pattern → RegExp 변환 (glob-lite: *.fl → /\.fl$/)
        const ext = pattern.replace(/^\*/, "");
        const regex = new RegExp(ext.replace(".", "\\.") + "$");
        let watcher = null;
        try {
            watcher = fs.watch(dir, (_event, filename) => {
                if (!filename)
                    return;
                if (!regex.test(filename))
                    return;
                debounced(() => {
                    if (clearConsole) {
                        process.stdout.write("\x1b[2J\x1b[0f");
                    }
                    console.log(`\x1b[36m[RELOAD]\x1b[0m ${filename} changed`);
                    const fullPath = path.join(dir, filename);
                    if (onReload) {
                        try {
                            onReload(fullPath);
                        }
                        catch (err) {
                            if (onError) {
                                onError(fullPath, err instanceof Error ? err : new Error(String(err)));
                            }
                            else {
                                console.error(`\x1b[31m[ERROR]\x1b[0m ${filename}: ${err.message ?? err}`);
                            }
                        }
                    }
                });
            });
            this.watchers.push(watcher);
        }
        catch (_err) {
            // 디렉토리 오류는 무시
        }
        let stopped = false;
        return () => {
            if (!stopped && watcher) {
                stopped = true;
                try {
                    watcher.close();
                }
                catch (_e) {
                    // 무시
                }
                const idx = this.watchers.indexOf(watcher);
                if (idx !== -1)
                    this.watchers.splice(idx, 1);
            }
        };
    }
    /** 모든 감시 중단 */
    stopAll() {
        for (const w of this.watchers) {
            try {
                w.close();
            }
            catch (_e) { /* 무시 */ }
        }
        this.watchers = [];
    }
}
exports.FileWatcher = FileWatcher;
// ─────────────────────────────────────────
// runWithWatch: 파일 실행 + 변경 감지 재실행
// ─────────────────────────────────────────
function runWithWatch(file, opts) {
    const absPath = path.resolve(file);
    function executeFile() {
        try {
            const source = fs.readFileSync(absPath, "utf-8");
            const tokens = (0, lexer_1.lex)(source);
            const ast = (0, parser_1.parse)(tokens);
            const interp = new interpreter_1.Interpreter();
            interp.currentFilePath = absPath;
            const ctx = interp.interpret(ast);
            const val = ctx.lastValue;
            if (val !== null && val !== undefined) {
                if (typeof val === "object") {
                    console.log(JSON.stringify(val, null, 2));
                }
                else {
                    console.log(String(val));
                }
            }
            if (opts?.onReload) {
                opts.onReload(file);
            }
        }
        catch (err) {
            const e = err instanceof Error ? err : new Error(String(err));
            if (opts?.onError) {
                opts.onError(file, e);
            }
            else {
                console.error(`\x1b[31m[ERROR]\x1b[0m ${path.basename(absPath)}: ${e.message}`);
            }
        }
    }
    // 최초 실행
    executeFile();
    const watcher = new FileWatcher();
    const mergedOpts = {
        ...opts,
        onReload: (_f) => {
            executeFile();
        },
    };
    console.log(`\x1b[2m  watching ${path.basename(absPath)}...\x1b[0m`);
    watcher.watch(absPath, mergedOpts);
}
//# sourceMappingURL=hot-reload.js.map