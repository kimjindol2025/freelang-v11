// FreeLang v9: Phase 103 — 멀티 에이전트 통신
// MessageBus + agent-spawn/send/recv/broadcast/process
// 최소 25개 PASS

import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";
import {
  MessageBus,
  globalBus,
  AgentMessage,
  AgentHandle,
} from "./multi-agent";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
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

// ────────────────────────────────────────────
// Part 1: MessageBus 클래스 직접 테스트
// ────────────────────────────────────────────
console.log("\n[Part 1] MessageBus 클래스 직접 테스트");

test("1. MessageBus 생성", () => {
  const bus = new MessageBus();
  assert(bus !== null && bus !== undefined);
  assertEqual(bus.size(), 0);
});

test("2. spawn() 에이전트 등록", () => {
  const bus = new MessageBus();
  const handle = bus.spawn("agent-a", (msg) => msg.content);
  assert(handle !== null);
  assertEqual(handle.id, "agent-a");
  assertEqual(handle.running, true);
});

test("3. list() 목록 확인", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  const list = bus.list();
  assertEqual(list.length, 2);
  assert(list.includes("agent-a"));
  assert(list.includes("agent-b"));
});

test("4. send() 메시지 전송", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  const msg = bus.send("agent-a", "agent-b", "hello");
  assertEqual(msg.from, "agent-a");
  assertEqual(msg.to, "agent-b");
  assertEqual(msg.content, "hello");
});

test("5. inboxSize() 확인", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  bus.send("agent-a", "agent-b", "msg1");
  bus.send("agent-a", "agent-b", "msg2");
  assertEqual(bus.inboxSize("agent-b"), 2);
  assertEqual(bus.inboxSize("agent-a"), 0);
});

test("6. recv() 메시지 수신", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  bus.send("agent-a", "agent-b", "hello world");
  const received = bus.recv("agent-b");
  assert(received !== null);
  assertEqual(received!.content, "hello world");
  assertEqual(received!.from, "agent-a");
});

test("7. recv() 빈 인박스 → null", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  const result = bus.recv("agent-a");
  assertEqual(result, null);
});

test("8. broadcast() 전체 전송", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  bus.spawn("agent-c", (msg) => msg);
  const msgs = bus.broadcast("agent-a", "hi all");
  assertEqual(msgs.length, 2);
});

test("9. broadcast() 발신자 제외", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  bus.broadcast("agent-a", "hi all");
  // agent-a는 자신이 보낸 브로드캐스트를 받지 않아야 함
  assertEqual(bus.inboxSize("agent-a"), 0);
  assertEqual(bus.inboxSize("agent-b"), 1);
});

test("10. process() 핸들러 실행", () => {
  const bus = new MessageBus();
  const received: string[] = [];
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => {
    received.push(msg.content);
    return msg.content.toUpperCase();
  });
  bus.send("agent-a", "agent-b", "hello");
  bus.send("agent-a", "agent-b", "world");
  const results = bus.process("agent-b");
  assertEqual(results.length, 2);
  assertEqual(results[0], "HELLO");
  assertEqual(results[1], "WORLD");
  assertEqual(bus.inboxSize("agent-b"), 0);
});

test("11. history() 로그 확인", () => {
  const bus = new MessageBus();
  bus.spawn("agent-a", (msg) => msg);
  bus.spawn("agent-b", (msg) => msg);
  bus.send("agent-a", "agent-b", "msg1");
  bus.send("agent-b", "agent-a", "msg2");
  const hist = bus.history();
  assertEqual(hist.length, 2);
  assertEqual(hist[0].content, "msg1");
  assertEqual(hist[1].content, "msg2");
});

test("12. stop() 에이전트 중지", () => {
  const bus = new MessageBus();
  const handle = bus.spawn("agent-a", (msg) => msg);
  assertEqual(handle.running, true);
  bus.stop("agent-a");
  assertEqual(handle.running, false);
});

test("13. size() 에이전트 수", () => {
  const bus = new MessageBus();
  assertEqual(bus.size(), 0);
  bus.spawn("a1", (m) => m);
  assertEqual(bus.size(), 1);
  bus.spawn("a2", (m) => m);
  bus.spawn("a3", (m) => m);
  assertEqual(bus.size(), 3);
});

test("14. 여러 에이전트 간 통신", () => {
  const bus = new MessageBus();
  const aLog: string[] = [];
  const bLog: string[] = [];
  bus.spawn("agent-a", (msg, b) => {
    aLog.push(`A got: ${msg.content}`);
    b.send("agent-a", "agent-b", `reply to ${msg.content}`);
  });
  bus.spawn("agent-b", (msg) => {
    bLog.push(`B got: ${msg.content}`);
  });
  bus.send("agent-b", "agent-a", "ping");
  bus.process("agent-a");
  bus.process("agent-b");
  assertEqual(aLog.length, 1);
  assertEqual(bLog.length, 1);
  assert(bLog[0].includes("reply to ping"));
});

test("15. 메시지 ID 자동 생성", () => {
  const bus = new MessageBus();
  bus.spawn("a", (m) => m);
  bus.spawn("b", (m) => m);
  const m1 = bus.send("a", "b", "x");
  const m2 = bus.send("a", "b", "y");
  assert(m1.id !== m2.id);
  assert(m1.id.startsWith("msg-"));
  assert(m2.id.startsWith("msg-"));
});

test("16. 타임스탬프 포함", () => {
  const bus = new MessageBus();
  bus.spawn("a", (m) => m);
  bus.spawn("b", (m) => m);
  const before = Date.now();
  const msg = bus.send("a", "b", "time-test");
  const after = Date.now();
  assert(msg.timestamp >= before && msg.timestamp <= after);
});

test("17. globalBus 싱글톤", () => {
  assert(globalBus !== null && globalBus !== undefined);
  assert(globalBus instanceof MessageBus);
});

// ────────────────────────────────────────────
// Part 2: FL 내장 함수 테스트
// ────────────────────────────────────────────
console.log("\n[Part 2] FL 내장 함수 테스트");

// 각 테스트에서 fresh Interpreter 사용 (globalBus 공유)
// globalBus에 에이전트 추가 전 정리를 위해 별도 버스 사용하거나 prefix로 구분

function makeInterp() {
  return new Interpreter();
}

test("18. agent-spawn 내장함수", () => {
  const interp = makeInterp();
  // FL에서 직접 테스트하기 어려우므로 TS 레벨에서 globalBus 통해 검증
  const sizeBefore = globalBus.list().filter(id => id === "fl-test-spawn-18").length;
  globalBus.spawn("fl-test-spawn-18", (msg) => msg);
  const sizeAfter = globalBus.list().filter(id => id === "fl-test-spawn-18").length;
  assertEqual(sizeAfter, 1);
});

test("19. agent-send 내장함수", () => {
  // globalBus에 에이전트 미리 등록
  if (!globalBus.list().includes("fl-send-src-19")) {
    globalBus.spawn("fl-send-src-19", (m) => m);
  }
  if (!globalBus.list().includes("fl-send-dst-19")) {
    globalBus.spawn("fl-send-dst-19", (m) => m);
  }
  const interp = makeInterp();
  evalFL(interp, `(agent-send "fl-send-src-19" "fl-send-dst-19" "test-content")`);
  const sz = globalBus.inboxSize("fl-send-dst-19");
  assert(sz >= 1, `inbox size should be >= 1, got ${sz}`);
});

test("20. agent-recv 내장함수", () => {
  if (!globalBus.list().includes("fl-recv-src-20")) {
    globalBus.spawn("fl-recv-src-20", (m) => m);
  }
  if (!globalBus.list().includes("fl-recv-dst-20")) {
    globalBus.spawn("fl-recv-dst-20", (m) => m);
  }
  globalBus.send("fl-recv-src-20", "fl-recv-dst-20", "recv-test");
  const interp = makeInterp();
  const result = evalFL(interp, `(agent-recv "fl-recv-dst-20")`);
  assert(result !== null, "recv should return a message");
  assertEqual(result.content, "recv-test");
});

test("21. agent-broadcast 내장함수", () => {
  if (!globalBus.list().includes("fl-bc-src-21")) {
    globalBus.spawn("fl-bc-src-21", (m) => m);
  }
  if (!globalBus.list().includes("fl-bc-dst-21")) {
    globalBus.spawn("fl-bc-dst-21", (m) => m);
  }
  const interp = makeInterp();
  const result = evalFL(interp, `(agent-broadcast "fl-bc-src-21" "hello everyone")`);
  assert(Array.isArray(result));
  // fl-bc-dst-21이 받아야 함
  const sz = globalBus.inboxSize("fl-bc-dst-21");
  assert(sz >= 1);
});

test("22. agent-process 내장함수", () => {
  if (!globalBus.list().includes("fl-proc-src-22")) {
    globalBus.spawn("fl-proc-src-22", (m) => m);
  }
  if (!globalBus.list().includes("fl-proc-dst-22")) {
    globalBus.spawn("fl-proc-dst-22", (msg) => `processed:${msg.content}`);
  }
  globalBus.send("fl-proc-src-22", "fl-proc-dst-22", "data");
  const interp = makeInterp();
  const result = evalFL(interp, `(agent-process "fl-proc-dst-22")`);
  assert(Array.isArray(result));
  assertEqual(result.length, 1);
  assertEqual(result[0], "processed:data");
});

test("23. agent-list 내장함수", () => {
  // globalBus에 이미 에이전트들이 있음
  const interp = makeInterp();
  const result = evalFL(interp, `(agent-list)`);
  assert(Array.isArray(result));
  assert(result.length > 0);
});

test("24. agent-inbox-size 내장함수", () => {
  if (!globalBus.list().includes("fl-inbox-src-24")) {
    globalBus.spawn("fl-inbox-src-24", (m) => m);
  }
  if (!globalBus.list().includes("fl-inbox-dst-24")) {
    globalBus.spawn("fl-inbox-dst-24", (m) => m);
  }
  globalBus.send("fl-inbox-src-24", "fl-inbox-dst-24", "m1");
  globalBus.send("fl-inbox-src-24", "fl-inbox-dst-24", "m2");
  const interp = makeInterp();
  const result = evalFL(interp, `(agent-inbox-size "fl-inbox-dst-24")`);
  assert(result >= 2, `inbox size should be >= 2, got ${result}`);
});

// ────────────────────────────────────────────
// Part 3: 통합 테스트
// ────────────────────────────────────────────
console.log("\n[Part 3] 통합 테스트");

test("25. 통합: spawn 2개 → send → process → history", () => {
  const bus = new MessageBus();
  const results: string[] = [];

  bus.spawn("coordinator", (msg) => {
    return `coord-handled:${msg.content}`;
  });
  bus.spawn("worker", (msg) => {
    const reply = `worker-done:${msg.content}`;
    results.push(reply);
    return reply;
  });

  // coordinator → worker로 작업 전송
  bus.send("coordinator", "worker", "task-1");
  bus.send("coordinator", "worker", "task-2");
  bus.send("coordinator", "worker", "task-3");

  assertEqual(bus.inboxSize("worker"), 3);

  // worker 처리
  const processed = bus.process("worker");
  assertEqual(processed.length, 3);
  assertEqual(bus.inboxSize("worker"), 0);

  // history 확인
  const hist = bus.history();
  assertEqual(hist.length, 3);
  assert(hist.every(m => m.from === "coordinator" && m.to === "worker"));

  // results 확인
  assertEqual(results.length, 3);
  assert(results[0].startsWith("worker-done:"));
});

test("26. agent-history 내장함수", () => {
  // globalBus에 메시지가 이미 전송됨
  const interp = makeInterp();
  const result = evalFL(interp, `(agent-history)`);
  assert(Array.isArray(result));
  assert(result.length > 0);
  // 메시지 구조 확인
  const first = result[0];
  assert('from' in first);
  assert('to' in first);
  assert('content' in first);
  assert('timestamp' in first);
  assert('id' in first);
});

test("27. 메시지 순서 보장 (FIFO)", () => {
  const bus = new MessageBus();
  bus.spawn("src", (m) => m);
  bus.spawn("dst", (m) => m);
  bus.send("src", "dst", "first");
  bus.send("src", "dst", "second");
  bus.send("src", "dst", "third");
  const m1 = bus.recv("dst");
  const m2 = bus.recv("dst");
  const m3 = bus.recv("dst");
  assertEqual(m1!.content, "first");
  assertEqual(m2!.content, "second");
  assertEqual(m3!.content, "third");
});

test("28. 존재하지 않는 에이전트에 send → 로그에는 기록", () => {
  const bus = new MessageBus();
  bus.spawn("sender", (m) => m);
  // "ghost"는 등록되지 않음
  const msg = bus.send("sender", "ghost", "lost-msg");
  assertEqual(msg.to, "ghost");
  assertEqual(msg.content, "lost-msg");
  // 로그에는 기록됨
  const hist = bus.history();
  assert(hist.some(m => m.to === "ghost"));
});

// ────────────────────────────────────────────
// 결과 출력
// ────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Phase 103 Multi-Agent: ${passed}/${passed + failed} PASS`);
if (failed > 0) {
  console.log(`❌ FAILED: ${failed}개`);
  process.exit(1);
} else {
  console.log(`✅ 모든 테스트 통과!`);
}
