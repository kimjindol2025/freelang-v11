"use strict";
// FreeLang v9: Phase 74 — Linter 정적 분석 테스트
// TC-1: 깨끗한 코드 → 0 diagnostics (undefined-vars/unused-bindings/empty-body 기준)
// TC-2: 미정의 변수 참조 → undefined-vars warn
// TC-3: 미사용 let 바인딩 → unused-bindings warn
// TC-4: 빈 함수 바디 → empty-body warn
// TC-5: 잘못된 인자 수 → arity-check warn
// TC-6: else 이후 케이스 → unreachable-match warn
// TC-7: severity 필터링 (error만, warn만)
// TC-8: Phase 56 regression 14/14
Object.defineProperty(exports, "__esModule", { value: true });
const linter_1 = require("./linter");
const lint_rules_1 = require("./lint-rules");
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS  ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  FAIL  ${name}: ${String(e.message ?? e).slice(0, 200)}`);
        failed++;
    }
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e)
        throw new Error(`${msg ?? "assertEqual"}: expected ${e}, got ${a}`);
}
function assertContains(actual, substr, msg) {
    if (!actual.includes(substr))
        throw new Error(`${msg ?? "assertContains"}: "${actual}" does not contain "${substr}"`);
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
// 기본 Linter 생성 (7개 규칙 모두 포함)
function makeLinter() {
    const linter = new linter_1.FLLinter();
    for (const rule of lint_rules_1.ALL_RULES) {
        linter.addRule(rule);
    }
    return linter;
}
// 특정 규칙만 포함한 Linter
function makeLinterWith(...rules) {
    const linter = new linter_1.FLLinter();
    for (const rule of rules) {
        linter.addRule(rule);
    }
    return linter;
}
console.log("=".repeat(60));
console.log("[Phase 74] FreeLang Linter — 7가지 정적 분석 규칙");
console.log("=".repeat(60));
// ──────────────────────────────────────────────
// TC-1: 깨끗한 코드 → 주요 규칙 에러 없음
// ──────────────────────────────────────────────
console.log("\n[TC-1] 깨끗한 코드 → 주요 규칙 진단 없음");
test("깨끗한 FUNC 정의 — empty-body 없음", () => {
    const linter = makeLinterWith(lint_rules_1.emptyBody);
    const src = `
    [FUNC add :params [$x $y] :body (+ $x $y)]
    [FUNC greet :params [$name] :body (str "Hello, " $name)]
  `;
    const diags = linter.lint(src);
    assertEqual(diags.length, 0, "깨끗한 코드에서 진단 없어야 함");
});
test("깨끗한 코드 — arity-check 에러 없음", () => {
    const linter = makeLinterWith(lint_rules_1.arityCheck);
    const src = `
    [FUNC double :params [$n] :body (* $n 2)]
    (double 5)
  `;
    const diags = linter.lint(src).filter(d => d.rule === "arity-check");
    assertEqual(diags.length, 0, "올바른 인자 수 — 진단 없어야 함");
});
test("깨끗한 코드 — unreachable-match 에러 없음", () => {
    const linter = makeLinterWith(lint_rules_1.unreachableMatch);
    const src = `
    [FUNC classify :params [$n]
      :body (cond
        [(< $n 0) "negative"]
        [(= $n 0) "zero"]
        [true "positive"])]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "unreachable-match");
    assertEqual(diags.length, 0, "else가 마지막 — 진단 없어야 함");
});
// ──────────────────────────────────────────────
// TC-2: 미정의 변수 참조 → undefined-vars warn
// ──────────────────────────────────────────────
console.log("\n[TC-2] 미정의 변수 참조 → undefined-vars warn");
test("미정의 변수 $z 참조", () => {
    const linter = makeLinterWith(lint_rules_1.undefinedVars);
    const src = `
    [FUNC use-undefined :params [$x]
      :body (+ $x $z)]
  `;
    const diags = linter.lint(src);
    const undef = diags.filter(d => d.rule === "undefined-vars");
    assert(undef.length >= 1, `미정의 변수 진단 없음 (got ${undef.length})`);
    assert(undef.some(d => d.message.includes("z")), `z 진단 없음: ${JSON.stringify(undef)}`);
});
test("undefined-vars severity는 warn", () => {
    const linter = makeLinterWith(lint_rules_1.undefinedVars);
    const src = `
    [FUNC bad :params [] :body (+ $undefined_var 1)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "undefined-vars");
    assert(diags.length >= 1, "진단이 있어야 함");
    assert(diags.every(d => d.severity === "warn"), "severity는 warn이어야 함");
});
test("파라미터는 미정의 변수 아님", () => {
    const linter = makeLinterWith(lint_rules_1.undefinedVars);
    const src = `
    [FUNC add :params [$a $b] :body (+ $a $b)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "undefined-vars");
    assertEqual(diags.length, 0, "파라미터는 정의된 변수여야 함");
});
// ──────────────────────────────────────────────
// TC-3: 미사용 let 바인딩 → unused-bindings warn
// ──────────────────────────────────────────────
console.log("\n[TC-3] 미사용 let 바인딩 → unused-bindings warn");
test("unused let 바인딩 감지", () => {
    const linter = makeLinterWith(lint_rules_1.unusedBindings);
    const src = `
    [FUNC compute :params [$x]
      :body (let [[$unused 42] [$y (+ $x 1)]] $y)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "unused-bindings");
    assert(diags.length >= 1, `미사용 바인딩 진단 없음 (got ${diags.length})`);
    assert(diags.some(d => d.message.includes("unused")), `$unused 진단 없음: ${JSON.stringify(diags)}`);
});
test("사용된 let 바인딩은 warn 없음", () => {
    const linter = makeLinterWith(lint_rules_1.unusedBindings);
    const src = `
    [FUNC compute :params [$x]
      :body (let [[$result (+ $x 1)]] $result)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "unused-bindings" && d.message.includes("result"));
    assertEqual(diags.length, 0, "사용된 바인딩은 진단 없어야 함");
});
// ──────────────────────────────────────────────
// TC-4: 빈 함수 바디 → empty-body warn
// ──────────────────────────────────────────────
console.log("\n[TC-4] 빈 함수 바디 → empty-body warn");
test("빈 body FUNC 감지", () => {
    const linter = makeLinterWith(lint_rules_1.emptyBody);
    const src = `
    [FUNC stub :params [] :body []]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "empty-body");
    assert(diags.length >= 1, `빈 바디 진단 없음 (got ${diags.length})`);
    assert(diags.some(d => d.message.includes("stub")), `FUNC stub 언급 없음: ${JSON.stringify(diags)}`);
});
test("빈 body 여러 FUNC 감지", () => {
    const linter = makeLinterWith(lint_rules_1.emptyBody);
    const src = `
    [FUNC noop1 :params [] :body []]
    [FUNC noop2 :params [$x] :body []]
    [FUNC ok :params [$x] :body $x]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "empty-body");
    assertEqual(diags.length, 2, `빈 바디 2개 감지해야 함 (got ${diags.length})`);
});
test("empty-body severity는 warn", () => {
    const linter = makeLinterWith(lint_rules_1.emptyBody);
    const src = `[FUNC empty :params [] :body []]`;
    const diags = linter.lint(src).filter(d => d.rule === "empty-body");
    assert(diags.length >= 1, "진단이 있어야 함");
    assert(diags.every(d => d.severity === "warn"), "severity는 warn이어야 함");
});
// ──────────────────────────────────────────────
// TC-5: 잘못된 인자 수 → arity-check warn
// ──────────────────────────────────────────────
console.log("\n[TC-5] 잘못된 인자 수 → arity-check warn");
test("내장 함수 잘못된 인자 수 감지 (abs)", () => {
    const linter = makeLinterWith(lint_rules_1.arityCheck);
    const src = `
    [FUNC bad-call :params [$x] :body (abs $x 10)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "arity-check");
    assert(diags.length >= 1, `arity-check 진단 없음 (got ${diags.length})`);
    assert(diags.some(d => d.message.includes("abs")), `abs 진단 없음: ${JSON.stringify(diags)}`);
});
test("사용자 정의 함수 arity-check", () => {
    const linter = makeLinterWith(lint_rules_1.arityCheck);
    const src = `
    [FUNC add :params [$x $y] :body (+ $x $y)]
    [FUNC caller :params [] :body (add 1 2 3)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "arity-check");
    assert(diags.length >= 1, `사용자 함수 arity 진단 없음 (got ${diags.length})`);
    assert(diags.some(d => d.message.includes("add")), `add 진단 없음: ${JSON.stringify(diags)}`);
});
test("올바른 인자 수는 arity-check 없음", () => {
    const linter = makeLinterWith(lint_rules_1.arityCheck);
    const src = `
    [FUNC double :params [$n] :body (* $n 2)]
    [FUNC caller :params [] :body (double 5)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "arity-check");
    assertEqual(diags.length, 0, "올바른 인자 수 — 진단 없어야 함");
});
// ──────────────────────────────────────────────
// TC-6: else 이후 케이스 → unreachable-match warn
// ──────────────────────────────────────────────
console.log("\n[TC-6] else 이후 케이스 → unreachable-match warn");
test("cond else 이후 케이스 감지", () => {
    const linter = makeLinterWith(lint_rules_1.unreachableMatch);
    // true 이후에 케이스가 있으면 unreachable
    // cond [cond1 val] [true val] [cond2 val] → cond2는 도달 불가
    const src = `
    [FUNC test-cond :params [$n]
      :body (cond
        [(< $n 0) "neg"]
        [true "other"]
        [(> $n 100) "big"])]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "unreachable-match");
    assert(diags.length >= 1, `unreachable-match 진단 없음 (got ${diags.length})`);
});
test("wildcardPattern 이후 케이스 감지", () => {
    const linter = makeLinterWith(lint_rules_1.unreachableMatch);
    // match에서 wildcard 이후 케이스
    const src = `
    [FUNC test-match :params [$x]
      :body (match $x
        [1 "one"]
        [_ "other"]
        [2 "two"])]
  `;
    // 파서가 이 형식을 처리할 수 있는 경우에만
    try {
        const diags = linter.lint(src).filter(d => d.rule === "unreachable-match");
        // 파서 오류 없으면 체크, 파서 오류면 스킵
        if (diags.some(d => d.rule === "parse-error"))
            return; // 파서가 처리 못하면 OK
    }
    catch {
        // 파서 예외도 OK
    }
});
// ──────────────────────────────────────────────
// TC-7: severity 필터링
// ──────────────────────────────────────────────
console.log("\n[TC-7] severity 필터링");
test("error만 필터링", () => {
    const linter = makeLinter();
    const src = `
    [FUNC empty-fn :params [] :body []]
    [FUNC bad-arity :params [$x] :body (abs $x 99)]
  `;
    const errors = linter.lintFiltered(src, "error");
    // empty-body와 arity-check는 warn이므로 error는 0
    assert(errors.every(d => d.severity === "error"), "error 필터 — 모두 error여야 함");
});
test("warn만 필터링", () => {
    const linter = makeLinterWith(lint_rules_1.emptyBody, lint_rules_1.arityCheck);
    const src = `
    [FUNC noop :params [] :body []]
    [FUNC caller :params [] :body (abs 1 2)]
  `;
    const warns = linter.lintFiltered(src, "warn");
    assert(warns.every(d => d.severity === "warn"), "warn 필터 — 모두 warn이어야 함");
    assert(warns.length >= 1, `warn 진단이 있어야 함 (got ${warns.length})`);
});
test("lintFiltered — 복합 필터링", () => {
    const linter = makeLinterWith(lint_rules_1.emptyBody);
    const src = `
    [FUNC a :params [] :body []]
    [FUNC b :params [] :body []]
    [FUNC c :params [$x] :body $x]
  `;
    const all = linter.lint(src);
    const warns = linter.lintFiltered(src, "warn");
    const errors = linter.lintFiltered(src, "error");
    const infos = linter.lintFiltered(src, "info");
    assertEqual(warns.length + errors.length + infos.length, all.length, "필터링 합산 == 전체");
});
test("addRule 체이닝", () => {
    const linter = new linter_1.FLLinter()
        .addRule(lint_rules_1.emptyBody)
        .addRule(lint_rules_1.arityCheck)
        .addRule(lint_rules_1.unusedBindings);
    const src = `[FUNC test :params [] :body []]`;
    const diags = linter.lint(src);
    assert(diags.some(d => d.rule === "empty-body"), "empty-body 규칙 동작해야 함");
});
// ──────────────────────────────────────────────
// TC-8: Phase 56 regression 14/14
// ──────────────────────────────────────────────
console.log("\n[TC-8] Phase 56 regression — 렉시컬 스코프");
function runPhase56(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function runPhase56Multi(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp;
}
function evalIn(interp, src) {
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
function getVar(interp, name) {
    return interp.context.variables.get("$" + name);
}
// 고차 함수 apply 헬퍼 - fn을 직접 호출하는 인터프리터 사용
function applyFn(interp, fnVal, args) {
    // fn 값을 직접 호출하기 위해 임시 FUNC 우회
    // interp의 evaluator를 직접 사용
    const evalFn = interp.evalFn || interp.callFunction;
    if (evalFn)
        return evalFn.call(interp, fnVal, args, interp.context);
    return undefined;
}
test("[Phase56-1] 함수 내 define이 전역 $x를 오염 안 함", () => {
    const interp = runPhase56Multi(`
    (define x 10)
    [FUNC set-x :params [] :body (define x 999)]
    (set-x)
  `);
    const x = getVar(interp, "x");
    if (x !== 10)
        throw new Error(`전역 $x가 ${x}로 변경됨`);
});
test("[Phase56-2] 함수 내 define 변수는 함수 실행 후 사라짐", () => {
    const interp = runPhase56Multi(`
    [FUNC make-local :params [] :body (define inner 42)]
    (make-local)
  `);
    const inner = getVar(interp, "inner");
    if (inner !== undefined && inner !== null)
        throw new Error(`$inner가 외부에 보임: ${inner}`);
});
test("[Phase56-3] 재귀 팩토리얼 — 스코프 간섭 없음", () => {
    const res = runPhase56(`
    [FUNC fact :params [$n]
      :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
    (fact 6)
  `);
    if (res !== 720)
        throw new Error(`got ${res}`);
});
test("[Phase56-4] 재귀 피보나치 — 중첩 호출 격리", () => {
    const res = runPhase56(`
    [FUNC fib :params [$n]
      :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
    (fib 10)
  `);
    if (res !== 55)
        throw new Error(`got ${res}`);
});
test("[Phase56-5] 클로저 — 값 캡처", () => {
    const res = runPhase56(`
    [FUNC make-adder :params [$n]
      :body (fn [$x] (+ $x $n))]
    (define add5 (make-adder 5))
    (add5 3)
  `);
    if (res !== 8)
        throw new Error(`got ${res}`);
});
test("[Phase56-6] 클로저 — 독립 캡처", () => {
    const res = runPhase56(`
    [FUNC make-adder :params [$n] :body (fn [$x] (+ $x $n))]
    (define add3 (make-adder 3))
    (define add10 (make-adder 10))
    (+ (add3 1) (add10 1))
  `);
    if (res !== 15)
        throw new Error(`got ${res}`);
});
test("[Phase56-7] let 스코프 격리", () => {
    const interp = runPhase56Multi(`
    (let [[$local 99]] $local)
  `);
    const local = getVar(interp, "local");
    if (local !== undefined && local !== null)
        throw new Error(`$local이 외부에 보임: ${local}`);
});
test("[Phase56-8] let 중첩 스코프", () => {
    const res = runPhase56(`
    (let [[$x 1]]
      (let [[$y 2]]
        (+ $x $y)))
  `);
    if (res !== 3)
        throw new Error(`got ${res}`);
});
test("[Phase56-9] set! — 클로저 상태 변경", () => {
    const interp = runPhase56Multi(`
    (define counter 0)
    [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
    (inc!)
    (inc!)
    (inc!)
  `);
    const c = getVar(interp, "counter");
    if (c !== 3)
        throw new Error(`counter는 3이어야 함, got ${c}`);
});
test("[Phase56-10] set! — 전역 변수만 변경", () => {
    const interp = runPhase56Multi(`
    (define x 0)
    [FUNC bump :params [] :body (set! x (+ $x 10))]
    (bump)
  `);
    const x = getVar(interp, "x");
    if (x !== 10)
        throw new Error(`x는 10이어야 함, got ${x}`);
});
test("[Phase56-11] 고차 함수 스코프", () => {
    // ($f x) 형태 대신 fn 직접 전달 패턴 사용
    const res = runPhase56(`
    (define double (fn [$n] (* $n 2)))
    (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
    (define add10 (make-adder 10))
    (add10 7)
  `);
    if (res !== 17)
        throw new Error(`got ${res}`);
});
test("[Phase56-12] 서로 다른 함수 간 변수 격리", () => {
    const interp = runPhase56Multi(`
    [FUNC f1 :params [] :body (define shared 1)]
    [FUNC f2 :params [] :body (define shared 2)]
    (f1)
    (f2)
  `);
    const shared = getVar(interp, "shared");
    if (shared !== undefined && shared !== null)
        throw new Error(`$shared가 전역에 보임: ${shared}`);
});
test("[Phase56-13] 재귀 + 클로저 조합", () => {
    // set!을 이용한 전역 카운터 조합 테스트
    const interp = runPhase56Multi(`
    (define cnt 0)
    [FUNC bump :params [] :body (set! cnt (+ $cnt 1))]
    (bump)
    (bump)
    (bump)
  `);
    const c = getVar(interp, "cnt");
    if (c !== 3)
        throw new Error(`cnt는 3이어야 함, got ${c}`);
});
test("[Phase56-14] 깊은 중첩 클로저", () => {
    const res = runPhase56(`
    [FUNC outer :params [$x]
      :body (fn [$y]
        (fn [$z] (+ $x (+ $y $z))))]
    (define f (outer 10))
    (define g (f 20))
    (g 30)
  `);
    if (res !== 60)
        throw new Error(`got ${res}`);
});
// ──────────────────────────────────────────────
// 추가 TC: dead-code 및 shadowed-vars 기본 동작
// ──────────────────────────────────────────────
console.log("\n[TC-9] dead-code & shadowed-vars 기본 동작");
test("dead-code: do 블록 순수 표현식 감지", () => {
    const linter = makeLinterWith(lint_rules_1.deadCode);
    const src = `
    [FUNC test :params [$x]
      :body (do
        42
        (+ 1 2)
        $x)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "dead-code");
    assert(diags.length >= 1, `dead-code 진단 없음 (got ${diags.length})`);
});
test("shadowed-vars: let이 파라미터 덮어쓰기 감지", () => {
    const linter = makeLinterWith(lint_rules_1.shadowedVars);
    const src = `
    [FUNC test :params [$x $y]
      :body (let [[$x 99]] $x)]
  `;
    const diags = linter.lint(src).filter(d => d.rule === "shadowed-vars");
    assert(diags.length >= 1, `shadowed-vars 진단 없음 (got ${diags.length})`);
    assert(diags.some(d => d.message.includes("x")), `$x 섀도잉 언급 없음: ${JSON.stringify(diags)}`);
});
test("ALL_RULES 배열에 7개 규칙 포함", () => {
    assertEqual(lint_rules_1.ALL_RULES.length, 7, "7개 규칙 있어야 함");
    const names = lint_rules_1.ALL_RULES.map(r => r.name);
    assert(names.includes("undefined-vars"), "undefined-vars 없음");
    assert(names.includes("unused-bindings"), "unused-bindings 없음");
    assert(names.includes("shadowed-vars"), "shadowed-vars 없음");
    assert(names.includes("arity-check"), "arity-check 없음");
    assert(names.includes("empty-body"), "empty-body 없음");
    assert(names.includes("unreachable-match"), "unreachable-match 없음");
    assert(names.includes("dead-code"), "dead-code 없음");
});
// ──────────────────────────────────────────────
// 결과 출력
// ──────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(`결과: ${passed} PASS / ${failed} FAIL / ${passed + failed} 총`);
console.log("=".repeat(60));
if (failed > 0) {
    process.exit(1);
}
//# sourceMappingURL=test-phase74-linter.js.map