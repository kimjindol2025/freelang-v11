# Unified Storage — 통합 저장소 가이드

> SQLite, MariaDB, JSON을 하나의 API로 다룹니다.

---

## 핵심 아이디어

### 문제: DB 의존성

```
SQLite만 쓸까? MariaDB?
데이터 포맷이 다르면?
나중에 바꾸려면?
```

### 해결책: 통합 인터페이스

```lisp
; 어떤 DB든 같은 방식으로 사용
(storage-init { :type "sqlite" })
(storage-init { :type "mariadb" })
(storage-init { :type "json" })

; 모두 동일한 API
(storage-save $storage "table" "key" $data)
(storage-load $storage "table" "key")
```

---

## 기본 사용법

### 1. 저장소 초기화

#### SQLite
```lisp
(let [$storage (storage-init {
  :type "sqlite"
  :path "./agent.db"
})]
  (println "✓ SQLite ready"))
```

#### MariaDB
```lisp
(let [$storage (storage-init {
  :type "mariadb"
  :host "localhost"
  :user "root"
  :password "secret"
  :database "agent"
})]
  (println "✓ MariaDB ready"))
```

#### JSON (파일 기반)
```lisp
(let [$storage (storage-init {
  :type "json"
  :path "./data"
})]
  (println "✓ JSON ready"))
```

### 2. 데이터 저장

```lisp
; 모든 DB에 동일한 방식
(storage-save $storage "tasks" "task-1" {
  :name "Fetch Users"
  :status "done"
  :timestamp 1704067200000
})

(storage-save $storage "agent-state" "session-abc" {
  :counter 42
  :logs 100
})
```

### 3. 데이터 로드

```lisp
(let [$task (storage-load $storage "tasks" "task-1")]
  (println (get $task :name)))  ; "Fetch Users"

(let [$state (storage-load $storage "agent-state" "session-abc")]
  (println (get $state :counter)))  ; 42
```

### 4. 쿼리 실행

#### SQLite
```lisp
(let [$results (storage-query $storage
  "SELECT * FROM tasks WHERE status = 'done'")]
  (println $results))
```

#### MariaDB
```lisp
(let [$results (storage-query $storage
  "SELECT * FROM tasks WHERE created_at > ? ORDER BY created_at DESC")]
  (println $results))
```

---

## 고급 패턴

### 패턴 1: Agent State 저장

```lisp
(load "src/agent-dsl.fl")
(load "src/storage-unified.fl")

(let [$state (agent-state)]
  (let [$storage (storage-init { :type "sqlite" })]
    (do
      ; 상태 업데이트
      (set! $state (agent-state-set $state "step" 1))
      (set! $state (agent-state-set $state "status" "running"))
      
      ; 저장
      (storage-save $storage "agent-states" 
        (get $state :id) $state)
      
      ; 나중에 로드
      (let [$loaded (storage-load $storage "agent-states"
        (get $state :id))]
        (println loaded))
    )
  )
)
```

### 패턴 2: Task 결과 저장

```lisp
(let [$storage (storage-init { :type "mariadb" })]
  (do
    ; Task 실행
    (let [$result (agent-run [$task1 $task2])]
      (do
        ; 결과 저장
        (map (fn [item]
          (let [
            [$task-name (get item 0)]
            [$task-result (get item 1)]
          ]
            (storage-save $storage "task-results"
              $task-name $task-result)
          )
        ) (pairs $result))
        
        (println "✓ 모든 결과 저장됨")
      )
    )
  )
)
```

### 패턴 3: 마이그레이션

```lisp
(let [$storage (storage-init { :type "sqlite" })]
  (let [$migrations [
    {
      :name "create_tasks_table"
      :sql "CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )"
    }
    {
      :name "create_logs_table"
      :sql "CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        message TEXT,
        created_at TIMESTAMP
      )"
    }
  ]]
    (storage-migrate $storage $migrations)
  )
)
```

### 패턴 4: 트랜잭션

```lisp
(let [$storage (storage-init { :type "mariadb" })]
  (storage-transaction $storage (fn []
    (do
      ; 여러 저장 작업
      (storage-save $storage "t1" "k1" {...})
      (storage-save $storage "t2" "k2" {...})
      (storage-save $storage "t3" "k3" {...})
      ; 모두 성공하거나 모두 실패 (원자성 보증)
      { :success true }
    )
  ))
)
```

---

## 백엔드 비교

| 기능 | SQLite | MariaDB | JSON |
|------|--------|---------|------|
| **설치** | 내장 | 별도 설치 | 없음 |
| **확장성** | 중간 | 높음 | 낮음 |
| **쿼리** | SQL | SQL | 없음 |
| **성능** | 빠름 | 매우 빠름 | 느림 |
| **사용례** | 개발/테스트 | 프로덕션 | 소규모 |

### 선택 가이드

```
개발 중      → SQLite
프로덕션     → MariaDB
임시 저장    → JSON
```

---

## 실제 예제

### 예제 1: 완전한 Agent Workflow

```lisp
(load "src/agent-dsl.fl")
(load "src/logging-deterministic.fl")
(load "src/storage-unified.fl")

; 초기화
(let [$state (agent-state)]
  (let [$storage (storage-init { :type "sqlite" })]
    (let [$log (execution-log)]

      ; Task 정의
      (let [$fetch-task (make-task "fetch" (fn [$ctx]
        (let [
          [$data [
            { :id 1 :value 100 }
            { :id 2 :value 200 }
          ]]
          [$entry (log-entry 1 "fetch" {} $data)]
        ] (do
          (set! $log (log-append $log $entry))
          (storage-save $storage "logs" "fetch" $entry)
          $data
        ))
      ))]

        ; Task 실행
        (let [$result (agent-run [$fetch-task])]
          (do
            ; 최종 상태 저장
            (storage-save $storage "results" "final" {
              :status (get $result :status)
              :timestamp (now_ms)
            })
            
            ; 로그 검증
            (let [$verify (log-verify-all $log)]
              (println (str "검증: " (get $verify :all-valid)))
            )
          )
        )
      )
    )
  )
)
```

### 예제 2: 배치 처리

```lisp
(let [$storage (storage-init { :type "mariadb" })]
  (let [$batch-id (str "batch_" (now_ms))]
    (do
      ; 배치 시작
      (storage-save $storage "batches" $batch-id {
        :status "running"
        :started (now_ms)
      })
      
      ; 아이템 처리
      (map (fn [item]
        (storage-save $storage "batch-items" 
          (str $batch-id "_" (get item :id))
          (assoc item :processed true)
        )
      ) items)
      
      ; 배치 완료
      (storage-save $storage "batches" $batch-id {
        :status "done"
        :completed (now_ms)
      })
      
      (println "✓ 배치 완료")
    )
  )
)
```

### 예제 3: 세션 추적

```lisp
(let [$storage (storage-init { :type "sqlite" })]
  (let [$session-id (generate-id)]
    (do
      ; 세션 시작
      (storage-save $storage "sessions" $session-id {
        :started (now_ms)
        :status "active"
      })
      
      ; 세션 중간 상태 저장
      (let [$step 1]
        (storage-save $storage "session-steps"
          (str $session-id "_" $step) {
          :step $step
          :progress 25
        })
      )
      
      ; 세션 종료
      (storage-save $storage "sessions" $session-id {
        :started (now_ms)
        :completed (now_ms)
        :status "completed"
      })
    )
  )
)
```

---

## API 레퍼런스

| 함수 | 설명 |
|------|------|
| `(storage-init config)` | 저장소 초기화 |
| `(storage-save storage table key value)` | 데이터 저장 |
| `(storage-load storage table key)` | 데이터 로드 |
| `(storage-query storage sql)` | SQL 쿼리 실행 |
| `(storage-migrate storage migrations)` | 마이그레이션 |
| `(storage-transaction storage fn)` | 트랜잭션 |
| `(storage-status storage)` | 상태 확인 |

---

## 베스트 프랙티스

### ✅ 추천

```lisp
; 1. 백엔드 선택 명확히
(storage-init { :type "mariadb" :host "..." })

; 2. 에러 처리
(try
  (storage-save $storage "t" "k" $data)
  (catch err (println (str "저장 실패: " err)))
)

; 3. 주기적 백업
(storage-query $storage "BACKUP ...")

; 4. 쿼리 최적화
(storage-query $storage "SELECT * FROM t WHERE id = ? LIMIT 1")
```

### ❌ 피해야 할 것

```lisp
; X 백엔드 미지정
(storage-init {})

; X 민감 정보 저장
(storage-save $storage "users" "id" { :password "..." })

; X 무한 쿼리
(storage-query $storage "SELECT * FROM large_table")

; X 마이그레이션 없이 스키마 변경
(storage-save $storage "new_table" ...)  ; 테이블 없음!
```

---

## FAQ

### Q: SQLite vs MariaDB?
**A**: 개발/테스트 → SQLite, 프로덕션 → MariaDB

### Q: JSON 백엔드는 언제?
**A**: 임시 저장, 작은 데이터, 빠른 프로토타입

### Q: 트랜잭션이 필요한가?
**A**: 여러 테이블에 동시 저장할 때 필수

### Q: 성능은?
**A**: MariaDB > SQLite > JSON 순

---

**💾 AI 에이전트 데이터를 안전하게 저장하세요!**
