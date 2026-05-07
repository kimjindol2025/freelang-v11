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

## 정적 타입 검사기 (check 명령어, 2026-05-07~)

`freelang check file.fl` — 실행 없이 컴파일 타임 타입 검사. `FREELANG_STRICT=1`과 독립적으로 동작.

### 검사 항목

| 코드 | 종류 | 설명 |
|------|------|------|
| `arity` | error | 인자 수 불일치 |
| `type-mismatch` | warning | 타입 힌트 파라미터에 다른 타입 전달 |
| `return-type` | warning | 선언 반환 타입과 실제 반환 리터럴 불일치 |

### 타입 추론 범위

정적 검사기는 다음 세 가지 소스에서 변수 타입을 추론한다:

**1. 리터럴 직접 전달**
```lisp
(defn greet [^string $name] ...)
(greet 42)   ;; ⚠ type-mismatch: number → ^string
```

**2. define 바인딩 추론 (L-01, 2026-05-07~)**
```lisp
(define x "hello")
(greet x)    ;; x가 string임을 추론 → 경고 없음
(define n 42)
(greet n)    ;; n이 number임을 추론 → ⚠ type-mismatch
```

**3. let 바인딩 추론 (S4-01, 2026-05-07~)**
```lisp
(let [[$n 42] [$s "hi"]]
  (greet $n)   ;; $n이 number → ⚠ type-mismatch
  (greet $s))  ;; $s가 string → 경고 없음
```

### Return Type 검사 (S4-02, 2026-05-07~)

`^type` 반환 힌트를 선언하고 body 마지막 expression이 리터럴이면 타입을 비교한다.

```lisp
(defn ^number compute [] "not-a-number")
;; ⚠ return-type: 선언 반환 타입 ^number이나 string 리터럴 반환

(defn ^string label [] "active")   ;; ✅ 일치
(defn ^number count [] 42)         ;; ✅ 일치
```

**설계 원칙**: "sounded but not complete" — 변수 반환이나 조건 분기 반환은 검사하지 않음 (false positive 방지).

```lisp
(defn ^number maybe [^bool $flag]
  (if $flag 1 "no"))   ;; 마지막 expr이 sexpr → 검사 skip
```

### 사용

```bash
freelang check app.fl

# 출력 예:
# ✖  line 5: arity — (my-fn) — 인자 3개 전달, 2개 필요
# ⚠  line 8: type-mismatch — (greet) — $name: ^string 파라미터에 number 전달
# ⚠  line 12: return-type — (compute) — 선언 반환 타입 ^number이나 string 리터럴 반환
```

---

## 한계 + 향후 개선

**현재 한계**:
- 제네릭 (`<T>`) 부분 지원
- let 추론은 같은 파일 스코프만 (cross-file 미지원)
- return-type은 리터럴 반환만 검사 (변수/조건 반환 skip)
- Union 타입 (`int | string`) 미지원

**로드맵**:
- Union 타입
- Record 타입 (`{:name string :age int}`)
- 패턴 매치 + 타입 narrowing
- IDE LSP 통합 (TypeChecker → diagnostics)

---

생성: 2026-04-25 (M1 활성화 후)  
업데이트: 2026-05-07 (정적 검사기 let/return-type 강화)
근거: 사용자 평가 — 타입 안정성 78점이 가장 큰 약점
