const fs = require("fs") as typeof import("fs");
import { createStdioModule, readLine, READ_LINE_MAX_BYTES } from "../stdlib-stdio";

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
