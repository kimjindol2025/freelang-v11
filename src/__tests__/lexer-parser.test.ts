// lexer-parser.test.ts — FreeLang v9 Lexer & Parser Unit Tests
// Phase 62: Jest 자동화 테스트

import { lex } from "../lexer";
import { parse } from "../parser";
import { Interpreter } from "../interpreter";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function lexTokenTypes(src: string): string[] {
  return lex(src).map((t) => t.type);
}

function lexTokenValues(src: string): any[] {
  return lex(src).map((t) => t.value);
}

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("Lexer — 기본 토큰", () => {
  test("정수 토큰", () => {
    const tokens = lex("42");
    expect(tokens[0].type).toBe("Number");
    expect(tokens[0].value).toBe("42"); // 렉서는 문자열로 저장, 파서에서 변환
  });

  test("소수 토큰", () => {
    const tokens = lex("3.14");
    expect(tokens[0].type).toBe("Number");
    expect(tokens[0].value).toBe("3.14");
  });

  test("문자열 토큰", () => {
    const tokens = lex('"hello"');
    expect(tokens[0].type).toBe("String");
    expect(tokens[0].value).toBe("hello");
  });

  test("괄호 토큰", () => {
    const tokens = lex("(foo 1)");
    expect(tokens[0].type).toBe("LParen");
    // 마지막은 EOF, 그 이전이 RParen
    const rparenToken = tokens.find((t) => t.type === "RParen");
    expect(rparenToken).toBeDefined();
  });

  test("변수 $x 토큰", () => {
    const tokens = lex("$x");
    expect(tokens[0].type).toBe("Variable");
    expect(tokens[0].value).toBe("x");
  });

  test("true/false 불린 토큰", () => {
    // FreeLang 렉서에서 true/false는 Symbol 타입으로 처리됨 (파서에서 불린으로 변환)
    const trueTokens = lex("true");
    expect(trueTokens[0].type).toBe("Symbol");
    expect(trueTokens[0].value).toBe("true");

    const falseTokens = lex("false");
    expect(falseTokens[0].type).toBe("Symbol");
    expect(falseTokens[0].value).toBe("false");
  });

  test("null 토큰", () => {
    // FreeLang 렉서에서 null은 Symbol 타입 (파서에서 변환)
    const tokens = lex("null");
    expect(tokens[0].type).toBe("Symbol");
    expect(tokens[0].value).toBe("null");
  });

  test("대괄호 토큰", () => {
    const tokens = lex("[1 2 3]");
    expect(tokens[0].type).toBe("LBracket");
    // 렉서에는 EOF도 포함됨 - RBracket 찾기
    const rbracket = tokens.find((t) => t.type === "RBracket");
    expect(rbracket).toBeDefined();
  });

  test("주석 무시", () => {
    const tokens = lex("; 이건 주석\n42");
    // EOF 포함 2개 토큰
    expect(tokens.length).toBeGreaterThanOrEqual(1);
    expect(tokens[0].type).toBe("Number");
    expect(tokens[0].value).toBe("42"); // 문자열로 저장
  });

  test("여러 줄 처리", () => {
    const tokens = lex("(+\n  1\n  2)");
    // 렉서는 숫자를 문자열로 저장
    expect(tokens.some((t) => t.value === "1")).toBe(true);
    expect(tokens.some((t) => t.value === "2")).toBe(true);
  });

  test("이스케이프 문자열 \\n", () => {
    const tokens = lex('"hello\\nworld"');
    expect(tokens[0].value).toBe("hello\nworld");
  });

  test("이스케이프 문자열 \\t", () => {
    const tokens = lex('"tab\\there"');
    expect(tokens[0].value).toBe("tab\there");
  });

  test("콜론 토큰 타입", () => {
    // FreeLang 렉서에서 : 는 Colon 토큰으로 별도 처리
    const tokens = lex(":key");
    expect(tokens[0].type).toBe("Colon");
    expect(tokens[0].value).toBe(":");
    // 다음 토큰은 Symbol "key"
    expect(tokens[1].type).toBe("Symbol");
    expect(tokens[1].value).toBe("key");
  });
});

describe("Parser — S-Expression", () => {
  test("단순 s-expr 파싱", () => {
    const ast = parse(lex("(+ 1 2)"));
    expect(ast).toHaveLength(1);
    expect((ast[0] as any).op).toBe("+");
  });

  test("중첩 s-expr 파싱", () => {
    const ast = parse(lex("(+ 1 (* 2 3))"));
    expect(ast).toHaveLength(1);
    expect((ast[0] as any).op).toBe("+");
    expect((ast[0] as any).args[1].op).toBe("*");
  });

  test("빈 소스 파싱", () => {
    const ast = parse(lex(""));
    expect(ast).toHaveLength(0);
  });

  test("다중 표현식 파싱", () => {
    const ast = parse(lex("(+ 1 2) (- 5 3)"));
    expect(ast).toHaveLength(2);
  });

  test("문자열 리터럴 — s-expr 내에서 파싱", () => {
    // FreeLang 파서는 최상위 리터럴을 허용하지 않고 s-expr 안에서만 허용
    const ast = parse(lex('(str "hello")'));
    expect(ast).toHaveLength(1);
    expect((ast[0] as any).op).toBe("str");
  });

  test("숫자 리터럴 — s-expr 내에서 파싱", () => {
    const ast = parse(lex("(+ 42 0)"));
    expect(ast).toHaveLength(1);
    // args[0]는 숫자 42 리터럴
    const numArg = (ast[0] as any).args[0];
    expect(numArg.value).toBe(42);
  });

  test("불린 — if 조건에서 파싱", () => {
    const ast = parse(lex("(if true 1 2)"));
    // args[0]는 true 리터럴
    const trueArg = (ast[0] as any).args[0];
    expect(trueArg.value).toBe(true);
  });

  test("define 블록 파싱", () => {
    const ast = parse(lex("(define x 42)"));
    expect(ast).toHaveLength(1);
    expect((ast[0] as any).op).toBe("define");
  });

  test("fn 파싱", () => {
    const ast = parse(lex("(fn [$x] (* $x 2))"));
    expect(ast).toHaveLength(1);
    expect((ast[0] as any).op).toBe("fn");
  });

  test("if 파싱", () => {
    const ast = parse(lex("(if true 1 2)"));
    expect((ast[0] as any).op).toBe("if");
    expect((ast[0] as any).args).toHaveLength(3);
  });

  test("let 파싱", () => {
    const ast = parse(lex("(let [[$x 1]] $x)"));
    expect((ast[0] as any).op).toBe("let");
  });

  test("loop 파싱", () => {
    const ast = parse(lex("(loop [i 0] $i)"));
    expect((ast[0] as any).op).toBe("loop");
  });

  test("cond 파싱", () => {
    const ast = parse(lex("(cond [true 1] [false 2])"));
    expect((ast[0] as any).op).toBe("cond");
  });
});

describe("Parser — 배열/맵 리터럴", () => {
  test("배열 리터럴 파싱", () => {
    const ast = parse(lex("[1 2 3]"));
    expect(ast).toHaveLength(1);
  });

  test("중첩 배열 파싱", () => {
    const result = run("(get [1 2 3] 0)");
    expect(result).toBe(1);
  });
});

describe("인터프리터 — 복합 표현식", () => {
  test("중첩 산술", () => {
    expect(run("(+ (* 2 3) (- 10 4))")).toBe(12);
  });

  test("조건 중첩", () => {
    expect(run("(if (= 1 1) (if (= 2 2) \"ok\" \"no\") \"fail\")")).toBe("ok");
  });

  test("define + if", () => {
    expect(run("(define age 20) (if (>= $age 18) \"adult\" \"minor\")")).toBe("adult");
  });

  test("재귀 함수", () => {
    expect(run(`
      (define sum-to (fn [$n]
        (if (<= $n 0)
          0
          (+ $n (sum-to (- $n 1))))))
      (sum-to 10)
    `)).toBe(55);
  });

  test("map 내장 함수", () => {
    expect(run("(assoc {} \"key\" \"val\")")).toEqual({ key: "val" });
  });

  test("map-set 함수", () => {
    const result = run(`
      (define m {})
      (map-set $m :foo 42)
    `);
    expect(result).toMatchObject({ foo: 42 });
  });
});

describe("eval-special-forms — pipe/compose", () => {
  test("pipe 함수 합성", () => {
    expect(run(`
      (define double (fn [$x] (* $x 2)))
      (define inc (fn [$x] (+ $x 1)))
      (pipe 5 double inc)
    `)).toBe(11);
  });

  test("고차 함수 — fn 반환 및 호출", () => {
    // 함수를 반환하는 함수 패턴
    expect(run(`
      (define make-triple (fn [] (fn [$x] (* $x 3))))
      (define triple (make-triple))
      (triple 7)
    `)).toBe(21);
  });
});

describe("eval-special-forms — 고급 define", () => {
  test("3-arg define (함수 단축)", () => {
    // (define name [params] body) 형식
    expect(run("(define double [$x] (* $x 2)) (double 5)")).toBe(10);
  });
});

describe("eval-builtins — 추가 케이스", () => {
  test("char-at", () => {
    expect(run("(char-at \"hello\" 1)")).toBe("e");
  });

  test("char-code", () => {
    expect(run("(char-code \"A\")")).toBe(65);
  });

  test("is-whitespace?", () => {
    expect(run("(is-whitespace? \" \")")).toBe(true);
    expect(run("(is-whitespace? \"a\")")).toBe(false);
  });

  test("is-digit?", () => {
    expect(run("(is-digit? \"5\")")).toBe(true);
    expect(run("(is-digit? \"a\")")).toBe(false);
  });

  test("num 변환", () => {
    expect(run("(num \"42\")")).toBe(42);
  });

  test("bool 변환 truthy", () => {
    expect(run("(bool 1)")).toBe(true);
    expect(run("(bool 0)")).toBe(false);
  });

  test("clamp", () => {
    expect(run("(clamp 15 0 10)")).toBe(10);
    expect(run("(clamp (- 5) 0 10)")).toBe(0);
    expect(run("(clamp 5 0 10)")).toBe(5);
  });

  test("assoc 맵 추가", () => {
    expect(run("(assoc {} \"a\" 1)")).toMatchObject({ a: 1 });
  });

  test("json_keys", () => {
    expect(run("(json_keys (assoc {} \"x\" 1))")).toEqual(["x"]);
  });

  test("map? 검사", () => {
    expect(run("(map? (assoc {} \"a\" 1))")).toBe(true);
    expect(run("(map? 42)")).toBe(false);
  });

  test("push/pop 시뮬레이션", () => {
    expect(run("(last (push (list 1 2 3) 4))")).toBe(4);
  });

  test("str-join alias", () => {
    expect(run("(str-join (list \"a\" \"b\") \"-\")")).toBe("a-b");
  });

  test("repr JSON 변환", () => {
    const result = run("(repr 42)");
    expect(result).toBe("42");
  });
});

describe("errors.ts — 에러 클래스", () => {
  test("FunctionNotFoundError 메시지", () => {
    const { FunctionNotFoundError } = require("../errors");
    const err = new FunctionNotFoundError("my-func", "test.fl", 1, 0);
    expect(err.message).toContain("my-func");
    expect(err.functionName).toBe("my-func");
  });

  test("ModuleNotFoundError 메시지", () => {
    const { ModuleNotFoundError } = require("../errors");
    const err = new ModuleNotFoundError("my-module", "importer.fl");
    expect(err.message).toContain("my-module");
    expect(err.moduleName).toBe("my-module");
  });

  test("FunctionRegistrationError", () => {
    const { FunctionRegistrationError } = require("../errors");
    const err = new FunctionRegistrationError("mod", "fn-name", "conflict");
    expect(err.message).toContain("fn-name");
  });

  test("SelectiveImportError", () => {
    const { SelectiveImportError } = require("../errors");
    const err = new SelectiveImportError("mod", "fn-name");
    expect(err.message).toContain("fn-name");
    expect(err.message).toContain("mod");
  });
});
