# FreeLang v9 프레임워크

FreeLang v9는 실무 개발을 위한 3가지 주요 프레임워크를 제공합니다.

---

## 1. FLNext — 웹 프레임워크

Express 의존성 없이 순수 v9로 작성된 웹 프레임워크.

### 기본 사용법

```lisp
(import flnext)

[APP
 :name "my-app"
 :port 3000
 :database {:url "sqlite:app.db"}
 :routes [
  [GET "/" (fn [req] {:body "Hello World"})]
  [GET "/users/:id" (fn [req]
    (user-service/get-user (:id (:params req))))]
  [POST "/users" (fn [req]
    (user-service/create-user (:body req)))]
  [PUT "/users/:id" (fn [req]
    (user-service/update-user (:id (:params req)) (:body req)))]
  [DELETE "/users/:id" (fn [req]
    (user-service/delete-user (:id (:params req))))]
 ]
 :middleware [
  auth-middleware
  logging-middleware
  cors-middleware
 ]]
```

### ORM (Object-Relational Mapping)

```lisp
[MODEL User
 :table "users"
 :fields [
  {:name "id" :type "INTEGER" :primary-key true}
  {:name "email" :type "TEXT" :unique true}
  {:name "name" :type "TEXT"}
  {:name "created-at" :type "TIMESTAMP"}
 ]
 :indexes [
  {:name "email_idx" :columns ["email"]}
 ]]

; CRUD 연산
(user/create {:email "user@example.com" :name "John"})
(user/find-by-id 1)
(user/find-by :email "user@example.com")
(user/update 1 {:name "Jane"})
(user/delete 1)
```

### 스키마 검증

```lisp
[SCHEMA UserSchema
 :fields {
  :email {:type "email" :required true}
  :password {:type "string" :min 8 :max 128 :required true}
  :name {:type "string" :min 1 :max 100 :required true}
  :age {:type "integer" :min 0 :max 150}
 }]

; 검증
(if (schema-valid? UserSchema user-data)
  (print "유효한 데이터")
  (print "검증 실패:" (schema-errors UserSchema user-data)))
```

### 미들웨어 체인

```lisp
[MIDDLEWARE auth-check
 :condition (fn [req] (has? (:headers req) "authorization"))
 :handler (fn [req]
   (assoc req :user (validate-token (get-token (:headers req)))))
 :on-fail (fn [req]
   {:status 401 :body "Unauthorized"})]

[MIDDLEWARE rate-limit
 :condition (fn [req] (< (get-request-count (:ip req)) 100))
 :handler (fn [req]
   (increment-request-count (:ip req))
   req)
 :on-fail (fn [req]
   {:status 429 :body "Too Many Requests"})]
```

---

## 2. v9-data — 데이터 분석

테이블, 통계, 시각화를 통한 데이터 처리:

### 테이블 조작

```lisp
(import v9-data)

; CSV 로드
(let [data (table/load-csv "sales.csv")]
  (-> data
      (table/filter (fn [row] (> (:amount row) 1000)))
      (table/sort :date :desc)
      (table/group-by :region)))

; 테이블 연산
(table/select data ["name" "email" "amount"])
(table/aggregate data "amount" :sum)
(table/join data1 data2 :on "user_id")
```

### 통계 분석

```lisp
(let [scores [85 90 75 92 88 78 95]]
  {:mean (stats/mean scores)
   :median (stats/median scores)
   :stddev (stats/stddev scores)
   :min (stats/min scores)
   :max (stats/max scores)
   :quartiles (stats/percentiles scores [0.25 0.5 0.75])})

; 상관 분석
(let [x [1 2 3 4 5]
      y [2 4 6 8 10]]
  (stats/correlation x y))  ; → 1.0 (완벽한 양의 상관)

; 정규화
(stats/normalize [0 50 100])  ; → [0.0 0.5 1.0]
```

### 시각화

```lisp
; 히스토그램
(plot/histogram [10 20 15 25 30 18 22]
 :title "Distribution"
 :bins 5)

; 막대 그래프
(plot/bar ["A" "B" "C" "D"]
 [100 150 200 180]
 :title "Sales by Region")

; 선 그래프
(plot/line [1 2 3 4 5]
 [10 15 13 17 20]
 :title "Trend")

; 산점도
(plot/scatter [1 2 3 4 5]
 [10 15 13 17 20])

; 파일로 저장
(plot/save chart "output.svg")
```

---

## 3. 마이크로서비스 프레임워크

분산 시스템 구축:

### 서비스 정의

```lisp
[SERVICE user-service
 :port 8001
 :database {:url "sqlite:users.db"}
 :routes [
  [GET "/users/:id" get-user]
  [POST "/users" create-user]
  [DELETE "/users/:id" delete-user]
 ]]

[SERVICE order-service
 :port 8002
 :database {:url "sqlite:orders.db"}
 :routes [
  [GET "/orders/:id" get-order]
  [POST "/orders" create-order]
 ]]
```

### 메시지 큐

```lisp
; 큐 생성
(queue/create "events" :type "file")

; 이벤트 발행
(queue/publish "events" "user.created"
 {:user-id 123 :email "user@example.com"})

; 이벤트 구독
(queue/subscribe "events" "user.created"
 (fn [message]
  (println "New user created:" (:user-id message))))

; 구독 취소
(queue/unsubscribe subscription-id)
```

### Circuit Breaker (장애 격리)

```lisp
[CIRCUIT-BREAKER external-api
 :threshold 5        ; 5번 실패 시 OPEN
 :timeout 30000      ; 30초 후 HALF-OPEN 시도
 :fallback (fn []
  {:status "error" :message "Service unavailable"})]

; Circuit breaker를 통한 호출
(circuit/call "external-api"
 (fn []
  (http/get "https://external-api.com/data")))
```

### 모니터링

```lisp
; 메트릭 기록
(observe/metric "requests" 1 :type "counter")
(observe/metric "latency" 125 :type "histogram")
(observe/metric "active-connections" 42 :type "gauge")

; 에러 카운팅
(observe/count-errors "database")
(observe/count-errors "external-api")

; 로깅
(observe/log "info" "User login successful" {:user-id 123})
(observe/log "error" "Database connection failed" {:error "timeout"})

; 메트릭 리포트
(observe/report)
; → {:metrics {...} :services [...] :health {...}}

; Prometheus 형식 출력
(observe/prometheus)
```

---

## 통합 예제: SaaS 플랫폼

```lisp
(import flnext)
(import v9-data)

; 데이터 모델
[MODEL User
 :table "users"
 :fields [
  {:name "id" :type "INTEGER" :primary-key true}
  {:name "email" :type "TEXT" :unique true}
  {:name "created-at" :type "TIMESTAMP"}
 ]]

[MODEL Order
 :table "orders"
 :fields [
  {:name "id" :type "INTEGER" :primary-key true}
  {:name "user-id" :type "INTEGER" :foreign-key "users.id"}
  {:name "amount" :type "DECIMAL"}
  {:name "status" :type "TEXT"}
 ]]

; 검증 스키마
[SCHEMA CreateOrderSchema
 :fields {
  :user-id {:type "integer" :required true}
  :amount {:type "decimal" :required true :min 0.01}
  :items {:type "array" :required true}
 }]

; 미들웨어
[MIDDLEWARE request-logging
 :handler (fn [req]
  (observe/log "info" "Request" {:method (:method req) :path (:path req)})
  req)]

; 라우트
(defn create-order [req]
  (let [data (:body req)]
    (if (schema-valid? CreateOrderSchema data)
      (do
        (order/create data)
        {:status 201 :body {:success true}})
      {:status 400 :body {:error (schema-errors CreateOrderSchema data)}})))

; 앱 정의
[APP sales-platform
 :port 3000
 :database {:url "sqlite:app.db"}
 :middleware [request-logging]
 :routes [
  [POST "/orders" create-order]
  [GET "/analytics" analytics-dashboard]
  [GET "/health" health-check]
 ]]
```

---

## 다음 단계

- [기초](./basics.md) — 핵심 문법 학습
- [AI 블록](./ai-blocks.md) — 고급 추론 기능
- [API 레퍼런스](../api/stdlib.md) — 모든 함수
