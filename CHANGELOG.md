# Changelog

## [v11.6.6] — 2026-05-08 (if-let 평탄형, some?/not-nil?, 기본값 인자)

### 언어 개선
- **`if-let` 평탄형**: `(if-let [$x expr] then else)` — 기존 `[[x expr]]` 이중 괄호 불필요. 두 형식 모두 지원
- **함수 기본값 인자**: `(defn f [$a [$b 10]] ...)` — `(f 1)` 호출 시 `$b = 10`

### 신규 함수
- **`some?`**: `(some? x)` → `(not (nil? x))` 단축형 (기존 구현됨, 문서화)
- **`not-nil?`**: `some?` alias — `(not-nil? x)`

### 확인 (이미 구현됨)
- `->` 스레딩: `(-> $x f1 f2 f3)` 정상 작동
- `assoc`/`dissoc`: `(assoc m :k v)` / `(dissoc m :k)` 정상 작동

---

## [v11.6.5] — 2026-05-08 (return early exit, map-keys/vals 1-arg, http-parallel timeout)

### 언어 개선
- **`(return expr)`**: fn 본체 내 early exit. try/catch 블록을 통과해 함수 경계까지 전파됨 (`ReturnSignal` 패턴)
  - `callUserFunction` / `callFunctionValue` / `callUserFunctionTCO` 모두 처리
  - `evalTryBlock`에서 재throw — try가 가로채지 않음

### 함수 개선
- **`map-keys m`** / **`map-vals m`** 1인자 형식 추가: 키/값 배열 반환 (기존 2인자 변환 형식 유지)

### 성능
- **`http-parallel` 타임아웃**: 고정 30s → 개별 요청 최대 timeout + 2s 오버헤드 (기본 12s, 최대 60s)

---

## [v11.6.4] — 2026-05-08 (map-vals, map-keys, db-query-one)

### 신규 함수
- **`map-vals f m`**: 맵의 모든 값에 함수 적용 → 새 맵 반환 (FL fn 객체 지원)
- **`map-keys f m`**: 맵의 모든 키에 함수 적용 → 새 맵 반환
- **`db-query-one db sql [params]`**: CLI 연결 문자열 또는 pool ID 자동 감지 — 첫 번째 행 또는 `nil`

### 확인
- `str-join` 2인자 구분자: `(str-join $list ", ")` 이미 작동 중 (v11.5부터)

---

## [v11.6.3] — 2026-05-08 (P0 DX — http-get-data, server-html status, set-interval fn ref)

### 신규 함수
- **`http-get-data url [headers]`**: GET 후 파싱된 JSON 직접 반환 (이중구조 제거)
- **`http-post-data url body [headers]`**: POST 후 파싱된 JSON 직접 반환

### 언어 개선
- **`server-html` status 코드**: `(server-html "<html>" 404)` — 두 번째 인자로 상태코드 지정 (`stdlib-http-server.ts`)
- **`set-interval` 함수 참조**: 문자열 이름 외 FreeLang 함수 객체 직접 전달 지원 (`stdlib-timer.ts`)

### 문서화
- STDLIB_REFERENCE: `http-get-data`, `http-post-data`, `mariadb-one`, `mariadb-pool-one` 추가

---

## [v11.6.2] — 2026-05-08 (DX 개선 — cond :else + HTTP async + 모듈 캐시)

### 언어 개선
- **LIR-005**: `cond :else` / `[else ...]` 브래킷 + 플랫 모드 지원
  - `(cond [(= x 1) "one"] [:else "other"])` 정상 작동 ✅
  - `(cond (= x 1) "one" :else "other")` flat-pair 정상 작동 ✅
  - `eval-special-forms.ts` evalCond 수정

### 성능
- **모듈 캐시**: `MODULE_CACHE` 전역 캐시 — 동일 파일 재파싱 제거 (`eval-module-system.ts`)
- **HTTP async**: `curl spawnSync` → Node.js `fetch` + `Promise.all` 병렬 처리 (`stdlib-http.ts`)

### 버그 수정
- `catch` CODE_TO_CATEGORY — `code` 변수 미선언 ReferenceError 수정 (`eval-pattern-match.ts`)
- `env_get` nil 반환 — 미정의 환경변수 `""` → `null` (`stdlib-process.ts`)

### 기존 기능 확인 (이미 구현됨)
- `server_req_json`: POST body 자동 JSON 파싱 (`stdlib-http-server.ts:929`)
- `let` 평탄형: `(let [x 1 y 2] ...)` 지원 (v11.1부터)
- `"""` 멀티라인 문자열: `lexer.ts` 지원

---

## [v11.6.0] — 2026-05-08 (LIR 언어 개선 — 키 정규화 + env_get + alias)

### 언어 개선 (LIR)

- **LIR-002**: `assoc`/`dissoc`에 키워드 키 정규화 추가
  - `(assoc {} :name "Kim")` → `(get m "name")` 이제 `"Kim"` 반환 ✅
  - `eval-builtins.ts` assoc/dissoc 케이스 수정
- **LIR-004**: `http-get-bearer`, `http-post-bearer` kebab alias 자동 등록 확인
  - `stdlib-kebab-aliases.ts` 자동 변환으로 이미 처리됨
- **P1**: `env_get` nil 반환 수정
  - 미정의 환경변수: `""` → `null` 반환 (LIR 원래 의도대로)
  - `env_or` 헬퍼 추가: `(env-or "KEY" "default")` → 안전한 기본값 처리
  - `stdlib-process.ts` 수정

### 문서
- `docs/LANGUAGE-FAULTS.md` — LIR-002 항목 추가
- `docs/LANGUAGE_IMPROVEMENT_REQUESTS.md` — 해결 현황 반영

---

## [v11.5.0] — 2026-05-04 (진짜 언어 변경 — kebab alias 자동 등록)

### ⚠️ 정정: v11.4.3은 도구만이었다

v11.4.3에서 "Phase X 시작" "v11.5.1 통일" 등 거창하게 표기했으나
**실제로는 도구/문서만 추가, 언어 코어 변경 0**이었음.

`freelang-migrate`로 변환한 코드도 stdlib에 kebab alias가 없어서 *작동 안 했음*.

### ✅ v11.5.0: 진짜 언어 변경

`src/stdlib-kebab-aliases.ts` 추가. **400개 kebab-case alias 자동 등록.**

- `now_ms` → `now-ms` (둘 다 작동)
- `str_to_num` → `str-to-num` (둘 다 작동)
- `json_parse` → `json-parse` (둘 다 작동)
- `file_exists` → `file-exists` + `file-exists?` (술어 alias)
- `mariadb_query` → `mariadb-query`
- `auth_jwt_sign` → `auth-jwt-sign`
- `server_req_body` → `server-req-body`
- ... 400개 자동

### 🔧 변경 (실제 코드)
- `src/stdlib-kebab-aliases.ts` 신규 (110줄)
- `src/stdlib-loader.ts` 모든 stateless 모듈을 변수에 캡처 (alias 생성용)
- `bin/freelang-migrate` 명시적 경고 추가 (v11.5.0+ 런타임 필요)

### ✅ end-to-end 검증

```bash
# 1. v11 코드 작성 (snake_case)
echo '(json_parse "{\"a\":1}")' > app.fl

# 2. migrate로 변환 (kebab으로)
freelang-migrate app.fl --apply
# → (json-parse "{\"a\":1}")

# 3. 변환된 코드 실행 → ✅ 작동 (이전엔 실패)
node bootstrap.js run app.fl
```

### 📊 빌드
- bootstrap.js: 762.5KB → 763.5KB (+1KB)
- 등록 alias: 400개 자동
- 회귀: 29/29 통과

### ⚠️ 정직한 분류

| 통일 규칙 (제안) | v11.5.0 상태 |
|------|--------|
| 1. 인자 순서 | ❌ 제안만 |
| 2. **kebab-case** | ✅ **구현됨** |
| 3. 술어 `?` | △ 부분 (file-exists? 등) |
| 4. HTTP 응답 분리 | ❌ 제안만 |
| 5. `$` 선택 | ❌ 제안만 |

→ 5가지 중 1.5가지 진짜 구현. 나머지는 후속.

### 🗓 다음
- v11.5.1: 술어 ? alias 확장 (`is_X?`, `array?` 등)
- v11.5.2: HTTP 응답 분리 함수 stdlib 승격
- v11.5.3+: 인자 순서 alias (위험도 높아 마지막)

---

## [v11.4.3] — 2026-05-04 (도구 + 문서 보강 — 언어 변경 X)

### ⚠️ 자기 정정 (v11.5.0 시점)

v11.4.3은 *언어가 발전한 게 아니라 우리 도구가 발전한 것*.
- ALIAS 데이터 추가 (도구용)
- wrapper 스크립트 (외부)
- 문서 분리
- migrate 도구 prototype (변환만, 변환된 코드는 실행 안 됨)

bootstrap.js 코어 변경 0. stdlib 함수 추가 0.
"Phase X 시작"은 v11.5.0에서야 진실.

### 📦 추가 (도구/문서)

(이하 v11.4.3 내용 그대로)

## [v11.4.3] — 2026-05-04 (Phase X 시작 — v11.5.x 로드맵)

### 🔍 본질 재분류

100개를 6개 본질 카테고리로 분류 (`docs/_classifications.json`):

```
🔧 design (언어 결함)    44  ← v11.5.x Phase X
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
- `docs/LANGUAGE-FAULTS.md` — 언어 결함 (44개, v11.5.x 대상)
- `docs/PHASE-X-V11.5-ROADMAP.md` — 통일 규칙 5가지 + 3개월 계획
- `scripts/gen-mistakes-split.js` — JSON → 3개 문서 자동 생성
- `bin/freelang-migrate` — v11 → v11.5.x 마이그레이션 도구 prototype

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

### 🎯 v11.5.x 통일 규칙

1. **인자 순서**: 데이터 → 함수 → 부가 (col-first)
2. **작명**: kebab-case 통일
3. **술어**: ? suffix
4. **HTTP**: 응답 분리 함수 (http-get-json, http-status, http-body)
5. **`$` 접두사**: 선택 (호환 유지)

### 🗓 일정
- v11.4.3 (지금): 분리 + 도구 prototype + 분류 100개
- v11.5.0 (1주): v11.5.x alias 사전 등록 (snake + kebab 둘 다)
- v11.5.1-rc (8주): RC + deprecated 경고
- **v11.5.1 (12주, 2026-09)**: 공식 통일 출시
- v11.6.0 (~1년): v11 alias 제거 시작 (선택)
- v11.9.0 (~2027): v11 alias 완전 제거

### ⚠️ Breaking Change 없음
- v11 마이너 시리즈로 진행 (v12 메이저 점프 없음).
- v11.4.x 코드는 v11.5.1 이후 1년간 작동 (deprecated 경고만).

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

