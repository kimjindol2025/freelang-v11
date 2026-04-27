# FreeLang v11 예약어 (Reserved Words)

FreeLang v11의 예약어(reserved identifiers)는 사용자 정의 함수/변수 이름으로 사용할 수 없습니다.

## 특수폼 (Special Forms)

| 예약어 | 용도 | 예시 |
|--------|------|------|
| `loop` | 루프 시작 | `(loop [i 0] (recur (+ i 1)))` |
| `recur` | 재귀 호출 | `(recur (+ i 1))` |
| `let` | 변수 바인딩 | `(let [x 10] x)` |
| `if` | 조건문 | `(if cond then else)` |
| `cond` | 다중 조건 | `(cond [test1 val1] [test2 val2])` |
| `quote` | 따옴표 | `'(a b c)` |
| `~` | 언쿼트 | `` `(a ~b c) `` |

## 함수 정의 (Function Definition)

| 예약어 | 용도 |
|--------|------|
| `defn` | 함수 정의 (권장) |
| `defun` | 함수 정의 (Common Lisp 호환) |
| `fn` | 익명 함수 |
| `defmacro` | 매크로 정의 |

## 제어 흐름

| 예약어 | 용도 |
|--------|------|
| `do` | 순차 실행 |
| `try` | 예외 처리 |
| `catch` | 예외 처리 |
| `throw` | 예외 발생 |
| `use` | 플러그인 로드 |

## 식별자 충돌 시 처리

**컴파일 에러** (defn 단계에서 감지):
```
Error: 'loop' is a reserved word and cannot be used as a function name
  at line 5, col 8
  (defn loop [x] (+ x 1))
        ^^^^
Hint: Use a different name like 'my-loop', 'custom-loop', etc.
```

**해결 방법**:
1. 함수명 변경: `(defn my-loop [x] ...)`
2. 특수폼 이름이 필요한 경우, 언어 설계 검토 필요

## 구현 상태

- ✅ 예약어 목록 정의
- ⏳ defn 검증 추가 (src/interpreter.ts, self/codegen.fl)
- ⏳ 명확한 에러 메시지

## 참고

- **언어 정의 단일성**: bootstrap과 self-hosted codegen이 동일한 예약어 검증 수행
- **미래 계획**: Phase C-3에서 컴파일 시 자동 검증
