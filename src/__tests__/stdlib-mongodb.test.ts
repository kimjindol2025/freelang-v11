// Test suite for MongoDB stdlib
// Phase 1: BSON roundtrip tests

// jest globals — describe/it/expect/beforeAll/afterAll 자동 제공 (import 불필요)

// Import BSON functions (need to extract these from stdlib-mongodb.ts)
// For now, we'll implement inline test versions

// BSON Type codes
const BsonType = {
  Double: 0x01,
  String: 0x02,
  Document: 0x03,
  Array: 0x04,
  Boolean: 0x08,
  Null: 0x0a,
  Int32: 0x10,
  Timestamp: 0x11,
  Int64: 0x12,
  ObjectId: 0x07,
};

// Copy BSON encoder/decoder from stdlib-mongodb.ts inline for testing
function encodeBson(doc: Record<string, any>): Buffer {
  const parts: Buffer[] = [];

  for (const [key, val] of Object.entries(doc)) {
    parts.push(encodeElement(key, val));
  }

  const body = Buffer.concat(parts);
  const totalLen = 4 + body.length + 1;

  const lenBuf = Buffer.alloc(4);
  lenBuf.writeInt32LE(totalLen, 0);

  return Buffer.concat([lenBuf, body, Buffer.from([0x00])]);
}

function encodeElement(key: string, val: any): Buffer {
  const keyBuf = Buffer.from(key + "\0", "utf-8");

  if (val === null) {
    return Buffer.concat([Buffer.from([BsonType.Null]), keyBuf]);
  }

  if (typeof val === "boolean") {
    return Buffer.concat([
      Buffer.from([BsonType.Boolean]),
      keyBuf,
      Buffer.from([val ? 1 : 0]),
    ]);
  }

  if (typeof val === "number") {
    if (Number.isInteger(val) && Math.abs(val) <= 2147483647) {
      const buf = Buffer.alloc(4);
      buf.writeInt32LE(val, 0);
      return Buffer.concat([Buffer.from([BsonType.Int32]), keyBuf, buf]);
    } else {
      const buf = Buffer.alloc(8);
      buf.writeDoubleLE(val, 0);
      return Buffer.concat([Buffer.from([BsonType.Double]), keyBuf, buf]);
    }
  }

  if (typeof val === "string") {
    const strBuf = Buffer.from(val + "\0", "utf-8");
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeInt32LE(strBuf.length, 0);
    return Buffer.concat([
      Buffer.from([BsonType.String]),
      keyBuf,
      lenBuf,
      strBuf,
    ]);
  }

  if (Array.isArray(val)) {
    const arrObj: Record<string, any> = {};
    val.forEach((v, i) => {
      arrObj[i.toString()] = v;
    });
    const docBuf = encodeBson(arrObj);
    return Buffer.concat([Buffer.from([BsonType.Array]), keyBuf, docBuf]);
  }

  if (typeof val === "object") {
    const docBuf = encodeBson(val);
    return Buffer.concat([Buffer.from([BsonType.Document]), keyBuf, docBuf]);
  }

  const strBuf = Buffer.from(String(val) + "\0", "utf-8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeInt32LE(strBuf.length, 0);
  return Buffer.concat([
    Buffer.from([BsonType.String]),
    keyBuf,
    lenBuf,
    strBuf,
  ]);
}

function decodeBson(buf: Buffer): Record<string, any> {
  const result: Record<string, any> = {};

  const docLen = buf.readInt32LE(0);
  if (buf.length < docLen) {
    throw new Error(`BSON buffer too short: ${buf.length} < ${docLen}`);
  }

  let offset = 4;
  const endOffset = docLen - 1;

  while (offset < endOffset) {
    const { key, value, consumed } = decodeElement(buf, offset);
    result[key] = value;
    offset += consumed;
  }

  return result;
}

function decodeElement(
  buf: Buffer,
  offset: number
): { key: string; value: any; consumed: number } {
  const typeByte = buf[offset];
  offset += 1;

  let keyEnd = offset;
  while (buf[keyEnd] !== 0) keyEnd++;
  const key = buf.toString("utf-8", offset, keyEnd);
  offset = keyEnd + 1;

  let consumed = 1;
  consumed += key.length + 1;

  switch (typeByte) {
    case BsonType.Null:
      return { key, value: null, consumed };

    case BsonType.Boolean:
      const bool = buf[offset] !== 0;
      return { key, value: bool, consumed: consumed + 1 };

    case BsonType.Int32: {
      const val = buf.readInt32LE(offset);
      return { key, value: val, consumed: consumed + 4 };
    }

    case BsonType.Double: {
      const val = buf.readDoubleLE(offset);
      return { key, value: val, consumed: consumed + 8 };
    }

    case BsonType.String: {
      const len = buf.readInt32LE(offset);
      const val = buf.toString("utf-8", offset + 4, offset + 4 + len - 1);
      return { key, value: val, consumed: consumed + 4 + len };
    }

    case BsonType.Array:
    case BsonType.Document: {
      const len = buf.readInt32LE(offset);
      const docBuf = buf.subarray(offset, offset + len);
      const val = decodeBson(docBuf);
      if (typeByte === BsonType.Array) {
        return {
          key,
          value: Object.keys(val)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map((k) => val[k]),
          consumed: consumed + len,
        };
      }
      return { key, value: val, consumed: consumed + len };
    }

    case BsonType.Int64: {
      const val = buf.readBigInt64LE(offset);
      return { key, value: Number(val), consumed: consumed + 8 };
    }

    case BsonType.Timestamp: {
      const val = buf.readBigUInt64LE(offset);
      return { key, value: Number(val), consumed: consumed + 8 };
    }

    default:
      throw new Error(`Unknown BSON type: 0x${typeByte.toString(16)}`);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────

describe("BSON Roundtrip Tests (Phase 1)", () => {
  it("should encode/decode null", () => {
    const doc = { value: null };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.value).toBeNull();
  });

  it("should encode/decode boolean true", () => {
    const doc = { flag: true };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.flag).toBe(true);
  });

  it("should encode/decode boolean false", () => {
    const doc = { flag: false };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.flag).toBe(false);
  });

  it("should encode/decode Int32", () => {
    const doc = { count: 42 };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.count).toBe(42);
  });

  it("should encode/decode Double", () => {
    const doc = { price: 19.99 };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(Math.abs(decoded.price - 19.99) < 0.001).toBe(true);
  });

  it("should encode/decode String", () => {
    const doc = { name: "alice" };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.name).toBe("alice");
  });

  it("should encode/decode Document (nested object)", () => {
    const doc = {
      user: {
        id: 1,
        name: "bob",
      },
    };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.user.id).toBe(1);
    expect(decoded.user.name).toBe("bob");
  });

  it("should encode/decode Array", () => {
    const doc = {
      tags: ["a", "b", "c"],
    };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.tags).toEqual(["a", "b", "c"]);
  });

  it("should encode/decode mixed types", () => {
    const doc = {
      _id: "123",
      name: "test",
      age: 30,
      score: 95.5,
      active: true,
      meta: null,
      tags: ["t1", "t2"],
      nested: {
        key: "value",
      },
    };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);

    expect(decoded._id).toBe("123");
    expect(decoded.name).toBe("test");
    expect(decoded.age).toBe(30);
    expect(Math.abs(decoded.score - 95.5) < 0.001).toBe(true);
    expect(decoded.active).toBe(true);
    expect(decoded.meta).toBeNull();
    expect(decoded.tags).toEqual(["t1", "t2"]);
    expect(decoded.nested.key).toBe("value");
  });

  it("should handle large Int32 values", () => {
    const doc = { big: 2147483647 }; // Max Int32
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.big).toBe(2147483647);
  });

  it("should handle negative numbers", () => {
    const doc = { neg: -42 };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.neg).toBe(-42);
  });

  it("should handle empty object", () => {
    const doc = {};
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(Object.keys(decoded).length).toBe(0);
  });

  it("should handle empty array", () => {
    const doc = { arr: [] };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.arr).toEqual([]);
  });

  it("should handle UTF-8 strings", () => {
    const doc = { text: "안녕하세요" };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.text).toBe("안녕하세요");
  });

  it("should handle special characters in strings", () => {
    const doc = { special: 'test"with\'quotes' };
    const encoded = encodeBson(doc);
    const decoded = decodeBson(encoded);
    expect(decoded.special).toBe('test"with\'quotes');
  });
});
