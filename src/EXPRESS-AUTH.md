# Express.fl 인증 보안 가이드

FreeLang v11의 **암호화** (SHA256, salt) 와 **JWT 토큰** (자체 구현) 을 Express.fl 래퍼로 안전하게 활용합니다.

---

## 🔑 JWT 인증

### 토큰 발급

```lisp
(let [
  payload {
    :user_id 123
    :username "alice"
    :role "admin"
    :iat (now_ms)
  }
  token (auth-jwt-sign payload "secret-key" 3600)
]
  ;; 토큰을 클라이언트에 반환
  (res-json { :token token })
)
```

### 토큰 검증

```lisp
[FUNC api-protected :params [$req]
  :body (let [
    token (auth-extract-bearer $req)
    payload (auth-jwt-verify token "secret-key")
  ]
    (if payload
      (res-json { :user (get payload "username") })
      (res-status 401 { :error "Invalid token" })))
]
```

### 토큰 디코딩 (검증 없음)

```lisp
(let [payload (auth-jwt-decode token)]
  payload)  ;; { :user_id 123, :username "alice", ... }
```

---

## 🔒 암호화

### 비밀번호 해싱

```lisp
;; 회원가입
[FUNC api-signup :params [$req]
  :body (let [
    body (req-body $req)
    password (get $body "password")
    hashed (auth-hash-password password)
  ]
    (do
      ;; DB에 저장
      (db-exec "./db.db"
        "INSERT INTO users (username, password) VALUES (?, ?)"
        [(get $body "username") hashed])
      
      (res-status 201 { :success true })))
]
```

### 비밀번호 검증

```lisp
;; 로그인
[FUNC api-login :params [$req]
  :body (let [
    body (req-body $req)
    username (get $body "username")
    password (get $body "password")
    user (db-query "./db.db"
      "SELECT id, password FROM users WHERE username = ?" [username])
    stored-hash (if user (get (get user 0) "password") "")
    valid (auth-verify-password password stored-hash)
  ]
    (if valid
      (let [token (auth-jwt-sign { :user_id (get (get user 0) "id") } "secret" 3600)]
        (res-json { :success true :token token }))
      (res-status 401 { :error "Invalid credentials" })))
]
```

---

## 🔐 미들웨어 기반 인증

### 보호된 경로 패턴

```lisp
;; 모든 /api/* 경로 보호
[FUNC auth-middleware :params [$req]
  :body (let [
    token (server_req_header $req "Authorization")
    valid (if token (auth-jwt-verify token "secret") false)
  ]
    (if valid
      $req
      (res-status 401 { :error "Unauthorized" })))
]

;; 미들웨어 등록
(middleware_define "auth" nil "auth-middleware" nil)
(middleware_apply_chain 0 $req)
```

---

## 🔑 API 키 인증

### API 키 검증

```lisp
[FUNC verify-api-key :params [$req]
  :body (let [
    api-key (or
      (server_req_header $req "X-API-Key")
      (server_req_query $req "api_key"))
  ]
    (if (= api-key "valid-key-123")
      { :valid true }
      { :valid false }))
]

[FUNC api-with-key :params [$req]
  :body (let [
    check (verify-api-key $req)
  ]
    (if (get $check "valid")
      (res-json { :data "sensitive data" })
      (res-status 403 { :error "Forbidden" })))
]

(app-get "/api/data" "api-with-key")
```

---

## 📊 실전 예제: 완전한 인증 시스템

### 1. 회원가입

```lisp
[FUNC api-signup :params [$req]
  :body (let [
    body (req-body $req)
    username (get $body "username")
    password (get $body "password")
    hashed (auth-hash-password password)
  ]
    (do
      ;; 중복 확인
      (let [existing (db-query "./db.db"
        "SELECT id FROM users WHERE username = ?" [username])]
        
        (if existing
          (res-status 409 { :error "Username already exists" })
          (do
            ;; 새 사용자 생성
            (db-exec "./db.db"
              "INSERT INTO users (username, password, created_at) VALUES (?, ?, ?)"
              [username hashed (now_iso)])
            
            (res-status 201 {
              :success true
              :message "Signup successful"
            }))))))
]

(app-post "/auth/signup" "api-signup")
```

### 2. 로그인

```lisp
[FUNC api-login :params [$req]
  :body (let [
    body (req-body $req)
    username (get $body "username")
    password (get $body "password")
    user (db-query "./db.db"
      "SELECT id, password, role FROM users WHERE username = ?" [username])
    user-data (if user (get user 0) nil)
  ]
    (if user-data
      (if (auth-verify-password password (get $user-data "password"))
        ;; 로그인 성공
        (let [token (auth-jwt-sign {
          :user_id (get $user-data "id")
          :username username
          :role (get $user-data "role")
        } "secret-key" 3600)]
          (do
            (log-info (str "✅ 로그인: " username))
            (res-json {
              :success true
              :token $token
              :user {
                :id (get $user-data "id")
                :username username
                :role (get $user-data "role")
              }
            })))
        ;; 비밀번호 오류
        (do
          (log-warn (str "❌ 로그인 실패: " username " (password)"))
          (res-status 401 { :error "Invalid password" })))
      ;; 사용자 없음
      (do
        (log-warn (str "❌ 로그인 실패: " username " (not found)"))
        (res-status 401 { :error "User not found" }))))
]

(app-post "/auth/login" "api-login")
```

### 3. 보호된 API

```lisp
[FUNC auth-guard :params [$req]
  :body (let [
    token (server_req_header $req "Authorization")
    cleaned (if token (str-trim (str-split token " " 2)) "")
    payload (if cleaned (auth-jwt-verify $cleaned "secret-key") nil)
  ]
    (if payload
      { :authenticated true :user $payload }
      { :authenticated false }))
]

[FUNC api-profile :params [$req]
  :body (let [
    auth (auth-guard $req)
    authenticated (get $auth "authenticated")
    user (get $auth "user")
  ]
    (if authenticated
      (res-json {
        :user_id (get $user "user_id")
        :username (get $user "username")
        :role (get $user "role")
      })
      (res-status 401 { :error "Unauthorized" })))
]

(app-get "/api/profile" "api-profile")
```

### 4. 역할 기반 접근 (RBAC)

```lisp
[FUNC require-role :params [$req $required-role]
  :body (let [
    auth (auth-guard $req)
    authenticated (get $auth "authenticated")
    user (get $auth "user")
    user-role (get $user "role")
    has-role (= $user-role $required-role)
  ]
    (if (and $authenticated $has-role)
      { :authorized true }
      { :authorized false }))
]

[FUNC api-admin :params [$req]
  :body (let [
    check (require-role $req "admin")
    authorized (get $check "authorized")
  ]
    (if $authorized
      (res-json { :data "admin-only data" })
      (res-status 403 { :error "Forbidden - admin only" })))
]

(app-get "/api/admin/users" "api-admin")
```

---

## 🚨 보안 체크리스트

### 개발 단계
- [ ] JWT secret을 환경변수로 관리
- [ ] 비밀번호는 항상 해시 후 저장
- [ ] HTTPS 필수 (운영 환경)
- [ ] 토큰 TTL 설정 (예: 1시간)

### 배포 전
- [ ] secret key 변경
- [ ] CORS 설정 (신뢰할 수 있는 도메인만)
- [ ] Rate limiting 활성화
- [ ] 암호화된 쿠키 사용 (선택)

### 운영 중
- [ ] 토큰 로테이션 (주기적)
- [ ] 비활성 세션 정리
- [ ] 의심스러운 로그인 감지
- [ ] 접근 로그 기록

---

## 🔗 관련 함수

### JWT (stdlib-auth.ts)
- `auth_jwt_sign(payload, secret, ttl)` — 토큰 생성
- `auth_jwt_verify(token, secret)` — 토큰 검증
- `auth_jwt_decode(token)` — 토큰 디코딩 (검증 없음)
- `auth_jwt_expired(token)` — 만료 여부

### 암호화 (stdlib-auth.ts)
- `auth_hash_password(password)` — 비밀번호 해시
- `auth_verify_password(password, stored)` — 비밀번호 검증
- `auth_random_token(bytes)` — 랜덤 토큰 생성
- `auth_hmac(data, secret)` — HMAC-SHA256
- `auth_sha256(data)` — SHA256 해시

### API 키 (stdlib-auth.ts)
- `auth_apikey_valid(req, validKeys)` — API 키 검증
- `auth_apikey_get(req)` — API 키 추출

### Express.fl 래퍼
- `auth-jwt-sign`, `auth-jwt-verify`, `auth-jwt-decode`
- `auth-hash-password`, `auth-verify-password`
- `auth-random-token`
- `auth-extract-bearer` — "Bearer <token>" 파싱
- `auth-get-apikey` — 헤더/쿼리에서 API 키 추출

---

## 📚 추가 자료

### 토큰 형식 (JWT)
```
Header.Payload.Signature

Payload (예):
{
  "user_id": 123,
  "username": "alice",
  "role": "admin",
  "iat": 1670000000,
  "exp": 1670003600
}
```

### 비밀번호 해시 형식
```
salt:hexdigest

예: "8f3a1b2c:d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d"
```

### HTTP 헤더
```
Authorization: Bearer <jwt_token>
X-API-Key: <api_key>
```
