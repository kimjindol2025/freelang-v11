# FreeLang v11 Agent DSL — 완전 가이드

> AI 에이전트가 **안정적으로 작업을 정의하고 실행**하는 프레임워크

---

## 📚 목차

1. [개요](#개요)
2. [핵심 개념](#핵심-개념)
3. [Task 정의](#task-정의)
4. [State 관리](#state-관리)
5. [Logging & 검증](#logging--검증)
6. [Storage](#storage)
7. [실제 예제](#실제-예제)
8. [API 레퍼런스](#api-레퍼런스)

---

## 개요

### FreeLang Agent DSL은 무엇인가?

AI 에이전트가 작업을 **결정론적으로 정의하고 실행**하는 프레임워크입니다.

```lisp
(load "src/agent-dsl.fl")

; Task 정의
(let [$task (make-task "fetch-data" fetch-action)])

; 실행
(agent-run [$task])
```

### 3가지 특징

| 특징 | 설명 |
|------|------|
| **Deterministic** | 같은 입력 = 같은 출력 (SHA256 보증) |
| **Reproducible** | 실행 기록 → 재현 가능한 로그 |
| **Traceable** | 모든 단계를 추적하고 검증 |

---

## 핵심 개념

### 1. Task (작업)

**정의**: 하나의 원자적 작업 단위

```lisp
{
  :name "fetch-users"      ; 작업 이름
  :action action-fn        ; 실행 함수
  :depends []              ; 의존 작업
  :retry 3                 ; 재시도 횟수
  :timeout 30000           ; 타임아웃 (ms)
  :on-error nil            ; 에러 핸들러
  :on-success nil          ; 성공 콜백
  :status "pending"        ; 상태
  :result nil              ; 실행 결과
  :error nil               ; 에러 정보
}
```

### 2. State (상태)

**정의**: Agent의 전역 상태 (불변)

```lisp
{
  :id "agent_1234567890"      ; 세션 ID
  :created-at 1234567890      ; 생성 시간
  :steps { :counter 0 }       ; 단계별 데이터
  :logs [...]                 ; 실행 기록
}
```

### 3. Workflow (워크플로우)

**정의**: 여러 Task를 의존성과 함께 실행

```
Task A (독립)
  ↓
Task B (A 완료 후)
  ↓
Task C (B 완료 후)
```

---

## Task 정의

### 기본 Task 만들기

```lisp
(let [$action (fn [$ctx] (println "작업 실행중..."))]
  (let [$task (make-task "hello" $action)]
    (println $task)))
```

**출력**:
```
{
  :name "hello"
  :action <function>
  :depends []
  :retry 3
  :timeout 30000
  ...
}
```

### Task 커스터마이징

```lisp
; 재시도 횟수 변경
(assoc $task :retry 5)

; 의존성 추가
(assoc $task :depends ["fetch-data"])

; 에러 핸들러 추가
(assoc $task :on-error (fn [err]
  (println (str "Error: " err))
))

; 성공 콜백 추가
(assoc $task :on-success (fn [result]
  (println (str "Success: " result))
))
```

### Task 액션 함수 작성

```lisp
; 간단한 액션
[FUNC fetch-action :params [$ctx]
  :body { :data [1 2 3] }
]

; 컨텍스트 사용
[FUNC process-action :params [$ctx]
  :body (let [
    [$input (get $ctx :input)]
  ] (map (fn [x] (* x 2)) $input))
]

; HTTP 요청
[FUNC api-action :params [$ctx]
  :body (let [
    [$response (http-get "https://api.example.com/data")]
  ] (json-parse $response))
]
```

---

## State 관리

### State 초기화

```lisp
(let [$state (agent-state)]
  (println $state))
```

**출력**:
```
{
  :id "agent_1234567890"
  :created-at 1234567890
  :steps {}
  :logs []
}
```

### State 값 설정 및 조회

```lisp
; 값 설정
(let [$state (agent-state-set $state "counter" 0)]
  (println (agent-state-get $state "counter")))  ; 0

; 여러 값 설정
(let [$state (agent-state-set $state "total" 100)]
  (let [$state (agent-state-set $state "processed" 0)]
    (println (agent-state-get $state "total"))))  ; 100
```

### State 변화 추적

```lisp
(let [$state (agent-state)]
  (let [$state (agent-state-set $state "step1" "done")]
    (let [$state (agent-state-set $state "step2" "running")]
      (println (get $state :steps)))))

; 출력:
; { :step1 "done" :step2 "running" }
```

---

## Logging & 검증

### 기본 로깅

```lisp
(load "src/logging-deterministic.fl")

(let [$entry (log-entry 1 "fetch-data" 
  { :url "..." }
  { :result [...] }
)]
  (println $entry))
```

**출력**:
```
{
  :step 1
  :task-name "fetch-data"
  :timestamp 1234567890
  :input { :url "..." }
  :output { :result [...] }
  :input-hash "sha256-abc123..."
  :output-hash "sha256-def456..."
}
```

### 로그 검증 (결정론 보증)

```lisp
(let [$entry (log-entry 1 "task" 
  { :data 42 }
  { :result 84 }
)]
  (let [$verification (log-verify $entry)]
    (println (get $verification :valid))))  ; true
```

### 배치 검증

```lisp
(let [$log (execution-log)]
  (let [$log (log-append $log $entry1)]
    (let [$log (log-append $log $entry2)]
      (let [$results (log-verify-all $log)]
        (println (get $results :all-valid))))))  ; true
```

### 재현 (Replay)

```lisp
(let [$replay-results (log-replay $log)]
  (println (get $replay-results :total-steps)))
```

---

## Storage

### 초기화

```lisp
(load "src/storage-unified.fl")

; SQLite
(let [$storage (storage-init { :type "sqlite" :path "./agent.db" })]
  (println $storage))

; MariaDB
(let [$storage (storage-init {
  :type "mariadb"
  :host "localhost"
  :user "root"
  :password "..."
})]
  (println $storage))

; JSON (파일 기반)
(let [$storage (storage-init { :type "json" :path "./data" })]
  (println $storage))
```

### 데이터 저장

```lisp
; 상태 저장
(storage-save $storage "agent-state" "session-123" {
  :counter 42
  :status "running"
})

; 작업 결과 저장
(storage-save $storage "task-results" "task-1" {
  :status "done"
  :output { :count 100 }
})
```

### 데이터 로드

```lisp
(let [$data (storage-load $storage "agent-state" "session-123")]
  (println $data))

; 출력:
; { :counter 42 :status "running" }
```

### 쿼리 실행

```lisp
; SQLite
(let [$results (storage-query $storage 
  "SELECT * FROM tasks WHERE status = 'done'")]
  (println $results))

; MariaDB
(let [$results (storage-query $storage
  "SELECT * FROM tasks WHERE created_at > ?")]
  (println $results))
```

---

## 실제 예제

### 예제 1: 순차 작업 (데이터 수집 → 처리 → 저장)

```lisp
(load "src/agent-dsl.fl")
(load "src/logging-deterministic.fl")
(load "src/storage-unified.fl")

(let [$state (agent-state)]

  ; Task 1: 데이터 수집
  (let [$fetch-task (make-task "fetch" (fn [$ctx]
    (let [$data [
      { :id 1 :value 100 }
      { :id 2 :value 200 }
    ]]
      (do
        (set! $state (agent-log $state 1 "Fetched 2 items" {}))
        $data
      )
    )
  ))]

    ; Task 2: 처리
    (let [$process-task (make-task "process" (fn [$ctx]
      (let [$processed (map (fn [item]
        (assoc item :doubled (* (get item :value) 2))
      ) [...])]
        (do
          (set! $state (agent-log $state 2 "Processed items" {}))
          $processed
        )
      )
    ))]
      (assoc $process-task :depends ["fetch"])

      ; Task 3: 저장
      (let [$save-task (make-task "save" (fn [$ctx]
        (let [$storage (storage-init { :type "sqlite" })]
          (do
            (storage-save $storage "results" "batch-1" [...])
            (set! $state (agent-log $state 3 "Saved results" {}))
            { :saved true }
          )
        )
      ))]
        (assoc $save-task :depends ["process"])

        ; 실행
        (let [$result (agent-run [
          $fetch-task
          $process-task
          $save-task
        ])]
          (println "완료!")
          (println (str "총 단계: " (get $result :total-steps)))
        )
      )
    )
  )
)
```

### 예제 2: 에러 처리 및 재시도

```lisp
(let [$api-task (make-task "call-api" (fn [$ctx]
  (http-get "https://api.example.com/data")
))]

  ; 재시도 설정
  (set! $api-task (assoc $api-task :retry 3))
  (set! $api-task (assoc $api-task :timeout 5000))

  ; 에러 핸들러
  (set! $api-task (assoc $api-task :on-error (fn [err]
    (println (str "API 호출 실패: " err))
  )))

  ; 성공 핸들러
  (set! $api-task (assoc $api-task :on-success (fn [result]
    (println "API 호출 성공!")
  )))

  (agent-run [$api-task])
)
```

### 예제 3: 상태 추적 및 감시

```lisp
(let [$state (agent-state)]
  (let [$state (agent-state-set $state "processed" 0)]
    (let [$state (agent-state-set $state "total" 1000)]

      ; 진행 상황 추적
      (let [$loop-task (make-task "loop" (fn [$ctx]
        (let [$processed (agent-state-get $state "processed")]
          (do
            (set! $state (agent-state-set $state "processed" (+ $processed 100)))
            (let [$log-entry (log-entry 1 "loop"
              { :processed $processed }
              { :processed (+ $processed 100) }
            )]
              (set! $state (log-append $state $log-entry))
            )
          )
        )
      ))]

        (agent-run [$loop-task])

        ; 최종 상태 확인
        (println (str "처리됨: " (agent-state-get $state "processed")))
        (println (str "로그 수: " (length (get $state :logs))))
      )
    )
  )
)
```

---

## API 레퍼런스

### Task

| 함수 | 설명 |
|------|------|
| `(make-task name action)` | Task 생성 |
| `(task-execute task context)` | Task 실행 |
| `(agent-run task-list)` | 여러 Task 실행 |

### State

| 함수 | 설명 |
|------|------|
| `(agent-state)` | State 초기화 |
| `(agent-state-set state key value)` | 값 설정 |
| `(agent-state-get state key)` | 값 조회 |
| `(agent-log state step message data)` | 로그 추가 |

### Logging

| 함수 | 설명 |
|------|------|
| `(log-entry step task-name input output)` | 로그 엔트리 생성 |
| `(sha256-deterministic data)` | 결정론 해싱 |
| `(log-verify entry)` | 로그 검증 |
| `(log-verify-all log)` | 배치 검증 |
| `(log-replay log)` | 재현 |

### Storage

| 함수 | 설명 |
|------|------|
| `(storage-init config)` | 저장소 초기화 |
| `(storage-save storage table key value)` | 데이터 저장 |
| `(storage-load storage table key)` | 데이터 로드 |
| `(storage-query storage sql)` | 쿼리 실행 |
| `(storage-migrate storage migrations)` | 마이그레이션 |

---

## 핵심 원칙

### 1. **결정론성**
```lisp
(fib 30)  ; → 항상 832040
(sha256-deterministic {:a 1})  ; → 항상 같은 해시
```

### 2. **재현성**
```lisp
; 실행 기록을 저장하면, 같은 입력으로 같은 결과를 얻을 수 있다
(log-verify entry)  ; SHA256 검증
```

### 3. **추적성**
```lisp
; 모든 단계를 로그와 저장소에 기록
(agent-log state step message data)
(storage-save storage table key value)
```

---

## 다음 단계

- [Deterministic Logging Guide](./LOGGING-GUIDE.md) — 로깅 심화
- [Storage Guide](./STORAGE-GUIDE.md) — 저장소 심화
- [Express.fl Demo](./echo-server-demo.fl) — HTTP 서버 예제

---

**🤖 AI 에이전트를 FreeLang으로 안전하게 실행하세요!**
