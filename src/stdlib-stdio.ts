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

export function createStdioModule() {
  return { "read-line": readLine, "readline": readLine };
}
