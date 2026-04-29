# FreeLang Inline Test Syntax 가이드

> **목적**: 함수 정의와 테스트를 한 곳에서 관리
> **효과**: AI가 함수 동작을 즉시 검증 가능
> **상태**: v11.2 설계 (구현 대기)

---

## 🎯 Inline Test 패턴

### 패턴 A: 주석 기반 테스트

```fl
;; 함수 정의
(define double (fn [x] (* x 2)))

;; 인라인 테스트 (주석)
;;; TEST: (double 5) => 10
;;; TEST: (double 0) => 0
;;; TEST: (double -3) => -6
```

**해석**:
- `;;; TEST:` — 테스트 마커
- `(double 5)` — 실행 코드
- `=>` — 예상 결과
- `10` — 기댓값

### 패턴 B: 다중 인자

```fl
(define add (fn [a b] (+ a b)))

;;; TEST: (add 2 3) => 5
;;; TEST: (add 0 0) => 0
;;; TEST: (add -1 1) => 0
```

### 패턴 C: 복합 표현식

```fl
(define process (fn [x]
  (let [doubled (* x 2)]
    (if (> doubled 10) "big" "small"))))

;;; TEST: (process 6) => "big"
;;; TEST: (process 3) => "small"
;;; TEST: (process 5) => "big"
```

### 패턴 D: 에러 테스트

```fl
(define safe-divide (fn [a b]
  (try
    (/ a b)
    (catch e 0))))

;;; TEST: (safe-divide 10 2) => 5
;;; TEST: (safe-divide 10 0) => 0
;;; TEST-ERROR: (safe-divide "x" 2)
```

---

## 📋 검증 스크립트

### 자동 테스트 실행

```bash
freelang test examples/patterns/01-*.fl
# 또는
node bootstrap.js test --inline code.fl
```

**출력 예시**:
```
Testing: double
  ✅ (double 5) => 10
  ✅ (double 0) => 0
  ✅ (double -3) => -6
  Pass: 3/3

Testing: process
  ✅ (process 6) => "big"
  ✅ (process 3) => "small"
  ❌ (process 5) => Expected "big", got "small"
  Pass: 2/3
```

---

## 🎓 stdlib 예제 (10개 함수)

### 1. length

```fl
(define test-length (fn []
  (and
    (= (length []) 0)
    (= (length [1 2 3]) 3)
    (= (length "hello") 5))))

;;; TEST: (test-length) => true
```

### 2. first

```fl
(define first-test (fn []
  (and
    (= (first [10 20 30]) 10)
    (= (first []) nil)
    (= (first "abc") "a"))))

;;; TEST: (first-test) => true
```

### 3. map

```fl
(define map-test (fn []
  (= (map (fn [x] (* x 2)) [1 2 3])
     [2 4 6])))

;;; TEST: (map-test) => true
```

### 4. filter

```fl
(define filter-test (fn []
  (= (filter (fn [x] (> x 2)) [1 2 3 4 5])
     [3 4 5])))

;;; TEST: (filter-test) => true
```

### 5. reduce

```fl
(define reduce-test (fn []
  (= (reduce (fn [acc x] (+ acc x)) 0 [1 2 3 4])
     10)))

;;; TEST: (reduce-test) => true
```

### 6. str-to-num

```fl
(define str-to-num-test (fn []
  (and
    (= (str-to-num "42") 42)
    (= (str-to-num "3.14") 3.14)
    (= (str-to-num "invalid") nil))))

;;; TEST: (str-to-num-test) => true
```

### 7. upper-case

```fl
(define upper-case-test (fn []
  (and
    (= (upper-case "hello") "HELLO")
    (= (upper-case "ABC") "ABC")
    (= (upper-case "123") "123"))))

;;; TEST: (upper-case-test) => true
```

### 8. get

```fl
(define get-test (fn []
  (and
    (= (get {:a 1 :b 2} :a) 1)
    (= (get {:a 1} :z) nil)
    (= (get [10 20 30] 1) 20))))

;;; TEST: (get-test) => true
```

### 9. keys

```fl
(define keys-test (fn []
  (let [m {:x 1 :y 2 :z 3}]
    (= (sort (keys m)) ["x" "y" "z"]))))

;;; TEST: (keys-test) => true
```

### 10. if

```fl
(define if-test (fn []
  (and
    (= (if true "yes" "no") "yes")
    (= (if false "yes" "no") "no")
    (= (if 0 "truthy" "falsy") "truthy"))))

;;; TEST: (if-test) => true
```

---

## 🚀 AI 자동화 체크리스트

배포 전:

- [ ] 모든 함수에 `;;; TEST:` 최소 3개?
- [ ] 에러 경로도 테스트? (`TEST-ERROR:`)
- [ ] `freelang test code.fl` 100% PASS?
- [ ] Determinism 검증? (3회 실행 동일)

---

## 📊 효과

| 시나리오 | 이전 | 이후 |
|---------|------|------|
| AI가 함수 이해 | 문서 읽고 추측 | inline test로 즉시 검증 |
| 함수 사용 오류 | 런타임 실패 | 테스트 실패로 즉시 감지 |
| 코드 수정 후 | 모든 테스트 재실행 | inline test만 빠르게 확인 |
| 다른 AI의 재사용 | 문서 다시 읽기 | 코드 + 테스트만 보면 됨 |

---

**다음**: stdlib 46개 함수에 inline test 추가 (v11.2 완성)
