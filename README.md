# FreeLang v11 — 실측 기반 보고서

**상태**: 부분 작동, 완전성 미검증  
**최종 검증**: 2026-04-18  
**테스트**: 637/637 PASS ✅

---

## 📌 이 저장소에 대해

v11은 프로그래밍 언어이자 자체 컴파일러를 갖춘 시스템입니다.

- **언어**: S-expression 기반 (Lisp 문법)
- **컴파일**: FL → JavaScript
- **런타임**: Node.js v25+

---

## ✅ 확인된 기능 (실제 테스트)

### 1. 컴파일 가능

```bash
node bootstrap.js run self/codegen.fl self/bench/hello.fl output.js
```

결과: ✅ JavaScript 생성됨 (4735 bytes)

### 2. 생성 코드 실행 가능

```bash
node output.js
```

결과: ✅ "hello" 출력

### 3. 여러 파일 타입 지원

| 파일 | 컴파일 | 실행 | 검증 |
|------|--------|------|------|
| hello.fl | ✅ | ✅ | "hello" 출력 |
| tiny.fl | ✅ | ✅ | "42" 출력 |
| fib30.fl | ✅ | ✅ | "832040" 출력 |
| test-time.fl | ✅ | ✅ | 시간 함수 작동 |

### 4. 웹 서버 구동

```bash
node bootstrap.js serve --port 30011
server.listening port=30011

curl http://localhost:30011/
# → 완전한 HTML 응답
```

✅ 작동함

### 5. 테스트 스위트

```bash
npm test
```

결과:
```
Test Suites: 17 passed, 17 total
Tests:       637 passed, 637 total
```

---

## ⚠️ 확인된 제약사항

- [ ] **자가 컴파일 불가능**: Stack overflow at line 54
- [ ] **의존성 제로 거짓**: Node.js v25+ 여전히 필수
- [ ] **ISR/SSG 미검증**: SSR만 확인
- [ ] **배포 프로세스 미검증**: 웹 서버만 작동
- [ ] **성능 벤치마크 미실행**

---

## 📁 폴더 구조

```
freelang-v11/
├── bootstrap.js         # 완전 런타임 (1.1MB)
├── self/                # Self-hosting 코드
│   ├── codegen.fl       # 컴파일러 (FL로 작성)
│   ├── lexer.fl
│   ├── parser.fl
│   ├── interpreter.fl
│   └── bench/           # 테스트 파일들
├── src/                 # TypeScript 소스
├── tests/               # Jest 테스트 (637개)
└── stdlib/              # 표준 라이브러리
```

---

## 🚀 빠른 시작

### 1. 간단한 FL 파일 생성

```
cat > hello.fl << 'EOF'
(print "Hello from v11!")
EOF
```

### 2. JavaScript로 컴파일

```bash
node bootstrap.js run self/codegen.fl hello.fl output.js
```

### 3. 실행

```bash
node output.js
```

---

## 🔍 검증 방법

다음 명령으로 직접 확인할 수 있습니다:

```bash
# 테스트 실행
npm test

# 예제 컴파일
node bootstrap.js run self/codegen.fl self/bench/hello.fl test.js

# 생성 코드 실행
node test.js
```

---

## 📋 정정 기록

| 날짜 | 거짓 | 실제 | 증거 |
|------|------|------|------|
| 2026-04-18 | "583/583 PASS" | **637/637 PASS** | npm test |
| 2026-04-18 | "80% self-hosting" | **30% (실패)** | 자가 컴파일 Stack overflow |
| 2026-04-18 | "프로덕션 준비" | **부분 준비** | 웹 서버만 작동 |
| 2026-04-19 | "의존성 제로" | **거짓** | Node.js v25+ 여전히 필수 |

---

## ⚠️ 알려진 문제 및 제약

1. **자가 컴파일 불가능**: `Maximum call stack size exceeded` at line 54
2. **Node.js 의존성**: 자체 부트스트랩 불가능 (v12에서 목표)
3. **ISR/SSG 미검증**: SSR 렌더링만 확인
4. **배포 프로세스 미검증**: 웹 서버 구동만 확인
5. **성능 미측정**: 응답 시간 벤치마크 안 함

---

## 📚 추가 문서

- [`TRUTH_POLICY.md`](./TRUTH_POLICY.md) — 검증 규칙
- [`SELF_HOSTING_STATUS.md`](./SELF_HOSTING_STATUS.md) — 상세 검증 결과
- [`docs/`](./docs/) — 기술 가이드

---

**작성**: 2026-04-18  
**최종 검증**: 2026-04-19  
**기반**: 실제 검증 (npm test, 컴파일 테스트, 웹 서버 테스트)  
**신뢰도**: 높음 (자가 컴파일/배포 제외)
