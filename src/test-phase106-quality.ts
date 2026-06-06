// FreeLang v9: Phase 106 — 자동 품질 평가 루프 테스트
// evaluateQuality / qualityLoop / 내장 함수 검증

import {
  evaluateQuality,
  qualityLoop,
  defaultCriteria,
  QualityCriterion,
} from "./quality-loop";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result && typeof (result as any).then === "function") {
    return (result as Promise<void>)
      .then(() => {
        console.log(`  ✅ ${name}`);
        passed++;
      })
      .catch((e: any) => {
        console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
        failed++;
      });
  }
  try {
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function assert(cond: boolean, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

function run(src: string): any {
  const interp = new Interpreter();
  interp.interpret(parse(lex(src)));
  return (interp as any).context.lastValue;
}

async function main() {
  console.log("\n=== Phase 106: 자동 품질 평가 루프 ===\n");

  // --- 1. evaluateQuality() 기본 동작 ---
  await test("1. evaluateQuality() 기본 동작", () => {
    const result = evaluateQuality("Hello World!", defaultCriteria, 0.7);
    assert(typeof result.score === "number", "score는 숫자여야 함");
    assert(typeof result.passed === "boolean", "passed는 boolean이어야 함");
    assert(typeof result.breakdown === "object", "breakdown은 객체여야 함");
    assert(Array.isArray(result.feedback), "feedback은 배열이어야 함");
  });

  // --- 2. 단일 기준 평가 ---
  await test("2. 단일 기준 평가", () => {
    const criteria: QualityCriterion[] = [
      { name: "test-c", weight: 1.0, evaluate: () => 0.9 }
    ];
    const result = evaluateQuality("anything", criteria, 0.7);
    assert(Math.abs(result.score - 0.9) < 0.001, `score=0.9 expected, got ${result.score}`);
  });

  // --- 3. 가중 평균 계산 ---
  await test("3. 가중 평균 계산", () => {
    const criteria: QualityCriterion[] = [
      { name: "c1", weight: 0.6, evaluate: () => 1.0 },
      { name: "c2", weight: 0.4, evaluate: () => 0.5 },
    ];
    const result = evaluateQuality("x", criteria, 0.7);
    // 가중 평균: (1.0*0.6 + 0.5*0.4) / 1.0 = 0.8
    assert(Math.abs(result.score - 0.8) < 0.001, `score=0.8 expected, got ${result.score}`);
  });

  // --- 4. threshold 초과 → passed=true ---
  await test("4. threshold 초과 → passed=true", () => {
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.9 }
    ];
    const result = evaluateQuality("test", criteria, 0.7);
    assert(result.passed === true, "0.9 >= 0.7 이므로 passed=true");
  });

  // --- 5. threshold 미달 → passed=false ---
  await test("5. threshold 미달 → passed=false", () => {
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.5 }
    ];
    const result = evaluateQuality("test", criteria, 0.7);
    assert(result.passed === false, "0.5 < 0.7 이므로 passed=false");
  });

  // --- 6. breakdown 딕셔너리 확인 ---
  await test("6. breakdown 딕셔너리 확인", () => {
    const criteria: QualityCriterion[] = [
      { name: "alpha", weight: 0.5, evaluate: () => 0.8 },
      { name: "beta", weight: 0.5, evaluate: () => 0.6 },
    ];
    const result = evaluateQuality("test", criteria, 0.7);
    assert(result.breakdown["alpha"] === 0.8, "alpha=0.8");
    assert(result.breakdown["beta"] === 0.6, "beta=0.6");
  });

  // --- 7. feedback 배열 확인 ---
  await test("7. feedback 배열 확인", () => {
    const criteria: QualityCriterion[] = [
      { name: "mycheck", weight: 1.0, evaluate: () => 0.3 }
    ];
    const result = evaluateQuality("test", criteria, 0.7);
    assert(result.feedback.length > 0, "feedback에 미달 항목 있어야 함");
    assert(result.feedback[0].includes("mycheck"), "feedback에 기준 이름 포함");
    assert(result.feedback[0].includes("기준 미달"), "feedback에 '기준 미달' 포함");
  });

  // --- 8. weight=0 기준 무시 ---
  await test("8. weight=0 기준은 점수에 영향 없음", () => {
    const criteria: QualityCriterion[] = [
      { name: "main", weight: 1.0, evaluate: () => 0.8 },
      { name: "zero-weight", weight: 0.0, evaluate: () => 0.0 },
    ];
    const result = evaluateQuality("test", criteria, 0.7);
    // zero-weight 기준이 0점이어도 main(0.8)만 실질 반영
    // totalWeight=1.0, weightedScore=0.8*1.0+0.0*0.0=0.8
    assert(Math.abs(result.score - 0.8) < 0.001, `score=0.8 expected, got ${result.score}`);
  });

  // --- 9. score 범위 0~1 보장 ---
  await test("9. score 범위 0~1 보장", () => {
    const criteria: QualityCriterion[] = [
      { name: "overflow", weight: 1.0, evaluate: () => 999 },
      { name: "underflow", weight: 1.0, evaluate: () => -999 },
    ];
    // overflow → clamp to 1, underflow → clamp to 0
    const r1 = evaluateQuality("test", [criteria[0]], 0.7);
    const r2 = evaluateQuality("test", [criteria[1]], 0.7);
    assert(r1.score <= 1.0, "최대 1.0");
    assert(r2.score >= 0.0, "최소 0.0");
  });

  // --- 10. qualityLoop() 1라운드 성공 ---
  await test("10. qualityLoop() 1라운드 성공", async () => {
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.9 }
    ];
    const result = await qualityLoop({
      generate: () => "good output",
      criteria,
      threshold: 0.7,
      maxRounds: 3,
    });
    assert(result.rounds === 1, `1라운드여야 함, got ${result.rounds}`);
    assert(result.passed === true, "passed=true");
    assert(result.output === "good output", "출력 확인");
  });

  // --- 11. qualityLoop() 2라운드 후 성공 ---
  await test("11. qualityLoop() 2라운드 후 성공", async () => {
    let callCount = 0;
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: (v) => v === "better" ? 0.9 : 0.3 }
    ];
    const result = await qualityLoop({
      generate: (round) => {
        callCount++;
        return round >= 2 ? "better" : "bad";
      },
      criteria,
      threshold: 0.7,
      maxRounds: 5,
    });
    assert(result.rounds === 2, `2라운드여야 함, got ${result.rounds}`);
    assert(result.passed === true, "passed=true");
    assert(result.output === "better", "출력 확인");
  });

  // --- 12. qualityLoop() maxRounds 도달 ---
  await test("12. qualityLoop() maxRounds 도달", async () => {
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.3 }  // 항상 실패
    ];
    const result = await qualityLoop({
      generate: () => "always-bad",
      criteria,
      threshold: 0.7,
      maxRounds: 3,
    });
    assert(result.rounds === 3, `3라운드여야 함, got ${result.rounds}`);
    assert(result.passed === false, "passed=false");
  });

  // --- 13. history 기록 확인 ---
  await test("13. history 기록 확인", async () => {
    let round = 0;
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: (v) => v === "final" ? 0.9 : 0.3 }
    ];
    const result = await qualityLoop({
      generate: (r) => {
        round = r;
        return r >= 3 ? "final" : `round-${r}`;
      },
      criteria,
      threshold: 0.7,
      maxRounds: 5,
    });
    assert(result.history.length === 3, `history에 3개 항목, got ${result.history.length}`);
    assert(result.history[0].round === 1, "첫 번째 history round=1");
    assert(result.history[2].round === 3, "세 번째 history round=3");
    assert(result.history[2].output === "final", "세 번째 output=final");
  });

  // --- 14. generate에 round 번호 전달 ---
  await test("14. generate에 round 번호 전달", async () => {
    const rounds: number[] = [];
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.3 }
    ];
    await qualityLoop({
      generate: (r) => { rounds.push(r); return "x"; },
      criteria,
      threshold: 0.7,
      maxRounds: 3,
    });
    assert(rounds.length === 3, "3번 호출");
    assert(rounds[0] === 1, "첫 round=1");
    assert(rounds[1] === 2, "두 번째 round=2");
    assert(rounds[2] === 3, "세 번째 round=3");
  });

  // --- 15. generate에 prevOutput 전달 ---
  await test("15. generate에 prevOutput 전달", async () => {
    const prevOutputs: any[] = [];
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.3 }
    ];
    await qualityLoop({
      generate: (r, prevOut) => {
        prevOutputs.push(prevOut);
        return `output-${r}`;
      },
      criteria,
      threshold: 0.7,
      maxRounds: 3,
    });
    assert(prevOutputs[0] === undefined, "첫 라운드 prevOutput=undefined");
    assert(prevOutputs[1] === "output-1", "두 번째 prevOutput=output-1");
    assert(prevOutputs[2] === "output-2", "세 번째 prevOutput=output-2");
  });

  // --- 16. generate에 prevResult 전달 ---
  await test("16. generate에 prevResult 전달", async () => {
    const prevResults: any[] = [];
    const criteria: QualityCriterion[] = [
      { name: "c", weight: 1.0, evaluate: () => 0.4 }
    ];
    await qualityLoop({
      generate: (r, _prevOut, prevRes) => {
        prevResults.push(prevRes);
        return "x";
      },
      criteria,
      threshold: 0.7,
      maxRounds: 3,
    });
    assert(prevResults[0] === undefined, "첫 라운드 prevResult=undefined");
    assert(prevResults[1] !== undefined, "두 번째 prevResult 있음");
    assert(typeof prevResults[1].score === "number", "prevResult.score는 숫자");
    assert(prevResults[1].passed === false, "prevResult.passed=false");
  });

  // --- 17. defaultCriteria length 기준 ---
  await test("17. defaultCriteria length 기준 — 짧은 문자열", () => {
    const lengthCrit = defaultCriteria.find(c => c.name === 'length')!;
    const short = lengthCrit.evaluate("hi");      // < 10자
    const medium = lengthCrit.evaluate("hello world"); // 11자 < 50
    const long = lengthCrit.evaluate("a".repeat(60));  // >= 50
    assert(short < 0.5, `짧은 문자열 score=${short} < 0.5`);
    assert(medium >= 0.5 && medium < 1.0, `중간 문자열 score=${medium}`);
    assert(long === 1.0, `긴 문자열 score=${long} = 1.0`);
  });

  // --- 18. defaultCriteria non-empty 기준 ---
  await test("18. defaultCriteria non-empty 기준", () => {
    const nonEmptyCrit = defaultCriteria.find(c => c.name === 'non-empty')!;
    assert(nonEmptyCrit.evaluate("hello") === 1.0, "비어있지 않음 → 1.0");
    assert(nonEmptyCrit.evaluate(null) === 0.0, "null → 0.0");
    assert(nonEmptyCrit.evaluate(undefined) === 0.0, "undefined → 0.0");
    assert(nonEmptyCrit.evaluate("") === 0.0, "빈 문자열 → 0.0");
  });

  // --- 19. defaultCriteria no-error 기준 ---
  await test("19. defaultCriteria no-error 기준", () => {
    const noErrCrit = defaultCriteria.find(c => c.name === 'no-error')!;
    assert(noErrCrit.evaluate("ok") === 1.0, "정상값 → 1.0");
    assert(noErrCrit.evaluate(new Error("oops")) === 0.0, "Error 인스턴스 → 0.0");
    assert(noErrCrit.evaluate({ _tag: "Err", message: "fail" }) === 0.0, "Err 태그 → 0.0");
    assert(noErrCrit.evaluate(42) === 1.0, "숫자 → 1.0");
  });

  // --- 20. 빈 문자열 → non-empty 실패 ---
  await test("20. 빈 문자열 → non-empty 실패 → 낮은 점수", () => {
    const result = evaluateQuality("", defaultCriteria, 0.7);
    // non-empty=0, length=0.3 (빈 문자열 = 0자 < 10), no-error=1.0
    // 가중: (0.3*0 + 0.4*0 + 0.3*1.0) / 1.0 = 0.3
    assert(result.passed === false, "빈 문자열은 passed=false");
    assert(result.score < 0.7, `score=${result.score} < 0.7`);
  });

  // --- 21. 짧은 문자열 → length 낮은 점수 ---
  await test("21. 짧은 문자열 → length 낮은 점수", () => {
    const result = evaluateQuality("hi", defaultCriteria, 0.9);
    // length=0.3 (2자 < 10), non-empty=1.0, no-error=1.0
    // 가중: (0.3*0.3 + 0.4*1.0 + 0.3*1.0) / 1.0 = 0.09+0.4+0.3 = 0.79
    assert(result.breakdown["length"] === 0.3, `length 점수=${result.breakdown["length"]}`);
  });

  // --- 22. quality-check 내장함수 ---
  await test("22. quality-check 내장함수", () => {
    // 긴 비-에러 문자열은 높은 점수
    const score = run(`(quality-check "This is a sufficiently long string for testing purposes")`);
    assert(typeof score === "number", `score는 숫자여야 함: ${score}`);
    assert(score >= 0 && score <= 1, `score 0~1 범위: ${score}`);
    assert(score > 0.7, `긴 문자열 score > 0.7: ${score}`);
  });

  // --- 23. quality-passed? 내장함수 ---
  await test("23. quality-passed? 내장함수", () => {
    const passFull = run(`(quality-passed? "This is a sufficiently long string for quality testing")`);
    const failEmpty = run(`(quality-passed? "")`);
    assert(passFull === true, `긴 문자열 passed=true: ${passFull}`);
    assert(failEmpty === false, `빈 문자열 passed=false: ${failEmpty}`);
  });

  // --- 24. quality-feedback 내장함수 ---
  await test("24. quality-feedback 내장함수", () => {
    const feedback = run(`(quality-feedback "")`);
    assert(Array.isArray(feedback), "feedback은 배열이어야 함");
    // 빈 문자열은 non-empty 실패, length 실패 → 피드백 있어야 함
    assert(feedback.length > 0, `빈 문자열은 피드백 있어야 함, got ${feedback.length}`);
  });

  // --- 25. 통합: generate → check → loop ---
  await test("25. 통합: generate → check → loop", async () => {
    const attempts: string[] = [];
    const criteria: QualityCriterion[] = [
      {
        name: "has-keyword",
        weight: 0.5,
        evaluate: (v) => String(v).includes("quality") ? 1.0 : 0.0
      },
      {
        name: "length",
        weight: 0.5,
        evaluate: (v) => String(v).length >= 20 ? 1.0 : 0.3
      }
    ];

    const result = await qualityLoop({
      generate: (round, _prev, prevResult) => {
        let output: string;
        if (round === 1) {
          output = "short";
        } else if (round === 2) {
          output = "This is a longer string";
        } else {
          output = "This has quality and is long enough for sure";
        }
        attempts.push(output);
        return output;
      },
      criteria,
      threshold: 0.7,
      maxRounds: 5,
    });

    assert(attempts.length >= 1, "최소 1번 generate 호출");
    assert(result.passed === true, `통합 테스트 passed=true, score=${result.finalScore}`);
    assert(String(result.output).includes("quality"), "최종 출력에 keyword 포함");
    // 히스토리에 score 기록
    assert(result.history.every(h => typeof h.score === "number"), "history 모두 score 있음");
  });

  // 결과 출력
  console.log(`\n총 결과: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error("테스트 오류:", e);
  process.exit(1);
});
