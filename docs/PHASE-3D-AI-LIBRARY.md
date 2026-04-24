# Phase 3-D: AI 라이브러리 — self/stdlib/ai.fl

**목표**: FreeLang으로 AI 에이전트 핵심 라이브러리 구현  
**범위**: 벡터 연산 + 프롬프트 템플릿 + 순위 결정  
**예상**: 3-5일 (구현 + 테스트)

---

## 📋 핵심 6개 함수

### 1️⃣ vector-add (벡터 덧셈)
```fl
(defun vector-add [v1 v2]
  "두 벡터를 더함 [a b c] + [x y z] = [a+x b+y c+z]"
  (map (fn [[p] (+ (get v1 p) (get v2 p))]
       (range 0 (length v1)))))
```

### 2️⃣ vector-dot (내적)
```fl
(defun vector-dot [v1 v2]
  "내적: a·b = Σ(a_i * b_i)"
  (reduce (fn [acc i]
    (+ acc (* (get v1 i) (get v2 i))))
   0
   (range 0 (length v1))))
```

### 3️⃣ cosine-sim (코사인 유사도)
```fl
(defun cosine-sim [v1 v2]
  "코사인 유사도: (a·b) / (|a||b|)"
  (let [[dot (vector-dot v1 v2)]
        [norm1 (math-sqrt (vector-dot v1 v1))]
        [norm2 (math-sqrt (vector-dot v2 v2))]]
    (/ dot (* norm1 norm2))))
```

### 4️⃣ score-candidates (후보 점수 계산)
```fl
(defun score-candidates [query candidates]
  "각 후보를 query와 비교해 점수 계산
   결과: [{:idx 0 :score 0.95} {:idx 1 :score 0.87} ...]"
  (map-indexed (fn [idx cand]
    {:idx idx :score (cosine-sim query cand)})
   candidates))
```

### 5️⃣ prompt-template (프롬프트 템플릿)
```fl
(defun prompt-template [template vars]
  "템플릿에 변수 대입
   template: 'User: {user}, Query: {query}'
   vars: {:user 'Alice' :query 'help'}"
  (reduce (fn [acc [key val]]
    (str-replace acc (str \"{\" key \"}\") val))
   template
   (map-entries vars)))
```

### 6️⃣ top-k-retrieval (상위 K개 검색)
```fl
(defun top-k-retrieval [scored-list k]
  "상위 K개 반환 (점수 내림차순)
   scored-list: [{:idx 0 :score 0.95} ...]
   k: 3
   결과: [{:idx 0 :score 0.95} ...]"
  (take k (reverse (sort scored-list 
    (fn [a b] (< (get a :score) (get b :score)))))))
```

---

## 🧪 테스트 계획

### 로컬 테스트 (tests/l2/ai-*.fl)

```fl
;; 테스트 1: 벡터 연산
(defun test-vector-ops []
  (let [[v1 [1 0 0]]
        [v2 [0 1 0]]]
    (list
      (vector-add v1 v2)        ; [1 1 0]
      (vector-dot v1 v2)        ; 0
      (cosine-sim v1 v2))))     ; 0 (직교)

;; 테스트 2: 점수 계산
(defun test-scoring []
  (let [[query [1 0 0]]
        [candidates [[1 0 0] [0 1 0] [0.7 0.3 0]]]]
    (score-candidates query candidates)))

;; 테스트 3: 프롬프트 템플릿
(defun test-prompt []
  (prompt-template 
    "User: {user}, Query: {query}"
    {:user "Alice" :query "help"}))

;; 테스트 4: Top-K 검색
(defun test-topk []
  (let [[scored [{:idx 0 :score 0.9}
                 {:idx 1 :score 0.7}
                 {:idx 2 :score 0.95}]]]
    (top-k-retrieval scored 2)))
```

### Jest 통합 테스트

```typescript
describe('AI Library', () => {
  it('벡터 연산이 정확해야 함', () => {
    // compile ai.fl
    // execute tests
    // verify outputs
  });

  it('코사인 유사도가 -1~1 범위여야 함', () => {
    // normalization check
  });

  it('프롬프트 템플릿이 변수를 대입해야 함', () => {
    // template substitution
  });
});
```

---

## 📊 구현 일정

| 단계 | 시간 | 산출물 |
|------|------|--------|
| 1. AI 함수 구현 (ai.fl) | 2h | 6개 함수 |
| 2. 로컬 테스트 (tests/l2/ai-*.fl) | 1h | 4개 테스트 |
| 3. Jest 래퍼 + CI | 1h | 테스트 자동화 |
| 4. 성능 검증 | 1h | 벤치마크 |
| **총 소요** | **5h** | **완성** |

---

## 🎯 성공 기준

- [ ] 6개 함수 구현 및 로컬 테스트 통과
- [ ] 벡터 연산 정확도 (부동소수점 오차 <1e-6)
- [ ] 프롬프트 템플릿 100% 치환
- [ ] Top-K 정렬 및 순서 보증
- [ ] 기존 테스트 회귀 없음 (639/646 PASS 유지)

---

## 🔧 기술 메모

### 의존성
- `self/stdlib/math.fl`: math-sqrt 필수
- `self/stdlib/list.fl`: map, filter, reduce, sort, reverse
- `self/stdlib/string.fl`: str-replace, str

### 예상 파일 크기
- ai.fl: ~1.5KB (6개 함수)
- 산출 JS: ~3KB

### 성능 목표
- 벡터 크기 100: <1ms
- 후보 1000개 Top-K: <10ms

---

**준비 상태**: 완전 준비 ✅  
**시작 신호 대기 중**: "만들어주세요" 🚀
