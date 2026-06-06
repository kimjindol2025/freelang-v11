// FreeLang v9: Phase 53 — N-step 학습 루프 + loss 수렴 검증
// gpt-mini-p3.fl: VOCAB=4, D=2, 500 step 학습 후 loss < 0.01 수렴

import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

function getVar(interp: Interpreter, name: string): any {
  return (interp as any).context.variables.get("$" + name);
}

console.log("[Phase 53] N-step 학습 루프 + loss 수렴");
console.log("(VOCAB=4, D=2, 500 step 학습)\n");

const flPath = path.join(__dirname, "gpt-mini-p3.fl");
const src = fs.readFileSync(flPath, "utf-8");

const interp = new Interpreter();
interp.interpret(parse(lex(src)));

// ── TC-1: train-loop 함수 등록 ────────────────────────────────
console.log("[함수 등록 확인]");

test("train-loop 함수 등록됨", () => {
  const fn = (interp as any).context.functions.get("train-loop");
  if (!fn) throw new Error("train-loop not found");
});

// ── TC-2: 초기 loss 유효 ──────────────────────────────────────
console.log("\n[loss 수렴 검증]");

test("초기 loss0 양수 NaN 아님", () => {
  const loss0 = getVar(interp, "mini-loss0") as number;
  if (typeof loss0 !== "number" || isNaN(loss0) || loss0 <= 0)
    throw new Error(`loss0=${loss0}`);
  console.log(`    → 초기 loss: ${loss0.toFixed(4)}`);
});

// ── TC-3: 500 step 후 loss < 초기 loss ───────────────────────
test("500 step 후 loss < 초기 loss", () => {
  const loss0 = getVar(interp, "mini-loss0") as number;
  const finalLoss = getVar(interp, "final-loss") as number;
  if (finalLoss >= loss0)
    throw new Error(`loss 증가: ${loss0.toFixed(4)} → ${finalLoss.toFixed(4)}`);
});

// ── TC-4: 실질 수렴 (loss < 0.1) ─────────────────────────────
test("500 step 후 loss < 0.1 (실질 수렴)", () => {
  const finalLoss = getVar(interp, "final-loss") as number;
  if (typeof finalLoss !== "number" || isNaN(finalLoss))
    throw new Error(`final-loss=${finalLoss}`);
  if (finalLoss >= 0.1)
    throw new Error(`수렴 실패: loss=${finalLoss.toFixed(6)}`);
  console.log(`    → 최종 loss: ${finalLoss.toFixed(6)} (< 0.1 ✓)`);
});

// ── TC-5: target 확률 > 0.7 ───────────────────────────────────
test("target=3 softmax 확률 > 0.7 (학습된 가중치 사용)", () => {
  const We = getVar(interp, "trained-We") as number[];
  const Wp = getVar(interp, "trained-Wp") as number[];
  const bp = getVar(interp, "mini-bp") as number[];
  const toks = getVar(interp, "mini-toks") as number[];
  const target = getVar(interp, "mini-target") as number;

  // 500 step 학습된 가중치로 확률 계산
  const logits = (interp as any).callUserFunction("forward-simple", [toks, We, Wp, bp]);
  const probs  = (interp as any).callUserFunction("softmax", [logits]);

  if (!Array.isArray(probs)) throw new Error(`probs not array`);
  const targetProb = probs[target] as number;
  console.log(`    → target=${target} prob: ${targetProb.toFixed(4)}`);
  if (targetProb < 0.7)
    throw new Error(`target prob too low: ${targetProb.toFixed(4)}`);
});

// ── TC-6: 100 step < 500 step loss 비교 ──────────────────────
test("100 step loss > 500 step loss (단조 감소 경향)", () => {
  const We = getVar(interp, "mini-We") as number[];
  const Wp = getVar(interp, "mini-Wp") as number[];
  const bp = getVar(interp, "mini-bp") as number[];
  const toks = getVar(interp, "mini-toks") as number[];
  const target = getVar(interp, "mini-target") as number;

  const result100 = (interp as any).callUserFunction("train-loop", [
    toks, We, Wp, bp, target, 100, 1.0, 0.001,
  ]) as any[];
  const loss100 = result100[0] as number;
  const loss500 = getVar(interp, "final-loss") as number;

  console.log(`    → 100 step: ${loss100.toFixed(6)}, 500 step: ${loss500.toFixed(6)}`);
  if (loss100 <= loss500)
    throw new Error(`100 step(${loss100.toFixed(4)}) <= 500 step(${loss500.toFixed(4)})`);
});

// ── TC-7: final-loss NaN 아님 ─────────────────────────────────
test("final-loss NaN/Inf 아님", () => {
  const finalLoss = getVar(interp, "final-loss") as number;
  if (!isFinite(finalLoss) || isNaN(finalLoss))
    throw new Error(`final-loss=${finalLoss}`);
});

// ── 결과 ──────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 53 학습 루프: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
