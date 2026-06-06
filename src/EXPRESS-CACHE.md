# Express.fl 캐싱 + 성능 최적화 가이드

FreeLang v11의 **고성능 in-memory 캐시** (TTL 기반) 와 **PubSub 시스템** (이벤트 기반 통신)을 Express.fl 래퍼로 활용합니다.

---

## 💾 캐싱 기본

### 캐시 저장

```lisp
;; TTL 없이 영구 저장
(cache-set "key1" { :data "value" })

;; 5분 TTL (밀리초)
(cache-set "user:123" user 300000)

;; 캐시 히트 시 로깅
;; ✅ 캐시 히트: user:123
```

### 캐시 조회

```lisp
(let [user (cache-get "user:123")]
  (if user
    (res-json { :success true :data user })
    ;; ❌ 캐시 미스: user:123
    (res-json { :success false })))
```

### 캐시 확인/삭제

```lisp
;; 존재 확인
(cache-has "user:123")  ;; true/false

;; 단일 삭제
(cache-del "user:123")

;; 전체 삭제
(cache-clear)

;; 캐시 통계
(cache-info)  ;; { :size 42 :timestamp "2026-04-25T..." }
```

---

## 🏗️ 캐싱 패턴

### 1. Look-Aside (Lazy Loading)

```lisp
[FUNC get-user-cached :params [$id]
  :body (let [
    cache-key (str "user:" $id)
    cached (cache-get $cache-key)
  ]
    (if cached
      $cached  ;; ✅ 캐시 히트
      ;; ❌ 캐시 미스 → DB 조회
      (let [user (db-query "./db.db" "SELECT * FROM users WHERE id = ?" [$id])]
        (do
          (if user
            (cache-set $cache-key user 300000))  ;; 5분 캐시
          $user))))
]

(let [user (get-user-cached 123)]
  (res-json { :data user }))
```

### 2. 캐시 무효화 (Invalidation)

```lisp
[FUNC update-user :params [$req]
  :body (let [
    id (req-param $req "id")
    body (req-body $req)
  ]
    (do
      ;; DB 업데이트
      (db-exec "./db.db" "UPDATE users SET name = ? WHERE id = ?" ...)

      ;; 캐시 무효화
      (cache-del (str "user:" id))
      (cache-del "all_users")  ;; 관련된 다른 캐시도 제거

      (res-json { :success true })))
]
```

### 3. 워밍업 (Pre-loading)

```lisp
;; 서버 시작 시 자주 사용하는 데이터 미리 캐시
(do
  (let [popular (db-query "./db.db" "SELECT * FROM products LIMIT 100" [])]
    (cache-set "popular_products" popular 600000))

  (let [categories (db-query "./db.db" "SELECT DISTINCT category FROM products" [])]
    (cache-set "categories" categories 3600000))
)
```

---

## 🔔 PubSub (이벤트 발행-구독)

### 토픽 발행

```lisp
;; 구독자에게 데이터 발행
(let [count (pubsub-publish "user.login" {
  :username "alice"
  :timestamp (now_iso)
})]
  (log-info (str count "명에게 전송됨")))
```

### 토픽 구독

```lisp
;; 핸들러 정의
[FUNC on-user-login :params [$data]
  :body (do
    (println (str "🔔 " (get $data "username") " 로그인"))
    nil)
]

;; 구독 등록
(pubsub-subscribe "user.login" "on-user-login")
```

### 구독 관리

```lisp
;; 구독 취소
(pubsub-unsubscribe subscription-id)

;; 토픽 조회
(pubsub-topics)  ;; ["user.login", "user.logout", "notification"]

;; 구독자 수
(pubsub-subscribers "user.login")  ;; 5
```

---

## 📊 실전 예제: 사용자 캐싱

### 캐시된 조회

```lisp
[FUNC get-user-cached :params [$id]
  :body (let [
    key (str "user:" $id)
    cached (cache-get key)
  ]
    (if cached
      $cached
      (let [user (db-query "./db.db"
        "SELECT id, name, email FROM users WHERE id = ?" [$id])]
        (do
          (if user
            (cache-set key user 300000))
          $user))))
]

;; API
[FUNC api-get-user :params [$req]
  :body (let [
    id (req-param $req "id")
    user (get-user-cached id)
  ]
    (if user
      (res-json { :data user })
      (res-status 404 { :error "Not found" })))
]

(app-get "/api/users/:id" "api-get-user")
```

### 캐시 무효화

```lisp
[FUNC update-user :params [$req]
  :body (let [
    id (req-param $req "id")
    body (req-body $req)
  ]
    (do
      ;; DB 업데이트
      (db-exec "./db.db"
        "UPDATE users SET name = ?, email = ? WHERE id = ?"
        [(get $body "name") (get $body "email") id])

      ;; 관련 캐시 제거
      (cache-del (str "user:" id))
      (cache-del "all_users")
      (cache-del "user_count")

      ;; 이벤트 발행
      (pubsub-publish "user.updated" {
        :user_id id
        :timestamp (now_iso)
      })

      (res-json { :success true })))
]

(app-put "/api/users/:id" "update-user")
```

---

## ⚡ 성능 최적화 팁

### 1. TTL 선택

```lisp
;; 자주 변경: 1분
(cache-set "hot-data" data 60000)

;; 가끔 변경: 10분
(cache-set "warm-data" data 600000)

;; 거의 변경 안함: 1시간
(cache-set "cold-data" data 3600000)

;; 영구 캐시 (관리 필수)
(cache-set "static-data" data 0)
```

### 2. 캐시 키 전략

```lisp
;; ✅ 좋음: 계층 구조
(cache-set "user:123:profile" profile)
(cache-set "user:123:posts" posts)
(cache-set "user:123:followers" followers)

;; ❌ 나쁨: 불명확한 키
(cache-set "data1" ...)
(cache-set "temp" ...)
```

### 3. 캐시 배포

```lisp
;; 데이터 그룹으로 캐시
[FUNC get-user-full :params [$id]
  :body (let [
    key (str "user-full:" $id)
    cached (cache-get key)
  ]
    (if cached
      $cached
      (let [user {
        :profile (db-query ... "SELECT * FROM users WHERE id = ?")
        :posts (db-query ... "SELECT * FROM posts WHERE user_id = ?")
        :followers (db-query ... "SELECT * FROM followers WHERE user_id = ?")
      }]
        (do
          (cache-set key $user 600000)
          $user))))
]

;; 무효화도 한번에
(cache-del (str "user-full:" id))
```

### 4. 모니터링

```lisp
[FUNC api-cache-stats :params [$req]
  :body (let [
    info (cache-info)
    topics (pubsub-topics)
  ]
    (res-json {
      :cache_size (get $info "size")
      :pubsub_topics $topics
      :timestamp (get $info "timestamp")
    }))
]

(app-get "/api/stats/cache" "api-cache-stats")
```

---

## 🔄 세션 관리

### 세션 생성

```lisp
[FUNC create-session :params [$user-id]
  :body (let [
    session-id (str "sess_" (now_ms))
    session-data {
      :user_id $user-id
      :created_at (now_iso)
      :ip (req-header $req "X-Forwarded-For")
    }
  ]
    (do
      ;; 1시간 TTL
      (cache-set session-id $session-data 3600000)
      session-id))
]

[FUNC api-login :params [$req]
  :body (let [
    body (req-body $req)
    username (get $body "username")
    password (get $body "password")
  ]
    (if (verify-password username password)
      (let [session-id (create-session username)]
        (res-json {
          :success true
          :session_id session-id
        }))
      (res-status 401 { :error "Invalid credentials" })))
]
```

### 세션 검증

```lisp
[FUNC verify-session :params [$session-id]
  :body (let [session (cache-get $session-id)]
    (if session
      { :valid true :user_id (get $session "user_id") }
      { :valid false }))
]

[FUNC protected-api :params [$req]
  :body (let [
    session-id (req-header $req "X-Session-Id")
    session (verify-session session-id)
  ]
    (if (get $session "valid")
      (res-json { :data "protected content" })
      (res-status 401 { :error "Unauthorized" })))
]
```

---

## 🎯 체크리스트

- [ ] 캐시 TTL 전략 정의 (hot/warm/cold)
- [ ] 캐시 키 명명 규칙 정립 (예: `resource:id:type`)
- [ ] 캐시 무효화 포인트 파악 (INSERT/UPDATE/DELETE)
- [ ] 관련 캐시 함께 무효화 (의존성 고려)
- [ ] PubSub 토픽 설계 (이벤트 종류별)
- [ ] 캐시 모니터링 API 구현
- [ ] 세션 TTL 설정 (보안)
- [ ] 캐시 스토리지 용량 예측

---

## 📈 성능 비교

### 캐시 없음 (DB 직접 조회)
```
GET /api/users/123
→ DB 쿼리 100ms
→ JSON 직렬화 10ms
→ 총 110ms
```

### 캐시 있음 (히트)
```
GET /api/users/123
→ 캐시 조회 <1ms
→ JSON 직렬화 10ms
→ 총 <11ms
→ 10배 빠름! 🚀
```

---

## 🔗 관련 함수

### 캐시 (stdlib-cache.ts)
- `cache_set(key, value, ttl)` — 저장
- `cache_get(key)` — 조회
- `cache_has(key)` — 존재 확인
- `cache_del(key)` — 삭제
- `cache_clear(prefix?)` — 전체/부분 삭제
- `cache_size()` — 항목 수
- `cache_keys(prefix?)` — 키 목록

### PubSub (stdlib-pubsub.ts)
- `pubsub_publish(topic, data)` — 발행
- `pubsub_subscribe(topic, handler)` — 구독
- `pubsub_unsubscribe(id)` — 구독 취소
- `pubsub_topics()` — 토픽 목록
- `pubsub_subscribers(topic)` — 구독자 수

### Express.fl 래퍼
- `cache-set`, `cache-get`, `cache-has`, `cache-del`, `cache-clear`
- `cache-info` — 통계
- `pubsub-publish`, `pubsub-subscribe`, `pubsub-unsubscribe`
- `pubsub-topics`, `pubsub-subscribers`
