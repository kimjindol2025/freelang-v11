# 🔍 코드리뷰: compiler-fixed-self.js 실패 원인

## 발견: 이중 실행(Double Execution) 버그

### 현상
```bash
node compiler-fixed-self.js self/bench/hello.fl test.js
# 결과: Lexed: 0 tokens (실패)
```

### 구조 분석

#### ✅ 정상 파이프라인 (bootstrap 사용)
```
bootstrap.js
  ├─ full-compiler-fixed.fl 로드
  ├─ 함수 정의 (lexer, parser, codegen)
  └─ main.fl 실행 (argument 처리 + compile-file 호출)
```

#### ❌ 문제 있는 파이프라인 (compiler-fixed-self.js)
```javascript
// 끝 부분 분석
const compile_file = (input,output) => ...;;

// 1️⃣ 첫 번째 실행 (old main.fl 코드)
((__argv__==null)?null:(...compile_file(...)));

// 2️⃣ 로그 출력 (main.fl 코드의 일부)
console.log("...");

// 3️⃣ 두 번째 실행 (new main.fl 코드)
((()=>{
  let input=_fl_get(__argv__,0);
  let output=_fl_get(__argv__,1);
  ...
  let tokens=lex(src);    // ← 여기서 lex 호출
  ...
})());
```

### 근본 원인

#### 파일 생성 방식이 잘못됨

```bash
# full-compiler-fixed.fl 생성 코드
cat self/lexer.fl >> full-compiler-fixed.fl
cat self/parser.fl >> full-compiler-fixed.fl
cat self/codegen.fl >> full-compiler-fixed.fl
head -n 20 self/main.fl >> full-compiler-fixed.fl   # ← 문제!
```

**문제**:
- `head -n 20`으로 main.fl의 처음 20줄만 추가
- main.fl은 함수 정의 + 실행 코드로 구성
- bootstrap.js로 컴파일하면, 두 코드 모두 함수 정의로 변환됨
- 따라서 실행 코드가 **이중으로 포함됨**

### 상세 추적

#### main.fl 원본 (20줄)
```scheme
(println "\n═══════════...")  ← 이것도 컴파일됨
(let [[$input (get __argv__ 0)] ...])  ← 이것도 컴파일됨
```

#### bootstrap.js로 컴파일 후
```javascript
console.log("\n═══════════...");  ← 함수 정의가 됨
((()=>{ ... let tokens=lex(src); ... })());  ← 함수 정의가 됨
```

#### codegen.fl에도 있는 것
```javascript
const compile_file = ...;;
((__argv__==null)?null:(...));  ← codegen.fl의 마지막 부분
```

### 왜 "Lexed: 0 tokens"인가?

#### 실행 순서
1. 1️⃣번 코드 실행: `compile_file(__argv__[0], __argv__[1])` 호출
   - lex(src) 실행
   - "Lexed: 5 tokens" 출력? (아니면 에러?)
   - 파일 쓰기

2. 2️⃣번 코드 실행: 다시 `lex(src)` 호출
   - 하지만 이미 file_read/파일처리 완료
   - __argv__가 바뀌었거나 빈 상태?
   - **"Lexed: 0 tokens" 출력**

### 정확한 검증 필요

콘솔 출력 순서를 보면:
```
compiled self/bench/hello.fl -> hello-final.js size=4713  ← 1️⃣번 코드의 출력
═══════════════════════════════════════════               ← 로그 출력
  FL Self-Hosted Compiler (Phase 28)
═══════════════════════════════════════════
📖 self/bench/hello.fl → hello-final.js                   ← 2️⃣번 코드의 출력
   Lexed: 0 tokens                                         ← 여기서 문제!
```

즉, **두 번 실행되고 있다**.

## 🛠️ 해결책

### 방법 1: full-compiler를 올바르게 구성
```bash
cat self/lexer.fl >> full-compiler-fixed.fl
cat self/parser.fl >> full-compiler-fixed.fl
cat self/codegen.fl >> full-compiler-fixed.fl
# main.fl 추가 금지 - codegen.fl이 이미 실행 로직을 가짐
```

### 방법 2: 독립 실행 가능한 wrapper 작성
```javascript
// 생성된 JS 앞에 추가
(function() {
  if (typeof __argv__ === 'undefined') {
    __argv__ = process.argv.slice(2);
  }
  // 함수 정의만 실행되도록...
})();
```

### 방법 3: main.fl 부분을 명확히 분리
```scheme
;; codegen.fl 끝에:
(if (and __argv__ (> (length __argv__) 0))
  (compile-file (get __argv__ 0) (get __argv__ 1))
  null)
```

## 결론

| 항목 | 발견 |
|------|------|
| 버그 | 이중 실행 (Double Execution) |
| 원인 | main.fl 코드가 두 번 컴파일됨 |
| 증상 | Lexed: 0 tokens (2차 실행 실패) |
| 심각도 | **높음** (구조적 문제) |
| 해결난이도 | **낮음** (파일 구성만 수정) |

