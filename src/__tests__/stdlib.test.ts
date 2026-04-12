// stdlib.test.ts — FreeLang v9 Built-in Functions
// Phase 62: Jest 자동화 테스트

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
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("산술 연산자", () => {
  test("+ 기본", () => expect(run("(+ 1 2)")).toBe(3));
  test("+ 다중 인자", () => expect(run("(+ 1 2 3 4)")).toBe(10));
  test("- 뺄셈", () => expect(run("(- 10 3)")).toBe(7));
  test("- 단항 음수", () => expect(run("(- 5)")).toBe(-5));
  test("* 곱셈", () => expect(run("(* 3 4)")).toBe(12));
  test("* 다중", () => expect(run("(* 2 3 4)")).toBe(24));
  test("/ 나눗셈", () => expect(run("(/ 10 2)")).toBe(5));
  test("% 나머지", () => expect(run("(% 10 3)")).toBe(1));
  test("+ 소수", () => expect(run("(+ 1.5 2.5)")).toBe(4));
  test("- 음수 결과", () => expect(run("(- 3 10)")).toBe(-7));
});

describe("비교 연산자", () => {
  test("= 같음 true", () => expect(run("(= 1 1)")).toBe(true));
  test("= 다름 false", () => expect(run("(= 1 2)")).toBe(false));
  test("< true", () => expect(run("(< 1 2)")).toBe(true));
  test("< false", () => expect(run("(< 3 2)")).toBe(false));
  test("> true", () => expect(run("(> 3 2)")).toBe(true));
  test("<= 같음", () => expect(run("(<= 2 2)")).toBe(true));
  test(">= 같음", () => expect(run("(>= 2 2)")).toBe(true));
  test("!= 다름 true", () => expect(run("(!= 1 2)")).toBe(true));
  test("!= 같음 false", () => expect(run("(!= 1 1)")).toBe(false));
});

describe("not 연산자", () => {
  test("not true → false", () => expect(run("(not true)")).toBe(false));
  test("not false → true", () => expect(run("(not false)")).toBe(true));
});

describe("문자열 함수", () => {
  test("str 변환", () => expect(run("(str 42)")).toBe("42"));
  test("str 결합", () => expect(run("(str \"hello\" \" \" \"world\")")).toBe("hello world"));
  test("length 문자열", () => expect(run("(length \"hello\")")).toBe(5));
  test("concat 문자열", () => expect(run("(concat \"hello\" \" world\")")).toBe("hello world"));
  test("upper", () => expect(run("(upper \"hello\")")).toBe("HELLO"));
  test("lower", () => expect(run("(lower \"WORLD\")")).toBe("world"));
  test("trim 공백 제거", () => expect(run("(trim \"  hi  \")")).toBe("hi"));
  test("str-split 분리", () => expect(run("(str-split \"a,b,c\" \",\")")).toEqual(["a", "b", "c"]));
  test("join 결합", () => expect(run("(join (list \"a\" \"b\" \"c\") \"-\")")).toBe("a-b-c"));
  test("starts-with? true", () => expect(run("(starts-with? \"hello\" \"he\")")).toBe(true));
  test("starts-with? false", () => expect(run("(starts-with? \"hello\" \"lo\")")).toBe(false));
  test("ends-with? true", () => expect(run("(ends-with? \"hello\" \"lo\")")).toBe(true));
  test("ends-with? false", () => expect(run("(ends-with? \"hello\" \"he\")")).toBe(false));
  test("contains? true", () => expect(run("(contains? \"hello world\" \"world\")")).toBe(true));
  test("contains? false", () => expect(run("(contains? \"hello\" \"xyz\")")).toBe(false));
  test("substring", () => expect(run("(substring \"hello\" 1 3)")).toBe("el"));
  test("replace", () => expect(run("(replace \"hello world\" \"world\" \"FL\")")).toBe("hello FL"));
  test("index-of 발견", () => expect(run("(index-of \"hello\" \"ll\")")).toBe(2));
  test("index-of 미발견", () => expect(run("(index-of \"hello\" \"xyz\")")).toBe(-1));
  test("uppercase alias", () => expect(run("(uppercase \"abc\")")).toBe("ABC"));
  test("lowercase alias", () => expect(run("(lowercase \"XYZ\")")).toBe("xyz"));
});

describe("배열 함수", () => {
  test("list 생성", () => expect(run("(list 1 2 3)")).toEqual([1, 2, 3]));
  test("first 첫번째 요소", () => expect(run("(first (list 1 2 3))")).toBe(1));
  test("rest 나머지", () => expect(run("(rest (list 1 2 3))")).toEqual([2, 3]));
  test("length 배열", () => expect(run("(length (list 1 2 3))")).toBe(3));
  test("append 두 배열", () => expect(run("(append (list 1 2) (list 3 4))")).toEqual([1, 2, 3, 4]));
  test("reverse 배열", () => expect(run("(reverse (list 1 2 3))")).toEqual([3, 2, 1]));
  test("get 인덱스", () => expect(run("(get (list 10 20 30) 1)")).toBe(20));
  test("get 범위 초과 null", () => expect(run("(get (list 1 2) 5)")).toBeNull());
  test("sort 숫자", () => expect(run("(sort (list 3 1 2))")).toEqual([1, 2, 3]));
  test("unique 중복 제거", () => expect(run("(unique (list 1 2 2 3 3))")).toEqual([1, 2, 3]));
  test("push 요소 추가", () => expect(run("(push (list 1 2) 3)")).toEqual([1, 2, 3]));
  test("last 마지막 요소", () => expect(run("(last (list 1 2 3))")).toBe(3));
  test("slice 슬라이스", () => expect(run("(slice (list 1 2 3 4 5) 1 3)")).toEqual([2, 3]));
  test("flatten 중첩배열 평탄화", () => expect(run("(flatten (list (list 1 2) (list 3 4)))")).toEqual([1, 2, 3, 4]));
});

describe("타입 검사 함수", () => {
  test("null? null", () => expect(run("(null? null)")).toBe(true));
  test("null? 숫자 false", () => expect(run("(null? 0)")).toBe(false));
  test("zero? 0 true", () => expect(run("(zero? 0)")).toBe(true));
  test("zero? 1 false", () => expect(run("(zero? 1)")).toBe(false));
  test("pos? 양수 true", () => expect(run("(pos? 5)")).toBe(true));
  test("pos? 음수 false", () => expect(run("(pos? (- 1))")).toBe(false));
  // neg? 는 (- 3) 표현으로 음수 전달 (FreeLang에서 -3 리터럴은 (- 3)으로 파싱)
  test("neg? 음수 true", () => expect(run("(neg? (- 3))")).toBe(true));
  test("neg? 양수 false", () => expect(run("(neg? 1)")).toBe(false));
  test("even? 짝수 true", () => expect(run("(even? 4)")).toBe(true));
  test("even? 홀수 false", () => expect(run("(even? 3)")).toBe(false));
  test("odd? 홀수 true", () => expect(run("(odd? 7)")).toBe(true));
  test("odd? 짝수 false", () => expect(run("(odd? 2)")).toBe(false));
  test("string? 문자열", () => expect(run("(string? \"hello\")")).toBe(true));
  test("string? 숫자 false", () => expect(run("(string? 42)")).toBe(false));
  test("number? 숫자", () => expect(run("(number? 42)")).toBe(true));
  test("number? 문자 false", () => expect(run("(number? \"x\")")).toBe(false));
  test("bool? 불린", () => expect(run("(bool? true)")).toBe(true));
  test("bool? 숫자 false", () => expect(run("(bool? 1)")).toBe(false));
  test("array? 배열", () => expect(run("(array? (list 1 2))")).toBe(true));
  test("array? 숫자 false", () => expect(run("(array? 42)")).toBe(false));
});

describe("수학 함수", () => {
  test("abs 양수", () => expect(run("(abs 5)")).toBe(5));
  test("abs 음수", () => expect(run("(abs (- 5))")).toBe(5));
  test("min", () => expect(run("(min 3 1 2)")).toBe(1));
  test("max", () => expect(run("(max 3 1 2)")).toBe(3));
  test("floor", () => expect(run("(floor 3.7)")).toBe(3));
  test("ceil", () => expect(run("(ceil 3.2)")).toBe(4));
  test("round 반올림", () => expect(run("(round 3.5)")).toBe(4));
  test("round 내림", () => expect(run("(round 3.4)")).toBe(3));
  test("sqrt", () => expect(run("(sqrt 9)")).toBe(3));
  test("pow", () => expect(run("(pow 2 10)")).toBe(1024));
});

describe("Monad — ok/err/some/none", () => {
  test("ok 생성", () => expect(run("(ok 42)")).toEqual({ tag: "Ok", value: 42, kind: "Result" }));
  test("err 생성", () => expect(run("(err \"오류\")")).toEqual({ tag: "Err", value: "오류", kind: "Result" }));
  test("some 생성", () => expect(run("(some 10)")).toEqual({ tag: "Some", value: 10, kind: "Option" }));
  test("none 생성", () => expect(run("(none)")).toEqual({ tag: "None", value: null, kind: "Option" }));
});

describe("filter/map/reduce (고차 함수)", () => {
  // filter는 JS native fn을 요구하므로 reduce로 동일 동작 구현
  test("reduce로 짝수만 필터", () => {
    const result = run(`
      (define nums (list 1 2 3 4 5))
      (reduce $nums (list) (fn [$acc $x]
        (if (even? $x)
          (push $acc $x)
          $acc)))
    `);
    expect(result).toEqual([2, 4]);
  });

  test("reduce 합산", () => {
    expect(run("(reduce (list 1 2 3 4 5) 0 (fn [$acc $x] (+ $acc $x)))")).toBe(15);
  });

  test("reduce 곱", () => {
    expect(run("(reduce (list 1 2 3 4 5) 1 (fn [$acc $x] (* $acc $x)))")).toBe(120);
  });
});

describe("변환 함수", () => {
  test("num-to-str", () => expect(run("(num->str 42)")).toBe("42"));
  test("str-to-num", () => expect(run("(str->num \"3.14\")")).toBeCloseTo(3.14));
  test("typeof 숫자", () => expect(run("(typeof 42)")).toBe("number"));
  test("typeof 문자", () => expect(run("(typeof \"hi\")")).toBe("string"));
});
