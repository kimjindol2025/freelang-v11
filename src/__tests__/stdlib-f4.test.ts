// stdlib-f4.test.ts — Phase F-4 테스트

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

describe("stdlib-f4: Phase F-4 모듈 검증", () => {
  const bootstrapPath = path.join(__dirname, "../../bootstrap.js");
  let counter = 0;

  const run = (code: string): any => {
    const tmpFile = path.join(os.tmpdir(), `fl-f4-${Date.now()}-${counter++}.fl`);
    fs.writeFileSync(tmpFile, `(json-str ${code})`);
    try {
      const out = execSync(`node ${bootstrapPath} run ${tmpFile}`, {
        encoding: "utf-8", timeout: 5000
      }).trim();
      return JSON.parse(out);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  };

  // ── optional 모듈 ────────────────────────────────────────────────
  describe("optional: 선택적 npm 브릿지", () => {
    it("require_optional: 존재하는 모듈 → true", () => {
      expect(run(`(require_optional "path")`)).toBe(true);
    });

    it("require_optional: 없는 모듈 → false", () => {
      expect(run(`(require_optional "nonexistent-module-xyz-abc")`)).toBe(false);
    });

    it("optional_has?: path 존재 → true", () => {
      expect(run(`(optional_has? "path")`)).toBe(true);
    });

    it("optional_fn: path.join 사용 가능", () => {
      const result = run(`
        (let [[$join (optional_fn "path" "join")]]
          (if (= $join nil) false true))
      `);
      expect(result).toBe(true);
    });
  });

  // ── rest-crud 모듈 ────────────────────────────────────────────────
  describe("rest-crud: REST 라우팅 매크로", () => {
    it("route_info: 기본 경로 분석", () => {
      const result = run(`(route_info "/users")`) as any;
      expect(result.base).toBe("/users");
      expect(result.param_name).toBe("user_id");
      expect(result.collection_path).toBe("/users");
      expect(result.item_path).toBe("/users/:user_id");
    });

    it("rest_crud: list+get handler → 2개 라우트", () => {
      const result = run(`
        (rest_crud "/posts"
          {"list" (fn [r] "list") "get" (fn [r] "get")})
      `) as any[];
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      const methods = result.map((r: any) => r.method);
      expect(methods).toContain("GET");
    });

    it("rest_ok: 200 응답", () => {
      const result = run(`(rest_ok {"id" 1 "name" "test"})`) as any;
      expect(result.status).toBe(200);
      expect(result.body.id).toBe(1);
    });

    it("rest_created: 201 응답", () => {
      const result = run(`(rest_created {"id" 42})`) as any;
      expect(result.status).toBe(201);
    });

    it("rest_not_found: 404 응답", () => {
      const result = run(`(rest_not_found "User not found")`) as any;
      expect(result.status).toBe(404);
      expect(result.body.error).toBe("User not found");
    });

    it("rest_error: 커스텀 에러", () => {
      const result = run(`(rest_error 422 "Validation failed")`) as any;
      expect(result.status).toBe(422);
    });

    it("path_param: 파라미터 추출", () => {
      const result = run(`
        (path_param {"params" {"user_id" "123"}} "user_id")
      `);
      expect(result).toBe("123");
    });
  });

  // ── capture-error 모듈 ────────────────────────────────────────────
  describe("capture_error: 에러 추적", () => {
    it("capture_error: 성공 케이스", () => {
      const result = run(`
        (capture_error (fn [] (+ 1 2 3)))
      `) as any;
      expect(result.ok).toBe(true);
      expect(result.result).toBe(6);
    });

    it("capture_error: 에러 캡처", () => {
      const result = run(`
        (capture_error (fn [] (throw "test error")) "test-ctx")
      `) as any;
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error.message).toBe("string");
    });

    it("error_count: 에러 수 증가", () => {
      const result = run(`
        (let [[$_ (capture_error (fn [] (throw "err1")))]
              [$n (error_count)]]
          $n)
      `) as number;
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("make_error: 에러 맵 생성", () => {
      const result = run(`(make_error "test msg" "MyError" 42)`) as any;
      expect(result.message).toBe("test msg");
      expect(result.name).toBe("MyError");
      expect(result.code).toBe(42);
    });

    it("error_message: 메시지 추출", () => {
      const result = run(`
        (error_message (make_error "hello error"))
      `);
      expect(result).toBe("hello error");
    });

    it("retry: 성공 케이스", () => {
      const result = run(`
        (retry (fn [] (* 6 7)) 3)
      `) as any;
      expect(result.ok).toBe(true);
      expect(result.result).toBe(42);
      expect(result.attempts_used).toBe(1);
    });

    it("retry: 실패 케이스", () => {
      const result = run(`
        (retry (fn [] (throw "always fails")) 2)
      `) as any;
      expect(result.ok).toBe(false);
      expect(result.attempts_used).toBe(2);
    });
  });
});
