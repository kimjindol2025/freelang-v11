# Express.fl 테스트 프레임워크 가이드

FreeLang v11의 **네이티브 테스트 시스템** (`describe`, `deftest`, `assert` 등)을 Express.fl 래퍼로 활용합니다.

---

## 🧪 테스트 함수

### 기본 테스트

```lisp
;; 테스트 그룹 시작
(describe "Test Group Name")

;; 개별 테스트 정의
(deftest "test description" (fn []
  ;; 테스트 코드
  (test-assert result "메시지")
))
```

### 어서션 (검증)

```lisp
;; 참 검증
(test-assert value "Value should be truthy")

;; 동등성 검증
(test-assert-eq 42 42 "Values should be equal")

;; 다름 검증
(test-assert-neq 42 43 "Values should differ")

;; 예외 검증
(test-assert-throws (fn [] (/ 1 0)) "Should throw")
```

---

## 📋 실전 예제

### 1. 기본 유닛 테스트

```lisp
(load "src/express.fl")

[FUNC add :params [$a $b]
  :body (+ $a $b)
]

(describe "Math Functions")

(deftest "addition should work" (fn []
  (test-assert-eq (add 2 3) 5 "2 + 3 should be 5")))

(deftest "addition with negative" (fn []
  (test-assert-eq (add -5 3) -2 "-5 + 3 should be -2")))
```

### 2. 캐시 테스트

```lisp
(describe "Cache Functions")

(deftest "cache-set and cache-get" (fn []
  (cache-set "user:123" { :id 123 :name "alice" } 60000)
  (let [cached (cache-get "user:123")]
    (test-assert cached "Cache should contain value"))))

(deftest "cache-del removes value" (fn []
  (cache-set "temp:key" "value" 60000)
  (cache-del "temp:key")
  (let [deleted (cache-get "temp:key")]
    (test-assert (= deleted nil) "Cache should be empty"))))

(deftest "cache-info returns size" (fn []
  (let [info (cache-info)]
    (test-assert (object? info) "Cache info should be object"))))
```

### 3. JWT 인증 테스트

```lisp
(describe "JWT Authentication")

(deftest "jwt-sign creates token" (fn []
  (let [
    payload { :user_id 1 :username "alice" }
    token (auth-jwt-sign payload "secret" 3600)
  ]
    (test-assert (string? token) "Token should be string"))))

(deftest "jwt-verify validates signature" (fn []
  (let [
    payload { :user_id 1 }
    token (auth-jwt-sign payload "secret" 3600)
    verified (auth-jwt-verify token "secret")
  ]
    (test-assert verified "Verification should succeed"))))

(deftest "jwt-verify fails with wrong secret" (fn []
  (let [
    payload { :user_id 1 }
    token (auth-jwt-sign payload "secret1" 3600)
    verified (auth-jwt-verify token "secret2")
  ]
    (test-assert (= verified nil) "Verification should fail"))))
```

### 4. 비밀번호 해싱 테스트

```lisp
(describe "Password Security")

(deftest "password hash produces different output" (fn []
  (let [
    pass "mypassword"
    hash1 (auth-hash-password pass)
    hash2 (auth-hash-password pass)
  ]
    (test-assert (!= hash1 hash2) "Hashes should differ (salt)"))))

(deftest "password verification succeeds" (fn []
  (let [
    pass "mypassword"
    hashed (auth-hash-password pass)
    valid (auth-verify-password pass hashed)
  ]
    (test-assert valid "Password should verify"))))

(deftest "password verification fails for wrong password" (fn []
  (let [
    hashed (auth-hash-password "correct")
    valid (auth-verify-password "wrong" hashed)
  ]
    (test-assert (= valid false) "Wrong password should fail"))))
```

### 5. JSON 파싱 테스트

```lisp
(describe "JSON Handling")

(deftest "json_parse handles objects" (fn []
  (let [
    json "{\"name\":\"alice\",\"age\":30}"
    parsed (json_parse json)
    name (get parsed "name")
  ]
    (test-assert-eq name "alice" "Name should be alice"))))

(deftest "json_parse handles arrays" (fn []
  (let [
    json "[1,2,3]"
    parsed (json_parse json)
    first (get parsed 0)
  ]
    (test-assert-eq first 1 "First element should be 1"))))

(deftest "json_stringify serializes data" (fn []
  (let [
    obj { :key "value" }
    json (json_stringify obj)
  ]
    (test-assert (string? json) "Result should be string"))))
```

### 6. 타입 체크 테스트

```lisp
(describe "Type Checking")

(deftest "array? identifies arrays" (fn []
  (test-assert (array? [1 2 3]) "Should be array")))

(deftest "object? identifies objects" (fn []
  (test-assert (object? { :key "value" }) "Should be object")))

(deftest "string? identifies strings" (fn []
  (test-assert (string? "hello") "Should be string")))

(deftest "number? identifies numbers" (fn []
  (test-assert (number? 42) "Should be number")))
```

### 7. 시간 함수 테스트

```lisp
(describe "Time Functions")

(deftest "now_ms returns number" (fn []
  (let [ts (now_ms)]
    (test-assert (number? ts) "Should return number"))))

(deftest "now_iso returns string" (fn []
  (let [iso (now_iso)]
    (test-assert (string? iso) "Should return ISO string"))))

(deftest "now_iso is valid timestamp" (fn []
  (let [iso (now_iso)]
    (test-assert (> (str-len iso) 10) "ISO string should be long enough"))))
```

### 8. PubSub 이벤트 테스트

```lisp
(describe "PubSub System")

(deftest "pubsub-publish returns count" (fn []
  (let [count (pubsub-publish "test:event" { :data "value" })]
    (test-assert (number? count) "Should return number"))))

(deftest "pubsub-topics returns list" (fn []
  (let [topics (pubsub-topics)]
    (test-assert (array? topics) "Should return array"))))
```

---

## 🏗️ 테스트 구조화

### 테스트 스위트 생성

```lisp
[FUNC test-my-module :params []
  :body (do
    (println "\n[My Module Tests]")
    
    (test-deftest "test 1" (fn [] ...))
    (test-deftest "test 2" (fn [] ...))
    (test-deftest "test 3" (fn [] ...))
  )
]

;; 메인 실행
(do
  (log-info "🧪 테스트 시작")
  (test-my-module)
  (log-info "✅ 테스트 완료")
)
```

### 테스트 설정 및 정리

```lisp
;; 모든 테스트 전 실행
[FUNC setup-tests :params []
  :body (do
    (log-info "📋 테스트 설정 중...")
    (cache-clear)  ;; 캐시 초기화
  )
]

;; 모든 테스트 후 실행
[FUNC cleanup-tests :params []
  :body (do
    (log-info "🧹 테스트 정리 중...")
    (cache-clear)
  )
]

(do
  (setup-tests)
  ;; ... 테스트 실행 ...
  (cleanup-tests)
)
```

---

## 📊 테스트 패턴

### 1. AAA (Arrange-Act-Assert) 패턴

```lisp
(deftest "user lookup" (fn []
  ;; Arrange: 테스트 데이터 준비
  (cache-set "user:1" { :id 1 :name "alice" } 60000)
  
  ;; Act: 함수 호출
  (let [user (cache-get "user:1")]
    ;; Assert: 결과 검증
    (test-assert-eq (get user "name") "alice"))))
```

### 2. 예외 테스트

```lisp
(deftest "invalid input throws error" (fn []
  (test-assert-throws
    (fn [] (/ 1 0))
    "Division by zero should fail")))
```

### 3. 조건부 테스트

```lisp
(deftest "conditional logic" (fn []
  (let [value 42]
    (if (> value 40)
      (test-assert true "Value is greater than 40")
      (test-assert false "Value should be greater")))))
```

### 4. 루프 테스트

```lisp
(deftest "array iteration" (fn []
  (let [
    arr [1 2 3 4 5]
    first (get arr 0)
    last (get arr 4)
  ]
    (test-assert-eq first 1 "First should be 1")
    (test-assert-eq last 5 "Last should be 5"))))
```

---

## ⚡ 성능 테스트

### 캐시 성능 비교

```lisp
(describe "Performance: Cache vs Database")

(deftest "cache-get is very fast" (fn []
  (cache-set "perf:test" { :data "value" } 60000)
  (let [start (now_ms)]
    (dotimes [i 1000]
      (cache-get "perf:test"))
    (let [elapsed (- (now_ms) start)]
      (test-assert (< elapsed 100) "1000 cache hits should be <100ms")))))
```

### 토큰 생성 성능

```lisp
(deftest "jwt-sign performance" (fn []
  (let [start (now_ms)]
    (dotimes [i 100]
      (auth-jwt-sign { :user_id 1 } "secret" 3600))
    (let [elapsed (- (now_ms) start)]
      (test-assert (< elapsed 1000) "100 tokens should be <1000ms")))))
```

---

## 🐛 디버깅 팁

### 1. 상세한 메시지 추가

```lisp
(deftest "complex assertion" (fn []
  (let [result (complex-function)]
    (test-assert result (str "Expected truthy, got: " result)))))
```

### 2. 중간 결과 로깅

```lisp
(deftest "with debugging" (fn []
  (let [
    step1 (do-something)
  ]
    (log-debug (str "Step 1 result: " step1))
    (test-assert step1 "Step 1 failed"))))
```

### 3. 조건부 테스트 스킵

```lisp
[FUNC test-conditional :params [$skip]
  :body (if (not $skip)
    (deftest "maybe skip" (fn []
      (test-assert true "This test might be skipped")))
    nil)
]
```

---

## 📈 테스트 커버리지

### 필수 테스트 영역

- [ ] **유닛 테스트**: 개별 함수 동작
- [ ] **통합 테스트**: 함수 조합 시나리오
- [ ] **엣지 케이스**: 경계값, nil, 빈 배열
- [ ] **에러 처리**: 예외 상황
- [ ] **성능 테스트**: 응답 시간 확인
- [ ] **보안 테스트**: 비밀번호 해시, JWT 검증

### 예제: 포괄적 테스트 체크리스트

```lisp
;; ✅ 정상 경로
(deftest "happy path" (fn [] ...))

;; ✅ 엣지 케이스
(deftest "empty input" (fn [] ...))
(deftest "nil value" (fn [] ...))
(deftest "large dataset" (fn [] ...))

;; ✅ 에러 처리
(deftest "invalid input" (fn [] ...))
(deftest "authentication fails" (fn [] ...))

;; ✅ 보안
(deftest "password validation" (fn [] ...))
(deftest "token expiration" (fn [] ...))
```

---

## 🚀 테스트 실행

### 단일 파일 테스트

```bash
node bootstrap.js run express-test.fl
```

### 특정 테스트 그룹만 실행

```lisp
(describe "Specific Feature")
(deftest "test 1" (fn [] ...))
(deftest "test 2" (fn [] ...))

;; 다른 테스트는 주석 처리
```

### 테스트 출력 예시

```
🧪 Express.fl 통합 테스트 스위트 시작

[응답 헬퍼 테스트]
  PASS  res-json wraps server_json
  PASS  res-status returns truthy

[캐시 함수 테스트]
  PASS  cache-set stores value
  PASS  cache-get retrieves value
  FAIL  cache-has checks existence: Expected true

[인증 함수 테스트]
  PASS  auth-jwt-sign creates token
  PASS  auth-jwt-verify validates token

✅ 모든 테스트 완료
```

---

## 📚 관련 함수

### 테스트 제어 (stdlib-test.ts)
- `describe(name, ?fn)` — 테스트 그룹
- `deftest(name, fn)` — 개별 테스트
- `assert(val, ?msg)` — 참 검증
- `assert-eq(a, b, ?msg)` — 동등성
- `assert-neq(a, b, ?msg)` — 다름
- `assert-throws(fn, ?msg)` — 예외

### Express.fl 래퍼
- `test-describe`, `test-deftest`
- `test-assert`, `test-assert-eq`
- `test-assert-neq`, `test-assert-throws`
- `test-run` — 테스트 실행 메시지

---

## 🎯 Best Practices

1. **명확한 테스트 이름**: "should return user when ID is valid"
2. **한 가지만 테스트**: 각 테스트는 단일 기능 검증
3. **독립적인 테스트**: 다른 테스트에 의존하지 않음
4. **빠른 테스트**: 단위 테스트는 밀리초 단위
5. **DRY**: 반복되는 설정은 함수로 추출
6. **명시적**: 에러 메시지는 명확하게
7. **정리 필수**: 각 테스트 후 캐시/세션 정리

---

## 🔗 참고 자료

- `/root/kim/freelang-v11/src/express-test.fl` — 완전한 테스트 예제
- `/root/kim/freelang-v11/src/stdlib-test.ts` — 내부 구현
- `/root/kim/freelang-v11/src/express.fl` — 전체 wrapper 함수

