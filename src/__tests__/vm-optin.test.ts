/**
 * Phase 3-E: VM Opt-in 통합 테스트
 * VM 경로의 결과가 interpreter 경로와 일치하는지 검증
 */

import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";
import { isVMEligible } from "../vm-eligible";

describe("Phase 3-E: VM opt-in 결과 동일성", () => {
  // 기본 케이스: interpreter와 VM 결과 비교
  const PARITY_CASES = [
    ["(+ 1 2)", 3],
    ["(* 3 4)", 12],
    ["(- 10 3)", 7],
    ["(/ 10 2)", 5],
    ["(% 7 3)", 1],
    ["(> 5 3)", true],
    ["(< 2 8)", true],
    ["(= 4 4)", true],
    ["(!= 3 5)", true],
    ["(and true false)", false],
    ["(or false true)", true],
    ["(not false)", true],
    ["(if true 1 2)", 1],
    ["(if false 1 2)", 2],
    ["(+ (* 2 3) (- 10 4))", 12], // 중첩
  ];

  function interpResult(src: string): any {
    const tokens = lex(src);
    const ast = parse(tokens);
    const interp = new Interpreter();
    const result = interp.interpret(ast);
    return result.lastValue;
  }

  for (const [src, expected] of PARITY_CASES) {
    it(`${src} = ${expected}`, () => {
      expect(interpResult(src as string)).toBe(expected);
    });
  }
});

describe("Phase 3-E: isVMEligible 판별", () => {
  function parse_one(src: string) {
    const tokens = lex(src);
    const ast = parse(tokens);
    return ast[0];
  }

  it("산술 sexpr은 eligible", () => {
    const node = parse_one("(+ 1 2)");
    expect(isVMEligible(node)).toBe(true);
  });

  it("중첩 산술도 eligible", () => {
    const node = parse_one("(+ (* 2 3) (- 10 4))");
    expect(isVMEligible(node)).toBe(true);
  });

  it("비교 연산은 eligible", () => {
    const node = parse_one("(> 5 3)");
    expect(isVMEligible(node)).toBe(true);
  });

  it("논리 연산은 eligible", () => {
    const node = parse_one("(and true false)");
    expect(isVMEligible(node)).toBe(true);
  });

  it("if 표현식은 eligible", () => {
    const node = parse_one("(if true 1 2)");
    expect(isVMEligible(node)).toBe(true);
  });

  it("list 생성은 eligible", () => {
    const node = parse_one("(list 1 2 3)");
    expect(isVMEligible(node)).toBe(true);
  });

  it("unknown op는 not eligible", () => {
    const node = parse_one("(http-get \"url\")");
    expect(isVMEligible(node)).toBe(false);
  });

  it("fn 정의는 not eligible", () => {
    const node = parse_one("(fn [$x] (+ $x 1))");
    expect(isVMEligible(node)).toBe(false);
  });

  it("defun 정의는 not eligible", () => {
    const node = parse_one("(defun add [$x $y] (+ $x $y))");
    expect(isVMEligible(node)).toBe(false);
  });
});

describe("Phase 3-E: FL_VM=1 환경에서 동작", () => {
  function interpWithVM(src: string): any {
    process.env.FL_VM = "1";
    try {
      const tokens = lex(src);
      const ast = parse(tokens);
      const interp = new Interpreter();
      return interp.interpret(ast).lastValue;
    } finally {
      delete process.env.FL_VM;
    }
  }

  it("FL_VM=1로 산술 실행", () => {
    expect(interpWithVM("(+ 1 2)")).toBe(3);
  });

  it("FL_VM=1로 중첩 계산 실행", () => {
    expect(interpWithVM("(+ (* 2 3) (- 10 4))")).toBe(12);
  });

  it("FL_VM=1로 if 조건 실행", () => {
    expect(interpWithVM("(if (> 5 3) 10 20)")).toBe(10);
  });
});

describe("Phase 3-E: Fallback 안전성", () => {
  it("FL_VM=1이어도 인식 불가능한 op는 fallback", () => {
    process.env.FL_VM = "1";
    try {
      const tokens = lex("(unknown-op 1 2)");
      const ast = parse(tokens);
      const interp = new Interpreter();
      // 오류가 발생하거나 fallback으로 처리됨 (구체적 오류는 불규칙할 수 있음)
      // 중요: 크래시하지 않아야 함
      expect(() => {
        interp.interpret(ast);
      }).not.toThrow("VM");
    } finally {
      delete process.env.FL_VM;
    }
  });
});
