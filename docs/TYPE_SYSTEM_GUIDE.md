# FreeLang v11 — 타입 시스템 가이드 (M1, 2026-04-25)

**선택적 정적 타입 (opt-in)** — 기본은 동적, `FREELANG_STRICT=1`로 활성화.

## 빠른 시작

### 1. 타입 어노테이션 문법

```fl
;; 기존 (타입 없음, 동적)
[FUNC add :params [$a $b] :body (+ $a $b)]

;; 타입 어노테이션 (Phase 3 도입, 2차원 형태)
[FUNC add :params [[$a int] [$b int]] :ret int :body (+ $a $b)]
```

### 2. Strict 모드 활성화

```bash
# 정상 호출
FREELANG_STRICT=1 node bootstrap.js run my.fl

# 타입 위반 시 즉시 에러 (E_TYPE_MISMATCH)
```

### 3. 에러 메시지 (Phase A FLRuntimeError 통합)

```
오류: [E_TYPE_MISMATCH] 'add': arg 1 expected int, got string
컨텍스트: fn=add  arg=0  expected=int  got=string
힌트: 기대 타입과 다릅니다. (string? x) (number? x) 등으로 사전 검증하거나 변환 함수를 사용하세요.
```

## 지원 타입

| 타입 | 의미 | inferType 결과 |
|------|------|---------------|
| `int` | 정수 | Number.isInteger |
| `float` | 실수 | typeof === "number" |
| `number` | int 또는 float | typeof === "number" |
| `string` | 문자열 | typeof === "string" |
| `bool` / `boolean` | 참/거짓 | typeof === "boolean" |
| `array` / `list` | 배열 | Array.isArray |
| `map` | 맵/객체 | typeof === "object" |
| `fn` / `function` | 함수 | typeof === "function" 또는 fn-value |
| `any` | 모든 타입 | (검증 스킵) |
| `null` | null/nil | === null |

## 사용 예제

### 정상 케이스
```fl
[FUNC greet :params [[$name string]] :ret string
  :body (str "Hello, " $name)]

(println (greet "Alice"))   ;; → "Hello, Alice"
```

### 타입 위반 (FREELANG_STRICT=1)
```fl
(greet 42)
;; → [E_TYPE_MISMATCH] 'greet': arg 1 expected string, got int
```

### 반환 타입 검증
```fl
[FUNC bad-fn :params [[$x int]] :ret string
  :body (* $x 2)]   ;; ❌ ret int인데 string 기대

(bad-fn 5)
;; → [E_TYPE_MISMATCH] 'bad-fn' return: expected string, got int
```

## 점진적 도입 권장

1. **모든 함수에 타입 적용 X** — 핵심 API에만
2. `FREELANG_STRICT=1` 빌드/CI에서만 활성화 (개발은 동적)
3. 타입 어노테이션 없는 함수는 그대로 동적 동작
4. 점진적으로 어노테이션 추가 → 안전성 ↑

## 빌트인 시그니처 (자동 검증)

`src/stdlib-types.ts` 의 `BUILTIN_TYPE_SIGS`:

```ts
"+":    { params: ["number", "number"], ret: "number" },
"length":   { params: ["any"],         ret: "int" },
"map":      { params: ["array", "fn"], ret: "array" },
...
```

`FREELANG_STRICT=1`에서 builtin 호출도 검증.

## 환경변수 비교

| 변수 | 효과 |
|------|------|
| `FREELANG_STRICT=1` | **타입 검증 활성화** (M1) |
| `FL_STRICT=1` | nil 접근 시 E_TYPE_NIL throw (Phase C) |
| `FL_TRACE=1` | 함수 호출 trace 출력 (Phase E) |

세 가지 모두 활성화 가능: `FREELANG_STRICT=1 FL_STRICT=1 FL_TRACE=1 node ...`

## CI 통합 권장

```yaml
# .github/workflows/test.yml
- name: 타입 검증 (strict)
  env:
    FREELANG_STRICT: "1"
  run: make verify-all
```

## 한계 + 향후 개선

**현재 한계**:
- 제네릭 (`<T>`) 부분 지원
- 타입 추론은 호출 시점만 (선언 시점 추론 미흡)
- Union 타입 (`int | string`) 미지원
- struct/protocol 타입 일부

**1년 로드맵 (M1 후속)**:
- Union 타입
- Record 타입 (`{:name string :age int}`)
- 패턴 매치 + 타입 narrowing
- IDE LSP 통합 (TypeChecker → diagnostics)

---

생성: 2026-04-25 (M1 활성화 후)
근거: 사용자 평가 — 타입 안정성 78점이 가장 큰 약점
