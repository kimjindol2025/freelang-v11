// stdlib-helpers.test.ts — Phase G: MISTAKES-100 자동 처리 검증

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

describe("stdlib-helpers: Phase G MISTAKES-100", () => {
  const bootstrapPath = path.join(__dirname, "../../bootstrap.js");
  let testCounter = 0;

  const run = (code: string) => {
    const tmpFile = path.join(os.tmpdir(), `fl-helpers-${Date.now()}-${testCounter++}.fl`);
    const wrappedCode = `(json-str ${code})`;
    fs.writeFileSync(tmpFile, wrappedCode);
    try {
      const output = execSync(`node ${bootstrapPath} run ${tmpFile}`, {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      return JSON.parse(output);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  };

  // ── G-1: 에러 추천 ─────────────────────────────────────────
  describe("G-1: 에러 추천", () => {
    it("suggest-fn: console_log → println", () => {
      const r = run(`(suggest-fn "console_log")`);
      expect(r).toContain("println");
    });

    it("suggest-fn: push → append", () => {
      expect(run(`(suggest-fn "push")`)).toContain("append");
    });

    it("suggest-fn: fetch → http_get", () => {
      expect(run(`(suggest-fn "fetch")`)).toContain("http_get");
    });

    it("alias-of: console_log returns object", () => {
      const r = run(`(alias-of "console_log")`);
      expect(r).toBeTruthy();
      expect(r.correct).toBe("println");
    });

    it("alias-of: unknown returns nil", () => {
      const r = run(`(alias-of "nonexistent_xyz_12345")`);
      expect(r).toBeNull();
    });

    it("help-text: 알려진 별칭", () => {
      const r = run(`(help-text "console_log")`);
      expect(r).toMatch(/println/);
    });
  });

  // ── G-2: 인자 자동 수정 ────────────────────────────────────
  describe("G-2: 인자 자동 감지", () => {
    it("smart-map (fn arr) — 정상", () => {
      expect(run(`(smart-map (fn [$x] (* $x 2)) [1 2 3])`)).toEqual([2, 4, 6]);
    });

    it("smart-map (arr fn) — 자동 수정", () => {
      expect(run(`(smart-map [1 2 3] (fn [$x] (* $x 2)))`)).toEqual([2, 4, 6]);
    });

    it("smart-filter (fn arr)", () => {
      expect(run(`(smart-filter (fn [$x] (> $x 2)) [1 2 3 4])`)).toEqual([3, 4]);
    });

    it("smart-filter (arr fn) — 자동 수정", () => {
      expect(run(`(smart-filter [1 2 3 4] (fn [$x] (> $x 2)))`)).toEqual([3, 4]);
    });

    it("smart-get (map key)", () => {
      expect(run(`(smart-get {:name "kim"} "name")`)).toBe("kim");
    });

    it("smart-get (key map) — 자동 수정", () => {
      expect(run(`(smart-get "name" {:name "kim"})`)).toBe("kim");
    });

    it("smart-get (arr idx)", () => {
      expect(run(`(smart-get [10 20 30] 1)`)).toBe(20);
    });

    it("smart-assoc (map k v)", () => {
      expect(run(`(smart-assoc {:a 1} "b" 2)`)).toEqual({ a: 1, b: 2 });
    });

    it("smart-assoc (k v map) — 자동 수정", () => {
      expect(run(`(smart-assoc "b" 2 {:a 1})`)).toEqual({ a: 1, b: 2 });
    });
  });

  // ── G-3-B: try-call (Result) ────────────────────────────────
  describe("G-3-B: try-call (Result 패턴)", () => {
    it("try-call: 성공 시 Ok 반환", () => {
      const r = run(`(try-call (fn [] (+ 1 2)))`);
      expect(r._tag).toBe("Ok");
      expect(r.value).toBe(3);
    });

    it("try-call: 실패 시 Err 반환", () => {
      const r = run(`(try-call (fn [] (error "boom")))`);
      expect(r._tag).toBe("Err");
      expect(r.message).toMatch(/boom/);
    });

    it("ok? + unwrap: 성공 케이스", () => {
      expect(run(`(ok? (try-call (fn [] 42)))`)).toBe(true);
      expect(run(`(unwrap (try-call (fn [] 42)))`)).toBe(42);
    });

    it("err? + unwrap-or: 실패 케이스", () => {
      expect(run(`(err? (try-call (fn [] (error "x"))))`)).toBe(true);
      expect(run(`(unwrap-or (try-call (fn [] (error "x"))) 999)`)).toBe(999);
    });

    it("try-call-1: 인자 1개", () => {
      const r = run(`(try-call-1 (fn [$x] (* $x 10)) 5)`);
      expect(r._tag).toBe("Ok");
      expect(r.value).toBe(50);
    });
  });
});
