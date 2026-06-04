# FreeLang v11

**Node.js 없이 동작하는 AI-native 백엔드 언어. FL → C → ELF 전체 체인.**

- **cgc-bin** (72KB 순수 C ELF): FL → C → 네이티브 바이너리, Node.js/Bun 불필요
- **L4 자가호스팅**: 컴파일러 자신을 FL로 작성, 3중 SHA256 고정점 검증
- **웹 서버 + SQLite + JWT** 전체 스택을 단일 ELF로 배포
- **AI-native**: Claude 및 에이전트가 직접 작성·검증하는 코드베이스

---

## 빠른 시작

```bash
# bootstrap(Bun) 경로
bun bootstrap.js run hello.fl

# Native 경로 (Node.js/Bun 불필요)
bash scripts/fl-native.sh run hello.fl
bash scripts/fl-native.sh build server.fl -o ./server && ./server
```

---

## 지원 기능 (cgc-bin 네이티브)

### 언어
```lisp
(defn factorial [n]
  (if (<= n 1) 1 (* n (factorial (- n 1)))))
(print (factorial 10))   ; 3628800

(define counter (atom 0))
(swap! counter + 1)
(print @counter)          ; 1

(loop [i 0 sum 0]
  (if (< i 100) (recur (+ i 1) (+ sum i)) (print sum)))  ; 4950
```

### HTTP 서버
```lisp
(server-get "/" (fn [req]
  (server-html "<h1>Hello from cgc-bin</h1>")))

(server-get "/api/:id" (fn [req]
  (let [id (get (get req "params") "id")]
    (server-json {"id" id}))))

(server-post "/api/data" (fn [req]
  (let [body (get req "body")]
    (server-json {"received" body}))))

(server-start 8080)  ; 블로킹
```

### SQLite
```lisp
(define db (db-open "./app.db"))
(db-exec db "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)" [])
(db-exec db "INSERT INTO users (name) VALUES (?)" ["Alice"])
(define rows (db-query db "SELECT * FROM users" []))
(print rows)  ; [{"id": 1, "name": "Alice"}]
(db-close db)
```

### JWT + 비밀번호
```lisp
(define token (auth-jwt-sign {"user_id" 42} "secret" 3600))
(define payload (auth-jwt-verify token "secret"))
(print (get payload "user_id"))  ; 42

(define hash (auth-hash-password "mypassword"))
(print (auth-verify-password "mypassword" hash))  ; true
```

---

## 실행 경로 비교

| 경로 | 런타임 | Node 필요 | Bun 필요 | 크기 |
|---|---|---|---|---|
| `bootstrap.js run` | Bun | ❌ | ✅ | ~1MB |
| `fl-native.sh run` | cgc-bin + gcc | ❌ | ❌ | 72KB 컴파일러 |
| 빌드된 ELF | 없음 | ❌ | ❌ | ~1.2MB |

---

## 아키텍처

```
.fl 소스
  ↓ cgc-bin (freelang.c → 72KB ELF)
C 코드 (.c)
  ↓ gcc + runtime/*.c
네이티브 ELF
  ↓ 실행
출력
```

**runtime 모듈** (순수 C):
- `core.c` — 값 타입, 산술, print
- `collection.c` — 벡터·맵 조작
- `math.c` — 문자열·수학·술어·atom·정렬
- `http.c` — HTTP 서버 (pthread, 라우팅, 파라미터)
- `http-client.c` — HTTP 클라이언트
- `db.c` + `sqlite3.c` — SQLite 내장
- `crypto.c` — JWT(HS256) + scrypt 비밀번호
- `json.c` — JSON 파싱·직렬화
- `io.c` — 파일 I/O
- `process.c` — 프로세스·환경변수

---

## stdlib 함수 목록

| 카테고리 | 주요 함수 |
|---|---|
| 컬렉션 | map filter reduce get assoc get-in sort-by includes-item obj-omit min max |
| 문자열 | str str-split str-starts-with str-ends-with str-to-num html-escape |
| 술어 | nil? empty? not-empty? nil-or-empty? number? string? boolean? array? map? fn? |
| atom | atom @var deref reset! swap! |
| 제어 | if cond when case do try loop/recur dotimes doseq |
| 서버 | server-start get/post/put/delete/patch html/json/status/redirect |
| DB | db-open db-close db-query db-exec |
| JWT·auth | auth-jwt-sign/verify/expired auth-hash-password auth-verify-password |
| HTTP 클라이언트 | http-get http-post |
| 유틸 | json-parse json-stringify sleep uuid now-ms fl-env-get |

---

## 검증 현황

```
L4 자가호스팅 고정점: SHA256 3중 일치 ✅
cgc-bin aarch64 (72KB) ✅
fl-native.sh E2E: run/build/compile ✅
서버 E2E: GET/POST/:param/404 ✅
DB E2E: CREATE/INSERT/SELECT/WHERE ✅
JWT E2E: sign/verify/expired/wrong-secret ✅
auth E2E: hash/verify-T/verify-F ✅
atom E2E: atom/@/reset!/swap!×7 ✅
```

---

## 개발

```bash
# FL 파일 직접 실행 (bootstrap)
bun bootstrap.js run src/server.fl

# 네이티브 실행
bash scripts/fl-native.sh run src/server.fl

# ELF 빌드
bash scripts/fl-native.sh build src/server.fl -o ./server

# cgc-bin 재빌드 (freelang.c 수정 후)
gcc -Wall -Wextra -O2 -o bin/cgc-bin freelang.c -lm
```

---

## 라이선스

MIT
