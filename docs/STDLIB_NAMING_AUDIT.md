# FreeLang v11 — stdlib 명명 일관성 Audit

**작성일**: 2026-04-25 (Phase B)  
**근거**: AI_COMPLETENESS_ANALYSIS.md "API 일관성 75점" 진단  
**목적**: 622개 stdlib 함수의 명명·인자 순서 일관성 점검 + Breaking change 0인 개선안 제시

---

## 1. 전체 통계

| 항목 | 수치 | 비고 |
|------|------|------|
| 총 등록 함수 | **622** | TS stdlib 50+ 모듈 |
| 언더스코어 사용 | 604 (97.1%) | `arr_flatten`, `str_replace` 패턴 |
| 하이픈 사용 | 0 | (codegen 출력은 `_` 변환 필요) |
| Predicate suffix `?` | ~18 | `null?`, `string?`, `number?`, `empty?` 등 |
| Mutator suffix `!` | 1 | `set!` |

### 모듈별 분포 (top 10)

```
46  str_*       (문자열)
30  server_*    (HTTP 서버)
29  res_*       (응답)
23  dom_*       (DOM)
20  arr_*       (배열)
16  agent_*     (에이전트)
15  ws_*        (WebSocket)
14  db_*        (DB)
14  auth_*      (인증)
13  table_*     (테이블)
```

---

## 2. 인자 순서 패턴

### Higher-order (fn-first) ~12개
```lisp
(memoize fn)        ;; 함수가 첫 인자
(retry fn n)        ;; "
(map_entries fn)    ;; "
(parallel_map fn xs);; "
```

### Data-first (97% 이상)
```lisp
(arr_flatten arr)
(arr_take arr n)
(str_replace str search replace)
(get coll key)
(json_get obj path)
```

### 권장 원칙

- **컬렉션 변환** (`map`, `filter`, `reduce`): fn-first 유지 (Lisp 관용 + Clojure 호환)
- **데이터 조작** (`get`, `arr_*`, `str_*`, `json_*`): data-first 유지 (현재 패턴 보존)
- **신규 함수**: 사용 빈도가 변환 중심이면 fn-first, 그 외는 data-first

---

## 3. 모순 5건 (현재 발견)

| # | 함수 | 모순 내용 | 영향 | 해결책 |
|---|------|----------|------|--------|
| 1 | `null?` vs `is-number?` | suffix `?` 통일 안 됨 | AI 추측 어려움 | `nil?` alias 추가 (Phase B 완료) |
| 2 | `map` (고차) vs `map_entries` (데이터) | 같은 prefix, 다른 의미 | 혼란 가능 | docs로 명시, rename 위험 |
| 3 | `get` vs `json_get` | prefix 불일치 (둘 다 같은 동작) | minor | `json_get` deprecated 후보 |
| 4 | `arr_includes` vs `includes?` | 명명 스타일 불일치 | minor | `includes?` 권장 (suffix 패턴) |
| 5 | `array?` vs `list?` | 같은 의미, 둘 다 존재 | 양호 (이미 alias 등록) | (Phase B에 alias 통합) |

---

## 4. Phase B에서 추가된 Alias (Breaking change 0)

| Alias | Canonical | 추가 위치 |
|-------|-----------|-----------|
| `nil?` | `null?` | `eval-builtins.ts` line 152, 973 |
| `array?` | `list?` | `eval-builtins.ts` line 991 |
| `bool?` | `boolean?` | `eval-builtins.ts` line 989 |
| `function?` | `fn?` | `eval-builtins.ts` line 992 (신규) |
| `fn?` | (canonical) | `eval-builtins.ts` line 992 (신규) |

## 4.5. Phase E (2026-04-25): 메인 dispatch alias 통합

기존: 작은 dispatch (line 140)에만 등록되어 메인 evalBuiltin (line 500+)에서 인식 안 됨.
수정: 메인 dispatch에 alias case fall-through 추가 → 어디서 호출해도 동작.

| Alias 그룹 | 구현 |
|------------|------|
| `keys` / `json_keys` | Object.keys() |
| `values` / `json_vals` | Object.values() |
| `upper-case` / `uppercase` / `upper` | toUpperCase() |
| `lower-case` / `lowercase` / `lower` | toLowerCase() |
| `trim` | string trim |
| `starts-with?` / `str-starts-with?` | startsWith() |
| `ends-with?` / `str-ends-with?` | endsWith() |
| `char-at` / `str-char-at` | string[i] |
| `math-pow` (alias of `pow`) | Math.pow() |
| `defun` (alias of `defn`) | special-form fall-through |

**또한**: `(= a b)` 가 list/map에 대해 **deep equality** 작동 (T77 palindrome 발견).

검증: `npm test` (4 신규 케이스 PASS)

---

## 5. Single Source of Truth — `src/stdlib-type-predicates.ts`

신설 모듈에서 모든 type predicate를 한 곳에 명시:
- `TYPE_PREDICATES` 배열 — 표준 정의 + alias + doc
- `ALL_PREDICATE_NAMES` — IDE 자동완성·linter 후보 풀
- `ALIAS_TO_CANONICAL` — alias → canonical 매핑

향후 `eval-builtins.ts`가 이 모듈을 import해서 등록 자동화 가능 (점진적 리팩토링).

---

## 6. 권장 작업 (Phase 5 이후)

### 우선순위 1: docs 통일 (1h)
- stdlib reference에 alias 명시
- `?` suffix 사용 권장 가이드라인

### 우선순위 2: deprecated 표시 (1h)
- `is-xxx?` 패턴이 발견되면 `xxx?` 사용 권장 deprecation warning
- `json_get` → `get` 통합 제안

### 우선순위 3: linter 통합 (3h)
- `src/linter.ts`가 `ALL_PREDICATE_NAMES`를 활용해 typo 검출 강화
- `ALIAS_TO_CANONICAL`로 자동 normalize 옵션

---

## 부록: 추출 명령어

```bash
# 모든 stdlib 함수 이름 추출
grep -E '^\s*"[a-z_!\?]+"\s*:' src/stdlib-*.ts | wc -l

# 모듈별 함수 분포
grep -hoE '"[a-z_]+_[a-z_!\?]+"' src/stdlib-*.ts | \
  sed 's/"//g' | awk -F_ '{print $1}' | sort | uniq -c | sort -rn

# 사용 빈도 top 10 (.fl 파일)
grep -hoE '\([a-z][a-z_\-!\?]+ ' self/**/*.fl | \
  sort | uniq -c | sort -rn | head -10
```

---

생성: 2026-04-25  
근거: `AI_COMPLETENESS_ANALYSIS.md` + Explore agent 탐색 결과
