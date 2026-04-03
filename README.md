# 🚀 FreeLang v9: AI-Exclusive Programming Language

> **FreeLang v4로 구현한 완전한 AI 전용 프로그래밍 언어**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Language](https://img.shields.io/badge/implementation-FreeLang%20v4-orange)
![Tests](https://img.shields.io/badge/tests-25%2F25%20passing-brightgreen)
![Lines of Code](https://img.shields.io/badge/code-6%2C307%20lines-blue)

---

## 📋 목차

- [개요](#개요)
- [주요 특징](#주요-특징)
- [설치 및 실행](#설치-및-실행)
- [빠른 시작](#빠른-시작)
- [아키텍처](#아키텍처)
- [핵심 개념](#핵심-개념)
- [5개 필수 라이브러리](#5개-필수-라이브러리)
- [예제](#예제)
- [문서](#문서)
- [프로젝트 구조](#프로젝트-구조)

---

## 개요

**FreeLang v9**는 AI 작업을 위해 설계된 혁신적인 프로그래밍 언어입니다. LLM 통합, 자동 에이전트, 벡터 검색, 트랜잭션 관리를 네이티브로 지원합니다.

### 핵심 철학
- 🤖 **AI-First**: LLM 호출, 벡터 임베딩, 자동 에이전트가 언어 차원에서 지원됨
- 🔄 **자가 호스팅**: v9 자체가 v4로 구현되어 언어의 강력함을 증명
- 📦 **프로덕션 레벨**: 트랜잭션, 재시도 정책, 속도 제한, 메모리 관리 포함
- 🧪 **완전 검증**: 40+ 테스트, 100% 통과율

---

## 주요 특징

### 5가지 핵심 블록 타입

| 블록 | 용도 | 특징 |
|------|------|------|
| **INTENT** | 원자적 작업 | 커밋/롤백, 재시도 정책 |
| **FUNC** | 순수 함수 | 상태 변화 없음, 함수형 |
| **PIPE** | 데이터 변환 | 파이프라인, 필터링, 매핑 |
| **PROMPT** | LLM 호출 | Anthropic API, 토큰 관리 |
| **AGENT** | 자동 에이전트 | 도구 체인, 자율적 실행 |

### AI 기능

```
✨ 벡터 임베딩 & 의미론적 검색
✨ LLM 통합 (Anthropic Claude)
✨ 자동 에이전트 및 도구 시스템
✨ 메모리 풀 및 컨텍스트 윈도우
✨ 속도 제한 및 재시도 정책
✨ 트랜잭션 및 원자성 보장
```

---

## 설치 및 실행

### 요구사항

- **FreeLang v4** (컴파일러)
- **v4 표준 라이브러리**
- **Anthropic API 키** (LLM 기능용)

### 저장소 클론

```bash
git clone https://gogs.dclub.kr/kim/freelang-v9.git
cd freelang-v9
```

### 기본 실행

```bash
# v4 컴파일러로 v9 파일 실행
freelang-v4 v9-lexer.fl          # 렉서 테스트
freelang-v4 v9-parser.fl         # 파서 테스트
freelang-v4 v9-interpreter.fl    # 인터프리터 테스트
freelang-v4 v9-runtime.fl        # 런타임 테스트
```

### 전체 검증 실행

```bash
# 5개 필수 라이브러리 검증 (25/25 테스트)
freelang-v4 v9-stdlib-validate.fl

# 또는 개별 라이브러리 테스트
freelang-v4 v9-stdlib-ai.fl
freelang-v4 v9-stdlib-data.fl
freelang-v4 v9-stdlib-memory.fl
freelang-v4 v9-stdlib-async.fl
freelang-v4 v9-stdlib-tools.fl
```

---

## 빠른 시작

### 1️⃣ 간단한 INTENT 블록 (트랜잭션)

```freelang
INTENT "bank_transfer" {
  ADD_OP "Debit account A: 1000"
  ADD_OP "Credit account B: 1000"
  ADD_ROLLBACK "Revert debit"
  ADD_ROLLBACK "Revert credit"
  COMMIT
}
```

원자적 작업을 보장합니다. 실패 시 자동 롤백.

### 2️⃣ LLM 호출 (PROMPT)

```freelang
PROMPT "summarize" {
  SYSTEM "You are a helpful summarizer"
  USER "Summarize this text..."
  CALL "claude-3-sonnet-20240229"
}
```

Claude LLM을 직접 호출합니다.

### 3️⃣ 데이터 파이프라인 (PIPE)

```freelang
PIPE "data_processing" {
  CSV_PARSE "input.csv"
  FILTER "status" "active"
  SELECT ["name", "score"]
  WRITE_JSON "output.json"
}
```

데이터 변환과 필터링을 체이닝합니다.

### 4️⃣ 자동 에이전트 (AGENT)

```freelang
AGENT "analyst" {
  TOOL "fetch_data"
  TOOL "analyze"
  TOOL "generate_report"
  MAX_STEPS 10
  EXECUTE
}
```

도구를 조합하여 자율적으로 실행합니다.

### 5️⃣ 순수 함수 (FUNC)

```freelang
FUNC "fibonacci" (n: i32) -> i32 {
  if n <= 1 { return n }
  return fibonacci(n - 1) + fibonacci(n - 2)
}
```

전통적인 함수형 프로그래밍.

---

## 아키텍처

### 언어 구현 파이프라인

```
Source Code
    ↓
[Lexer] → Tokens
    ↓
[Parser] → AST (S-Expression)
    ↓
[Interpreter] → Evaluation Context
    ↓
[Runtime] → Block Execution
    ↓
Result
```

### 핵심 컴포넌트

#### 렉서 (v9-lexer.fl)
- S-Expression 토크나이저
- 위치 추적 (line, column)
- 숫자, 문자열, 심볼, 키워드 지원

#### 파서 (v9-parser.fl)
- 재귀 하강 파서 (Recursive Descent)
- 5가지 블록 타입 파싱
- AST 직렬화 (문자열 기반)

#### 인터프리터 (v9-interpreter.fl)
- 환경 기반 변수 바인딩
- 산술, 비교, 논리 연산
- If-then-else 제어 흐름

#### 런타임 (v9-runtime.fl)
- 5가지 블록 타입 실행
- INTENT 트랜잭션 관리
- 도구 등록 및 실행

---

## 핵심 개념

### 🔄 INTENT 블록: 트랜잭션

```freelang
INTENT "payment" {
  ADD_OP "Check balance"
  ADD_OP "Deduct amount"
  ADD_OP "Update ledger"
  ADD_ROLLBACK "Restore balance"
  COMMIT          ;; 성공 시 커밋
  ROLLBACK        ;; 실패 시 롤백
}
```

- **원자성**: 모두 성공하거나 모두 실패
- **롤백**: 실패 시 자동으로 이전 상태로 복구
- **재시도**: 설정된 횟수만큼 자동 재시도

### 📊 벡터 임베딩 & 검색

```freelang
var store = EmbeddingStore(dimension: 768)
store.add("doc1", "FreeLang is powerful", ["ai", "lang"])
store.add("doc2", "Python is popular", ["python"])

var results = store.search("AI language", top_k: 2)
;; 코사인 유사도로 상위 2개 결과 반환
```

### 🤖 자동 에이전트

```freelang
var agent = Agent("analyzer")
agent.register_tool("fetch_data", ...)
agent.register_tool("process", ...)
agent.run(max_iterations: 10)
;; 도구를 자율적으로 조합 실행
```

### 💾 메모리 관리

```freelang
var memory = MemoryPool(max_size: 100)
memory.remember("important data")     ;; FIFO 저장
memory.remember("more data")

var context = ContextWindow(max_tokens: 4096)
context.add("System message")         ;; 토큰 예산 관리
context.add("User query")
```

---

## 5개 필수 라이브러리

### 📡 AI/LLM (v9-stdlib-ai.fl)

Anthropic API 통합, 요청 빌더, 응답 처리

```freelang
var client = AIClient("claude-3-sonnet")
var response = client.complete("Hello")
println(response.content)
```

**기능:**
- AIClient: API 클라이언트 관리
- AIRequest: 요청 빌더
- AIResponse: 응답 처리
- complete(), chat(), classify() 편의 함수

---

### 📈 데이터 처리 (v9-stdlib-data.fl)

CSV/JSON 처리, 필터링, 선택

```freelang
var csv_data = csv_parse("name,age\nAlice,30")
var filtered = csv_filter(csv_data, "age", "30")
var selected = csv_select_columns(csv_data, ["name"])
```

**기능:**
- CSV 파싱 및 직렬화
- JSON 처리
- 필터링 및 컬럼 선택
- 데이터 변환

---

### 🧠 메모리 & 벡터 (v9-stdlib-memory.fl)

임베딩, 의미론적 검색, 메모리 풀

```freelang
var store = embedding_store_new(768)
store = embedding_store_add(store, "doc1", "Text...", ["tag"])
var results = embedding_store_search(store, "query", 5)
```

**기능:**
- 벡터 임베딩
- 코사인 유사도 검색
- 컨텍스트 윈도우 (토큰 관리)
- FIFO 메모리 풀

---

### ⚡ 비동기 & 트랜잭션 (v9-stdlib-async.fl)

트랜잭션, 작업 큐, 재시도 정책

```freelang
var tx = transaction_new("transfer")
tx = transaction_add_op(tx, "Debit: 1000")
tx = transaction_commit(tx)

var policy = retry_policy_new(3)
retry_with_policy(policy, "risky_operation")
```

**기능:**
- 트랜잭션 (커밋/롤백)
- 작업 큐 처리
- 속도 제한
- 재시도 정책
- 지수 백오프

---

### 🛠️ 도구 시스템 (v9-stdlib-tools.fl)

도구 등록, 실행, 체이닝

```freelang
var registry = tool_registry_new()
var tool = tool_new("read-csv", "Read CSV file")
registry = tool_registry_register(registry, tool)

var call = tool_call_new("read-csv")
call = tool_call_execute(registry, call)
```

**기능:**
- 도구 레지스트리
- 도구 등록 및 검색
- 도구 실행
- 도구 체인 (파이프라인)
- 도구 검증

---

## 예제

### 예제 1: 은행 송금 (트랜잭션)

```freelang
INTENT "transfer" {
  ADD_OP "SELECT account WHERE id = 1"
  ADD_OP "UPDATE account SET balance -= 1000"
  ADD_OP "UPDATE account SET balance += 1000"
  ADD_ROLLBACK "ROLLBACK all changes"

  COMMIT        ;; 성공
  ROLLBACK      ;; 실패 시
}
```

### 예제 2: 데이터 분석 (파이프라인)

```freelang
PIPE "analysis" {
  CSV_PARSE "data.csv"
  FILTER "status" "active"
  GROUP_BY "category"
  AGGREGATE "sum" "amount"
  WRITE_JSON "report.json"
}
```

### 예제 3: 자동 분석 에이전트

```freelang
AGENT "analyst" {
  TOOL "fetch_market_data"
  TOOL "calculate_metrics"
  TOOL "generate_summary"

  ;; 도구를 자율적으로 조합 실행
  EXECUTE
}
```

### 예제 4: 감정 분석 (LLM)

```freelang
PROMPT "sentiment" {
  SYSTEM "Analyze sentiment"
  USER "This product is amazing!"
  CALL "claude-3-sonnet"

  ;; 응답: { sentiment: "positive", score: 0.95 }
}
```

### 예제 5: Fibonacci 함수

```freelang
FUNC "fibonacci" (n: i32) -> i32 {
  if n <= 1 {
    return n
  }

  var a = fibonacci(n - 1)
  var b = fibonacci(n - 2)
  return a + b
}
```

더 많은 예제는 `v9-examples.fl`를 참고하세요.

---

## 문서

| 파일 | 설명 | 크기 |
|------|------|------|
| **V9_IN_V4.md** | v9 디자인 개요 및 아키텍처 | 7.4 KB |
| **V9_COMPLETE.md** | 완전한 기능 가이드 | 11 KB |
| **V9_FINAL_REPORT.md** | 프로덕션 완성 보고서 | 12 KB |

각 문서는 다음을 다룹니다:
- ✅ 전체 언어 명세
- ✅ 블록 타입 상세 설명
- ✅ 라이브러리 API
- ✅ 예제 및 베스트 프랙티스

---

## 프로젝트 구조

```
freelang-v9/
├── README.md                      # 이 파일
├── V9_IN_V4.md                   # 디자인 문서
├── V9_COMPLETE.md                # 완전 가이드
├── V9_FINAL_REPORT.md            # 최종 보고서
│
├── Core Implementation (1,840 줄)
│   ├── v9-lexer.fl               # S-Expression 토크나이저
│   ├── v9-parser.fl              # 재귀 하강 파서
│   ├── v9-interpreter.fl         # AST 평가기
│   └── v9-runtime.fl             # 블록 타입 실행기
│
├── Self-Hosting (1,325 줄)
│   ├── v9-bootstrap.fl           # v4로 구현된 v9
│   ├── v9-llm.fl                 # LLM 통합
│   ├── v9-memory.fl              # 벡터 & 메모리
│   └── v9-optimized.fl           # 컴파일 최적화
│
├── Essential Libraries (1,648 줄)
│   ├── v9-stdlib-ai.fl           # AI/LLM 클라이언트
│   ├── v9-stdlib-data.fl         # CSV/JSON 처리
│   ├── v9-stdlib-memory.fl       # 임베딩 & 검색
│   ├── v9-stdlib-async.fl        # 트랜잭션 & 큐
│   ├── v9-stdlib-tools.fl        # 도구 시스템
│   └── v9-stdlib-validate.fl     # 통합 검증
│
└── Tests & Examples (1,494 줄)
    ├── v9-tests.fl               # 40+ 테스트 케이스
    ├── v9-examples.fl            # 8개 실제 예제
    ├── v9-complete.fl            # 통합 데모
    └── v9-end-to-end.fl          # 엔드-투-엔드 파이프라인
```

---

## 📊 통계

```
┌─────────────────────────────────────────┐
│  FreeLang v9 구현 통계                  │
├─────────────────────────────────────────┤
│ 총 라인 수:         6,307 줄 (v4 구현)  │
│                                          │
│ 핵심 언어:          1,840 줄             │
│ 자가 호스팅:        1,325 줄             │
│ 필수 라이브러리:    1,648 줄             │
│ 테스트 & 예제:      1,494 줄             │
│                                          │
│ 테스트 통과:        25/25 (100%)        │
│ 함수:               80+ 개               │
│ 구조체:             30+ 개               │
│ 블록 타입:          5개                  │
└─────────────────────────────────────────┘
```

---

## 🎯 주요 성과

- ✅ **완전한 자가 호스팅**: v9가 v4로 구현되어 언어 강력함 입증
- ✅ **AI 전용 설계**: LLM, 에이전트, 벡터 검색이 네이티브로 지원
- ✅ **프로덕션 레벨**: 트랜잭션, 재시도, 속도 제한, 메모리 관리
- ✅ **완전 검증**: 40+ 테스트, 25 라이브러리 테스트 (100% 통과)
- ✅ **포괄적 문서**: 30KB+ 상세 가이드

---

## 🔗 관련 프로젝트

- **FreeLang v4**: 기반 구현 언어
  - 저장소: https://gogs.dclub.kr/kim/freelang-v4.git

---

## 📝 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 🤝 기여

이슈 보고 및 제안은 Gogs 저장소를 통해 환영합니다:
https://gogs.dclub.kr/kim/freelang-v9

---

## 📞 연락처

- **저장소**: https://gogs.dclub.kr/kim/freelang-v9
- **이메일**: bigwash2025@gmail.com

---

**Made with ❤️ using FreeLang v4**

*마지막 업데이트: 2026-04-03*
