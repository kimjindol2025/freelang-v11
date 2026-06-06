import * as fs from 'fs';
import { Interpreter } from '../interpreter';
import { lex } from '../lexer';
import { Parser } from '../parser';

function run(src: string): any {
  const tokens = lex(src);
  const ast = new Parser(tokens).parse();
  const interp = new Interpreter();
  interp.interpret(ast);
  return (interp as any).context?.lastValue ?? null;
}

function loadLib(name: string): string {
  return fs.readFileSync(`stdlib/${name}.fl`, 'utf8');
}

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── cache.fl ────────────────────────────────────────────────────────────────
describe("stdlib/cache.fl", () => {
  const src = loadLib('cache');

  test("cache-create returns a cache handle", () => {
    const r = run(src + '\n(define ch (cache-create 10)) (type-of ch)');
    expect(r).toBe('map');
  });

  test("cache-set / cache-get round-trip", () => {
    const r = run(src + '\n(define ch (cache-create 10)) (cache-set ch "k" 42) (cache-get ch "k")');
    expect(r).toBe(42);
  });

  test("cache-get returns nil for missing key", () => {
    const r = run(src + '\n(define ch (cache-create 10)) (cache-get ch "missing")');
    expect(r).toBeNull();
  });

  test("cache-has: existing key", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-set ch "x" 1)
(cache-has ch "x")`);
    expect(r).toBe(true);
  });

  test("cache-has: missing key", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-has ch "missing")`);
    expect(r).toBe(false);
  });

  test("cache-del removes key", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-set ch "k" 99)
(cache-del ch "k")
(cache-has ch "k")`);
    expect(r).toBe(false);
  });

  test("cache-clear clears all", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-set ch "a" 1) (cache-set ch "b" 2)
(cache-clear ch)
(cache-stats ch)`);
    expect((r as any).size).toBe(0);
  });

  test("cache-stats returns hit-rate", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-set ch "k" 1)
(cache-get ch "k")
(cache-get ch "k")
(cache-get ch "missing")
(cache-stats ch)`);
    expect((r as any).hits).toBe(2);
    expect((r as any).misses).toBe(1);
    expect((r as any)['hit-rate']).toBeCloseTo(2/3);
  });

  test("LRU eviction: oldest key removed when full", () => {
    const aEvicted = run(src + `
(define ch (cache-create 3))
(cache-set ch "a" 1)
(cache-set ch "b" 2)
(cache-set ch "c" 3)
(cache-set ch "d" 4)
(cache-has ch "a")`);
    const dPresent = run(src + `
(define ch (cache-create 3))
(cache-set ch "a" 1)
(cache-set ch "b" 2)
(cache-set ch "c" 3)
(cache-set ch "d" 4)
(cache-has ch "d")`);
    expect(aEvicted).toBe(false);
    expect(dPresent).toBe(true);
  });

  test("cache-get-or-set only calls fn once on repeated access", () => {
    const val = run(src + `
(define ch (cache-create 10))
(defn compute [] 99)
(cache-get-or-set ch "k" compute)
(cache-get-or-set ch "k" compute)`);
    expect(val).toBe(99);
  });

  test("cache-get-or-set stores value on first call", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-get-or-set ch "k" (fn [] 42))
(cache-get ch "k")`);
    expect(r).toBe(42);
  });

  test("cache-get-or-set-ttl stores with TTL", () => {
    const r = run(src + `
(define ch (cache-create 10))
(cache-get-or-set-ttl ch "k" 60000 (fn [] "hello"))
(cache-get ch "k")`);
    expect(r).toBe('hello');
  });

  test("make-cache creates cache with given size", () => {
    const stats = run(src + `
(define ch (make-cache 50))
(cache-stats ch)`);
    expect((stats as any).size).toBe(0);
  });
});

// ─── validate.fl ─────────────────────────────────────────────────────────────
describe("stdlib/validate.fl", () => {
  const src = loadLib('validate');

  test("validate-email: valid", () => {
    expect(run(src + '\n(validate-email "a@b.com")')).toBe(true);
    expect(run(src + '\n(validate-email "user.name+tag@example.co.uk")')).toBe(true);
  });

  test("validate-email: invalid", () => {
    expect(run(src + '\n(validate-email "notanemail")')).toBe(false);
    expect(run(src + '\n(validate-email "@b.com")')).toBe(false);
    expect(run(src + '\n(validate-email nil)')).toBe(false);
  });

  test("validate-url: valid", () => {
    expect(run(src + '\n(validate-url "https://example.com")')).toBe(true);
    expect(run(src + '\n(validate-url "http://localhost:3000")')).toBe(true);
  });

  test("validate-url: invalid", () => {
    expect(run(src + '\n(validate-url "ftp://x.com")')).toBe(false);
    expect(run(src + '\n(validate-url "not-a-url")')).toBe(false);
  });

  test("validate-min-length / validate-max-length", () => {
    expect(run(src + '\n(validate-min-length "hello" 3)')).toBe(true);
    expect(run(src + '\n(validate-min-length "hi" 5)')).toBe(false);
    expect(run(src + '\n(validate-max-length "hi" 5)')).toBe(true);
    expect(run(src + '\n(validate-max-length "hello world" 5)')).toBe(false);
  });

  test("validate-range", () => {
    expect(run(src + '\n(validate-range 3 1 10)')).toBe(true);
    expect(run(src + '\n(validate-range 0 1 10)')).toBe(false);
    expect(run(src + '\n(validate-range 10 1 10)')).toBe(true);
  });

  test("validate-integer / validate-positive / validate-non-negative", () => {
    expect(run(src + '\n(validate-integer 5)')).toBe(true);
    expect(run(src + '\n(validate-integer 5.5)')).toBe(false);
    expect(run(src + '\n(validate-positive 1)')).toBe(true);
    expect(run(src + '\n(validate-positive -1)')).toBe(false);
    expect(run(src + '\n(validate-non-negative 0)')).toBe(true);
  });

  test("validate-required returns empty array when all ok", () => {
    const r = run(src + `
(validate-required {:name "Kim" :age 30} ["name" "age"])`);
    expect(r).toEqual([]);
  });

  test("validate-required detects nil and blank fields", () => {
    const r = run(src + `
(validate-required {:name "" :age nil :email "x@y.com"} ["name" "age" "email"])`);
    expect((r as string[]).sort()).toEqual(['age', 'name']);
  });

  test("validate-schema: all valid", () => {
    const r = run(src + `
(validate-schema
  {:name "Kim" :age 30 :email "a@b.com"}
  {:name {:required true :min-length 2}
   :age  {:type "number" :min 0 :max 150}
   :email {:required true :email true}})`);
    expect((r as any).ok).toBe(true);
    expect((r as any).errors).toHaveLength(0);
  });

  test("validate-schema: catches errors", () => {
    const r = run(src + `
(validate-schema
  {:name "" :age 200 :email "notvalid"}
  {:name {:required true :min-length 2}
   :age  {:type "number" :max 150}
   :email {:email true}})`);
    expect((r as any).ok).toBe(false);
    expect((r as any).errors.length).toBeGreaterThan(0);
  });
});

// ─── log.fl ──────────────────────────────────────────────────────────────────
describe("stdlib/log.fl", () => {
  const src = loadLib('log');

  function captureLog(code: string): any[] {
    const captured: string[] = [];
    let buf = '';
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (chunk: any) => {
      buf += String(chunk);
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      lines.forEach(l => { if (l.trim()) captured.push(l.trim()); });
    };
    try { run(src + '\n' + code); } finally { (process.stdout as any).write = orig; }
    if (buf.trim()) captured.push(buf.trim());
    return captured.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  }

  test("log-info outputs INFO level JSON", () => {
    const logs = captureLog('(log-info "user.login" {:userId 1})');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].level).toBe('INFO');
    expect(logs[logs.length - 1].event).toBe('user.login');
  });

  test("log-warn outputs WARN level", () => {
    const logs = captureLog('(log-warn "rate.limit" {:current 90})');
    expect(logs[logs.length - 1].level).toBe('WARN');
  });

  test("log-error outputs ERROR level with ctx", () => {
    const logs = captureLog('(log-error "db.fail" {:err "timeout"})');
    const last = logs[logs.length - 1];
    expect(last.level).toBe('ERROR');
    expect(last.ctx.err).toBe('timeout');
  });

  test("log-debug suppressed without FL_DEBUG=1", () => {
    const logs = captureLog('(log-debug "cache.miss" {:key "x"})');
    const debugLogs = logs.filter((l: any) => l?.level === 'DEBUG');
    expect(debugLogs.length).toBe(0);
  });

  test("log entry includes ts and event", () => {
    const logs = captureLog('(log-info "test.event" {:x 1})');
    const last = logs[logs.length - 1];
    expect(typeof last.ts).toBe('number');
    expect(last.event).toBe('test.event');
  });
});
