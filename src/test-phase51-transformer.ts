// FreeLang v9: Phase 51 — W-emb + W-proj 역전파 테스트
// gpt-mini-p3.fl: 독립 소형 모델로 수치 역전파 검증 (VOCAB=4, D=2)

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

console.log("[Phase 51] W-emb + W-proj 역전파 — gpt-mini-p3.fl");
console.log("(VOCAB=4, D=2 소형 모델 수치 기울기 검증)\n");

// ── 파일 로드 ──────────────────────────────────────────────────
const flPath = path.join(__dirname, "gpt-mini-p3.fl");
const src = fs.readFileSync(flPath, "utf-8");

const interp = new Interpreter();
interp.interpret(parse(lex(src)));

// ── TC-1: 함수 등록 확인 ───────────────────────────────────────
console.log("[함수 등록 확인]");

test("forward-simple 함수 등록됨", () => {
  const fn = (interp as any).context.functions.get("forward-simple");
  if (!fn) throw new Error("forward-simple not found");
});

test("ce-loss-simple 함수 등록됨", () => {
  const fn = (interp as any).context.functions.get("ce-loss-simple");
  if (!fn) throw new Error("ce-loss-simple not found");
});

test("grad-proj-row 함수 등록됨", () => {
  const fn = (interp as any).context.functions.get("grad-proj-row");
  if (!fn) throw new Error("grad-proj-row not found");
});

test("train-step-full 함수 등록됨", () => {
  const fn = (interp as any).context.functions.get("train-step-full");
  if (!fn) throw new Error("train-step-full not found");
});

// ── TC-2: 초기 loss 검증 ───────────────────────────────────────
console.log("\n[초기 loss 검증]");

test("초기 loss는 양수 NaN 아님", () => {
  const loss0 = getVar(interp, "mini-loss0");
  if (typeof loss0 !== "number" || isNaN(loss0) || loss0 <= 0)
    throw new Error(`mini-loss0=${loss0}`);
});

test("초기 loss는 log(1/VOCAB) 근방 (약 1.386)", () => {
  const loss0 = getVar(interp, "mini-loss0") as number;
  if (loss0 < 0.5 || loss0 > 5.0)
    throw new Error(`loss0=${loss0.toFixed(4)} out of expected range`);
  console.log(`    → 초기 loss: ${loss0.toFixed(4)}`);
});

// ── TC-3: 1-step 학습 후 loss 감소 ────────────────────────────
console.log("\n[1-step 학습 검증]");

test("1-step 후 loss 감소 (improved=true)", () => {
  const improved = getVar(interp, "mini-improved");
  if (improved !== true) throw new Error(`mini-improved=${improved}`);
});

test("최종 loss < 초기 loss (정량 확인)", () => {
  const loss0 = getVar(interp, "mini-loss0") as number;
  const lossFinal = getVar(interp, "mini-loss-final") as number;
  if (typeof lossFinal !== "number" || isNaN(lossFinal))
    throw new Error(`lossFinal=${lossFinal}`);
  if (lossFinal >= loss0)
    throw new Error(`loss 증가: ${loss0.toFixed(4)} → ${lossFinal.toFixed(4)}`);
  console.log(`    → ${loss0.toFixed(4)} → ${lossFinal.toFixed(4)} (감소 ✓)`);
});

// ── TC-4: train-step-full 반환값 검증 ─────────────────────────
console.log("\n[가중치 업데이트 검증]");

test("train-step-full 결과 mini-We-t 는 배열", () => {
  const weT = getVar(interp, "mini-We-t");
  if (!Array.isArray(weT)) throw new Error(`mini-We-t not array: ${typeof weT}`);
  const expected = 4 * 2; // MV * MD
  if (weT.length !== expected)
    throw new Error(`length=${weT.length}, expected=${expected}`);
});

test("train-step-full 결과 mini-Wp-t 는 배열", () => {
  const wpT = getVar(interp, "mini-Wp-t");
  if (!Array.isArray(wpT)) throw new Error(`mini-Wp-t not array: ${typeof wpT}`);
  const expected = 4 * 2; // MV * MD
  if (wpT.length !== expected)
    throw new Error(`length=${wpT.length}, expected=${expected}`);
});

test("We 가중치가 변경됨 (수치 역전파 작동)", () => {
  const we  = getVar(interp, "mini-We")  as number[];
  const weT = getVar(interp, "mini-We-t") as number[];
  const changed = we.some((v, i) => Math.abs(v - weT[i]) > 1e-10);
  if (!changed) throw new Error("W-emb unchanged after training");
});

test("Wp 가중치가 변경됨 (수치 역전파 작동)", () => {
  const wp  = getVar(interp, "mini-Wp")  as number[];
  const wpT = getVar(interp, "mini-Wp-t") as number[];
  const changed = wp.some((v, i) => Math.abs(v - wpT[i]) > 1e-10);
  if (!changed) throw new Error("W-proj unchanged after training");
});

// ── TC-5: grad-proj-row non-zero 검증 ─────────────────────────
console.log("\n[수치 기울기 검증]");

test("grad-proj-row: 기울기 non-zero", () => {
  const we   = getVar(interp, "mini-We")  as number[];
  const wp   = getVar(interp, "mini-Wp")  as number[];
  const bp   = getVar(interp, "mini-bp")  as number[];
  const toks = getVar(interp, "mini-toks") as number[];
  const target = getVar(interp, "mini-target") as number;

  const grads = (interp as any).callUserFunction("grad-proj-row", [
    toks, we, wp, bp, target, 0, 0.001,
  ]);
  if (!Array.isArray(grads) || grads.length === 0)
    throw new Error(`grads=${JSON.stringify(grads)}`);
  const allZero = grads.every((g: number) => Math.abs(g) < 1e-10);
  if (allZero) throw new Error("all gradients are zero");
  console.log(`    → grad[0]=${grads[0].toFixed(6)}, grad[1]=${grads[1].toFixed(6)}`);
});

// ── 결과 ──────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 51 역전파: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
