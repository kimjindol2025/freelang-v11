# Runtime Effect Enforcement — MVP 설계

작성일: 2026-05-20
상태: 설계 확정 (구현 미착수)
범위: FreeLang v11 런타임 인터프리터 (TS)
브랜치: `feature/effect-enforcement`

---

## 0. 문제 정의

- 현재 `^{:effects [...]}` 는 정적 검사(`cli.ts:458-545`)에서만 경고로 처리된다.
- pure 컨텍스트라고 선언한 함수가 런타임에서 `file-write`, `http-call`, `now`, `rand` 등을 자유롭게 호출할 수 있다.
- AI 에이전트가 생성한 코드의 의도(`pure`)와 실제 실행(`io`)이 어긋나도 차단되지 않는다.
- 결과: replay/truth 보장이 깨진다.

이번 MVP는 **선언된 effect와 실제 실행을 일치시키는 첫 런타임 강제 레이어**를 도입한다.

---

## 1. 범위

### 1-A. 포함

- 함수 메타 `:effects` 의 런타임 enforcement
- 호출 시점 effect frame stack push/pop
- 위반 시 `EffectViolation` 즉시 throw + chain·span 출력
- `runtime-events.ts` 에 `effect-violation` 이벤트 타입 추가
- builtin effect registry (별도 Map)

### 1-B. 제외 (graveyard 후보)

- compile-time purity inference
- algebraic effect system
- effect polymorphism
- coroutine/async 재설계
- optimizer 통합
- type system 도입
- capability graph
- `:db` / `:gpu` / `:fs-read` / `:fs-write` 같은 세분화 effect (지금은 `:io`로 통합)

---

## 2. Effect 어휘 (MVP 6종)

| effect | 의미 | 대표 builtin |
|--------|------|--------------|
| `:pure` | 부수효과 없음 | 산술, 문자열, 컬렉션 |
| `:io` | 파일·콘솔·DB 등 외부 상태 변경 | `file-write`, `db-exec`, `println` |
| `:net` | 네트워크 호출 | `http-get`, `http-post`, `ws-send` |
| `:process` | 프로세스/시스템 호출 | `shell-exec`, `process-spawn` |
| `:time` | 비결정 시간 소스 | `now`, `now-ms`, `sleep` |
| `:random` | 비결정 난수 소스 | `rand`, `rand-int`, `uuid` |

> 어휘 확장은 lock된 결정이 아니다 (future work). MVP는 6종 고정.

---

## 3. 함수 메타 의미론 (확정)

| 선언 | 런타임 의미 |
|------|------------|
| `^{:effects []}` | **pure** — 어떤 effect builtin도 호출 불가. `:pure` 함수만 호출 가능. |
| `^{:effects [:io]}` | `:io` 만 허용. `:net` 호출 시 위반. |
| `^{:effects [:io :net]}` | `:io` 또는 `:net` 허용. |
| **메타 없음** | **unrestricted (legacy)** — 검사 skip. 모든 호출 허용. |

### 핵심 결정 (dec-006, lock)

> **effect metadata absent = legacy unrestricted**

self-host bootstrap·기존 1018개 테스트가 깨지지 않도록, 메타가 부재한 함수는 검사를 건너뛴다. 점진 도입 전략.

`^{:effects []}` 는 사실상 **deterministic assertion** 으로 동작한다 (replay 안전).

---

## 4. Runtime Effect Stack

### 4-A. Frame 구조

```ts
type EffectFrame = {
  fnName: string;
  allowed: Set<EffectTag> | null;  // null = unrestricted (legacy frame)
  span?: { file: string; line: number; col: number };
};
```

### 4-B. Stack semantics

- 함수 진입 시: `stack.push({ fnName, allowed: meta?.effects ?? null, span })`
- 함수 종료 시: `stack.pop()` (try/finally)
- 호출 직전 검사: 아래 5절 참조

### 4-C. unrestricted frame 의미 (D3 확장)

```
current.allowed === null   ⇒  검사 skip (legacy compat)
current.allowed === Set([])      ⇒  pure 컨텍스트. effect builtin 호출 모두 위반.
current.allowed === Set([:io])   ⇒  :io ⊆ allowed 인 호출만 허용.
```

> 이 룰은 future effect inheritance / lexical scoping 확장 시에도 ambiguity가 없도록 명시.

---

## 5. 검사 규칙

호출 직전:

```
target_effects = effectsOf(callee)   // 함수 메타 또는 builtin registry 조회
current = stack.top()

if current.allowed === null:
    pass                              // legacy frame, skip
elif target_effects is null:
    pass                              // callee가 legacy, skip
elif target_effects ⊆ current.allowed:
    pass
else:
    throw EffectViolation(...)
```

> "callee가 legacy" 케이스는 보수적 허용. enforce를 점진 확장하기 위한 escape hatch. 추후 strict 모드에서 deny로 바꿀 수 있음.

---

## 6. Hook 지점 (단일 gate 원칙 — dec-007)

> **모든 callable entry는 단일 enforcement gate를 통과한다.**

builtin 우회로가 생기면 enforcement 철학 자체가 깨지므로 centralize 필수.

| # | 위치 | 처리 |
|---|------|------|
| 1 | `src/eval-call-function.ts:133` `callUserFunction()` 진입부 | enforceEffect(name, args, span) 호출 후 frame push |
| 2 | `src/eval-call-function.ts:409` `callFunctionValue()` 진입부 | 동일 |
| 3 | builtin dispatch 지점 (interpreter.ts 내 builtin 호출) | builtin registry에서 effect 조회 후 동일 gate |
| 4 | TCO 경로 (`callUserFunctionTCO`, `callFunctionValueTCO`) | 동일 enforcement 적용 — 누락 금지 |

### 6-A. 단일 gate 함수 (제안)

```ts
// src/effect-enforcer.ts (신규 파일)
export function enforceCall(
  callee: { name: string; effects: Set<EffectTag> | null },
  span?: Span
): void {
  const cur = effectStack.top();
  if (cur === undefined || cur.allowed === null) return;
  if (callee.effects === null) return;
  for (const e of callee.effects) {
    if (!cur.allowed.has(e)) {
      throw new EffectViolation({
        fn: callee.name,
        target_effect: e,
        allowed: Array.from(cur.allowed),
        chain: effectStack.chainNames(),
        span,
      });
    }
  }
}
```

---

## 7. Builtin Effect Registry

별도 `Map<string, Set<EffectTag>>` 로 분리 (dec-005 결정).

```ts
// src/builtin-effects.ts (신규 파일)
export const BUILTIN_EFFECTS = new Map<string, Set<EffectTag>>([
  // :io
  ["file-write",   new Set(["io"])],
  ["file-read",    new Set(["io"])],
  ["file-append",  new Set(["io"])],
  ["file-delete",  new Set(["io"])],
  ["db-exec",      new Set(["io"])],
  ["db-query",     new Set(["io"])],
  ["println",      new Set(["io"])],
  ["print",        new Set(["io"])],

  // :net
  ["http-get",     new Set(["net"])],
  ["http-post",    new Set(["net"])],
  ["ws-send",      new Set(["net"])],
  ["server-start", new Set(["net"])],

  // :process
  ["shell-exec",      new Set(["process"])],
  ["process-spawn",   new Set(["process"])],

  // :time
  ["now",     new Set(["time"])],
  ["now-ms",  new Set(["time"])],
  ["sleep",   new Set(["time"])],

  // :random
  ["rand",      new Set(["random"])],
  ["rand-int",  new Set(["random"])],
  ["uuid",      new Set(["random"])],

  // :pure (명시적으로 비워서 등록 — 미등록 builtin과 구분)
  // (등록하지 않은 builtin은 null 취급 = unrestricted)
]);
```

### 7-A. 등록 누락 시 동작

미등록 builtin은 `null` (legacy 호환). enforce는 명시 등록된 것만.

### 7-B. 등록 정책

- 신규 builtin 추가 시 BUILTIN_EFFECTS 등록 의무화 (CI lint 후보).
- "등록 안 함 = 묵시적 pure" 로 오해할 수 있으나, 현 단계에서는 의도된 보수적 fallback.

---

## 8. 에러 형식

### 8-A. EffectViolation throw payload

```
EffectViolation:
  pure context cannot call :io function 'file-write'

  effect-chain:
    main
    → analyze-data
    → save-report
    → file-write

  allowed: []
  required: [:io]
  span: app/report.fl:82:4
```

### 8-B. RuntimeEvent payload (replay 연동, D5 확정 shape)

```json
{
  "type": "effect-violation",
  "severity": "error",
  "eventId": 0,
  "timestamp": 0,
  "fn": "save-report",
  "target_effect": "io",
  "allowed": [],
  "chain": ["main", "analyze-data", "save-report"],
  "span": "app/report.fl:82:4"
}
```

- `runtime-events.ts` 의 `RuntimeEvent.type` 유니언에 `"effect-violation"` 추가.
- 위반 시 throw 직전 `recordEvent({ type: "effect-violation", ... })` 호출.
- 기존 `stdlib-audit.ts` `audit_log` 와 자동 연동 (fire-and-forget).

---

## 9. 핵심 철학 (재확인)

- `^{:effects []}` 는 **deterministic assertion** 이다. 이게 enforcement 진짜 가치다.
- 차단 자체가 아니라, **runtime truth evidence 생성**이 본질.
- 위반은 즉시 throw + audit 기록 → replay 추적 가능.

---

## 10. 비목표 (재확인)

이번 단계에서 **절대** 하지 않는다:

- compile-time purity inference (graveyard 등재)
- static typing / ownership / borrow checker
- async/coroutine redesign
- effect polymorphism
- optimizer integration
- capability graph
- `:db` / `:gpu` / `:fs-read|write` 같은 세분화

---

## 11. 성공 기준 (테스트 5종)

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| T1 | `^{:effects []}` 함수 내부에서 `(file-write ...)` 호출 | **FAIL** (EffectViolation) |
| T2 | `^{:effects [:io]}` 함수 내부에서 `(file-write ...)` 호출 | **PASS** |
| T3 | `^{:effects []}` 함수가 `^{:effects []}` 함수만 호출 | **PASS** |
| T4 | `^{:effects []}` 함수 내부에서 `(http-post ...)` 호출 | **FAIL** (EffectViolation) |
| T5 | T1 위반 발생 시 `runtime-events` 에 `effect-violation` 이벤트 1건 기록 | **PASS** |

### 11-A. 회귀 기준

- 기존 1018/1018 테스트 전부 PASS 유지 (메타 없는 함수 = unrestricted 보장)
- bootstrap deterministic SHA 영향: registry/enforcer 신규 모듈만 추가. eval-call-function.ts 변경은 최소 (gate 호출 1줄).
- 만약 SHA가 바뀌면 → `test-bootstrap-verification.ts` 갱신 사유 명시.

---

## 12. 구현 순서 (확정 — 2026-05-20)

> **순서 변경 사유**: registry 안정화가 enforcer보다 우선이다.
> - enforcer는 registry에 의존하므로, registry가 흔들리면 enforcer 작성 중에도 시그니처가 흔들린다.
> - runtime-events 확장은 enforce가 동작한 뒤 연동하는 것이 안전하다 (이벤트 schema가 실제 violation 데이터에 맞춰진다).

1. `src/effect-types.ts` — `EffectTag`, `EffectFrame`, `EffectViolation` 타입
2. `src/builtin-effects.ts` — **BUILTIN_EFFECTS registry (먼저 안정화)**
3. `src/effect-enforcer.ts` — stack + `enforceCall()` + `pushFrame/popFrame` (registry 기반 검증)
4. `src/eval-call-function.ts` — 4개 진입점에 gate hook 삽입 (try/finally)
5. interpreter builtin dispatch 지점에 gate 삽입 (단일 gate 원칙 — dec-007)
6. `src/runtime-events.ts` — `RuntimeEvent.type` 유니언 확장 (실제 violation 발생 후 schema 확정)
7. 테스트 5종 작성 (`src/__tests__/effect-enforcement.test.ts`)
8. 회귀 테스트 1018개 실행
9. bootstrap SHA 비교
10. 블로그 포스팅 + Gogs 푸시

### 12-A. 변곡점 커밋 계획 (feature/effect-enforcement)

| # | 변곡점 | 포함 단계 | 메시지 |
|---|--------|----------|--------|
| C1 | 설계 산출물 | (현재) | `docs: SPEC.airc + DESIGN — runtime effect enforcement MVP` |
| C2 | types + registry | 1+2 | `feat(effect): types + builtin-effects registry` |
| C3 | enforcer 엔진 | 3 | `feat(effect): runtime enforcer with stack semantics` |
| C4 | single gate hooks | 4+5 | `feat(effect): single gate at callUserFunction/callFunctionValue/builtin dispatch` |
| C5 | runtime-events 연동 | 6 | `feat(effect): emit effect-violation runtime event` |
| C6 | 테스트 + 회귀 | 7+8 | `test(effect): T1~T5 + 1018 회귀 통과` |
| C7 | SHA + 블로그 | 9+10 | `chore(effect): bootstrap SHA verified + blog post` |

- 각 변곡점에서 `git push origin feature/effect-enforcement`
- C7 통과 후 master 병합 (squash 금지 — line 보존)
- 회귀 실패 시 amend 금지, 새 커밋으로 fix

### 12-B. 추가 권장 사항 (반영 확정)

**C3 완료 시 — 디버그 플래그**

```ts
// effect-enforcer.ts
const STACK_TRACE = process.env.EFFECT_STACK_TRACE === "1";
if (STACK_TRACE) {
  console.error("[effect] push", fnName, "allowed=", [...allowed ?? []]);
}
```

- 환경변수 `EFFECT_STACK_TRACE=1` 활성화 시 push/pop/check 모두 stderr 출력
- 초기 디버깅 비용 크게 감소
- 운영 기본값은 off (성능 영향 0)

**C6 직전 — Unauthorized Builtin Matrix Test**

- registry에 등록된 모든 builtin에 대해 `:pure` 컨텍스트 호출 → 위반 발생 여부 자동 검증
- 신규 builtin 추가 시 누군가 registry 등록을 빠뜨리면 즉시 회귀 검출
- 위치: `src/__tests__/effect-enforcement-matrix.test.ts`
- 의사 코드:
  ```ts
  for (const [name, effects] of BUILTIN_EFFECTS) {
    if (effects.size === 0) continue;  // pure builtin skip
    expect(() => runInPureContext(`(${name} ...)`)).toThrow(EffectViolation);
  }
  ```
- single gate 우회 회귀를 builtin 추가마다 자동 검출

---

## 13. 변경 영향 요약

| 항목 | 영향 |
|------|------|
| 신규 파일 | 3개 (`effect-types.ts`, `effect-enforcer.ts`, `builtin-effects.ts`) |
| 수정 파일 | 2개 (`eval-call-function.ts`, `runtime-events.ts`) |
| 신규 테스트 | 2개 파일 (`effect-enforcement.test.ts` 5케이스 + `effect-enforcement-matrix.test.ts` registry 전수) |
| ABI 변경 | 없음 |
| FLValue 변경 | 없음 |
| 기존 코드 동작 | 메타 없는 함수는 변화 없음 |
| bootstrap 결정성 | 신규 모듈 추가만, SHA 변동 최소 예상 |

---

## 14. 추적 (SPEC.airc)

- `task-effect-enforcement` — hot task
- `dec-005` — runtime effect enforcement 도입
- `dec-006` — effect metadata absent = legacy unrestricted (**lock**)
- `dec-007` — 모든 callable entry는 단일 gate 통과 (**lock**)
- graveyard:
  - compile-time purity inference
  - `:db`/`:gpu`/`:fs-read|write` 세분화
  - capability graph
  - builtin object 내 `_effects` 어트리뷰트 부착 방식

---

끝.
