# FL-Gateway 설계 명세

**날짜**: 2026-05-16  
**상태**: 승인됨  
**저장소**: gogs.dclub.kr/kim/fl-gateway (신규)

---

## 목표

FreeLang v11 TCP reactor 위에 L7 라우팅을 얹은 순수 FreeLang 리버스 프록시.
Nginx/Caddy 같은 외부 프록시 없이 단일 포트(30000)에서 내부 서비스 전체를 통제한다.

---

## 아키텍처

```
외부 클라이언트
      ↓ TCP :30000
┌─────────────────────────────────┐
│          FL-Gateway             │
│                                 │
│  TCP Acceptor (tcp-server)      │
│    → Header Accumulator         │  partial packet 대응
│    → HTTP Header Parser         │  \r\n\r\n 완성 후 파싱
│    → Route Matcher              │  @route-table snapshot
│    → Upstream TCP Connector     │
│    → Event Pipe Relay           │  blocking relay 금지
│                                 │
│  Health Checker (fl-interval)   │  active + passive
│  Route Table (atom)             │  runtime mutable
└─────────────────────────────────┘
      ↓ TCP :30367 / :30100 / ...
  내부 서비스들
```

---

## 핵심 원칙

1. **HTTP 서버가 아니다** — TCP reactor 위의 L7 라우팅 엔진
2. **Blocking relay 금지** — 모든 데이터 전달은 event queue 경유
3. **Route table은 atomic snapshot** — 라우팅 중 변경 안전
4. **Connection lifecycle state machine** — 상태 기반 timeout/cleanup
5. **Header는 완성 후 라우팅** — partial packet 중 upstream 연결 금지

---

## 파일 구조

```
fl-gateway/
  config.fl   — 포트·라우팅 규칙·upstream 정의
  health.fl   — active/passive 헬스체크, upstream 상태
  router.fl   — domain+path 매칭, snapshot 라우팅
  proxy.fl    — connection 상태 머신, event pipe relay
  server.fl   — TCP acceptor, reactor loop 진입점
```

---

## 데이터 구조

### Connection 객체
```lisp
{:id              "conn_123"
 :state           :reading-header   ; 상태 머신 현재 상태
 :client-sock     <sock>
 :upstream-sock   nil               ; RELAYING 이후 채워짐
 :buffer          ""                ; header accumulate buffer
 :header-complete false
 :upstream        nil               ; resolved upstream 객체
 :created-at      1747123456}
```

### Connection 상태 머신
```
ACCEPTED
  ↓ TCP data 수신
READING_HEADER          ← 5초 초과 시 CLOSING (slow loris 방어)
  ↓ \r\n\r\n 감지
ROUTED
  ↓ upstream TCP connect
CONNECTING_UPSTREAM     ← 3초 초과 시 CLOSING
  ↓ connect 성공
RELAYING
  ↓ 어느 쪽이든 close/error
CLOSING
  ↓
CLOSED
```

### Resolved Upstream 객체
```lisp
{:host     "127.0.0.1"
 :port     30260
 :protocol :http}   ; 향후 :ws :grpc :unix 확장 가능
```

### Route Rule
```lisp
{:domain      "tasks.dclub.kr"   ; nil이면 path-only 매칭
 :path-prefix "/"
 :upstream-id "tasks"}
```

### Upstream 상태
```lisp
{:id         "tasks"
 :host       "127.0.0.1"
 :port       30367
 :protocol   :http
 :status     :up               ; :up | :down
 :fail-count 0
 :last-check 1747123456}
```

---

## Config 형식 (`config.fl`)

```lisp
(define GATEWAY-PORT 30000)
(define HEALTH-INTERVAL-MS 30000)

(define UPSTREAM-TABLE [
  {:id "tasks"   :host "127.0.0.1" :port 30367 :protocol :http}
  {:id "fishing" :host "127.0.0.1" :port 30100 :protocol :http}
  {:id "blog"    :host "127.0.0.1" :port 30080 :protocol :http}
])

(define ROUTE-RULES [
  {:domain "tasks.dclub.kr"   :path-prefix "/" :upstream-id "tasks"}
  {:domain "fishing.dclub.kr" :path-prefix "/" :upstream-id "fishing"}
  {:domain nil :path-prefix "/api/tasks"   :upstream-id "tasks"}
  {:domain nil :path-prefix "/api/fishing" :upstream-id "fishing"}
])
```

---

## 라우팅 로직

**매칭 우선순위**: domain+path > domain-only > path-only

```lisp
; atomic snapshot으로 라우팅
(let [routes @route-table
      upstreams @upstream-table]
  (match-route routes upstreams host path))
```

**매칭 실패**: 404 응답 후 CLOSING  
**upstream :down**: 503 응답 후 CLOSING

---

## Relay (Event Pipe)

```
client-sock data → enqueue {:type :client→upstream :conn-id :chunk}
  → tick: upstream-sock.write(chunk)

upstream-sock data → enqueue {:type :upstream→client :conn-id :chunk}
  → tick: client-sock.write(chunk)
```

모든 relay는 FL reactor event queue 경유. blocking I/O 금지.

---

## Health Checker

**Active check** (HEALTH-INTERVAL-MS마다):
- 각 upstream에 TCP connect 시도
- 성공 → :up, fail-count 초기화
- 실패 → fail-count +1

**Passive signal** (proxy.fl에서 감지):
- upstream connect 실패 → fail-count +1
- relay 중 upstream reset → fail-count +1
- 응답 timeout → fail-count +1

**Down 판정**: fail-count ≥ 3 → :down 마킹, route에서 자동 제외

---

## 에러 처리

| 상황 | 동작 |
|------|------|
| Header 파싱 실패 | 400 응답 → CLOSING |
| Route 없음 | 404 응답 → CLOSING |
| Upstream :down | 503 응답 → CLOSING |
| Upstream connect 타임아웃 (3초) | 502 응답 → CLOSING |
| Header accumulate 타임아웃 (5초) | 408 응답 → CLOSING |
| Relay 중 upstream reset | CLOSING, passive fail +1 |

---

## 범위 외 (초기 버전)

- IP 화이트리스트 (이후 추가)
- TLS termination
- 요청/응답 로깅 (구조만 열어둠)
- WebSocket/gRPC (protocol 필드로 확장 가능하게 준비만)
- Load balancing (upstream 1개/rule)
