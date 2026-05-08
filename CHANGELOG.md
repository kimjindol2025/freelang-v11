# Changelog

## [v11.6.15] — 2026-05-08 (자기호출 무한재귀 7개 추가 수정)

### 버그 수정

**file-is-file?/file-is-dir? + process-exists?/getcwd/chdir/pid/pid-parent 무한재귀**

`_fl_*` native 미구현으로 wrapper가 자기 자신을 호출하던 버그 7개 수정.

| 함수 | 원인 |
|------|------|
| `file-is-file?` | `file_is_file` → `_fl_file_is_file` |
| `file-is-dir?` | `file_is_dir` → `_fl_file_is_dir` |
| `process-exists?` | `process_exists` → `_fl_process_exists` |
| `getcwd` | `process_getcwd` → `_fl_process_getcwd` |
| `chdir` | `process_chdir` → `_fl_process_chdir` |
| `pid` | `process_pid` → `_fl_process_pid` |
| `pid-parent` | `process_ppid` → `_fl_process_ppid` |

Commit: 00885598 | Tests: 903/903 | Fixed-Point: 5/5

---

## [v11.6.14] — 2026-05-08 (자기호출 무한재귀 13개 수정 + 스킵 테스트 활성화)

### 버그 수정

**file-mkdir/rmdir/list + process-* + env-* 무한재귀 13개**

```
file-mkdir / file-rmdir / file-list
process-run / process-run-args / process-exec / process-exec-args
process-spawn / process-kill / process-wait
env-get / env-set / env-all
```

**stage1.js file-delete 무한재귀 + do-run argv 누락**
- `file_delete` → `_fl_file_delete` native 호출로 수정
- `do-run` extra argv 전달 누락 수정

**테스트 스킵 해제**
- `semantic-preservation`: `compileWithStage1` 실제 구현 + `it.skip` → `it`
- 결과: Tests 903/903 (0 skip)

Commit: 9b9a9605, 635d7023

---

## [v11.6.13] — 2026-05-08 (L2 고정점 재달성 — stage1.js 레거시 중복 헬퍼 제거)

### 버그 수정

**stage1.js 결정론성 복구** — L2 fixed-point 5/5 ✅

`stage1.js` 180-183줄에 레거시 중복 헬퍼 4개가 잔존하여 매 컴파일마다 SHA256이 달라지는 문제 수정.

```
// 제거된 중복 코드 (현재 컴파일러는 lambda wrapping 버전만 생성)
function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }
```

수정 후 SHA256 고정점 체인 완전 수렴:
```
stage1~5: 939c3c374a428e15... (5/5 일치)
```

Commit: 71c4276b

---

## [v11.6.12] — 2026-05-08 (DX 개선 4종: 에러 추적·stdlib 탐색·safe-push·callFn 정리)

### 신규 기능

**stdlib 탐색 함수 3종**
```lisp
(stdlib-list)          ; => 전체 함수 목록 (정렬)
(fn-where "str-pad")   ; => "native:str-pad"
(fn-exists? "nil-or")  ; => true
```

**scripts/safe-push.sh** — bootstrap.js 충돌 없는 원자적 push
```bash
./scripts/safe-push.sh "commit message"
# 빌드 → SHA 검증 → push 순서로 진행
```

### 개선

**에러 메시지 [op] 접두사** — 런타임 오류에 연산자명 자동 표시
```
Before: r.entries is not iterable
After:  [log_info] r.entries is not iterable
```

**callFn typeof 분기 제거** — `eval-special-forms.ts`의 memoize/map-keys/vals 정리,
`callFn(fn, args)` 단일 경로로 통일

---

## [v11.6.11] — 2026-05-08 (deftest/is/run-tests, migrate, on-shutdown, import 별칭)

### 신규 기능

**내장 테스트 프레임워크** — special form으로 구현
```lisp
(deftest "덧셈" (is (= (+ 1 2) 3)))
(deftest "등호" (is= 10 (+ 5 5)))
(deftest "컬렉션" (is (= 3 (length [1 2 3]))))

(run-tests)
; Test Results: 3/3 passed
```
- `(deftest "name" body...)` — 테스트 등록 + 즉시 실행, ✓/✗ 출력
- `(is expr)` / `(is expr "msg")` — truthy assertion
- `(is= expected actual)` — equality assertion
- `(run-tests)` — 통계 출력 + Map 반환 `{:passed N :failed N :total N}`
- `(describe ...)` / `(it ...)` — `deftest` 동의어

**버전 관리 DB 마이그레이션**
```lisp
; MariaDB 사용
(migrate "mydb" [
  ["v1" "CREATE TABLE users (id BIGINT PRIMARY KEY, name VARCHAR(255))"]
  ["v2" "ALTER TABLE users ADD COLUMN email VARCHAR(255)"]
])
; → _migrations 테이블 자동 생성, 미적용 항목만 실행

; nil = in-memory 테스트 모드
(migrate nil [["v1" "..."] ["v2" "..."]])
```

### 별칭 추가
- **`on-shutdown`** → `on-sigterm` (SIGTERM + SIGINT 등록)
- **`import`** → `use` (파일 로드)

### 확인 (이미 구현됨)
- **그레이스풀 셧다운**: `on-sigterm`/`on-exit` — SIGTERM 수신 시 핸들러 실행 후 종료
- **핫 리로드**: `FL_DEV=1 node bootstrap.js run server.fl` — .fl 변경 감지 → 재시작
- **모듈 시스템**: `(use "utils.fl")` 작동, `(import "utils.fl")` 별칭 추가

---

## [v11.6.10] — 2026-05-08 (bcrypt-*/jwt-* 별칭 + REST API 패턴 확인)

### 별칭 추가 (기존 auth_* 함수의 친숙한 이름)
- **`bcrypt-hash`** → `auth-hash-password` (scrypt 기반, 산업 표준)
- **`bcrypt-verify`** → `auth-verify-password`
- **`jwt-sign`** → `auth-jwt-sign` (HS256)
- **`jwt-verify`** → `auth-jwt-verify`
- **`jwt-decode`** → `auth-jwt-decode`
- **`password-hash`** / **`password-verify`** 추가 별칭

### 확인 (이미 구현됨)
- **라우터 파라미터**: `(server-req-param req "id")` — `/users/:id`, `/posts/:postId/comments/:commentId` 정상 작동
- **CORS**: `(server-cors response)` — 응답에 CORS 헤더 추가, 전역 자동 적용
- **쿠키**: `(server-req-cookie req "name")` / `(server-set-cookie "name" "val" opts)` / `(server-html-cookie cookie html)`
- **파일 업로드**: multipart/form-data 자동 파싱 → `/tmp/fl-uploads/`에 저장

### 통합 테스트 (PASS)
```lisp
; /api/login → bcrypt-verify + jwt-sign
; /api/me → jwt-verify (Authorization: Bearer 헤더)
; /api/users/:id → server-req-param
```
모두 200ms 이내 정상 응답

---

## [v11.6.9] — 2026-05-08 (log-info/warn/error, memoize, validate, list-min/max)

### 언어 개선
- **`memoize`**: `(memoize fn)` — FL 함수 + 네이티브 함수 자동 결과 캐싱 (JSON 키 기반). special form으로 이동

### 신규 함수
- **`log-info`**: `(log-info "서버 시작" "포트" 3000)` → stderr `[INFO]  ...`
- **`log-warn`**: `(log-warn "캐시 만료 임박")` → stderr `[WARN]  ...`
- **`log-error`**: `(log-error "DB 연결 실패")` → stderr `[ERROR] ...`
  - 기존 Logger 패턴 `(log-info logger msg)` 과 공존 (첫 인자 Logger 객체 여부로 자동 분기)
- **`validate`**: `(validate body schema)` → `null`(성공) or `["field: msg" ...]`(오류 목록)
  - schema: Map 또는 plain object. 규칙: `:required :number :string :boolean :email :min-N :max-N`
- **`list-min`**: `(list-min [5 2 8 1 9])` → `1`
- **`list-max`**: `(list-max [5 2 8 1 9])` → `9`

### 확인 (이미 구현됨)
- `file-read/write/append/exists?/delete`: 모두 정상 작동
- `abs/ceil/floor/round`: 정상 작동

---

## [v11.6.8] — 2026-05-08 (str-pad, str-repeat, zip→Map, flatten, distinct, when/merge 확인)

### 신규 함수
- **`str-pad`**: `(str-pad s 10)` 우측 패딩, `(str-pad s 10 "-" :left)` 좌측 패딩
- **`str-repeat`**: `(str-repeat "=" 40)` → `"========================================"`
- **`flatten`**: `(flatten [[1 2] [3 4]])` → `[1 2 3 4]` (완전 재귀 해제)
- **`distinct`**: `(distinct [1 1 2 2 3])` → `[1 2 3]` (순서 유지, `unique` alias)

### 함수 변경
- **`zip`**: 기존 pairs 배열 → **Map 반환** `(zip ["name" "age"] ["Alice" 30])` → Map

### 확인 (이미 구현됨)
- `when`/`unless`: 정상 작동
- `merge`: `(merge $m1 $m2 $m3)` 다중 인자 지원
- `str-contains?`: 이미 구현됨

---

## [v11.6.7] — 2026-05-08 (group-by, format, date-*, partial, re-match 개선)

### 신규 함수
- **`group-by`**: `(group-by :status rows)` — keyword/문자열/FL함수 key-fn, Map<key, items[]> 반환
- **`format`**: `(format "%.2f" 3.14159)` → `"3.14"` — `%d/%f/%s/%x/%b/%e`, width/precision 지원
- **`date-format`**: `(date-format ts "yyyy-MM-dd HH:mm:ss")` — ts-ms → 포맷 문자열
- **`date-add`**: `(date-add ts :days 7)` — 달력 기반 날짜 연산 (days/hours/minutes/months/years/weeks/seconds + d/h/m/s/ms)
- **`date-diff`**: `(date-diff ts2 ts1 :days)` → number
- **`date-parse`**: `(date-parse "2026-05-08")` → ts-ms
- **`partial`**: `(partial f arg...)` — 부분 적용, FL함수+네이티브함수 통합 지원
- **`re-test`**: `(re-test pattern str)` → boolean (기존 re-match 역할)

### 함수 변경
- **`re-match`**: boolean → `string|null` 변경 — 첫 번째 매치 문자열 반환, 없으면 null

### 기존 `date_add` 확장
- `d/h/m/ms/s` 외 verbose 유닛 `:days/:hours/:minutes/:months/:years/:weeks/:seconds` 수용

---

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

