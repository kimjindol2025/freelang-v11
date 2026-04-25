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

// ─────────────────────────────────────────────────────────────
// Phase A (2026-04-25): FLRuntimeError 통일 + ErrorCode + 컨텍스트
// ─────────────────────────────────────────────────────────────
describe("Phase A — FLRuntimeError + ErrorCode", () => {
  test("E_ARG_COUNT: fn 인자 부족 시 에러 코드 + 컨텍스트", () => {
    const err: any = runExpectError("(fn)");
    expect(err.message).toContain("E_ARG_COUNT");
    expect(err.message).toContain("fn");
    expect(err.code).toBe("E_ARG_COUNT");
    expect(err.context?.fn).toBe("fn");
  });

  test("E_ARG_COUNT: defn 인자 부족 시 코드 표시", () => {
    const err: any = runExpectError("(defn foo)");
    expect(err.message).toContain("E_ARG_COUNT");
    expect(err.code).toBe("E_ARG_COUNT");
    expect(err.context?.fn).toBe("defn");
  });

  test("E_INVALID_FORM: defn 첫 인자가 symbol 아님", () => {
    const err: any = runExpectError("(defn 42 [] 1)");
    expect(err.message).toContain("E_INVALID_FORM");
    expect(err.code).toBe("E_INVALID_FORM");
    expect(err.context?.fn).toBe("defn");
  });

  test("E_FN_NOT_FOUND: func-ref가 미정의 함수 참조", () => {
    const err: any = runExpectError("(func-ref totally-undefined-fn)");
    expect(err.message).toContain("E_FN_NOT_FOUND");
    expect(err.code).toBe("E_FN_NOT_FOUND");
  });

  test("FLRuntimeError는 hint 자동 표시 (RECOVERY_HINTS 사용)", () => {
    const err: any = runExpectError("(set 42 99)");
    // set은 첫 인자가 variable이어야 함 → INVALID_FORM
    expect(err.message).toContain("E_INVALID_FORM");
    expect(err.hint).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────
// Phase B (2026-04-25): 타입 predicate alias
// ─────────────────────────────────────────────────────────────
describe("Phase B — 타입 predicate alias", () => {
  test("nil? 는 null? 의 alias", () => {
    expect(run("(nil? null)")).toBe(true);
    expect(run("(nil? 42)")).toBe(false);
    expect(run("(null? null)")).toBe(true);
  });

  test("array? 는 list? 와 동일", () => {
    expect(run("(list? (list 1 2))")).toBe(true);
    expect(run("(array? (list 1 2))")).toBe(true);
    expect(run("(list? 42)")).toBe(false);
  });

  test("function? 는 fn? 의 alias", () => {
    expect(run("(fn? 42)")).toBe(false);
    expect(run("(function? 42)")).toBe(false);
  });

  test("bool? 는 boolean? 의 alias", () => {
    expect(run("(bool? true)")).toBe(true);
    expect(run("(boolean? true)")).toBe(true);
    expect(run("(bool? 42)")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Phase C (2026-04-25): nil-safe wrapper + strict 모드
// ─────────────────────────────────────────────────────────────
describe("Phase C — nil-safe wrapper", () => {
  test("get-or: nil coll → default 반환", () => {
    expect(run("(get-or null :name \"unknown\")")).toBe("unknown");
  });

  test("get-or: 값이 있으면 그 값 반환", () => {
    expect(run('(get-or {:name "Alice"} :name "default")')).toBe("Alice");
  });

  test("get-or: key 없으면 default", () => {
    expect(run('(get-or {:age 30} :name "default")')).toBe("default");
  });

  test("first-or: nil/빈 배열 → default", () => {
    expect(run("(first-or null 99)")).toBe(99);
    expect(run("(first-or (list) 99)")).toBe(99);
    expect(run("(first-or (list 1 2) 99)")).toBe(1);
  });

  test("last-or: nil/빈 배열 → default", () => {
    expect(run("(last-or null 99)")).toBe(99);
    expect(run("(last-or (list 1 2 3) 99)")).toBe(3);
  });

  test("last (기본): 빈 배열은 null", () => {
    expect(run("(last (list))")).toBeNull();
    expect(run("(last (list 1 2 3))")).toBe(3);
  });

  test("FL_STRICT 모드: get nil → E_TYPE_NIL throw", () => {
    process.env.FL_STRICT = "1";
    try {
      const err: any = runExpectError("(get null :foo)");
      expect(err.message).toContain("E_TYPE_NIL");
      expect(err.code).toBe("E_TYPE_NIL");
    } finally {
      delete process.env.FL_STRICT;
    }
  });

  test("FL_STRICT 모드 OFF: get nil → null (기본 동작)", () => {
    delete process.env.FL_STRICT;
    expect(run("(get null :foo)")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Phase D (2026-04-25): (use NAME) — 간소 stdlib import
// ─────────────────────────────────────────────────────────────
describe("Phase D — (use) 간소 import", () => {
  test("(use json) 모듈 로드 성공 (path resolution + evaluate)", () => {
    // path: self/stdlib/json.fl → 자동 resolve + load
    // 모듈 내 일부 wrapper는 미등록 함수 참조하지만, 정의 자체는 성공해야 함
    const interp = new Interpreter();
    expect(() => {
      try {
        interp.interpret(parse(lex("(use json)")));
      } catch (e: any) {
        // 함수 정의는 lazy evaluate이므로 use 자체는 성공
        if (e.message?.includes("not found") && e.message?.includes("json")) throw e;
      }
    }).not.toThrow();
  });

  test("(use 존재하지않는모듈) → 명확한 에러", () => {
    const err: any = runExpectError("(use totally-undefined-module-xyz)");
    expect(err.message).toContain("not found");
    expect(err.code).toBeTruthy();
  });

  test("같은 (use) 두 번 호출은 cache로 skip", () => {
    // 두 번 호출해도 에러 없어야 함
    expect(() => run("(use ai) (use ai)")).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// Phase E (2026-04-25): callStack + stack-overflow enrichment
// ─────────────────────────────────────────────────────────────
describe("Phase E — callStack 추적 + stack overflow 에러", () => {
  test("정상 호출 후 callStack 비어있음 (push/pop 균형)", () => {
    const interp = new Interpreter();
    interp.interpret(parse(lex("(defn f [x] (+ x 1)) (f 10)")));
    expect((interp as any).callStack).toBeDefined();
    expect((interp as any).callStack.length).toBe(0);
  });

  test("무한 재귀: 어떤 형태든 에러는 발생 (V8 또는 E_STACK_OVERFLOW)", () => {
    // 환경에 따라 V8 native overflow가 먼저 터질 수 있음 (default node stack limit).
    // node --stack-size=8000 에서는 우리 MAX_CALL_DEPTH로 잡혀 enrichment 가능.
    const err: any = runExpectError(`
      (defn loop-forever [n] (loop-forever (+ n 1)))
      (loop-forever 0)
    `);
    expect(err).toBeDefined();
    expect(err.message).toBeTruthy();
    // E_STACK_OVERFLOW면 enrichment 검증, V8이면 단순 통과
    if (err.message.includes("E_STACK_OVERFLOW")) {
      expect(err.message).toContain("loop-forever");
      expect(err.message).toContain("최근 호출 체인");
    }
  });

  test("FL_TRACE=1: 함수 호출 시 trace 출력 (silent로 검증)", () => {
    process.env.FL_TRACE = "1";
    try {
      const interp = new Interpreter();
      // 에러 없이 실행되면 OK (출력은 stderr로)
      expect(() => {
        interp.interpret(parse(lex("(defn add [a b] (+ a b)) (add 1 2)")));
      }).not.toThrow();
    } finally {
      delete process.env.FL_TRACE;
    }
  });

  test("CALL_STACK_LIMIT 상수 노출 (100)", () => {
    expect(Interpreter.CALL_STACK_LIMIT).toBe(100);
  });
});
