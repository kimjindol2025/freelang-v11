// Phase 0B binary foundation.
// The legacy binary module remains the implementation source; this adapter
// supplies strict validation and canonical AFJ names at the runtime boundary.
import { createBinaryModule as createLegacyBinaryModule } from "./stdlib-binary";

function decodeBase64(value: string): Buffer {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("binary: invalid base64 buffer");
  }
  const buf = Buffer.from(value, "base64");
  if (buf.toString("base64") !== value) throw new Error("binary: non-canonical base64 buffer");
  return buf;
}

function integer(value: number, name: string): number {
  if (!Number.isInteger(value)) throw new Error(`binary: ${name} must be an integer`);
  return value;
}

function range(offset: number, length: number, size: number): void {
  integer(offset, "offset");
  integer(length, "length");
  if (offset < 0 || length < 0 || offset > size || length > size - offset) {
    throw new Error(`binary: range out of bounds (offset=${offset}, length=${length}, size=${size})`);
  }
}

function strictUtf8(buf: Buffer): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(buf);
}

export function createBinaryFoundationModule(): Record<string, Function> {
  const legacy = createLegacyBinaryModule() as Record<string, Function>;
  const u8 = (value: number): string => {
    integer(value, "byte");
    if (value < 0 || value > 255) throw new Error("binary: byte must be between 0 and 255");
    return Buffer.from([value]).toString("base64");
  };
  const concat = (values: string[]): string => {
    if (!Array.isArray(values)) throw new Error("binary: concat expects a list");
    return Buffer.concat(values.map(decodeBase64)).toString("base64");
  };
  const len = (value: string): number => decodeBase64(value).length;
  const readU8 = (value: string, offset: number): number => {
    const buf = decodeBase64(value);
    range(offset, 1, buf.length);
    return buf[offset];
  };
  const slice = (value: string, offset: number, length: number): string => {
    const buf = decodeBase64(value);
    range(offset, length, buf.length);
    return buf.subarray(offset, offset + length).toString("base64");
  };
  const api: Record<string, Function> = {
    ...legacy,
    // buf-u8 n -> string (base64 of one byte)
    "buf-u8": u8,
    // buf-concat list -> string (base64 of concatenated byte buffers)
    "buf-concat": concat,
    // buf-len b64 -> number (byte count)
    "buf-len": len,
    // buf-read-u8 b64 offset -> number (uint8 at byte offset)
    "buf-read-u8": readU8,
    // buf-slice b64 offset len -> string (sub-buffer as base64)
    "buf-slice": slice,
    "buf_u8": u8,
    "buf_concat": concat,
    "buf_len": len,
    "buf_read_u8": readU8,
    "buf_slice": slice,
    // utf8-encode value -> string (base64 UTF-8 bytes)
    "utf8-encode": (value: string): string => Buffer.from(value, "utf-8").toString("base64"),
    // utf8-decode-strict bytes -> string (strict UTF-8)
    "utf8-decode-strict": (value: string): string => strictUtf8(decodeBase64(value)),
    // utf8-byte-length value -> number (UTF-8 byte count)
    "utf8-byte-length": (value: string): number => Buffer.byteLength(value, "utf-8"),
    // utf8-string-length value -> number (Unicode codepoint count)
    "utf8-string-length": (value: string): number => Array.from(value).length,
    "utf8_encode": (value: string): string => Buffer.from(value, "utf-8").toString("base64"),
    "utf8_decode_strict": (value: string): string => strictUtf8(decodeBase64(value)),
    "utf8_byte_length": (value: string): number => Buffer.byteLength(value, "utf-8"),
    "utf8_string_length": (value: string): number => Array.from(value).length,
  };
  return api;
}

