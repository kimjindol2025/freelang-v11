# FreeLang v11 AI 컨텍스트 통합 가이드

> **목적**: 단일 파일에서 Claude가 FreeLang을 완전히 이해 & 즉시 코드 생성
> **크기**: 5K 토큰 (Context 최적화)
> **업데이트**: 2026-04-29

---

## 🚀 1️⃣ 5초 시작 (핵심만)

**FreeLang**: AI 전용 DSL 언어  
**평가**: A+ (AI 안정 DSL 완성)  
**특징**:
- 명시적 에러 (타입 안전)
- 결정론적 (배치 자동화 가능)
- kebab-case 명명 (fn-first 함수)
- 순수 함수 우선

**러너**:
```bash
node /root/kim/freelang-v11/bootstrap.js run app.fl
```

---

## 📚 2️⃣ 46개 stdlib 함수 (함수명 + 예제)

### ✅ 타입 검사 (9개)
```fl
(nil? x)              → x == null
(number? x)           → typeof x === 'number'
(string? x)           → typeof x === 'string'
(array? x)            → Array.isArray(x)
(map? x)              → is object (not array)
(fn? x)               → is function
(empty? x)            → is null/empty/zero-length
(true? x)             → x === true
(false? x)            → x === false
```

### ✅ 배열 조작 (8개)
```fl
(length arr)          → arr.length
(first arr)           → arr[0]
(last arr)            → arr[arr.length-1]
(rest arr)            → arr.slice(1)
(get arr 0)           → arr[0]
(append arr x)        → [...arr, x]
(map fn arr)          → arr.map(fn)  ← fn 먼저!
(filter fn arr)       → arr.filter(fn)  ← fn 먼저!
```

### ✅ 문자열 (5개)
```fl
(str x y z)           → x + y + z (자동 변환)
(upper-case s)        → s.toUpperCase()
(lower-case s)        → s.toLowerCase()
(trim s)              → s.trim()
(str-to-num "42")     → parseFloat("42")
```

### ✅ 맵/객체 (6개)
```fl
(get m :key)          → m.key
(keys m)              → Object.keys(m)
(values m)            → Object.values(m)
(map-set m :k v)      → {...m, k: v}
(map-entries m)       → [["k", v], ...]
(has-key? m :k)       → m.hasOwnProperty("k")
```

### ✅ 고차 함수 (3개)
```fl
(reduce fn init arr)  → arr.reduce(fn, init)  ← fn 먼저!
(sort arr)            → arr.sort()
(reverse arr)         → arr.reverse()
```

### ✅ 기타 (15개)
```fl
(define x 10)         → 변수 정의
(if cond then else)   → 3항 분기
(cond [...])          → 다중 분기
(try expr (catch $e handler) (finally cleanup))
(let [x 10 y 20] body)  → 지역 변수 (1D 또는 2D)
(do expr1 expr2...)   → 순차 실행
(+ - * / %)           → 산술 (가변인자)
(= < > <= >= !=)      → 비교
(and or not)          → 논리
(now-ms)              → Date.now()
(uuid)                → 고유 ID
(random)              → 비결정론 (배치 금지)
(println x)           → console.log
(throw "error")       → 예외 던지기
(match expr ...)      → 패턴 매칭
```

---

## ⚠️ 3️⃣ AI 실수 10가지 & 해결

| 실수 | ❌ 나쁨 | ✅ 올바름 | 이유 |
|------|--------|---------|------|
| 함수 순서 | `(reduce arr init fn)` | `(reduce fn init arr)` | fn-first 표준 |
| 구형 이름 | `(file_read "x")` | `(file-read "x")` | kebab-case 통일 |
| Null 비교 | `(= x null)` | `(nil? x)` | 명시적 함수 |
| 타입 변환 | `(+ 1 "2")` | `(+ 1 (str-to-num "2"))` | 명시적 강제 |
| 비결정론 | `(+ x (random))` in 배치 | 순수 함수만 | 재현성 필수 |
| 예외 무시 | `(+ x y)` 에러 | `(try (+ x y) (catch e 0))` | 명시적 처리 |
| Predicate | `(is-empty? x)` | `(empty? x)` | ? 접미사만 |
| 변수명 | `(let [_x 10] ...)` | `(let [x 10] ...)` | 명확한 이름 |
| 부작용 | `(do (file-write ...) (+ x 1))` | I/O는 명시 | 효과 분리 |
| 암묵적 강제 | `(if x "yes" "no")` | `(if (true? x) ...)` | 명시적 조건 |

---

## 💡 4️⃣ 베스트 프랙티스 (3개 패턴)

### 패턴 A: 순수 함수 캡슐화
```fl
(define process-data (fn [items]
  (map (fn [x] (* x 2)) items)))  ;; 순수

(define batch-job (fn [files]
  (reduce (fn [acc f]
    (append acc (process-data (file-read f))))
    [] files)))
```

### 패턴 B: Try-Catch 에러 처리
```fl
(define safe-parse (fn [json-str]
  (try
    (parse-json json-str)
    (catch e nil))))  ;; 실패 시 nil
```

### 패턴 C: Let 지역 변수
```fl
(let [data (file-read "data.json")
      count (length data)]
  (println "처리:" count "개"))
```

---

## 🎯 5️⃣ 커먼 패턴 (5개)

**패턴 1: map-filter-reduce** (데이터 변환)
```fl
(reduce (fn [acc x] (+ acc x)) 0
  (filter (fn [x] (> x 5))
    (map (fn [x] (* x 2)) [1 2 3 4 5])))
```

**패턴 2: if-cond** (분기)
```fl
(cond
  [(nil? x) "empty"]
  [(< x 0) "negative"]
  [true "positive"])
```

**패턴 3: try-catch** (에러)
```fl
(try
  (/ 10 (str-to-num input))
  (catch e 0))
```

**패턴 4: let-loop** (반복)
```fl
(loop [($i 0) (< $i 10) (+ $i 1)]
  (println $i))
```

**패턴 5: match** (패턴)
```fl
(match {:status "ok" :value 42}
  ({:status "ok" :value $v} (str "성공: " $v))
  (_ "실패"))
```

---

## ✅ 6️⃣ AI 검증 체크리스트

배포 전 확인:
- [ ] **문법**: `node bootstrap.js check code.fl` ← 에러 없음
- [ ] **순수성**: 배치 코드에 `file-read`, `random`, `http-*` 없음?
- [ ] **결정론**: 3회 실행 결과 동일?
- [ ] **타입**: `+` 앞 모두 숫자? `str` 앞 모두 문자?
- [ ] **명명**: kebab-case? predicate는 `?`?
- [ ] **에러**: 실패 경로 모두 `try-catch`?

---

## 📊 성과

| 항목 | 점수 | 상태 |
|------|------|------|
| 학습 곡선 | A (2-3시간) | ✅ |
| 안정성 | A+ (797 테스트) | ✅ |
| 결정론 | A (명확 분류) | ✅ |
| AI 친화 | A (10가지 실수 방지) | ✅ |

---

**마지막 업데이트**: 2026-04-29 (v11.1.0 릴리스)  
**라이선스**: MIT (AI 사용 허가)
