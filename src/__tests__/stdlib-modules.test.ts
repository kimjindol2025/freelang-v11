// v11.8: stdlib 모듈별 smoke test (커버리지 확대)

import { lex } from "../lexer";
import { Parser } from "../parser";
import { Interpreter } from "../interpreter";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

function run(source: string): any {
  const tokens = lex(source);
  const ast = new Parser(tokens).parse();
  return new Interpreter().interpret(ast).lastValue;
}

describe("stdlib-time", () => {
  test("now_unix > 0", () => {
    expect(run("(now_unix)")).toBeGreaterThan(0);
  });
  test("now_ms > 0", () => {
    expect(run("(now_ms)")).toBeGreaterThan(0);
  });
  test("now_iso 포맷", () => {
    const v = run("(now_iso)");
    expect(typeof v).toBe("string");
    expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("stdlib-crypto", () => {
  test("hex_encode + hex_decode round-trip", () => {
    expect(run('(hex_decode (hex_encode "hello"))')).toBe("hello");
  });
  test("uuid_short 길이", () => {
    const v = run("(uuid_short)");
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });
  test("random_int 범위", () => {
    const v = run("(random_int 1 10)");
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThanOrEqual(10);
  });
});

describe("stdlib-data (json)", () => {
  test("json_parse + json_str round-trip", () => {
    const v = run('(json_parse "{\\"a\\":1,\\"b\\":[2,3]}")');
    expect(v.a).toBe(1);
    expect(v.b).toEqual([2, 3]);
  });
  test("json_keys", () => {
    const v = run('(json_keys (json_parse "{\\"x\\":1,\\"y\\":2}"))');
    expect(v).toEqual(expect.arrayContaining(["x", "y"]));
  });
  test("json_get nested", () => {
    const v = run('(json_get (json_parse "{\\"a\\":{\\"b\\":42}}") "a.b")');
    expect(v).toBe(42);
  });
  test("json_merge", () => {
    const v = run(`(json_merge
      (json_parse "{\\"a\\":1}")
      (json_parse "{\\"b\\":2}"))`);
    expect(v).toEqual({ a: 1, b: 2 });
  });
});

describe("stdlib-collection (arr_*)", () => {
  test("arr_unique", () => {
    expect(run("(arr_unique (list 1 2 2 3 3 3))")).toEqual([1, 2, 3]);
  });
  test("arr_flatten", () => {
    expect(run("(arr_flatten (list (list 1 2) (list 3 4)))")).toEqual([1, 2, 3, 4]);
  });
  test("arr_sum", () => {
    expect(run("(arr_sum (list 1 2 3 4 5))")).toBe(15);
  });
  test("arr_take", () => {
    expect(run("(arr_take (list 10 20 30 40) 2)")).toEqual([10, 20]);
  });
  test("arr_drop", () => {
    expect(run("(arr_drop (list 10 20 30 40) 2)")).toEqual([30, 40]);
  });
  test("arr_chunk", () => {
    const v = run("(arr_chunk (list 1 2 3 4 5 6) 2)");
    expect(v).toEqual([[1, 2], [3, 4], [5, 6]]);
  });
});

describe("stdlib-cache (in-memory TTL)", () => {
  test("cache_set + cache_get", () => {
    expect(run(`
      (cache_set "k1" 42 60)
      (cache_get "k1")
    `)).toBe(42);
  });
  test("cache_has", () => {
    expect(run(`
      (cache_set "k2" "value" 60)
      (cache_has "k2")
    `)).toBe(true);
  });
  test("cache_del", () => {
    expect(run(`
      (cache_set "k3" 1 60)
      (cache_del "k3")
      (cache_has "k3")
    `)).toBe(false);
  });
});

describe("stdlib-auth (JWT)", () => {
  test("sign + verify round-trip", () => {
    expect(run(`
      (define token (auth_jwt_sign {:sub "user1"} "secret-key-32bytes-minimum-xxxxxxx" 3600))
      (define claims (auth_jwt_verify $token "secret-key-32bytes-minimum-xxxxxxx"))
      (get $claims "sub")
    `)).toBe("user1");
  });
  test("jwt_decode (검증 없이)", () => {
    expect(run(`
      (define token (auth_jwt_sign {:role "admin"} "any-secret-key-32-bytes-xxxxxxxxxx" 3600))
      (get (auth_jwt_decode $token) "role")
    `)).toBe("admin");
  });
  test("hash_password + verify", () => {
    expect(run(`
      (define hashed (auth_hash_password "mypass"))
      (auth_verify_password "mypass" $hashed)
    `)).toBe(true);
  });
});

describe("stdlib-file (temp dir)", () => {
  const TMP = path.join(os.tmpdir(), `fl-test-${Date.now()}`);

  beforeAll(() => { fs.mkdirSync(TMP, { recursive: true }); });
  afterAll(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  });

  test("file_write + file_read", () => {
    const p = path.join(TMP, "a.txt");
    run(`(file_write "${p.replace(/\\/g, "\\\\")}" "hello")`);
    expect(run(`(file_read "${p.replace(/\\/g, "\\\\")}")`)).toBe("hello");
  });
  test("file_exists", () => {
    const p = path.join(TMP, "b.txt");
    run(`(file_write "${p.replace(/\\/g, "\\\\")}" "x")`);
    expect(run(`(file_exists "${p.replace(/\\/g, "\\\\")}")`)).toBe(true);
    expect(run(`(file_exists "${p.replace(/\\/g, "\\\\")}/nonexistent")`)).toBe(false);
  });
  test("dir_list", () => {
    run(`(file_write "${TMP.replace(/\\/g, "\\\\")}/c.txt" "")`);
    const files = run(`(dir_list "${TMP.replace(/\\/g, "\\\\")}")`);
    expect(Array.isArray(files)).toBe(true);
  });
});
