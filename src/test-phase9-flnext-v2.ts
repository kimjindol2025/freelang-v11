// FreeLang v9: Phase 9 — FLNext v2 웹프레임워크 테스트
// ORM, 검증, 미들웨어 (30 tests)

import { createOrmModule } from "./stdlib-orm";
import { createValidationModule } from "./stdlib-validation";
import { createMiddlewareModule } from "./stdlib-middleware";

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    testsPassed++;
    console.log(`  ✅  ${name}`);
  } catch (err: any) {
    testsFailed++;
    console.error(`  ❌  ${name}`);
    console.error(`      ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${expected}, got ${actual}`
    );
  }
}

console.log("\n🧪 Phase 9 — FLNext v2 웹프레임워크 테스트\n");

// ─────────────────────────────────────────
// ORM Tests (10)
// ─────────────────────────────────────────

test("ORM 1: ORM Module 생성", () => {
  const orm = createOrmModule();
  assert(orm !== null, "Should create ORM module");
  assert(typeof orm === "object", "Should be object");
});

test("ORM 2: Model 정의", () => {
  const orm = createOrmModule();
  const result = (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer", primaryKey: true },
    { name: "email", type: "string", unique: true },
    { name: "name", type: "string" }
  ]);

  assert(result !== null, "Should define model");
  assert(result.name === "User", "Model name should match");
  assert(result.fields === 3, "Should have 3 fields");
});

test("ORM 3: 데이터 생성", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer", primaryKey: true },
    { name: "email", type: "string" },
    { name: "name", type: "string" }
  ]);

  const result = (orm.orm_create as Function).call(orm, "User", {
    email: "test@example.com",
    name: "Test User"
  });

  assert(result !== null, "Should create record");
  assert("id" in result, "Should have id");
  assert(result.email === "test@example.com", "Email should match");
});

test("ORM 4: ID로 찾기", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer", primaryKey: true }
  ]);

  const result = (orm.orm_find as Function).call(orm, "User", 123);
  assert(result !== null, "Should find record");
  assert("id" in result, "Should have id");
});

test("ORM 5: 필드로 찾기", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "email", type: "string" }
  ]);

  const result = (orm.orm_find_by as Function).call(orm, "User", "email", "test@example.com");
  assert(result !== null, "Should find record");
  assert(result.email === "test@example.com", "Email should match");
});

test("ORM 6: 조건으로 찾기", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "age", type: "integer" }
  ]);

  const result = (orm.orm_where as Function).call(orm, "User", { age: 25 });
  assert(Array.isArray(result), "Should return array");
  assert(result.length > 0, "Should have results");
});

test("ORM 7: 데이터 업데이트", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer", primaryKey: true },
    { name: "name", type: "string" }
  ]);

  const result = (orm.orm_update as Function).call(orm, "User", 123, { name: "Updated" });
  assert(result !== null, "Should update record");
  assert(result.name === "Updated", "Name should be updated");
});

test("ORM 8: 데이터 삭제", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer", primaryKey: true }
  ]);

  const result = (orm.orm_delete as Function).call(orm, "User", 123);
  assertEquals(result, true, "Should delete successfully");
});

test("ORM 9: 모든 레코드 조회", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer" }
  ]);

  const result = (orm.orm_all as Function).call(orm, "User");
  assert(Array.isArray(result), "Should return array");
});

test("ORM 10: 레코드 개수 조회", () => {
  const orm = createOrmModule();
  (orm.orm_define_model as Function).call(orm, "User", "users", [
    { name: "id", type: "integer" }
  ]);

  const result = (orm.orm_count as Function).call(orm, "User");
  assert(typeof result === "number", "Should return number");
});

// ─────────────────────────────────────────
// Validation Tests (10)
// ─────────────────────────────────────────

test("Validation 1: Validation Module 생성", () => {
  const validation = createValidationModule();
  assert(validation !== null, "Should create module");
});

test("Validation 2: 스키마 정의", () => {
  const validation = createValidationModule();
  const schema = (validation.schema_define as Function).call(validation, "UserSchema", {
    email: { type: "email", required: true },
    name: { type: "string", required: true, min: 1, max: 100 }
  });

  assert(schema !== null, "Should define schema");
  assert(schema.name === "UserSchema", "Schema name should match");
});

test("Validation 3: 유효한 데이터 검증", () => {
  const validation = createValidationModule();
  (validation.schema_define as Function).call(validation, "UserSchema", {
    email: { type: "email", required: true },
    name: { type: "string", required: true }
  });

  const result = (validation.schema_validate as Function).call(validation, "UserSchema", {
    email: "test@example.com",
    name: "Test User"
  });

  assert(result.valid === true, "Should be valid");
  assert(result.errors.length === 0, "Should have no errors");
});

test("Validation 4: 무효한 이메일", () => {
  const validation = createValidationModule();
  (validation.schema_define as Function).call(validation, "UserSchema", {
    email: { type: "email", required: true }
  });

  const result = (validation.schema_validate as Function).call(validation, "UserSchema", {
    email: "invalid-email"
  });

  assert(result.valid === false, "Should be invalid");
  assert(result.errors.length > 0, "Should have errors");
});

test("Validation 5: 필수 필드 누락", () => {
  const validation = createValidationModule();
  (validation.schema_define as Function).call(validation, "UserSchema", {
    name: { type: "string", required: true }
  });

  const result = (validation.schema_validate as Function).call(validation, "UserSchema", {});
  assert(result.valid === false, "Should be invalid");
});

test("Validation 6: 스키마 검증 (is_valid)", () => {
  const validation = createValidationModule();
  (validation.schema_define as Function).call(validation, "UserSchema", {
    email: { type: "email", required: true }
  });

  const isValid = (validation.schema_is_valid as Function).call(validation, "UserSchema", {
    email: "test@example.com"
  });

  assertEquals(isValid, true, "Should be valid");
});

test("Validation 7: 문자열 길이 검증", () => {
  const validation = createValidationModule();
  (validation.schema_define as Function).call(validation, "NameSchema", {
    name: { type: "string", min: 1, max: 10 }
  });

  const result = (validation.schema_validate as Function).call(validation, "NameSchema", {
    name: "x".repeat(20)
  });

  assert(result.valid === false, "Should be invalid (too long)");
});

test("Validation 8: 번호 범위 검증", () => {
  const validation = createValidationModule();
  (validation.schema_define as Function).call(validation, "AgeSchema", {
    age: { type: "number", min: 0, max: 150 }
  });

  const result = (validation.schema_validate as Function).call(validation, "AgeSchema", {
    age: 200
  });

  assert(result.valid === false, "Should be invalid (out of range)");
});

test("Validation 9: 정규식 검증", () => {
  const validation = createValidationModule();
  const isValid = (validation.validate_regex as Function).call(validation, "test123", "^[a-z]+[0-9]+$");
  assertEquals(isValid, true, "Should match pattern");
});

test("Validation 10: 이메일 유효성 검증", () => {
  const validation = createValidationModule();
  const isValid = (validation.validate_email as Function).call(validation, "test@example.com");
  assertEquals(isValid, true, "Should be valid email");
});

// ─────────────────────────────────────────
// Middleware Tests (10)
// ─────────────────────────────────────────

test("Middleware 1: Middleware Module 생성", () => {
  const mw = createMiddlewareModule();
  assert(mw !== null, "Should create module");
});

test("Middleware 2: 미들웨어 정의", () => {
  const mw = createMiddlewareModule();
  const result = (mw.middleware_define as Function).call(mw, "test-mw", undefined, (req: any) => req);

  assert(result !== null, "Should define middleware");
  assert(result.name === "test-mw", "Middleware name should match");
});

test("Middleware 3: 미들웨어 체인 생성", () => {
  const mw = createMiddlewareModule();
  (mw.middleware_define as Function).call(mw, "mw1", undefined, (req: any) => req);
  (mw.middleware_define as Function).call(mw, "mw2", undefined, (req: any) => req);

  const chain = (mw.middleware_create_chain as Function).call(mw, ["mw1", "mw2"]);
  assert(Array.isArray(chain), "Should create chain");
  assert(chain.length === 2, "Chain should have 2 middlewares");
});

test("Middleware 4: 체인 적용", () => {
  const mw = createMiddlewareModule();
  (mw.middleware_define as Function).call(mw, "add-user", undefined, (req: any) => ({
    ...req,
    user: { id: 1 }
  }));

  (mw.middleware_create_chain as Function).call(mw, ["add-user"]);
  const result = (mw.middleware_apply_chain as Function).call(mw, 0, { path: "/test" });

  assert(result.passed === true, "Should pass chain");
  assert(result.request.user !== undefined, "Should add user to request");
});

test("Middleware 5: 내장 Auth 미들웨어", () => {
  const mw = createMiddlewareModule();
  const authMw = (mw.middleware_auth_check as Function).call(mw);
  assert(authMw !== null, "Should create auth middleware");
  assert(authMw.name === "auth-check", "Middleware name should match");
});

test("Middleware 6: 내장 Logging 미들웨어", () => {
  const mw = createMiddlewareModule();
  const loggingMw = (mw.middleware_logging as Function).call(mw);
  assert(loggingMw !== null, "Should create logging middleware");
  assert(loggingMw.name === "logging", "Middleware name should match");
});

test("Middleware 7: 내장 Rate Limit 미들웨어", () => {
  const mw = createMiddlewareModule();
  const rateLimitMw = (mw.middleware_rate_limit as Function).call(mw, 100, 60000);
  assert(rateLimitMw !== null, "Should create rate limit middleware");
  assert(rateLimitMw.name === "rate-limit", "Middleware name should match");
});

test("Middleware 8: 내장 CORS 미들웨어", () => {
  const mw = createMiddlewareModule();
  const corsMw = (mw.middleware_cors as Function).call(mw, "*");
  assert(corsMw !== null, "Should create CORS middleware");
  assert(corsMw.name === "cors", "Middleware name should match");
});

test("Middleware 9: 조건부 미들웨어", () => {
  const mw = createMiddlewareModule();
  (mw.middleware_define as Function).call(mw, "check-auth",
    (req: any) => !!req.token,
    (req: any) => ({ ...req, authenticated: true })
  );

  (mw.middleware_create_chain as Function).call(mw, ["check-auth"]);
  const result = (mw.middleware_apply_chain as Function).call(mw, 0, { token: "abc123" });

  assert(result.passed === true, "Should pass with token");
});

test("Middleware 10: 미들웨어 체인에 추가", () => {
  const mw = createMiddlewareModule();
  (mw.middleware_define as Function).call(mw, "mw1", undefined, (req: any) => req);
  (mw.middleware_define as Function).call(mw, "mw2", undefined, (req: any) => req);

  const chain = (mw.middleware_create_chain as Function).call(mw, ["mw1"]);
  const updated = (mw.middleware_add_to_chain as Function).call(mw, 0, "mw2");

  assert(updated.length === 2, "Chain should have 2 middlewares");
});

// ─────────────────────────────────────────
// Results
// ─────────────────────────────────────────

console.log("\n" + "─".repeat(50));
console.log(`\n📊 Test Results: ${testsPassed}/${testsPassed + testsFailed} PASS\n`);

if (testsFailed > 0) {
  console.error(`❌ ${testsFailed} tests failed\n`);
  process.exit(1);
} else {
  console.log(`✅ All tests passed!\n`);
  process.exit(0);
}
