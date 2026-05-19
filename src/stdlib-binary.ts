// FreeLang v11: Binary Buffer Standard Library
// Base64-bridged binary I/O helpers for Bitcask-style storage engines.
// All buffers are passed as base64 strings between FreeLang and the host.

// CRC32 lookup table (IEEE 802.3 polynomial 0xEDB88320)
const CRC32_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32buf(buf: Buffer): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ buf[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createBinaryModule() {
  return {
    // buf_u32be n -> string (base64 of 4-byte big-endian uint32)
    "buf_u32be": (n: number): string => {
      const b = Buffer.alloc(4);
      b.writeUInt32BE(n >>> 0, 0);
      return b.toString("base64");
    },

    // buf_u8 n -> string (base64 of 1 byte)
    "buf_u8": (n: number): string => {
      const b = Buffer.alloc(1);
      b[0] = n & 0xFF;
      return b.toString("base64");
    },

    // buf_str s -> string (base64 of UTF-8 encoded string)
    "buf_str": (s: string): string => {
      return Buffer.from(s, "utf-8").toString("base64");
    },

    // buf_concat list -> string (base64 of concatenated byte buffers)
    "buf_concat": (list: string[]): string => {
      const parts = list.map(b64 => Buffer.from(b64, "base64"));
      return Buffer.concat(parts).toString("base64");
    },

    // buf_len b64 -> number (byte count)
    "buf_len": (b64: string): number => {
      return Buffer.from(b64, "base64").length;
    },

    // buf_read_u32be b64 offset -> number (big-endian uint32 at byte offset)
    "buf_read_u32be": (b64: string, offset: number): number => {
      const buf = Buffer.from(b64, "base64");
      return buf.readUInt32BE(offset) >>> 0;
    },

    // buf_read_u8 b64 offset -> number (uint8 at byte offset)
    "buf_read_u8": (b64: string, offset: number): number => {
      const buf = Buffer.from(b64, "base64");
      return buf[offset] & 0xFF;
    },

    // buf_read_str b64 offset len -> string (UTF-8 string from byte range)
    "buf_read_str": (b64: string, offset: number, len: number): string => {
      const buf = Buffer.from(b64, "base64");
      return buf.toString("utf-8", offset, offset + len);
    },

    // buf_crc32 b64 -> number (IEEE 802.3 CRC32 of all bytes)
    "buf_crc32": (b64: string): number => {
      return crc32buf(Buffer.from(b64, "base64"));
    },

    // buf_slice b64 offset len -> string (sub-buffer as base64)
    "buf_slice": (b64: string, offset: number, len: number): string => {
      const buf = Buffer.from(b64, "base64");
      return buf.slice(offset, offset + len).toString("base64");
    },

    // buf_from_bytes b64 -> string (alias: identity, for clarity in code)
    "buf_from_bytes": (b64: string): string => b64,

    // buf_f64le n -> string (base64 of 8-byte float64 little-endian)
    "buf_f64le": (n: number): string => {
      const b = Buffer.allocUnsafe(8);
      b.writeDoubleLE(n, 0);
      return b.toString("base64");
    },

    // buf_read_f64le b64 offset -> number (float64 LE at byte offset)
    "buf_read_f64le": (b64: string, offset: number): number => {
      return Buffer.from(b64, "base64").readDoubleLE(offset);
    },

    // buf_u32le n -> string (base64 of 4-byte uint32 little-endian)
    "buf_u32le": (n: number): string => {
      const b = Buffer.allocUnsafe(4);
      b.writeUInt32LE(n >>> 0, 0);
      return b.toString("base64");
    },

    // buf_read_u32le b64 offset -> number (uint32 LE at byte offset)
    "buf_read_u32le": (b64: string, offset: number): number => {
      return Buffer.from(b64, "base64").readUInt32LE(offset) >>> 0;
    },
  };
}
