# Phase G: MISTAKES-100 자동 처리 로드맵

> **목표**: 100개 중 50개 실수를 언어가 자동으로 처리/방지  
> **기간**: 3주 (G-1, G-2, G-3)  
> **효과**: 개발 생산성 50% ↑, 에러율 70% ↓

---

## Phase G-1: 기초 (1주)

### G-1-A: 에러 포매터 bootstrap.js 통합 (P0)

**목표**: 모든 에러에 helpful hint 추가

```
현재:
[31m실행 오류[오류]  unknown-func를 찾을 수 없습니다. (at line 4, col 0)

개선:
[31m✖ 실행 오류[0m  unknown-func
  💡 혹시 이 함수를 찾으신가요?
     → (println ...) [유사도: 2]
     → (printf ...) [유사도: 2]
  힌트: 함수명을 확인하거나 (help 'unknown-func) 실행하세요
```

**작업**:
1. error-formatter.ts의 suggestSimilar() → bootstrap.js 포팅
2. KNOWN_ALIASES 매핑 추가 (50개 함수)
3. 런타임 에러 출력에 hint 자동 추가
4. 테스트: 20개 에러 케이스 검증

**체크리스트**:
- [ ] suggestSimilar() JS 버전 작성
- [ ] bootstrap.js의 evalBuiltins에 hint 로직 추가
- [ ] KNOWN_ALIASES 데이터 포함
- [ ] 테스트 통과 (20/20)

---

### G-1-B: 유사 함수 추천 (P0 보조)

**목표**: 함수명 오류 시 "혹시...?" 제안

```fl
(console_log "hello")
→ ❌ 함수 'console_log' 찾을 수 없음
→ 💡 println을 찾으셨나요?

(map arr fn)
→ ❌ 인자 순서 오류
→ 💡 혹시 (map fn arr)를 의도하셨나요?
```

**작업**:
1. levenshtein 거리 계산 함수 추가
2. 함수명 오류 시 상위 3개 제안
3. 인자 순서 감지 규칙 추가
4. 테스트: TODO API #2번 에러 "text: null" 해결

---

## Phase G-2: 문법 개선 (2주)

### G-2-A: let 문법 자동 수정 (P1)

**목표**: 단일 `(let [$x 1] ...)` → `(let [[$x 1]] ...)`

```fl
현재 에러:
[31m파싱 오류[0m] let 바인딩은 쌍으로 묶여야 합니다

개선:
(let [$x 1] $x)
→ 파서가 자동으로 (let [[$x 1]] $x)로 수정
→ ✅ 실행: 1
```

**작업**:
1. parser.ts의 parseLet() 함수 개선
2. 단일 바인딩 감지 → 이중 괄호 자동 추가
3. 경고 메시지: "단일 바인딩은 [[$x val]] 형식입니다"
4. 테스트: MISTAKES-100 #21-25 모두 통과

---

### G-2-B: 인자 순서 자동 감지 (P0 확장)

**목표**: `(map arr fn)` → 파서가 자동으로 `(map fn arr)` 변환

```fl
규칙:
- map/filter/reduce: fn 첫 번째 감지
  (map [1 2 3] fn)       → (map fn [1 2 3])
  (filter arr (fn [...]) → (filter (fn [...]) arr)

- get/assoc/dissoc: map/collection 첫 번째 감지
  (get "key" map)        → (get map "key")
  (assoc "k" "v" m)      → (assoc m "k" "v")

- str-*: 문자열 첫 번째 감지
  (str-contains "lo" "hello") → (str-contains "hello" "lo")
```

**작업**:
1. evalBuiltins에서 10개 함수 규칙 정의
2. 타입 힌트 기반 인자 순서 감지
3. 변환 시 경고: "인자 순서를 자동 수정했습니다"
4. 테스트: MISTAKES-100 #1-10 모두 통과

---

## Phase G-3: 타입 및 안전성 (3주)

### G-3-A: HTTP 래퍼 (P2)

**목표**: http_get 반환값 자동 처리

```fl
;; 현재 (복잡함)
(define resp (http_get url))
(json_parse (get resp "body"))

;; 개선 후 (간단함)
(http_get-json url)        → body만 자동 추출 + JSON 파싱

또는 매크로:
(with-http-json (http_get url)
  (println response))      → response = body (자동 파싱)
```

**작업**:
1. 래퍼 함수 추가:
   - `http_get_json`: 자동 body 추출 + JSON 파싱
   - `http_post_json`: 동일
   - `http_get_status`: status 직접 반환
2. 문서: MISTAKES-100 #11-15 해결
3. 테스트: TODO API body 파싱 문제 해결

---

### G-3-B: try-catch 완성 (P1)

**목표**: 실제 작동하는 try-catch 구현

```fl
(try
  (/ 1 0)
  (catch [e] (str "에러: " e))
  (finally (println "정리")))

또는 Result 패턴:
(define result (try-wrap (fn [] (/ 1 0))))
(if (ok? result)
  (println "값:" (unwrap result))
  (println "에러:" (error-msg result)))
```

**작업**:
1. try-catch 파서 구현
2. 에러 전파 메커니즘
3. finally 블록 지원
4. 테스트: 에러 처리 4가지 시나리오

---

### G-3-C: 타입 검증 (P3)

**목표**: 런타임 타입 오류 방지

```fl
;; 컴파일 타임 경고
(defn add-strict [a b]
  :requires [(number? a) (number? b)]
  (+ a b))

(add-strict "1" "2")
→ ⚠️ 타입 경고: a는 number여야 하는데 string 받음
```

**작업**:
1. `:requires` 메타데이터 추가
2. 런타임 검증 함수
3. atom 사용 강제 경고
4. 테스트: MISTAKES-100 #16-20 모두 통과

---

## 체크리스트

### G-1 (1주)
- [ ] error-formatter.ts 포팅
- [ ] KNOWN_ALIASES 50개 입력
- [ ] bootstrap.js 통합
- [ ] 테스트 20/20 통과
- [ ] 커밋 + 푸시

### G-2 (2주)
- [ ] let 문법 자동 수정
- [ ] 인자 순서 자동 감지 (10개 함수)
- [ ] TODO API #2 에러 해결
- [ ] MISTAKES-100 #1-25 통과
- [ ] 커밋 + 푸시

### G-3 (3주)
- [ ] HTTP 래퍼 함수 (http_get_json 등)
- [ ] try-catch 완성
- [ ] 타입 검증 메타데이터
- [ ] MISTAKES-100 #26-50 통과
- [ ] 최종 테스트: 50/50
- [ ] 커밋 + 푸시

---

## 최종 효과

| 항목 | 현재 | 개선 후 |
|------|------|--------|
| 개발 속도 | - | +50% |
| 에러율 | - | -70% |
| 문서화 | MISTAKES-100 | 언어가 자동 처리 |
| 신규 개발자 학습곡선 | 가파름 | 완만함 |

---

## 시작: Phase G-1-A (에러 포매터 통합)

시작할까요?
