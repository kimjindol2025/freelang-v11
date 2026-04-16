# v11 스크립트 모드 설계

## 개요

**스크립트 모드** = S-expression의 문법설탕  
- 입력: Python처럼 간단한 문법  
- 내부: 100% S-expr로 변환  
- 출력: 표준 v11 인터프리터로 실행

---

## 문법 매핑

### 함수 정의
```
스크립트 (입력)                S-expr (변환)
─────────────────────────────────────────
func greet(name) {      →    (defn greet [name]
  return "Hello"              "Hello")
}

func add(a, b) {        →    (defn add [a b]
  return a + b                (+ a b))
}
```

### 변수 할당
```
x = 10              →    (def x 10)
name = "Alice"      →    (def name "Alice")
```

### 함수 호출
```
print(x)            →    (print x)
greet("World")      →    (greet "World")
add(2, 3)           →    (+ 2 3)  ; 연산자는 특수 처리
```

### 제어문
```
if x > 5 {          →    (if (> x 5)
  print("large")         (print "large")
}                        nil)

while x > 0 {       →    (while (> x 0)
  x = x - 1              (def x (- x 1)))
}
```

### 연산자
```
a + b               →    (+ a b)
a - b               →    (- a b)
a * b               →    (* a b)
a / b               →    (/ a b)
a > b               →    (> a b)
a == b              →    (= a b)
```

---

## 구현 계획

### 파일 구조
```
freelang-v11/src/
├── lexer.ts              # S-expr 렉서 (기존)
├── parser.ts             # S-expr 파서 (기존)
├── script-lexer.ts       # 스크립트 렉서 (신규)
├── script-parser.ts      # 스크립트 파서 (신규)
├── script-compiler.ts    # 스크립트 → S-expr (신규)
└── cli.ts                # .script 파일 지원 추가
```

### Phase 별 구현

#### Phase 1: 렉서 (script-lexer.ts)
- 토큰화: func, return, if, while, {}, =, +, -, *, / 등
- 들여쓰기 감지
- 주석 처리 (#으로 시작)
- 문자열/숫자 파싱

#### Phase 2: 파서 (script-parser.ts)
- AST 생성: FuncDef, VarAssign, IfStmt, WhileLoop, Call 등
- 들여쓰기 블록 처리
- 연산자 우선순위

#### Phase 3: 컴파일러 (script-compiler.ts)
- AST → S-expr 변환
- 변수 스코핑
- 타입 체크 (기본)

#### Phase 4: CLI 통합 (cli.ts 수정)
- .script 파일 감지
- 자동 컴파일 후 실행
- `node bootstrap.js run app.script` 지원

#### Phase 5: 테스트 (50~100개)
- 함수 정의/호출
- 변수 할당
- 제어문
- 연산자
- 혼합 코드 (스크립트 + S-expr)

---

## 스크립트 예제

### 간단한 함수
```script
func fibonacci(n) {
  if n <= 1 {
    return n
  }
  return fibonacci(n - 1) + fibonacci(n - 2)
}

print(fibonacci(5))  ; 5
```

### 변수 + 루프
```script
x = 0
while x < 5 {
  print(x)
  x = x + 1
}
```

### 여러 함수
```script
func double(x) {
  return x * 2
}

func addOne(x) {
  return x + 1
}

result = double(addOne(5))
print(result)  ; 12
```

---

## v11 철학 유지

✅ **AI-Native**: 스크립트도 S-expr로 변환되므로 [COT], [AGENT] 등 모두 지원  
✅ **의존성 제로**: 파서 코드만 추가 (npm 패키지 없음)  
✅ **S-expr 기반**: 내부적으로 100% S-expr 실행  

---

## 테스트 전략

| 카테고리 | 테스트 수 | 예제 |
|---------|---------|------|
| 함수 정의 | 10 | func, return, 파라미터 |
| 변수 할당 | 5 | x = 10, 타입 다양성 |
| 연산자 | 15 | +, -, *, /, >, <, == |
| 제어문 | 15 | if, while, 중첩 |
| 함수 호출 | 10 | 일반 호출, 재귀, 여러 파라미터 |
| 혼합 코드 | 10 | 스크립트 + S-expr 섞임 |
| 엣지 케이스 | 20 | 빈 함수, 깊은 중첩 등 |
| **합계** | **85** | |

---

## 다음 단계

1. script-lexer.ts 구현
2. script-parser.ts 구현
3. script-compiler.ts 구현
4. cli.ts 수정
5. 테스트 85개 작성 & 통과
6. CLAUDE.md 갱신 (스크립트 모드 사용법)
