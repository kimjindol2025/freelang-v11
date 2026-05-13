# S10 탐사 결과 — codegen-c.fl 실제 상태

**일자**: 2026-05-14  
**대상**: `self/all.fl` (1386줄), `self/lexer.fl`  
**도구**: `self/run-cgc.fl` + `self/codegen-c.fl`

---

## 탐사 결과 요약

### 1. 컴파일 시도 결과

| 대상 | 결과 | 생성 C 줄수 | unsupported |
|------|------|-----------|------------|
| `all.fl` (1386줄) | ✅ 완료 | 1474줄 | 62개 |
| `lexer.fl` | ✅ 완료 | 178줄 | 3개 |

모두 에러 없이 C 파일 생성 성공. unsupported 패턴은 `fl_nil()` placeholder로 대체됨.

---

### 2. unsupported 패턴 분포

```
46  block:Map    — Map 리터럴 {key val}
16  block:Array  — 배열 리터럴 [...] (fn 파라미터, loop 바인딩)
```

**핵심**: loop/recur/fn/map/filter/reduce 자체는 일반 함수 호출로 잘 변환됨.  
문제는 이들의 **리터럴 인자** (`[params]`, `{:key val}`) 처리 불가.

---

### 3. gcc 컴파일 오류 (추가 발견)

`lexer_attempt.c` gcc 시도 결과 2개 추가 버그:

| 버그 | 원인 | 영향 |
|------|------|------|
| `is_digit?` — C 식별자 불가 | `c-name`이 `?`를 처리 안 함 | 모든 `?` 접미 함수 |
| `\t` 탭 문자 날것 삽입 | `c-esc`가 `\t`, `\r` 미처리 | 문자열 리터럴 파싱 관련 |

`c-esc` 현재:
```lisp
(str-replace (str-replace (str-replace $s "\\" "\\\\") "\"" "\\\"") "\n" "\\n")
```
→ `\t`, `\r` 미포함.

---

### 4. codegen-c.fl 실제 수준

**S2 수준 확정** (리서치 결론 검증):

| 기능 | codegen-c.fl 지원 여부 |
|------|----------------------|
| defn/define/let/if/cond/do | ✅ |
| 산술·비교·논리·println·str | ✅ |
| FUNC 블록 | ✅ |
| Map 리터럴 `{...}` | ❌ (block:Map) |
| Array 리터럴 `[...]` | ❌ (block:Array) |
| loop/recur 의미론 | ❌ (함수 호출로 변환만) |
| fn (closure) 의미론 | ❌ (함수 호출로 변환만) |
| `?` 접미 함수명 | ❌ (c-name 버그) |
| `\t`/`\r` 이스케이프 | ❌ (c-esc 버그) |

**runtime.c (S5~S9)와 codegen-c.fl (S2) 불일치**: runtime이 앞서 있음.

---

### 5. S11 우선순위 결정

탐사 결과 기반 수정 순서:

| 순위 | 수정 항목 | 효과 |
|------|---------|------|
| 1 | `c-name`에 `?` → `_p` 변환 추가 | gcc 에러 제거 |
| 2 | `c-esc`에 `\t`/`\r`/`\0` 추가 | 문자열 리터럴 정상화 |
| 3 | `cgc-block` Map 리터럴 → `fl_map_from_pairs(...)` | 46개 unsupported 해소 |
| 4 | `cgc-block` Array 리터럴 → `fl_vec_from(...)` | 16개 unsupported 해소 |
| 5 | loop/recur → C goto (의미론) | 제어흐름 정확성 |
| 6 | fn → 익명함수 (의미론) | closure 지원 |

**1+2를 S11-A로 묶고, 3+4를 S11-B로** 처리하는 것이 현실적.  
단일 관심사 원칙: S11은 "식별자/이스케이프 버그 수정" 한 가지만.

---

### 6. 결론

`all.fl` → C 변환은 **기계적으로 성공**. 의미론적 정확성은 아직 부족.  
가장 큰 차단 요소: Map/Array 리터럴 (총 62개 중 62개 = 100%).  
loop/recur/fn 자체는 이미 함수 호출로 변환 중 — 의미론 수정은 우선순위 낮음.

**S11 권장**: `c-name`(`?` 처리) + `c-esc`(`\t`/`\r`) 버그 2개 수정 → gcc 에러 제거.
