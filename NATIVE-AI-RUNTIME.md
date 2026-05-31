# FreeLang Native AI Runtime — 현황 문서

**기준일**: 2026-06-01  
**상태**: Layer 1~3 완료, task-error-quality 완료

---

## 아키텍처

```
FL 소스
  ↓ cgc-bin (FL→C 컴파일러, 343KB)
C 코드
  ↓ gcc
Native ELF
  ↓
  ├── http-get / http-post-headers  (Layer 1: runtime/http-client.c)
  ├── (load "stdlib/ai.fl")         (컴파일 타임 인라인)
  │     └── ai-complete / ai-openai (Layer 2: FL 코드)
  └── (load "stdlib/agent.fl")
        └── agent-run / agent-opus  (Layer 3: FL 코드)
```

**핵심 원칙** (dec-native-ai-arch LOCK):
- C 레이어: HTTP, JSON, File, Process — 범용 기반만
- AI 레이어: FL 코드 — 모델 교체가 파일 수정으로 끝남

---

## 완료된 작업 (2026-05-31 ~ 2026-06-01)

### Layer 1 — Native HTTP 클라이언트
- `runtime/http-client.c` (curl subprocess, libcurl 헤더 불필요)
- `fl_http_get(url)` → `{:status 200 :body "..." :headers {}}`
- `fl_http_post(url, body, content-type)` → 동일
- `fl_http_get_headers(url, headers-map)` → 동일
- `fl_http_post_headers(url, body, headers-map)` → 동일

### Layer 2 — AI stdlib (FL 코드)
- `stdlib/ai.fl`
- `(ai-complete prompt)` → claude-opus-4-8 호출
- `(ai-complete-model prompt model max-tokens)` → 모델 지정
- `(ai-openai prompt base-url key model)` → OpenAI 호환
- OAuth Bearer(`sk-ant-oat...`) / 일반 API key 자동 감지

### Layer 3 — Agent stdlib (FL 코드)
- `stdlib/agent.fl`
- `(agent prompt tools)` → ReAct 루프 (haiku)
- `(agent-opus prompt tools)` → 강한 모델
- `(agent-add-tool name fn)` → 커스텀 tool 등록
- 내장 tool: `http_get`, `http_post`, `file_read`, `file_write`
- 기본 스키마: `tool-http-get`, `tool-file-read`, `tools-web`, `tools-fs`, `tools-all`

### (load ...) 인라인 확장
- `cgc-main.fl`: `expand-loads` 함수 추가
- 컴파일 타임에 대상 파일 AST 수준 인라인 (재귀 지원)
- 경로 탐색: 기준 디렉토리 우선 → CWD 폴백

### 에러 메시지 품질 (task-error-quality ✅)
- **Layer A** — `fl-native.sh`: gcc 에러 → FL 메시지 변환
  - `[FL Error] 정의되지 않은 이름: undefined-var (line 10)`
  - `[FL Error] 함수 "add": 인자가 부족합니다`
  - `[FL Error] 타입 불일치 (line N)`
- **Layer B** — `runtime/core.c`: 런타임 타입 에러
  - `fl_type_name()`, `fl_type_error()` 추가
  - fl_add/sub/mul/div: nil·잘못된 타입 즉시 에러
  - `[FL Error] TypeError: + (add) — number 필요, nil 제공`
  - `[FL Error] ArithmeticError: 0으로 나눌 수 없습니다`
- **Layer C** — `cgc-main.fl`: 미정의 변수 컴파일 경고
  - `[FL Warn] 정의되지 않은 이름: foo (line N)`

---

## 실 검증

```bash
# HTTPS GET
bash scripts/fl-native.sh run test.fl
# test.fl: (println (get (http-get "https://api.ipify.org") "body"))
# → 123.212.111.26

# Claude API 호출 (haiku)
ANTHROPIC_API_KEY=$KEY bash scripts/fl-native.sh run ai_test.fl
# ai_test.fl: (load "stdlib/ai.fl") (println (ai-complete-model "1+1?" "claude-haiku-4-5-20251001" 32))
# → 1 + 1 = **2**

# Agent (http_get tool)
# → "현재 서버의 공개 IP는 123.212.111.26 입니다."

# Agent (file_write + file_read tool)
# → 파일 쓰기/읽기 왕복 확인
```

---

## 다음 구현 순서 (SPEC.airc 기준)

| 순서 | Task | 핵심 내용 | 상태 |
|---|---|---|---|
| 1 | `task-error-quality` | 에러 메시지 4종 개선 | ✅ 완료 |
| 2 | `task-arg-consistency` | 인자 순서 감사·정비 | 🔥 진행 중 |
| 3 | `task-streaming-response` | ai-stream 스트리밍 | 예정 |
| 4 | `task-parallel-agent` | agent 병렬 실행 | 예정 |
| 5 | `task-repl-native` | Native REPL | 예정 |

---

## 알려진 한계 (2026-06-01 기준)

| 항목 | 내용 |
|---|---|
| HTTP 클라이언트 방식 | curl subprocess (popen). libcurl-dev 설치 시 C API로 교체 예정 |
| 스트리밍 | 미구현. ai-complete은 전체 응답 대기 |
| 병렬 실행 | 미구현. agent는 단일 스레드 순차 |
| Native REPL | 미구현. 실험하려면 파일 → 빌드 → 실행 cycle |
| 인자 순서 | 일부 불일치 (task-arg-consistency에서 정비 예정) |
| 인간 없는 자율 운영 | 아직 불가. 에러 메시지 개선됐지만 복잡한 버그는 인간 개입 필요 |

---

## 사용법 요약

```lisp
;; Layer 1 — HTTP
(define res (http-get "https://api.ipify.org"))
(println (get res "body"))

;; Layer 2 — AI
(load "stdlib/ai.fl")
(println (ai-complete "1+1은?"))

;; Layer 3 — Agent
(load "stdlib/agent.fl")
(println (agent "공개 IP 알려줘" [tool-http-get]))

;; 커스텀 tool
(agent-add-tool "calc" (fn [input] (str (eval-expr (get input "expr")))))
(agent "100*200 계산해줘" [tool-http-get])
```
