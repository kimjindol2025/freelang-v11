# FreeLang v11 — Claude AI 완전 레퍼런스

**버전**: v11.5.4 | **최신 갱신**: 2026-05-10  
**상태**: 프로덕션 (68/68 테스트 통과) | **AI 신뢰도**: 9.5/10

---

## ⚡ 즉시 적용 규칙

### Rule 1: $ 접두사는 선택사항

`$`는 optional. 있어도 되고 없어도 된다. **둘 다 동작한다.**

```lisp
;; ✅ $ 없이 (권장 — 더 자연스러움)
(defn add [a b] (+ a b))
(fn [x] (* x 2))
(let [n (get req "name")] (println n))
(loop [i 0] (recur (inc i)))

;; ✅ $ 있어도 동작 (기존 코드 호환)
(defn add [a b] (+ a b))
(fn [x] (* x 2))
(let [n (get req "name")] (println n))
(loop [i 0] (recur (inc i)))
```

**let 바인딩**: 단일 괄호, 이중 괄호 둘 다 동작

```lisp
;; ✅ 단일 괄호 (더 자연스러움)
(let [user (get req "user")
      token (auth-jwt-sign {:id (get user "id")} "secret" 3600)]
  (str "Hello " user))

;; ✅ 이중 괄호도 동작 (기존 코드 호환)
(let [user (get req "user")]
  (str "Hello " user))
```

---

### Rule 2: 절대 금지 패턴 TOP 10

| 패턴 | 이유 | 올바른 것 |
|------|------|----------|
| `(def name "Kim")` | Clojure, v11은 define | `(define name "Kim")` |
| `(defn [args] body)` | 함수명 생략 | `(defn fn-name [arg] body)` |
| `(merge a b)` | 없음 | `(obj-merge a b)` |
| `(assoc m :k v)` | 키워드(:k), 다중 불가 | `(assoc m "k" v)` |
| `(map arr fn)` | 인자 순서 반대, fn 먼저 | `(map fn arr)` |
| `(filter arr fn)` | 인자 순서 반대, fn 먼저 | `(filter fn arr)` |
| `(server_listen port)` | 구버전, v11.5+ | `(server-start port)` |
| `(defn handler [req res] ...)` | res 없음 (HTTP 패턴) | `(defn handler [req] ...)` 만 |
| `(if-let [x expr] body)` | 구버전, v11.5+ | `(if-let [[x expr]] body)` |

---

## 1. 언어 문법 핵심

### 기본 타입

```lisp
"hello"                 ;; 문자열 (이중 따옴표)
'hello                  ;; 심볼 (작은따옴표, 드물게 사용)
123                     ;; 정수
3.14                    ;; 실수
true false nil          ;; 불린/nil
[1 2 3]                 ;; 벡터 (배열)
{"a" 1 "b" 2}          ;; 맵 (객체) — 문자열 키
{:name "Alice" :age 30} ;; 맵 (객체) — keyword 키 ✅ 권장
[:a :b :c]             ;; 벡터 내부 심볼
```

### 함수 정의 & 호출

```lisp
;; 함수 정의 — $ 없이 자연스럽게
(defn greet [name]
  (str "Hello, " name))

;; 함수 호출
(greet "Alice")         ;; → "Hello, Alice"

;; 익명함수 (fn)
(fn [x] (* x 2))

;; 조건부 (if)
(if condition
  "then branch"
  "else branch")

;; 조건부 바인딩 (if-let)
(if-let [[user (get req "user")]]
  (str "User: " user)
  "No user")

;; 루프 (loop/recur)
(loop [i 0 sum 0]
  (if (< i 10)
    (recur (inc i) (+ sum i))
    sum))  ;; → 0+1+2+...+9 = 45
```

### 문자열 보간 (triple-quote)

```lisp
;; 기본 보간
(str "Hello, " name)

;; 삼중따옴표 — HTML/JSON/JS 임베드 시 이스케이프 자동 처리 (v11.5+)
(let [title "Welcome"
      count 5]
  """
  <h1>${title}</h1>
  <p>Count: ${count}</p>
  """)
;; → HTML 문자열 직렬화, 이중 이스케이프 불필요
```

### 맵 & 객체 조작

```lisp
;; 맵 생성 — keyword 키 권장
(let [user {:name "Alice" :age 30 :scores {:math 95 :eng 88}}]
  ...)

;; 값 추출 — keyword 또는 문자열 둘 다 동작
(get user :name)                      ;; → "Alice"
(get user :missing "default")         ;; → "default" (기본값)

;; 중첩 접근 (get-in)
(get-in user [:scores :math])         ;; → 95
(get-in user [:scores :missing] 0)    ;; → 0 (기본값)

;; nil 연쇄 접근 (?.)
(?. user :profile :name)              ;; 중간에 nil이면 즉시 nil 반환

;; nil 병합 (??)
(?? (get user :nickname) (get user :name))  ;; 첫 번째 nil 아닌 값

;; 맵 갱신 (단일 키)
(assoc user :email "alice@example.com")

;; 중첩 갱신 (assoc-in) — 불변
(assoc-in user [:scores :math] 100)

;; 중첩 함수 적용 (update-in) — 불변
(update-in user [:scores :math] inc)     ;; 95 → 96
(update-in user [:scores :math] + 5)     ;; 95 → 100

;; 맵 병합
(obj-merge user {:email "alice@example.com"})

;; 특정 키만 추출 / 제외
(obj-pick user ["name" "email"])
(obj-omit user ["age"])
```

---

## 2. 서버 & HTTP 패턴

### 서버 시작 & 라우팅

```lisp
;; 포트에서 서버 시작 (v11.5.3+)
(server-start 40001)

;; 라우팅 정의
(define routes {
  :get {
    "/" (fn [req] (handle-index req))
    "/api/users/:id" (fn [req] (handle-user req))
  }
  :post {
    "/api/submit" (fn [req] (handle-submit req))
  }
})

;; 라우트 등록 — 부트스트랩 시 자동 호출
(route routes)
```

### Request 객체 접근

```lisp
;; Request 구조
{
  "method"  "GET"
  "path"    "/api/users/123"
  "query"   {"filter" "active" "page" "2"}
  "params"  {"id" "123"}            ;; 경로 파라미터
  "headers" {"authorization" "Bearer ..." "content-type" "application/json"}
  "body"    {...}                   ;; 자동 파싱 (Content-Type: application/json)
  "cookies" {"session" "abc123..."}
}

;; 접근 패턴
(get req "method")                   ;; → "GET"
(get (get req "query") "filter")     ;; → "active"
(get (get req "params") "id")        ;; → "123"
(get (get req "headers") "authorization")
(get req "body")                     ;; 이미 파싱된 맵 (JSON)
```

### Response 패턴

```lisp
;; HTML 응답
(server-html "<h1>Hello</h1>")

;; JSON 응답
(server-json {"status" "ok" "data" [1 2 3]})

;; 상태 코드 + 메시지
(server-status 404 "Not found")

;; 리다이렉트
(server-redirect "/login")

;; 파일 다운로드
(server-file "/path/to/file.pdf" "application/pdf")

;; 쿠키 설정 (v11.5.3+) — HttpOnly + Secure + SameSite 자동
(let [cookie (server-set-cookie "session" "token123" {:max_age 3600})]
  (server-html-cookie "<h1>ok</h1>" cookie))
```

---

## 3. 데이터베이스 패턴

### MariaDB (기본)

```lisp
;; 연결 설정
(define db {
  "host" "localhost"
  "port" 3306
  "user" "akl"
  "password" "akl_pass_2026"
  "database" "akl"
})

;; 조회 (db-query)
(let [[result (db-query db
        "SELECT * FROM users WHERE age > ?" 
        [25])]]
  (println result))  ;; → [{"id" 1 "name" "Alice"} ...]

;; 삽입 (db-exec)
(db-exec db
  "INSERT INTO users (name, age) VALUES (?, ?)"
  ["Bob" 30])

;; 갱신
(db-exec db
  "UPDATE users SET age = ? WHERE id = ?"
  [31 1])

;; 삭제
(db-exec db
  "DELETE FROM users WHERE id = ?"
  [1])
```

### SQLite (경량 테스트/로컬)

```lisp
;; SQLite 조회
(let [[result (db-query {:type "sqlite" :path "./local.db"}
        "SELECT * FROM items"
        [])]]
  ...)
```

---

## 4. 보안 패턴 (v11.5.3)

### XSS 방어 (자동 이스케이프)

```lisp
;; ❌ 위험 — 사용자 입력이 그대로 HTML로
(let [name (get req-body "name")]
  (server-html (str "<h1>" name "</h1>")))
;; 공격: name = "<script>alert(1)</script>" → 실행됨!

;; ✅ 안전 — html-escape로 이스케이프
(let [name (get req-body "name")]
  (server-html (str "<h1>" (html-escape name) "</h1>")))
;; 결과: <h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1> → 문자열로 표시

;; JavaScript 문자열 안 이스케이프
(let [msg (get req-body "message")]
  (server-html (str "<script>console.log('" (js-escape msg) "')</script>")))
```

### CSRF 토큰 (60분 유효)

```lisp
;; 폼 페이지 생성
(defn form-page [req]
  (let [token (auth-csrf-token "my-secret-key")]
    (server-html (str """
      <form method="POST" action="/submit">
        <input type="hidden" name="_csrf" value="${token}">
        <input name="name" placeholder="이름">
        <button>제출</button>
      </form>
    """))))

;; POST 처리 — 토큰 검증
(defn handle-submit [req]
  (let [body (get req "body")
      token (get body "_csrf")]
    (if (auth-csrf-verify token "my-secret-key")
      (server-html "<p>성공</p>")
      (server-status 403 "CSRF 토큰 실패"))))
```

### 안전한 쿠키

```lisp
;; 쿠키 생성 (HttpOnly + Secure + SameSite=Strict 자동)
(let [c (server-set-cookie "session" "abc123xyz" {:max_age 7200})]
  (server-html-cookie "<h1>로그인 됨</h1>" c))

;; 결과 Set-Cookie 헤더:
;; session=abc123xyz; Max-Age=7200; Path=/; HttpOnly; Secure; SameSite=Strict

;; 옵션 커스터마이징
(let [c (server-set-cookie "auth" "token" {
  :max_age 86400
  :path "/app"
  :same_site "Lax"
})]
  ...)
```

---

## 5. 인증 패턴

### JWT (토큰 기반 인증)

```lisp
;; 토큰 생성 (1시간 유효)
(let [token (auth-jwt-sign 
        {:user_id 123 :role "admin"} 
        "secret-key"
        3600)]
  token)
;; → "eyJhbGc..." (3부 JWT)

;; 토큰 검증
(let [payload (auth-jwt-verify token "secret-key")]
  (if (nil? payload)
    (server-status 401 "Invalid token")
    (str "User ID: " (get payload "user_id"))))

;; 토큰 만료 확인
(if (auth-jwt-expired token)
  (server-status 401 "Token expired")
  "OK")
```

### 비밀번호 (scrypt v2 + legacy v1 호환)

```lisp
;; 비밀번호 해싱 (신규: scrypt v2)
(let [hash (auth-hash-password "mypassword123")]
  ;; 저장: "scryptN=16384,r=8,p=1$..." (62자)
  (db-exec db "UPDATE users SET password_hash = ? WHERE id = ?" [hash 1]))

;; 비밀번호 검증 (v1/v2 자동 인식)
(if (auth-verify-password "mypassword123" stored_hash)
  "로그인 성공"
  "비밀번호 불일치")

;; 재해싱 필요 여부 확인 (v1 → v2 마이그레이션)
(if (auth-password-needs-rehash stored_hash)
  (let [new-hash (auth-hash-password password)]
    (db-exec db "UPDATE users SET password_hash = ? WHERE id = ?" [new-hash user_id])))
```

---

## 6. 함수 완전 목록 (모듈별)

### 문자열
- `str`, `str-to-num`, `str-to-upper`, `str-to-lower`, `str-trim`, `str-split`, `str-includes`, `str-starts-with`, `str-ends-with`, `str-replace`, `str-slice`

### 배열/벡터
- `length` / `count`, `push`, `pop`, `shift`, `unshift`, `map`, `filter`, `reduce`, `reverse`, `sort-by`, `includes-item`, `index-of`
- `every?` (모두 만족), `any?` (하나라도 만족 → 첫 값 반환), `none?` (하나도 없음)
- `mapcat`, `map-indexed`, `flatten`, `distinct`, `take`, `drop`, `frequencies`
- `comp` / `compose` (함수 합성), `partial` (부분 적용)

### 객체/맵
- `get`, `assoc`, `obj-merge`, `obj-pick`, `obj-omit`, `obj-keys`, `obj-values`, `obj-entries`
- `get-in` (중첩 접근), `assoc-in` (중첩 갱신), `update-in` (중첩 함수 적용), `dissoc`

### 수학
- `+`, `-`, `*`, `/`, `%`, `inc`, `dec`, `min`, `max`, `abs`, `round`, `floor`, `ceil`, `pow`, `sqrt`

### 논리
- `and`, `or`, `not`, `=`, `!=`, `<`, `>`, `<=`, `>=`, `nil?`, `is-empty`, `nil-or-empty?`
- `??` (nil 병합: 첫 번째 non-nil 값 반환)

### HTTP 서버
- `server-start`, `server-html`, `server-json`, `server-status`, `server-redirect`, `server-file`, `server-html-cookie`, `server-set-cookie`

### 인증 (auth_*)
- `auth-jwt-sign`, `auth-jwt-verify`, `auth-jwt-decode`, `auth-jwt-expired`, `auth-hash-password`, `auth-verify-password`, `auth-password-needs-rehash`, `auth-csrf-token`, `auth-csrf-verify`, `auth-bearer-extract`, `auth-apikey-valid`

### 데이터베이스
- `db-query`, `db-exec`, `db-transaction`

### 파일
- `file-read`, `file-write`, `file-append`, `file-exists`, `file-delete`

### 유틸
- `println`, `uuid`, `now-ms`, `sleep`, `json-parse`, `json-stringify`, `html-escape`, `js-escape`

---

## 7. 에러 처리

### try-catch-finally

```lisp
;; 기본 형태
(try
  (let [[result (db-query db "SELECT ..." [])]]
    (str "Results: " result))
  (catch error
    (str "Error: " (get error "message")))
  (finally
    (println "Cleanup")))

;; Error 객체 구조
{
  "type" "TypeError"          ;; 에러 타입
  "message" "Division by zero" ;; 메시지
  "stack" "at line 42..."      ;; 스택 추적
}
```

### 조건부 실행 (:if)

```lisp
;; 조건 실패 시 이전 값 유지
(let [x (:if (> 5 3) "yes" "no")]
  (println x))  ;; → "yes"

;; 중첩
(:if is-admin
  (handle-admin req)
  (:if is-user
    (handle-user req)
    (handle-guest req)))
```

---

## 8. 실전 앱 미니 예제

### 인증 필요한 API 엔드포인트

```lisp
(define routes {
  :post {
    "/api/users" (fn [req]
      ;; 1. 요청 검증
      (let [[body (get req "body")]
            [email (get body "email")]
            [password (get body "password")]]
        
        ;; 2. 이메일 존재 여부
        (if (nil? email)
          (server-status 400 "Email required")
          
          ;; 3. 비밀번호 해싱
          (let [[hash (auth-hash-password password)]
                [user_id (db-exec db 
                  "INSERT INTO users (email, password_hash) VALUES (?, ?)"
                  [email hash])]]
            
            ;; 4. JWT 토큰 생성
            (let [token (auth-jwt-sign {:user_id user_id :email email} "secret" 86400)]
              
              ;; 5. 쿠키 설정
              (let [cookie (server-set-cookie "auth" token {:max_age 86400})]
                (server-json-cookie {"status" "created" "token" token} cookie)))))))
    }
  }
})
```

### 파일 업로드 + HTML 응답

```lisp
(defn upload-page [req]
  ;; HTML + CSS + JS 분리 (best practice)
  (let [[html (file-read "app/upload.html")]
        [css  (file-read "app/upload.css")]
        [js   (file-read "app/upload.js")]]
    (server-html (html-inject html {"css" css "js" js}))))

;; helper: html-inject는 AKL 표준
;; (html-inject html {"css" "..." "js" "..."})
;;   → CSS는 </head> 전에, JS는 </body> 전에 주입
```

---

## ⚠️ 자주 실수하는 것

| 실수 | 원인 | 수정 |
|------|------|------|
| `(defn f [])` 파라미터 없음 | 함수명 없이 정의 | `(defn f [a b] ...)` |
| `(get body "key")` → body 미정의 | let 바인딩 빠짐 | `(let [body (get req "body")] ...)` |
| `(server_listen 3000)` | 구버전 함수명 | `(server-start 3000)` |
| `(server-html (str html css))` → 이중 이스케이프 | 문자열 자체를 이스케이프 | `(html-inject html {"css" css})` |
| `(db-query db sql)` → 파라미터 배열 누락 | 바인드 변수 누락 | `(db-query db "..." [var1 var2])` |
| `(auth_jwt_sign ...)` 언더스코어 | 함수명은 kebab-case | `(auth-jwt-sign ...)` |

**$ 없이도 완전히 동작** — `$`는 선택사항이며 생략해도 됩니다.

---

## 🔗 추가 레퍼런스

- **전체 함수 목록**: `docs/STDLIB_REFERENCE.md`
- **버전 히스토리**: `docs/CHANGELOG.md`
- **언어 정식 명세**: `docs/OFFICIAL_LANGUAGE.md`
- **AI 시스템 프롬프트**: `docs/AI_SYSTEM_PROMPT.md` (문법 상세)

---

**핵심 정리**: $ 파라미터 + kebab-case 함수 + 맵은 문자열 키 + let 바인딩 이중대괄호 — 이 3가지만 지켜도 v11 코드 90% 정확.

