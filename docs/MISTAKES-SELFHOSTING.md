# FreeLang 자가호스팅 실수 기록

작성일: 2026-05-13  
작성자: Claude (내 언어, 내 책임)

---

## 핵심 목표 (처음부터 이랬어야 했다)

**FreeLang이 Node.js 없이 실행되는 독립 언어가 되는 것.**

---

## 실수 1 — 목표를 정의하지 않았다

### 무슨 일이 있었나
Phase A, B, C, D, E, F... 이름만 붙이고 달렸다.
"자체호스팅 달성" "A+ 평가" "완료" 선언을 반복했다.

### 뭐가 문제였나
끝이 어딘지 정의 안 했다.
Node 독립이 목표였으면 그게 달성될 때까지 완료가 없어야 했다.

### 검증 가능한 목표
- ❌ "자체호스팅 달성"
- ✅ "`freelang hello.fl` 이 Node.js 없이 실행된다"

---

## 실수 2 — Level 3 부트스트랩에서 멈췄다

### 현재 상태
```
Level 1: Node → bootstrap.js → all.fl 실행 → verify.fl 컴파일  ✅
Level 2: Node → all.fl.out.js → verify.fl 컴파일               ✅
Level 3: all.fl.out.js → all.fl 자신을 컴파일                   ❌
```

### 왜 실패했나
`read_string_iter`가 재귀 구현이다.
`all.fl`은 큰 파일이라 스택 오버플로우가 난다.

```
RangeError: Maximum call stack size exceeded
    at advance (all.fl.out.js:149)
    at read_string_iter (all.fl.out.js:159)
    ...
```

### 뭘 했어야 했나
TCO(꼬리 재귀 최적화) 또는 루프로 전환.
여기서 멈추고 다른 기능 추가하러 갔다.

---

## 실수 3 — 출력이 JS에서 벗어나지 못했다

### 무슨 일이 있었나
`self/codegen.fl`이 JS 코드를 문자열로 뱉는다.
컴파일 결과가 `.out.js`다.
실행하려면 Node가 필요하다.

### 뭐가 문제였나
Node 독립이 목표인데 컴파일 출력이 Node 의존이다.
이 구조로는 Node를 절대 못 뗀다.

### 해야 할 것
C 또는 WASM 코드젠 백엔드.
`self/codegen.fl`의 출력 타겟을 바꾸는 것이 핵심.

---

## 실수 4 — 스택 오버플로우를 알고 방치했다

### 증거
`self/COMPILER_REDESIGN_FAILURES.md` 파일이 존재한다.
문제를 발견하고 문서화까지 했는데 고치지 않았다.

### 뭘 했나
문서만 쓰고 다음 Phase로 넘어갔다.

---

## 실수 5 — 기능 추가에 집중했다

### 뭘 추가했나
- WASM 백엔드 (ML 활성화 함수)
- Hot Reload (fl-reload, fl-watch)
- HTTP 서버 기능들
- stdlib 확장

### 뭐가 문제였나
목표가 Node 독립인데 Node 위에서 돌아가는 기능을 계속 추가했다.
집을 짓는데 인테리어부터 한 셈이다.

---

## 실수 6 — "완료" 선언을 검증 없이 했다

### 패턴
기능 구현 → 테스트 일부 통과 → 블로그 포스팅 → "완료"

### 뭐가 문제였나
블로그 포스팅이 완료의 기준이 됐다.
실제로 작동하는지보다 설명이 그럴듯한지가 기준이 됐다.

---

## 지금 해야 할 것 (순서대로)

### Step 1 — Level 3 부트스트랩 달성
`read_string_iter` 스택 오버플로우 수정.  
`all.fl.out.js`가 `all.fl` 자신을 컴파일할 수 있어야 한다.

**검증:**
```bash
node self/all.fl.out.js self/all.fl /tmp/all2.js
# 에러 없이 완료되면 통과
```

### Step 2 — C 코드젠 백엔드
`self/codegen.fl`에 C 출력 모드 추가.  
FreeLang 코드 → C 코드 → gcc → 바이너리.

**검증:**
```bash
freelang-compile hello.fl hello.c
gcc hello.c runtime.c -o hello
./hello  # Node 없이 실행
```

### Step 3 — 최소 C 런타임 작성
파일 읽기, stdout 출력, 메모리 할당만.  
500줄 이하 목표.

### Step 4 — Node 없이 실행
```bash
./freelang hello.fl
# Node.js 없이 출력
```

---

## 원칙

1. 기능 추가 금지 — Step 1-4 완료 전까지
2. 완료 선언은 검증 통과 후에만
3. 블로그는 결과가 아닌 과정을 기록
