// FreeLang v9: Phase 79 — 워치 모드 + 핫 리로드
// fs.watch 기반, 외부 의존성 없음

import * as fs from "fs";
import * as path from "path";
import { lex } from "./lexer";
import { parse } from "./parser";
import { Interpreter } from "./interpreter";

// ─────────────────────────────────────────
// 인터페이스
// ─────────────────────────────────────────

export interface WatchOptions {
  debounceMs?: number;       // 기본 300ms
  clearConsole?: boolean;    // 변경 시 콘솔 지우기 (기본 true)
  onReload?: (file: string) => void;
  onError?: (file: string, err: Error) => void;
}

// ─────────────────────────────────────────
// 내부 유틸: debounce
// ─────────────────────────────────────────

export function createDebounce(ms: number): (fn: () => void) => void {
  let timer: NodeJS.Timeout | null = null;
  return function debounced(fn: () => void) {
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

export class FileWatcher {
  private watchers: fs.FSWatcher[] = [];

  /**
   * 단일 파일 감시
   * @returns stop 함수
   */
  watch(file: string, opts?: WatchOptions): () => void {
    const debounceMs = opts?.debounceMs ?? 300;
    const clearConsole = opts?.clearConsole ?? true;
    const onReload = opts?.onReload;
    const onError = opts?.onError;

    const debounced = createDebounce(debounceMs);

    let watcher: fs.FSWatcher | null = null;

    try {
      watcher = fs.watch(file, (_event: string) => {
        debounced(() => {
          const basename = path.basename(file);

          if (clearConsole) {
            process.stdout.write("\x1b[2J\x1b[0f");
          }

          console.log(`\x1b[36m[RELOAD]\x1b[0m ${basename} changed`);

          if (onReload) {
            try {
              onReload(file);
            } catch (err: any) {
              if (onError) {
                onError(file, err instanceof Error ? err : new Error(String(err)));
              } else {
                console.error(`\x1b[31m[ERROR]\x1b[0m ${basename}: ${err.message ?? err}`);
              }
            }
          }
        });
      });

      this.watchers.push(watcher);
    } catch (_err) {
      // 파일이 존재하지 않아도 stop 함수는 반환
    }

    let stopped = false;
    return () => {
      if (!stopped && watcher) {
        stopped = true;
        try {
          watcher.close();
        } catch (_e) {
          // 이미 닫혀 있어도 무시
        }
        const idx = this.watchers.indexOf(watcher!);
        if (idx !== -1) this.watchers.splice(idx, 1);
      }
    };
  }

  /**
   * 디렉토리 내 pattern에 맞는 파일 감시
   * @returns stop 함수
   */
  watchDir(dir: string, pattern: string, opts?: WatchOptions): () => void {
    const debounceMs = opts?.debounceMs ?? 300;
    const clearConsole = opts?.clearConsole ?? true;
    const onReload = opts?.onReload;
    const onError = opts?.onError;

    const debounced = createDebounce(debounceMs);

    // pattern → RegExp 변환 (glob-lite: *.fl → /\.fl$/)
    const ext = pattern.replace(/^\*/, "");
    const regex = new RegExp(ext.replace(".", "\\.") + "$");

    let watcher: fs.FSWatcher | null = null;

    try {
      watcher = fs.watch(dir, (_event: string, filename: string | null) => {
        if (!filename) return;
        if (!regex.test(filename)) return;

        debounced(() => {
          if (clearConsole) {
            process.stdout.write("\x1b[2J\x1b[0f");
          }

          console.log(`\x1b[36m[RELOAD]\x1b[0m ${filename} changed`);

          const fullPath = path.join(dir, filename);

          if (onReload) {
            try {
              onReload(fullPath);
            } catch (err: any) {
              if (onError) {
                onError(fullPath, err instanceof Error ? err : new Error(String(err)));
              } else {
                console.error(`\x1b[31m[ERROR]\x1b[0m ${filename}: ${err.message ?? err}`);
              }
            }
          }
        });
      });

      this.watchers.push(watcher);
    } catch (_err) {
      // 디렉토리 오류는 무시
    }

    let stopped = false;
    return () => {
      if (!stopped && watcher) {
        stopped = true;
        try {
          watcher.close();
        } catch (_e) {
          // 무시
        }
        const idx = this.watchers.indexOf(watcher!);
        if (idx !== -1) this.watchers.splice(idx, 1);
      }
    };
  }

  /** 모든 감시 중단 */
  stopAll(): void {
    for (const w of this.watchers) {
      try { w.close(); } catch (_e) { /* 무시 */ }
    }
    this.watchers = [];
  }
}

// ─────────────────────────────────────────
// runWithWatch: 파일 실행 + 변경 감지 재실행
// ─────────────────────────────────────────

export function runWithWatch(file: string, opts?: WatchOptions): void {
  const absPath = path.resolve(file);

  function executeFile(): void {
    try {
      const source = fs.readFileSync(absPath, "utf-8");
      const tokens = lex(source);
      const ast = parse(tokens);
      const interp = new Interpreter();
      interp.currentFilePath = absPath;
      const ctx = interp.interpret(ast);
      const val = (ctx as any).lastValue;
      if (val !== null && val !== undefined) {
        if (typeof val === "object") {
          console.log(JSON.stringify(val, null, 2));
        } else {
          console.log(String(val));
        }
      }

      if (opts?.onReload) {
        opts.onReload(file);
      }
    } catch (err: any) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (opts?.onError) {
        opts.onError(file, e);
      } else {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${path.basename(absPath)}: ${e.message}`);
      }
    }
  }

  // 최초 실행
  executeFile();

  const watcher = new FileWatcher();
  const mergedOpts: WatchOptions = {
    ...opts,
    onReload: (_f: string) => {
      executeFile();
    },
  };

  console.log(`\x1b[2m  watching ${path.basename(absPath)}...\x1b[0m`);
  watcher.watch(absPath, mergedOpts);
}
