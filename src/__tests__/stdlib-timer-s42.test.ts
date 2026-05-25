import { createTimerModule } from "../stdlib-timer";

// fake interpreter — callFunctionValue 직접 호출
function makeFakeInterp() {
  return {
    callFunctionValue(fn: any, args: any[]) {
      if (typeof fn === "function") return fn(...args);
      if (fn && typeof fn.body === "function") return fn.body(...args);
      throw new Error(`callFunctionValue: unsupported fn type ${typeof fn}`);
    },
  };
}

function makeFn(cb: () => void) {
  return { body: cb, params: [] };
}

describe("S42: fl-timeout / fl-interval / fl-cancel-timer", () => {
  let mod: ReturnType<typeof createTimerModule>;

  beforeEach(() => {
    mod = createTimerModule(makeFakeInterp());
    // 이전 타이머 초기화
    (mod as any)["timer_clear_all"]();
  });

  afterEach(() => {
    (mod as any)["timer_clear_all"]();
  });

  test("fl-timeout: 일정 시간 후 1회 실행", async () => {
    const fired: number[] = [];
    const id = (mod as any)["fl-timeout"](50, makeFn(() => fired.push(Date.now())));
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThanOrEqual(2000);

    await new Promise(r => setTimeout(r, 150));
    expect(fired).toHaveLength(1);
  });

  test("fl-timeout: 취소 후 미실행", async () => {
    const fired: string[] = [];
    const id = (mod as any)["fl-timeout"](50, makeFn(() => fired.push("fired")));
    const cancelled = (mod as any)["fl-cancel-timer"](id);
    expect(cancelled).toBe(true);

    await new Promise(r => setTimeout(r, 150));
    expect(fired).toHaveLength(0);
  });

  test("fl-interval: 주기적으로 반복 실행", async () => {
    const ticks: number[] = [];
    const id = (mod as any)["fl-interval"](50, makeFn(() => ticks.push(Date.now())));
    expect(typeof id).toBe("number");

    await new Promise(r => setTimeout(r, 220));
    (mod as any)["fl-cancel-timer"](id);

    // 50ms 간격, 220ms = 약 4회 (3~5 허용)
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks.length).toBeLessThanOrEqual(5);
  });

  test("fl-cancel-timer: interval 취소 후 더 이상 실행 안 됨", async () => {
    const ticks: number[] = [];
    const id = (mod as any)["fl-interval"](30, makeFn(() => ticks.push(Date.now())));

    await new Promise(r => setTimeout(r, 100));
    const cancelled = (mod as any)["fl-cancel-timer"](id);
    expect(cancelled).toBe(true);
    const countAtCancel = ticks.length;

    await new Promise(r => setTimeout(r, 100));
    expect(ticks.length).toBe(countAtCancel); // 취소 후 증가 없음
  });

  test("fl-cancel-timer: 없는 id는 false 반환", () => {
    const result = (mod as any)["fl-cancel-timer"](99999);
    expect(result).toBe(false);
  });

  test("fl-timeout: ms 유효성 검사", () => {
    expect(() => (mod as any)["fl-timeout"](-1, makeFn(() => {}))).toThrow();
    expect(() => (mod as any)["fl-timeout"](100, null)).toThrow();
  });

  test("fl-interval: ms 유효성 검사", () => {
    expect(() => (mod as any)["fl-interval"](0, makeFn(() => {}))).toThrow();
    expect(() => (mod as any)["fl-interval"](100, null)).toThrow();
  });
});
