// test-phase105-streaming.ts — FreeLang v9 Phase 105 스트리밍 출력 테스트
// 최소 25개 PASS 목표

import {
  FLStream,
  StreamChunk,
  streamText,
  createStream,
  getStream,
  deleteStream,
} from "./streaming";
import { Interpreter } from "./interpreter";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>) {
  const result = fn();
  if (result instanceof Promise) {
    result.then(ok => {
      if (ok) { console.log(`  ✅ PASS: ${name}`); passed++; }
      else { console.log(`  ❌ FAIL: ${name}`); failed++; }
    }).catch(e => {
      console.log(`  ❌ FAIL: ${name} — ${e}`); failed++;
    });
    return result;
  }
  if (result) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}`); failed++; }
  return Promise.resolve(result);
}

async function runTests() {
  console.log("\n=== Phase 105: 스트리밍 출력 테스트 ===\n");

  // --- FLStream 기본 ---
  console.log("[ FLStream 기본 동작 ]");

  await test("1. FLStream 생성", () => {
    const s = new FLStream();
    return s !== undefined && s instanceof FLStream;
  });

  await test("2. write() 청크 추가", () => {
    const s = new FLStream();
    s.write("hello");
    return s.chunkCount() === 1;
  });

  await test("3. end() 완료 표시", () => {
    const s = new FLStream();
    s.write("test");
    s.end();
    return s.isDone() === true;
  });

  await test("4. isDone() false → true 전환", () => {
    const s = new FLStream();
    const before = s.isDone();
    s.end();
    const after = s.isDone();
    return before === false && after === true;
  });

  await test("5. collected() 수집 문자열", () => {
    const s = new FLStream();
    s.write("hello");
    s.write(" world");
    return s.collected() === "hello world";
  });

  await test("6. chunkCount() 청크 수 (done 제외)", () => {
    const s = new FLStream();
    s.write("a");
    s.write("b");
    s.write("c");
    s.end();
    return s.chunkCount() === 3;
  });

  await test("7. getChunks() 전체 청크 반환", () => {
    const s = new FLStream();
    s.write("x");
    s.end();
    const chunks = s.getChunks();
    return Array.isArray(chunks) && chunks.length === 2;
  });

  await test("8. collect() 즉시 반환 (done 상태)", async () => {
    const s = new FLStream();
    s.write("data");
    s.end();
    const result = await s.collect();
    return result === "data";
  });

  await test("9. collect() Promise 반환 (done 아닐 때)", async () => {
    const s = new FLStream();
    setTimeout(() => {
      s.write("async");
      s.end();
    }, 10);
    const result = await s.collect();
    return result === "async";
  });

  await test("10. end() 후 write() → 무시", () => {
    const s = new FLStream();
    s.write("first");
    s.end();
    s.write("ignored");
    return s.collected() === "first" && s.chunkCount() === 1;
  });

  await test("11. end() 중복 호출 → 무시", () => {
    const s = new FLStream();
    s.write("x");
    s.end();
    s.end();
    const chunks = s.getChunks();
    const doneChunks = chunks.filter(c => c.done);
    return doneChunks.length === 1;
  });

  await test("12. 'chunk' 이벤트 emit", async () => {
    const s = new FLStream();
    let received: StreamChunk | null = null;
    s.on('chunk', (c: StreamChunk) => { received = c; });
    s.write("event-test");
    return received !== null && (received as StreamChunk).content === "event-test";
  });

  await test("13. 'end' 이벤트 emit", async () => {
    const s = new FLStream();
    let endValue = "";
    s.on('end', (v: string) => { endValue = v; });
    s.write("finish");
    s.end();
    return endValue === "finish";
  });

  // --- streamText() ---
  console.log("\n[ streamText() 유틸 ]");

  await test("14. streamText() 텍스트 분해 (단어 단위)", async () => {
    const s = new FLStream();
    await streamText(s, "hello world test");
    const contentChunks = s.getChunks().filter(c => !c.done);
    return contentChunks.length === 3;
  });

  await test("15. streamText() 전체 수집 일치", async () => {
    const s = new FLStream();
    await streamText(s, "the quick brown fox");
    return s.collected() === "the quick brown fox";
  });

  // --- 레지스트리 ---
  console.log("\n[ 스트림 레지스트리 ]");

  await test("16. createStream() id 반환", () => {
    const { id, stream } = createStream();
    return typeof id === "string" && id.startsWith("stream-");
  });

  await test("17. getStream() 조회", () => {
    const { id, stream } = createStream();
    const found = getStream(id);
    return found === stream;
  });

  await test("18. deleteStream() 삭제", () => {
    const { id } = createStream();
    const result = deleteStream(id);
    return result === true && getStream(id) === null;
  });

  await test("19. getStream() 없는 id → null", () => {
    return getStream("nonexistent-stream-xyz") === null;
  });

  // --- 내장 함수 (Interpreter) ---
  console.log("\n[ 내장 함수 (Interpreter) ]");

  const interp = new Interpreter();

  function evalFL(code: string): any {
    const ctx = interp.run(code);
    return ctx.lastValue;
  }

  await test("20. stream-create 내장함수", () => {
    const id = evalFL('(stream-create)');
    return typeof id === "string" && id.startsWith("stream-");
  });

  await test("21. stream-write 내장함수", () => {
    const id = evalFL('(stream-create)');
    evalFL(`(stream-write "${id}" "hello")`);
    const s = getStream(id);
    return s !== null && s.chunkCount() === 1;
  });

  await test("22. stream-end 내장함수", () => {
    const id = evalFL('(stream-create)');
    evalFL(`(stream-write "${id}" "data")`);
    evalFL(`(stream-end "${id}")`);
    const s = getStream(id);
    return s !== null && s.isDone() === true;
  });

  await test("23. stream-collect 내장함수", async () => {
    const id = evalFL('(stream-create)');
    evalFL(`(stream-write "${id}" "collected")`);
    evalFL(`(stream-end "${id}")`);
    const result = await evalFL(`(stream-collect "${id}")`);
    return result === "collected";
  });

  await test("24. stream-done? 내장함수", () => {
    const id = evalFL('(stream-create)');
    const before = evalFL(`(stream-done? "${id}")`);
    evalFL(`(stream-end "${id}")`);
    const after = evalFL(`(stream-done? "${id}")`);
    return before === false && after === true;
  });

  await test("25. stream-chunk-count 내장함수", () => {
    const id = evalFL('(stream-create)');
    evalFL(`(stream-write "${id}" "a")`);
    evalFL(`(stream-write "${id}" "b")`);
    const count = evalFL(`(stream-chunk-count "${id}")`);
    return count === 2;
  });

  await test("26. stream-text 내장함수", async () => {
    const id = evalFL('(stream-create)');
    await evalFL(`(stream-text "${id}" "foo bar baz")`);
    const s = getStream(id);
    return s !== null && s.collected() === "foo bar baz";
  });

  await test("27. stream-delete 내장함수", () => {
    const id = evalFL('(stream-create)');
    const result = evalFL(`(stream-delete "${id}")`);
    return result === true && getStream(id) === null;
  });

  // --- 청크 구조 검증 ---
  console.log("\n[ 청크 구조 검증 ]");

  await test("28. StreamChunk index 순서", () => {
    const s = new FLStream();
    s.write("first");
    s.write("second");
    s.write("third");
    s.end();
    const chunks = s.getChunks();
    return chunks[0].index === 0 && chunks[1].index === 1 && chunks[2].index === 2;
  });

  await test("29. StreamChunk done 플래그", () => {
    const s = new FLStream();
    s.write("data");
    s.end();
    const chunks = s.getChunks();
    return chunks[0].done === false && chunks[1].done === true;
  });

  await test("30. StreamChunk timestamp 양수", () => {
    const s = new FLStream();
    s.write("ts-test");
    const chunks = s.getChunks();
    return chunks[0].timestamp > 0;
  });

  // 잠깐 기다려 비동기 테스트 완료
  await new Promise(r => setTimeout(r, 100));

  console.log(`\n=== 결과: ${passed} PASS / ${failed} FAIL / ${passed + failed} 총 테스트 ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch(e => {
  console.error("테스트 실행 오류:", e);
  process.exit(1);
});
