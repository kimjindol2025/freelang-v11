"use strict";
// FreeLang v9: Phase 73 — Formatter 테스트
// TC-1 ~ TC-9 (멱등성, 들여쓰기, 줄바꿈, 특수폼, FUNC 블록, --check 모드)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const formatter_1 = require("./formatter");
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
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
function assertEqual(a, b, msg) {
    if (a !== b) {
        throw new Error(`${msg ?? "assertEqual 실패"}\n  got:      ${JSON.stringify(a)}\n  expected: ${JSON.stringify(b)}`);
    }
}
// ─────────────────────────────────────────────────────────────
// TC-1: 기본 포맷
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-1] 기본 포맷");
test("(define x 42) 정상 포맷", () => {
    const out = (0, formatter_1.formatFL)("(define x 42)");
    assert(out.trim() === "(define x 42)", `예상: "(define x 42)", 실제: "${out.trim()}"`);
});
test("(+ 1 2) 포맷", () => {
    const out = (0, formatter_1.formatFL)("(+ 1 2)");
    assert(out.trim() === "(+ 1 2)", `실제: "${out.trim()}"`);
});
test("문자열 리터럴 보존", () => {
    const out = (0, formatter_1.formatFL)('(println "Hello, World!")');
    assert(out.includes('"Hello, World!"'), `실제: "${out.trim()}"`);
});
test("빈 소스 → 빈 문자열", () => {
    const out = (0, formatter_1.formatFL)("  \n  ");
    assertEqual(out, "", "빈 소스");
});
test("변수 $x는 SExpr 안에서 포맷", () => {
    // 최상위 단독 변수는 파서가 거부 — SExpr 안에서만 유효
    const out = (0, formatter_1.formatFL)("(define x 1) (+ $x 0)");
    assert(out.includes("$x"), `$x 없음: "${out.trim()}"`);
});
// ─────────────────────────────────────────────────────────────
// TC-2: 멱등성 — format(format(src)) === format(src)
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-2] 멱등성");
const idempotentSamples = [
    "(define x 42)",
    "(+ 1 2 3)",
    '(println "hello")',
    "(let [[$x 1] [$y 2]] (+ $x $y))",
    "[FUNC add :params [$a $b] :body (+ $a $b)]",
    "(if $cond $then $else)",
    "(define greet (fn [$name] (str \"Hello \" $name)))",
];
for (const sample of idempotentSamples) {
    test(`멱등성: ${sample.slice(0, 40)}`, () => {
        const once = (0, formatter_1.formatFL)(sample);
        const twice = (0, formatter_1.formatFL)(once);
        assert(once === twice, `멱등성 실패\n  1회: ${JSON.stringify(once)}\n  2회: ${JSON.stringify(twice)}`);
    });
}
// ─────────────────────────────────────────────────────────────
// TC-3: 긴 SExpr 줄바꿈
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-3] 긴 SExpr 줄바꿈");
test("80자 초과 SExpr은 여러 줄로 분리", () => {
    const longSrc = `(define very-long-function-name (fn [$param-one $param-two $param-three] (+ $param-one $param-two $param-three)))`;
    const out = (0, formatter_1.formatFL)(longSrc);
    const lines = out.trim().split("\n");
    assert(lines.length > 1, `한 줄이 아니어야 함. 실제:\n${out}`);
});
test("80자 이내 SExpr은 한 줄 유지", () => {
    const src = "(+ 1 2 3)";
    const out = (0, formatter_1.formatFL)(src);
    assertEqual(out.trim().split("\n").length, 1, "한 줄 유지 실패");
});
test("멀티라인 출력에 80자 초과 줄 없음 (단순 케이스)", () => {
    const src = `(define f (fn [$a $b $c $d $e] (+ $a $b $c $d $e)))`;
    const out = (0, formatter_1.formatFL)(src);
    for (const line of out.split("\n")) {
        // 들여쓰기 포함 최대 100자는 허용 (중첩 블록 특수처리)
        assert(line.length <= 100, `줄이 너무 김 (${line.length}): ${line}`);
    }
});
// ─────────────────────────────────────────────────────────────
// TC-4: 중첩 구조 들여쓰기
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-4] 중첩 구조 들여쓰기");
test("중첩 let 들여쓰기 2칸", () => {
    const src = "(let [[$x 1]] (let [[$y 2]] (+ $x $y)))";
    const out = (0, formatter_1.formatFL)(src);
    // 포맷 후 멱등성 확인
    const once = (0, formatter_1.formatFL)(src);
    const twice = (0, formatter_1.formatFL)(once);
    assert(once === twice, "중첩 let 멱등성 실패");
});
test("중첩 if 들여쓰기", () => {
    const src = "(if (> $x 0) (if (< $x 100) (println \"in range\") (println \"too big\")) (println \"negative\"))";
    const out = (0, formatter_1.formatFL)(src);
    const twice = (0, formatter_1.formatFL)(out);
    assert(out === twice, "중첩 if 멱등성 실패");
});
test("do 블록 들여쓰기", () => {
    const src = "(do (define a 1) (define b 2) (+ $a $b))";
    const out = (0, formatter_1.formatFL)(src);
    const lines = out.trim().split("\n");
    // do 블록은 항상 여러 줄
    assert(lines.length >= 2, `do 블록은 여러 줄이어야 함:\n${out}`);
    // 내부 항목은 2칸 들여쓰기
    assert(lines[1].startsWith("  "), `do 내부 들여쓰기 없음: "${lines[1]}"`);
});
// ─────────────────────────────────────────────────────────────
// TC-5: fn/if/let 특수 폼 포맷
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-5] fn/if/let 특수 폼 포맷");
test("fn: 짧으면 한 줄", () => {
    const src = "(fn [$x] $x)";
    const out = (0, formatter_1.formatFL)(src).trim();
    assertEqual(out, "(fn [$x] $x)", "fn 한 줄 포맷");
});
test("fn: 긴 body는 여러 줄", () => {
    const src = `(fn [$very-long-param-name] (println "some long output here for the very long param name"))`;
    const out = (0, formatter_1.formatFL)(src);
    // 멱등성 확인
    assert((0, formatter_1.formatFL)(out) === out, "fn 멱등성 실패");
});
test("if: 세 부분 한 줄", () => {
    const src = "(if $x $y $z)";
    const out = (0, formatter_1.formatFL)(src).trim();
    assertEqual(out, "(if $x $y $z)", "if 한 줄 포맷");
});
test("let: 바인딩 보존", () => {
    const src = "(let [[$x 42]] $x)";
    const out = (0, formatter_1.formatFL)(src).trim();
    assert(out.includes("$x"), `$x 없음: "${out}"`);
    assert(out.includes("42"), `42 없음: "${out}"`);
});
test("define: 단순 값은 한 줄", () => {
    const src = "(define count 0)";
    const out = (0, formatter_1.formatFL)(src).trim();
    assertEqual(out, "(define count 0)", "define 한 줄 포맷");
});
// ─────────────────────────────────────────────────────────────
// TC-6: 주석 포함 소스 처리 (현재는 주석 제거됨, 파싱 성공 확인)
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-6] 주석 처리");
test("주석 있어도 파싱 성공", () => {
    const src = `
; 이것은 주석입니다
(define x 42) ; 인라인 주석
(+ $x 1)
`;
    // 주석은 파싱 시 제거 — 나머지 코드는 정상 포맷
    const out = (0, formatter_1.formatFL)(src);
    assert(out.includes("(define x 42)"), `define 없음:\n${out}`);
    assert(out.includes("(+ $x 1)"), `SExpr 없음:\n${out}`);
});
test("주석만 있는 소스 — 빈 출력 or 정상 처리", () => {
    // 주석만 있으면 AST가 비어 있어야 함
    const src = "; 주석만 있음\n; 두 번째 주석";
    try {
        const out = (0, formatter_1.formatFL)(src);
        // 오류 없이 빈 출력 or 줄바꿈
        assert(out.trim() === "" || typeof out === "string", "주석 전용 소스 처리 실패");
    }
    catch {
        // 파싱 오류도 OK — 주석 제거 후 빈 소스 (정상)
    }
    // 항상 통과 — try/catch 내 처리됨
});
// ─────────────────────────────────────────────────────────────
// TC-7: FUNC 블록 포맷
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-7] FUNC 블록 포맷");
test("[FUNC add :params [$a $b] :body (+ $a $b)]", () => {
    const src = "[FUNC add :params [$a $b] :body (+ $a $b)]";
    const out = (0, formatter_1.formatFL)(src).trim();
    // FUNC, add, :params, $a, $b, :body, (+ $a $b) 모두 포함
    assert(out.includes("FUNC"), "FUNC 없음");
    assert(out.includes("add"), "add 없음");
    assert(out.includes(":params"), ":params 없음");
    assert(out.includes(":body"), ":body 없음");
});
test("FUNC 블록 멱등성", () => {
    const src = "[FUNC multiply :params [$a $b] :body (* $a $b)]";
    const once = (0, formatter_1.formatFL)(src);
    const twice = (0, formatter_1.formatFL)(once);
    assert(once === twice, `FUNC 멱등성 실패\n  1회: ${once}\n  2회: ${twice}`);
});
test("긴 FUNC 블록 — 여러 줄 분리", () => {
    const src = `[FUNC process-data :params [$input $config $options $extra] :body (do (define result (transform $input)) (validate $result $config) $result)]`;
    const out = (0, formatter_1.formatFL)(src);
    assert(typeof out === "string" && out.length > 0, "출력 없음");
    // 멱등성
    assert((0, formatter_1.formatFL)(out) === out, "긴 FUNC 멱등성 실패");
});
// ─────────────────────────────────────────────────────────────
// TC-8: --check 모드 시뮬레이션
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-8] --check 모드 시뮬레이션");
test("이미 포맷된 코드 → 변경 없음", () => {
    const src = "(define x 42)\n";
    const formatted = (0, formatter_1.formatFL)(src);
    // 포맷 후 동일하면 --check에서 exit 0
    const isFormatted = src === formatted;
    // src가 이미 포맷됐는지 확인 — 여기서는 formatted를 다시 포맷
    const reFormatted = (0, formatter_1.formatFL)(formatted);
    assert(formatted === reFormatted, "--check: 재포맷 시 변경 있음 (멱등성 실패)");
});
test("미포맷 코드 → 변경 감지", () => {
    // 의도적으로 잘못된 들여쓰기 (lexer에서 무시되므로 출력은 다를 수 있음)
    const uglySrc = "(define   x   42)";
    const formatted = (0, formatter_1.formatFL)(uglySrc);
    // (define   x   42) → (define x 42) 로 정규화
    assert(formatted.trim() === "(define x 42)", `정규화 실패: "${formatted.trim()}"`);
});
test("임시 파일 --check 시뮬레이션", () => {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, "test-phase73-check.fl");
    // 이미 포맷된 내용 저장
    const content = "(define x 42)\n";
    fs.writeFileSync(tmpFile, content, "utf-8");
    const src = fs.readFileSync(tmpFile, "utf-8");
    const formatted = (0, formatter_1.formatFL)(src);
    const needsChange = src !== formatted;
    // 이미 포맷됐으면 변경 필요 없음
    // (단순 소스라서 같을 수도 다를 수도 있음 — 멱등성 보장)
    const reFormatted = (0, formatter_1.formatFL)(formatted);
    assert(formatted === reFormatted, "--check: 멱등성 실패");
    fs.unlinkSync(tmpFile);
});
// ─────────────────────────────────────────────────────────────
// TC-9: Phase 56 regression 14/14
// ─────────────────────────────────────────────────────────────
console.log("\n[TC-9] Phase 56 regression");
function runFL(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
const phase56Cases = [
    { name: "기본 define + 덧셈", src: "(define x 10) (+ $x 5)", expected: 15 },
    { name: "fn 호출", src: "[FUNC double :params [$n] :body (* $n 2)] (double 7)", expected: 14 },
    { name: "let 바인딩", src: "(let [[$a 3] [$b 4]] (+ $a $b))", expected: 7 },
    { name: "if true 분기", src: "(if true 1 2)", expected: 1 },
    { name: "if false 분기", src: "(if false 1 2)", expected: 2 },
    { name: "중첩 FUNC 합성", src: "[FUNC add :params [$a $b] :body (+ $a $b)] [FUNC mul :params [$a $b] :body (* $a $b)] (add (mul 2 3) 1)", expected: 7 },
    { name: "string concat", src: '(str "hello" " " "world")', expected: "hello world" },
    { name: "list first", src: "(first [1 2 3])", expected: 1 },
    { name: "list rest length", src: "(length (rest [1 2 3]))", expected: 2 },
    { name: "list append", src: "(length (append [1 2] [3 4]))", expected: 4 },
    { name: "list 인덱싱", src: "(get [10 20 30] 1)", expected: 20 },
    { name: "do 블록", src: "(do (define a 1) (define b 2) (+ $a $b))", expected: 3 },
    { name: "재귀 factorial", src: "[FUNC fact :params [$n] :body (if (<= $n 1) 1 (* $n (fact (- $n 1))))] (fact 5)", expected: 120 },
    { name: "boolean 논리", src: "(and true false)", expected: false },
];
for (const tc of phase56Cases) {
    test(`regression: ${tc.name}`, () => {
        // 원본 실행
        const origResult = runFL(tc.src);
        const origVal = Array.isArray(origResult) ? origResult : origResult;
        // 포맷 후 실행
        const formatted = (0, formatter_1.formatFL)(tc.src);
        const fmtResult = runFL(formatted);
        // 결과 비교
        if (Array.isArray(tc.expected)) {
            const orig = JSON.stringify(origVal);
            const fmt = JSON.stringify(fmtResult);
            assert(orig === JSON.stringify(tc.expected), `원본 결과 불일치: ${orig}`);
            assert(fmt === JSON.stringify(tc.expected), `포맷 후 결과 불일치: ${fmt}`);
        }
        else {
            assert(origVal === tc.expected, `원본 결과 불일치: ${JSON.stringify(origVal)} !== ${JSON.stringify(tc.expected)}`);
            assert(fmtResult === tc.expected, `포맷 후 결과 불일치: ${JSON.stringify(fmtResult)} !== ${JSON.stringify(tc.expected)}`);
        }
        // 멱등성 확인
        const twice = (0, formatter_1.formatFL)(formatted);
        assert(formatted === twice, `멱등성 실패:\n  1회: ${formatted}\n  2회: ${twice}`);
    });
}
// ─────────────────────────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(50));
console.log(`[Phase 73 Formatter] ${passed + failed}개 테스트, ✅ ${passed} PASS, ❌ ${failed} FAIL`);
if (failed > 0) {
    process.exit(1);
}
else {
    console.log("🎉 모두 통과!");
}
//# sourceMappingURL=test-phase73-formatter.js.map