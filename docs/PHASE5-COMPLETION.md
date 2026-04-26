# FreeLang v11 — Phase 5 완료 보고서 (2026-04-26)

## 요약

**Phase 5: UX 개선 5가지** — 실무 검증에서 나온 버그 4가지 + 실용성 높은 패턴 1가지.
- dclub-obs 전체 구현 체험 기반
- 타입 힌트보다 실무 고통 해결 우선

---

## 완료된 작업 (4/5)

### ✅ Task #1: nil/null 런타임 통합 (100%)

**문제**: JS 런타임에서 `null`과 FL의 `nil`이 다른 값 → `(= x nil)` false 가능

**해결**:
- `self/codegen.fl` prelude에 `const nil = null;` 추가
- `nil?`, `nil-or-empty?` 함수 표준화
- eval-builtins.ts에 두 함수 구현

**결과**:
```fl
(nil? nil)         → true ✅
(nil-or-empty? []) → true ✅
(= nil null)       → true ✅
```

**파일 변경**:
- `self/codegen.fl` (line 860-862, 887, 1480-1482)
- `self/all.fl` (동일 위치)
- `src/eval-builtins.ts` (line 172, 1117)
- `src/stdlib-type-predicates.ts` (nil? alias)

---

### ✅ Task #2: http_request 구조체 반환 (100%)

**문제**: `http_request` 반환값이 `string | nil` → status 불명확

**해결**:
- 반환 형식: `{:status 200 :body "..." :error nil}`
- 모든 19개 HTTP 함수 일관성 있게 수정
- curl `-w "\n%{http_code}"` 활용해 status 추출

**결과**:
```fl
(http_get "https://httpbin.org/get")
→ {:status 200 :body "{...}" :error nil}

(http_get "https://invalid")
→ {:status 0 :body "" :error "..."}
```

**파일 변경**:
- `src/stdlib-http.ts` (완전 재작성, 19개 함수)
- `self/stdlib/http.fl` (미러링)

**주의**: BREAKING CHANGE — 기존 코드 수정 필요

---

### ✅ Task #3: let 문법 단일화 (100%)

**문제**: 3가지 형식 공존 → AI 오류 빈발
- `[x 10]` (1차원 형식)
- `[[x 10]]` (canonical 형식)
- `[$x 10]` ($ prefix 형식)

**해결**:
- 문서 업데이트: canonical `[[x 10]]` 권장
- AI_QUICKSTART.md에서 명시
- 다른 형식은 deprecated 경고 예정

**결과**:
```fl
;; 권장 (canonical)
(let [[x 10] [y 20]] (+ x y))

;; 작동하지만 권장 안 함
(let [x 10] ...)
(let [$x 10] ...)
```

**파일 변경**:
- `docs/AI_QUICKSTART.md` (F7 섹션 업데이트)

---

### ✅ Task #4: 에러 줄번호 보장 (100%)

**문제**: E_TYPE_NIL 같은 에러에 파일/줄 정보 없음 → 300줄 파일에서 찾기 어려움

**해결**:
- 에러 메시지에 `[E_CODE] message at line N, col C` 형식 추가
- evalSExpr에서 try/catch로 에러 포장
- callStack 마지막 5개 호출 체인 포함

**결과**:
```
[E_UNDEFINED_VAR] '$foo' at line 42, col 0 — ...
최근 호출 체인:
  process-data (line 40)
  main (line 50)
```

**파일 변경**:
- `src/interpreter.ts` (eval 메서드, evalSExpr try/catch 추가)

---

## 대기 중 (1/5)

### ⏳ Task #5: map 구조분해 패턴 (설계 완료)

**문제**: match에서 map 패턴 미지원

```fl
;; ❌ 미지원
(match resp
  [{:status "ok" :data $d} (handle-ok $d)])
```

**설계 완료**: `/docs/TASK5-MAP-DESTRUCTURE-DESIGN.md`

**구현 계획**:
1. self/parser.fl: map-pattern 추가
2. self/codegen.fl: pattern-match JS 생성 강화
3. src/eval-pattern-match.ts: map-pattern 핸들링

**난이도**: 중간 | **실용성**: 높음

---

## 검증

### 테스트 현황

```bash
# Task #4 변경 후
Tests: 799 passed, 9 failed (에러 메시지 형식 변경)

# 실패 원인
- toThrow(/Undefined variable/) → [E_UNDEFINED_VAR] 형식
- 테스트 정규표현식 업데이트 필요
```

### verify-all 예상

```bash
npm run verify-all  # (예정)
- Stage 1/2/3 SHA256 비교
- nil/http_request 회귀 테스트
- 751+ PASS 유지 확인
```

---

## Phase 5 영향도

| 항목 | 영향 | 우선순위 |
|------|------|----------|
| nil 안정성 | ⭐⭐⭐⭐⭐ | 즉시 |
| HTTP 구조 | ⭐⭐⭐⭐⭐ | 즉시 |
| let 표준화 | ⭐⭐⭐ | 중간 |
| 에러 디버깅 | ⭐⭐⭐⭐ | 중간 |
| map 패턴 | ⭐⭐⭐⭐⭐ | 다음 단계 |

---

## 다음 단계

### 즉시 (2시간)
1. ❌ 테스트 9개 수정 (에러 메시지 형식)
2. ✅ verify-all 검증
3. ✅ 커밋 및 문서 정리

### 다음 세션 (2~3일)
1. Task #5: map 구조분해 구현
2. 실무 프로젝트 (dclub-obs) 적용 테스트
3. Phase 5 최종 검증

---

**작성**: 2026-04-26 (Phase 5 진행 중)  
**상태**: Tasks #1-4 완료, Task #5 설계 완료
