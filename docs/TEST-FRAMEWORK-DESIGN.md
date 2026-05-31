# Phase 1: 테스트 프레임워크 설계

**Status**: 설계 확정 (2026-05-24)  
**목표**: L4 고정점 이후 회귀 검출 + CI 통합을 위한 체계화된 테스트 아키텍처

---

## Executive Summary

FreeLang v11 테스트가 3곳(test/, tests/, src/__tests__/)에 분산되어 있고, 실행 인터페이스가 없으며, Golden test 패턴이 비공식입니다. Phase 1은 5계층 테스트 아키텍처를 정의하고, 단일 진입점(`test.sh`)을 통해 CI 통합을 준비합니다.

---

## 테스트 계층 정의

### L0: Static Validation (구문/린트)

**목표**: 코드 정적 오류 조기 검출

**도구**:
- `check-parens.py` — 괄호/브래킷 균형
- `lint-p0.py` — P0 규칙 (5개, 필수)
  - $ 파라미터 사용 여부
  - try-catch 예외 처리
  - Bearer 토큰 사용
  - let 바인딩 정확성
  - json-stringify 명시 사용
- `lint-p1.py` — P1 규칙 (6개, 권장)
  - DB 절대경로 사용
  - HTTP 응답 파싱
  - 라우트 params 처리
  - 문자열 보간 검증
  - nil 체크
  - 에러 핸들링 패턴

**입출력**: 파일 목록 → 위반 사항 JSON 출력

**소요시간**: ~5초 (300개 파일)

---

### L1: Unit Test (함수 단위 테스트)

**목표**: stdlib 함수 + 코드 생성(codegen) 검증

**구조**:
```
tests/unit/
├── stdlib/              # 표준 라이브러리 테스트
│   ├── string.test.fl   # str, str-upper, str-split, ...
│   ├── array.test.fl    # length, nth, push, ...
│   ├── map.test.fl      # get, assoc, dissoc, ...
│   ├── math.test.fl     # +, -, *, /, %, ...
│   └── type.test.fl     # type?, nil?, number?, ...
└── codegen/             # 코드 생성 단위 테스트 (Golden 비교)
    ├── emit-let.test.fl         # let 바인딩 → C 코드 생성
    ├── emit-fn.test.fl          # defn 함수 → C 코드 생성
    ├── emit-recur.test.fl       # recur TCO → goto C 코드
    ├── emit-closure.test.fl     # 클로저 캡처 → upvalue C 코드
    └── emit-hof.test.fl         # map/filter/reduce → 코드 생성
```

**테스트 패턴** (FL-native):
```lisp
(defn test-string-concat []
  (assert-eq (str "a" "b") "ab" "문자열 연결")
  (assert-eq (str 1 2 3) "123" "숫자 변환"))

(defn test-let-binding []
  (assert-eq (let [x 1 y 2] (+ x y)) 3 "let 바인딩"))
```

**Codegen Golden Test**:
```
Input:  (let [x 1] x)
Output: /tmp/hello-gen.c (cgc-native 생성)
Golden: tests/golden/hello.expected.c (git 추적)
Check:  SHA256 비교
```

**소요시간**: ~30초 (150개 테스트)

---

### L2: Integration Test (통합 테스트)

**목표**: 다중 모듈 상호작용 검증 (HTTP, DB, auth)

**대상**:
```
tests/integration/
├── http-server.test.fl      # server-start + route 핸들링
├── db-query.test.fl         # DB 읽기/쓰기/트랜잭션
└── auth.test.fl             # JWT + CSRF 토큰
```

**패턴** (L1과 동일, 확장):
```lisp
(defn test-http-server []
  ;; 서버 시작
  (define server (server-start 9999))
  
  ;; 핸들러 등록
  (server-on-get "/api/test" (fn [req] 
    (response 200 "OK")))
  
  ;; 요청 발송
  (define resp (http-get "http://localhost:9999/api/test"))
  (assert-eq (get resp "status") 200)
  
  ;; 종료
  (server-close server))
```

**소요시간**: ~60초 (포트 시작/종료 오버헤드 포함)

---

### L3: E2E Test (전체 파이프라인)

**목표**: FL → C → ELF → 실행 파이프라인 검증

**대상**:
```
tests/e2e/
├── compile-hello.sh         # hello.fl → gen.c → ELF → 실행
├── compile-recur.sh         # TCO FL → 네이티브 바이너리
├── compile-closure.sh       # 클로저 캡처 → 실행
├── compile-hof.sh           # map/filter/reduce → 실행
└── compile-self.sh          # cgc-main.fl 자가 재컴파일
```

**패턴** (쉘스크립트):
```bash
#!/bin/bash
set -e

# 1. 소스 코드 컴파일 (bootstrap.js)
node bootstrap.js run self/cgc-main.fl hello.fl /tmp/hello-gen.c

# 2. C → ELF (gcc + runtime)
bash scripts/build-cgc-native.sh /tmp/hello-gen.c /tmp/hello-bin

# 3. 바이너리 실행
output=$(/tmp/hello-bin)

# 4. 예상 결과 비교
assert_eq "$output" "Hello, world!" "hello.fl 실행"
```

**소요시간**: ~30초 (컴파일 오버헤드)

---

### L4: Self-Host Fixpoint (자가호스팅 고정점)

**목표**: gen1.c ≡ gen2.c ≡ gen3.c (SHA256 일치)

**기존 인프라 재사용**:
- `scripts/verify-l4-fixpoint.sh` — PATH 제한 자동화
- 검증: 3중 SHA256 비교

**패턴**:
```bash
# Step 1: bootstrap.js → gen1.c
node bootstrap.js run self/cgc-main.fl self/cgc-main.fl /tmp/gen1.c

# Step 2: gen1.c → cgc-native1
bash scripts/build-cgc-native.sh /tmp/gen1.c /tmp/gen1-bin

# Step 3: cgc-native1 → gen2.c
env -i PATH=/usr/bin:/bin /tmp/gen1-bin self/cgc-main.fl /tmp/gen2.c

# Step 4: 검증
assert_sha256 /tmp/gen1.c /tmp/gen2.c "고정점 달성"
```

**소요시간**: ~60초 (컴파일 체인)

---

## 디렉토리 구조

```
freelang-v11/
├── tests/
│   ├── unit/                       # L1: 단위 테스트
│   │   ├── stdlib/
│   │   │   ├── string.test.fl
│   │   │   ├── array.test.fl
│   │   │   ├── map.test.fl
│   │   │   ├── math.test.fl
│   │   │   └── type.test.fl
│   │   └── codegen/
│   │       ├── emit-let.test.fl
│   │       ├── emit-fn.test.fl
│   │       ├── emit-recur.test.fl
│   │       ├── emit-closure.test.fl
│   │       └── emit-hof.test.fl
│   ├── integration/                # L2: 통합 테스트
│   │   ├── http-server.test.fl
│   │   ├── db-query.test.fl
│   │   └── auth.test.fl
│   ├── e2e/                        # L3: E2E 파이프라인
│   │   ├── compile-hello.sh
│   │   ├── compile-recur.sh
│   │   ├── compile-closure.sh
│   │   ├── compile-hof.sh
│   │   └── compile-self.sh
│   ├── golden/                     # Golden 기준 파일 (git 추적)
│   │   ├── hello.expected.c        # hello.fl 코드 생성 기준
│   │   ├── recur.expected.c        # TCO 코드 생성 기준
│   │   ├── closure.expected.c      # 클로저 코드 생성 기준
│   │   ├── hof.expected.c          # HOF 코드 생성 기준
│   │   └── self.expected.c         # cgc-main.fl 자가 생성 기준
│   ├── fixtures/                   # 기존 유지
│   │   ├── basic-app/
│   │   └── stdlib-probes/
│   ├── parity/                     # 기존 유지 + _lib.sh
│   │   ├── _lib.sh
│   │   ├── 01-arithmetic.sh
│   │   └── ...
│   ├── evidence/                   # 기존 유지 (HTTP 응답 스냅샷)
│   │   └── ...
│   ├── runners/                    # 계층별 실행기
│   │   ├── run-static.sh           # L0: lint-p0, lint-p1, check-parens
│   │   ├── run-unit.sh             # L1: FL-native 테스트
│   │   ├── run-integration.sh      # L2: HTTP/DB/auth 테스트
│   │   ├── run-e2e.sh              # L3: compile-*.sh 실행
│   │   └── run-fixpoint.sh         # L4: verify-l4-fixpoint.sh 호출
│   └── RESULTS.json                # 실행 결과 집계 (자동 생성)
├── test.sh                         # 단일 진입점 (L0→L4)
└── [기존 파일들]
```

---

## 실행 인터페이스

### 단일 진입점: `test.sh`

**위치**: 프로젝트 루트

**문법**:
```bash
./test.sh [layer] [options]

layer:
  (empty)     — 전체 (L0→L4)
  static      — L0: 정적 검증
  unit        — L1: 단위 테스트
  integration — L2: 통합 테스트
  e2e         — L3: E2E 파이프라인
  fixpoint    — L4: 자가호스팅 고정점

options:
  --fast      — L0 + L1만 (개발 빠른 피드백)
  --verbose   — 상세 출력
  -q          — 조용한 모드 (요약만)
```

**사용 예시**:
```bash
./test.sh                 # 전체 테스트 (CI 용)
./test.sh --fast          # 빠른 피드백 (개발)
./test.sh unit --verbose  # L1 상세 출력
```

### 출력 포맷

```
════════════════════════════════════════════════════════════════
[L0] Static Validation
════════════════════════════════════════════════════════════════
✓ check-parens: PASS (2/2 files)
✓ lint-p0: PASS (0 violations in 300 files)
✓ lint-p1: PASS (1 warning in 50 files)
  → stdlib/string.fl:42 — missing nil check before str-split

════════════════════════════════════════════════════════════════
[L1] Unit Tests
════════════════════════════════════════════════════════════════
✓ tests/unit/stdlib/string.test.fl: PASS (8/8)
✓ tests/unit/stdlib/array.test.fl:  PASS (12/12)
✗ tests/unit/stdlib/map.test.fl:    FAIL (9/10)
  → test-dissoc: expected key "x" removed, got present

Golden Test (codegen):
✓ emit-let: PASS (SHA 5c1ede...)
✓ emit-fn: PASS (SHA 5c1ede...)
...

════════════════════════════════════════════════════════════════
[L2] Integration Tests (skip with --fast)
════════════════════════════════════════════════════════════════
✓ tests/integration/http-server.test.fl: PASS (5/5)
✓ tests/integration/db-query.test.fl: PASS (8/8)
✗ tests/integration/auth.test.fl: FAIL (3/5)

════════════════════════════════════════════════════════════════
[L3] E2E Tests
════════════════════════════════════════════════════════════════
✓ tests/e2e/compile-hello.sh: PASS (output matches)
✓ tests/e2e/compile-recur.sh: PASS (result: 120)
✓ tests/e2e/compile-closure.sh: PASS (closure captured)
✓ tests/e2e/compile-hof.sh: PASS (10 elements filtered)
✗ tests/e2e/compile-self.sh: FAIL (non-deterministic output)

════════════════════════════════════════════════════════════════
[L4] Self-Host Fixpoint
════════════════════════════════════════════════════════════════
✓ gen1.c == gen2.c (SHA 5c1ede...)
✓ gen2.c == gen3.c (SHA 5c1ede...)
✓ Fixed-point verified (deterministic)

════════════════════════════════════════════════════════════════
SUMMARY
════════════════════════════════════════════════════════════════
L0 Static:      ✓ PASS (3 checks)
L1 Unit:        ✗ FAIL (9/10 tests pass, 1 golden mismatch)
L2 Integration: ✗ FAIL (3/5 tests pass)
L3 E2E:         ✗ FAIL (4/5 scripts pass)
L4 Fixpoint:    ✓ PASS (deterministic)

Total:          11/18 tests pass (61.1%)
Runtime:        2m 34s
```

---

## Golden Test 정책

### 목적

컴파일러 출력(C 코드)의 회귀 검출. FreeLang → C 코드 생성이 변경되지 않았는지 검증.

### 구조

```
Input FL:           tests/e2e/hello.fl
  ↓ cgc-native
Generated C:        /tmp/hello-gen.c (매번 생성)
  ↑ 비교 (SHA256)
Golden C:           tests/golden/hello.expected.c (git 추적)
```

### 규칙

#### 규칙 1: 새 패턴 추가 시

새로운 FL 언어 기능(예: 새 함수, 새 문법)을 추가하면:

1. L1 테스트 파일 작성 (예: `tests/unit/codegen/emit-new-feature.test.fl`)
2. cgc-native로 해당 FL 컴파일 (예: `cgc-native tests/unit/codegen/emit-new-feature.test.fl /tmp/test-gen.c`)
3. `/tmp/test-gen.c` 내용을 `tests/golden/new-feature.expected.c`로 저장
4. git commit에 함께 포함

```bash
# 예시
cgc-native tests/unit/codegen/emit-new-feature.test.fl /tmp/test-gen.c
cp /tmp/test-gen.c tests/golden/new-feature.expected.c
git add tests/unit/codegen/emit-new-feature.test.fl tests/golden/new-feature.expected.c
```

#### 규칙 2: 의도적 출력 변경 시

컴파일러 코드 생성 로직을 의도적으로 변경하면(예: 최적화):

1. 변경 이유를 커밋 메시지에 기록
2. `./test.sh update-golden <target>` 명령 실행 (Golden 파일 자동 갱신)
3. Golden 파일 변경사항 검토 및 커밋

```bash
# 예시: 최적화 후 golden 파일 갱신
git commit -m "opt: emit-let 최적화 — 불필요 변수 선언 제거"
./test.sh update-golden emit-let
git add tests/golden/emit-let.expected.c
git commit -m "test: update golden for emit-let optimization"
```

#### 규칙 3: SHA256 비교 (diff 아님)

Golden test는 전체 파일의 SHA256 해시를 비교합니다. 공백/줄바꿈도 완전히 일치해야 합니다. 이는 결정론 검증을 강제합니다.

```bash
# 예시: Golden 파일 검증
sha256sum tests/golden/hello.expected.c
5c1edeafb7ae346f2347a9321b0bfe8dfef7ae0be91c5e049b6bcfcbb57f2f74
```

#### 규칙 4: Git 추적

`tests/golden/` 디렉토리는 git 버전 관리 대상입니다.

```bash
git ls-files tests/golden/
tests/golden/hello.expected.c
tests/golden/recur.expected.c
...
```

### Golden Test 대상

| 대상 | 파일 | 검증 대상 |
|------|------|---------|
| hello | `tests/golden/hello.expected.c` | 기본 산술 연산 |
| recur | `tests/golden/recur.expected.c` | 재귀 + TCO |
| closure | `tests/golden/closure.expected.c` | 클로저 캡처 + upvalue |
| hof | `tests/golden/hof.expected.c` | map/filter/reduce 코드 생성 |
| self | `tests/golden/self.expected.c` | cgc-main.fl 자가 생성 |

---

## CI 진입점 통합

### 기존 상황

- `make verify` — 4개 통합 대시보드
- `scripts/verify-l4-fixpoint.sh` — L4만
- `npm test` — Jest TypeScript만
- 통합 진입점 없음

### 새로운 단일 CI 게이트

**파일**: `scripts/verify.sh`

**내부 순서**:
```bash
set -e

echo "[L0] Static Validation..."
./test.sh static

echo "[L1] Unit Tests..."
./test.sh unit

echo "[L3] E2E Tests..."
./test.sh e2e

echo "[L4] Fixpoint..."
./test.sh fixpoint

echo "────────────────────"
echo "✓ All gates PASS"
```

**실행 시간**: ~3분 (L2 통합 테스트 제외)

### Makefile 변경

```make
# 기존
verify: verify-all

# 변경
verify: verify.sh
	bash scripts/verify.sh

verify-all: verify fixpoint  # 호환성 유지
```

---

## Phase 1 로드맵

### Phase 1A: 아키텍처 설계 (현재 완료)

- TEST-FRAMEWORK-DESIGN.md ✓
- test.sh 스켈레톤 ✓
- tests/golden/ 기준 파일 ✓

### Phase 1B: Unit Framework 구현

- FL-native assert 라이브러리
- tests/unit/stdlib/ 확장
- L1 러너 자동화

**예상**: 2-3주

### Phase 1C: Integration Suite

- HTTP 서버 통합 테스트
- DB 쿼리 테스트
- Auth (JWT + CSRF) 테스트

**예상**: 1-2주

### Phase 1D: E2E + Golden Suite

- compile-*.sh 5개 작성
- Golden test 자동화
- E2E 러너

**예상**: 1주

### Phase 1E: CI 통합

- `scripts/verify.sh` 완성
- GitHub Actions 통합
- 자동 회귀 감지

**예상**: 1주

---

## 참고: 기존 재사용 패턴

| 패턴 | 위치 | 재사용 |
|------|------|------|
| SHA256 고정점 | `scripts/verify-l4-fixpoint.sh` | L4 Fixpoint |
| `ok()/fail()` | `self/test-harness.sh` | 경량 러너 |
| `emit_result` | `tests/parity/_lib.sh` | JSON 보고 |
| `run(src)` lex→eval | `src/__tests__/core.test.ts` | Jest 단위 테스트 |
| FL assert | `tests/fl-test-suite/` | L1 FL-native |
| `make verify` | `Makefile` | CI 진입점 |

---

**상태**: 설계 확정 (2026-05-24)  
**다음**: Phase 1B Unit Framework 구현
