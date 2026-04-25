# Express.fl 고급 기능 가이드

## 1. 에러 핸들링

### `safe-call` — 안전한 함수 실행

```lisp
[FUNC risky :params [$x]
  :body (if (= $x 0)
    (throw "cannot be zero")
    (/ 10 $x))
]

(safe-call (fn [] (risky 0)))
;; → { :error true :message "cannot be zero" }
```

### `with-error-handler` — 커스텀 에러 처리

```lisp
[FUNC handler :params [$req]
  :body (with-error-handler
    (fn []
      ;; 위험한 작업
      (db_query "./db.db" "SELECT * FROM users" []))
    (fn [$e]
      ;; 에러 처리
      (do
        (log-error (str "DB Error: " $e))
        (res-status 500 { :error "Database error" }))))
]
```

### try/catch 직접 사용

```lisp
(try
  (do
    (println "작업 중...")
    (/ 1 0))  ;; 에러 발생
  (fn [$e]
    (println (str "에러 잡음: " $e))))
```

---

## 2. 미들웨어

### 내장 미들웨어

#### CORS
```lisp
(app-cors)
;; Access-Control-Allow-Origin 헤더 자동 추가
```

#### 로깅
```lisp
(app-logging)
;; [ISO_TIME] METHOD PATH 형식으로 자동 로깅
```

#### 인증 (Bearer Token)
```lisp
(app-auth "my-secret-token")
;; Authorization: Bearer my-secret-token 검사
;; 실패 시 401 응답
```

#### Rate Limiting
```lisp
(app-rate-limit 100 60000)
;; 60초당 100 요청 제한
;; 초과 시 429 응답
```

### 미들웨어 조합

```lisp
(do
  (app-logging)
  (app-cors)
  (app-auth "token123")
  (app-rate-limit 100 60000)
  
  ;; 라우트들...
  (app-get "/" "home")
)
```

---

## 3. 데이터베이스

### SQLite

#### 쿼리 (SELECT)
```lisp
(let [rows (db-query-sqlite "./db.db"
  "SELECT * FROM users WHERE age > ?"
  [18])]
  (res-json { :data $rows }))
```

#### 실행 (INSERT/UPDATE/DELETE)
```lisp
(db-exec-sqlite "./db.db"
  "INSERT INTO users (name, email) VALUES (?, ?)"
  ["홍길동" "hong@example.com"])
```

#### 삽입 (간편)
```lisp
(db-insert "./db.db" "users" {
  :name "김영희"
  :email "kim@example.com"
})
```

#### 업데이트 (간편)
```lisp
(db-update "./db.db" "users"
  { :name "이순신" }
  "id = 5")
```

#### 삭제 (간편)
```lisp
(db-delete "./db.db" "users" "id = 5")
```

---

## 4. 로깅

### 구조적 로깅

```lisp
(log-info "사용자 로그인")
;; [INFO] 2026-04-25T04:10:30Z 사용자 로그인

(log-error "데이터베이스 연결 실패")
;; [ERROR] 2026-04-25T04:10:30Z 데이터베이스 연결 실패

(log-debug "변수 x = 42")
;; [DEBUG] 2026-04-25T04:10:30Z 변수 x = 42
```

### 요청 로깅

```lisp
[FUNC my-handler :params [$req]
  :body (do
    (req-log $req)  ;; 요청 정보 로깅
    (res-json { :ok true }))
]
```

---

## 5. 실전 예제: 완전한 API

```lisp
(load "src/express.fl")

;; DB 초기화
(db_create "./app.db" "
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL,
    stock INTEGER
  )
")

;; 핸들러
[FUNC list-products :params [$req]
  :body (with-error-handler
    (fn []
      (let [products (db-query-sqlite "./app.db"
        "SELECT * FROM products" [])]
        (res-json { :success true :data $products })))
    (fn [$e]
      (do
        (log-error (str "DB: " $e))
        (res-status 500 { :error "Server error" }))))
]

[FUNC create-product :params [$req]
  :body (with-error-handler
    (fn []
      (let [body (req-body $req)]
        (do
          (db-exec-sqlite "./app.db"
            "INSERT INTO products (name, price, stock) VALUES (?, ?, ?)"
            [(get $body "name") (get $body "price") (get $body "stock")])
          (res-status 201 { :success true }))))
    (fn [$e]
      (do
        (log-error (str "Create: " $e))
        (res-status 400 { :error (str $e) }))))
]

;; 라우트
(do
  (app-logging)
  (app-cors)
  
  (app-get "/api/products" "list-products")
  (app-post "/api/products" "create-product")
  
  (app-listen 5000)
)
```

---

## 6. 성능 팁

### 배치 작업
```lisp
;; ❌ 느림: N번의 쿼리
(map (fn [id] (db-query "./db.db" "SELECT * FROM users WHERE id = ?" [id]))
  [1 2 3 4 5])

;; ✅ 빠름: 1번의 쿼리
(db-query "./db.db"
  "SELECT * FROM users WHERE id IN (1,2,3,4,5)"
  [])
```

### 인덱스
```lisp
;; DB 생성 시 인덱스 추가
(db_create "./db.db" "
  CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);
  CREATE INDEX idx_email ON users(email);
")
```

### 캐싱 (메모리)
```lisp
;; 전역 변수로 캐시
(define *user-cache* {})

[FUNC get-user-cached :params [$id]
  :body (let [cached (get *user-cache* $id)]
    (if cached
      $cached
      (let [user (db-query "./db.db" "SELECT * FROM users WHERE id = ?" [$id])]
        (do
          (set! *user-cache* (json_set *user-cache* $id (get $user 0)))
          (get $user 0)))))
]
```

---

## 7. 디버깅

### 요청 덤프
```lisp
[FUNC debug-handler :params [$req]
  :body (do
    (println "=== REQUEST ===")
    (println (str "Method: " (req-method $req)))
    (println (str "Path: " (req-path $req)))
    (println (str "Headers: " (req-header $req "Content-Type")))
    (println (str "Body: " (req-body $req)))
    (res-json { :debug "check logs" }))
]
```

### 에러 스택 추적
```lisp
(try
  (risky-operation)
  (fn [$e]
    (do
      (println (str "Error: " (error_message $e)))
      (println (str "Type: " (error_type $e)))
      (println (str "Stack: " (error_stack $e))))))
```

---

## 체크리스트

- [ ] 모든 DB 쿼리에 에러 핸들러 추가
- [ ] 프로덕션 환경에서 CORS/인증 활성화
- [ ] 민감한 정보는 로그에 기록 금지
- [ ] Rate limiting으로 남용 방지
- [ ] 성능 모니터링 (응답 시간 로그)
- [ ] 정기적인 DB 백업
