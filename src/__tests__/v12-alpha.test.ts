// v12 Alpha 테스트 — FL_V12=1 Breaking Changes
// 커버: #16 define재정의 에러, #17/#18 set! 에러, #19 @atom 문법, #20 swap! extra args, #94 atom 클로저
import { Interpreter } from '../interpreter';
import { lex } from '../lexer';
import { Parser } from '../parser';

function run(src: string, env?: Record<string, string>): any {
  const saved: Record<string, string | undefined> = {};
  if (env) {
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
  }
  try {
    const tokens = lex(src);
    const ast = new Parser(tokens).parse();
    const interp = new Interpreter();
    interp.interpret(ast);
    return (interp as any).context?.lastValue ?? null;
  } finally {
    if (env) {
      for (const [k] of Object.entries(env)) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }
}

function runV12(src: string): any {
  return run(src, { FL_V12: "1" });
}

function runV12Throws(src: string): string {
  try {
    runV12(src);
    return "";
  } catch (e: any) {
    return e.message ?? String(e);
  }
}

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => { jest.restoreAllMocks(); });

// ─── #19: @atom 문법 ──────────────────────────────────────────────
describe("v12 #19: @atom 문법 (deref shorthand)", () => {
  test("@x → (deref x) 기본 동작", () => {
    const r = run('(define x (atom 42)) @x');
    expect(r).toBe(42);
  });

  test("atom 값 수정 후 @ 확인", () => {
    const r = run('(define c (atom 0)) (reset! c 99) @c');
    expect(r).toBe(99);
  });

  test("swap! 후 @ 확인", () => {
    const r = run('(define n (atom 5)) (swap! n + 3) @n');
    expect(r).toBe(8);
  });

  test("@atom 표현식 내 사용", () => {
    const r = run('(define a (atom 10)) (define b (atom 20)) (+ @a @b)');
    expect(r).toBe(30);
  });

  test("kebab-case atom 이름", () => {
    const r = run('(define my-counter (atom 0)) (swap! my-counter + 1) @my-counter');
    expect(r).toBe(1);
  });
});

// ─── #20: swap! extra args ────────────────────────────────────────
describe("v12 #20: swap! extra args", () => {
  test("(swap! a + 1) 내장 함수", () => {
    const r = run('(define a (atom 5)) (swap! a + 1) @a');
    expect(r).toBe(6);
  });

  test("(swap! a * 2) 내장 함수", () => {
    const r = run('(define a (atom 3)) (swap! a * 2) @a');
    expect(r).toBe(6);
  });

  test("(swap! a str) 변환", () => {
    const r = run('(define a (atom 42)) (swap! a str) @a');
    expect(r).toBe("42");
  });

  test("swap! 연속 호출", () => {
    const r = run(`
      (define a (atom 0))
      (swap! a + 1)
      (swap! a + 1)
      (swap! a + 1)
      @a`);
    expect(r).toBe(3);
  });

  test("swap! fn 인자", () => {
    const r = run('(define a (atom 10)) (swap! a (fn [v] (* v v))) @a');
    expect(r).toBe(100);
  });
});

// ─── #94: atom 클로저 참조 캡처 ───────────────────────────────────
describe("v12 #94: atom 클로저 참조 캡처", () => {
  test("클로저가 atom 참조를 공유", () => {
    const r = run(`
      (define counter (atom 0))
      (defn inc! [] (swap! counter + 1))
      (inc!)
      (inc!)
      (inc!)
      @counter`);
    expect(r).toBe(3);
  });

  test("여러 클로저가 동일 atom 공유", () => {
    const r = run(`
      (define state (atom 0))
      (defn add [n] (swap! state + n))
      (defn reset [] (reset! state 0))
      (add 5)
      (add 3)
      (reset)
      (add 10)
      @state`);
    expect(r).toBe(10);
  });
});

// ─── #16: define 재정의 에러 (FL_V12=1) ──────────────────────────
describe("v12 #16: define 재정의 에러", () => {
  test("FL_V12=1: define 재정의 시 에러 throw", () => {
    const msg = runV12Throws('(define x 1) (define x 2)');
    expect(msg).toContain("v12");
    expect(msg).toContain("x");
    expect(msg).toContain("atom");
  });

  test("FL_V12=1: 첫 define은 에러 없음", () => {
    const r = runV12('(define y 42) (+ y 0)');
    expect(r).toBe(42);
  });

  test("FL_V12=0(기본): define 재정의는 경고만 (에러 없음)", () => {
    // FL_V12 미설정 시 경고만 출력, 실행은 계속
    const r = run('(define x 1) (define x 2) (+ x 0)');
    expect(r).toBe(2);
  });

  test("FL_V12=1: atom 패턴은 재정의 아님 (에러 없음)", () => {
    // define 이름이 다르면 에러 없음
    const r = runV12('(define x (atom 0)) (swap! x + 1) @x');
    expect(r).toBe(1);
  });
});

// ─── #17/#18: set! 에러 (FL_V12=1) ───────────────────────────────
describe("v12 #17/#18: set! 에러", () => {
  test("FL_V12=1: set! 사용 시 에러 throw", () => {
    const msg = runV12Throws('(define x 1) (set! x 2)');
    expect(msg).toContain("v12");
    expect(msg).toContain("set!");
    expect(msg).toContain("atom");
  });

  test("FL_V12=0(기본): set! 경고만 (에러 없음)", () => {
    const r = run('(define x 1) (set! x 99) (+ x 0)');
    expect(r).toBe(99);
  });

  test("FL_V12=1: atom + swap! 패턴은 에러 없음", () => {
    const r = runV12('(define x (atom 1)) (swap! x + 99) @x');
    expect(r).toBe(100);
  });
});

// ─── 통합: v12 atom 패턴 전환 ────────────────────────────────────
describe("v12 atom 패턴 통합 시나리오", () => {
  test("카운터 패턴: v12 권장 방식", () => {
    const r = runV12(`
      (define count (atom 0))
      (defn tick [] (swap! count + 1))
      (tick) (tick) (tick) (tick) (tick)
      @count`);
    expect(r).toBe(5);
  });

  test("누산기 패턴: reset! + swap!", () => {
    const r = run(`
      (define total (atom 0))
      (swap! total + 10)
      (swap! total + 20)
      (reset! total 0)
      (swap! total + 5)
      @total`);
    expect(r).toBe(5);
  });
});
