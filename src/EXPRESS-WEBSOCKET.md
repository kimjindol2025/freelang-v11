# Express.fl WebSocket 가이드

FreeLang v11의 **네이티브 WebSocket** (RFC 6455) 구현을 Express.fl 래퍼로 간편하게 사용합니다.

---

## 📡 WebSocket 기본

### 서버 시작

```lisp
(ws-start 3000)
;; 🌐 WebSocket 서버 시작 → ws://localhost:3000
```

### 클라이언트 연결 감지

```lisp
;; 클라이언트 연결
(ws_on_connect_fn "on-connect-handler")

[FUNC on-connect-handler :params [$req]
  :body (do
    (log-info "✅ 클라이언트 연결")
    nil)
]
```

### 메시지 수신

```lisp
(ws_on_message_fn "on-message-handler")

[FUNC on-message-handler :params [$req]
  :body (let [
    msg (server_req_body $req)
    data (json_parse $msg)
    text (get $data "text")
  ]
    (do
      (println (str "💬 메시지: " text))
      nil))
]
```

### 연결 종료

```lisp
(ws_on_close_fn "on-close-handler")

[FUNC on-close-handler :params [$req]
  :body (do
    (log-info "❌ 클라이언트 종료")
    nil)
]
```

---

## 📤 메시지 전송

### 모든 클라이언트에게 브로드캐스트

```lisp
;; 문자열
(ws-send-all "Hello everyone!")

;; JSON
(ws-send-json-all {
  :type "notification"
  :message "누군가 입장했습니다"
  :timestamp (now_iso)
})
```

### 특정 클라이언트에게 전송

```lisp
;; 문자열
(ws-send-to "client-id-123" "Hello specific client")

;; JSON
(ws-send-json-to "client-id-123" {
  :type "private"
  :text "개인 메시지입니다"
})
```

### 연결 종료

```lisp
(ws-close-conn "client-id-123" 1000)
;; 코드 1000: 정상 종료
;; 코드 1001: Going Away
;; 코드 1002: Protocol Error
;; 코드 1003: Unsupported Data
;; 코드 1008: Policy Violation
```

---

## 📊 상태 조회

### 온라인 클라이언트 수

```lisp
(let [count (ws-client-count)]
  (println (str "온라인: " count "명")))
```

### 모든 클라이언트 ID

```lisp
(let [clients (ws-client-list)]
  (println clients))
;; → ["client-1", "client-2", "client-3"]
```

---

## 💬 실전 예제: 채팅

### 상태 관리

```lisp
(define *users* {})        ;; {"client-id": "username"}
(define *messages* [])      ;; [{from, text, timestamp}]
```

### 핸들러 구현

```lisp
[FUNC on-connect :params [$req]
  :body (let [id (server_req_id)]
    (ws-send-json-to id {
      :type "welcome"
      :message "채팅방 입장"
      :online (ws-client-count)
    }))
]

[FUNC on-message :params [$req]
  :body (let [
    data (json_parse (server_req_body $req))
    username (get $data "username")
    text (get $data "text")
  ]
    (do
      ;; 사용자 등록
      (set! *users* (json_set *users* (server_req_id) username))

      ;; 메시지 저장
      (set! *messages* (append *messages* [{
        :from username
        :text text
        :timestamp (now_iso)
      }]))

      ;; 브로드캐스트
      (ws-send-json-all {
        :type "message"
        :from username
        :text text
        :timestamp (now_iso)
      })))
]

[FUNC on-close :params [$req]
  :body (do
    (set! *users* (json_del *users* (server_req_id)))
    (ws-send-json-all {
      :type "user_left"
      :online (ws-client-count)
    }))
]
```

---

## 🔄 HTTP + WebSocket 혼합

### HTTP API로 기존 메시지 조회

```lisp
[FUNC api-messages :params [$req]
  :body (res-json {
    :total (len *messages*)
    :messages *messages*
  })
]

(app-get "/api/messages" "api-messages")
```

### 클라이언트 예제

```html
<script>
  const ws = new WebSocket("ws://localhost:3000");
  
  // 연결
  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: "join",
      username: "홍길동",
      text: "안녕하세요"
    }));
  };
  
  // 메시지 수신
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    console.log(`${msg.from}: ${msg.text}`);
  };
  
  // 종료
  ws.onclose = () => console.log("연결 끊김");
</script>
```

---

## ⚡ 성능 팁

### 배치 브로드캐스트 피하기

```lisp
;; ❌ 느림: N개 메시지마다 브로드캐스트
(map (fn [msg] (ws-send-all $msg)) messages)

;; ✅ 빠름: 한 번에 전송
(ws-send-json-all {
  :type "batch"
  :messages messages
})
```

### 캐시와 함께 사용

```lisp
;; 최근 100개 메시지 캐시
(cache_set "recent_messages" *messages* 3600000)

;; 조회
[FUNC api-recent :params [$req]
  :body (let [cached (cache_get "recent_messages")]
    (res-json { :messages $cached }))
]
```

---

## 🔐 인증 + WebSocket

### JWT 토큰 검증

```lisp
[FUNC on-connect :params [$req]
  :body (let [
    token (server_req_header $req "Authorization")
    payload (auth_jwt_verify (str_split token " " 2) "secret")
  ]
    (if payload
      (do
        (log-info (str "✅ 인증됨: " (get $payload "username")))
        nil)
      (do
        (log-error "❌ 인증 실패")
        (ws-close-conn (server_req_id) 1008)))
  )
]
```

---

## 📈 확장 예제

### 멀티 채팅방

```lisp
(define *rooms* {})  ;; {"room_id": [messages]}

[FUNC on-message :params [$req]
  :body (let [
    room (get (json_parse (server_req_body $req)) "room")
    msg (get (json_parse (server_req_body $req)) "text")
  ]
    (do
      ;; 방별 저장
      (set! *rooms* (json_set *rooms* room
        (append (get *rooms* room []) [msg])))
      
      ;; 방의 클라이언트들에게만 전송 (tag를 사용한 필터링)
      (ws-send-json-all {
        :room room
        :message msg
      })))
]
```

### 사용자 상태 동기화

```lisp
(define *presence* {})  ;; {"client_id": {name, status, location}}

[FUNC update-presence :params [$req]
  :body (let [
    id (server_req_id)
    data (json_parse (server_req_body $req))
  ]
    (do
      (set! *presence* (json_set *presence* id $data))
      ;; 모두에게 알림
      (ws-send-json-all {
        :type "presence_update"
        :presence *presence*
      })))
]
```

---

## 🧪 테스트

### 서버 시작

```bash
node bootstrap.js run express-chat.fl
```

### 클라이언트 테스트 (wscat)

```bash
npm install -g wscat

# 연결
wscat -c ws://localhost:3000

# 메시지 전송 (JSON)
{"type":"join","username":"Alice","text":"안녕하세요"}

# HTTP API 확인
curl http://localhost:3000/api/messages
curl http://localhost:3000/api/users
curl http://localhost:3000/health
```

### 성능 테스트

```bash
# 1000개 메시지 전송
for i in {1..1000}; do
  echo "{\"text\":\"msg $i\"}" | wscat -c ws://localhost:3000
done
```

---

## 📋 체크리스트

- [ ] WebSocket 핸들러 3개 (connect, message, close) 등록
- [ ] 클라이언트별 ID 저장 (`server_req_id()`)
- [ ] 상태 변수로 사용자/메시지 추적
- [ ] JSON 직렬화/역직렬화 처리
- [ ] HTTP API로 상태 조회 제공
- [ ] 에러 처리 (catch, try)
- [ ] 로깅 (log-info, log-error)
- [ ] 캐싱 (선택: 성능 향상용)

---

## 🔗 관련 함수

### 기본 WS 함수 (stdlib-ws.ts)
- `ws_start(port)` — 서버 시작
- `ws_send(client, msg)` — 전송
- `ws_broadcast(msg)` — 브로드캐스트
- `ws_close(client, code)` — 종료
- `ws_count()` — 클라이언트 수
- `ws_clients()` — 클라이언트 목록

### Express.fl 래퍼
- `ws-start` — 간편한 서버 시작
- `ws-send-all` — 로깅과 함께 브로드캐스트
- `ws-send-to` — 로깅과 함께 개별 전송
- `ws-close-conn` — 안전한 종료

### HTTP + WS 통합
- `app-listen` — HTTP + WS 함께 시작
- `server_req_id()` — WS 연결 ID
- `server_req_body()` — WS 메시지 본문
