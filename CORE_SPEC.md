# FreeLang v11 — Core Spec

**계층**: Layer 4 (언어 의미론)  
**원칙**: 언어 의미론에 필수적인 것만 포함

---

## 1. 파싱 파이프라인

```
소스 문자열
  → Lexer (lexer.ts) → 토큰 스트림
  → Parser (parser.ts) → AST
  → Interpreter (interpreter.ts) → 값
```

### Lexer 예약 토큰
| 토큰 | 설명 |
|------|------|
| `T.Open` | 모듈 open 구문 (`open "path"`) |
| `T.If` | 조건 분기 |
| `T.Let` | 바인딩 |
| `T.Fn` | 익명 함수 |
| `T.Do` | 순차 실행 |

---

## 2. 핵심 특수 폼 (eval-special-forms.ts)

### 바인딩 & 정의
| 폼 | 문법 | 설명 |
|----|------|------|
| `let` | `(let [$x 1 $y 2] body)` | 지역 바인딩 |
| `define` | `(define name value)` | 전역 정의 |
| `defn` / `defun` | `(defn name [$args] body)` | 함수 정의 (동일) |
| `fn` | `(fn [$x] body)` | 익명 함수 |

### 제어 흐름
| 폼 | 문법 | 설명 |
|----|------|------|
| `if` | `(if cond then else?)` | 조건 분기 |
| `when` | `(when cond body+)` | cond=true 시 실행 |
| `unless` | `(unless cond body+)` | cond=false 시 실행 |
| `do` | `(do expr+)` | 순차 실행 |
| `try` | `(try body (catch e handler))` | 에러 처리 |
| `recur` | `(recur args)` | 꼬리 재귀 |

### 패턴 매칭
| 폼 | 문법 | 설명 |
|----|------|------|
| `match` | `(match val (pat body)+)` | 패턴 매칭 |
| `case` | `(case val (val body)+)` | 값 분기 |

### 모듈
| 폼 | 문법 | 설명 |
|----|------|------|
| `import` | `(import "path")` | 모듈 로드 (심볼 방식) |
| `open` | `(open "path")` | 모듈 로드 (레거시 토큰 방식) |

> **주의**: `import`와 `open`은 내부 처리 경로가 다름.  
> `import` → 심볼로 처리 후 eval-special-forms.ts:1616  
> `open` → parser.ts에서 전용 AST 노드로 처리

---

## 3. 파라미터 규칙

**FreeLang 파라미터는 반드시 `$` 접두사 사용:**

```lisp
;; ✅ 올바름
(defn add [$x $y] (+ $x $y))
(fn [$a $b] (* $a $b))

;; ❌ 오류
(defn add [x y] (+ x y))
```

---

## 4. 타입 시스템

**런타임 타입 (flTypeOf 기준):**
| 타입 | 설명 |
|------|------|
| `nil` | null/undefined |
| `number` | 정수/부동소수 |
| `string` | 문자열 |
| `boolean` | true/false |
| `array` | 배열 `[]` |
| `map` | Map 객체 |
| `function` | 함수/클로저 |

---

## 5. 오류 처리

```lisp
;; try-catch 패턴 (필수)
(try
  (risky-operation)
  (catch $e
    (println "에러:" $e)))
```

---

## 6. 비동기

```lisp
;; await 패턴
(defn fetch-data [$url]
  (await (http-get $url)))
```

---

## 7. 핵심 파일 목록

| 파일 | 역할 | 크기 |
|------|------|------|
| `lexer.ts` | 토크나이저 | — |
| `parser.ts` | AST 생성 | 2,744줄 |
| `interpreter.ts` | 메인 평가기 | 2,367줄 |
| `eval-special-forms.ts` | 특수 폼 처리 | 2,401줄 |
| `eval-call-function.ts` | 함수 호출 | 795줄 |
| `eval-pattern-match.ts` | 패턴 매칭 | — |
| `ast.ts` | AST 노드 타입 | — |
| `errors.ts` | 에러 타입 | — |
| `type-checker.ts` | 타입 체크 | — |
| `async-runtime.ts` | 비동기 런타임 | — |
