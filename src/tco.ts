// FreeLang v9: Trampoline-based TCO (Tail Call Optimization)
// Phase 61: 100만 재귀를 스택 오버플로 없이 실행

export const TAIL_CALL = Symbol("TAIL_CALL");

export interface TailCall {
  [TAIL_CALL]: true;
  fn: string | any; // 함수명(string) 또는 function-value
  args: any[];
}

export function tailCall(fn: string | any, args: any[]): TailCall {
  return { [TAIL_CALL]: true, fn, args };
}

export function isTailCall(v: any): v is TailCall {
  return v !== null && typeof v === "object" && v[TAIL_CALL] === true;
}

// Trampoline: TailCall이 반환되는 한 계속 반복 실행 (스택 없이)
export function trampoline(interp: any, initial: TailCall): any {
  let current: any = initial;
  while (isTailCall(current)) {
    if (typeof current.fn === "string") {
      current = interp.callUserFunctionRaw(current.fn, current.args);
    } else {
      current = interp.callFunctionValueRaw(current.fn, current.args);
    }
  }
  return current;
}
