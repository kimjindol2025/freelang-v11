# FreeLang v11 예약 식별자 (Reserved Identifiers)

**목적**: 사용자 정의 불가능한 특수폼/키워드 명시. defn/let에서 충돌 감지.

---

## 📋 예약 특수폼 (Special Forms)

이 식별자들은 **사용자가 정의할 수 없습니다**.

### 제어 흐름
- `if` — 조건 분기
- `cond` — 다중 조건
- `do` / `begin` / `progn` — 순차 실행
- `while` — 루프
- `loop` — 루프 (recur 필요) ← **⚠️ 주의**: 이름만으로 충돌
- `recur` — 루프 재귀

### 함수 정의
- `fn` — 익명 함수
- `defn` / `defun` — 함수 정의
- `lambda` — 람다

### 로직
- `and` / `or` — 논리 연산
- `not` — 논리 부정

### 변수 바인딩
- `let` — 로컬 바인딩
- `set!` — 변수 재할당
- `define` — 전역 정의

### 비동기/에러
- `async` — 비동기 함수
- `await` — 비동기 대기
- `try` / `catch` / `finally` — 예외 처리
- `throw` — 예외 발생

### 메타
- `quote` — 쿼트
- `eval` — 평가
- `macro` / `defmacro` — 매크로

### 기타
- `compose` — 함수 합성
- `pipe` / `->` / `->>` / `|>` — 파이프라인

---

## ⚙️ 컴파일 타임 검증

### defn 검증

```fl
(defn loop [n] ...)  ; ❌ 에러: loop는 예약 특수폼
(defn fact [n] ...)  ; ✅ OK
```

**구현**: `cg-defn`에서 함수 이름 검증

```fl
[FUNC is-reserved? :params [$name]
  :body (or (= $name "loop") (= $name "recur") ...)]

[FUNC cg-defn :params [$args]
  :body (let [[$name-n (get $args 0)]
              [$name (extract-name $name-n)]]
          (if (is-reserved? $name)
            (throw (str "Error: '" $name "' is reserved"))
            ...))]
```

### let 검증 (선택)

```fl
(let [[loop (fn ...)]] ...)  ; ⚠️ 경고 또는 에러
```

**현재**: let은 검증 안 함 (사용자 책임)

---

## 🔜 회피 방법

**권장**: 다른 이름 사용

```fl
; ❌ 피할 것
(defn loop [n] (if (= n 0) 0 (loop (- n 1))))

; ✅ 권장
(defn countdown [n] (if (= n 0) 0 (countdown (- n 1))))
(defn my-loop [n] (if (= n 0) 0 (my-loop (- n 1))))
```

---

## 📊 JavaScript 예약어 (추가)

FreeLang은 JS로 컴파일되므로, 다음도 피하는 것이 좋습니다:

- `class`, `const`, `let`, `var`, `function`, `return`
- `if`, `else`, `switch`, `case`, `break`, `continue`
- `for`, `while`, `do`, `try`, `catch`, `finally`
- `new`, `delete`, `typeof`, `instanceof`, `in`, `of`
- `this`, `super`, `null`, `true`, `false`, `undefined`

**자동 회피**: codegen에서 자동으로 `_` 접미사 추가

```
class → class_
const → const_
```

---

## 🎯 설계 철학

**언어 정의 단일성**: interpreter와 codegen이 같은 예약어 목록을 사용해야 함.

**명확성 > 유연성**: 특수폼과 사용자 정의의 경계를 명확히 함.

---

**마지막 수정**: 2026-04-26 (Phase C, C3 해결)
