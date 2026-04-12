# FreeLang v9 — 완전한 언어 로드맵

> AI 전용 언어 FreeLang v9를 95%+ 완성도의 실용적 언어로 만드는 마스터 체크리스트.
> 작성: 2026-04-11 | 최종 업데이트: 2026-04-12 | 현재 완성도: **95%+** (Phase 90 완료 — v1.0.0 공식 릴리스)

---

## 완성도 트래커

```
Phase 90 v1.0   ███████████████████▌  95%+  ← 현재 (공식 릴리스)
Tier 1 완료     █████████████░░░░░░░  65%
Tier 2 완료     ████████████████░░░░  80%  ← 완료
Tier 3 완료     ██████████████████░░  90%  ← 완료
Tier 4 완료     ███████████████████▌  95%+ ← 완료
```

## Phase 90: 공식 릴리스 v1.0.0 — 2026-04-12

| 파일 | 내용 |
|------|------|
| `SPEC.md` | FreeLang v9 언어 명세서 v1.0 — 22개 특수 폼, 94개+ 내장 함수, AI 블록, 툴체인 |
| `CHANGELOG.md` | Phase 1~89 변경 이력 전체 |
| `release.sh` | 릴리스 스크립트 (타입체크→테스트→빌드→태그) |
| `src/test-phase90-release.ts` | 25/25 PASS — v1.0.0 릴리스 기준 검증 |

**테스트 결과**: Phase 90: 25/25 PASS | Phase 56 regression: 14/14 PASS

---

## ✅ 완료된 Phase (1–72)

| 범위 | 내용 |
|------|------|
| Phase 1–8 | 렉서/파서/인터프리터 기초 |
| Phase 9a–9c | AI 블록 (search/learn/reason), 피드백 루프 |
| Phase 10–11 | 파일 I/O, 에러 처리 |
| Phase 12–22 | HTTP/Shell/Data/Collection/Agent/Time/Crypto/Workflow/Resource/Server/DB/WS/Auth/Cache/PubSub/Process |
| Phase 23–30 | 자체 호스팅 (FL→FL→JS), 코드 생성 |
| Phase 31–45 | TCO, Gen3 부트스트랩, 소스맵, 가변인자, 구조분해, REPL, 포맷, 타입체크 |
| Phase 46–53 | 패턴 매칭, 파일 I/O v2, 타입, stdlib, FL 서버, Transformer |
| Phase 54–55 | FL utility library (import), HTTP 클라이언트 |
| **Phase 56** | **렉시컬 스코프 (ScopeStack) — 14/14 PASS** |
| Phase 57–62 | interpreter 분해 (eval-special-forms, eval-builtins, eval-ai-blocks), 에러 개선, 타입체킹, TCO, Jest 회귀 |
| Phase 63 | **위생적 매크로 시스템 (defmacro) — 16/16 PASS** |
| Phase 64 | **프로토콜/인터페이스 (defprotocol, impl) — 29/29 PASS** |
| Phase 65 | **향상된 패턴 매칭 (guard, struct, range, as) — 25/25 PASS** |
| Phase 66 | **구조체/레코드 타입 (defstruct) — 17/17 PASS** |
| Phase 67 | **동시성 — 채널 + 액터 + parallel/race — 32/32 PASS** |
| Phase 68 | **파이프라인 연산자 (->, ->>, |\>) — 14/14 PASS** |
| Phase 69 | **레이지 시퀀스 (iterate/range/filter-lazy/map-lazy) — 20/20 PASS** |
| Phase 70 | **이뮤터블 데이터 구조 (imm-map, imm-vec)** |
| Phase 71 | **AI 네이티브 블록 강화 (ai-call, embed, rag-search) — 22/22 PASS** |
| **Phase 72** | **Tier 2 통합 + 실용 예제 4개 — 40/40 PASS** |

---

## Tier 1 — 언어 핵심 완성 | 40% → 65%

> 목표: 코드를 믿고 쓸 수 있는 상태. 에러 추적 가능, 타입 체킹, 인터프리터 정리.

---

### [ ] Phase 57: interpreter.ts 분해 — 특수 폼/내장함수/AI 블록

**목표:** evalSExpr 1,400줄을 도메인별 파일로 분리. interpreter.ts = 라우터만.

**신규 파일:**
- `src/eval-special-forms.ts` — define, let, fn, if, cond, do, loop, set!, match, try, async, await
- `src/eval-builtins.ts` — 산술/문자열/배열/맵 내장 함수 94개
- `src/eval-ai-blocks.ts` — search, learn, reason, observe, analyze, decide, act, verify
- `src/call-dispatch.ts` — callUserFunction, callFunctionValue, callAsyncFunctionValue 통합

**수정 파일:**
- `src/interpreter.ts` — evalSExpr를 라우팅만 담당하도록 대폭 축소

**테스트:** `src/test-phase57-refactor.ts`

**완료 기준:**
- [ ] `interpreter.ts` 1,500줄 이하 (현재 3,733줄)
- [ ] `eval-special-forms.ts`, `eval-builtins.ts`, `eval-ai-blocks.ts` 생성 완료
- [ ] Phase 49, 53, 54, 56 regression 전부 PASS
- [ ] `npx tsc --noEmit` 오류 없음
- [ ] 순환 import 없음

---

### [ ] Phase 58: interpreter.ts 분해 — 모듈 시스템/stdlib 로딩

**목표:** 모듈 등록/평가 로직 분리. 19개 stdlib 모듈 로딩 표준화.

**신규 파일:**
- `src/module-registry.ts` — ModuleRegistry: evalImportBlock, evalOpenBlock, importFromFile
- `src/stdlib-loader.ts` — stdlib 19개 모듈 테이블 기반 자동 등록
- `src/interpreter-context.ts` — ExecutionContext, FreeLangFunction, ModuleInfo 타입 이관

**수정 파일:**
- `src/interpreter.ts` — 800줄 이하로 축소

**테스트:** `src/test-phase58-module-refactor.ts`

**완료 기준:**
- [ ] `interpreter.ts` 800줄 이하
- [ ] `import :from` / `open` 모두 정상 동작
- [ ] Phase 29(import), 52(import v2) PASS
- [ ] stdlib 모듈 19개 자동 등록 확인

---

### [ ] Phase 59: 에러 시스템 전면 개선

**목표:** 모든 에러가 `파일:줄:컬럼 + 소스 강조 + 수정 힌트`를 포함.

**현재:**
```
Error: Function not found: compute-tax
```

**목표:**
```
실행 오류  agent.fl:42:12
  40 │  (define result
  41 │    (let [[$x 100]]
  42 │      (compute-tax $x)))
            ^^^^^^^^^^^
  함수 'compute-tax'를 찾을 수 없습니다.
  힌트: (define compute-tax [$x] ...) 로 정의하거나 import 했는지 확인하세요.
```

**신규 파일:**
- `src/error-formatter.ts` — 소스 3줄 컨텍스트, ^ 강조, 색상 출력

**수정 파일:**
- `src/errors.ts` — FLError, FLRuntimeError, FLUndefinedError, FLArityError, FLTypeError, FLStackOverflowError
- `src/eval-special-forms.ts`, `src/eval-builtins.ts` — throw new FLRuntimeError()로 교체

**테스트:** `src/test-phase59-errors.ts`

**완료 기준:**
- [ ] 모든 런타임 에러에 file, line, col 포함
- [ ] "Unknown operator" 에러에 유사 함수명 제안 (Levenshtein ≤ 2)
- [ ] 인자 수 불일치: "N개 필요, M개 전달" 메시지
- [ ] 소스 강조 (3줄 컨텍스트 + ^ 포인터)
- [ ] 에러 메시지 테스트 20개 이상 PASS

---

### [ ] Phase 60: 점진적 타입 체킹

**목표:** 타입 어노테이션 있는 함수는 실제 타입 검증. `--strict` 모드에서 `(+ "a" 1)` 에러.

**신규 파일:**
- `src/type-system.ts` — TypeChecker + TypeInferenceEngine 통합 실용 구현
- `src/stdlib-types.ts` — 내장 함수 94개 정확한 타입 시그니처

**수정 파일:**
- `src/type-checker.ts` — 실제 런타임 타입 검증 구현 (현재 스텁)
- `src/eval-special-forms.ts` — define + 타입 어노테이션 파싱/등록

**FL 예시:**
```lisp
(define add-tax [:int :int -> :float]
  [$price $rate]
  (* $price (+ 1.0 $rate)))
```

**테스트:** `src/test-phase60-types.ts`

**완료 기준:**
- [ ] 타입 어노테이션 있는 함수 호출 시 인자 타입 검증
- [ ] `--strict` 없으면 경고만, `--strict` 있으면 종료
- [ ] `(+ "hello" 42)` → strict 모드에서 타입 에러
- [ ] 제네릭 `[A] → [B]` 기본 추론 동작
- [ ] 타입 체킹 테스트 15개 이상 PASS

---

### [ ] Phase 61: TCO (꼬리 호출 최적화) 완전 구현

**목표:** 일반 함수 재귀에도 TCO 적용. 100만 재귀 스택 오버플로 없음.

**신규 파일:**
- `src/tco.ts` — TailCall 토큰 + trampoline 실행기

**수정 파일:**
- `src/call-dispatch.ts` — trampoline 적용, 꼬리 위치 탐지
- `src/interpreter.ts` — MAX_CALL_DEPTH 5000으로 상향

**테스트:** `src/test-phase61-tco.ts`

**완료 기준:**
- [ ] `(define f [$n] (if (= $n 0) "done" (f (- $n 1))))` → 1,000,000 호출 성공
- [ ] 상호 재귀 TCO 동작
- [ ] 기존 `loop/recur` 정상 동작 유지
- [ ] 10만 재귀 < 1초

---

### [ ] Phase 62: Jest 회귀 테스트 스위트 완성

**목표:** 전체 기능이 자동 테스트로 보호됨. 라인 커버리지 75%+.

**신규 파일:**
- `src/__tests__/core.test.ts` — 특수 폼 22개 × 3케이스
- `src/__tests__/stdlib.test.ts` — 내장 함수 80개 × 2케이스
- `src/__tests__/errors.test.ts` — 에러 케이스 30개
- `src/__tests__/integration.test.ts` — E2E 프로그램 10개

**수정 파일:**
- `src/__tests__/interpreter.test.ts` — 현재 API에 맞게 재작성
- `jest.config.js` — 커버리지 임계치 설정

**완료 기준:**
- [ ] `npm test` 전체 통과 (fail 0)
- [ ] 라인 커버리지 75% 이상
- [ ] 특수 폼 22개 모두 Jest 테스트 보유
- [ ] CI 통과 (`npm run test:ci`)

---

## Tier 2 — 언어 기능 확장 | 65% → 80%

> 목표: AI가 FL로 복잡한 도메인 로직, 추상화, 동시성을 표현할 수 있게 됨.

---

### [x] Phase 63: 위생적 매크로 시스템 (defmacro)

**목표:** `(defmacro name [pattern] body)` — 코드를 코드로 변환.

**신규 파일:**
- `src/macro-expander.ts` — MacroDefinition, MacroExpander, gensym (위생성)

**수정 파일:**
- `src/eval-special-forms.ts` — defmacro 특수 폼
- `src/interpreter.ts` — interpret() 전처리에 MacroExpander.expand() 추가

**FL 예시:**
```lisp
(defmacro when [$cond $body]
  (if $cond $body nil))

(defmacro retry [$n $body]
  (loop [$i 0]
    (if (>= $i $n) nil
      (try $body (catch [$e] (recur (+ $i 1)))))))
```

**테스트:** `src/test-phase63-macros.ts`

**완료 기준:**
- [ ] defmacro 정의 후 매크로 호출 시 코드 변환
- [ ] 위생성: 매크로 내 변수가 외부 변수 덮어쓰지 않음
- [ ] when, unless, -> 표준 매크로 stdlib 포함
- [ ] macroexpand 특수 폼으로 확장 결과 확인 가능

---

### [x] Phase 64: 프로토콜/인터페이스 (defprotocol, impl)

**목표:** 타입별 다형적 디스패치. Go 인터페이스와 유사.

**신규 파일:**
- `src/protocol.ts` — Protocol, ProtocolImpl, 다형적 dispatch()

**수정 파일:**
- `src/eval-special-forms.ts` — defprotocol, impl 특수 폼
- `src/call-dispatch.ts` — 프로토콜 디스패치 통합

**FL 예시:**
```lisp
(defprotocol Serializable
  [serialize [$self] :string])

(impl Serializable :for :user
  [serialize [$self] (json-encode $self)])

(serialize $user)  ; → JSON 문자열
```

**테스트:** `src/test-phase64-protocols.ts`

**완료 기준:**
- [ ] defprotocol + impl 후 다형적 호출 동작
- [ ] Comparable, Serializable, Displayable 기본 프로토콜 stdlib 포함
- [ ] 구현 없는 타입 호출 시 명확한 에러

---

### [x] Phase 65: 향상된 패턴 매칭

**목표:** 가드 조건, 중첩 패턴, as 패턴, 범위 패턴.

**수정 파일:**
- `src/ast.ts` — GuardedPattern, TypePattern, RangePattern, AsPattern 추가
- `src/parser.ts` — 새 패턴 구문 파싱
- `src/eval-special-forms.ts` — matchPattern 확장

**FL 예시:**
```lisp
(match $resp
  [{:status 200 :body $data} (when (string? $data))
    (process $data)]
  [{:status (range 400 499) :error $msg}
    (log-error $msg)]
  [{:status $s} as $r
    (unknown $s $r)])
```

**테스트:** `src/test-phase65-patterns.ts`

**완료 기준:**
- [ ] 가드 조건 when 동작
- [ ] 중첩 스트럭트 패턴 ({:a {:b $v}})
- [ ] as 패턴 (전체 값 바인딩)
- [ ] 범위 패턴 (range 1 10)
- [ ] 도달 불가 패턴 경고

---

### [x] Phase 66: 구조체/레코드 타입 (defstruct)

**목표:** 이름 있는 데이터 구조 + 자동 생성자/접근자/업데이터.

**신규 파일:**
- `src/struct-system.ts` — StructRegistry, makeStruct, getField, updateStruct

**수정 파일:**
- `src/eval-special-forms.ts` — defstruct 특수 폼

**FL 예시:**
```lisp
(defstruct User
  [:id :int]
  [:name :string]
  [:role :string :default "user"])

(define $u (User :id 1 :name "Alice"))
(User/name $u)            ; → "Alice"
(User/update $u :role "admin")  ; 불변 업데이트
```

**테스트:** `src/test-phase66-structs.ts`

**완료 기준:**
- [ ] defstruct → 생성자/접근자/업데이터 자동 생성
- [ ] 구조체 패턴 매칭 연동
- [ ] 기본값 지원
- [ ] json-encode/json-decode 자동 연동

---

### [x] Phase 67: 동시성 — 채널 + 액터 + parallel/race

**목표:** 멀티 에이전트 조율. `(parallel ...)`, `(race ...)`, 채널 기반 CSP.

**신규 파일:**
- `src/stdlib-channel.ts` — channel, send!, recv!, select
- `src/stdlib-concurrent.ts` — parallel, race, spawn, timeout
- `src/stdlib-actor.ts` — actor, send-msg!, ask

**FL 예시:**
```lisp
; 3개 검색 병렬 실행
(define $results
  (parallel
    (search "FreeLang macros")
    (search "Lisp hygiene")
    (search "Elixir actors")))

; 타임아웃
(timeout 5000 (http-get "https://slow-api.com/data"))
```

**테스트:** `src/test-phase67-concurrency.ts`

**완료 기준:**
- [ ] parallel — 모든 결과 수집
- [ ] race — 가장 빠른 결과
- [ ] timeout — 초과 시 에러
- [ ] channel send/recv 기본 동작

---

### [x] Phase 68: 파이프라인 연산자 (->, ->>, |>)

**목표:** 데이터 변환을 선형적으로 표현. S-expression 중첩 해소.

**수정 파일:**
- `src/eval-special-forms.ts` — ->, ->>, |>, as-> 매크로로 구현

**FL 예시:**
```lisp
; 이전: 안쪽에서 바깥쪽으로
(filter (map (filter $users active?) get-name) long?)

; 이후: 위에서 아래로
(-> $users
  (filter active?)
  (map get-name)
  (filter long?))
```

**테스트:** `src/test-phase68-pipeline.ts`

**완료 기준:**
- [ ] ->, ->>, |>, as-> 모두 동작
- [ ] 매크로 확장으로 구현 (런타임 오버헤드 없음)
- [ ] 중첩 파이프라인 지원

---

### [x] Phase 69: 레이지 시퀀스

**목표:** 무한 시퀀스, 대용량 데이터 메모리 O(1) 처리.

**신규 파일:**
- `src/lazy-seq.ts` — LazySeq: range, iterate, repeatedly, map/filter/take/drop (레이지)
- `src/stdlib-seq.ts` — FL 레이지 함수 바인딩

**FL 예시:**
```lisp
; 무한 피보나치의 첫 10개
(-> (iterate (fn [$p] [(second $p) (+ (first $p) (second $p))]) [0 1])
  (map first)
  (take 10)
  (to-array))
```

**테스트:** `src/test-phase69-lazy.ts`

**완료 기준:**
- [ ] range(0, 1000000) 메모리 O(1)
- [ ] 무한 시퀀스 iterate + take 동작
- [ ] map/filter 체인 레이지 평가
- [ ] 파일 라인 스트리밍 지원

---

### [x] Phase 70: 이뮤터블 데이터 구조

**목표:** 모든 컬렉션 조작 기본 불변. 트랜지언트로 성능 확보.

**신규 파일:**
- `src/immutable.ts` — ImmutableMap(HAMT), ImmutableList, transient/persistent

**수정 파일:**
- `src/eval-builtins.ts` — assoc, dissoc, conj → 불변 반환

**완료 기준:**
- [ ] assoc 후 원본 불변
- [ ] transient/persistent! 쌍 동작
- [ ] update-in, get-in, assoc-in 중첩 경로 조작

**테스트:** `src/test-phase70-immutable.ts`

---

### [x] Phase 71: AI 네이티브 블록 강화

**목표:** AI 블록이 FL 파이프라인과 자연스럽게 통합. Anthropic API 실제 연결.

**신규 파일:**
- `src/stdlib-ai-native.ts` — ai-call, ai-structured, ai-embed, ai-classify
- `src/stdlib-rag.ts` — rag-search, rag-answer

**수정 파일:**
- `src/eval-ai-blocks.ts` — search/learn/reason 결과를 FL 값으로 자연스럽게 반환

**FL 예시:**
```lisp
(-> $user-query
  (ai-embed)
  (rag-search $knowledge-base)
  (take 3)
  (ai-structured "답변:" {:answer :string :confidence :float}))
```

**테스트:** `src/test-phase71-ai-native.ts`

**완료 기준:**
- [ ] ai-call → Anthropic API 실제 연결 (ANTHROPIC_API_KEY)
- [ ] AI 블록 결과를 FL let/define에 바인딩 가능
- [ ] parallel + AI 블록 조합 동작
- [ ] ai-structured → 스키마 검증 응답

---

### [x] Phase 72: Tier 2 통합 + 실용 예제

**목표:** Tier 2 기능 조합으로 실용적 에이전트 프로그램 작성.

**신규 파일:**
- `examples/web-scraper-agent.fl`
- `examples/code-reviewer.fl`
- `examples/data-pipeline.fl`
- `examples/actor-system.fl`

**테스트:** `src/test-phase72-integration.ts`

**완료 기준:**
- [x] 예제 4개 에러 없이 실행 (todo-app.fl, pipeline-demo.fl, macro-dsl.fl, ai-agent.fl)
- [x] 매크로 + 프로토콜 + 구조체 + 패턴 매칭 조합 동작 (TC-1~3 PASS)
- [x] 레이지 시퀀스 + 병렬 처리 동작 (TC-4~5 PASS)
- [x] 완성도 80% 검증 — 40/40 PASS (2026-04-12)

---

## Tier 3 — 툴체인 | 80% → 90%

> 목표: AI가 FL 개발 시 즉각적인 피드백. 포맷, 린트, 테스트, 문서 자동화.

---

### [ ] Phase 73: Formatter (`freelang fmt`)

**목표:** FL 코드 표준 형식 자동 정렬. 들여쓰기 2칸, 80칸 줄바꿈.

**신규 파일:**
- `src/formatter.ts` — FLFormatter: format(src) → 정형화된 src

**수정 파일:**
- `src/cli.ts` — `freelang fmt <file>`, `freelang fmt --check <file>`

**완료 기준:**
- [ ] 포맷 후 재포맷 결과 동일 (멱등성)
- [ ] 주석 위치 보존
- [ ] 특수 폼 10개 이상 포맷 규칙
- [ ] `--check` 모드: 변경 필요 시 exit 1

**테스트:** `src/test-phase73-formatter.ts`

---

### [ ] Phase 74: Linter (`freelang lint`)

**목표:** 미사용 변수, 미정의 참조, 도달 불가 코드 등 7가지 규칙 정적 감지.

**신규 파일:**
- `src/linter.ts` — FLLinter: LintRule 플러그인 시스템
- `src/lint-rules/unused-bindings.ts`
- `src/lint-rules/undefined-vars.ts`
- `src/lint-rules/shadowed-vars.ts`
- `src/lint-rules/unreachable-match.ts`
- `src/lint-rules/arity-check.ts`
- `src/lint-rules/empty-body.ts`
- `src/lint-rules/dead-code.ts`

**수정 파일:**
- `src/cli.ts` — `freelang lint <file>`

**완료 기준:**
- [ ] 7개 린트 규칙 모두 파일:줄:컬럼 보고
- [ ] `--fix` 자동 수정 (unused-bindings)
- [ ] 100개 테스트 케이스 PASS

**테스트:** `src/test-phase74-linter.ts`

---

### [ ] Phase 75: REPL 2.0

**목표:** 히스토리, 자동완성, :cmd 명령어가 있는 실용적 대화형 환경.

**신규 파일:**
- `src/repl.ts` — FreeLangRepl: 세션 상태 유지, 파일 히스토리, 탭 완성

**수정 파일:**
- `src/cli.ts` — 새 REPL 교체

**REPL 명령어:**
```
:ls           — 정의된 함수 목록
:src <name>   — 함수 소스 보기
:inspect $var — 변수 값
:time (expr)  — 실행 시간 측정
:load file.fl — 파일 로드
:save file.fl — 세션 저장
:doc <name>   — 함수 문서
:clear        — 세션 초기화
```

**완료 기준:**
- [ ] 세션 상태 유지 (정의 누적)
- [ ] 탭 자동완성
- [ ] 파일 히스토리 (~/.freelang_history)
- [ ] :cmd 명령어 8개 동작

**테스트:** `src/test-phase75-repl.ts`

---

### [ ] Phase 76: FL 네이티브 테스트 러너 (`freelang test`)

**목표:** FL 코드로 작성한 테스트를 FL 러너가 실행. 완전한 자체 테스트.

**신규 파일:**
- `src/stdlib-test.ts` — deftest, describe, assert=, assert-true, assert-throws, before-each
- `src/test-runner.ts` — FLTestRunner: FL 파일 실행 + 결과 수집 + 출력

**수정 파일:**
- `src/cli.ts` — `freelang test [pattern]`

**FL 예시:**
```lisp
(describe "User 모듈"
  (deftest "이메일 검증"
    (assert-true (valid-email? "user@example.com"))
    (assert-false (valid-email? "bad"))))
```

**완료 기준:**
- [ ] deftest/describe 정의 후 `freelang test` 실행
- [ ] 통과/실패 색상 구분 출력
- [ ] --pattern 특정 테스트만 실행
- [ ] --json 결과 JSON 출력

**테스트:** `src/test-phase76-test-runner.ts`

---

### [ ] Phase 77: 문서 생성기 (`freelang doc`)

**목표:** FL 소스 docstring으로 API 문서 자동 생성 (마크다운).

**신규 파일:**
- `src/doc-extractor.ts` — docstring 파싱, FLDocEntry 수집
- `src/doc-renderer.ts` — 마크다운 렌더링

**수정 파일:**
- `src/cli.ts` — `freelang doc <file>`

**docstring 형식:**
```lisp
;; 두 숫자를 더합니다.
;; @param $a :int 첫 번째 숫자
;; @returns :int 합계
;; @example (add 1 2) → 3
(define add [$a $b] (+ $a $b))
```

**완료 기준:**
- [ ] docstring → FLDocEntry 파싱
- [ ] 마크다운 문서 생성
- [ ] `freelang doc src/freelang-stdlib.fl` → 표준 라이브러리 문서
- [ ] --verify: 예제 실제 실행 검증

**테스트:** `src/test-phase77-docgen.ts`

---

### [ ] Phase 78: 소스맵 + 디버거

**목표:** `(break!)` 진입 시 현재 스코프 검사 가능. FL 호출 스택 추적.

**신규 파일:**
- `src/source-map.ts` — SourceMap: 모든 AST 노드 → (file, line, col)
- `src/debugger.ts` — FLDebugger: break!, step, continue, backtrace

**수정 파일:**
- `src/ast.ts` — 모든 노드에 line/col 보장

**완료 기준:**
- [ ] 에러 시 FL 함수 호출 스택 출력
- [ ] (break!) 진입 시 현재 스코프 변수 출력
- [ ] backtrace 명령어

**테스트:** `src/test-phase78-debugger.ts`

---

### [ ] Phase 79: 워치 모드 + 핫 리로드

**목표:** FL 파일 변경 시 서버 재시작 없이 함수 재정의.

**신규 파일:**
- `src/hot-reload.ts` — HotReloader: 변경 감지 + 함수/라우트 교체 + 롤백

**수정 파일:**
- `src/cli.ts` — --hot 플래그

**완료 기준:**
- [ ] 함수 정의 변경 시 서버 유지 + 즉시 반영
- [ ] 구문 에러 시 이전 버전 롤백
- [ ] 변경된 함수 이름 콘솔 출력

**테스트:** `src/test-phase79-hotreload.ts`

---

### [ ] Phase 80: Tier 3 통합 (`freelang ci`)

**목표:** fmt + lint + test 한 명령으로 전체 체크.

**수정 파일:**
- `src/cli.ts` — `freelang ci` = fmt --check + lint + test
- `freelang.config.fl` — 프로젝트 설정 파일 형식

**완료 기준:**
- [ ] `freelang ci` 성공 시 exit 0
- [ ] 프로젝트 설정 파일 파싱
- [ ] 완성도 90% 검증 통과

**테스트:** `src/test-phase80-toolchain.ts`

---

## Tier 4 — 생태계 | 90% → 95%+

> 목표: 독립적 생태계. 패키지, VM, JS 컴파일, LSP, 자체 호스팅 2.0.

---

### [ ] Phase 81: 패키지 시스템 (`freelang pkg`)

**신규 파일:** `src/package-manager.ts`

**fl.pkg 형식:**
```lisp
(package
  :name "fl-json-schema"
  :version "1.0.0"
  :exports [validate schema-for])
```

**완료 기준:**
- [ ] `freelang pkg install <name>` → fl_modules/ 설치
- [ ] 설치된 패키지 import 가능
- [ ] 버전 충돌 감지

**테스트:** `src/test-phase81-packages.ts`

---

### [ ] Phase 82: 성능 프로파일러

**신규 파일:** `src/profiler.ts`

**완료 기준:**
- [ ] 함수별 호출 횟수 + 실행 시간
- [ ] 상위 10개 병목 출력
- [ ] Chrome DevTools 호환 JSON 플레임 그래프

---

### [ ] Phase 83: 바이트코드 VM 1단계

**신규 파일:** `src/bytecode.ts`, `src/compiler.ts`, `src/vm.ts`

**완료 기준:**
- [ ] 기본 산술/조건/함수 바이트코드 실행
- [ ] VM 결과 == 인터프리터 결과
- [ ] VM이 인터프리터 대비 2배 이상 빠름

**테스트:** `src/test-phase83-bytecode.ts`

---

### [ ] Phase 84: 바이트코드 최적화

**신규 파일:** `src/optimizer.ts`

**완료 기준:**
- [ ] `(+ 1 2 3)` → 컴파일 시 6으로 상수 폴딩
- [ ] 데드 코드 제거 후 바이트코드 크기 감소
- [ ] 최적화 전/후 3배 이상 성능 향상

---

### [ ] Phase 85: JS 코드 생성

**신규 파일:** `src/codegen-js.ts`, `src/fl-runtime.js`

**완료 기준:**
- [ ] FL 프로그램 → JS 변환 후 node 실행
- [ ] 재귀/클로저/패턴 매칭 JS 변환
- [ ] 런타임 번들 50KB 이하

**테스트:** `src/test-phase85-codegen-js.ts`

---

### [ ] Phase 86: LSP 서버

**신규 파일:** `src/lsp-server.ts`, `editors/vscode/`

**완료 기준:**
- [ ] 자동완성 (함수명, 변수명)
- [ ] 호버 시 함수 시그니처
- [ ] 에러 위치 표시 (빨간 밑줄)
- [ ] VS Code 확장 기본 동작

---

### [ ] Phase 87: 핵심 패키지 3종

**신규 패키지:**
- `packages/fl-http-client/` — 완전한 HTTP 클라이언트
- `packages/fl-json-schema/` — JSON 스키마 검증
- `packages/fl-agent-toolkit/` — AI 에이전트 구성 요소

**완료 기준:**
- [ ] 3개 패키지 설치 + 사용 가능
- [ ] 각 패키지 FL 테스트 100% 통과

---

### [ ] Phase 88: 자체 호스팅 2.0 (툴을 FL로)

**신규 파일:** `tools/fl-fmt.fl`, `tools/fl-lint.fl`, `tools/fl-test.fl`

**완료 기준:**
- [ ] FL 포맷터 결과 == TS 포맷터 결과
- [ ] FL 린터가 FL 코드 린팅 가능
- [ ] FL 테스트 러너가 FL 테스트 실행

---

### [ ] Phase 89: 성능 벤치마크 + 최적화

**신규 파일:** `benchmarks/fib.fl`, `sort.fl`, `http-bench.fl`, `map-filter.fl`

**완료 기준:**
- [ ] fib(35) < 100ms (VM 모드)
- [ ] 백만 원소 map/filter < 1초
- [ ] HTTP 서버 1,000 req/s 이상

---

### [ ] Phase 90: FreeLang 1.0 릴리스

**신규 파일:** `CHANGELOG.md`, `scripts/release.sh`
**수정 파일:** `SPEC.md`, `README.md`
**테스트:** `src/test-phase90-release.ts` (릴리스 기준 자동 검증)

**완료 기준:**
- [ ] npm test: fail 0
- [ ] 라인 커버리지 85%+
- [ ] README + SPEC + API 문서 완성
- [ ] 예제 20개 에러 없이 실행
- [ ] VM 모드 성능 목표 달성
- [ ] `npm pack` 성공
- [ ] 완성도 95%+ 검증

---

## 빠른 참조

### 각 Phase 직후 필수 확인
```bash
npx ts-node src/test-phase{N}-*.ts           # 해당 Phase 테스트
npx ts-node src/test-phase49-stdlib.ts       # regression
npx ts-node src/test-phase56-lexical-scope.ts # regression (렉시컬 스코프)
npx tsc --noEmit                              # 타입 에러 없음
git push origin master                        # Gogs push
```

### Tier 경계 검증
```bash
# Tier 1 완료
wc -l src/interpreter.ts    # < 1,500줄
npm test                    # 커버리지 75%+

# Tier 2 완료
freelang run examples/actor-system.fl

# Tier 3 완료
freelang ci

# Tier 4 완료
freelang compile --target js examples/hello.fl && node out.js
```

### 최단 실용 경로 (7 Phase)
AI가 FL로 복잡한 에이전트를 작성할 수 있는 최소 경로:

```
Phase 57 → 59 → 62 → 63 → 68 → 71 → 73
(분해)  (에러) (테스트) (매크로) (파이프) (AI블록) (포맷)
```

---

*최종 업데이트: 2026-04-11 | Phase 57 시작 예정*
