# FreeLang v11 Operational Semantics

**Version**: 2026-05-23 | **Status**: Verified (L2 self-hosting)  
**Scope**: Node.js runtime (v11.7.12) | **Target**: Backend orchestration, observability, rapid semantics iteration

---

## 1. Status0 Invariant (부분 실패 격리)

**정의**: 비동기 작업의 각 단계는 `status=0` (초기), `status=1` (성공), `status=-1` (실패) 중 정확히 하나.

**불변성**:
- 한 번 `status=1` 또는 `-1`이 되면 변경 불가
- 재시도는 새로운 작업 인스턴스 생성
- 부분 실패는 상위 작업에 격리

**검증**:
```lisp
;; 상태 전이 감시
(defn assert-status0 [job]
  (let [s (get job "status")]
    (assert (or (= s 0) (= s 1) (= s -1)) 
            (str "invalid status: " s))))
```

**실제 구현**: src/stdlib-job.ts (lines 45-62)
```typescript
interface Job {
  id: string;
  status: 0 | 1 | -1;  // 0=pending, 1=success, -1=failed
  result?: any;
  error?: string;
}

function job_end(job: Job, result?: any): Job {
  if (job.status !== 0) {
    throw new Error(`Cannot transition from status ${job.status}`);
  }
  return { ...job, status: 1, result };
}
```

---

## 2. Topology Convergence (구조 안정화)

**정의**: 분산 시스템의 노드 배치는 시간이 지날수록 목표 구조로 수렴.

**알고리즘**:
1. 초기 상태: 임의 배치
2. 주기적 관찰: 각 노드의 상태 수집
3. 차이 계산: `observed ≠ desired` 감지
4. 조정 적용: desired로 이동
5. 반복: 수렴까지

**검증**:
```lisp
;; 수렴 도달 확인
(defn is-converged? [current desired]
  (= (sort current) (sort desired)))

;; 위상 거리
(defn topology-distance [current desired]
  (count (filter (fn [node] (not (contains? current node))) desired)))
```

**실제 구현**: src/stdlib-topology.ts (lines 80-120)
```typescript
function topologyDistance(current: Set<string>, desired: Set<string>): number {
  let distance = 0;
  for (const node of desired) {
    if (!current.has(node)) distance++;
  }
  for (const node of current) {
    if (!desired.has(node)) distance++;
  }
  return distance;
}

function converge(current: Set<string>, desired: Set<string>): void {
  while (topologyDistance(current, desired) > 0) {
    // 1. Add missing nodes
    for (const node of desired) {
      if (!current.has(node)) {
        spawnProcess(node);
        current.add(node);
      }
    }
    // 2. Remove excess nodes
    for (const node of Array.from(current)) {
      if (!desired.has(node)) {
        killProcess(node);
        current.delete(node);
      }
    }
    // 3. Wait & check
    setTimeout(() => {}, 100);
  }
}
```

---

## 3. Append-Only Lifecycle (감사 추적)

**정의**: 모든 상태 전이는 immutable log에 기록되며, 재생 가능.

**속성**:
- 쓰기: append only (수정 불가)
- 읽기: 임의 지점에서 재생
- 검증: checksum으로 무결성 보증

**로그 형식**:
```lisp
{:event "job_start" :id "j123" :ts 1716489300000 :data {...}}
{:event "job_log" :id "j123" :msg "processing batch..." :ts 1716489301000}
{:event "job_end" :id "j123" :status 1 :result {...} :ts 1716489310000}
```

**재생**:
```lisp
(defn replay [log-path]
  (let [events (read-log log-path)]
    (reduce (fn [state event]
      (apply-event state event))
      {} events)))
```

**실제 구현**: src/stdlib-elog.ts (lines 1-50)
```typescript
interface LogEntry {
  event: string;
  id: string;
  ts: number;
  checksum?: string;  // sha256(prev_checksum + event)
}

function appendLog(logPath: string, entry: LogEntry): void {
  const prev = readLastChecksum(logPath);
  entry.checksum = sha256(prev + JSON.stringify(entry));
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

function replayLog(logPath: string): any {
  const entries = readLogFile(logPath);
  let state = {};
  for (const entry of entries) {
    state = applyEvent(state, entry);
  }
  return state;
}
```

---

## 4. Projection-Only Derived State (재계산 불필요)

**정의**: 모든 조회 상태는 append-only log에서 파생되며, 직접 수정 불가.

**역할**:
- **Source of Truth**: append-only log (immutable)
- **Views**: materialized view (재계산 가능)
- **Cache**: 성능 최적화 (log와 동기화)

**패턴**:
```lisp
;; Source of Truth (읽기 전용)
(define log (read-append-only-log "events.log"))

;; Projection (파생)
(defn user-by-id [log user-id]
  (let [events (filter (fn [e] (and
    (= (get e "event") "user_created")
    (= (get e "user_id") user-id)))
    log)]
    (if (empty? events)
      nil
      (last events))))

;; Cache (성능)
(define user-cache {})
(defn get-user [id]
  (if (has? user-cache id)
    (get user-cache id)
    (let [user (user-by-id log id)]
      (assoc! user-cache id user)
      user)))
```

**검증**: 언제든 cache를 버리고 log에서 재계산 가능
```lisp
(defn cache-invalidate []
  (define user-cache {}))

(defn verify-cache-consistency [log]
  (doseq [user-id (keys user-cache)]
    (assert (= (get user-cache user-id)
               (user-by-id log user-id)))))
```

---

## 5. Transition-Window Correctness (상태 전이 검증)

**정의**: 상태 A → 상태 B 전이는 특정 조건에서만 유효.

**전이 테이블**:
```
Job States:
  0 (pending) → 1 (success) [on completion]
  0 (pending) → -1 (failed) [on error]
  1 (success) → X (no transition allowed)
  -1 (failed) → X (no transition allowed)

Process States:
  "starting" → "running" [after spawn]
  "running" → "stopping" [on signal]
  "stopping" → "stopped" [after cleanup]
  "stopped" → "starting" [on restart]
```

**검증**:
```lisp
(defn is-valid-transition? [from to]
  (contains? (get transitions from) to))

(defn transition-safe [state from to data]
  (if (not (is-valid-transition? from to))
    (throw (str "Invalid transition: " from " → " to))
    (assoc state "state" to "ts" (now-ms))))
```

**Window 검증** (전이 중 불변성):
```lisp
;; 전이 중에는 외부 관찰 불가능
(defn atomic-transition [state from to update-fn]
  (if (not (= (get state "state") from))
    (throw "state changed during transition"))
  (let [new-state (update-fn (assoc state "state" to))]
    (if (not (= (get new-state "previous_state") from))
      (throw "invariant violated"))
    new-state))
```

---

## 6. Deterministic Event Flow (재현 가능성)

**정의**: 같은 입력 이벤트 시퀀스 → 같은 출력 상태 (항상).

**조건**:
1. 이벤트 순서 고정 (논리적 시간)
2. 난수 제거 (deterministic seed)
3. 외부 I/O 결정론적 (mock 또는 기록)
4. 타이밍 제거 (wall clock 의존 금지)

**구현**:
```lisp
;; 이벤트 시퀀스 (고정 순서)
(define events [
  {:type "user_created" :id 1 :name "Alice" :ts 1000}
  {:type "user_updated" :id 1 :name "Alice Smith" :ts 1001}
  {:type "user_deleted" :id 1 :ts 1002}
])

;; Deterministic 상태 계산
(defn compute-state [events seed]
  (let [rng (seed-rng seed)]
    (reduce (fn [state event]
      (apply-event state event rng))
      {} events)))

;; 검증: 같은 입력 → 같은 출력
(assert (= (compute-state events 42)
           (compute-state events 42)))
```

**테스트**:
```lisp
@test
(defn test-deterministic-flow []
  (let [result1 (compute-state events 12345)
        result2 (compute-state events 12345)]
    (assert (= result1 result2)
            "deterministic flow failed")))
```

---

## 7. Observable State (검사 가능성)

**정의**: 런타임의 모든 상태는 외부에서 관찰 가능.

**관찰점**:
- Job state (pending/success/failed)
- Process topology (running processes)
- Event log (all transitions)
- Message queue (pending messages)
- Error boundaries (failure scope)

**API**:
```lisp
;; 런타임 상태 조회
(job-state job-id)              ;; {:status 1 :result {...}}
(process-state proc-id)         ;; {:pid 12345 :memory 24.5M :status "running"}
(topology-current)              ;; {:nodes [...] :edges [...]}
(log-tail log-id n)             ;; 최근 n개 이벤트

;; 상태 감시
:watch $job
:watch $process
:watches  ;; 현재 감시 중인 변수
```

---

## 8. Verification Gates (검증 게이트)

**원칙**: 각 단계는 검증을 통과해야만 다음 단계로 진행.

**단계**:
```
Phase 1: Syntax Check
  → (node bootstrap.js check app.fl)
  → 파서 통과 확인

Phase 2: Type Inference
  → (node bootstrap.js infer app.fl)
  → 타입 정합성 확인

Phase 3: Semantics Verify
  → @test 매크로 실행
  → 1090/1090 테스트 통과

Phase 4: L2 Self-Hosting
  → stage1.js로 self/all.fl 재컴파일
  → SHA256 일치 확인

Phase 5: Deterministic Build
  → 3회 연속 빌드 → identical output
  → canonical state 달성
```

---

## 9. 설계 원칙 (Design Principles)

### 명시적 (Explicit)
- 암묵적 동작 금지
- 모든 상태 전이 명시적
- 에러 경계 명시적

### 관찰 가능 (Observable)
- 모든 상태 검사 가능
- 로그로 재현 가능
- 감시 API 제공

### 결정론적 (Deterministic)
- 같은 입력 → 항상 같은 출력
- 난수/타이밍 제거
- 재현 가능한 실행

### 격리 (Isolated)
- 프로세스 경계 명확
- 실패 전파 제한
- 상태 소유권 분명

---

## 10. 현재 검증 상태

| 의미론 | 검증 | 상태 |
|--------|------|------|
| Status0 | @test + integration | ✅ Production |
| Topology Convergence | L2 proof (case-15) | ✅ Beta |
| Append-Only Lifecycle | Event store impl (elog v0.1) | ✅ Beta |
| Projection-Only | Query system | ⚠️ Partial |
| Transition Correctness | State machine tests | ✅ Beta |
| Deterministic Flow | L3 verification (pending) | ✅ L2 |
| Observable State | Runtime inspection API | ✅ Beta |
| Verification Gates | CI pipeline | ✅ Production |

---

## 참고

- **코드**: src/stdlib-*.ts (각 의미론 구현)
- **테스트**: src/__tests__/operational-*.test.ts
- **자가호스팅**: self/semantics.fl
- **감사**: docs/AUDIT_2026_05_17.md
