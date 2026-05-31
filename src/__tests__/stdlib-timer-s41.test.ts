import { createTimerModule } from "../stdlib-timer";

// fake interpreter — callUserFunction 시뮬레이션
function makeFakeInterp(handlers: Record<string, (...args: any[]) => any> = {}) {
  return {
    callUserFunction(name: string, args: any[]) {
      if (handlers[name]) return handlers[name](...args);
      throw new Error(`callUserFunction: unknown handler '${name}'`);
    },
    callFunctionValue(fn: any, args: any[]) {
      if (typeof fn === "function") return fn(...args);
      if (fn && typeof fn.body === "function") return fn.body(...args);
      throw new Error(`callFunctionValue: unsupported fn type`);
    },
  };
}

function setupQueue(events: any[]) {
  (globalThis as any).__flEventQueue = [...events];
  (globalThis as any).__flErrorQueue = [];
}

describe("S41: fl-run-loop / fl-run-loop-stop", () => {
  let mod: ReturnType<typeof createTimerModule>;

  beforeEach(() => {
    (globalThis as any).__flEventQueue = [];
    (globalThis as any).__flErrorQueue = [];
  });

  afterEach(() => {
    if (mod) (mod as any)["timer_clear_all"]();
    (globalThis as any).__flEventQueue = [];
    (globalThis as any).__flErrorQueue = [];
  });

  test("fl-run-loop: 양수 ms로 시작 → 숫자 ID 반환", () => {
    mod = createTimerModule(makeFakeInterp());
    const id = (mod as any)["fl-run-loop"](50);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThanOrEqual(2000);
  });

  test("fl-run-loop: ms <= 0 이면 에러", () => {
    mod = createTimerModule(makeFakeInterp());
    expect(() => (mod as any)["fl-run-loop"](0)).toThrow();
    expect(() => (mod as any)["fl-run-loop"](-10)).toThrow();
  });

  test("fl-run-loop: tick마다 queue를 drain", async () => {
    const processed: string[] = [];
    mod = createTimerModule(makeFakeInterp({
      "on-data": (payload: string) => { processed.push(payload); return "ok"; },
    }));

    setupQueue([
      { handler: "on-data", args: ["msg1"], sock: null },
      { handler: "on-data", args: ["msg2"], sock: null },
    ]);

    const id = (mod as any)["fl-run-loop"](30);
    await new Promise(r => setTimeout(r, 80));
    (mod as any)["fl-run-loop-stop"](id);

    expect(processed).toContain("msg1");
    expect(processed).toContain("msg2");
    expect((globalThis as any).__flEventQueue).toHaveLength(0);
  });

  test("fl-run-loop: handler 에러는 error queue로", async () => {
    mod = createTimerModule(makeFakeInterp({
      "bad-handler": () => { throw new Error("boom"); },
    }));

    setupQueue([{ handler: "bad-handler", args: [], sock: null }]);

    const id = (mod as any)["fl-run-loop"](30);
    await new Promise(r => setTimeout(r, 80));
    (mod as any)["fl-run-loop-stop"](id);

    const errs: any[] = (globalThis as any).__flErrorQueue;
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0][0]).toBe("io-err");
    expect(errs[0][3]).toBe("boom");
  });

  test("fl-run-loop: 새 이벤트가 추가되면 다음 tick에 처리", async () => {
    const log: string[] = [];
    mod = createTimerModule(makeFakeInterp({
      "ping": () => { log.push("pong"); return "pong"; },
    }));

    const id = (mod as any)["fl-run-loop"](30);

    // 첫 tick 이후 이벤트 추가
    await new Promise(r => setTimeout(r, 40));
    (globalThis as any).__flEventQueue.push({ handler: "ping", args: [], sock: null });

    await new Promise(r => setTimeout(r, 60));
    (mod as any)["fl-run-loop-stop"](id);

    expect(log).toContain("pong");
  });

  test("fl-run-loop-stop: 없는 id는 false 반환", () => {
    mod = createTimerModule(makeFakeInterp());
    expect((mod as any)["fl-run-loop-stop"](99999)).toBe(false);
  });

  test("fl-run-loop-stop: 중단 후 queue 처리 안 됨", async () => {
    const log: string[] = [];
    mod = createTimerModule(makeFakeInterp({
      "task": () => { log.push("ran"); },
    }));

    const id = (mod as any)["fl-run-loop"](30);
    const stopped = (mod as any)["fl-run-loop-stop"](id);
    expect(stopped).toBe(true);

    setupQueue([{ handler: "task", args: [], sock: null }]);
    await new Promise(r => setTimeout(r, 100));

    expect(log).toHaveLength(0);
  });

  test("fl-run-loop: sock.write 호출됨 (응답 있는 경우)", async () => {
    const written: string[] = [];
    const fakeSock = {
      destroyed: false,
      write(data: string) { written.push(data); },
    };

    mod = createTimerModule(makeFakeInterp({
      "responder": () => "HELLO",
    }));

    setupQueue([{ handler: "responder", args: [], sock: fakeSock }]);

    const id = (mod as any)["fl-run-loop"](30);
    await new Promise(r => setTimeout(r, 80));
    (mod as any)["fl-run-loop-stop"](id);

    expect(written.length).toBeGreaterThan(0);
    expect(written[0]).toContain("HELLO");
  });
});
