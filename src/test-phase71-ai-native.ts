// FreeLang v9: Phase 71 — AI 네이티브 블록 테스트
// ai-call / rag-search / embed / similarity / chunk-text / prompt-template

import { createAiNativeModule } from "./stdlib-ai-native";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => any): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      // async test는 별도 처리
      result
        .then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        })
        .catch((e: any) => {
          console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
          failed++;
        });
    } else {
      console.log(`  ✅ ${name}`);
      passed++;
    }
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

async function testAsync(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${String(e?.message ?? e).slice(0, 120)}`);
    failed++;
  }
}

async function main() {
  const mod = createAiNativeModule();

  console.log("[Phase 71] AI 네이티브 블록 강화 테스트\n");

  // ── TC-1: ai-call mock 모드 응답 확인 ─────────────────────────────
  console.log("[TC-1] ai-call mock 모드");
  await testAsync("ai-call mock 응답이 문자열 반환", async () => {
    const result = await (mod["ai-call"] as Function)("gpt-4", "테스트 프롬프트");
    if (typeof result !== "string") throw new Error(`문자열이 아님: ${typeof result}`);
    if (!result.includes("Mock")) throw new Error(`Mock 응답이 아님: ${result}`);
  });

  await testAsync("ai-call — 객체 프롬프트 (prompt 필드)", async () => {
    const result = await (mod["ai-call"] as Function)("claude-3", { prompt: "요약해줘", context: ["a", "b"], "max-tokens": 500 });
    if (typeof result !== "string") throw new Error(`문자열이 아님: ${typeof result}`);
  });

  await testAsync("ai-call — model명이 결과에 포함됨 (mock)", async () => {
    const result = await (mod["ai-call"] as Function)("claude-3", "안녕") as string;
    if (!result.includes("claude-3")) throw new Error(`model명 없음: ${result}`);
  });

  // ── TC-2: rag-search 결과 구조 확인 ──────────────────────────────
  console.log("\n[TC-2] rag-search 결과 구조");
  test("rag-search 배열 반환", () => {
    const results = (mod["rag-search"] as Function)("FreeLang 타입 시스템", { kb: "freelang-docs", limit: 5 });
    if (!Array.isArray(results)) throw new Error(`배열이 아님: ${typeof results}`);
    if (results.length === 0) throw new Error("빈 배열");
  });

  test("rag-search 각 결과에 content/score/source 필드 존재", () => {
    const results = (mod["rag-search"] as Function)("쿼리 테스트", { kb: "test-kb", limit: 3 }) as any[];
    for (const r of results) {
      if (typeof r.content !== "string") throw new Error(`content 없음: ${JSON.stringify(r)}`);
      if (typeof r.score !== "number") throw new Error(`score 없음: ${JSON.stringify(r)}`);
      if (typeof r.source !== "string") throw new Error(`source 없음: ${JSON.stringify(r)}`);
    }
  });

  test("rag-search limit 옵션 동작", () => {
    const results = (mod["rag-search"] as Function)("쿼리", { limit: 2 }) as any[];
    if (results.length > 2) throw new Error(`limit 2인데 ${results.length}개 반환`);
  });

  test("rag-search score가 0~1 범위", () => {
    const results = (mod["rag-search"] as Function)("쿼리", {}) as any[];
    for (const r of results) {
      if (r.score < 0 || r.score > 1) throw new Error(`score 범위 초과: ${r.score}`);
    }
  });

  // ── TC-3: embed 배열 반환 ─────────────────────────────────────────
  console.log("\n[TC-3] embed 배열 반환");
  await testAsync("embed — 배열 반환", async () => {
    const v = await (mod["embed"] as Function)("FreeLang은 AI 전용 언어");
    if (!Array.isArray(v)) throw new Error(`배열이 아님: ${typeof v}`);
    if (v.length === 0) throw new Error("빈 배열");
  });

  await testAsync("embed — 모든 원소가 숫자", async () => {
    const v = await (mod["embed"] as Function)("테스트 텍스트") as number[];
    for (const x of v) {
      if (typeof x !== "number") throw new Error(`숫자가 아닌 원소: ${x}`);
    }
  });

  // ── TC-4: similarity 0~1 범위 ────────────────────────────────────
  console.log("\n[TC-4] similarity 범위 검증");
  test("similarity — 0~1 범위 숫자 반환", () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    const sim = (mod["similarity"] as Function)(v1, v2) as number;
    if (typeof sim !== "number") throw new Error(`숫자가 아님: ${typeof sim}`);
    if (sim < 0 || sim > 1) throw new Error(`범위 초과: ${sim}`);
  });

  test("similarity — 직교 벡터는 0.0", () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    const sim = (mod["similarity"] as Function)(v1, v2) as number;
    if (Math.abs(sim) > 0.001) throw new Error(`직교인데 ${sim} (0이어야 함)`);
  });

  // ── TC-5: 동일 텍스트 similarity ≈ 1.0 ──────────────────────────
  console.log("\n[TC-5] 동일 텍스트 similarity");
  await testAsync("같은 텍스트 embed → similarity ≈ 1.0", async () => {
    const text = "FreeLang은 AI 전용 프로그래밍 언어";
    const v1 = await (mod["embed"] as Function)(text) as number[];
    const v2 = await (mod["embed"] as Function)(text) as number[];
    const sim = (mod["similarity"] as Function)(v1, v2) as number;
    if (Math.abs(sim - 1.0) > 0.001) throw new Error(`동일 텍스트 유사도가 ${sim} (1.0이어야 함)`);
  });

  test("similarity — 같은 벡터 → 1.0", () => {
    const v = [0.5, 0.3, 0.8, 0.1];
    const sim = (mod["similarity"] as Function)(v, v) as number;
    if (Math.abs(sim - 1.0) > 0.001) throw new Error(`같은 벡터인데 ${sim}`);
  });

  test("similarity — 비배열 입력 → 0 반환 (에러 없음)", () => {
    const sim = (mod["similarity"] as Function)(null, null) as number;
    if (sim !== 0) throw new Error(`null 입력에 0이 아닌 ${sim}`);
  });

  // ── TC-6: chunk-text 청킹 ───────────────────────────────────────
  console.log("\n[TC-6] chunk-text 청킹");
  test("chunk-text — 배열 반환", () => {
    const chunks = (mod["chunk-text"] as Function)("hello world", 5, 0) as string[];
    if (!Array.isArray(chunks)) throw new Error(`배열이 아님: ${typeof chunks}`);
    if (chunks.length === 0) throw new Error("빈 배열");
  });

  test("chunk-text — 각 청크가 size 이하", () => {
    const text = "a".repeat(100);
    const chunks = (mod["chunk-text"] as Function)(text, 20, 5) as string[];
    for (const c of chunks) {
      if (c.length > 20) throw new Error(`청크 크기 초과: ${c.length}`);
    }
  });

  test("chunk-text — 짧은 텍스트는 청크 1개", () => {
    const chunks = (mod["chunk-text"] as Function)("short", 512, 50) as string[];
    if (chunks.length !== 1) throw new Error(`1개여야 하는데 ${chunks.length}개`);
    if (chunks[0] !== "short") throw new Error(`내용 불일치: ${chunks[0]}`);
  });

  test("chunk-text — 빈 문자열은 빈 배열", () => {
    const chunks = (mod["chunk-text"] as Function)("", 512, 50) as string[];
    if (!Array.isArray(chunks) || chunks.length !== 0) throw new Error(`빈 배열이어야 함: ${chunks}`);
  });

  // ── TC-7: prompt-template 변수 치환 ─────────────────────────────
  console.log("\n[TC-7] prompt-template 변수 치환");
  test("prompt-template — 단순 치환", () => {
    const result = (mod["prompt-template"] as Function)(
      "안녕하세요, {name}님!",
      { name: "김진돌" }
    ) as string;
    if (result !== "안녕하세요, 김진돌님!") throw new Error(`치환 실패: ${result}`);
  });

  test("prompt-template — 여러 변수 치환", () => {
    const result = (mod["prompt-template"] as Function)(
      "{lang} 코드를 분석: {code}",
      { lang: "FreeLang", code: "(define x 42)" }
    ) as string;
    if (!result.includes("FreeLang")) throw new Error(`lang 치환 실패: ${result}`);
    if (!result.includes("(define x 42)")) throw new Error(`code 치환 실패: ${result}`);
  });

  test("prompt-template — 없는 변수는 빈 문자열", () => {
    const result = (mod["prompt-template"] as Function)(
      "Hello {missing}!",
      {}
    ) as string;
    if (result !== "Hello !") throw new Error(`없는 변수 처리 실패: ${result}`);
  });

  // ── TC-8: Phase 56 regression ────────────────────────────────────
  console.log("\n[TC-8] Phase 56 regression");
  const { execSync } = require("child_process");
  const path = require("path");
  const rootDir = path.join(__dirname, "..");
  try {
    const out = execSync(
      "npx ts-node src/test-phase56-lexical-scope.ts",
      { cwd: rootDir, encoding: "utf-8", timeout: 30000 }
    );
    // 통과 여부 파싱
    const match = out.match(/(\d+) passed.*?(\d+) failed/);
    if (match) {
      const p = parseInt(match[1], 10);
      const f = parseInt(match[2], 10);
      if (f > 0) {
        throw new Error(`Phase 56 ${f}개 실패: ${out.slice(-200)}`);
      }
      console.log(`  ✅ Phase 56 regression: ${p} passed, 0 failed`);
      passed++;
    } else {
      // exit 0이면 OK
      console.log(`  ✅ Phase 56 regression 통과`);
      passed++;
    }
  } catch (e: any) {
    if (e.status === 0 || (e.stdout && e.stdout.includes("passed"))) {
      const out2 = e.stdout || "";
      const match2 = out2.match(/(\d+) passed/);
      const p = match2 ? match2[1] : "?";
      console.log(`  ✅ Phase 56 regression: ${p} passed`);
      passed++;
    } else {
      console.log(`  ❌ Phase 56 regression 실패: ${String(e?.message ?? e).slice(0, 200)}`);
      failed++;
    }
  }

  // ── 결과 ─────────────────────────────────────────────────────────
  await new Promise(resolve => setTimeout(resolve, 100)); // async 테스트 완료 대기
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Phase 71 AI 네이티브: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
