// Phase 66: defstruct — 타입이 있는 레코드 타입 테스트
// (defstruct Point [:x :float :y :float])
// → constructor / predicate / field accessor 자동 생성

import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual(actual: any, expected: any, msg?: string): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ?? "assertEqual"}: expected ${e}, got ${a}`);
}

function run(interp: Interpreter, src: string): any {
  const ctx = interp.run(src);
  return ctx.lastValue;
}

// ─────────────────────────────────────────────
console.log("\n=== Phase 66: defstruct 테스트 ===\n");

// TC-1: defstruct 정의 성공
test("TC-1: defstruct Point 정의", () => {
  const interp = new Interpreter();
  interp.run(`(defstruct Point [:x :float :y :float])`);
  // registry에 등록됐는지 확인
  const def = interp.context.structs.get("Point");
  assert(def !== undefined, "Point should be registered in StructRegistry");
  assert(def!.fields.length === 2, `expected 2 fields, got ${def!.fields.length}`);
  assertEqual(def!.fields[0], { name: "x", type: "float" });
  assertEqual(def!.fields[1], { name: "y", type: "float" });
});

// TC-2: 생성자 호출 → 올바른 필드 구조
test("TC-2: (Point 1.0 2.0) → {:x 1.0 :y 2.0 :__type 'Point'}", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct Point [:x :float :y :float])`);
  const pt = run(interp, `(Point 1.0 2.0)`);
  assert(typeof pt === "object" && pt !== null, "Point() should return an object");
  assertEqual(pt.x, 1.0);
  assertEqual(pt.y, 2.0);
});

// TC-3: __type 태그 확인
test("TC-3: __type 태그가 'Point'", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct Point [:x :float :y :float])`);
  const pt = run(interp, `(Point 3.0 4.0)`);
  assertEqual(pt.__type, "Point", "__type should be 'Point'");
});

// TC-4: predicate (Point?) → true/false
test("TC-4a: (Point? pt) → true", () => {
  const interp = new Interpreter();
  run(interp, `
    (defstruct Point [:x :float :y :float])
    (define pt (Point 1.0 2.0))
  `);
  const result = run(interp, `(Point? pt)`);
  assert(result === true, `expected true, got ${result}`);
});

test("TC-4b: (Point? 42) → false", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct Point [:x :float :y :float])`);
  const result = run(interp, `(Point? 42)`);
  assert(result === false, `expected false, got ${result}`);
});

test("TC-4c: (Point? nil) → false", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct Point [:x :float :y :float])`);
  const result = run(interp, `(Point? nil)`);
  assert(result === false, `expected false, got ${result}`);
});

// TC-5: field accessor (Point.x, Point.y)
test("TC-5a: (Point.x pt) → 1.0", () => {
  const interp = new Interpreter();
  run(interp, `
    (defstruct Point [:x :float :y :float])
    (define pt (Point 1.0 2.0))
  `);
  const result = run(interp, `(Point.x pt)`);
  assertEqual(result, 1.0, "Point.x");
});

test("TC-5b: (Point.y pt) → 2.0", () => {
  const interp = new Interpreter();
  run(interp, `
    (defstruct Point [:x :float :y :float])
    (define pt (Point 1.0 2.0))
  `);
  const result = run(interp, `(Point.y pt)`);
  assertEqual(result, 2.0, "Point.y");
});

// TC-6: 여러 struct 정의 (Point + User)
test("TC-6a: User struct 정의 및 생성자", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct User [:name :string :age :int :email :string])`);
  const u = run(interp, `(User "Alice" 30 "alice@example.com")`);
  assertEqual(u.__type, "User");
  assertEqual(u.name, "Alice");
  assertEqual(u.age, 30);
  assertEqual(u.email, "alice@example.com");
});

test("TC-6b: 두 struct 공존 — Point? vs User?", () => {
  const interp = new Interpreter();
  run(interp, `
    (defstruct Point [:x :float :y :float])
    (defstruct User [:name :string :age :int :email :string])
    (define pt (Point 1.0 2.0))
    (define u (User "Alice" 30 "alice@example.com"))
  `);
  const ptIsPoint = run(interp, `(Point? pt)`);
  const ptIsUser  = run(interp, `(User? pt)`);
  const uIsUser   = run(interp, `(User? u)`);
  assert(ptIsPoint === true,  "pt should be Point");
  assert(ptIsUser  === false, "pt should not be User");
  assert(uIsUser   === true,  "u should be User");
});

test("TC-6c: User.name accessor", () => {
  const interp = new Interpreter();
  run(interp, `
    (defstruct User [:name :string :age :int :email :string])
    (define u (User "Alice" 30 "alice@example.com"))
  `);
  const name = run(interp, `(User.name u)`);
  assertEqual(name, "Alice", "User.name");
});

// TC-7: 잘못된 인자 수 → 에러
test("TC-7: 생성자 인자 수 불일치 → 에러", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct Point [:x :float :y :float])`);
  let threw = false;
  try {
    run(interp, `(Point 1.0)`); // y 빠짐
  } catch (e: any) {
    threw = true;
    assert(e.message.includes("expected 2"), `error message should mention 'expected 2': ${e.message}`);
  }
  assert(threw, "Should throw on wrong arg count");
});

// TC-8: StructRegistry.getFields / isStruct 유틸
test("TC-8a: registry.getFields('Point') → ['x','y']", () => {
  const interp = new Interpreter();
  run(interp, `(defstruct Point [:x :float :y :float])`);
  const fields = interp.context.structs.getFields("Point");
  assertEqual(fields, ["x", "y"]);
});

test("TC-8b: registry.isStruct(pt) → true", () => {
  const interp = new Interpreter();
  interp.run(`(defstruct Point [:x :float :y :float])`);
  const ctx = interp.run(`(Point 5.0 6.0)`);
  const pt = ctx.lastValue;
  assert(interp.context.structs.isStruct(pt), "pt should be struct");
  assert(!interp.context.structs.isStruct(42), "42 is not a struct");
  assert(!interp.context.structs.isStruct(null), "null is not a struct");
});

// TC-9: Phase 56 regression — lexical scope 기능 정상 작동
test("TC-9a: Phase 56 regression — 클로저 캡처", () => {
  const interp = new Interpreter();
  // make-adder: 클로저로 $base 캡처
  interp.run(`(define base 10)`);
  interp.run(`(define add-base (fn [$x] (+ $x base)))`);
  const result = run(interp, `(add-base 5)`);
  assertEqual(result, 15, "closure captures base=10");
});

test("TC-9b: Phase 56 regression — let 스코프", () => {
  const interp = new Interpreter();
  // let 형식: [[$x val] [$y val]] — 중첩 배열
  const result = run(interp, `(let [[$x 10] [$y 20]] (+ $x $y))`);
  assertEqual(result, 30, "let should work");
});

test("TC-9c: Phase 56 regression — define + fn 파라미터", () => {
  const interp = new Interpreter();
  interp.run(`(define add (fn [$a $b] (+ $a $b)))`);
  const result = run(interp, `(add 3 4)`);
  assertEqual(result, 7, "add fn should work");
});

// ─────────────────────────────────────────────
console.log(`\n결과: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\n일부 테스트 실패!");
  process.exit(1);
} else {
  console.log("\n전체 통과!");
}
