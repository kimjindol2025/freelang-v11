// FreeLang: ReturnSignal — (return val) early exit from fn body
// try/catch 블록을 통과해 함수 호출 경계까지 전파됨

export class ReturnSignal {
  constructor(public readonly value: any) {}
}

export function isReturnSignal(e: unknown): e is ReturnSignal {
  return e instanceof ReturnSignal;
}
