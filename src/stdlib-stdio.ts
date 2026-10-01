// Synchronous stdin line input shared by the interpreter's two public names.
import * as fs from "fs";
import { TextDecoder } from "util";

export const READ_LINE_MAX_BYTES = 1024 * 1024;

function inputError(message: string, range = false): Error {
  const error = range ? new RangeError(message) : new Error(message);
  (error as Error & { code: string }).code = "FL_READ_LINE_ERROR";
  return error;
}

function waitForInputRetry(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
}

export function readLine(prompt?: unknown): string | null {
  if (prompt !== undefined && prompt !== null && prompt !== "") {
    process.stderr.write(String(prompt));
  }

  const bytes: number[] = [];
  const byte = Buffer.allocUnsafe(1);
  while (true) {
    let count: number;
    try {
      count = fs.readSync(process.stdin.fd, byte, 0, 1, null);
    } catch (error: any) {
      if (error?.code === "EAGAIN" || error?.code === "EWOULDBLOCK") {
        waitForInputRetry();
        continue;
      }
      throw inputError(`read-line: stdin read failed: ${error.message}`);
    }
    if (count === 0 && bytes.length === 0) return null;
    if (count === 0 || byte[0] === 10) {
      if (count !== 0 && bytes[bytes.length - 1] === 13) bytes.pop();
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(bytes));
      } catch {
        throw inputError("read-line: invalid UTF-8");
      }
    }
    bytes.push(byte[0]);
    if (bytes.length > READ_LINE_MAX_BYTES) {
      throw inputError(`read-line: line exceeds ${READ_LINE_MAX_BYTES} bytes`, true);
    }
  }
}

export function onStdinLine(callback: (event: { kind: string; line?: string; message?: string }) => void,
                            tickMs?: number): null {
  if (typeof callback !== "function") throw new Error("stdin-on-line: callback required");
  if (tickMs !== undefined && (!Number.isInteger(tickMs) || tickMs < 1 || tickMs > 60000))
    throw new Error("stdin-on-line: invalid tick interval");
  let pending = Buffer.alloc(0);
  let ended = false;
  let timer: NodeJS.Timeout | undefined;
  const stop = () => {
    if (timer) clearInterval(timer);
    process.stdin.removeListener("data", onData);
    process.stdin.removeListener("end", onEnd);
    process.stdin.removeListener("error", onError);
    process.stdin.pause();
  };
  const fail = (message: string) => {
    if (ended) return;
    ended = true;
    stop();
    process.stderr.write(message + "\n");
    process.exitCode = 1;
    callback({ kind: "error", message });
  };
  const deliver = (bytes: Buffer) => {
    if (bytes.length > READ_LINE_MAX_BYTES) {
      fail(`stdin-on-line: line exceeds ${READ_LINE_MAX_BYTES} bytes`);
      return;
    }
    const line = bytes.length > 0 && bytes[bytes.length - 1] === 13 ? bytes.subarray(0, -1) : bytes;
    let decoded: string;
    try {
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(line);
    } catch {
      fail("stdin-on-line: invalid UTF-8");
      return;
    }
    callback({ kind: "line", line: decoded });
  };
  const onData = (chunk: Buffer) => {
    let start = 0;
    for (let index = 0; index < chunk.length && !ended; index++) {
      if (chunk[index] !== 10) continue;
      deliver(Buffer.concat([pending, chunk.subarray(start, index)]));
      pending = Buffer.alloc(0);
      start = index + 1;
    }
    if (ended) return;
    pending = Buffer.concat([pending, chunk.subarray(start)]);
    if (pending.length > READ_LINE_MAX_BYTES) fail(`stdin-on-line: line exceeds ${READ_LINE_MAX_BYTES} bytes`);
  };
  const onEnd = () => {
    if (ended) return;
    if (pending.length > 0) deliver(pending);
    if (ended) return;
    ended = true;
    stop();
    callback({ kind: "eof" });
  };
  const onError = (error: Error) => fail(`stdin-on-line: stdin read failed: ${error.message}`);
  process.stdin.on("data", onData);
  process.stdin.on("end", onEnd);
  process.stdin.on("error", onError);
  if (tickMs !== undefined) timer = setInterval(() => callback({ kind: "tick" }), tickMs);
  process.stdin.resume();
  return null;
}

export function createStdioModule(invokeCallback?: (fnValue: any, args: any[]) => any) {
  return {
    "read-line": readLine,
    "readline": readLine,
    "stdin-on-line": (fnValue: any, tickMs?: number) => onStdinLine((event) => {
      if (!invokeCallback) throw new Error("stdin-on-line: callback invocation unavailable");
      invokeCallback(fnValue, [event]);
    }, tickMs),
  };
}
