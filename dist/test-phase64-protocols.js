"use strict";
// FreeLang v9: Phase 64 — Protocol/Interface System 테스트
// defprotocol + impl 다형성 검증
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 200)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    const val = interp.context.lastValue;
    interp.destroy();
    return val;
}
function runInterp(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp; // caller는 destroy() 책임
}
function getVar(interp, name) {
    return interp.context.variables.get("$" + name)
        ?? interp.context.variables.get(name);
}
console.log("\n=== Phase 64: Protocol/Interface System ===\n");
// ─── TC-1: defprotocol 정의 확인 ─────────────────────────────────
console.log("TC-1: defprotocol 정의");
test("defprotocol 정의가 레지스트리에 등록됨", () => {
    const interp = runInterp(`
    (defprotocol Serializable
      [serialize [$self] :string]
      [deserialize [$data] :any])
  `);
    const proto = interp.context.protocols.getProtocol("Serializable");
    if (!proto)
        throw new Error("Protocol not found");
    if (proto.methods.length !== 2)
        throw new Error(`Expected 2 methods, got ${proto.methods.length}`);
    if (proto.methods[0].name !== "serialize")
        throw new Error(`Expected 'serialize', got '${proto.methods[0].name}'`);
    if (proto.methods[1].name !== "deserialize")
        throw new Error(`Expected 'deserialize', got '${proto.methods[1].name}'`);
    interp.destroy();
});
test("hasMethod 역인덱스 확인", () => {
    const interp = runInterp(`
    (defprotocol Printable
      [print-self [$self] :string])
  `);
    if (!interp.context.protocols.hasMethod("print-self"))
        throw new Error("hasMethod should return true for 'print-self'");
    if (interp.context.protocols.hasMethod("nonexistent"))
        throw new Error("hasMethod should return false for nonexistent method");
    interp.destroy();
});
// ─── TC-2: impl + 메서드 호출 ─────────────────────────────────────
console.log("\nTC-2: impl + 메서드 호출");
test("serialize Point → 문자열 반환", () => {
    const result = run(`
    (defprotocol Serializable
      [serialize [$self] :string]
      [deserialize [$data] :any])

    (define p {:x 1.0 :y 2.0 :__type "Point"})

    (impl Serializable Point
      [serialize [$self] (str "(" (get $self :x) "," (get $self :y) ")")]
      [deserialize [$data] {:x 0.0 :y 0.0 :__type "Point"}])

    (serialize p)
  `);
    if (result !== "(1,2)")
        throw new Error(`Expected "(1,2)", got "${result}"`);
});
test("deserialize Point → 기본값 객체 반환", () => {
    const interp = runInterp(`
    (defprotocol Serializable
      [serialize [$self] :string]
      [deserialize [$data] :any])

    (define p {:x 5.0 :y 3.0 :__type "Point"})

    (impl Serializable Point
      [serialize [$self] (str "(" (get $self :x) "," (get $self :y) ")")]
      [deserialize [$data] {:x 0.0 :y 0.0 :__type "Point"}])

    (define result (deserialize p))
  `);
    const result = getVar(interp, "result");
    if (typeof result !== "object" || result === null)
        throw new Error(`Expected object, got ${typeof result}`);
    if (result.__type !== "Point")
        throw new Error(`Expected __type "Point", got "${result.__type}"`);
    if (result.x !== 0.0)
        throw new Error(`Expected x=0.0, got ${result.x}`);
    interp.destroy();
});
test("여러 인자를 받는 메서드 호출", () => {
    const result = run(`
    (defprotocol Transformer
      [transform [$self $factor] :any])

    (define v {:val 10 :__type "Box"})

    (impl Transformer Box
      [transform [$self $factor] (* (get $self :val) $factor)])

    (transform v 3)
  `);
    if (result !== 30)
        throw new Error(`Expected 30, got ${result}`);
});
// ─── TC-3: 다형성 — 여러 타입에 같은 프로토콜 ─────────────────────
console.log("\nTC-3: 다형성 — 여러 타입에 같은 프로토콜");
test("Point와 Circle 모두 Serializable 구현", () => {
    const interp = runInterp(`
    (defprotocol Serializable
      [serialize [$self] :string])

    (impl Serializable Point
      [serialize [$self] (str "Point(" (get $self :x) "," (get $self :y) ")")])

    (impl Serializable Circle
      [serialize [$self] (str "Circle(r=" (get $self :r) ")")])

    (define p {:x 1.0 :y 2.0 :__type "Point"})
    (define c {:r 5.0 :__type "Circle"})

    (define result-p (serialize p))
    (define result-c (serialize c))
  `);
    const rp = getVar(interp, "result-p");
    const rc = getVar(interp, "result-c");
    if (rp !== "Point(1,2)")
        throw new Error(`Point serialize: expected "Point(1,2)", got "${rp}"`);
    if (rc !== "Circle(r=5)")
        throw new Error(`Circle serialize: expected "Circle(r=5)", got "${rc}"`);
    interp.destroy();
});
test("dispatch은 __type 기반으로 올바른 구현 선택", () => {
    const interp = runInterp(`
    (defprotocol Describable
      [describe [$self] :string])

    (impl Describable Dog
      [describe [$self] (str "Dog named " (get $self :name))])

    (impl Describable Cat
      [describe [$self] (str "Cat named " (get $self :name))])

    (define d1 {:name "Buddy" :__type "Dog"})
    (define d2 {:name "Whiskers" :__type "Cat"})

    (define desc1 (describe d1))
    (define desc2 (describe d2))
  `);
    const d1 = getVar(interp, "desc1");
    const d2 = getVar(interp, "desc2");
    if (d1 !== "Dog named Buddy")
        throw new Error(`Dog: expected "Dog named Buddy", got "${d1}"`);
    if (d2 !== "Cat named Whiskers")
        throw new Error(`Cat: expected "Cat named Whiskers", got "${d2}"`);
    interp.destroy();
});
// ─── TC-4: 미구현 타입 호출 → 에러 ───────────────────────────────
console.log("\nTC-4: 미구현 타입 호출 에러");
test("__type이 없는 객체 → 에러", () => {
    let threw = false;
    try {
        run(`
      (defprotocol Serializable
        [serialize [$self] :string])
      (impl Serializable Point
        [serialize [$self] (str "Point")])
      (define notapoint {:x 1.0})
      (serialize notapoint)
    `);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error("Expected error for type without __type");
});
test("__type이 구현 없는 타입 → 에러", () => {
    let threw = false;
    try {
        run(`
      (defprotocol Serializable
        [serialize [$self] :string])
      (impl Serializable Point
        [serialize [$self] (str "Point")])
      (define unknown {:x 1.0 :__type "UnknownType"})
      (serialize unknown)
    `);
    }
    catch {
        threw = true;
    }
    if (!threw)
        throw new Error("Expected error for unimplemented type");
});
// ─── TC-5: 여러 메서드 프로토콜 ────────────────────────────────────
console.log("\nTC-5: 여러 메서드 프로토콜");
test("3-메서드 프로토콜 구현 및 호출", () => {
    const interp = runInterp(`
    (defprotocol Shape
      [area [$self] :float]
      [perimeter [$self] :float]
      [label [$self] :string])

    (impl Shape Rectangle
      [area [$self] (* (get $self :w) (get $self :h))]
      [perimeter [$self] (* 2 (+ (get $self :w) (get $self :h)))]
      [label [$self] "Rectangle"])

    (define rect {:w 4.0 :h 3.0 :__type "Rectangle"})
    (define a (area rect))
    (define p (perimeter rect))
    (define l (label rect))
  `);
    const a = getVar(interp, "a");
    const p = getVar(interp, "p");
    const l = getVar(interp, "l");
    if (a !== 12)
        throw new Error(`area: expected 12, got ${a}`);
    if (p !== 14)
        throw new Error(`perimeter: expected 14, got ${p}`);
    if (l !== "Rectangle")
        throw new Error(`label: expected "Rectangle", got "${l}"`);
    interp.destroy();
});
test("같은 프로토콜을 여러 Shape 타입에 적용", () => {
    const interp = runInterp(`
    (defprotocol Shape
      [area [$self] :float])

    (impl Shape Rect
      [area [$self] (* (get $self :w) (get $self :h))])

    (impl Shape Circ
      [area [$self] (* 3.14 (get $self :r) (get $self :r))])

    (define r {:w 4.0 :h 5.0 :__type "Rect"})
    (define c {:r 2.0 :__type "Circ"})
    (define ar (area r))
    (define ac (area c))
  `);
    const ar = getVar(interp, "ar");
    const ac = getVar(interp, "ac");
    if (ar !== 20)
        throw new Error(`Rect area: expected 20, got ${ar}`);
    // 3.14 * 4 = 12.56
    if (Math.abs(ac - 12.56) > 0.01)
        throw new Error(`Circ area: expected ~12.56, got ${ac}`);
    interp.destroy();
});
// ─── TC-6: defstruct + impl 통합 ──────────────────────────────────
console.log("\nTC-6: defstruct + impl 통합");
test("defstruct Point + impl Serializable + serialize 호출", () => {
    const result = run(`
    (defprotocol Serializable
      [serialize [$self] :string])

    (defstruct Point [:x :float :y :float])

    (impl Serializable Point
      [serialize [$self] (str "(" (get $self :x) "," (get $self :y) ")")])

    (define p (Point 1.0 2.0))
    (serialize p)
  `);
    if (result !== "(1,2)")
        throw new Error(`Expected "(1,2)", got "${result}"`);
});
test("defstruct 생성자 __type 자동 태깅", () => {
    const interp = runInterp(`
    (defstruct Vector3 [:x :float :y :float :z :float])
    (define v (Vector3 1.0 2.0 3.0))
  `);
    const v = getVar(interp, "v");
    if (!v || v.__type !== "Vector3")
        throw new Error(`Expected __type "Vector3", got "${v?.__type}"`);
    if (v.x !== 1.0)
        throw new Error(`Expected x=1.0, got ${v.x}`);
    if (v.z !== 3.0)
        throw new Error(`Expected z=3.0, got ${v.z}`);
    interp.destroy();
});
test("defstruct 술어 함수 작동", () => {
    const interp = runInterp(`
    (defstruct Circle [:r :float])
    (define c (Circle 5.0))
    (define $is-circle (Circle? c))
    (define $is-not (Circle? {:x 1.0}))
  `);
    const ic = getVar(interp, "is-circle");
    const in_ = getVar(interp, "is-not");
    if (ic !== true)
        throw new Error(`Circle? should return true, got ${ic}`);
    if (in_ !== false)
        throw new Error(`Circle? should return false for non-Circle, got ${in_}`);
    interp.destroy();
});
test("defstruct + 다형성 2개 타입", () => {
    const interp = runInterp(`
    (defprotocol Named
      [get-name [$self] :string])

    (defstruct Person [:name :string :age :int])
    (defstruct Company [:name :string :employees :int])

    (impl Named Person
      [get-name [$self] (get $self :name)])

    (impl Named Company
      [get-name [$self] (str (get $self :name) " Corp")])

    (define alice (Person "Alice" 30))
    (define acme (Company "ACME" 100))

    (define name1 (get-name alice))
    (define name2 (get-name acme))
  `);
    const n1 = getVar(interp, "name1");
    const n2 = getVar(interp, "name2");
    if (n1 !== "Alice")
        throw new Error(`Person name: expected "Alice", got "${n1}"`);
    if (n2 !== "ACME Corp")
        throw new Error(`Company name: expected "ACME Corp", got "${n2}"`);
    interp.destroy();
});
// ─── TC-7: Phase 56 regression (14 tests) ──────────────────────
console.log("\nTC-7: Phase 56 regression");
test("기본 산술", () => {
    const r = run(`(+ (* 3 4) (- 10 5))`);
    if (r !== 17)
        throw new Error(`Expected 17, got ${r}`);
});
test("if 분기 — true", () => {
    const r = run(`(if true 42 0)`);
    if (r !== 42)
        throw new Error(`Expected 42, got ${r}`);
});
test("if 분기 — false", () => {
    const r = run(`(if false 0 99)`);
    if (r !== 99)
        throw new Error(`Expected 99, got ${r}`);
});
test("let 스코프 격리", () => {
    const r = run(`(let [[$x 5] [$y 10]] (+ $x $y))`);
    if (r !== 15)
        throw new Error(`Expected 15, got ${r}`);
});
test("set! 변수 변경", () => {
    const interp = runInterp(`
    (define $counter 0)
    (set! $counter (+ $counter 1))
    (set! $counter (+ $counter 1))
  `);
    const v = interp.context.variables.get("$counter");
    if (v !== 2)
        throw new Error(`Expected 2, got ${v}`);
    interp.destroy();
});
test("재귀 팩토리얼 (FUNC 방식)", () => {
    const result = run(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 5)
  `);
    if (result !== 120)
        throw new Error(`Expected 120, got ${result}`);
});
test("클로저 캡처", () => {
    const result = run(`
    (define $x 10)
    (define adder (fn [$n] (+ $x $n)))
    (adder 5)
  `);
    if (result !== 15)
        throw new Error(`Expected 15, got ${result}`);
});
test("고차 함수 반환", () => {
    const result = run(`
    [FUNC make-adder :params [$base]
      :body (fn [$n] (+ $base $n))]
    (define add5 (make-adder 5))
    (call add5 3)
  `);
    if (result !== 8)
        throw new Error(`Expected 8, got ${result}`);
});
test("do 블록 순차 실행", () => {
    const r = run(`(do (define $a 1) (define $b 2) (+ $a $b))`);
    if (r !== 3)
        throw new Error(`Expected 3, got ${r}`);
});
test("and/or 단락 평가", () => {
    const r1 = run(`(and true true)`);
    const r2 = run(`(and true false)`);
    const r3 = run(`(or false true)`);
    if (r1 !== true)
        throw new Error(`and true true: expected true, got ${r1}`);
    if (r2 !== false)
        throw new Error(`and true false: expected false, got ${r2}`);
    if (r3 !== true)
        throw new Error(`or false true: expected true, got ${r3}`);
});
test("cond 다분기", () => {
    const r = run(`
    (define $x 5)
    (cond
      [(< $x 0) "negative"]
      [(= $x 0) "zero"]
      [(> $x 0) "positive"])
  `);
    if (r !== "positive")
        throw new Error(`Expected "positive", got "${r}"`);
});
test("string 연산", () => {
    const r = run(`(str "hello" " " "world")`);
    if (r !== "hello world")
        throw new Error(`Expected "hello world", got "${r}"`);
});
test("맵 리터럴 + get", () => {
    const r = run(`(get {:name "Alice" :age 30} :name)`);
    if (r !== "Alice")
        throw new Error(`Expected "Alice", got "${r}"`);
});
test("배열 리터럴 + first", () => {
    const r = run(`(first [10 20 30])`);
    if (r !== 10)
        throw new Error(`Expected 10, got ${r}`);
});
// 결과 출력
console.log(`\n${"─".repeat(50)}`);
console.log(`결과: ${passed} passed, ${failed} failed`);
if (failed === 0) {
    console.log(`✅ Phase 64 프로토콜/인터페이스 — 전체 PASS`);
}
else {
    console.log(`❌ ${failed}개 실패`);
    process.exit(1);
}
//# sourceMappingURL=test-phase64-protocols.js.map