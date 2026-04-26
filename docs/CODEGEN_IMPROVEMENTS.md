# stage1 Codegen 개선 후보 — Y3++ 200 invariant 발견 사례

**작성**: 2026-04-26 (Y3++++ 200 invariant 통과 시점)
**근거**: `scripts/property-test.js` I001~I200 작성 중 발견한 stage1 산출물 동작 차이 4건.

---

## 공통 진단 절차

각 이슈는 다음 절차로 재현 확인:

```bash
echo '<재현 코드>' > /tmp/repro.fl
node stage1.js /tmp/repro.fl /tmp/repro.js
node /tmp/repro.js                                 # ← 여기서 실패
node bootstrap.js run /tmp/repro.fl                # ← interpreter 는 정상
```

→ **interpreter 는 정상, stage1 codegen 산출물만 실패**.
→ 모두 **언어 정의 단일성 원칙**(memory:feedback_language_unity_self_sovereignty) 위반 — bootstrap interpreter 와 stage1 codegen 의 지원 구문 집합이 달라짐.

---

## C1. 가변 인자 `-` (3+ args) 미지원

**재현**:
```clj
(println (- 5 5 5))   ; 기대 -5, 실제: 컴파일 에러 또는 잘못된 값
```

**stage1 산출 (현)**: `console.log((5 - 5 - 5))` 또는 `(5---5)` 같은 모호 출력.
부호 처리(prefix `-` vs binary `-`) 모호성.

**원인 추정**: `self/codegen.fl` 의 `cg-call` 또는 binary op emit 경로가 2 인자만 가정.

**제안 수정**: `(- a b c d)` → `((a - b) - c) - d` 좌결합 reduce.
`+`/`*` 는 이미 가변 인자 지원 (cg-call 경로) — `-`/`/` 도 동일 패턴 적용.

**회귀 테스트 추가**:
```clj
(assert (= (- 10 1 1 1) 7))
(assert (= (- 0 5) -5))
```

---

## C2. 가변 인자 `append` (3+ args) 미지원

**재현**:
```clj
(println (length (append (list 1) (list 2) (list 3))))   ; 기대 3, 실제: 에러
```

**stage1 산출 (현)**: `_fl_append` 가 2-arg 만 지원 (`src/_stdlib-signatures.json` 참고).

**제안 수정**: prelude 의 `_fl_append` 정의를 가변 인자로:
```js
const _fl_append = (...xs) => xs.flat().map(x => Array.isArray(x) ? x : [x]).flat();
```
또는 `(append a b c)` 를 `(append (append a b) c)` 로 codegen 단계에서 left-fold.

**회귀 테스트**:
```clj
(assert (= 6 (length (append (list 1 2) (list 3 4) (list 5 6)))))
```

---

## C3. `loop` 식별자 stage1 stdlib 충돌

**재현**:
```clj
(defn loop [n] (if (= n 0) "done" (loop (- n 1))))
(println (loop 5))                                  ; ReferenceError 또는 무한 루프
```

**stage1 산출 (현)**: `loop` 가 stdlib 이미 점유 → 사용자 정의가 shadow 안 됨.

**원인**: stage1 prelude 에 `loop` 관련 stub 또는 `recur`/`loop` special form 잔존.

**제안 수정**:
- 옵션 A: stdlib 내 `loop` 식별자 제거 (사용자 영역 양보)
- 옵션 B: 사용자 정의 시 자동 alias (`_fl_user_loop`) — codegen 변경 필요
- **권장**: A. stdlib 충돌 식별자 명시 목록 (`docs/RESERVED.md`) 신설하여 `defn` 시 reject.

**회귀 테스트** (수정 후):
```clj
(defn loop [n] (if (= n 0) 0 (loop (- n 1))))
(assert (= 0 (loop 10)))
```

---

## C4. let-rec 패턴 (let 안 fn 자기 호출) 미지원

**재현**:
```clj
(let [[fact (fn [n] (if (<= n 1) 1 (* n (fact (- n 1)))))]]
  (println (fact 5)))                               ; ReferenceError: fact is not defined
```

**stage1 산출 (현)**: `const fact = (n) => ... fact ...` — JS 에서는 `const` 우측에서 자기 참조 불가 (TDZ).

**제안 수정**:
- 옵션 A: `let [[f (fn ...)]]` 가 자기 참조 패턴이면 `let f; f = (n) => ...` 로 codegen
- 옵션 B: `letrec` special form 신설하여 명시 분리
- **권장**: A. 분석 비용 크지 않음 — `cg-let-binding` 에서 fn 우측을 lazy 으로 처리.

**회귀 테스트** (수정 후):
```clj
(let [[fib (fn [n] (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))]]
  (assert (= 55 (fib 10))))
```

---

## 우선순위 (ROI)

| # | 이슈 | 영향 범위 | 난이도 | 우선도 |
|---|------|----------|--------|--------|
| C2 | append 가변 인자 | prelude 한 줄 | 🟢 낮음 | **높음** (자주 사용) |
| C1 | `-` 가변 인자 | cg-call 한 분기 | 🟡 중간 | 중 |
| C4 | let-rec 패턴 | cg-let-binding 분기 | 🟡 중간 | **높음** (closure 핵심) |
| C3 | `loop` 충돌 | RESERVED.md + 검증 | 🟢 낮음 | 낮음 |

---

## 영향 — Y4-2B 재baseline 과 묶기 권장

위 4건은 모두 `self/codegen.fl` 또는 stage1 prelude 변경 → **SHA256 baseline 변동**.
Y4-2B (HTTP 서버 prelude require) 와 한 번에 묶어서 재baseline 절차를 한 번에 처리하는 것이 효율적.

**권장 시점**: Y4-2B 작업 시작 시 C1+C2+C4 동시 fix → SHA 재고정 1회.

---

## 검증 (전체 fix 후)

```bash
# 1) 재컴파일 + 새 SHA
node stage1.js self/all.fl stage1-new.js
sha256sum stage1-new.js                    # ← 새 baseline 기록

# 2) deep fixed-point
bash scripts/verify-fixed-point-deep.sh 10

# 3) property-test (회귀 가드)
make property-test ARGS=--n=10              # 200/200 PASS 유지
                                            # + I120/I131/I163/I168/I195 원래 형태로 복원

# 4) baseline 갱신
# CLAUDE.md 의 "5877b966..." → 새값
```

---

생성: 2026-04-26 (Y3++++ 200 invariant 통과 직후)
다음 작업: Y4-2B + C1/C2/C4 동시 진행 시점에 이 문서 업데이트
