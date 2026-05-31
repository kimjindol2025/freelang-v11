# FreeLang Event Dispatch Model (S37)

## 원칙

**외부 IO thread는 FL evaluator를 직접 진입할 수 없다.**

FL VM은 단일 진입점(tick)에서만 FL 코드를 실행한다.
IO 이벤트(TCP data, timer, signal 등)는 반드시 event queue를 경유한다.

## 구조

```
IO Layer                 Event Queue              FL VM
──────────────────       ─────────────────        ──────────────────
TCP socket.on('data')  → enqueue(event)     ←──  fl-event-tick drains
Timer callback         → enqueue(event)           handler 호출 (sync)
Signal handler         → enqueue(event)           응답 sock.write()
                                                  다음 tick 대기
```

## 계약

### 1. Enqueue (IO side)
- IO 콜백에서 FL handler를 직접 호출하는 것은 **금지**
- `__flEventQueue.push({ handler, args, sockRef })` 로 등록
- evaluator 참조 접근 불가

### 2. Tick (VM side)
- `(fl-event-tick)` — queue에서 하나 꺼내 handler 실행, 처리 건수 반환
- `(fl-event-drain)` — queue를 완전히 비울 때까지 반복 tick
- `(fl-event-queue-size)` — 현재 queue 길이 조회

### 3. Handler 실행 (tick 내부)
- FL 함수 호출은 tick 경계 안에서만
- handler 반환값 → sock.write() (동기)
- handler throw → `ERR <message>\n` → sock.write() (동기)
- sock이 이미 닫혔으면 응답 생략 (silently drop)

## Failure Semantics (S38 예고)

- handler throw: `[IO-ERR nonfatal handler <msg>]` 형식으로 queue에 error event 재enqueue
- sock write 실패: silently drop (connection already closed)
- queue overflow (> MAX_QUEUE): `[IO-ERR fatal queue-overflow]`
- tick 중 evaluator 재진입: 불가 (단일 tick 진행 보장)

## 왜 callback 직접 실행을 금지하는가

| 문제 | callback 직접 | queue+tick |
|------|--------------|------------|
| evaluator reentry | 발생 가능 | 구조적으로 불가 |
| state corruption | 위험 | tick 경계가 fence |
| ordering guarantee | 불보장 | FIFO 보장 |
| determinism (bootstrap/self) | 깨질 수 있음 | 유지 |
| scheduler 확장 | 어려움 | tick 교체만으로 가능 |

## 주의: 동일 프로세스 tcp-send deadlock

FL 서버가 reactor loop를 돌리는 동안 **같은 프로세스에서** `tcp-send`를 호출하면 deadlock이 발생한다.

```
FL loop: fl-event-drain 대기 중
  → tcp-send (spawnSync) 블록
    → 자식 프로세스: 서버에 연결, 응답 대기
      → 서버: queue에 이벤트 enqueue
        → drain은 tcp-send가 반환해야 실행 가능
          → 교착 (자식 timeout)
```

**이것은 올바른 동작이다.** reactor 모델에서 서버와 클라이언트는 서로 다른 프로세스여야 한다. `tcp-send`는 외부 클라이언트 전용이다.

## 현재 구현 상태 (S37)

- [x] `__flEventQueue` global queue 도입
- [x] TCP data → enqueue (direct call 제거)
- [x] `fl-event-tick` builtin
- [x] `fl-event-drain` builtin
- [x] `fl-event-queue-size` builtin
- [ ] timer/signal IO (S38+)
- [ ] queue overflow cap (S38)
- [ ] error event re-enqueue (S38)
