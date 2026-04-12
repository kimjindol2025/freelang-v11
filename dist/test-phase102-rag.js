"use strict";
// FreeLang v9: Phase 102 — RAG (Retrieval-Augmented Generation) 검증
// TF-IDF 기반 텍스트 검색 + FL 내장 함수
Object.defineProperty(exports, "__esModule", { value: true });
const interpreter_1 = require("./interpreter");
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const rag_1 = require("./rag");
let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    }
    catch (e) {
        console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 160)}`);
        failed++;
    }
}
function run(src) {
    const interp = new interpreter_1.Interpreter();
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(src)));
    return interp.context.lastValue;
}
console.log("[Phase 102] RAG — Retrieval-Augmented Generation 검증\n");
// ── TC-1~3: RAGStore 기본 생성/추가 ─────────────────────────────────────────
console.log("[TC-1~3] RAGStore 기본 생성·추가");
test("TC-1: RAGStore 인스턴스 생성", () => {
    const store = new rag_1.RAGStore();
    if (!(store instanceof rag_1.RAGStore))
        throw new Error("RAGStore 인스턴스가 아님");
});
test("TC-2: add() 단일 문서 추가", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "doc1", content: "FreeLang is an AI-native language" });
    if (store.size() !== 1)
        throw new Error(`size=${store.size()}, 기대=1`);
});
test("TC-3: addMany() 여러 문서 추가", () => {
    const store = new rag_1.RAGStore();
    store.addMany([
        { id: "d1", content: "machine learning algorithms" },
        { id: "d2", content: "deep neural networks" },
        { id: "d3", content: "natural language processing" },
    ]);
    if (store.size() !== 3)
        throw new Error(`size=${store.size()}, 기대=3`);
});
// ── TC-4~5: size() / all() ───────────────────────────────────────────────────
console.log("\n[TC-4~5] size() / all()");
test("TC-4: size() 문서 수 확인", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "a", content: "hello world" });
    store.add({ id: "b", content: "foo bar" });
    if (store.size() !== 2)
        throw new Error(`size=${store.size()}, 기대=2`);
});
test("TC-5: all() 전체 문서 반환", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "x", content: "content x" });
    store.add({ id: "y", content: "content y" });
    const all = store.all();
    if (all.length !== 2)
        throw new Error(`all.length=${all.length}, 기대=2`);
    if (all[0].id !== "x" && all[1].id !== "x")
        throw new Error("문서 id x 없음");
});
// ── TC-6~10: retrieve() 검색 ─────────────────────────────────────────────────
console.log("\n[TC-6~10] retrieve() 검색");
test("TC-6: retrieve() 매칭 없음 → []", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "d1", content: "machine learning algorithms" });
    const results = store.retrieve("quantum physics");
    if (results.length !== 0)
        throw new Error(`results.length=${results.length}, 기대=0`);
});
test("TC-7: retrieve() 매칭 → 결과 있음", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "d1", content: "machine learning algorithms and neural networks" });
    store.add({ id: "d2", content: "cooking recipes and food" });
    const results = store.retrieve("machine learning");
    if (results.length === 0)
        throw new Error("결과가 없음, 기대 >= 1");
    if (results[0].id !== "d1")
        throw new Error(`첫 결과 id=${results[0].id}, 기대=d1`);
});
test("TC-8: retrieve() topK 제한", () => {
    const store = new rag_1.RAGStore();
    store.addMany([
        { id: "a", content: "language processing model" },
        { id: "b", content: "language translation model" },
        { id: "c", content: "language recognition model" },
        { id: "d", content: "language generation model" },
    ]);
    const results = store.retrieve("language model", 2);
    if (results.length > 2)
        throw new Error(`results.length=${results.length}, 기대 <= 2`);
});
test("TC-9: retrieve() score 기준 정렬 (높은 순)", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "perfect", content: "deep learning deep learning deep learning" });
    store.add({ id: "partial", content: "deep learning and other things" });
    const results = store.retrieve("deep learning", 2);
    if (results.length < 2)
        throw new Error("결과가 2개 미만");
    const s0 = results[0].score ?? 0;
    const s1 = results[1].score ?? 0;
    if (s0 < s1)
        throw new Error(`score 정렬 오류: ${s0} < ${s1}`);
});
test("TC-10: retrieve() score 0 이하 필터링", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "d1", content: "physics quantum mechanics" });
    store.add({ id: "d2", content: "biology ecology evolution" });
    const results = store.retrieve("machine learning python");
    for (const r of results) {
        if ((r.score ?? 0) <= 0)
            throw new Error(`score <= 0: ${r.score}`);
    }
});
// ── TC-11~13: query() ────────────────────────────────────────────────────────
console.log("\n[TC-11~13] query()");
test("TC-11: query() 기본 augment 포함 결과", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "d1", content: "FreeLang is an AI native language" });
    const result = store.query("FreeLang AI");
    if (!result.query)
        throw new Error("query 필드 없음");
    if (!Array.isArray(result.retrieved))
        throw new Error("retrieved가 배열이 아님");
    if (typeof result.augmented !== "string")
        throw new Error("augmented가 문자열이 아님");
    if (!result.augmented.includes("FreeLang"))
        throw new Error("augmented에 FreeLang 없음");
});
test("TC-12: query() 커스텀 augment 함수", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "d1", content: "neural network training" });
    const result = store.query("neural network", {
        augment: (q, docs) => `CUSTOM: ${q} | docs: ${docs.length}`
    });
    if (!result.augmented.startsWith("CUSTOM:"))
        throw new Error(`augmented=${result.augmented}`);
});
test("TC-13: query() topK 옵션 적용", () => {
    const store = new rag_1.RAGStore();
    store.addMany([
        { id: "a", content: "python programming language" },
        { id: "b", content: "python web framework" },
        { id: "c", content: "python data science" },
    ]);
    const result = store.query("python", { topK: 2 });
    if (result.retrieved.length > 2)
        throw new Error(`retrieved.length=${result.retrieved.length}, 기대 <= 2`);
});
// ── TC-14~15: remove() ───────────────────────────────────────────────────────
console.log("\n[TC-14~15] remove()");
test("TC-14: remove() 존재하는 ID → true", () => {
    const store = new rag_1.RAGStore();
    store.add({ id: "del", content: "to be deleted" });
    const ok = store.remove("del");
    if (!ok)
        throw new Error("remove 반환값이 false");
    if (store.size() !== 0)
        throw new Error(`size=${store.size()}, 기대=0`);
});
test("TC-15: remove() 없는 ID → false", () => {
    const store = new rag_1.RAGStore();
    const ok = store.remove("nonexistent");
    if (ok !== false)
        throw new Error(`remove 반환값이 ${ok}, 기대=false`);
});
// ── TC-16~18: 고급 기능 ──────────────────────────────────────────────────────
console.log("\n[TC-16~18] 고급 기능");
test("TC-16: metadata 포함 문서 추가·검색", () => {
    const store = new rag_1.RAGStore();
    store.add({
        id: "meta1",
        content: "transformer architecture attention mechanism",
        metadata: { author: "Vaswani", year: 2017 }
    });
    const results = store.retrieve("transformer attention");
    if (results.length === 0)
        throw new Error("결과 없음");
    if (!results[0].metadata)
        throw new Error("metadata 없음");
    if (results[0].metadata.author !== "Vaswani")
        throw new Error("metadata.author 오류");
});
test("TC-17: 한국어 토크나이즈", () => {
    const tokens = (0, rag_1.tokenize)("안녕하세요 프리랭 언어입니다");
    if (!tokens.includes("안녕하세요"))
        throw new Error(`토큰에 '안녕하세요' 없음: ${tokens}`);
    if (!tokens.includes("프리랭"))
        throw new Error(`토큰에 '프리랭' 없음: ${tokens}`);
});
test("TC-18: tfidf() 직접 호출 — 겹치는 토큰 있을 때 > 0", () => {
    const score = (0, rag_1.tfidf)(["machine", "learning"], ["machine", "learning", "model"]);
    if (score <= 0)
        throw new Error(`score=${score}, 기대 > 0`);
});
// ── TC-19: globalRAG 싱글톤 ──────────────────────────────────────────────────
console.log("\n[TC-19] globalRAG 싱글톤");
test("TC-19: globalRAG는 싱글톤 RAGStore", () => {
    if (!(rag_1.globalRAG instanceof rag_1.RAGStore))
        throw new Error("globalRAG가 RAGStore 아님");
    const beforeSize = rag_1.globalRAG.size();
    rag_1.globalRAG.add({ id: "__test__", content: "singleton test" });
    if (rag_1.globalRAG.size() !== beforeSize + 1)
        throw new Error("싱글톤 상태 공유 실패");
    rag_1.globalRAG.remove("__test__");
});
// ── TC-20~24: FL 내장 함수 ───────────────────────────────────────────────────
console.log("\n[TC-20~24] FL 내장 함수");
// 각 테스트마다 독립된 인터프리터 사용 (globalRAG 상태 격리를 위해 순서 주의)
test("TC-20: (rag-size) — 초기 문서 수", () => {
    // globalRAG 비우기
    const all = rag_1.globalRAG.all();
    for (const d of all)
        rag_1.globalRAG.remove(d.id);
    const result = run(`(rag-size)`);
    if (typeof result !== 'number')
        throw new Error(`rag-size 반환타입 오류: ${typeof result}`);
});
test("TC-21: (rag-add \"id\" \"content\") — 문서 추가 → true", () => {
    const all = rag_1.globalRAG.all();
    for (const d of all)
        rag_1.globalRAG.remove(d.id);
    const result = run(`(rag-add "fl-doc" "FreeLang is an AI native language for reasoning")`);
    if (result !== true)
        throw new Error(`rag-add 반환값=${result}, 기대=true`);
    if (rag_1.globalRAG.size() < 1)
        throw new Error("globalRAG에 문서 없음");
});
test("TC-22: (rag-retrieve \"query\" topK) — 검색 결과 리스트", () => {
    const all2 = rag_1.globalRAG.all();
    for (const d of all2)
        rag_1.globalRAG.remove(d.id);
    rag_1.globalRAG.add({ id: "r1", content: "FreeLang AI language reasoning system" });
    rag_1.globalRAG.add({ id: "r2", content: "cooking food recipes kitchen" });
    const result = run(`(rag-retrieve "FreeLang AI" 3)`);
    if (!Array.isArray(result))
        throw new Error(`결과가 배열이 아님: ${typeof result}`);
    if (result.length === 0)
        throw new Error("결과 배열이 비어있음");
    if (!result[0].id || !result[0].content)
        throw new Error("결과 항목에 id/content 없음");
});
test("TC-23: (rag-query \"query\") — augmented 문자열 반환", () => {
    const all3 = rag_1.globalRAG.all();
    for (const d of all3)
        rag_1.globalRAG.remove(d.id);
    rag_1.globalRAG.add({ id: "q1", content: "FreeLang language model architecture" });
    const result = run(`(rag-query "FreeLang")`);
    if (typeof result !== 'string')
        throw new Error(`결과가 문자열이 아님: ${typeof result}`);
    if (!result.includes("FreeLang"))
        throw new Error("결과에 FreeLang 없음");
});
test("TC-24: (rag-remove \"id\") — 문서 삭제", () => {
    rag_1.globalRAG.add({ id: "rm1", content: "to be removed document" });
    const sizeBefore = rag_1.globalRAG.size();
    const result = run(`(rag-remove "rm1")`);
    if (result !== true)
        throw new Error(`rag-remove 반환값=${result}, 기대=true`);
    if (rag_1.globalRAG.size() !== sizeBefore - 1)
        throw new Error("삭제 후 size 오류");
});
// ── TC-25: 통합 파이프라인 ───────────────────────────────────────────────────
console.log("\n[TC-25] 통합: add → retrieve → query 파이프라인");
test("TC-25: add → retrieve → query 전체 파이프라인", () => {
    const store = new rag_1.RAGStore();
    store.addMany([
        { id: "p1", content: "FreeLang supports chain of thought reasoning steps" },
        { id: "p2", content: "FreeLang has tree of thoughts branching exploration" },
        { id: "p3", content: "FreeLang includes self improvement and reflection" },
        { id: "p4", content: "cooking recipes and food preparation" },
    ]);
    // retrieve — reasoning 관련 문서만 나와야 함
    const retrieved = store.retrieve("chain of thought reasoning", 2);
    if (retrieved.length === 0)
        throw new Error("retrieve 결과 없음");
    if (!retrieved.some(d => d.id === "p1"))
        throw new Error("p1이 상위 결과에 없음");
    // query — augmented 문자열 생성
    const result = store.query("FreeLang reasoning", {
        topK: 3,
        augment: (q, docs) => `[${q}] => ${docs.map(d => d.id).join(", ")}`
    });
    if (!result.augmented.includes("FreeLang reasoning"))
        throw new Error("augmented에 쿼리 없음");
    if (result.retrieved.length === 0)
        throw new Error("retrieved 비어있음");
});
// ── 결과 출력 ────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`[Phase 102 RAG] 결과: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
    console.log(`FAILED: ${failed}개`);
    process.exit(1);
}
else {
    console.log("모든 테스트 통과!");
}
//# sourceMappingURL=test-phase102-rag.js.map