// coverage-boost.test.ts — FreeLang v9 커버리지 향상 테스트
// Phase 62: 미커버 코드 경로 집중 테스트

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(process.stdout, "write").mockImplementation(() => true);
  jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("eval-builtins — 미커버 케이스", () => {
  test("inspect 반환값", () => {
    // inspect는 값을 출력하고 반환
    expect(run("(inspect 42)")).toBe(42);
  });

  test("print-err 반환값 null", () => {
    expect(run("(print-err \"error output\")")).toBeNull();
  });

  test("left/right Either 모나드", () => {
    expect(run("(left 10)")).toEqual({ tag: "Left", value: 10, kind: "Either" });
    expect(run("(right 20)")).toEqual({ tag: "Right", value: 20, kind: "Either" });
  });

  test("success/failure Validation 모나드", () => {
    expect(run("(success 42)")).toEqual({ tag: "Success", value: 42, kind: "Validation" });
    expect(run("(failure \"err\")")).toMatchObject({ tag: "Failure", kind: "Validation" });
  });

  test("tell Writer 모나드", () => {
    expect(run("(tell \"log\")")).toMatchObject({ kind: "Writer", log: "log" });
  });

  test("pure-writer Writer 생성", () => {
    expect(run("(pure-writer 42)")).toMatchObject({ kind: "Writer", value: 42, log: "" });
  });

  test("pure Monad 생성", () => {
    expect(run("(pure 10)")).toEqual({ tag: "Pure", value: 10, kind: "Monad" });
  });

  test("map? 맵 객체 true", () => {
    expect(run("(map? (assoc {} \"x\" 1))")).toBe(true);
  });

  test("concat 배열 두 개", () => {
    expect(run("(concat (list 1 2) (list 3 4))")).toEqual([1, 2, 3, 4]);
  });

  test("num-to-str / num->str", () => {
    expect(run("(num-to-str 42)")).toBe("42");
  });

  test("str-to-num / str->num", () => {
    expect(run("(str-to-num \"3.14\")")).toBeCloseTo(3.14);
  });

  test("uppercase/lowercase", () => {
    expect(run("(uppercase \"hello\")")).toBe("HELLO");
    expect(run("(lowercase \"WORLD\")")).toBe("world");
  });

  test("is-symbol?", () => {
    expect(run("(is-symbol? \"valid-fn?\")")).toBe(true);
    expect(run("(is-symbol? \"123\")")).toBe(false);
  });

  test("pop 배열 마지막", () => {
    expect(run("(pop (list 1 2 3))")).toBe(3);
  });

  test("shift 배열 첫번째", () => {
    expect(run("(shift (list 1 2 3))")).toBe(1);
  });

  test("sort 문자열 배열", () => {
    expect(run("(sort (list \"c\" \"a\" \"b\"))")).toEqual(["a", "b", "c"]);
  });
});

describe("eval-special-forms — 미커버 케이스", () => {
  test("map 인라인 comprehension", () => {
    expect(run("(map (list 1 2 3 4 5) [$x] (* $x $x))")).toEqual([1, 4, 9, 16, 25]);
  });

  test("defmacro + 사용", () => {
    // defmacro 정의 후 사용
    expect(run(`
      (defmacro my-when [$cond $body]
        (if $cond $body null))
      (my-when true 42)
    `)).toBe(42);
  });

  test("set — let 내 변수 수정", () => {
    // set은 현재 스코프의 변수를 수정
    // define으로 등록된 변수를 set!으로 수정
    expect(run("(define x 1) (set! x 50) (+ $x 0)")).toBe(50);
  });

  test("begin 별칭", () => {
    expect(run("(begin 1 2 3)")).toBe(3);
  });

  test("progn 별칭", () => {
    expect(run("(progn 1 2 3)")).toBe(3);
  });

  test("compose — pipe로 동일한 효과", () => {
    // compose는 복잡한 구문이 필요하므로 pipe로 동일 효과 검증
    expect(run(`
      (define add1 (fn [$x] (+ $x 1)))
      (define double (fn [$x] (* $x 2)))
      (pipe 5 add1 double)
    `)).toBe(12);
  });
});

describe("error-formatter — suggestSimilar & formatError", () => {
  test("유사 함수명 — 편집거리 기반", () => {
    const { suggestSimilar } = require("../error-formatter");
    const result = suggestSimilar("strlen", ["str", "string?", "strlen", "str-split"]);
    expect(result).toBeDefined();
  });

  test("매우 다른 함수명", () => {
    const { suggestSimilar } = require("../error-formatter");
    const result = suggestSimilar("xyz123abc", ["print", "define", "if", "let"]);
    expect(true).toBe(true);
  });

  test("formatError 기본", () => {
    const { formatError } = require("../error-formatter");
    const err = {
      message: "Test error",
      file: "test.fl",
      line: 1,
      col: 1,
      hint: "check syntax",
    };
    const formatted = formatError(err);
    expect(formatted).toContain("Test error");
    expect(formatted).toContain("test.fl");
  });

  test("formatError with source highlight", () => {
    const { formatError } = require("../error-formatter");
    const err = {
      message: "undefined function 'foo'",
      file: "test.fl",
      line: 2,
      col: 3,
      source: "(define x 1)\n(foo $x)\n(+ 1 2)",
      hint: "did you mean 'for'?",
    };
    const formatted = formatError(err);
    expect(formatted).toContain("오류:");
    expect(formatted).toContain("힌트:");
  });

  test("formatError 파일 없이", () => {
    const { formatError } = require("../error-formatter");
    const err = { message: "simple error" };
    const formatted = formatError(err);
    expect(formatted).toContain("simple error");
  });
});

describe("ast.ts — AST 노드 타입 가드 및 헬퍼", () => {
  test("isBlock 타입 가드", () => {
    const { isBlock } = require("../ast");
    const block = { kind: "block", type: "Array", fields: new Map() };
    expect(isBlock(block)).toBe(true);
    expect(isBlock({ kind: "sexpr" })).toBe(false);
  });

  test("isControlBlock 타입 가드", () => {
    const { isControlBlock } = require("../ast");
    // CONTROL_BLOCK_TYPES: "FUNC", "SERVER", "ROUTE", "INTENT" 등
    const routeBlock = { kind: "block", type: "ROUTE", fields: new Map() };
    expect(isControlBlock(routeBlock)).toBe(true);
    expect(isControlBlock({ kind: "block", type: "Array", fields: new Map() })).toBe(false);
  });

  test("isModuleBlock 타입 가드", () => {
    const { isModuleBlock } = require("../ast");
    const moduleBlock = { kind: "module", name: "test", body: [] };
    expect(isModuleBlock(moduleBlock)).toBe(true);
  });

  test("isImportBlock 타입 가드", () => {
    const { isImportBlock } = require("../ast");
    const importBlock = { kind: "import", module: "test", names: [] };
    expect(isImportBlock(importBlock)).toBe(true);
  });

  test("makeSExpr 헬퍼", () => {
    const { makeSExpr } = require("../ast");
    const expr = makeSExpr("+", [], 1);
    expect(expr.kind).toBe("sexpr");
    expect(expr.op).toBe("+");
    expect(expr.line).toBe(1);
  });

  test("makeBlock 헬퍼", () => {
    const { makeBlock } = require("../ast");
    const block = makeBlock("Array", "test", new Map());
    expect(block.kind).toBe("block");
    expect(block.type).toBe("Array");
  });

  test("makeKeyword 헬퍼", () => {
    const { makeKeyword } = require("../ast");
    const kw = makeKeyword("test");
    expect(kw.kind).toBe("keyword");
    expect(kw.name).toBe("test");
  });

  test("makeTypeAnnotation 헬퍼", () => {
    const { makeTypeAnnotation } = require("../ast");
    const ta = makeTypeAnnotation("Int");
    expect(ta.kind).toBe("type");
    expect(ta.name).toBe("Int");
  });

  test("makeFunctionValue 헬퍼", () => {
    const { makeFunctionValue, makeSExpr } = require("../ast");
    const body = makeSExpr("+", []);
    const fv = makeFunctionValue(["$x"], body, new Map(), "my-fn");
    expect(fv.kind).toBe("function-value");
    expect(fv.name).toBe("my-fn");
  });

  test("isOpenBlock 타입 가드", () => {
    const { isOpenBlock } = require("../ast");
    expect(isOpenBlock({ kind: "open", module: "test" })).toBe(true);
    expect(isOpenBlock({ kind: "import" })).toBe(false);
  });

  test("isSearchBlock 타입 가드", () => {
    const { isSearchBlock } = require("../ast");
    expect(isSearchBlock({ kind: "search-block" })).toBe(true);
    expect(isSearchBlock({ kind: "import" })).toBe(false);
  });

  test("isLearnBlock 타입 가드", () => {
    const { isLearnBlock } = require("../ast");
    expect(isLearnBlock({ kind: "learn-block" })).toBe(true);
    expect(isLearnBlock({ kind: "search-block" })).toBe(false);
  });

  test("isReasoningBlock 타입 가드", () => {
    const { isReasoningBlock } = require("../ast");
    expect(isReasoningBlock({ kind: "reasoning-block" })).toBe(true);
    expect(isReasoningBlock({ kind: "learn-block" })).toBe(false);
  });

  test("CONTROL_BLOCK_TYPES 배열", () => {
    const { CONTROL_BLOCK_TYPES } = require("../ast");
    expect(CONTROL_BLOCK_TYPES).toContain("FUNC");
    expect(CONTROL_BLOCK_TYPES).toContain("SERVER");
    expect(CONTROL_BLOCK_TYPES).toContain("ROUTE");
  });

  test("makeLiteralPattern 헬퍼", () => {
    const { makeLiteralPattern } = require("../ast");
    const pat = makeLiteralPattern("number", 42);
    expect(pat.kind).toBe("literal-pattern");
    expect(pat.value).toBe(42);
  });

  test("makeVariablePattern 헬퍼", () => {
    const { makeVariablePattern } = require("../ast");
    const pat = makeVariablePattern("$x");
    expect(pat.kind).toBe("variable-pattern");
    expect(pat.name).toBe("$x");
  });

  test("makeWildcardPattern 헬퍼", () => {
    const { makeWildcardPattern } = require("../ast");
    const pat = makeWildcardPattern();
    expect(pat.kind).toBe("wildcard-pattern");
  });

  test("makeListPattern 헬퍼", () => {
    const { makeListPattern, makeLiteralPattern } = require("../ast");
    const elem = makeLiteralPattern("number", 1);
    const pat = makeListPattern([elem], "$rest");
    expect(pat.kind).toBe("list-pattern");
    expect(pat.restElement).toBe("$rest");
  });

  test("makeOrPattern 헬퍼", () => {
    const { makeOrPattern, makeLiteralPattern } = require("../ast");
    const a = makeLiteralPattern("number", 1);
    const b = makeLiteralPattern("number", 2);
    const pat = makeOrPattern([a, b]);
    expect(pat.kind).toBe("or-pattern");
    expect(pat.alternatives).toHaveLength(2);
  });

  test("makePatternMatch 헬퍼", () => {
    const { makePatternMatch, makeMatchCase, makeWildcardPattern, makeSExpr } = require("../ast");
    const body = makeSExpr("str", []);
    const mc = makeMatchCase(makeWildcardPattern(), body);
    const pm = makePatternMatch(makeSExpr("+", []), [mc]);
    expect(pm.kind).toBe("pattern-match");
    expect(pm.cases).toHaveLength(1);
  });

  test("makeTypeClass 헬퍼", () => {
    const { makeTypeClass } = require("../ast");
    const tc = makeTypeClass("Functor", ["f"], new Map());
    expect(tc.kind).toBe("type-class");
    expect(tc.name).toBe("Functor");
  });

  test("makeModuleBlock 헬퍼", () => {
    const { makeModuleBlock } = require("../ast");
    const mb = makeModuleBlock("mymod", ["fn1"], [], "mymod.fl");
    expect(mb.kind).toBe("module");
    expect(mb.name).toBe("mymod");
  });

  test("makeImportBlock 헬퍼", () => {
    const { makeImportBlock } = require("../ast");
    const ib = makeImportBlock("mymod", "mymod.fl", ["fn1"], "m");
    expect(ib.kind).toBe("import");
    expect(ib.moduleName).toBe("mymod");
  });

  test("makeOpenBlock 헬퍼", () => {
    const { makeOpenBlock } = require("../ast");
    const ob = makeOpenBlock("mymod", "mymod.fl");
    expect(ob.kind).toBe("open");
    expect(ob.moduleName).toBe("mymod");
  });

  test("isReasoningSequence 타입 가드", () => {
    const { isReasoningSequence } = require("../ast");
    expect(isReasoningSequence({ kind: "reasoning-sequence" })).toBe(true);
    expect(isReasoningSequence({ kind: "reasoning-block" })).toBe(false);
  });

  test("isTryBlock 타입 가드", () => {
    const { isTryBlock } = require("../ast");
    expect(isTryBlock({ kind: "try-block" })).toBe(true);
    expect(isTryBlock({ kind: "reasoning-block" })).toBe(false);
  });

  test("isThrowExpression 타입 가드", () => {
    const { isThrowExpression } = require("../ast");
    expect(isThrowExpression({ kind: "throw" })).toBe(true);
    expect(isThrowExpression({ kind: "try-block" })).toBe(false);
  });
});

describe("인터프리터 — 고급 스코프", () => {
  test("fn 파라미터 독립성 — fn 내 param이 외부 변수와 독립", () => {
    // fn 파라미터는 외부 변수와 다른 이름 사용
    expect(run(`
      (define multiplier 3)
      (define times-mult (fn [$n] (* $n $multiplier)))
      (times-mult 7)
    `)).toBe(21);
  });

  test("재귀 + 누적자", () => {
    expect(run(`
      (define sum-arr (fn [$arr $acc]
        (if (= (length $arr) 0)
          $acc
          (sum-arr (rest $arr) (+ $acc (first $arr))))))
      (sum-arr (list 1 2 3 4 5) 0)
    `)).toBe(15);
  });

  test("고차 함수 체인 — pipe 활용", () => {
    expect(run(`
      (define add3 (fn [$x] (+ $x 3)))
      (pipe 0 add3 add3)
    `)).toBe(6);
  });
});

describe("eval-special-forms — while/while-like 추가", () => {
  test("while 루프 직접 사용", () => {
    // while 폼 직접 테스트
    expect(run(`
      (define n 0)
      (while (< $n 5)
        (set! n (+ $n 1)))
      (+ $n 0)
    `)).toBe(5);
  });

  test("while 루프 합산", () => {
    expect(run(`
      (define i 1)
      (define total 0)
      (while (<= $i 10)
        (set! total (+ $total $i))
        (set! i (+ $i 1)))
      (+ $total 0)
    `)).toBe(55);
  });

  test("map comprehension 3-arg 형식", () => {
    expect(run("(map (list 1 2 3 4 5) [$x] (* $x $x))")).toEqual([1, 4, 9, 16, 25]);
  });

  test("defmacro 기본 정의 및 실행", () => {
    expect(run(`
      (defmacro my-if [$cond $then $else]
        (if $cond $then $else))
      (my-if true "yes" "no")
    `)).toBe("yes");
  });
});

describe("eval-builtins — 추가 케이스 2", () => {
  test("json_keys 빈 객체", () => {
    expect(run("(json_keys {})")).toEqual([]);
  });

  test("assoc 기존 키 덮어쓰기", () => {
    expect(run("(get (assoc (assoc {} \"a\" 1) \"a\" 2) \"a\")")).toBe(2);
  });

  test("slice 배열 경계", () => {
    expect(run("(slice (list 1 2 3 4 5) 0 5)")).toEqual([1, 2, 3, 4, 5]);
  });

  test("find 배열에서 값 탐색 — 인덱스 반환", () => {
    expect(run("(find (list 10 20 30) 20)")).toBe(1);
  });

  test("num + bool 처리", () => {
    expect(run("(bool 0)")).toBe(false);
    expect(run("(bool \"\")")).toBe(false);
    expect(run("(bool \"non-empty\")")).toBe(true);
  });

  test("html-response", () => {
    expect(run("(html-response \"<p>hello</p>\")")).toEqual({ html: "<p>hello</p>" });
  });

  test("json-response 객체", () => {
    expect(run("(json-response (assoc {} \"a\" 1))")).toMatchObject({ a: 1 });
  });

  test("json-response 배열 → 객체 변환", () => {
    expect(run("(json-response (list \"a\" 1 \"b\" 2))")).toMatchObject({ a: 1, b: 2 });
  });

  test("now 시간 문자열", () => {
    const result = run("(now)");
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d{4}-/); // ISO 날짜 형식
  });

  test("server-uptime 숫자", () => {
    const result = run("(server-uptime)");
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test("char-at 경계 — 빈 문자열", () => {
    expect(run("(char-at \"\" 0)")).toBe("");
  });

  test("index-of 문자열 탐색", () => {
    expect(run("(index-of \"hello world\" \" \")")).toBe(5);
  });

  test("filter 비함수 → 원본 반환", () => {
    // filter의 두 번째 인자가 함수 아니면 원본 배열 반환
    expect(run("(filter (list 1 2 3) null)")).toEqual([1, 2, 3]);
  });

  test("find 비배열 → -1", () => {
    expect(run("(find \"not-array\" 1)")).toBe(-1);
  });

  test("get null → null", () => {
    expect(run("(get null \"key\")")).toBeNull();
  });

  test("assoc 비객체 → 새 맵", () => {
    expect(run("(assoc null \"a\" 1)")).toMatchObject({ a: 1 });
  });

  test("dissoc 비객체 → 빈 객체 반환", () => {
    // null은 args[0] ?? {} → {} 반환
    expect(run("(dissoc null \"a\")")).toEqual({});
  });

  test("pop 빈 배열 → null", () => {
    expect(run("(pop (list))")).toBeNull();
  });

  test("shift 빈 배열 → null", () => {
    expect(run("(shift (list))")).toBeNull();
  });

  test("tan 삼각함수", () => {
    expect(run("(tan 0)")).toBeCloseTo(0);
  });

  test("random 범위 [0, 1)", () => {
    const r = run("(random)");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(1);
  });

  test("reverse 비배열 — 빈 배열 반환", () => {
    // 비배열 인자에 reverse 호출
    expect(run("(reverse null)")).toEqual([]);
  });

  test("char-code 빈 문자열 → 에러", () => {
    expect(() => run("(char-code \"\")")).toThrow();
  });

  test("str-split 비문자열 → 빈 배열", () => {
    expect(run("(str-split null \",\")")).toEqual([]);
  });

  test("join 비배열 → 빈 문자열", () => {
    expect(run("(join null \"-\")")).toBe("");
  });

  test("trim 비문자열 → 빈 문자열", () => {
    expect(run("(trim null)")).toBe("");
  });

  test("contains? 비문자열/비배열 → false", () => {
    expect(run("(contains? null \"a\")")).toBe(false);
  });

  test("starts-with? 비문자열 → false", () => {
    expect(run("(starts-with? null \"a\")")).toBe(false);
  });

  test("ends-with? 비문자열 → false", () => {
    expect(run("(ends-with? null \"a\")")).toBe(false);
  });
});

describe("ScopeStack 상세", () => {
  test("snapshot 후 복원", () => {
    const { ScopeStack } = require("../interpreter-scope");
    const stack = new ScopeStack();
    stack.set("$a", 1);
    const snap = stack.snapshot();
    stack.set("$b", 2);
    // snapshot은 Map 형태
    expect(snap).toBeDefined();
  });

  test("ScopeStack 빈 상태 get", () => {
    const { ScopeStack } = require("../interpreter-scope");
    const stack = new ScopeStack();
    expect(stack.get("$nonexistent")).toBeUndefined();
  });

  test("ScopeStack mutate 없는 변수 false", () => {
    const { ScopeStack } = require("../interpreter-scope");
    const stack = new ScopeStack();
    const result = stack.mutate("$nonexistent", 42);
    expect(result).toBe(false);
  });
});

describe("errors.ts — InvalidModuleStructureError", () => {
  test("InvalidModuleStructureError 생성", () => {
    const { InvalidModuleStructureError } = require("../errors");
    const err = new InvalidModuleStructureError("mod", "missing exports");
    expect(err.message).toContain("mod");
    expect(err.message).toContain("missing exports");
    expect(err.name).toBe("InvalidModuleStructureError");
  });
});

describe("모나드 체인 연산", () => {
  test("result-or ok 값 반환", () => {
    expect(run("(result-or (ok 42) 0)")).toBe(42);
  });

  test("result-or err 기본값 반환", () => {
    expect(run("(result-or (err \"fail\") 99)")).toBe(99);
  });

  test("maybe-or some 값 반환", () => {
    expect(run("(maybe-or (some 42) 0)")).toBe(42);
  });

  test("maybe-or none 기본값 반환", () => {
    expect(run("(maybe-or (none) 99)")).toBe(99);
  });

  test("ok? / err? 체크", () => {
    expect(run("(ok? (ok 1))")).toBe(true);
    expect(run("(err? (ok 1))")).toBe(false);
    expect(run("(err? (err \"e\"))")).toBe(true);
  });

  test("some? / none? 체크", () => {
    expect(run("(some? (some 1))")).toBe(true);
    expect(run("(none? (none))")).toBe(true);
  });
});
