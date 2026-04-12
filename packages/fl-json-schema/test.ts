// fl-json-schema package test
import { validate, buildSchema } from "./index";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 100)}`);
    failed++;
  }
}

console.log("=== fl-json-schema package tests ===");

test("string type valid", () => {
  const r = validate("hello", { type: "string" });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("string type invalid", () => {
  const r = validate(42, { type: "string" });
  if (r.valid) throw new Error("should fail");
});

test("minLength pass", () => {
  const r = validate("hello", { type: "string", minLength: 3 });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("minLength fail", () => {
  const r = validate("hi", { type: "string", minLength: 5 });
  if (r.valid) throw new Error("should fail");
});

test("maxLength pass", () => {
  const r = validate("hi", { type: "string", maxLength: 10 });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("required fields pass", () => {
  const r = validate({ name: "Kim", age: 30 }, { type: "object", required: ["name", "age"] });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("required fields fail", () => {
  const r = validate({ name: "Kim" }, { type: "object", required: ["name", "age"] });
  if (r.valid) throw new Error("should fail");
});

test("number minimum pass", () => {
  const r = validate(10, { type: "number", minimum: 0 });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("number minimum fail", () => {
  const r = validate(-5, { type: "number", minimum: 0 });
  if (r.valid) throw new Error("should fail");
});

test("enum valid", () => {
  const r = validate("red", { enum: ["red", "green", "blue"] });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("enum invalid", () => {
  const r = validate("yellow", { enum: ["red", "green", "blue"] });
  if (r.valid) throw new Error("should fail");
});

test("nested object properties", () => {
  const schema = {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, minLength: 1 },
      age: { type: "number" as const, minimum: 0 },
    },
  };
  const r = validate({ name: "Alice", age: 25 }, schema);
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("array items validation pass", () => {
  const r = validate([1, 2, 3], { type: "array", items: { type: "number" } });
  if (!r.valid) throw new Error(r.errors.join(", "));
});

test("array items validation fail", () => {
  const r = validate([1, "x", 3], { type: "array", items: { type: "number" } });
  if (r.valid) throw new Error("should fail");
});

test("buildSchema creates correct schema", () => {
  const s = buildSchema("string", { minLength: 3, maxLength: 10 });
  if (s.type !== "string") throw new Error("type wrong");
  if (s.minLength !== 3) throw new Error("minLength wrong");
  if (s.maxLength !== 10) throw new Error("maxLength wrong");
});

console.log(`\nfl-json-schema: ${passed} passed, ${failed} failed`);
