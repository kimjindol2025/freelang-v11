# [P1-8] bug4 nested-defn hoisting — 부트스트랩 한계를 넘다

**작성일**: 2026-06-27  
**상태**: ✅ 완료 (L4 고정점 검증)  
**난이도**: ⭐⭐⭐⭐⭐ (부트스트랩 패러독스)

---

## 도입: 어려움이 즐거움이 되다

> "어렵다는 건 재미있다는 뜻이야. 도전이 성공할 때 어려움이 즐거움이 된다."

P1-8 nested-defn hoisting은 정확히 이 말의 의미를 증명하는 작업이었다.

표면적으로는 간단해 보인다:
- 중첩된 함수 정의를 top-level로 끌어올리기
- forward declaration 생성

하지만 현실은 달랐다.

---

## 문제: 부트스트랩 패러독스

### 설정 (v11.6.38까지)

```lisp
;; cgc-main.fl — C 코드 생성기 (FreeLang으로 작성)
(defn cgc-defn [expr depth]
  (reset! cgc-defn-depth-atom (+ @cgc-defn-depth-atom 1))
  ;; ... hoisting logic
  (reset! cgc-defn-depth-atom (- @cgc-defn-depth-atom 1)))
```

코드는 완벽했다. 하지만...

```bash
# cgc-bin (native 바이너리)로 테스트
./cgc-bin /tmp/test-bug4.fl /tmp/test-bug4.c

# 생성된 C 코드: fl_nil() 만 생성
# nested defn 없음 ❌
```

### 근본 원인: bootstrap.js C 코드 생성 버그

진단 과정:

1. **cgc-main.fl 수정은 정상** ✅
   - 코드 작성 올바름
   - 로직 검증 완료

2. **bootstrap.js는?** 🤔
   - bootstrap.js: Node.js 기반 FreeLang 컴파일러
   - cgc-main.fl을 bootstrap.js로 컴파일하면?

3. **원인 발견**: `swap! + anonymous fn` 패턴

```lisp
;; cgc-main.fl에 이렇게 작성
(swap! cgc-defn-depth-atom (fn [$d] (+ $d 1)))
```

**bootstrap.js 생성 C 코드**:

```c
/* ❌ 버그: fn 바디 소실 */
fl_atom_reset(cgc_defn_depth_atom,
  fl_atom_deref(cgc_defn_depth_atom));  // no-op!

/* ✅ 기대: 이렇게 나와야 함 */
fl_atom_reset(cgc_defn_depth_atom,
  fl_add(fl_atom_deref(cgc_defn_depth_atom), fl_int(1)));
```

**발생 위치**: 3곳
1. depth 증가: `(swap! cgc-defn-depth-atom (fn [$d] (+ $d 1)))`
2. depth 감소: `(swap! cgc-defn-depth-atom (fn [$d] (- $d 1)))`
3. forward 누적: `(swap! cgc-hoisted-fwds-atom (fn [$acc] (str $acc ...)))`

**결과**: depth 항상 0 → hoisting 조건 `(if (> $depth 0) ...)` 절대 true 안 됨 → hoisting 미발동

---

## 해결책: 부트스트랩 한계 우회

**핵심 아이디어**: bootstrap.js를 수정하지 않고, cgc-main.fl 코드 패턴을 변경

`swap! + fn` → `reset! + direct expression`으로 교체

```lisp
;; BEFORE (bootstrap.js 버그로 인해 작동 안 함)
(swap! cgc-defn-depth-atom (fn [$d] (+ $d 1)))

;; AFTER (bootstrap.js에서 정상 생성)
(reset! cgc-defn-depth-atom (+ @cgc-defn-depth-atom 1))
```

**왜 이게 동작하는가?**

bootstrap.js는 다음을 처리 못함:
- `(fn [...] body)` 내부의 `body` 추출

하지만 다음은 완벽하게 처리:
- `@atom` 를 포함한 직접 표현식
- `reset!`의 두 번째 인자로 전체 식 평가

**단일 스레드 보증**: 이 교체가 안전한 이유
- FreeLang은 단일 스레드 실행
- `swap!`과 `reset!`의 차이가 없음 (race condition 없음)

---

## 구현: 3개 위치 수정

### 파일: `self/cgc-main.fl`

#### 수정 1: depth 증가 (line 1264)

```diff
- (swap! cgc-defn-depth-atom (fn [$d] (+ $d 1)))
+ (reset! cgc-defn-depth-atom (+ @cgc-defn-depth-atom 1))
```

#### 수정 2: depth 감소 (line 1266)

```diff
- (swap! cgc-defn-depth-atom (fn [$d] (- $d 1)))
+ (reset! cgc-defn-depth-atom (- @cgc-defn-depth-atom 1))
```

#### 수정 3: forward 누적 (line 1274-1277)

```diff
- (swap! cgc-hoisted-fwds-atom (fn [$acc]
-   (str $acc
-        "FLValue " $name "(" $ps ");\n" ...)))

+ (reset! cgc-hoisted-fwds-atom
+   (str @cgc-hoisted-fwds-atom
+        "FLValue " $name "(" $ps ");\n" ...))
```

---

## 검증: L4 고정점 달성

### 8개 Stage 수행

| Stage | 작업 | 결과 |
|-------|------|------|
| 1-4 | cgc-main.fl 수정 | ✅ 완료 |
| 5 | L4 고정점 | ✅ gen2 == gen3 |
| 6 | 회귀 테스트 | ✅ 100% 통과 |
| 7 | 배포 | ✅ cgc-bin 업데이트 |
| 8 | Gogs push | ✅ 완료 |

### Stage 5: L4 고정점 검증

```
Step 1: bootstrap.js (Node.js) 컴파일
  cgc-main.fl → gen1.c
  SHA256: 5c1ede...

Step 2: gen1-bin (native) 컴파일
  cgc-main.fl → gen2.c
  SHA256: 5c1ede... ✅ (동일)

Step 3: gen2-bin (native) 컴파일
  cgc-main.fl → gen3.c
  SHA256: 5c1ede... ✅ (동일)

결론: 완벽한 자가호스팅 수렴
```

### Stage 6: 회귀 테스트

**bug2 테스트** (implicit-do 수정):
```
✅ split 결과: ["a" "b"]
✅ 길이: 2 (기대값)
✅ 정렬됨: true
```

**bug4 기능 테스트** (nested-defn hoisting):
```
✅ process([1 2 3]) → [2 4 6]
✅ nested defn 정상 호출
✅ forward declaration 생성됨
```

**기본 기능 회귀** (6개 테스트):
```
✅ add(3, 4) = 7
✅ if 조건 동작
✅ let 바인딩
✅ loop/recur
✅ vector/map 조작
✅ map/filter
```

---

## 함께 완성한 bug2: implicit-do

P1-8 구현 중 발견: **cgc-defn-impl이 첫 번째 바디만 처리**

```lisp
;; BEFORE: 첫 번째 statement만 처리
(let [[$body (cgc (get $args 2))]]
  ...)

;; AFTER: 모든 statement를 implicit-do로 처리
(let [[$bodies (slice $args 2 (length $args))]
      [$body (if (= (length $bodies) 1)
               (cgc (get $bodies 0))
               (cgc-do $bodies))]]
  ...)
```

**결과**: 다중 바디 정상 처리 ✅

---

## P1 전체 완성

```
P1-5:  server_json auto-stringify        ✅
P1-8:  nested-defn hoisting (이번 작업)  ✅
P1-11: fl_run_parallel                   ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P1 11개 모두 완료                         ✅✅✅
```

---

## 교훈: 부트스트랩의 미로

### 자가호스팅의 역설

FreeLang 컴파일러는 FreeLang으로 작성되어 있다.

```
cgc-main.fl (FreeLang)
     ↓
bootstrap.js (Node.js) — 1회 컴파일
     ↓
cgc-bin-gen1 (native)
     ↓
cgc-bin-gen2 (native) ← gen1 재컴파일
     ↓
cgc-bin-gen3 (native) ← gen2 재컴파일 (일치!)
```

이 고리 속에서:
- cgc-main.fl 수정이 즉시 반영되려면
- bootstrap.js가 정확해야 함

하지만 bootstrap.js의 버그를 수정하려면?
- TypeScript 수정 → 컴파일 → 배포
- 복잡함

**우리의 해결책**: 부트스트랩 버그를 우회하는 코드 패턴 변경
- bootstrap.js 수정 없음
- cgc-main.fl 패턴만 변경
- 결과: 자가호스팅 유지 ✅

---

## 수치로 보는 성과

| 지표 | 값 |
|------|-----|
| 수정 파일 | 1 (cgc-main.fl) |
| 수정 줄 수 | 9 (3개 위치) |
| 컴파일 사이클 | 3 (L4) |
| 회귀 테스트 | 6/6 통과 |
| L4 고정점 | 달성 ✅ |
| 자가호스팅 | 증명됨 ✅ |

---

## 한 줄 요약

**부트스트랩 한계는 극복할 수 없지만, 그 한계 안에서 최적의 길을 찾을 수 있다.**

어려움의 다른 이름은 도전이고, 도전의 성공이 즐거움이다. 🎯

---

**다음**: Phase 6 (또는 P2) 어떤 방향으로?
