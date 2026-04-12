// fl-math package test
import { flMathFunctions, registerFlMath } from "./index";

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

function near(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

console.log("=== fl-math package tests ===");

test("abs positive", () => {
  if (flMathFunctions["math:abs"](5) !== 5) throw new Error("fail");
});
test("abs negative", () => {
  if (flMathFunctions["math:abs"](-5) !== 5) throw new Error("fail");
});
test("sqrt", () => {
  if (!near(flMathFunctions["math:sqrt"](9), 3)) throw new Error("fail");
});
test("pow", () => {
  if (flMathFunctions["math:pow"](2, 10) !== 1024) throw new Error("fail");
});
test("floor", () => {
  if (flMathFunctions["math:floor"](3.7) !== 3) throw new Error("fail");
});
test("ceil", () => {
  if (flMathFunctions["math:ceil"](3.2) !== 4) throw new Error("fail");
});
test("round", () => {
  if (flMathFunctions["math:round"](3.5) !== 4) throw new Error("fail");
});
test("sum", () => {
  if (flMathFunctions["math:sum"]([1, 2, 3, 4, 5]) !== 15) throw new Error("fail");
});
test("mean", () => {
  if (!near(flMathFunctions["math:mean"]([2, 4, 6]), 4)) throw new Error("fail");
});
test("max", () => {
  if (flMathFunctions["math:max"]([3, 1, 4, 1, 5, 9]) !== 9) throw new Error("fail");
});
test("min", () => {
  if (flMathFunctions["math:min"]([3, 1, 4, 1, 5, 9]) !== 1) throw new Error("fail");
});
test("median odd", () => {
  if (flMathFunctions["math:median"]([1, 3, 5]) !== 3) throw new Error("fail");
});
test("clamp in range", () => {
  if (flMathFunctions["math:clamp"](5, 0, 10) !== 5) throw new Error("fail");
});
test("clamp too low", () => {
  if (flMathFunctions["math:clamp"](-5, 0, 10) !== 0) throw new Error("fail");
});
test("pi constant", () => {
  if (!near(flMathFunctions["math:pi"], Math.PI)) throw new Error("fail");
});
test("e constant", () => {
  if (!near(flMathFunctions["math:e"], Math.E)) throw new Error("fail");
});
test("sin(0)", () => {
  if (!near(flMathFunctions["math:sin"](0), 0)) throw new Error("fail");
});
test("cos(0)", () => {
  if (!near(flMathFunctions["math:cos"](0), 1)) throw new Error("fail");
});
test("registerFlMath registers all functions", () => {
  const reg: Record<string, any> = {};
  registerFlMath(reg);
  if (!("math:abs" in reg)) throw new Error("math:abs missing");
  if (!("math:mean" in reg)) throw new Error("math:mean missing");
  if (!("math:pi" in reg)) throw new Error("math:pi missing");
});
test("gcd", () => {
  if (flMathFunctions["math:gcd"](12, 8) !== 4) throw new Error("fail");
});

console.log(`\nfl-math: ${passed} passed, ${failed} failed`);
