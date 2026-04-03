# FreeLang v9 아키텍처

## 📋 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│           FreeLang v9 프로그래밍 언어                    │
│        (분산 이해도 높은 AI 에이전트 플랫폼)              │
└─────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        │                                       │
    ┌─────────┐                         ┌──────────────┐
    │  언어   │                         │  에이전트    │
    │  엔진   │                         │  시스템      │
    └─────────┘                         └──────────────┘
        ↓                                       ↓
    ┌─────────────────────────┐    ┌──────────────────────┐
    │ Layer 1: 렉서 (Lexer)    │    │ 에이전트 카탈로그    │
    │ - v9-lexer.fl (347줄)   │    │ - v9-agent-catalog   │
    │ - 토큰 생성             │    │ - 50개 에이전트      │
    │ - 주석, 문자열 처리     │    │ - 5개 카테고리       │
    └─────────────────────────┘    └──────────────────────┘
                                             ↓
    ┌─────────────────────────┐    ┌──────────────────────┐
    │ Layer 2: 파서 (Parser)  │    │ 에이전트 엔진        │
    │ - v9-parser.fl (300줄)  │    │ - v9-agent-engine    │
    │ - AST 생성              │    │ - ReAct 루프         │
    │ - 5가지 노드 타입       │    │ - 상태 관리          │
    └─────────────────────────┘    └──────────────────────┘
                                             ↓
    ┌─────────────────────────┐    ┌──────────────────────┐
    │ Layer 3: 인터프리터     │    │ 레퍼런스 에이전트    │
    │ - v9-interpreter.fl     │    │ - data_analyst       │
    │ - AST 실행              │    │ - rag_agent          │
    │ - 환경 & 메모리         │    │ - orchestrator       │
    └─────────────────────────┘    └──────────────────────┘
                ↓
    ┌─────────────────────────────────────────────────┐
    │ 표준 라이브러리 (17개 모듈, 4,550줄)           │
    ├─────────────────────────────────────────────────┤
    │ I/O              | String          | JSON        │
    │ Data             | Memory          | Validation  │
    │ Time             | AI/LLM          | Async       │
    │ Tools            | Regex           | Result      │
    │ Collections      | Logging         | DateTime    │
    └─────────────────────────────────────────────────┘
                ↓
    ┌─────────────────────────────────────────────────┐
    │ 에러 처리 & 유틸리티                            │
    ├─────────────────────────────────────────────────┤
    │ - v9-error-handling.fl: 일관된 에러 관리       │
    │ - ParseError, EvaluationError, IOError         │
    │ - 검증 함수 & 포매팅                           │
    └─────────────────────────────────────────────────┘
```

## 🔄 데이터 흐름

```
사용자 코드
    ↓
┌──────────────────────────┐
│  렉서 (v9-lexer.fl)      │
│  - 토큰 생성             │
│  Token[] 배열 생성       │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  파서 (v9-parser.fl)     │
│  - AST 생성              │
│  직렬화된 AST 문자열     │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  인터프리터              │
│  (v9-interpreter.fl)     │
│  - AST 실행              │
│  - 환경에서 변수 조회    │
│  - 결과 출력             │
└──────────────────────────┘
    ↓
   결과
```

## 📦 모듈별 의존성

```
v9-lexer.fl (렉서)
    ↓ (Token 구조체 제공)
v9-parser.fl (파서)
    ↓ (직렬화 AST 제공)
v9-interpreter.fl (인터프리터)
    ↓ (실행 결과)

표준 라이브러리:
    ├── v9-stdlib-io.fl (파일 I/O)
    ├── v9-stdlib-string.fl (문자열)
    ├── v9-stdlib-json.fl (JSON)
    ├── v9-stdlib-data.fl (CSV/JSON 변환)
    ├── v9-stdlib-memory.fl (벡터 임베딩, 컨텍스트)
    ├── v9-stdlib-time.fl (시간/날짜)
    ├── v9-stdlib-validate.fl (통합 검증)
    ├── v9-stdlib-ai.fl (Claude API)
    ├── v9-stdlib-async.fl (트랜잭션, 재시도)
    ├── v9-stdlib-tools.fl (도구 시스템)
    ├── v9-stdlib-regex.fl (패턴 매칭)
    ├── v9-stdlib-result.fl (Result<T>, Option<T>)
    ├── v9-stdlib-collections.fl (HashMap, HashSet)
    ├── v9-stdlib-logging.fl (로깅)
    ├── v9-stdlib-datetime.fl (DateTime)
    └── v9-stdlib-comprehensive-test.fl (테스트)

에이전트 시스템:
    ├── v9-agent-catalog.fl (50개 에이전트 정의)
    ├── v9-agent-engine.fl (ReAct 엔진)
    ├── v9-agent-ref-data.fl (데이터 분석 에이전트)
    ├── v9-agent-ref-rag.fl (RAG 검색 에이전트)
    └── v9-agent-ref-orchestrator.fl (멀티 에이전트 조율)

에러 처리:
    └── v9-error-handling.fl (일관된 에러 관리)
```

## 🎯 주요 특징

### 1. 언어 엔진 (3계층)

| 계층 | 파일 | 줄 수 | 기능 |
|------|------|-------|------|
| 1 | v9-lexer.fl | 347 | 토큰 생성 |
| 2 | v9-parser.fl | 300 | AST 생성 |
| 3 | v9-interpreter.fl | 506 | AST 실행 |

**특징:**
- 토큰 기반 파싱
- 직렬화된 AST 표현
- 환경 기반 변수 관리
- ReAct 패턴 지원

### 2. 표준 라이브러리 (17개 모듈)

**범주:**
- **I/O**: 파일 읽기/쓰기, 디렉토리 관리, 경로 조작
- **데이터**: CSV/JSON 파싱, 변환, 필터링
- **메모리**: 벡터 임베딩, 의미론적 검색, 컨텍스트 윈도우
- **AI/LLM**: Claude API 통합
- **비동기**: 트랜잭션, 재시도, 롤백
- **도구**: 도구 레지스트리, 실행
- **검증**: 통합 테스트 프레임워크

**통계:**
- 총 4,550줄
- 30/30 테스트 통과 (v9-stdlib-validate.fl)

### 3. 에이전트 시스템 (50개 에이전트)

**5개 카테고리:**

1. **Data (데이터, 10개)**
   - CSV 분석가, SQL 쿼리 작성기, 데이터 검증, ...

2. **Code (코드, 10개)**
   - Python 코드 작성, 버그 수정, 리팩토링, ...

3. **Knowledge (지식, 10개)**
   - 사실 검증, 요약기, 추천 엔진, ...

4. **Comms (통신, 10개)**
   - 이메일 작성, 리포트 생성, 뉴스레터, ...

5. **Ops (운영, 10개)**
   - 작업 스케줄러, 모니터링, 알림, ...

**엔진:**
- ReAct 루프: Reason → Act → Observe
- 상태 추적: idle, running, completed, failed
- 메모리 통합: 과거 결과 캐싱

### 4. 에러 처리

**에러 타입:**
- ParseError: 파싱 오류 (줄/열 정보)
- EvaluationError: 평가 오류 (타입 불일치)
- IOError: I/O 오류 (파일 작업)
- TypeError: 타입 오류 (검증)

**검증 함수:**
- validate_not_empty()
- validate_positive()
- validate_range()

## 📊 성능

| 모듈 | 시간 | 통과 |
|------|------|------|
| v9-lexer | 빠름 | ✅ |
| v9-parser | 빠름 | ✅ |
| v9-interpreter | 중간 | ✅ |
| stdlib | 빠름 | 30/30 ✅ |
| 에이전트 | 느림* | ✅ |

*에이전트는 LLM 호출로 인해 느림

## 🚀 사용 예시

```freelang
// 1. 기본 계산
var tokens = lex("(+ 1 2)")
var ast = parse(tokens)
var result = interpret(ast)
// 출력: 3

// 2. 파일 처리
var content = file_read("data.csv")
var csv = csv_parse(content)
var filtered = csv_filter(csv, "age", "30")

// 3. 메모리 검색
var store = embedding_store_new(768)
store = embedding_store_add(store, "doc1", "Hello World", [])
var results = embedding_store_search(store, "greeting", 5)

// 4. 에이전트 실행
var agent_spec = agent_spec_new("data-001", "CSV Analyst", "data", ...)
var state = agent_state_new(agent_spec.id, "분석해줘", 5)
var result = agent_run_loop(state, plan)
```

## 📝 문서화 상태

### 언어 엔진
- ✅ v9-lexer.fl: 전체 문서화 (기본 정보, 함수 설명)
- ✅ v9-parser.fl: 전체 문서화 (AST 노드, 파싱 함수)
- ✅ v9-interpreter.fl: 전체 문서화 (평가 엔진, 모든 함수)

### 표준 라이브러리
- ✅ 17개 모듈 모두 모듈 설명 및 함수 목록 문서화

### 에이전트 시스템
- ✅ 5개 에이전트 파일 모두 목적 및 기능 문서화

### 에러 처리
- ✅ v9-error-handling.fl: 에러 타입, 포매팅, 검증 함수 문서화

## 🔧 개선 방향

1. **에러 처리 강화**
   - 모든 함수에 에러 반환 추가 (Result<T> 사용)
   - 타입 검증 강화
   - 스택 트레이스 추가

2. **성능 최적화**
   - 파싱 캐싱
   - AST 컴파일
   - JIT 최적화

3. **기능 확장**
   - 모듈 시스템 (import/export)
   - 패턴 매칭
   - 매크로 시스템
   - 동적 로딩

4. **테스트 확대**
   - 통합 테스트 추가
   - 성능 벤치마크
   - 에러 케이스 테스트

---

**마지막 업데이트**: 2026-04-04
**버전**: v9.1.0
**상태**: 문서화 80% 완료
