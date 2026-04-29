# FreeLang v11: AI 에이전트 친화성 가이드

**정의**: FreeLang은 AI가 생성·검증·실행하기 쉬운 안정적 DSL입니다.

---

## 🎯 AI 친화성 5대 원칙

### 1️⃣ 명시적 에러 (No Silent Failure)
```fl
❌ (+ 1 "2")          ;; 암묵적 형변환
✅ (+ 1 2)            ;; 명시적 타입 일치 강제
```
→ **AI 장점**: 실수를 즉시 감지, 자동 수정 가능.

### 2️⃣ 순수 함수 우선 (Determinism First)
```fl
✅ (reduce (fn [acc x] (+ acc x)) 0 [1 2 3])  ;; 항상 6
❌ (get-random 1 100)                          ;; 비결정론
```
→ **AI 장점**: 배치 자동화, 재현성 보증, 테스트 작성 용이.

### 3️⃣ 단일 명명 규칙 (No Aliasing)
```fl
✅ (file-read "path")     ;; 표준
❌ (file_read "path")     ;; 금지 (alias 없음)
```
→ **AI 장점**: 생성 코드의 일관성, 린팅 도구 작동.

### 4️⃣ 명시적 제어흐름 (No Magic)
```fl
✅ (if condition true-branch false-branch)
❌ (condition && true-branch || false-branch)  ;; 암묵적 coercion
```
→ **AI 장점**: 코드 의도 명확, 로직 추적 쉬움.

### 5️⃣ 격리된 부작용 (Effect Isolation)
```fl
;; ✅ 순수 함수 영역
(define result (reduce fn 0 list))

;; ⚠️ I/O는 명시적 태그
(file-write "out.txt" result)
```
→ **AI 장점**: 트랜잭션 안전, 롤백 가능, 병렬 실행 안전.

---

## 📊 AI 생성성 점수

| 항목 | 점수 | 근거 |
|------|------|------|
| **학습곡선** | A | 2-3시간 학습 가능, 50+ 샘플 제공 |
| **안정성** | A+ | 797 테스트 + Property Testing 9/9 + Fuzzing |
| **결정론성** | A | 순수/비결정론 명확 분류, DETERMINISM_GUIDE.md |
| **명명 규칙** | A | kebab-case 단일화, 620개 함수 통일 |
| **자동화** | A | 순수 함수 → 배치 자동화, I/O 추적 가능 |
| **전체** | **A** | **AI 전용 언어로 산업 준비 완료** |

---

## 🤖 AI가 자주 하는 실수 (10가지)

| 실수 | 원인 | 해결 |
|------|------|------|
| `(file_read "path")` | 구형 이름 | 표준: `(file-read "path")` |
| `(reduce arr init fn)` | 인자 순서 착각 | 표준: `(reduce fn init arr)` (fn-first) |
| `(= x null)` | null 매직 | 표준: `(nil? x)` 또는 `(nil-or-empty? x)` |
| `(random)` in 배치 | 비결정론 몰각 | 배치: 순수 함수만, I/O는 명시 |
| `(+ 1 "2")` | 형변환 가정 | 명시: `(+ 1 (str-to-num "2"))` |
| `if (cond)` 대신 JS 스타일 | 언어 혼동 | FreeLang: `(if cond true false)` |
| `{:a 1} vs (map :a 1)` | 마크업 문법 혼동 | 맵: `{:key "value"}`, 함수: `(fn args)` |
| 예외 무시 | 에러 처리 누락 | 표준: `(try ... (catch err ...))` |
| `(map arr fn)` | 인자 순서 착각 | 표준: `(map fn arr)` (fn-first) |
| 외부 API 호출 in 순수 블록 | 부작용 몰각 | I/O: 명시적 격리 `#[side-effect]` |

---

## 💡 AI를 위한 베스트 프랙티스

### ✅ 좋은 패턴

```fl
;; 1. 순수 함수로 로직 캡슐화
(define sum-list (fn [lst]
  (reduce (fn [acc x] (+ acc x)) 0 lst)))

;; 2. I/O는 명시적 분리
(define process-file (fn [path]
  (let [[content (file-read path)]]
    ;; 순수 처리
    (define result (sum-list (parse-lines content)))
    ;; 명시적 I/O
    (file-write "output.txt" (str result)))))

;; 3. 결정론 검증
(define batch-process (fn [files]
  (reduce (fn [results file]
    (let [[data (file-read file)]]
      (append results (sum-list data))))
    [] files)))
```

### ❌ 나쁜 패턴

```fl
;; 1. 비결정론 무분별 사용
(define id-gen (fn [] (str (random) (now))))  ;; 매번 다름

;; 2. 부작용 숨김
(define process (fn [x]
  (do
    (http-post "/api" x)  ;; I/O 숨음
    (+ x 1))))

;; 3. 형변환 가정
(define add (fn [a b]
  (+ a b)))  ;; "1" + 2 → 에러

;; 4. 구형 이름
(define old-code (fn []
  (json_keys {:a 1})))  ;; file_read, json_set 등
```

---

## 🔬 AI 검증 프레임워크

### Phase 1: 문법 검증
```bash
freelang check agent.fl
```

### Phase 2: 린팅
```bash
freelang lint --strict-ai-mode=error agent.fl
```

### Phase 3: 동작 테스트
```bash
freelang run agent.fl
# 또는
node bootstrap.js run agent.fl
```

### Phase 4: 결정론 검증
```bash
for i in {1..3}; do
  node bootstrap.js run agent.fl
done
# 결과가 동일한지 확인
```

---

## 📚 AI 학습 자료

1. **[AI Learning Path](./AI_LEARNING_PATH.md)** — 기본 학습 (2-3시간)
2. **[Stdlib Reference](./STDLIB_REFERENCE.md)** — 46개 함수 상세
3. **[Naming Conventions](./NAMING_CONVENTIONS.md)** — 명명 규칙
4. **[Determinism Guide](./DETERMINISM_GUIDE.md)** — 순수/비결정론 구분
5. **[Patterns](../examples/patterns/)** — 10가지 실무 패턴

---

## 🚀 AI 친화성 체크리스트

생성 코드를 배포하기 전에:

- [ ] **문법**: `freelang check` 통과
- [ ] **린팅**: `--strict-ai-mode=error` 통과 (구형 이름 × , 명명 규칙 ○)
- [ ] **순수성**: 배치 코드에 `file-read`, `http-get` 없음
- [ ] **결정론**: 3회 실행 결과 동일
- [ ] **타입**: 형변환 명시 (`str-to-num`, `num-to-str`)
- [ ] **I/O 격리**: 부작용 명시적 태그 `#[side-effect]`
- [ ] **에러**: 모든 가능 경로에 `try-catch`

---

**마지막 업데이트**: 2026-04-29 (Phase A 완료)  
**평가**: **A (AI 안정 DSL 사업화 준비 완료)**
