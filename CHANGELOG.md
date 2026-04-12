# FreeLang v9 Changelog

모든 중요 변경사항이 이 파일에 기록됩니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/) 기반.

---

## [1.0.0] - 2026-04-12

**FreeLang v9 공식 릴리스** — AI 전용 언어의 탄생.
Phase 1~89 누적, 총 80+ TypeScript 파일, 19개 stdlib 모듈, 완전한 툴체인.

---

### Tier 4 — 생태계 (Phase 81–89)

#### Phase 89: 성능 벤치마크 프레임워크
- `src/test-phase89-bench.ts` — 인터프리터 vs VM 비교 측정
- 단순 산술: 953 ops/sec, factorial(10): 817 ops/sec, fibonacci(15): 45 ops/sec
- `PERFORMANCE.md` — 벤치마크 결과 문서화
- commit: `6e19b65`

#### Phase 88: 자체 호스팅 2.0 (Self-Hosting)
- FL로 작성한 Formatter, Linter, TestRunner 툴 구현
- `src/test-phase88-selfhost.ts` — FL→FL→JS 자체 호스팅 검증
- 22/22 PASS — 완전한 자체 호스팅 달성
- commit: `acf42d9`

#### Phase 87: 핵심 패키지 3종
- `packages/fl-http-client/` — HTTP 클라이언트 라이브러리
- `packages/fl-json-schema/` — JSON Schema 검증
- `packages/fl-math/` — 수학 함수 확장 라이브러리
- commit: `6466442`

#### Phase 86: LSP 서버 (Language Server Protocol)
- `src/lsp-server.ts` — `FLLanguageServer` 클래스
- 자동완성, 진단, 호버 문서, 포맷 기능 지원
- VS Code / 편집기 연동 가능
- commit: `f3a499f`

#### Phase 85: JS 코드 생성기 (JSCodegen)
- `src/codegen-js.ts` — `JSCodegen` 클래스
- FreeLang AST → JavaScript 코드 변환
- `src/test-phase85-codegen.ts` — 코드생성 테스트
- commit: `8af38a7`

#### Phase 84: 바이트코드 최적화기
- `src/optimizer.ts` — 상수 폴딩, 데드 코드 제거
- VM 실행 전 최적화 패스 적용
- commit: `93367eb`

#### Phase 83: 바이트코드 VM
- `src/vm.ts` — `VM`, `BytecodeCompiler` 클래스
- 레지스터 기반 바이트코드 실행 엔진
- `src/test-phase83-vm.ts` — VM 실행 테스트
- commit: `c82d988`

#### Phase 82: 성능 프로파일러
- `src/profiler.ts` — `Profiler`, `globalProfiler` 클래스
- CPU/메모리 프로파일링, `freelang profile` 명령어
- commit: `b8030ea`

#### Phase 81: 패키지 매니저
- `src/package-manager.ts` — `PackageRegistry` 클래스
- FL 인터프리터 레벨 패키지 등록/조회/의존성 관리
- `src/vpm-cli.ts` — CLI 인터페이스
- commit: `ec7e55a`

---

### Tier 3 — 툴체인 (Phase 73–80)

#### Phase 80: CI Pipeline Runner
- `src/ci-runner.ts` — `CIPipeline` 클래스
- 타입체크 + 린트 + 테스트 자동화 스텝
- `freelang ci` 명령어 지원
- commit: `a8a73bf`

#### Phase 79: 워치 모드 + 핫 리로드
- `src/hot-reload.ts` — 파일 변경 감시 + 자동 재실행
- `freelang watch` 명령어 지원
- commit: `60fb0b5`

#### Phase 78: 소스맵 + 디버거
- `src/debugger.ts` — `DebugSession`, `handleBreak()` 구현
- `break!` 내장 함수로 중단점 설정
- 스택 추적, 변수 조회 지원
- 31/31 PASS
- commit: `36a99d0`

#### Phase 77: 문서 생성기
- `src/doc-extractor.ts` — `extractDocs()` 함수
- `src/doc-renderer.ts` — HTML/Markdown 렌더링
- `freelang doc` 명령어로 자동 문서화
- commit: `d82f479`

#### Phase 76: FL 네이티브 테스트 러너
- `src/test-runner.ts` — `FLTestRunner` 클래스
- FL 코드 내부에서 `(test "이름" expr expected)` 문법
- commit: `5937f03`

#### Phase 75: REPL 2.0
- `src/repl.ts` — `FreeLangReplCore`, `FreeLangRepl` 클래스
- 히스토리, `:cmd` 명령어, 기본 자동완성
- commit: `5937f03`

#### Phase 74: Linter
- `src/linter.ts` — `FLLinter`, `createDefaultLinter()` 함수
- 7가지 정적 분석 규칙 플러그인 기반
- `freelang lint` 명령어 지원
- commit: `ecd8e24`

#### Phase 73: Formatter
- `src/formatter.ts` — `FLFormatter`, `formatFL()` 함수
- AST 기반 자동 포매터, 들여쓰기 2칸, 80칸 줄바꿈
- 멱등성 보장 — 여러 번 실행해도 동일한 결과
- `freelang fmt` 명령어 지원
- commit: `17278c9`

---

### Tier 2 — 언어 기능 (Phase 63–72)

#### Phase 72: Tier 2 통합 + 실용 예제
- 4개 실용 예제: 웹 크롤러, 데이터 파이프라인, AI 에이전트, HTTP 서버
- 40/40 PASS
- `FREELANG_COMPLETE.md` 업데이트: 완성도 80%
- commit: `7b891ea`

#### Phase 71: AI 네이티브 블록 강화
- `ai-call` — 외부 LLM API 호출 블록
- `embed` — 텍스트 임베딩 생성
- `rag-search` — RAG(검색 증강 생성) 검색
- `similarity` — 벡터 유사도 계산
- 22/22 PASS
- commit: `c4f7d4a`

#### Phase 70: 이뮤터블 데이터 구조
- `src/immutable.ts` — 영속 이뮤터블 자료구조
- `imm-map`, `imm-vec`, `imm-assoc`, `imm-conj` 함수
- 구조적 공유(structural sharing)로 메모리 효율 최적화
- commit: `e64f48b`

#### Phase 69: 레이지 시퀀스
- `src/lazy-seq.ts` — 레이지 시퀀스 구현
- `iterate`, `range`, `filter-lazy`, `map-lazy` 함수
- `take` — 무한 시퀀스에서 n개 취득
- 20/20 PASS
- commit: `d845145`

#### Phase 68: 파이프라인 연산자
- `->` — 스레딩 (앞 삽입), `->>` — 스레딩 (뒤 삽입), `|>` — Elixir 스타일
- 함수 합성을 선형 읽기 순서로 표현
- 14/14 PASS
- commit: `86b090d`

#### Phase 67: 동시성 — 채널 + 액터 + parallel/race
- 채널(Channel) 기반 메시지 패싱
- 액터(Actor) 패턴 — 상태 + 메시지 핸들러
- `parallel` — 모든 태스크 동시 실행 후 대기
- `race` — 가장 먼저 완료되는 결과 사용
- 32/32 PASS
- commit: `ec330a3`

#### Phase 66: 구조체/레코드 타입
- `defstruct` — 구조체 정의 + 자동 생성자/접근자
- `src/struct-system.ts` — `StructRegistry` 클래스
- 메서드 바인딩, 타입 안전한 필드 접근
- 17/17 PASS
- commit: `9e2ae73`

#### Phase 65: 향상된 패턴 매칭
- `guard` 조건부 패턴 — `(guard (> n 0))`
- `as` 바인딩 — `(as $full [$head & $rest])`
- 구조체 패턴 — `(Point :x $x :y $y)`
- 범위 패턴 — `(range 90 100)`
- 25/25 PASS
- commit: `0f92add`

#### Phase 64: 프로토콜/인터페이스 (defprotocol + impl)
- `defprotocol` — 프로토콜(인터페이스) 정의
- `impl` — 구조체에 프로토콜 구현 바인딩
- `src/protocol.ts` — `ProtocolRegistry` 클래스
- 런타임 다형성, 덕 타이핑 지원
- 29/29 PASS
- commit: `3fcb46c`

#### Phase 63: 위생적 매크로 시스템 (defmacro)
- `defmacro` — 위생적(Hygienic) 매크로 정의
- `macroexpand` — 매크로 확장 결과 확인
- 준따옴표(quasiquote) `` ` ``, 언퀴트 `~`, 스플라이싱 `~@` 지원
- `src/macro-expander.ts` — `MacroExpander` 클래스
- 16/16 PASS

---

### Tier 1 — 언어 핵심 (Phase 57–62)

#### Phase 62: Jest 테스트 스위트
- `src/__tests__/` — 11개 테스트 파일 완전 재작성
- Jest 커버리지 **75.05%** 달성
- lexer, parser, interpreter, stdlib, integration 전방위 테스트
- commit: `58c53e8`

#### Phase 61: TCO (꼬리 호출 최적화)
- `src/tco.ts` — TailCall 토큰 + trampoline 실행기
- 100만 재귀에도 스택오버플로 없음
- `loop/recur` 특수 폼과 연동
- commit: `8f242ba`

#### Phase 60: 점진적 타입 체킹
- `src/type-system.ts` — `RuntimeTypeChecker` 클래스
- 타입 어노테이션 있는 함수 인자 실시간 검증
- `FREELANG_STRICT=1` 환경 변수로 strict 모드 활성화
- strict 모드: `(+ "a" 1)` → 타입 에러

#### Phase 59: 에러 시스템 전면 개선
- `src/error-formatter.ts` — 소스 3줄 컨텍스트 + ^ 강조 + 색상
- `src/errors.ts` — `FLError`, `FLRuntimeError` 계층 구조
- Levenshtein 유사 함수명 제안 (편집거리 ≤ 2)
- 인자 수 불일치: "N개 필요, M개 전달" 명확한 메시지

#### Phase 58: 모듈 시스템 분리
- `src/eval-module-system.ts` — 모듈 등록/평가 분리
- `src/stdlib-loader.ts` — stdlib 19개 모듈 테이블 기반 자동 등록
- `src/interpreter-context.ts` — `ExecutionContext`, `FreeLangFunction` 타입 이관

#### Phase 57: interpreter.ts 3,733줄 분해
- `src/eval-special-forms.ts` — `define`, `let`, `fn`, `if`, `cond`, `do`, `loop`, `match`, `try`, `async`, `await` 등 22개 특수 폼
- `src/eval-builtins.ts` — 산술/문자열/배열/맵 내장 함수 94개+
- `src/eval-ai-blocks.ts` — `search`, `learn`, `reason`, `observe`, `analyze`, `decide`, `act`, `verify` 8개 AI 블록
- `src/eval-call-function.ts` — 함수 호출 디스패치 통합
- interpreter.ts: 3,733줄 → 768줄 (79% 축소)

---

### Phase 56: 렉시컬 스코프 (ScopeStack) — 기반 완성
- `src/interpreter-scope.ts` — `ScopeStack` 클래스
- 클로저 정확한 캡처, 변수 섀도잉 지원
- **14/14 PASS** — v1.0 regression 기준 테스트
- Phase 49, 53, 54 regression 전부 통과

---

### Phase 1–55: 기반 구축

| 범위 | 내용 |
|------|------|
| Phase 1–8 | 렉서, 파서, 기본 인터프리터 (S-expression 기반) |
| Phase 9a–9c | AI 블록: search/learn/reason, 피드백 루프 |
| Phase 10–11 | 파일 I/O, 에러 처리 v1 |
| Phase 12–22 | HTTP/Shell/Data/Collection/Agent/Time/Crypto/Workflow/Resource/Server/DB/WS/Auth/Cache/PubSub/Process |
| Phase 23–30 | 자체 호스팅 1.0 (FL→FL→JS) |
| Phase 31–45 | TCO v1, Gen3 부트스트랩, 소스맵, 가변인자, 구조분해, REPL v1, 포맷, 타입체크 v1 |
| Phase 46–53 | 패턴 매칭 v1, 파일 I/O v2, 타입, stdlib, FL 서버, Transformer |
| Phase 54–55 | FL utility library (import), HTTP 클라이언트 |

---

## [0.9.0] - 2026-04-10 (Phase 72)

Tier 2 완료 기념 사전 릴리스. AI 블록, 매크로, 프로토콜, 구조체, 동시성, 파이프라인, 레이지, 이뮤터블 모두 완성.

## [0.8.0] - 2026-04-09 (Phase 62)

Tier 1 완료. interpreter.ts 분해, 에러 시스템, 타입체킹, TCO, Jest 75%+ 커버리지 달성.

## [0.5.0] - 2026-04-07 (Phase 56)

렉시컬 스코프 완성. ScopeStack 기반 클로저, 14/14 regression PASS.

## [0.1.0] - 2026-04-04 (Phase 1)

최초 구현. S-expression 렉서, 파서, 기본 인터프리터. AI 전용 언어 비전 선언.
