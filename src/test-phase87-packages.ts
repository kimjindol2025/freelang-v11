// FreeLang v9: Phase 87 — 핵심 패키지 3종 통합 테스트
// fl-http-client / fl-json-schema / fl-math

import {
  createMockHttpClient,
  registerFlHttpClient,
  MockHttpClient,
} from "../packages/fl-http-client/index";
import {
  validate,
  buildSchema,
  registerFlJsonSchema,
  SchemaNode,
} from "../packages/fl-json-schema/index";
import {
  flMathFunctions,
  registerFlMath,
} from "../packages/fl-math/index";

let passed = 0;
let failed = 0;
const results: string[] = [];

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return (async () => {
    try {
      await fn();
      results.push(`  ✅ ${name}`);
      passed++;
    } catch (e: any) {
      results.push(
        `  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`
      );
      failed++;
    }
  })();
}

function near(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

async function main() {
  console.log("=== Phase 87: 핵심 패키지 3종 통합 테스트 ===\n");

  // ────────────────────────────────────────────
  // TC-1~8: fl-http-client mock 테스트
  // ────────────────────────────────────────────
  console.log("── [fl-http-client] TC-1~8 ──");

  const mock: MockHttpClient = createMockHttpClient();
  mock.addRoute("GET", "https://api.test.com/users", {
    status: 200,
    body: '[{"id":1,"name":"Alice"}]',
    headers: { "content-type": "application/json" },
  });
  mock.addRoute("POST", "https://api.test.com/users", {
    status: 201,
    body: '{"id":2,"name":"Bob"}',
    headers: {},
  });
  mock.addRoute("PUT", "https://api.test.com/users/1", {
    status: 200,
    body: '{"id":1,"name":"Alice Updated"}',
    headers: {},
  });
  mock.addRoute("DELETE", "https://api.test.com/users/1", {
    status: 204,
    body: "",
    headers: {},
  });

  await test("TC-1: MockHttpClient 인스턴스 생성", async () => {
    if (!(mock instanceof MockHttpClient)) throw new Error("인스턴스 불일치");
  });

  await test("TC-2: GET 요청 — 상태코드 200", async () => {
    const res = await mock.get("https://api.test.com/users");
    if (res.status !== 200) throw new Error(`status=${res.status}`);
  });

  await test("TC-3: GET 요청 — 바디 파싱", async () => {
    const res = await mock.get("https://api.test.com/users");
    const arr = JSON.parse(res.body);
    if (!Array.isArray(arr) || arr[0].name !== "Alice")
      throw new Error("body 불일치");
  });

  await test("TC-4: GET 요청 — 헤더 확인", async () => {
    const res = await mock.get("https://api.test.com/users");
    if (res.headers["content-type"] !== "application/json")
      throw new Error("header 없음");
  });

  await test("TC-5: POST 요청 — 상태코드 201", async () => {
    const res = await mock.post(
      "https://api.test.com/users",
      '{"name":"Bob"}'
    );
    if (res.status !== 201) throw new Error(`status=${res.status}`);
  });

  await test("TC-6: PUT 요청 — 바디 확인", async () => {
    const res = await mock.put(
      "https://api.test.com/users/1",
      '{"name":"Alice Updated"}'
    );
    const obj = JSON.parse(res.body);
    if (obj.name !== "Alice Updated") throw new Error("PUT body 불일치");
  });

  await test("TC-7: DELETE 요청 — 상태코드 204", async () => {
    const res = await mock.delete("https://api.test.com/users/1");
    if (res.status !== 204) throw new Error(`status=${res.status}`);
  });

  await test("TC-8: json() 헬퍼 — JSON 자동 파싱", async () => {
    const data = await mock.json("https://api.test.com/users");
    if (!Array.isArray(data) || data.length === 0)
      throw new Error("json() 파싱 실패");
  });

  results.forEach((r) => console.log(r));
  results.length = 0;

  // ────────────────────────────────────────────
  // TC-9~16: fl-json-schema validate 테스트
  // ────────────────────────────────────────────
  console.log("\n── [fl-json-schema] TC-9~16 ──");

  await test("TC-9: 올바른 string 타입 통과", () => {
    const r = validate("hello", { type: "string" });
    if (!r.valid) throw new Error(r.errors.join(", "));
  });

  await test("TC-10: 잘못된 타입 — number→string 실패", () => {
    const r = validate(42, { type: "string" });
    if (r.valid) throw new Error("실패해야 함");
  });

  await test("TC-11: minLength 통과", () => {
    const r = validate("hello", { type: "string", minLength: 3 });
    if (!r.valid) throw new Error(r.errors.join(", "));
  });

  await test("TC-12: minLength 실패", () => {
    const r = validate("hi", { type: "string", minLength: 5 });
    if (r.valid) throw new Error("실패해야 함");
    if (!r.errors[0].includes("minLength")) throw new Error("에러 메시지 불일치");
  });

  await test("TC-13: required 필드 통과", () => {
    const schema: SchemaNode = {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: { type: "number" },
        name: { type: "string" },
      },
    };
    const r = validate({ id: 1, name: "Kim" }, schema);
    if (!r.valid) throw new Error(r.errors.join(", "));
  });

  await test("TC-14: required 필드 누락 실패", () => {
    const schema: SchemaNode = {
      type: "object",
      required: ["id", "name"],
    };
    const r = validate({ id: 1 }, schema);
    if (r.valid) throw new Error("실패해야 함");
    if (!r.errors.some((e) => e.includes("name")))
      throw new Error("누락 필드 메시지 없음");
  });

  await test("TC-15: number minimum/maximum 통과", () => {
    const r = validate(50, { type: "number", minimum: 0, maximum: 100 });
    if (!r.valid) throw new Error(r.errors.join(", "));
  });

  await test("TC-16: array items 타입 검사 실패", () => {
    const schema: SchemaNode = {
      type: "array",
      items: { type: "number" },
    };
    const r = validate([1, 2, "x"], schema);
    if (r.valid) throw new Error("실패해야 함");
  });

  results.forEach((r) => console.log(r));
  results.length = 0;

  // ────────────────────────────────────────────
  // TC-17~24: fl-math 함수 테스트
  // ────────────────────────────────────────────
  console.log("\n── [fl-math] TC-17~24 ──");

  await test("TC-17: math:abs 음수 절댓값", () => {
    if (flMathFunctions["math:abs"](-42) !== 42) throw new Error("fail");
  });

  await test("TC-18: math:sqrt(144) = 12", () => {
    if (!near(flMathFunctions["math:sqrt"](144), 12))
      throw new Error("fail");
  });

  await test("TC-19: math:mean([1,2,3,4,5]) = 3", () => {
    if (!near(flMathFunctions["math:mean"]([1, 2, 3, 4, 5]), 3))
      throw new Error("fail");
  });

  await test("TC-20: math:sum([10,20,30]) = 60", () => {
    if (flMathFunctions["math:sum"]([10, 20, 30]) !== 60)
      throw new Error("fail");
  });

  await test("TC-21: math:max([3,1,4,1,5,9,2,6]) = 9", () => {
    if (flMathFunctions["math:max"]([3, 1, 4, 1, 5, 9, 2, 6]) !== 9)
      throw new Error("fail");
  });

  await test("TC-22: math:min([3,1,4,1,5,9]) = 1", () => {
    if (flMathFunctions["math:min"]([3, 1, 4, 1, 5, 9]) !== 1)
      throw new Error("fail");
  });

  await test("TC-23: math:pow(2, 8) = 256", () => {
    if (flMathFunctions["math:pow"](2, 8) !== 256) throw new Error("fail");
  });

  await test("TC-24: registerFlMath registry 등록 확인", () => {
    const reg: Record<string, any> = {};
    registerFlMath(reg);
    const required = [
      "math:abs",
      "math:floor",
      "math:ceil",
      "math:round",
      "math:sqrt",
      "math:pow",
      "math:log",
      "math:sin",
      "math:cos",
      "math:tan",
      "math:mean",
      "math:sum",
      "math:max",
      "math:min",
      "math:pi",
      "math:e",
    ];
    for (const key of required) {
      if (!(key in reg)) throw new Error(`${key} 미등록`);
    }
  });

  results.forEach((r) => console.log(r));

  // ────────────────────────────────────────────
  // 결과 요약
  // ────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(
    `Phase 87 결과: ${passed} PASS / ${failed} FAIL / ${passed + failed} 총계`
  );
  if (failed === 0) {
    console.log("✅ 모든 테스트 통과!");
  } else {
    console.log("❌ 일부 테스트 실패");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
