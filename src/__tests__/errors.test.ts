// errors.test.ts — FreeLang v9 Error Handling
// Phase 62: Jest 자동화 테스트

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

function runExpectError(src: string): Error {
  const interp = new Interpreter();
  let error: Error | null = null;
  try {
    interp.interpret(parse(lex(src)));
  } catch (e: any) {
    error = e;
  }
  if (!error) throw new Error("Expected an error but none was thrown");
  return error;
}

beforeAll(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("에러 — 존재하지 않는 함수", () => {
  test("undefined-fn 호출 시 에러 발생", () => {
    const err = runExpectError("(totally-undefined-function 1 2 3)");
    expect(err).toBeDefined();
    expect(err.message).toBeTruthy();
  });

  test("에러 메시지에 함수 이름 포함", () => {
    const err = runExpectError("(non-existent-fn 42)");
    expect(err.message).toContain("non-existent-fn");
  });
});

describe("에러 — 명시적 error 폼", () => {
  test("(error ...) 호출 시 에러 발생", () => {
    const err = runExpectError("(error \"직접 에러\")");
    expect(err).toBeDefined();
    expect(err.message).toContain("직접 에러");
  });

  test("(error ...) 메시지 포함 확인", () => {
    const err = runExpectError("(error \"테스트 에러 메시지\")");
    expect(err.message).toContain("테스트 에러 메시지");
  });
});

describe("에러 — 0으로 나누기", () => {
  test("/ 0으로 나누기 → Infinity (JS 동작)", () => {
    // JavaScript는 0으로 나누면 Infinity를 반환
    const result = run("(/ 10 0)");
    expect(result).toBe(Infinity);
  });

  test("% 0으로 나누기 → NaN", () => {
    const result = run("(% 10 0)");
    expect(Number.isNaN(result)).toBe(true);
  });
});

describe("에러 — fn 인자 부족", () => {
  test("fn args 길이 부족 시 에러", () => {
    const err = runExpectError("(fn)");
    expect(err).toBeDefined();
  });
});

describe("에러 — 잘못된 타입 연산", () => {
  test("null에 length → 0 반환", () => {
    // FreeLang은 null?.length || 0 처리
    expect(run("(length null)")).toBe(0);
  });

  test("비문자열 upper → 처리됨", () => {
    const result = run("(upper 42)");
    expect(typeof result).toBe("string");
  });
});

describe("에러 — 렉서 파싱 에러", () => {
  test("빈 소스 → 에러 없이 처리", () => {
    expect(() => run("")).not.toThrow();
  });

  test("주석만 있는 소스", () => {
    expect(() => run("; 이건 주석")).not.toThrow();
  });
});

describe("에러 — set! 미정의 변수", () => {
  test("set! 미정의 변수는 새 변수로 생성", () => {
    // set!은 없으면 새로 set
    expect(() => run("(set! z 99)")).not.toThrow();
  });
});
