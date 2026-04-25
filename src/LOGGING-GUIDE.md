# Deterministic Logging — 결정론 로깅 가이드

> SHA256 기반 재현 가능한 로깅으로 AI 에이전트 실행을 검증합니다.

---

## 핵심 아이디어

### 문제: 불안정한 AI 실행

```
같은 입력 → 다른 결과?
          → 다른 실행 시간?
          → 디버깅 불가능?
```

### 해결책: 결정론 로깅

```
같은 입력 → 같은 SHA256 해시
         → 같은 결과
         → 재현 가능
         → 안전한 AI 배포
```

---

## 기본 사용법

### 1단계: 로그 엔트리 생성

```lisp
(load "src/logging-deterministic.fl")

(let [$entry (log-entry
  1                           ; step
  "fetch-users"               ; task name
  { :url "api.example.com" }  ; input
  [{ :id 1 } { :id 2 }]       ; output
)]
  (println $entry))
```

**생성된 엔트리**:
```
{
  :step 1
  :task-name "fetch-users"
  :timestamp 1704067200000
  :input { :url "api.example.com" }
  :output [{ :id 1 } { :id 2 }]
  :input-hash "abc123..."    ; SHA256(input)
  :output-hash "def456..."   ; SHA256(output)
}
```

### 2단계: 로그 검증

```lisp
(let [$verify (log-verify $entry)]
  (println {
    :valid (get $verify :valid)
    :input-ok (get $verify :input-verified)
    :output-ok (get $verify :output-verified)
  }))
```

**출력**:
```
{
  :valid true
  :input-ok true
  :output-ok true
}
```

---

## 고급: 배치 검증

### 로그 수집

```lisp
(let [$log (execution-log)]
  (let [$log (log-append $log $entry1)]
    (let [$log (log-append $log $entry2)]
      (let [$log (log-append $log $entry3)]
        (println $log)))))
```

**로그 구조**:
```
{
  :id "sess_1704067200000"
  :created-at 1704067200000
  :entries [
    { :step 1 :task-name "fetch" ... }
    { :step 2 :task-name "process" ... }
    { :step 3 :task-name "save" ... }
  ]
}
```

### 전체 검증

```lisp
(let [$results (log-verify-all $log)]
  (println {
    :total (get $results :total-entries)
    :all-valid (get $results :all-valid)
    :individual (get $results :results)
  }))
```

**출력**:
```
{
  :total 3
  :all-valid true
  :individual [
    { :valid true :input-verified true :output-verified true }
    { :valid true :input-verified true :output-verified true }
    { :valid true :input-verified true :output-verified true }
  ]
}
```

---

## 재현 (Replay)

### 로그 재현

```lisp
(let [$replay (log-replay $log)]
  (println {
    :total-steps (get $replay :total-steps)
    :results (get $replay :replay-results)
  }))
```

**출력**:
```
{
  :total-steps 3
  :replay-results [
    {
      :step 1
      :task-name "fetch"
      :input-hash "abc123..."
      :output-hash "def456..."
      :verified true
    }
    ...
  ]
}
```

---

## 실제 예제

### 예제 1: Task 실행 로깅

```lisp
(load "src/agent-dsl.fl")
(load "src/logging-deterministic.fl")

(let [$state (agent-state)]
  (let [$log (execution-log)]

    ; Task 정의
    (let [$task (make-task "multiply" (fn [$ctx]
      (let [$input { :a 10 :b 20 }]
        (let [$output { :result (* 10 20) }]
          (do
            ; 로그 추가
            (let [$entry (log-entry 1 "multiply" $input $output)]
              (set! $log (log-append $log $entry))
            )
            $output
          )
        )
      )
    ))]

      ; 실행
      (let [$result (agent-run [$task])]
        (do
          (println (str "실행 완료: " (get $result :status)))
          (println (str "로그 엔트리: " (length (get $log :entries))))
          
          ; 검증
          (let [$verification (log-verify-all $log)]
            (println (str "모두 검증됨: " (get $verification :all-valid)))
          )
        )
      )
    )
  )
)
```

### 예제 2: HTTP 요청 로깅

```lisp
(let [$entry (log-entry
  1
  "fetch-api"
  { :method "GET" :url "https://api.example.com/users" }
  (json-parse (http-get "https://api.example.com/users"))
)]
  (let [$verify (log-verify $entry)]
    (println (str "HTTP 요청 검증: " (get $verify :valid)))
  )
)
```

### 예제 3: 에러 추적

```lisp
(let [$error-entry (log-entry
  1
  "failed-task"
  { :input "..." }
  { :error "Connection timeout" }
)]
  (let [$verify (log-verify $error-entry)]
    (if (get $verify :valid)
      (println "에러도 재현 가능하게 기록됨")
      (println "검증 실패")
    )
  )
)
```

---

## 검증 알고리즘

### SHA256 결정론성

```
입력 (JSON 정규화)
  ↓
JSON String 변환
  ↓
SHA256 해시 계산
  ↓
저장된 해시와 비교
  ↓
✓ 일치 → 검증 성공
✗ 불일치 → 검증 실패
```

### 예시

```lisp
; 입력
(let [$data { :name "Alice" :age 30 }]
  (let [$hash1 (sha256-deterministic $data)]
    (let [$hash2 (sha256-deterministic { :name "Alice" :age 30 })]
      (println (= $hash1 $hash2))  ; true
    )
  )
)

; 다른 입력
(let [$data1 { :name "Alice" }]
  (let [$data2 { :name "Bob" }]
    (let [$hash1 (sha256-deterministic $data1)]
      (let [$hash2 (sha256-deterministic $data2)]
        (println (= $hash1 $hash2))  ; false
      )
    )
  )
)
```

---

## 베스트 프랙티스

### ✅ 추천

```lisp
; 1. 모든 Task 실행을 로깅
(let [$entry (log-entry $step $name $input $output)]
  (set! $log (log-append $log $entry))
)

; 2. 주기적으로 검증
(log-verify-all $log)

; 3. 로그를 저장소에 저장
(storage-save $storage "logs" $session-id $log)
```

### ❌ 피해야 할 것

```lisp
; X 로깅하지 않음
(agent-run [$task])  ; 로그 기록 없음

; X 부분 검증
(log-verify $entry)  ; 전체 배치 검증 필요

; X 로그 저장 안 함
; → 나중에 재현 불가능
```

---

## API 레퍼런스

| 함수 | 입력 | 출력 |
|------|------|------|
| `(log-entry step name input output)` | 4개 | Entry |
| `(sha256-deterministic data)` | JSON | Hash |
| `(log-verify entry)` | Entry | {valid, ...} |
| `(execution-log)` | 없음 | Log |
| `(log-append log entry)` | Log, Entry | Log |
| `(log-verify-all log)` | Log | {total, valid, results} |
| `(log-replay log)` | Log | {steps, results} |

---

## FAQ

### Q: 왜 SHA256인가?
**A**: 빠르고, 결정론적이고, 널리 지원됩니다. AI 배포에 충분합니다.

### Q: 민감한 데이터는?
**A**: 로그에 민감 정보를 포함하지 마세요. 대신 해시만 저장하세요.

```lisp
; 나쁜 예
(log-entry 1 "login" { :password "secret" } {...})

; 좋은 예
(log-entry 1 "login" { :user-id "abc" } {...})
```

### Q: 로그 크기가 크면?
**A**: 저장소에 분산 저장하고, 필요시만 로드하세요.

```lisp
(storage-save $storage "logs" (str "batch-" $batch-id) $log)
(storage-load $storage "logs" (str "batch-" $batch-id))
```

---

**🔒 AI 에이전트를 SHA256으로 안전하게 검증하세요!**
