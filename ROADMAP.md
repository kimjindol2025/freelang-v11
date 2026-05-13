# FreeLang 독립 언어 로드맵

최종 목표: `./freelang hello.fl` — Node.js 없이 실행  
작성일: 2026-05-13

**원칙**: 각 중간단계 통과 실패 시 해당 Stage 처음부터 재시작.

---

## Stage 1 — Level 3 부트스트랩

**목표**: `all.fl.out.js`가 기본 스택으로 `all.fl` 자신을 컴파일한다

### 원인 (정확히 파악됨)

`all.fl` 112번째 줄 `read-string-iter`가 재귀 defn으로 구현됨.  
codegen이 이를 JS 재귀 함수로 변환 → 긴 문자열(396자)에서 스택 초과.  
`loop/recur`로 바꾸면 codegen이 `while(true)` JS로 변환 → 스택 없음.

### 중간단계 1-A — 코드 리뷰

확인할 것:
- `all.fl:112` `read-string-iter`가 재귀인가 (yes → 수정 대상)
- `all.fl`에 같은 패턴의 재귀 함수가 더 있는가 (있으면 같이 수정)
- `codegen.fl`의 `cg-loop`이 `while(true)` JS를 올바르게 뱉는가

통과 기준: 수정할 함수 목록과 수정 방향이 명확히 정해짐  
실패 시: Stage 1 처음부터

### 중간단계 1-B — 수정

`read-string-iter`를 `loop/recur`로 전환:

```lisp
;; 변경 전 (재귀)
(defn read-string-iter [$cur $res_acc $line $col]
  (if (at-end? $cur) ...
    (cond
      ...
      [true (read-string-iter (advance $cur) (str $res_acc $c) $line $col)])))

;; 변경 후 (loop/recur)
(defn read-string-iter [$cur $res_acc $line $col]
  (loop [$cur $cur $res_acc $res_acc]
    (if (at-end? $cur) (emit $cur "String" $res_acc $line $col)
      (let [[$c (peek $cur)]]
        (cond
          [(= $c "\"") (emit (advance $cur) "String" $res_acc $line $col)]
          [(= $c "\\")
           (let [[$st2 (advance $cur)] [$c2 (peek $st2)]]
             (recur (advance $st2) (str $res_acc (translate-esc $c2))))]
          [true (recur (advance $cur) (str $res_acc $c))])))))
```

통과 기준: 수정된 코드가 문법 오류 없이 bootstrap.js로 실행됨  
실패 시: Stage 1 처음부터

### 중간단계 1-C — 테스트

```bash
# T1-1: 수정 전 실패 확인 (기준선)
node self/all.fl.out.js self/all.fl /tmp/x.js
기대: RangeError

# T1-2: 수정 후 all.fl 재컴파일
node bootstrap.js run self/all.fl self/all.fl /tmp/all2.js
기대: "Compiled self/all.fl -> /tmp/all2.js"

# T1-3: all2.js가 기본 스택으로 verify.fl 컴파일
node /tmp/all2.js self/verify.fl /tmp/verify2.js && node /tmp/verify2.js
기대: "✅ Self-hosting verification passed!"

# T1-4: all2.js가 기본 스택으로 all.fl 컴파일
node /tmp/all2.js self/all.fl /tmp/all3.js
기대: 에러 없이 완료

# T1-5: 고정점 확인
diff /tmp/all2.js /tmp/all3.js
기대: IDENTICAL
```

T1-1 ~ T1-5 모두 통과해야 Stage 1 완료.  
하나라도 실패 시: Stage 1 처음부터

### 중간단계 1-D — 디버그

T1-2 실패 시:
```
step 1: bootstrap.js로 수정된 read-string-iter 단독 실행 확인
step 2: codegen이 loop/recur를 while(true)로 변환하는지 확인
  node bootstrap.js run self/all.fl self/test_loop.fl /tmp/t.js && cat /tmp/t.js
step 3: 생성된 JS에 재귀가 남아있으면 cg-loop 버그 → cg-loop 수정
step 4: 다른 재귀 함수가 스택 터뜨리면 같은 방식으로 수정
```

T1-5 실패 (not IDENTICAL) 시:
```
step 1: diff 결과 확인 — 어느 부분이 다른가
step 2: 비결정론적 출력이면 (타임스탬프 등) 제거
step 3: 로직 차이면 수정 후 T1-2부터 재실행
```

---

## Stage 2 — C 코드젠 백엔드

**목표**: `hello.fl → hello.c → gcc → ./hello` (Node 없이)

### 중간단계 2-A — 코드 리뷰

확인할 것:
- `codegen.fl`에서 C로 변환 가능한 노드 종류 목록 작성
- C로 변환 불가능한 것 명시 (1단계에서 지원 안 할 것):
  - 클로저 (함수가 변수를 캡처하는 경우)
  - 가변 인자
  - 동적 타입 맵 (1단계 제외)
- `runtime.c`가 제공할 함수 목록 확정

통과 기준: "지원할 것 / 지원 안 할 것" 목록이 문서로 존재  
실패 시: Stage 2 처음부터

### 중간단계 2-B — 최소 구현

`codegen-c.fl` 작성. 지원 범위:
- 숫자 리터럴, 문자열 리터럴
- `defn` (최상위 함수 정의만)
- `if`, `cond`
- `let`
- `+`, `-`, `*`, `/`, `=`, `<`, `>`
- `println`

클로저, `map`, `filter` — 제외.

통과 기준: 위 범위 내 FL 코드를 C로 변환, gcc 문법 오류 없음  
실패 시: Stage 2 처음부터

### 중간단계 2-C — 테스트

```bash
# T2-1: hello.fl → hello.c
node self/all2.js --target c examples/hello.fl /tmp/hello.c
기대: hello.c 생성

# T2-2: gcc 컴파일
gcc /tmp/hello.c runtime/runtime.c -o /tmp/hello
기대: 경고 없이 바이너리 생성

# T2-3: 실행
/tmp/hello
기대: Hello, World!

# T2-4: 숫자 연산
# (println (+ 1 2)) → "3"

# T2-5: 조건문
# (if true (println "yes") (println "no")) → "yes"

# T2-6: 재귀 (핵심)
# (defn fib [n] (if (<= n 1) n (+ (fib (- n 1)) (fib (- n 2)))))
# (println (fib 10)) → "55"
```

T2-1 ~ T2-6 모두 통과해야 Stage 2 완료.  
하나라도 실패 시: Stage 2 처음부터

### 중간단계 2-D — 디버그

T2-2 gcc 오류 시:
```
step 1: 오류 메시지 그대로 읽기
step 2: 해당 C 코드가 어떤 FL 노드에서 생성됐는지 추적
step 3: codegen-c.fl 해당 부분 수정
step 4: T2-1부터 재실행
```

T2-6 결과 불일치 시:
```
step 1: Node로 실행한 결과 vs ./hello 결과 diff
  node bootstrap.js run test_fib.fl > /tmp/expected.txt
  ./hello > /tmp/actual.txt
  diff /tmp/expected.txt /tmp/actual.txt
step 2: 차이 있는 연산 찾아서 codegen-c.fl 수정
```

---

## Stage 3 — 최소 C 런타임

**목표**: `runtime.c` 500줄 이하, 경고 없이 컴파일

### 중간단계 3-A — 코드 리뷰

확인할 것:
- Stage 2 T2-1 ~ T2-6 통과에 필요한 함수만 있는가
- 불필요한 함수가 포함됐는가 (있으면 제거)
- 메모리 해제 전략이 명확한가 (arena 또는 수동)

통과 기준: 함수 목록이 확정되고 불필요한 것 없음  
실패 시: Stage 3 처음부터

### 중간단계 3-B — 구현

```c
// 타입
typedef enum { FL_NIL, FL_NUM, FL_STR } fl_tag;
typedef struct { fl_tag tag; double num; const char* str; } fl_val;

// 생성
fl_val fl_nil();
fl_val fl_num(double n);
fl_val fl_str(const char* s);

// 연산
fl_val fl_add(fl_val a, fl_val b);
fl_val fl_sub(fl_val a, fl_val b);
fl_val fl_mul(fl_val a, fl_val b);
fl_val fl_div(fl_val a, fl_val b);
fl_val fl_eq(fl_val a, fl_val b);
fl_val fl_lt(fl_val a, fl_val b);

// I/O
fl_val fl_println(fl_val v);
fl_val fl_file_read(fl_val path);
fl_val fl_file_write(fl_val path, fl_val content);
```

통과 기준: 위 함수 전부 구현, 500줄 이하  
실패 시: Stage 3 처음부터

### 중간단계 3-C — 테스트

```bash
# T3-1: 크기
wc -l runtime/runtime.c
기대: 500 이하

# T3-2: 경고 없이 컴파일
gcc -Wall -Wextra -c runtime/runtime.c -o /dev/null
기대: 출력 없음 (경고 0)

# T3-3: 단위 테스트 (test_runtime.c 작성)
gcc test_runtime.c runtime/runtime.c -o test_runtime && ./test_runtime
기대: 숫자/문자열/nil/연산/파일 모두 PASS
```

T3-1 ~ T3-3 모두 통과해야 Stage 3 완료.  
실패 시: Stage 3 처음부터

### 중간단계 3-D — 디버그

500줄 초과 시:
```
step 1: 어떤 함수가 가장 긴지 확인
step 2: array/map 관련 함수 제거 (Stage 2가 이 없이 통과했다면)
step 3: 반복 코드 매크로로 줄이기
```

T3-2 경고 시:
```
step 1: 경고 메시지 그대로 읽기
step 2: 해당 줄 수정
step 3: T3-2 재실행 — 경고 0 될 때까지
```

---

## Stage 4 — Node 없이 실행

**목표**: `PATH=/usr/bin:/bin ./freelang hello.fl` 성공

### 중간단계 4-A — 코드 리뷰

확인할 것:
- Stage 1~3 검증 결과물이 모두 존재하는가
  - `/tmp/all2.js` — Level 3 부트스트랩
  - `codegen-c.fl` — C 코드젠
  - `runtime/runtime.c` — C 런타임
- 컴파일러 진입점(`main` 함수)이 정의됐는가
- `freelang input.fl` 실행 흐름이 설계됐는가

통과 기준: 세 결과물 존재 + 진입점 설계 완료  
실패 시: Stage 4 처음부터

### 중간단계 4-B — 빌드

```bash
# 컴파일러를 C로 컴파일
node /tmp/all2.js --target c self/all.fl freelang_compiler.c

# 바이너리 빌드
gcc freelang_compiler.c runtime/runtime.c -o freelang
```

통과 기준: `freelang` 바이너리 생성, 링크 오류 없음  
실패 시: Stage 4 처음부터

### 중간단계 4-C — 테스트

```bash
# T4-1: hello.fl
PATH=/usr/bin:/bin ./freelang examples/hello.fl
기대: Hello, World!

# T4-2: 재귀
PATH=/usr/bin:/bin ./freelang examples/fib.fl
기대: 55

# T4-3: 파일 읽기/쓰기
PATH=/usr/bin:/bin ./freelang examples/fileio.fl
기대: 파일 생성 및 읽기 성공

# T4-4: 오류 처리
PATH=/usr/bin:/bin ./freelang 없는파일.fl
기대: 에러 메시지, exit code 1

# T4-5: Node 결과와 동일
node bootstrap.js run examples/hello.fl > /tmp/expected.txt
PATH=/usr/bin:/bin ./freelang examples/hello.fl > /tmp/actual.txt
diff /tmp/expected.txt /tmp/actual.txt
기대: IDENTICAL
```

T4-1 ~ T4-5 모두 통과해야 Stage 4 완료 = **목표 달성**.  
하나라도 실패 시: Stage 4 처음부터

### 중간단계 4-D — 디버그

링크 오류 시:
```
step 1: undefined reference to 'fl_xxx' 확인
step 2: runtime.c에 해당 함수 추가
step 3: Stage 3로 돌아가 T3-1 재확인 (500줄 초과 여부)
```

segfault 시:
```
step 1: gcc -g 로 다시 빌드
step 2: gdb ./freelang examples/hello.fl
step 3: bt (backtrace) 로 오류 위치 확인
step 4: NULL 포인터 역참조가 원인이면 fl_val 생성 함수 점검
```

T4-5 결과 불일치 시:
```
step 1: diff 결과에서 첫 번째 차이 확인
step 2: 해당 연산을 단독 FL 파일로 추출해서 비교
step 3: codegen-c.fl 해당 노드 수정
step 4: T4-1부터 재실행
```

---

## 현재 상태

| Stage | 중간단계 | 상태 |
|-------|---------|------|
| 1 | 1-A 코드 리뷰 | ✅ 완료 |
| 1 | 1-B 수정 | ✅ 완료 |
| 1 | 1-C 테스트 | ✅ 완료 |
| 1 | 1-D 디버그 | ✅ 완료 (불필요) |
| 2 | 2-A 코드 리뷰 | ✅ 완료 |
| 2 | 2-B 구현 | ✅ 완료 |
| 2 | 2-C 테스트 | ✅ 완료 (T2-1~T2-6) |
| 2 | 2-D 디버그 | ✅ 완료 (불필요) |
| 3 | 3-A ~ 3-D | ✅ 완료 |
| 4 | 4-A ~ 4-D | ✅ 완료 |

## 규칙

- 중간단계 실패 시 해당 Stage 처음부터 재시작
- 검증은 실제 명령 실행으로만 — 눈으로 보고 통과 선언 금지
- 디버그 계획은 순서대로 — 건너뛰지 않는다
- 코드는 줄이는 방향으로
