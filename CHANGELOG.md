# Changelog

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

