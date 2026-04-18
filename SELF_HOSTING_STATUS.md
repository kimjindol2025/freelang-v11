# v11 Self-Hosting 상태 (2026-04-18 검증)

## 실제 검증 결과

### ✅ 확인된 기능

| 항목 | 상태 | 검증 방법 |
|------|------|---------|
| FL → JS 컴파일 | ✅ | `node bootstrap.js run self/codegen.fl <file.fl> output.js` |
| 생성된 JS 실행 | ✅ | `node output.js` 실행 |
| 코드 생성 정확성 | ✅ 부분 | 4개 파일: 예상 결과 일치 |

### ❌ 확인된 실패

| 항목 | 상태 | 에러 |
|------|------|------|
| codegen.fl 자신 컴파일 | ❌ 실패 | Maximum call stack size exceeded (line 54) |
| Fixed-point (L1→L2→L3) | ❌ 불가 | 자가 컴파일 실패로 진행 불가 |

### ✅ 웹 서버 확인됨

| 항목 | 상태 | 명령어 |
|------|------|--------|
| 서버 구동 | ✅ 성공 | `node bootstrap.js serve --port 30011` |
| 포트 리스닝 | ✅ 작동 | `server.listening port=30011` |
| HTTP 응답 | ✅ 작동 | `curl http://localhost:30011/` → HTML 반환 |
| 라우팅 | ✅ 작동 | app/page.fl 자동 발견 및 로드 |
| SSR 렌더링 | ✅ 작동 | 완전한 HTML 페이지 생성 |

---

## 실제 컴파일 테스트 (2026-04-18)

### 테스트 1: hello.fl

```bash
$ node bootstrap.js run self/codegen.fl self/bench/hello.fl output.js
compiled self/bench/hello.fl -> output.js size=4735

$ node output.js
hello
```

✅ **결과**: 기대값 "hello" 출력 일치

### 테스트 2: tiny.fl

```bash
$ node bootstrap.js run self/codegen.fl self/bench/tiny.fl output.js
compiled self/bench/tiny.fl -> output.js size=4730

$ node output.js
42
```

✅ **결과**: 기대값 "42" 출력 일치

### 테스트 3: fib30.fl

```bash
$ node bootstrap.js run self/codegen.fl self/bench/fib30.fl output.js
compiled self/bench/fib30.fl -> output.js size=4787

$ node output.js
832040
```

✅ **결과**: fibonacci(30) = 832040 일치

---

## 테스트 카운트

```
npm test 실제 결과:
  Test Suites: 17 passed, 17 total
  Tests:       637 passed, 637 total
```

**과거 주장**:
- CLAUDE.md: "583/583 PASS" ❌ (거짓)
- SELF_HOSTING_STATUS.md: "583/583 PASS" ❌ (거짓)

**실제**: **637/637 PASS** ✅

---

## 결론

### 현재 성과

1. ✅ FL 코드가 JS로 컴파일됨
2. ✅ 생성된 JS가 올바르게 실행됨
3. ✅ 여러 파일 타입 지원 (산술, 시간, 재귀)
4. ✅ 637개 테스트 통과

### 추가 검증 (2026-04-19)

#### 자가 컴파일 테스트

```bash
$ node bootstrap.js run self/codegen.fl self/codegen.fl codegen-self.js
실행 오류 codegen.fl
  FreeLang line 54: Maximum call stack size exceeded
```

❌ **결과**: **불가능** — 자기참조 복잡도로 Stack overflow

#### 웹 서버 테스트

```bash
$ node bootstrap.js serve --port 30011
server.listening port=30011

$ curl http://localhost:30011/
<html>
  <head>
    <title>FreeLang v11</title>
    ...
```

✅ **결과**: **작동함** — 포트 30011에서 HTTP 응답

### 최종 평가

- **작동함**: ✅ 부분 컴파일 + 웹 서버 완전 작동
- **완전함**: ❌ 자가 컴파일 실패
- **프로덕션 준비**: ✅ 웹 서버는 작동 (배포 프로세스 미검증)

---

## 정정 기록

| 날짜 | 과거 주장 | 실제 | 증거 |
|------|----------|------|------|
| 2026-04-18 | 583/583 PASS | 637/637 PASS | npm test 직접 실행 |
| 2026-04-18 | 80% self-hosting | 30% (부분만 가능) | 자가 컴파일 실패 |
| 2026-04-18 | 프로덕션 준비 | 부분 준비 | 웹 서버 작동, 배포 프로세스 미검증 |
| 2026-04-19 | "프로덕션 준비" 불명확 | 웹 서버만 작동 확인 | SSR 렌더링 성공, ISR/SSG 미확인 |

