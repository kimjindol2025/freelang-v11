# AI 블록 상세 가이드

FreeLang v9의 가장 강력한 기능은 AI 추론 과정을 언어 수준에서 지원하는 블록들입니다.

---

## 1. COT (Chain-of-Thought)

체계적이고 단계적인 추론:

```lisp
[COT
 :goal "사용자 인증 시스템 설계"
 :steps [
   "JWT 토큰 구조 정의"
   "비밀번호 암호화 방식 결정 (bcrypt)"
   "리프레시 토큰 전략 수립"
   "만료 정책 설정"
 ]
 :conclude (fn []
   (service-auth
     :type :jwt
     :hash :bcrypt
     :ttl 3600))]
```

### 사용 사례
- 복잡한 설계 결정
- 단계별 문제 해결
- AI 추론 과정 기록

---

## 2. TOT (Tree-of-Thought)

여러 경로를 탐색하여 최적의 해답 찾기:

```lisp
[TOT
 :problem "데이터 검색 속도 최적화"
 :branches [
   {:name "인덱싱" :cost 2000 :benefit 8}
   {:name "캐싱" :cost 500 :benefit 7}
   {:name "파티셔닝" :cost 3000 :benefit 9}
   {:name "조인 최적화" :cost 1000 :benefit 6}
 ]
 :eval (fn [branch]
   (- (:benefit branch) (:cost branch)))
 :select :best]
```

### 사용 사례
- 여러 구현 방식 비교
- 최적화 전략 선택
- 트레이드오프 분석

---

## 3. REFLECT (자기 평가)

생성한 코드/아이디어에 대한 자기 비판:

```lisp
[REFLECT
 :output (generate-solution problem)
 :criteria [
  "코드 간결성"
  "성능 효율성"
  "유지보수성"
  "테스트 가능성"
 ]
 :score (fn [output criteria]
  (evaluate-against criteria output))
 :improve? (< score 7)]
```

### 사용 사례
- 생성된 코드 품질 평가
- 자동 리팩토링
- 성능 분석

---

## 4. HYPOTHESIS (가설 설정)

가설을 명시적으로 설정하고 검증:

```lisp
[HYPOTHESIS
 :claim "HTTP 요청이 3초 이내 완료될 것"
 :assumptions [
  "네트워크 지연 < 200ms"
  "서버 응답 < 2.8초"
 ]
 :test (fn []
  (let [start (now)
        result (call-api "https://api.example.com")
        elapsed (- (now) start)]
    (< elapsed 3000)))
 :accept? (run-test 100)]
```

### 사용 사례
- 성능 요구사항 검증
- 시스템 가정 검증
- A/B 테스트 정의

---

## 5. DEBATE (내부 토론)

여러 관점에서 결정을 평가:

```lisp
[DEBATE
 :question "데이터베이스로 PostgreSQL을 선택할까?"
 :pro-agent [
  "트랜잭션 보장"
  "복잡한 쿼리 지원"
  "대규모 데이터 최적화"
 ]
 :con-agent [
  "운영 복잡도"
  "SQLite로도 충분한 경우가 많음"
  "개발 속도 느림"
 ]
 :judge (fn [pro con context]
  (if (complex-queries? context)
    pro
    con))]
```

### 사용 사례
- 기술 선택 결정
- 트레이드오프 분석
- 팀 의견 통합

---

## 6. EVOLVE (자기 진화)

유전 알고리즘으로 해결책을 지속적으로 개선:

```lisp
[EVOLVE
 :population (generate-solutions 50)
 :fitness (fn [solution]
  (+ (performance solution)
     (simplicity solution)))
 :generations 10
 :mutation-rate 0.1
 :crossover-rate 0.7
 :result (best-of-generation)]
```

### 사용 사례
- 코드 자동 최적화
- 알고리즘 튜닝
- 피처 엔지니어링

---

## 7. MEMORY (장기/단기 메모리)

AI의 학습과 기억:

### 장기 메모리 (항구적)
```lisp
[REMEMBER
 :key "user-patterns"
 :value {:login-freq 15 :purchase-avg 150}
 :ttl :forever]
```

### 단기 메모리 (세션 중)
```lisp
[REMEMBER
 :key "current-context"
 :value {:user-id 123 :task "checkout"}
 :ttl 3600]
```

### 메모리 조회
```lisp
[RECALL
 :key "user-patterns"
 :fallback {}]
```

---

## 8. MAYBE (확률값)

불확실성을 일급 값으로 표현:

```lisp
; 95% 확신도로 값 표현
(maybe 0.95 "likely-user-preference")

; maybe 값 체이닝
(-> (maybe 0.9 user-guess)
    (maybe-map predict-next-action)
    (maybe-flat-map fetch-relevant-data))

; maybe 값 추출
(unwrap-or maybe-value default)
```

### 사용 사례
- 추천 시스템
- 신뢰도 기반 의사결정
- 불완전한 정보 처리

---

## 9. USE-TOOL (도구 사용)

외부 도구/API 활용:

```lisp
[USE-TOOL
 :tool web-search
 :args {:query "FreeLang v9 튜토리얼"}
 :parse (fn [response]
  (map extract-title (:results response)))
 :on-error (fn [err]
  (print "검색 실패:" err)
  [])]
```

### 지원 도구
- web-search: 웹 검색
- file-read: 파일 읽기
- http-request: HTTP 호출
- db-query: 데이터베이스 조회

---

## 10. CAUSAL (인과 추론)

"왜"라는 질문에 답하기:

```lisp
[CAUSAL
 :observation "판매량 20% 감소"
 :hypotheses [
  "가격 인상이 원인"
  "경쟁사 신제품 출시"
  "계절성 효과"
  "마케팅 부족"
 ]
 :test (fn [hypothesis]
  (measure-correlation hypothesis outcome))
 :conclude (best-fit)]
```

### 사용 사례
- 원인 분석
- 근본 원인 파악
- 성능 저하 원인 추적

---

## 11. COUNTERFACTUAL (반사실 추론)

"만약 X가 아니었다면?"

```lisp
[COUNTERFACTUAL
 :actual {:feature-a true :feature-b false}
 :scenario {:feature-a false :feature-b true}
 :measure (fn [config]
  (run-simulation config))
 :compare (fn [actual scenario]
  (- actual scenario))]
```

### 사용 사례
- A/B 테스트 분석
- 설계 결정 후회 분석
- 최적화 기회 발굴

---

## 12. AGENT (자율 에이전트)

독립적으로 작동하는 AI 에이전트:

```lisp
[AGENT
 :name "email-processor"
 :goal "새 이메일 처리"
 :perceive (fn [] (fetch-emails))
 :think (fn [emails]
  (map classify-and-prioritize emails))
 :act (fn [actions]
  (execute-actions actions))
 :reflect (fn [results]
  (log-and-learn results))]
```

### 사용 사례
- 자동화 워크플로우
- 백그라운드 태스크
- 지속적 학습

---

## 실전 예제: 추천 시스템

```lisp
(defn recommend-product [user-id]
  (let [user-profile (recall :key (str "user-" user-id))
        similar-users (use-tool web-search
                        :query (str "users similar to " user-id))]
    [TOT
     :problem "사용자에게 가장 좋은 상품 추천"
     :branches [
      {:name "협업 필터링" :cost 500 :benefit 7}
      {:name "콘텐츠 기반" :cost 200 :benefit 6}
      {:name "인기도 기반" :cost 50 :benefit 4}
     ]
     :select (fn [scores]
       (cond
         (> (score "협업 필터링") 6.5) (recommend-collab user-id)
         (> (score "콘텐츠 기반") 5.5) (recommend-content user-id)
         :else (recommend-popular)))]))
```

---

## 다음 단계

- [프레임워크](./frameworks.md) — 웹 앱 구축
- [API 레퍼런스](../api/stdlib.md) — 사용 가능한 모든 함수
