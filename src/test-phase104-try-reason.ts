// FreeLang v9: Phase 104 — TRY-REASON 실패 복구 추론
// TryReasoner 클래스 + tryReasonSync + eval-builtins (try-reason, try-with-fallback)
// 최소 25개 PASS

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import {
  TryReasoner,
  tryReasonSync,
  tryReasonBuiltin,
  tryWithFallback,
} from "./try-reason";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = (() => {
    try {
      const r = fn();
      if (r instanceof Promise) {
        return r.then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        }).catch((e: any) => {
          console.log(`  ❌ ${name}: ${e.message}`);
          failed++;
        });
      } else {
        console.log(`  ✅ ${name}`);
        passed++;
      }
    } catch (e: any) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  })();
  return result;
}

function assert(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg ?? "assertion failed");
}

function assertEqual(a: any, b: any, msg?: string) {
  if (a !== b) throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function evalFL(interp: Interpreter, code: string): any {
  const tokens = lex(code);
  const ast = parse(tokens);
  let result: any;
  for (const node of ast) {
    result = (interp as any).eval(node);
  }
  return result;
}

async function runAllTests() {
  // ────────────────────────────────────────────
  // Part 1: TryReasoner 클래스 직접 테스트
  // ────────────────────────────────────────────
  console.log("\n[Part 1] TryReasoner 클래스 직접 테스트");

  // 1. TryReasoner 생성
  await test("TryReasoner 생성", () => {
    const r = new TryReasoner<number>();
    assert(r !== null, "TryReasoner 생성 실패");
    assert(typeof r.run === "function", "run 메서드 없음");
    assert(typeof r.getHistory === "function", "getHistory 메서드 없음");
    assert(typeof r.lastSuccess === "function", "lastSuccess 메서드 없음");
  });

  // 2. 첫 번째 시도 성공
  await test("첫 번째 시도 성공", async () => {
    const r = new TryReasoner<number>();
    const result = await r.run({
      attempts: [
        { strategy: "primary", fn: () => 42 },
        { strategy: "secondary", fn: () => 99 },
      ],
    });
    assertEqual(result, 42, "첫 번째 시도 결과 틀림");
  });

  // 3. 첫 번째 실패, 두 번째 성공
  await test("첫 번째 실패, 두 번째 성공", async () => {
    const r = new TryReasoner<string>();
    const result = await r.run({
      attempts: [
        { strategy: "fail-first", fn: () => { throw new Error("실패"); return ""; } },
        { strategy: "succeed-second", fn: () => "success" },
      ],
    });
    assertEqual(result, "success", "두 번째 시도 결과 틀림");
  });

  // 4. 모두 실패 → onAllFail 호출
  await test("모두 실패 → onAllFail 호출", async () => {
    const r = new TryReasoner<string>();
    const result = await r.run({
      attempts: [
        { strategy: "a", fn: () => { throw new Error("err-a"); return ""; } },
        { strategy: "b", fn: () => { throw new Error("err-b"); return ""; } },
      ],
      onAllFail: (errors) => `fallback: ${errors.length} errors`,
    });
    assert(result.startsWith("fallback:"), "onAllFail 미호출");
  });

  // 5. 모두 실패 + onAllFail 없음 → throw
  await test("모두 실패 + onAllFail 없음 → throw", async () => {
    const r = new TryReasoner<number>();
    let threw = false;
    try {
      await r.run({
        attempts: [
          { strategy: "x", fn: () => { throw new Error("boom"); return 0; } },
        ],
      });
    } catch {
      threw = true;
    }
    assert(threw, "throw가 발생하지 않음");
  });

  // 6. validate 함수로 성공 검증
  await test("validate 함수로 성공 검증", async () => {
    const r = new TryReasoner<number>();
    const result = await r.run({
      attempts: [
        { strategy: "validated", fn: () => 10, validate: (v) => v > 5 },
      ],
    });
    assertEqual(result, 10, "validate 통과 실패");
  });

  // 7. validate 실패 → 다음 시도
  await test("validate 실패 → 다음 시도", async () => {
    const r = new TryReasoner<number>();
    const result = await r.run({
      attempts: [
        { strategy: "too-small", fn: () => 1, validate: (v) => v > 5 },
        { strategy: "big-enough", fn: () => 10, validate: (v) => v > 5 },
      ],
    });
    assertEqual(result, 10, "validate 실패 후 다음 시도 안됨");
  });

  // 8. onSuccess 콜백 호출
  await test("onSuccess 콜백 호출", async () => {
    const r = new TryReasoner<string>();
    let callbackCalled = false;
    let callbackStrategy = "";
    await r.run({
      attempts: [{ strategy: "ok-strategy", fn: () => "done" }],
      onSuccess: (val, strat, num) => {
        callbackCalled = true;
        callbackStrategy = strat;
      },
    });
    assert(callbackCalled, "onSuccess 콜백 미호출");
    assertEqual(callbackStrategy, "ok-strategy", "strategy 이름 틀림");
  });

  // 9. getHistory() 기록 확인
  await test("getHistory() 기록 확인", async () => {
    const r = new TryReasoner<number>();
    await r.run({
      attempts: [
        { strategy: "fail", fn: () => { throw new Error("e"); return 0; } },
        { strategy: "pass", fn: () => 7 },
      ],
      onAllFail: () => -1,
    });
    const history = r.getHistory();
    assert(history.length === 2, `히스토리 길이 틀림: ${history.length}`);
    assert(history[0].success === false, "첫 항목이 실패가 아님");
    assert(history[1].success === true, "두 번째 항목이 성공이 아님");
  });

  // 10. lastSuccess() 마지막 성공
  await test("lastSuccess() 마지막 성공", async () => {
    const r = new TryReasoner<number>();
    await r.run({
      attempts: [
        { strategy: "fail", fn: () => { throw new Error("e"); return 0; } },
        { strategy: "win", fn: () => 99 },
      ],
    });
    const ls = r.lastSuccess();
    assert(ls !== null, "lastSuccess null 반환");
    assert(ls!.success === true, "lastSuccess 성공이 아님");
    assertEqual((ls as any).value, 99, "lastSuccess 값 틀림");
    assertEqual(ls!.strategy, "win", "strategy 틀림");
  });

  // 11. 시도 순서 보장
  await test("시도 순서 보장", async () => {
    const order: string[] = [];
    const r = new TryReasoner<number>();
    await r.run({
      attempts: [
        { strategy: "first", fn: () => { order.push("first"); throw new Error("e"); return 0; } },
        { strategy: "second", fn: () => { order.push("second"); throw new Error("e"); return 0; } },
        { strategy: "third", fn: () => { order.push("third"); return 1; } },
      ],
    });
    assertEqual(order.join(","), "first,second,third", "순서 틀림");
  });

  // 12. tryReasonSync() 동기 버전
  await test("tryReasonSync() 동기 버전 존재", () => {
    assert(typeof tryReasonSync === "function", "tryReasonSync 없음");
  });

  // 13. tryReasonSync() 첫 성공
  await test("tryReasonSync() 첫 성공", () => {
    const result = tryReasonSync<number>({
      attempts: [
        { strategy: "s1", fn: () => 42 },
        { strategy: "s2", fn: () => 99 },
      ],
    });
    assertEqual(result, 42, "첫 성공 값 틀림");
  });

  // 14. tryReasonSync() 두 번째 성공
  await test("tryReasonSync() 두 번째 성공", () => {
    const result = tryReasonSync<number>({
      attempts: [
        { strategy: "fail", fn: (() => { throw new Error("no"); }) as any },
        { strategy: "win", fn: () => 77 },
      ],
    });
    assertEqual(result, 77, "두 번째 성공 값 틀림");
  });

  // 15. tryReasonSync() 모두 실패 → onAllFail
  await test("tryReasonSync() 모두 실패 → onAllFail", () => {
    const result = tryReasonSync<string>({
      attempts: [
        { strategy: "x", fn: (() => { throw new Error("err"); }) as any },
      ],
      onAllFail: (errors) => `fallback-sync:${errors.length}`,
    });
    assert(result.startsWith("fallback-sync:"), "onAllFail 미호출");
  });

  // 16. 에러 메시지에 strategy 이름 포함
  await test("에러 메시지에 strategy 이름 포함", async () => {
    const r = new TryReasoner<number>();
    let errorMsg = "";
    try {
      await r.run({
        attempts: [
          { strategy: "my-unique-strategy", fn: () => { throw new Error("oops"); return 0; } },
        ],
      });
    } catch (e: any) {
      errorMsg = e.message;
    }
    assert(errorMsg.includes("my-unique-strategy"), `에러 메시지에 strategy 없음: ${errorMsg}`);
  });

  // 17. attempt 번호 기록
  await test("attempt 번호 기록", async () => {
    const r = new TryReasoner<number>();
    await r.run({
      attempts: [
        { strategy: "a1", fn: () => { throw new Error("e"); return 0; } },
        { strategy: "a2", fn: () => 5 },
      ],
    });
    const history = r.getHistory();
    assertEqual(history[0].attempt, 1, "첫 attempt 번호 틀림");
    assertEqual(history[1].attempt, 2, "두 번째 attempt 번호 틀림");
  });

  // 18. 빈 attempts → 즉시 실패
  await test("빈 attempts → 즉시 실패", async () => {
    const r = new TryReasoner<number>();
    let threw = false;
    try {
      await r.run({ attempts: [] });
    } catch {
      threw = true;
    }
    assert(threw, "빈 attempts에서 throw 안됨");
  });

  // 19. async fn 지원
  await test("async fn 지원", async () => {
    const r = new TryReasoner<string>();
    const result = await r.run({
      attempts: [
        {
          strategy: "async-strategy",
          fn: async () => {
            await new Promise((res) => setTimeout(res, 5));
            return "async-result";
          },
        },
      ],
    });
    assertEqual(result, "async-result", "async fn 결과 틀림");
  });

  // ────────────────────────────────────────────
  // Part 2: eval-builtins 내장함수 테스트
  // ────────────────────────────────────────────
  console.log("\n[Part 2] 내장함수 (try-reason, try-with-fallback) 테스트");

  // 20. try-reason 내장함수
  await test("try-reason 내장함수", async () => {
    const result = await tryReasonBuiltin([
      ["primary", () => "hello"],
      ["secondary", () => "world"],
    ]);
    assertEqual(result, "hello", "try-reason 첫 성공 실패");
  });

  // 21. try-with-fallback 성공 케이스
  await test("try-with-fallback 성공 케이스", async () => {
    const result = await tryWithFallback(() => 123, 999);
    assertEqual(result, 123, "try-with-fallback 성공 값 틀림");
  });

  // 22. try-with-fallback 실패 → fallback
  await test("try-with-fallback 실패 → fallback", async () => {
    const result = await tryWithFallback(
      () => { throw new Error("fail"); return 0; },
      999
    );
    assertEqual(result, 999, "fallback 값 틀림");
  });

  // 23. 통합: 3단계 복구 전략
  await test("통합: 3단계 복구 전략", async () => {
    const r = new TryReasoner<string>();
    let attempts = 0;
    const result = await r.run({
      attempts: [
        { strategy: "api-call", fn: () => { attempts++; throw new Error("network error"); return ""; } },
        { strategy: "cache", fn: () => { attempts++; throw new Error("cache miss"); return ""; } },
        { strategy: "default", fn: () => { attempts++; return "default-response"; } },
      ],
    });
    assertEqual(result, "default-response", "3단계 복구 실패");
    assertEqual(attempts, 3, "attempts 횟수 틀림");
  });

  // 24. history에 실패 기록
  await test("history에 실패 기록", async () => {
    const r = new TryReasoner<number>();
    await r.run({
      attempts: [
        { strategy: "fail1", fn: () => { throw new Error("err1"); return 0; } },
        { strategy: "fail2", fn: () => { throw new Error("err2"); return 0; } },
        { strategy: "ok", fn: () => 1 },
      ],
    });
    const history = r.getHistory();
    const failures = history.filter(h => !h.success);
    assertEqual(failures.length, 2, `실패 기록 수 틀림: ${failures.length}`);
    assert(failures[0].strategy === "fail1", "첫 실패 strategy 틀림");
    assert(failures[1].strategy === "fail2", "두 번째 실패 strategy 틀림");
  });

  // 25. success: true/false 구분
  await test("success: true/false 구분", async () => {
    const r = new TryReasoner<number>();
    await r.run({
      attempts: [
        { strategy: "fail", fn: () => { throw new Error("e"); return 0; } },
        { strategy: "pass", fn: () => 42 },
      ],
    });
    const history = r.getHistory();
    assert(history.some(h => h.success === false), "success:false 없음");
    assert(history.some(h => h.success === true), "success:true 없음");
    const successEntry = history.find(h => h.success === true);
    assert(successEntry !== undefined, "success entry 없음");
    assertEqual((successEntry as any).value, 42, "success 값 틀림");
  });

  // ────────────────────────────────────────────
  // 추가 테스트 (26~28)
  // ────────────────────────────────────────────
  console.log("\n[Part 3] 추가 테스트");

  // 26. validate 실패 + onAllFail
  await test("validate 실패 + onAllFail 조합", async () => {
    const r = new TryReasoner<number>();
    const result = await r.run({
      attempts: [
        { strategy: "bad-value", fn: () => 1, validate: (v) => v > 100 },
        { strategy: "also-bad", fn: () => 2, validate: (v) => v > 100 },
      ],
      onAllFail: (errors) => -999,
    });
    assertEqual(result, -999, "onAllFail 미반환");
  });

  // 27. async fn 실패 → 다음 시도
  await test("async fn 실패 → 다음 시도", async () => {
    const r = new TryReasoner<string>();
    const result = await r.run({
      attempts: [
        {
          strategy: "async-fail",
          fn: async () => {
            await new Promise((res) => setTimeout(res, 1));
            throw new Error("async error");
            return "";
          },
        },
        {
          strategy: "async-ok",
          fn: async () => {
            await new Promise((res) => setTimeout(res, 1));
            return "async-success";
          },
        },
      ],
    });
    assertEqual(result, "async-success", "async 실패 후 다음 시도 안됨");
  });

  // 28. tryWithFallback async fn
  await test("tryWithFallback async fn 지원", async () => {
    const result = await tryWithFallback(
      async () => {
        await new Promise((res) => setTimeout(res, 1));
        return "async-val";
      },
      "fallback"
    );
    assertEqual(result, "async-val", "async tryWithFallback 결과 틀림");
  });

  // ────────────────────────────────────────────
  // 결과 요약
  // ────────────────────────────────────────────
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Phase 104 결과: ${passed} PASS / ${failed} FAIL`);
  if (failed > 0) {
    console.log("❌ 일부 테스트 실패");
    process.exit(1);
  } else {
    console.log("✅ 모든 테스트 통과!");
  }
}

runAllTests().catch((e) => {
  console.error("치명적 오류:", e);
  process.exit(1);
});
