# Changelog

## [v11.4.3] — 2026-05-04 (Phase X 시작 — v12 로드맵)

### 🔍 본질 재분류

100개를 6개 본질 카테고리로 분류 (`docs/_classifications.json`):

```
🔧 design (언어 결함)    44  ← v12 Phase X
📚 normal (정상 동작)    25  ← LEARNING.md
💡 learning (학습 부족)  20  ← ALIAS 처리됨
🚧 missing (미구현)       5  ← Phase Y
📝 doc (문서 오류)        3  ← 정정 예정
💀 user (진짜 실수)       3  ← wrapper hint
```

→ **80%는 사용자 실수가 아니라 언어가 만든 문제**.

### 📦 추가
- `docs/_classifications.json` — 100개 단일 소스
- `docs/MISTAKES.md` — 진짜 실수 (28개)
- `docs/LEARNING.md` — Lisp 학습 (28개)
- `docs/LANGUAGE-FAULTS.md` — 언어 결함 (44개, v12 대상)
- `docs/PHASE-X-V12-ROADMAP.md` — 통일 규칙 5가지 + 3개월 계획
- `scripts/gen-mistakes-split.js` — JSON → 3개 문서 자동 생성
- `bin/freelang-migrate` — v11 → v12 마이그레이션 도구 prototype

### 🛠 freelang-migrate 도구

```bash
freelang-migrate src/                # dry-run
freelang-migrate src/ --apply        # 실제 변환 + 자동 백업
```

지원 변환:
- 60+ 함수명 (snake → kebab): str_to_num → str-to-num
- 술어 통일: is_null → nil?, is_array → array?
- 인자 순서: (map fn arr) → (map arr fn) — `map`, `filter` 만
- $ 접두사 제거 (옵션)

### 🎯 v12 통일 규칙

1. **인자 순서**: 데이터 → 함수 → 부가 (col-first)
2. **작명**: kebab-case 통일
3. **술어**: ? suffix
4. **HTTP**: 응답 분리 함수 (http-get-json, http-status, http-body)
5. **`$` 접두사**: 선택 (호환 유지)

### 🗓 일정
- v11.5.0 (1주): v12 alias 사전 등록
- v11.9.0 (8주): v12 RC + deprecated 경고
- **v12.0.0 (12주, 2026-09)**: 공식 출시
- v13.0.0 (~2027): v11 alias 제거

### ⚠️ Breaking Change 없음 (v11.4.3)
- v12는 별도 메이저 릴리스. v11.4.3은 분류/문서/도구만.
- v11 코드는 그대로 작동.

---

## [v11.4.2] — 2026-05-04 (Phase G+ ALIAS 확장 + 정직 카운트)

### 🔍 정직성 점검

v11.4.0 발표 시 "25개 처리"라고 표기했지만 실제 MISTAKES-100 매핑은 **14개**.
v11.4.2에서 ALIAS 확장 후 **33개**로 정정. (100선 항목 직접 매핑 기준)

### 📦 추가
- `src/_aliases.json` — wrapper와 stdlib-helpers가 공유하는 단일 소스
- `scripts/verify-mistakes-coverage.js` — 실제 커버리지 측정 도구
- `MISTAKES-COVERAGE.json` — 자동 생성 리포트

### ✨ ALIAS 22개 추가 (총 25 → 50+)

#32 env, get_env, env_get → shell_env
#36 json_keys, object_keys → keys
#37 now-ms, Date.now, current_time_ms → now_ms
#38 mariadb_all, db_query → mariadb_query
#39 obj_merge, merge → assoc
#40 obj_omit, omit → dissoc
#41 obj_pick → get
#42 count, size → length
#43 split, str_split → str-split
#44 JSON.parse, parse_json → json_parse
#45 JSON.stringify, stringify → json_stringify
#57 num_to_str → str
#77 str_length → str-length
#78 trim → str-trim
#79 starts-with?, ends-with? → str-starts-with/ends-with
#80 includes → str-contains
#81 to-upper, to-lower → str-upper/str-lower
#82 toString, to_string, to_str → str
#90 throw → error
+ parseInt → str_to_num, server_run/listen → server_start

### 📊 커버리지 (실측)

```
Cat 6 함수명 오류:    14/14 (100%)  ← ALIAS 완성
Cat 12 문자열:         6/7  (86%)
Cat 2 HTTP 응답:       4/5  (80%)
Cat 1 인자 순서:       4/10 (40%)
Cat 4 let:            1/5  (20%)
─────────────────────────────────
총합:                33/100 (33%)
```

### 🔧 수정
- `bin/freelang-smart` → `_aliases.json` 로드 (코드 분리)
- `src/stdlib-helpers.ts` → 동일 JSON 사용 (단일 소스)

### 📊 빌드
- bootstrap.js: 750.8KB → 762.5KB (+12KB, ALIAS 데이터 임베드)

---

## [v11.4.0] — 2026-05-04 (Phase G: AI 헬퍼)

### 🎯 Phase G — MISTAKES-100 자동 처리

언어가 자신의 실수를 방어한다. 100개 중 25개를 stdlib 헬퍼로 처리.

#### G-1: 에러 추천 (3개 함수)
- `(suggest-fn name)` — 유사 함수명 추천 (Levenshtein 거리)
- `(alias-of name)` — 알려진 별칭 → `{:correct :usage}`
- `(help-text name)` — 사람용 한글 도움말

```fl
(suggest-fn "console_log")  ; → ["println"]
(suggest-fn "fetcch")        ; → ["fetch"] (오타 자동 감지)
(alias-of "push")            ; → {:correct "append" :usage "(append arr item)"}
```

#### G-2: 인자 자동 감지 (4개 함수)
인자 순서를 자동으로 감지/수정. `(fn arr)`이든 `(arr fn)`이든 동작.

- `(smart-map a b)` — fn/arr 자동 감지
- `(smart-filter a b)` — 동일
- `(smart-get a b)` — col/key 자동 감지
- `(smart-assoc a b c)` — map first 자동

```fl
(smart-map [1 2 3] (fn [$x] (* $x 2)))   ; ✅ 작동 (자동 수정)
(smart-map (fn [$x] (* $x 2)) [1 2 3])   ; ✅ 작동 (정상)
```

#### G-3-A: HTTP 래퍼 (3개 함수)
HTTP 응답 구조체 자동 처리.

- `(http-get-json url)` — body 추출 + JSON 파싱 자동
- `(http-post-json url body)` — body JSON 자동 인코딩 + 응답 파싱
- `(http-status url)` — status 코드만 반환

#### G-3-B: try-call Result 패턴 (2개 함수)
기존 `ok?`/`err?`/`unwrap`/`unwrap-or`와 호환.

- `(try-call fn)` — `{:_tag "Ok" :value ...}` or `{:_tag "Err" :message ...}`
- `(try-call-1 fn arg)` — 인자 1개 호출

```fl
(define r (try-call (fn [] (/ 10 0))))
(if (err? r)
  (println "에러: " (unwrap-or r "기본값"))
  (println "값: " (unwrap r)))
```

### 📦 추가
- `src/stdlib-helpers.ts` — Phase G 헬퍼 모듈 (350+줄)
- `src/__tests__/stdlib-helpers.test.ts` — 20개 테스트 (20/20 PASS)

### 🔧 수정
- `src/__tests__/stdlib-perf.test.ts` — bootstrap.js 기반 실행으로 전환 (9/9 PASS)

### 📊 통계
- bootstrap.js: 738.8KB → 750.8KB (+12KB)
- 테스트: 832 → 852 (+20개, 100% PASS)

---

## [v11.3.7] — 2026-05-04

### ✅ 완성도
- **L2 증명**: 17/17 PASS (100%) — 자체 호스팅 완전 검증
- **테스트**: 821/823 PASS (99.8%) — build-determinism/mongodb skip
- **성능 최적화**: 순수 재귀 34,078ms → 반복 1ms (34,078배 개선)

### 🎯 주요 기능
- **AI 친화적 언어**: 59개 stdlib 함수 + 46개 문서화
- **자체 호스팅**: FreeLang으로 FreeLang 컴파일
- **독립적 런타임**: npm 의존성 0 (selectional devDeps)
- **MIT 라이선스**: 자유로운 사용/수정/배포

### 📦 성능 벤치마크
```
Test 1: 재귀 (factorial 25)
  → 결과: 15,511,210,043,330,985,984
  → 시간: ~5-10ms

Test 2: 배열 처리 (100K elements)
  → 결과: 49,999개 필터링
  → 시간: ~50-100ms

Test 3: 반복 (10K)
  → 결과: 50,005,000
  → 시간: ~1-5ms

성능 최적화 사례 (fib 30):
  └─ 순수 재귀: 34,078ms ❌
  └─ Memoization: 5ms (6,816배 개선) ✓
  └─ Iterative: 1ms (34,078배 개선) ✓✓
```

### 📚 학습 자료 완성
- AI_LEARNING_PATH.md (30분 학습 경로)
- AI_QUICKSTART.md (5분 시작)
- STDLIB_REFERENCE.md (59개 함수)
- 10개 패턴 + 50+ 예제

### 🔧 개선사항
- 의존성 정리: npm dependencies → devDependencies
- 문서 확대: 62개 .md 파일
- 배포 안정화: Gogs + GitHub 이중화

### ⚠️ 알려진 제한
- **build-determinism**: 환경 의존성으로 skip
- **MongoDB**: 외부 서버 필요로 skip
- **bootstrap.js**: 1.4MB (최적화 가능)

### 🚀 다음 단계 (Phase E+)
- SQL.js 도입 (sqlite 완전 독립화)
- 선택적 npm 모듈 (Stripe, AWS SDK)
- LSP/IDE 플러그인 지원
- 성능 극한화 (Rust/WASM)

---

## [v11.1.0-alpha] — 2026-04-29

### 초기 릴리스
- 기본 언어 기능 완성
- 자체 호스팅 달성
- 첫 공개 버전

