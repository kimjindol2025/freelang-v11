# Phase B-2: Closure Capture Implementation Analysis (2026-05-24)

**상태**: ✅ 구현 검증 중  
**목표**: 함수가 외부 변수를 캡처하는 semantics 확보  
**영향도**: HIGH — 코드 생성기 핵심

---

## 발견 사항

### JS 백엔드 상태
- ✅ **6/6 closure 패턴 동작** (test-closure-capture.fl)
  - Pattern 1: Pure function (no capture)
  - Pattern 2: Single variable capture
  - Pattern 3: Multiple variable capture
  - Pattern 4: Nested closure
  - Pattern 5: Closure in filter context
  - Pattern 6: Recursive closure

### C 백엔드 현황
```
현재 구현 상태:
✅ cgc-fn: Lambda 함수 생성 (line 353-378)
✅ cgc-fn-caps-filter: 외부 변수 필터링 (line 329-339)
✅ cgc-fn-env-decls: env[] 복원 코드 (line 340-345)
⏳ cgc-env-arr: env[] 배열 초기화 (line 348-353) — 버그 수정 완료
```

---

## 구현 구조

### 1. 캡처 분석 (cgc-fn-caps-filter)
```
Input:
  $all-vars: 함수 본문에서 사용된 모든 변수
  $param-names: 함수 파라미터
  $outer: 외부 스코프 변수 목록

Output:
  $caps: 캡처된 변수 배열 (외부 + 비파라미터)
```

**로직**:
```lisp
if (not param) && (in outer) && (not duplicate)
  → 캡처 목록에 추가
```

**개선**: 중복 제거 추가 (line 336)

### 2. C 코드 생성

**구조**:
```c
// Lambda definition (static function)
static FLValue __fl_anon_0(FLClosure* _self, int _argc, FLValue* argv) {
  // env[] 복원
  FLValue x = _self->env[0];
  FLValue y = _self->env[1];
  
  // 함수 본문
  return (x + y);
}

// Lambda instantiation
FLValue __env_0[2] = { var0, var1 };
fl_fn_new(__fl_anon_0, 2, __env_0);
```

**과정**:
1. cgc-fn-env-decls: env[] 복원 선언 생성
2. cgc-env-arr: env[] 배열 초기화값 생성
3. fl_fn_new: FLValue 함수 객체 생성

### 3. outer-params-atom 추적

**어디서 업데이트되는가**:
- Line 453: `(swap! outer-params-atom push $n)` — let/define 변수
- Line 462: `(swap! outer-params-atom push $n)` — loop 변수
- Line 478: `(reset! outer-params-atom $pnames)` — defn 함수 파라미터

**핵심**: defn 진입 시 파라미터로 reset, 본문 순회 중 외부 변수 수집

---

## 버그 수정 이력

### Bug 1: cgc-env-arr 로직 오류 ✅ 고정
**문제**:
```lisp
(if (= $i 0) (get $caps 0) (str $acc ", " (get $caps $i)))
```
- i=0일 때 첫 변수만 반환
- 이후 반복에서 $acc를 사용하지만 초기값 없음

**해결**:
```lisp
(if (= $i 0)
  (c-name (get $caps 0))  ;; 첫 변수: c-name 변환
  (str $acc ", " (c-name (get $caps $i))))  ;; 이후: 누적
```

### Bug 2: 중복 캡처 변수 ✅ 고정
**문제**: 같은 변수가 여러 번 나타나면 env[] 중복

**해결**:
```lisp
(not (includes-item $acc $v))  ;; 중복 제거 체크 추가
```

---

## 테스트 결과

### JS 백엔드 검증 ✅ 완료
```
✅ Pattern 1: Pure function (no capture) PASS
✅ Pattern 2: Single variable capture PASS
✅ Pattern 3: Multiple variable capture PASS
✅ Pattern 4: Nested closure PASS
✅ Pattern 5: Closure in filter context PASS
✅ Pattern 6: Recursive closure PASS
Result: 6/6 (100%) PASS
```

### C 백엔드 검증 ⏳ 진행 중
- 코드 분석: cgc-fn-caps-filter, cgc-fn-env-decls, cgc-env-arr 동작 확인
- 버그 수정: 2개 버그 (env-arr 로직, 중복 제거)
- 다음: C 코드 생성 검증

---

## 다음 단계

### 1. 검증 (30분)
- cgc-main.fl 재컴파일
- 클로저 사용 함수들 호출 테스트
- JS ↔ C 출력 동일성 확인

### 2. Phase B-3: HOF Support (다음)
- map/filter/reduce 구현
- keys-no-line 함수 검증
- Callback invocation

---

## 신뢰도 평가

| 항목 | 평가 | 근거 |
|------|------|------|
| 분석 완료도 | 10/10 | 전체 코드 경로 매핑 |
| 구현 정확도 | 9/10 | 2개 버그 수정, 6/6 JS 검증 |
| 테스트 커버 | 6/6 | 모든 closure 패턴 |
| **전체** | **9/10** | 구현 및 수정 완료, 검증 대기 |

---

**상태**: Phase B-2 분석 완료, 검증 진행 중  
**신뢰도**: 9/10  
**커밋**: 대기 중
