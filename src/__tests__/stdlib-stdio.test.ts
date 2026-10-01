const fs = require("fs") as typeof import("fs");
import { createStdioModule, onStdinLine, readLine, READ_LINE_MAX_BYTES } from "../stdlib-stdio";

function feed(bytes: Buffer): jest.SpyInstance {
  let offset = 0;
  return jest.spyOn(fs, "readSync").mockImplementation(((_fd: number, byte: Buffer) => {
    if (offset === bytes.length) return 0;
    byte[0] = bytes[offset++];
    return 1;
  }) as typeof fs.readSync);
}

afterEach(() => jest.restoreAllMocks());

test("aliases read UTF-8, CRLF, blank line, and EOF without consuming the next line", () => {
  feed(Buffer.from("한글\r\n\n끝"));
  const module = createStdioModule();
  expect(module["read-line"]()).toBe("한글");
  expect(module.readline()).toBe("");
  expect(readLine()).toBe("끝");
  expect(readLine()).toBeNull();
});

test("prompt goes to stderr", () => {
  feed(Buffer.from("ok\n"));
  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  expect(readLine("prompt> ")).toBe("ok");
  expect(stderr).toHaveBeenCalledWith("prompt> ");
});

test("retries transient non-blocking stdin reads", () => {
  let attempts = 0;
  jest.spyOn(fs, "readSync").mockImplementation(((_fd: number, byte: Buffer) => {
    if (attempts++ === 0) {
      const error = new Error("EAGAIN") as NodeJS.ErrnoException;
      error.code = "EAGAIN";
      throw error;
    }
    byte[0] = 10;
    return 1;
  }) as typeof fs.readSync);
  expect(readLine()).toBe("");
  expect(attempts).toBe(2);
});

test("invalid UTF-8, read failures, and overlong lines are distinct errors", () => {
  feed(Buffer.from([0xc3, 0x28, 10]));
  expect(readLine).toThrow("read-line: invalid UTF-8");
  jest.restoreAllMocks();

  jest.spyOn(fs, "readSync").mockImplementation(() => { throw new Error("EIO"); });
  expect(readLine).toThrow("read-line: stdin read failed: EIO");
  jest.restoreAllMocks();

  feed(Buffer.alloc(READ_LINE_MAX_BYTES + 1, 65));
  expect(readLine).toThrow(`read-line: line exceeds ${READ_LINE_MAX_BYTES} bytes`);
});

test("asynchronous stdin preserves UTF-8, blank lines, partial EOF, and error boundaries", () => {
  const handlers = new Map<string, (...args: any[]) => void>();
  jest.spyOn(process.stdin, "on").mockImplementation(((event: string, handler: (...args: any[]) => void) => {
    handlers.set(event, handler);
    return process.stdin;
  }) as typeof process.stdin.on);
  jest.spyOn(process.stdin, "removeListener").mockImplementation(() => process.stdin);
  jest.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin);
  jest.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
  const events: any[] = [];
  onStdinLine(event => events.push(event));
  handlers.get("data")!(Buffer.from("한글\r\n\n끝"));
  handlers.get("end")!();
  expect(events).toEqual([
    { kind: "line", line: "한글" }, { kind: "line", line: "" },
    { kind: "line", line: "끝" }, { kind: "eof" },
  ]);

  const stderr = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const previousExitCode = process.exitCode;
  try {
    const invalid: any[] = [];
    onStdinLine(event => invalid.push(event));
    handlers.get("data")!(Buffer.from([0xc3, 0x28, 10]));
    expect(invalid).toEqual([{ kind: "error", message: "stdin-on-line: invalid UTF-8" }]);
    expect(process.exitCode).toBe(1);
    expect(stderr).toHaveBeenCalledWith("stdin-on-line: invalid UTF-8\n");
  } finally {
    process.exitCode = previousExitCode;
  }
});

test("asynchronous stdin emits ticks while idle and clears its timer on EOF", () => {
  jest.useFakeTimers();
  const handlers = new Map<string, (...args: any[]) => void>();
  jest.spyOn(process.stdin, "on").mockImplementation(((event: string, handler: (...args: any[]) => void) => {
    handlers.set(event, handler);
    return process.stdin;
  }) as typeof process.stdin.on);
  jest.spyOn(process.stdin, "removeListener").mockImplementation(() => process.stdin);
  jest.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin);
  jest.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
  try {
    const events: any[] = [];
    onStdinLine(event => events.push(event), 10);
    jest.advanceTimersByTime(25);
    expect(events).toEqual([{ kind: "tick" }, { kind: "tick" }]);
    handlers.get("end")!();
    jest.advanceTimersByTime(20);
    expect(events).toEqual([{ kind: "tick" }, { kind: "tick" }, { kind: "eof" }]);
  } finally {
    jest.useRealTimers();
  }
});
