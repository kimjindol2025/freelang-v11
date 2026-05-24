# Phase 1D: E2E + Golden + Fixed-point 검증 계획

## 목표

L3 E2E 파이프라인 + Golden 기준 파일 + L4 Fixed-point 검증을 통해 **자가호스팅 컴파일러의 결정론성** 증명.

핵심 질문: "TS 없이 컴파일러가 스스로 유지 가능한가?"
→ 답: gen1.c == gen2.c == gen3.c (SHA 동일)

---

## 아키텍처

```
┌─────────────────────────────────────────┐
│         Phase 1D E2E Pipeline           │
├─────────────────────────────────────────┤
│                                         │
│  D1-D4: Golden 기준 파일 생성          │
│  ├─ hello.fl → gen1.c (golden)         │
│  ├─ loop.fl → gen2.c (golden)          │
│  ├─ fib.fl → gen3.c (golden)           │
│  └─ factorial.fl → gen4.c (golden)    │
│                                         │
│  D5: Parity 자동화                     │
│  ├─ JS codegen ↔ C codegen 비교        │
│  └─ 의미론적 동등성 검증               │
│                                         │
│  D6-D7: Fixed-point 검증               │
│  ├─ cgc-native1 gen1.c 생성 → SHA256   │
│  ├─ cgc-native2 cgc-native1 → SHA256   │
│  └─ SHA1 == SHA2 == SHA3? ✓            │
│                                         │
└─────────────────────────────────────────┘
```

---

## D1: hello.fl Golden 생성 (기본 산술)

### 파일: tests/e2e/hello.fl

```lisp
;; 기본 산술 + println
(println "Hello, world!")
(println (+ 1 2))
(println (* 3 4))
```

### 실행 단계

```bash
# 1. FL → C 생성 (bootstrap.js)
node --stack-size=8192 bootstrap.js run tests/e2e/hello.fl > /tmp/hello-gen.c

# 2. Golden 저장
cp /tmp/hello-gen.c tests/golden/hello.expected.c

# 3. Git 추적
git add tests/golden/hello.expected.c
```

### 출력

- `tests/golden/hello.expected.c` (약 5-10KB, codegen 결과물)

---

## D2: loop.fl Golden 생성 (반복문)

### 파일: tests/e2e/loop.fl

```lisp
;; 루프 (dotimes 또는 reduce)
(reduce (fn [$acc $i] (+ $acc $i)) 0 (range 100))
```

### 실행 단계

```bash
node --stack-size=8192 bootstrap.js run tests/e2e/loop.fl > /tmp/loop-gen.c
cp /tmp/loop-gen.c tests/golden/loop.expected.c
git add tests/golden/loop.expected.c
```

---

## D3: fib.fl Golden 생성 (재귀 + TCO)

### 파일: tests/e2e/fib.fl

```lisp
;; 재귀 함수 (Recur 패턴)
(defn fib-recur [$n $a $b]
  (if (<= $n 0)
    $a
    (recur (- $n 1) $b (+ $a $b))))

(defn fib [$n]
  (fib-recur $n 0 1))

(println (fib 10))
```

### 출력

- `tests/golden/fib.expected.c`

### 검증 포인트

- TCO (goto-based) 확인
- Recur 코드생성 정확성

---

## D4: factorial.fl Golden 생성 (단순 재귀)

### 파일: tests/e2e/factorial.fl

```lisp
;; 단순 재귀
(defn factorial [$n]
  (if (<= $n 1)
    1
    (* $n (factorial (- $n 1)))))

(println (factorial 5))
```

### 출력

- `tests/golden/factorial.expected.c`

---

## D5: Parity 자동화 (선택사항, Phase 1D 말미)

### 목표

JS codegen과 C codegen이 동일한 의미론을 생성하는지 검증.

**논리**:
```
bootstrap.js codegen
    ↓
gen.c (JavaScript로 해석)
    ↓
parity-checker.fl (FreeLang으로 구현)
    ↓
"codegen JS ↔ C 동등" ✓
```

### 구현

- `tests/runners/check-parity.sh` (50줄)
  - hello.fl → gen1.c (bootstrap.js)
  - parity-check.fl (gen1.c 파싱, 의미론 검증)
  - PASS/FAIL 보고

### 실행

```bash
bash tests/runners/check-parity.sh hello
→ Parity check hello: PASS ✓
```

---

## D6-D7: Fixed-point 검증 (L4 완성)

### 목표

```
gen1.c ≡ gen2.c ≡ gen3.c (SHA256)
```

### 실행 절차

```bash
# 1. gen1 생성
node --stack-size=8192 bootstrap.js run cgc-main.fl > gen1.c
sha256sum gen1.c → SHA1

# 2. gen1 → cgc-native1 컴파일
gcc -o cgc-native1 gen1.c [8 runtime modules]
sha256sum cgc-native1 → ELF1

# 3. cgc-native1로 cgc-main.fl 재컴파일 → gen2.c
./cgc-native1 cgc-main.fl > gen2.c
sha256sum gen2.c → SHA2

# 4. gen2 → cgc-native2
gcc -o cgc-native2 gen2.c
./cgc-native2 cgc-main.fl > gen3.c
sha256sum gen3.c → SHA3

# 5. 검증
if SHA1 == SHA2 == SHA3:
    echo "✓ Fixed-point achieved"
else
    echo "✗ Divergence detected"
    exit 1
fi
```

### 스크립트

- `scripts/verify-l4-fixpoint.sh` (기존, Phase 1D에서 검증)

---

## Phase 1D 테스트 실행

### L3 E2E 러너

```bash
# tests/runners/run-e2e.sh
#!/bin/bash

E2E_FILES=(hello loop fib factorial)
PASS=0
FAIL=0

for test in "${E2E_FILES[@]}"; do
  if node --stack-size=8192 bootstrap.js run "tests/e2e/$test.fl" > /tmp/$test-gen.c; then
    if diff -q "tests/golden/$test.expected.c" /tmp/$test-gen.c >/dev/null 2>&1; then
      echo "✓ $test golden match"
      PASS=$((PASS + 1))
    else
      echo "✗ $test golden mismatch"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "✗ $test compile error"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "E2E: $PASS passed, $FAIL failed"
```

### test.sh 통합

```bash
./test.sh e2e
→ [L3] E2E Tests
   E2E: 4 passed, 0 failed ✓
```

### 전체 테스트 게이트

```bash
./test.sh --fast
→ [L0] Static: PASS
   [L1] Unit: 4/4 PASS
   [L3] E2E: 4/4 PASS

./test.sh
→ [L0] Static: PASS
   [L1] Unit: 4/4 PASS
   [L2] Integration: skip (선택사항)
   [L3] E2E: 4/4 PASS
   [L4] Fixpoint: PASS
```

---

## Phase 1D 완료 기준

### 산출물

| 단계 | 파일 | 상태 |
|------|------|------|
| D1 | tests/e2e/hello.fl + tests/golden/hello.expected.c | ⏳ |
| D2 | tests/e2e/loop.fl + tests/golden/loop.expected.c | ⏳ |
| D3 | tests/e2e/fib.fl + tests/golden/fib.expected.c | ⏳ |
| D4 | tests/e2e/factorial.fl + tests/golden/factorial.expected.c | ⏳ |
| D5 | tests/runners/check-parity.sh | ⏳ |
| D6-D7 | scripts/verify-l4-fixpoint.sh (검증) | ⏳ |
| E2E Runner | tests/runners/run-e2e.sh | ⏳ |

### 검증

```bash
✓ ./test.sh e2e → 4/4 PASS
✓ ./test.sh fixpoint → SHA1==SHA2==SHA3
✓ ./test.sh → L0+L1+L3+L4 모두 PASS
```

---

## 예상 시간

| 단계 | 예상 시간 |
|------|----------|
| D1-D4 (golden 생성) | 30분 |
| D5 (parity 검증) | 1시간 (선택) |
| D6-D7 (fixed-point) | 1시간 (기존 스크립트 재사용) |
| 테스트 + 문서 | 1시간 |
| **합계** | **2-3시간** |

---

## 신뢰도 평가 (Phase 1D 종료 후)

| 항목 | 현재 | 예상 |
|------|------|------|
| 테스트 커버리지 | 65% | 80% |
| E2E 자동화 | 0% | 100% |
| Fixed-point 증명 | 0% | 100% |
| 회귀 검출 | 0% | 90% |
| **전체 신뢰도** | 9.0/10 | **9.5/10** |

---

## 다음: Phase 1C (Integration Suite)

Phase 1D 완료 후 필요시:
- L2 Integration (HTTP, DB, auth)
- 선택적 계층 (현재는 L0+L1+L3+L4로 충분)

---

**상태**: 계획 수립 완료  
**다음**: D1 시작 (hello.fl golden 생성)
