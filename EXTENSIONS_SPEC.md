# FreeLang v11 — Extensions Spec

**계층**: Layer 3 (도메인 기능)  
**원칙**: 도메인 기능. Core가 직접 품지 않고 확장팩으로 제공

---

## 1. HTTP 서버 (stdlib-http-server.ts)

```lisp
;; 서버 시작
(server-start 40101)

;; 라우트 등록
(server-get "/api/users" (fn [$req] (server-json (list-users))))
(server-post "/api/users" (fn [$req]
  (let [$body (get $req "body")]
    (server-json (create-user $body)))))
```

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `server-start` | `(server-start port)` | HTTP 서버 시작 |
| `server-get` | `(server-get path handler)` | GET 라우트 |
| `server-post` | `(server-post path handler)` | POST 라우트 |
| `server-put` | `(server-put path handler)` | PUT 라우트 |
| `server-delete` | `(server-delete path handler)` | DELETE 라우트 |
| `server-json` | `(server-json v)` | JSON 응답 |
| `server-html` | `(server-html s)` | HTML 응답 |
| `server-status` | `(server-status code body)` | 상태코드 응답 |
| `server-redirect` | `(server-redirect url)` | 리다이렉트 |
| `server-set-cookie` | `(server-set-cookie name val opts)` | 쿠키 설정 |

**Request 객체 접근:**
```lisp
(get $req "body")       ;; JSON body (자동 파싱)
(get $req "query")      ;; 쿼리 파라미터
(get $req "params")     ;; 경로 파라미터
(get $req "headers")    ;; 헤더
```

---

## 2. HTTP 클라이언트 (stdlib-http.ts)

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `http-get` | `(http-get url headers?)` | GET 요청 |
| `http-post` | `(http-post url body headers?)` | POST 요청 |
| `http-put` | `(http-put url body headers?)` | PUT 요청 |
| `http-delete` | `(http-delete url headers?)` | DELETE 요청 |
| `http-get-bearer-json` | `(http-get-bearer-json url token)` | Bearer GET |

---

## 3. 데이터베이스

### MariaDB (stdlib-mariadb.ts)
```lisp
(db-connect {:host "localhost" :port 3306 :user "root" :password "pw" :database "mydb"})
(db-query "SELECT * FROM users WHERE id = ?" [user-id])
(db-exec "INSERT INTO users (name) VALUES (?)" [name])
```

| 함수 | 설명 |
|------|------|
| `db-connect` | DB 연결 |
| `db-query` | SELECT 실행 → rows |
| `db-exec` | INSERT/UPDATE/DELETE |
| `db-transaction` | 트랜잭션 시작 |

### SQLite (stdlib-db.ts)
```lisp
(sqlite-open "/path/to/db.sqlite")
(sqlite-query "SELECT * FROM items")
```

---

## 4. 에이전트 (agent.ts, stdlib-agent.ts)

```lisp
;; 에이전트 생성
(agent-spawn {:id "worker-1" :capabilities ["write" "execute"]})

;; 메시지 전송
(agent-send "worker-1" {:type "task" :data task-data})

;; 메시지 수신
(agent-recv "worker-1")
```

| 함수 | 설명 |
|------|------|
| `agent-spawn` | 에이전트 생성 |
| `agent-send` | 메시지 전송 |
| `agent-recv` | 메시지 수신 |
| `agent-list` | 에이전트 목록 |
| `agent-broadcast` | 전체 브로드캐스트 |
| `agent-history` | 에이전트 히스토리 |

---

## 5. 워크플로우 (stdlib-workflow.ts)

```lisp
;; 작업 등록
(workflow-define "daily-report" {:schedule "0 9 * * *" :fn daily-report-fn})

;; 수동 실행
(workflow-run "daily-report")
```

---

## 6. 메모리 시스템 (Phase 101)

```lisp
(mem-remember "user-pref" {:theme "dark"})
(mem-recall "user-pref")
(mem-forget "user-pref")
```

| 함수 | 설명 |
|------|------|
| `mem-remember` | 단기/장기 메모리 저장 |
| `mem-recall` | 메모리 조회 |
| `mem-forget` | 메모리 삭제 |
| `mem-keys` | 메모리 키 목록 |
| `mem-search-*` | 의미론적 검색 |

---

## 7. 도구 레지스트리 (Phase 97)

```lisp
(use-tool "search" {:query "freelang"})
(list-tools)
```

---

## 8. 스트리밍 (Phase 105)

```lisp
(let [$stream (stream-create "my-stream")]
  (stream-text $stream "Hello ")
  (stream-text $stream "World")
  (stream-end $stream))
```

---

## 9. 보안 함수 (v11.5.3+)

| 함수 | 설명 |
|------|------|
| `auth-jwt-sign` | JWT 생성 |
| `auth-jwt-verify` | JWT 검증 → 페이로드 |
| `auth-password-hash` | bcrypt 해시 |
| `auth-password-verify` | 비밀번호 검증 |
| `auth-csrf-token` | CSRF 토큰 생성 |
| `auth-csrf-verify` | CSRF 검증 |
| `html-escape` | XSS 방어 |
| `js-escape` | JS 문자열 안전 변환 |

---

## 10. WebSocket (stdlib-ws.ts)

```lisp
(ws-send $conn "Hello")
(ws-broadcast "message" data)
```
