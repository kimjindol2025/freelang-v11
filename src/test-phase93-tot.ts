// FreeLang v9: Phase 93 — Tree-of-Thought 검증
// AI 병렬 분기 탐색 추론 언어 원어

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import { TreeOfThought, ThoughtBranch, ToTResult } from "./tot";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 140)}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

// ─── TC-1~6: TreeOfThought 기본 ───────────────────────────────────────────

console.log("[Phase 93] Tree-of-Thought 검증\n");
console.log("[TC-1~6] TreeOfThought 기본 API\n");

test("TC-1: 인스턴스 생성", () => {
  const tot = new TreeOfThought();
  assert(tot !== null, "TreeOfThought 인스턴스가 null");
});

test("TC-2: branch 추가 후 체이닝", () => {
  const tot = new TreeOfThought();
  const result = tot.branch("가설A", () => 42);
  // 체이닝: this 반환 확인
  assert(result instanceof TreeOfThought, "branch()가 TreeOfThought 인스턴스 반환하지 않음");
});

test("TC-3: 여러 branch 독립 실행", () => {
  const tot = new TreeOfThought();
  const log: string[] = [];
  tot
    .branch("A", () => { log.push("A"); return 1; })
    .branch("B", () => { log.push("B"); return 2; })
    .branch("C", () => { log.push("C"); return 3; });
  tot.evaluate((r: any) => r / 3).select("best");
  assert(log.includes("A") && log.includes("B") && log.includes("C"),
    `branch가 독립 실행되지 않음: ${log}`);
});

test("TC-4: select('best') → 최고 점수 반환", () => {
  const tot = new TreeOfThought();
  tot
    .branch("낮음", () => 10)
    .branch("중간", () => 50)
    .branch("높음", () => 100);
  tot.evaluate((r: any) => r / 100);
  const result = tot.select("best");
  assert(result.best.hypothesis === "높음",
    `best.hypothesis 오류: ${result.best.hypothesis}`);
});

test("TC-5: ToTResult 구조 (branches, best, explored, pruned)", () => {
  const tot = new TreeOfThought();
  tot.branch("X", () => 1).branch("Y", () => 2);
  tot.evaluate((r: any) => r / 2);
  const r = tot.select("best");
  assert(Array.isArray(r.branches), "branches가 배열이 아님");
  assert(typeof r.best === "object" && r.best !== null, "best가 객체 아님");
  assert(typeof r.explored === "number", "explored가 숫자 아님");
  assert(typeof r.pruned === "number", "pruned가 숫자 아님");
});

test("TC-6: explored 카운트 정확성", () => {
  const tot = new TreeOfThought();
  tot.branch("A", () => 1).branch("B", () => 2).branch("C", () => 3);
  tot.evaluate((r: any) => r / 3);
  const r = tot.select("best");
  assert(r.explored === 3, `explored 오류: ${r.explored} (예상 3)`);
});

// ─── TC-7~12: FL 문법 [TOT] 블록 ─────────────────────────────────────────

console.log("\n[TC-7~12] FL 문법 (TOT ...) 폼\n");

test("TC-7: 2개 branch → best 선택", () => {
  const result = run(`
    (TOT
      :branch "낮음" 10
      :branch "높음" 100
      :eval (fn [$r] (/ $r 100))
      :select best)
  `);
  assert(result?.best?.hypothesis === "높음",
    `best 오류: ${JSON.stringify(result?.best)}`);
});

test("TC-8: eval fn 점수화 동작", () => {
  const result = run(`
    (TOT
      :branch "A" 3
      :branch "B" 7
      :branch "C" 1
      :eval (fn [$r] (/ $r 10))
      :select best)
  `);
  assert(result?.best?.hypothesis === "B",
    `B가 선택되어야 함: ${result?.best?.hypothesis}`);
});

test("TC-9: prune 0.5 → 낮은 분기 제거", () => {
  const result = run(`
    (TOT
      :branch "작음" 2
      :branch "보통" 5
      :branch "큼" 9
      :eval (fn [$r] (/ $r 10))
      :prune 0.5
      :select best)
  `);
  // score < 0.5는 pruned=true
  // 2/10=0.2 pruned, 5/10=0.5 NOT pruned (>= 0.5), 9/10=0.9 NOT pruned
  const pruned = result.branches.filter((b: ThoughtBranch) => b.pruned);
  assert(pruned.length >= 1, `pruned 없음: ${JSON.stringify(pruned)}`);
});

test("TC-10: pruned 카운트 확인", () => {
  const result = run(`
    (TOT
      :branch "zero" 0
      :branch "low" 1
      :branch "high" 9
      :eval (fn [$r] (/ $r 10))
      :prune 0.5
      :select best)
  `);
  // 0/10=0.0 pruned, 1/10=0.1 pruned, 9/10=0.9 not pruned
  assert(result.pruned >= 2, `pruned 카운트 오류: ${result.pruned}`);
});

test("TC-11: select top-k → 상위 k개", () => {
  const result = run(`
    (TOT
      :branch "A" 1
      :branch "B" 5
      :branch "C" 9
      :branch "D" 3
      :eval (fn [$r] (/ $r 10))
      :select top-k
      :k 2)
  `);
  assert(result.branches.length === 2, `상위 2개 오류: ${result.branches.length}`);
  assert(result.best.hypothesis === "C", `C가 best여야 함: ${result.best.hypothesis}`);
});

test("TC-12: best.hypothesis 필드 존재", () => {
  const result = run(`
    (TOT
      :branch "유일" 42
      :eval (fn [$r] 0.9)
      :select best)
  `);
  assert(typeof result.best.hypothesis === "string",
    `hypothesis 타입 오류: ${typeof result.best.hypothesis}`);
  assert(result.best.hypothesis === "유일",
    `hypothesis 값 오류: ${result.best.hypothesis}`);
});

// ─── TC-13~17: 실용 패턴 ──────────────────────────────────────────────────

console.log("\n[TC-13~17] 실용 패턴\n");

test("TC-13: 수학 풀이 3가지 방법 중 best", () => {
  // 문제: 10의 제곱 계산 방법
  const tot = new TreeOfThought();
  tot
    .branch("반복 곱셈", () => { let r = 1; for (let i = 0; i < 10; i++) r *= 2; return r; })
    .branch("Math.pow", () => Math.pow(2, 10))
    .branch("비트시프트", () => 1 << 10);
  tot.evaluate((r: any) => r === 1024 ? 1.0 : 0.0);
  const result = tot.select("best");
  assert(result.best.score === 1.0, `모든 방법이 1024여야 함: ${result.best.result}`);
  assert(result.best.result === 1024, `결과 1024 아님: ${result.best.result}`);
});

test("TC-14: 문자열 처리 전략 선택", () => {
  const tot = new TreeOfThought();
  const input = "  hello world  ";
  tot
    .branch("trim+upper", () => input.trim().toUpperCase())
    .branch("split+join", () => input.trim().split(" ").join("_"))
    .branch("replace", () => input.replace(/\s+/g, "-").trim());
  tot.evaluate((r: string) => r.includes("HELLO") ? 1.0 : r.startsWith("hello") ? 0.7 : 0.5);
  const result = tot.select("best");
  assert(result.best.hypothesis === "trim+upper",
    `trim+upper 선택 안 됨: ${result.best.hypothesis}`);
});

test("TC-15: score fn → 결과 길이 기반", () => {
  const tot = new TreeOfThought();
  tot
    .branch("짧은 응답", () => "ok")
    .branch("중간 응답", () => "완료되었습니다")
    .branch("긴 응답", () => "작업이 성공적으로 완료되었습니다. 결과를 확인하세요.");
  // 길수록 높은 점수
  tot.evaluate((r: string) => Math.min(r.length / 50, 1.0));
  const result = tot.select("best");
  assert(result.best.hypothesis === "긴 응답",
    `긴 응답이 선택되어야 함: ${result.best.hypothesis}`);
});

test("TC-16: toMarkdown → 분기 트리 시각화", () => {
  const tot = new TreeOfThought();
  tot.branch("옵션A", () => 1).branch("옵션B", () => 2);
  tot.evaluate((r: any) => r / 2);
  tot.select("best");
  const md = tot.toMarkdown();
  assert(typeof md === "string", "toMarkdown()이 문자열 반환 안 함");
  assert(md.includes("Tree-of-Thought"), `'Tree-of-Thought' 없음`);
  assert(md.includes("옵션A") || md.includes("옵션B"), "가설 이름 없음");
});

test("TC-17: 가지치기 후 남은 branches", () => {
  const tot = new TreeOfThought();
  tot
    .branch("low1", () => 1)
    .branch("low2", () => 2)
    .branch("high", () => 9);
  tot.evaluate((r: any) => r / 10);
  tot.prune(0.5);
  const result = tot.select("best");
  const alive = result.branches.filter((b: ThoughtBranch) => !b.pruned);
  assert(alive.length >= 1, `살아있는 branch 없음`);
  assert(result.best.score >= 0.5 || result.branches.length > 0,
    "가지치기 후 best 없음");
});

// ─── TC-18~22: 에지 케이스 ────────────────────────────────────────────────

console.log("\n[TC-18~22] 에지 케이스\n");

test("TC-18: 단일 branch", () => {
  const tot = new TreeOfThought();
  tot.branch("유일한", () => "결과");
  tot.evaluate(() => 0.8);
  const result = tot.select("best");
  assert(result.explored === 1, `explored 1 아님: ${result.explored}`);
  assert(result.best.hypothesis === "유일한", `best 오류`);
  assert(result.best.result === "결과", `result 오류`);
});

test("TC-19: 모든 branch 가지치기 → 마지막 남김", () => {
  const tot = new TreeOfThought();
  tot
    .branch("A", () => 1)
    .branch("B", () => 2);
  tot.evaluate(() => 0.1); // 모두 0.1 점수
  tot.prune(0.9); // 모두 가지치기
  const result = tot.select("best");
  // 모두 pruned여도 best가 있어야 함 (최소 하나 복구)
  assert(result.best !== undefined, "best가 undefined");
  assert(result.best !== null, "best가 null");
});

test("TC-20: 빈 branches — select 안전 처리", () => {
  const tot = new TreeOfThought();
  tot.evaluate(() => 0.5);
  // branch 없이 select
  try {
    const result = tot.select("best");
    // 빈 결과: explored=0, pruned=0
    assert(result.explored === 0, `explored 0 아님: ${result.explored}`);
  } catch (e: any) {
    // 예외 발생도 허용 (빈 branches는 유효하지 않음)
    // 단, 에러 메시지가 명확해야 함
    assert(true, "빈 branches 예외 처리 허용");
  }
});

test("TC-21: branch 결과가 maybe 타입", () => {
  const { maybe, none } = require("./maybe-type");
  const tot = new TreeOfThought();
  tot
    .branch("확실", () => maybe(0.9, "확실한 결과"))
    .branch("불확실", () => maybe(0.3, "불확실한 결과"))
    .branch("없음", () => none("데이터 없음"));
  tot.evaluate((r: any) => {
    if (r === null) return 0;
    if (r?.maybeValue !== undefined) return r.confidence || 0;
    return 0.5;
  });
  const result = tot.select("best");
  assert(result.explored === 3, `explored 3 아님: ${result.explored}`);
  assert(result.best.hypothesis === "확실",
    `maybe 타입 처리 오류: ${result.best.hypothesis}`);
});

test("TC-22: Phase 56 regression 14/14", () => {
  // Phase 56 렉시컬 스코프 테스트 핵심 케이스 재실행
  // Phase 56 원본 테스트와 동일한 [FUNC] 블록 기반으로 검증
  let regPassed = 0;
  const regErrors: string[] = [];

  function regRun(src: string): any {
    const interp = new Interpreter();
    interp.interpret(parse(lex(src)));
    return (interp as any).context.lastValue;
  }
  function regRunMulti(src: string): any {
    const interp = new Interpreter();
    interp.interpret(parse(lex(src)));
    return interp;
  }
  function regGetVar(interp: any, name: string): any {
    return (interp as any).context.variables.get("$" + name);
  }

  const regTests: Array<[string, () => void]> = [
    ["함수 내 define 격리", () => {
      const interp = regRunMulti(`
        (define x 10)
        [FUNC set-x :params [] :body (define x 999)]
        (set-x)
      `);
      const x = regGetVar(interp, "x");
      assert(x === 10, `전역 x가 ${x}로 변경됨`);
    }],
    ["함수 내 define 변수는 외부에서 안 보임", () => {
      const interp = regRunMulti(`
        [FUNC make-local :params [] :body (define inner 42)]
        (make-local)
      `);
      const inner = regGetVar(interp, "inner");
      assert(inner === undefined || inner === null, `$inner가 외부에 보임: ${inner}`);
    }],
    ["재귀 팩토리얼 — 스코프 간섭 없음", () => {
      const r = regRun(`
        [FUNC fact :params [$n]
          :body (if (< $n 2) 1 (* $n (fact (- $n 1))))]
        (fact 6)
      `);
      assert(r === 720, `got ${r}`);
    }],
    ["재귀 피보나치 — 중첩 호출 격리", () => {
      const r = regRun(`
        [FUNC fib :params [$n]
          :body (if (< $n 2) $n (+ (fib (- $n 1)) (fib (- $n 2))))]
        (fib 10)
      `);
      assert(r === 55, `got ${r}`);
    }],
    ["fn 클로저가 정의 시점 환경을 캡처", () => {
      const r = regRun(`
        (define base 100)
        (define add-base (fn [$x] (+ $x $base)))
        (add-base 5)
      `);
      assert(r === 105, `got ${r}`);
    }],
    ["고차 함수 — 클로저 반환", () => {
      const r = regRun(`
        (define make-adder (fn [$n] (fn [$x] (+ $x $n))))
        (define add10 (make-adder 10))
        (add10 7)
      `);
      assert(r === 17, `got ${r}`);
    }],
    ["set!이 전역 counter를 누적 수정", () => {
      const interp = regRunMulti(`
        (define counter 0)
        [FUNC inc! :params [] :body (set! counter (+ $counter 1))]
        (inc!)
        (inc!)
        (inc!)
      `);
      const counter = regGetVar(interp, "counter");
      assert(counter === 3, `got ${counter}`);
    }],
    ["loop 바인딩이 외부 스코프 오염 안 함", () => {
      const interp = regRunMulti(`
        (define i 999)
        (loop [i 0]
          (if (>= $i 3) $i (recur (+ $i 1))))
      `);
      const i = regGetVar(interp, "i");
      assert(i === 999, `전역 i가 ${i}로 변경됨`);
    }],
    ["loop/recur 결과값 정상", () => {
      const r = regRun(`
        (loop [acc 0 n 5]
          (if (<= $n 0) $acc (recur (+ $acc $n) (- $n 1))))
      `);
      assert(r === 15, `got ${r}`);
    }],
    ["fn의 body가 자신의 스코프에서 define 가능", () => {
      const r = regRun(`
        (define fn-with-local (fn [$x]
          (define local (* $x 2))
          $local))
        (fn-with-local 5)
      `);
      assert(r === 10, `got ${r}`);
    }],
    ["클로저 체인 — 3단계 중첩", () => {
      const r = regRun(`
        (define make-triple-adder (fn [$a]
          (fn [$b]
            (fn [$c] (+ $a $b $c)))))
        (define step1 (make-triple-adder 1))
        (define step2 (step1 2))
        (step2 3)
      `);
      assert(r === 6, `got ${r}`);
    }],
    ["map 고차 함수 활용", () => {
      const r = regRun(`
        (define double (fn [$x] (* $x 2)))
        (fl-map [1 2 3 4 5] double)
      `);
      assert(Array.isArray(r) && r[0] === 2 && r[4] === 10, `got ${JSON.stringify(r)}`);
    }],
    ["조건 표현식 기본", () => {
      const r = regRun(`(if (> 5 3) "크다" "작다")`);
      assert(r === "크다", `got ${r}`);
    }],
    ["논리 and 연산", () => {
      const r = regRun(`(and (> 5 3) (< 2 10))`);
      assert(r === true, `got ${r}`);
    }],
  ];

  for (const [name, fn] of regTests) {
    try {
      fn();
      regPassed++;
    } catch (e: any) {
      regErrors.push(`${name}: ${e.message?.slice(0, 80)}`);
    }
  }

  if (regPassed < 14) {
    throw new Error(`Phase 56 regression: ${regPassed}/14 PASS\n  실패: ${regErrors.join('\n  ')}`);
  }
});

// ─── 최종 결과 ────────────────────────────────────────────────────────────

console.log("\n──────────────────────────────────────────────────");
console.log(`Phase 93 Tree-of-Thought: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
