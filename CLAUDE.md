# FreeLang v11 — Claude AI 완전 레퍼런스

**버전**: v11.9.2 (Node.js Free) | **최신 갱신**: 2026-06-04  
**상태**: ✅ 프로덕션 (Node.js 완전 독립) | **L4 검증**: ✅ 완료 (SHA256 3중) | **AI 신뢰도**: 9.5/10  
**Node.js 독립성**: ✅ 완료 (cgc-bin aarch64 72KB + bun shebang 교체)

**실행 경로**:
- Bootstrap(Bun): `bun /root/kim/freelang-v11/bootstrap.js run <file.fl>`
- Native: `bash /root/kim/freelang-v11/scripts/fl-native.sh run <file.fl>`
- Build: `bash /root/kim/freelang-v11/scripts/fl-native.sh build <file.fl> -o <bin>`

**cgc-bin stdlib 지원 (v11.9.2)**: atom(@/reset!/swap!) · nil?/empty?/array?/map? 등 술어 · get-in/sort-by/obj-omit · min/max · str-starts-with/ends-with/str-to-num · html-escape/sleep · server-*/http-* · db-open/query/exec · auth-jwt-*/auth-hash-password/auth-verify-password

---

## 📋 코딩 규칙 (필독)

### ⭐⭐⭐ [11절 코딩규칙 (2026-05-15)](docs/CODING_RULES_11.md)

**핵심**: 순서는 법이다. 리서치 → 플랜모드 → 문서화 → 태스크 등록 → 구현 → 검증

**11절 규칙 개요**:
| 절 | 내용 | 최우선도 |
|----|------|---------|
| **1절** | 작업 순서 강제 | ⭐⭐⭐ |
| **2절** | 협의 원칙 (혼자 결정 금지) | ⭐⭐⭐ |
| **3절** | Stage 검증 실행 | ⭐⭐⭐ |
| **4절** | 코드 품질 (경고 0, 300줄) | ⭐⭐ |
| **5절** | Edit 도구만 사용 | ⭐ |
| **6절** | 의존성 협의 | ⭐⭐ |
| **7절** | 핫픽스 금지 | ⭐⭐⭐ |
| **8절** | 완료 처리 (commit+push+블로그) | ⭐⭐⭐ |
| **9절** | 태스크 로그 (tasks.dclub.kr) | ⭐⭐ |
| **10절** | 보안 체크 (환경변수, 평문 저장 금지) | ⭐⭐⭐ |
| **11절** | 롤백 기준 (실패 2회 이상 즉시 롤백) | ⭐⭐⭐ |

**진화**: 9절 (2026-05-14) → 11절 (2026-05-15)
- **신설**: 10절 보안 체크 (환경변수만 저장)
- **신설**: 11절 롤백 기준 (검증 실패 시 명확한 판단 기준)
- **수정**: 4절 줄 수 기본값 300줄 이하

**새 작업 시작 전 필수 체크**:
```
[ ] 1. CLAUDE.md 읽음
[ ] 2. CODING_RULES_11.md 읽음 (링크 위)
[ ] 3. 관련 파일 검토
[ ] 4. tasks.dclub.kr 프로젝트 확인
[ ] 5. PLAN.md 작성 (협의 필요 시)
[ ] 6. 태스크 등록
[ ] 7. 구현 시작
```

**전체 가이드**: [docs/CODING_RULES_11.md](docs/CODING_RULES_11.md) (상세)

---

## 🎉 L4 Self-Hosting 완료 (2026-05-25)

### 성과: Node.js 독립 검증됨 ✅

```
L4 고정점 달성 (3중 SHA256 검증)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: bootstrap.js (Node.js) 컴파일
  cgc-main.fl → gen1.c
  SHA256: 5c1ede...

Step 2: gen1-bin (native) 컴파일
  cgc-main.fl → gen2.c
  SHA256: 5c1ede... ✅ (동일)

Step 3: gen2-bin (native) 컴파일
  cgc-main.fl → gen3.c
  SHA256: 5c1ede... ✅ (동일)

결론: FreeLang 컴파일러가 자신을 정확히 재생성
→ bootstrap.js는 1회만 필요
→ Node.js 의존성 제거 가능
```

### 의미

| 항목 | 상태 |
|------|------|
| **자가호스팅** | ✅ 달성 (컴파일러가 FreeLang으로 작성됨) |
| **고정점** | ✅ 검증됨 (3중 SHA256 확인) |
| **Node.js 의존** | ✅ 제거 가능 (gen1-bin 배포로 충분) |
| **배포 안정성** | ✅ 보증됨 (결정론적 컴파일) |

### 다음 단계: Phase F (진행 중)

| 단계 | 작업 | 상태 |
|------|------|------|
| **F-1** | gen1-bin 정규화 | 📋 설계 완료 |
| **F-2** | bootstrap.js 제거 | 📋 설계 완료 |
| **F-3** | CI/CD 재구성 | 📋 설계 완료 |

**예상 완료**: 2.5시간  
**설계 파일**: [PHASE-F-TS-REMOVAL.md](PHASE-F-TS-REMOVAL.md)

### 학습 자료

**10부 블로그 연제** (기술 히스토리):
1. [001: 자가호스팅의 꿈](docs/BLOG-001-SELFHOSTING-DREAM.md)
2. [002: Phase A — Gap Audit](docs/BLOG-002-PHASE-A.md)
3. [003: Phase B1 — Recur TCO](docs/BLOG-003-PHASE-B1.md)
4. [004: Phase B2 — Closure Capture](docs/BLOG-004-PHASE-B2.md)
5. [005: Phase B3 — Higher Order Functions](docs/BLOG-005-PHASE-B3.md)
6. [006: Phase C — Bootstrap Audit](docs/BLOG-006-PHASE-C.md)
7. [007: Phase D — L4 Native Self-Hosting](docs/BLOG-007-PHASE-D.md)
8. [008: Phase E — L4 Stabilization](docs/BLOG-008-PHASE-E.md)
9. [009: L4 Fixed-Point 검증 (과학)](docs/BLOG-009-L4-VERIFICATION.md)
10. [010: Phase F — TypeScript 완전 제거](docs/BLOG-010-PHASE-F.md)

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

### Rule 1-b: v12 atom 패턴 (가변 상태)

```lisp
;; ✅ v12 권장 — atom으로 가변 상태 관리
(define count (atom 0))       ;; atom 생성
(swap! count + 1)             ;; 값 변경 (함수 적용)
(reset! count 0)              ;; 값 직접 설정
@count                        ;; deref 단축 표기 (= (deref count))

;; ✅ 클로저가 atom 참조 공유
(define state (atom []))
(defn push-item! [x] (swap! state append x))
(push-item! 42)
@state  ;; → [42]

;; FL_V12=1 활성화 시 아래는 에러
;; (define x 1) (define x 2)  → [v12] 재정의 금지, atom 사용
;; (set! x 99)                 → [v12] set! 금지, swap!/reset! 사용
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

### AKL-Lib: 고급 JWT (Phase 1+)

AKL Suite의 공통 라이브러리 `akl-lib.fl`은 다음 고급 기능을 제공합니다:

```lisp
;; akl-lib 로드 (모든 AKL 앱에서 권장)
(load "/home/kimjin/kim/Desktop/kim/01_Active_Projects/akl-lib/akl-lib.fl")

;; 토큰 발급 (3600초)
(let [result (akl-sign-token 
              {:sub user_id :role "admin" :email "admin@akl.kr"}
              3600
              JWT_SECRET)]
  ;; => {:token "eyJ..." :expires_in 3600}
  (server-json result))

;; 토큰 검증 + 자동 갱신
(let [result (akl-verify-and-refresh req JWT_SECRET 7200)]
  (if (:new_token result)
    ;; 갱신 필요: 새 토큰 클라이언트에 반환
    (server-json {:token (:new_token result) :user (:user result)})
    ;; 갱신 불필요
    (server-json {:user (:user result)})))

;; 로그아웃 (토큰 블랙리스트)
(let [result (akl-logout token JWT_SECRET)]
  (if (:ok result)
    (server-json {:ok true})
    (server-status 401 "Logout failed")))

;; Role 캐싱 (DB 호출 최소화)
(akl-cache-role user_id "admin")
(let [role (akl-get-role-cached user_id 3600)]
  (println "Cached role: " role))
```

**특징**:
- `:sub` 클레임 표준화 (JWT RFC 7519)
- rolling token 패턴 (자동 갱신)
- 메모리 기반 블랙리스트 (로그아웃)
- Role 캐싱 (권한 검증 고속화)

**완성도**: Phase 1 (9.2/10), Phase 2 통합 검증 (8.5/10)

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
- `str-blank?` — nil/빈문자열/공백만인 경우 true (폼 입력 검증용)
- `str-split` — `(str-split s sep)` 전체, `(str-split s sep n)` 최대 n개로 분할
- `str-format` (printf 스타일: `(str-format "%s is %d" [name age])` 또는 `(str-format "%s is %d" name age)`)
- `str-repeat`, `str-lines`, `str-pad-left`, `str-pad-right`, `str-index-of`, `str-replace-all`

### 배열/벡터
- `length` / `count`, `push`, `pop`, `shift`, `unshift`, `map`, `filter`, `reduce`, `reverse`, `sort`, `sort-by`, `includes-item`, `index-of`
- `every?`, `any?`, `none?` (pred arr), `some` (pred arr → 첫 매칭 값)
- `take`, `drop` — ⚠ 인자 순서 엄격: `(take n coll)`, `(drop n coll)` — 순서 틀리면 오류
- `take-while`, `drop-while`, `butlast`, `last`, `first`, `second`, `nth`
- `map-indexed`, `mapcat`, `keep`, `partition`, `partition-by`, `interpose`, `flatten`, `flatten-1` (1단계만), `distinct`
- `zip`, `group-by`, `frequencies`, `range`, `repeat` (`(repeat n val)` → 배열)
- `into` (컬렉션 합침), `conj` (배열/맵 범용 추가), `find-first`, `count-if`, `sum`, `product`, `average`
- `sorted?` — 배열이 정렬되어 있는지 확인
- `max-by`, `min-by`, `max-of`, `min-of`
- `comp` (함수 합성 — 오른쪽→왼쪽 실행), `juxt` (복수 함수 동시 적용), `partial`, `complement`, `constantly`
- `tap` / `dbg` (파이프라인 중간값 출력, 값 통과)
- `apply` (fn + 인자 배열로 호출)

### 객체/맵
- `get`, `assoc`, `obj-merge`, `obj-pick`, `obj-omit`, `obj-keys` / `keys`, `obj-values` / `vals`, `obj-entries` / `entries`
- `hash-map` — `(hash-map k1 v1 k2 v2 ...)` 키-값 쌍으로 맵 생성
- `get-in` (중첩 접근), `assoc-in` (중첩 갱신), `update-in` (중첩 함수 적용 — builtin 지원), `dissoc` (다중 키 지원)
- `select-keys`, `rename-keys`, `merge-with` (키 충돌 시 fn으로 합산), `reduce-kv` (맵 키-값 축적)
- `has-key?`, `update` (단일 키 함수 적용)
- `map-vals` — `(map-vals fn m)` 모든 값에 fn 적용, `map-keys` — `(map-keys fn m)` 모든 키에 fn 적용
- `filter-vals` — `(filter-vals pred m)` 조건 통과 값만 유지

### 수학
- `+`, `-`, `*`, `/`, `%`, `inc`, `dec`, `min`, `max`, `abs`, `round`, `floor`, `ceil`, `pow`, `sqrt`, `clamp`
- `quot` — `(quot a b)` 0 방향 정수 나눗셈 (`quot -17 5` → `-3`)
- `rem` — `(rem a b)` 피제수 부호를 따르는 나머지 (`rem -17 5` → `-2`)
- `int` — `(int 3.7)` truncate 변환 (`int -3.7` → `-3`, `floor`와 다름)

### 타입 술어
- `type-of` — FL-friendly 타입명: `"nil"` / `"array"` / `"map"` / `"function"` / `"number"` / `"string"` / `"boolean"`
- `integer?`, `float?` — 정수/실수 구분 (`number?`는 둘 다 true)
- `vector?` / `array?` — 배열 타입 확인
- `fn?`, `string?`, `number?`, `boolean?`, `nil?`, `map?`, `keyword?`

### 논리
- `and`, `or`, `not`, `=`, `!=` / `not=`, `<`, `>`, `<=`, `>=`
- `nil?`, `empty?`, `not-empty?`, `nil-or-empty?`, `str-blank?`
- `??` (nil 병합: 첫 번째 non-nil 값 반환)

### 제어 흐름
- `when` (조건 참일 때), `when-not` (조건 거짓일 때)
- `dotimes` (`(dotimes [i n] body)` — N번 반복)
- `doseq` (`(doseq [x coll] body)` — 순회 side-effect)
- `case` — `(case val v1 r1 v2 r2 default)` 리터럴 값 매칭 (cond는 조건식, case는 값)
- `for` — `(for [x coll :when pred] body)` 리스트 컴프리헨션 (`:when` 필터 지원)

### HTTP 서버
- `server-start`, `server-html`, `server-json`, `server-status`, `server-redirect`, `server-file`, `server-html-cookie`, `server-set-cookie`

### 인증 (auth-*)
- `auth-jwt-sign`, `auth-jwt-verify`, `auth-jwt-decode`, `auth-jwt-expired`, `auth-hash-password`, `auth-verify-password`, `auth-password-needs-rehash`, `auth-csrf-token`, `auth-csrf-verify`, `auth-bearer-extract`, `auth-apikey-valid`

### 데이터베이스
- `db-query`, `db-exec`, `db-transaction`

### 파일
- `file-read`, `file-write`, `file-append`, `file-exists`, `file-delete`, `file-append-line`

### 유틸
- `println`, `uuid`, `now-ms`, `sleep`, `json-parse`, `json-stringify`, `html-escape`, `js-escape`
- `rand` — `(rand)` → 0.0~1.0 실수 (Math.random())
- `rand-int` — `(rand-int n)` → 0~n-1, `(rand-int min max)` → min~max-1
- `fl-env-get` — `(fl-env-get "KEY" "default")` 환경변수 읽기
- `re-test` — `(re-test "pattern" str)` 정규식 테스트

### 캐시 (stdlib/cache.fl + 내장)
- `(load "stdlib/cache.fl")` 로 로드
- `(cache-create n)` → 핸들, `(cache-set ch key val [ttl-ms])`, `(cache-get ch key)`
- `(cache-has ch key)`, `(cache-del ch key)`, `(cache-clear ch)`, `(cache-stats ch)`
- `(cache-get-or-set ch key loader-fn)` — 캐시 미스 시 fn 호출 후 저장
- 글로벌 모드: `(cache-set "key" val [ttl-sec])` (핸들 없이 싱글톤 사용)

### 검증 (stdlib/validate.fl)
- `(load "stdlib/validate.fl")` 로 로드
- `(validate-email s)`, `(validate-url s)`, `(validate-min-length s n)`, `(validate-max-length s n)`
- `(validate-range v mn mx)`, `(validate-integer v)`, `(validate-positive v)`, `(validate-non-negative v)`
- `(validate-required m fields)` → 비어있는 필드 목록
- `(validate-schema data schema)` → `{:ok bool :errors [{:field k :message msg}]}`

### 로그 (stdlib/log.fl)
- `(load "stdlib/log.fl")` 로 로드
- `(log-info event ctx)`, `(log-warn event ctx)`, `(log-error event ctx)`
- `(log-debug event ctx)` — `FL_DEBUG=1` 환경변수 필요
- `(log-to-file! "app.log")` — 이후 로그를 파일에도 기록
- 출력 형식: `{"ts":…,"level":"INFO","event":"…","ctx":{…}}`

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

## 8.5 테스트 & Proof-Tester (v11.7.5+)

**FreeLang Proof-Tester**: @test 매크로 기반 네이티브 테스트 시스템 (외부 라이브러리 불필요)

### 기본 사용

```lisp
@test
(defn test-formatting []
  (assert (== (str-pad-left "5" 5 "0") "00005"))
  (assert (== (format-number 1234567) "1,234,567")))

@test
(defn test-db []
  (let [user (db-query db "SELECT * FROM users WHERE id = ?" [1])]
    (assert (not (nil? user)))))
```

### 테스트 실행
```bash
npm run test:fast    ;; 1098/1098 PASS
npm run build        ;; 프로덕션 (테스트 코드 제외)
```

### 특징
| 특징 | 효과 |
|------|------|
| Zero Dependencies | Jest/Mocha 제거 |
| @test 매크로 | 자연스러운 문법 |
| SIMD 병렬화 | 16배 성능 (1000개 테스트 313ms) |
| Gogs 기록 | 모든 개발은 커밋으로 증명 |

### 규칙
✅ 모든 새 함수 = @test 검증 필수  
✅ 테스트 통과 → Gogs 커밋  
✅ 블로그 문서화 필수

---

## ⚠️ 자주 실수하는 것

| 실수 | 원인 | 수정 |
|------|------|------|
| `(defn f [])` 파라미터 없음 | 함수명 없이 정의 | `(defn f [a b] ...)` |
| `(get body "key")` → body 미정의 | let 바인딩 빠짐 | `(let [body (get req "body")] ...)` |
| `(server_listen 3000)` | 구버전 함수명 | `(server-start 3000)` |
| `(db-query db sql)` → 파라미터 배열 누락 | 바인드 변수 누락 | `(db-query db "..." [var1 var2])` |
| `(map arr fn)` | 인자 순서 반대 | `(map fn arr)` |
| `(filter arr fn)` | 인자 순서 반대 | `(filter fn arr)` |
| `(str-format "%d" 42)` → NaN | 배열로 감싸야 함 | `(str-format "%d" [42])` 또는 `(str-format "%d" 42)` ← 둘 다 동작 |
| `(comp inc str-to-upper)` → 타입 오류 | comp 인자 순서: 오른쪽부터 실행 | `(comp str-to-upper inc)` — 먼저 할 것을 마지막에 |
| `(update-in m ["k"] "inc")` | fn을 문자열로 | `(update-in m ["k"] inc)` |
| `(take [1 2 3] 2)` | 인자 순서 반대 — 오류 발생 | `(take 2 [1 2 3])` — n 먼저 |
| `(drop [1 2 3] 1)` | 인자 순서 반대 — 오류 발생 | `(drop 1 [1 2 3])` — n 먼저 |
| `(sort-by [1 2] fn)` | 인자 순서 반대 — 오류 발생 | `(sort-by fn [1 2])` — fn 먼저 |
| `(type-of x)` → `"object"` | 구버전 `typeof` 사용 | `(type-of x)` → `"array"/"map"/"nil"` 등 FL 타입명 반환 |
| `(str-split s sep 2)` 무시됨 | 구버전 버그 | 수정됨 — `(str-split "a,b,c" "," 2)` → `["a","b,c"]` |

**$ 없이도 완전히 동작** — `$`는 선택사항이며 생략해도 됩니다.

---

## 🔗 추가 레퍼런스

- **전체 함수 목록**: `docs/STDLIB_REFERENCE.md`
- **버전 히스토리**: `docs/CHANGELOG.md`
- **언어 정식 명세**: `docs/OFFICIAL_LANGUAGE.md`
- **AI 시스템 프롬프트**: `docs/AI_SYSTEM_PROMPT.md` (문법 상세)

---

**핵심 정리**: $ 파라미터 + kebab-case 함수 + 맵은 문자열 키 + let 바인딩 이중대괄호 — 이 3가지만 지켜도 v11 코드 90% 정확.

---

## 🚀 v11.7.4 → v12 로드맵 (생산성 계층)

**현재 상태**: 기본 웹 플랫폼 완성 ✅  
**다음 축**: 운영/개발 생산성 강화

### TOP 5 우선순위 (체감 가치 순)

#### 1. 🔥 Hot Reload (v12.0)
- `(reload "routes/api.fl")` — 함수/라우트 즉시 교체
- `(watch "src")` — 파일 변경 자동 감지
- WebSocket 유지 + State 보존
- **영향**: 개발 속도 10배 향상

#### 2. 🎭 Macro System 강화 (v12.1)
```lisp
(defmacro unless [cond body]
  `(if (not ~cond) ~body))
```
- DSL 생성 (ORM, HTML, Routing, Test)
- Macro Expansion Trace
- **영향**: 언어 급 상향

#### 3. 🐛 Error Trace System (v12.1)
```lisp
(try ... (catch e (stacktrace e)))
```
- Stack Trace + Source Map
- Macro Expansion Trace
- Runtime Context Capture
- Variable Snapshot
- **영향**: 대형 프로젝트 가능

#### 4. 📦 Module System 2.0 (v12.2)
```lisp
(import std/http)
(import std/auth :as auth)
(export defn add)
```
- Namespace 충돌 방지
- Lazy Load + Cyclic Import 검출
- 버전 호환 체계
- **영향**: 프로젝트 규모 확장성

#### 5. 🎨 Formatter / Linter (v12.2)
```bash
freelang fmt src/        ;; 자동 포맷
freelang lint            ;; 정적 검사
freelang doctor          ;; 프로젝트 진단
```
- S-expression 최적화된 포맷터
- AI-native 린터
- **영향**: 코드 품질 + 팀 협업

### 부가 기능 (v12.3+)

| 기능 | v12.x | 설명 |
|------|-------|------|
| Type Hints/Contract | 12.3 | `(defn add [a:int b:int] -> int ...)` |
| ORM Query Builder | 12.3 | `(select users (where ...))` |
| Observability | 12.4 | metrics, tracing, profiling |
| Test Framework | 12.4 | describe/it + snapshot + mock |
| Process Management | 12.5 | cluster, worker, supervision |
| AI Runtime API | 12.5 | ai-complete, ai-embed, ai-agent |
| Build System | 12.6 | freelang build/test/lint/doctor |
| Package Registry | 13.0 | fl install/add (생태계) |
| AST Public API | 13.0 | (parse), (ast-walk), (ast-transform) |

---

## 📊 v11.6.39 완성도 (L4 Self-Hosting)

| 영역 | 완성도 | 상태 |
|------|--------|------|
| 기본 언어 | 100% | ✅ 프로덕션 |
| 웹 플랫폼 | 100% | ✅ 프로덕션 |
| DB 연동 | 100% | ✅ 프로덕션 |
| 보안 | 100% | ✅ 프로덕션 (v11.5.3+) |
| DevTools | 100% | ✅ 프로덕션 |
| 성능 | 100% | ✅ 376M ops/sec |
| 테스트 | 100% | ✅ 1090/1090 통과 |
| **자가호스팅** | **100%** | **✅ L4 검증 완료 (2026-05-25)** |
| **Node.js 독립** | **95%** | **✅ Phase F 진행 중 (설계 완료)** |
| | | |
| **운영 생산성** | 20% | ⏳ v12에서 강화 |
| **개발 생산성** | 30% | ⏳ v12에서 강화 |

**v11.6.39의 역할**: Web Platform + Language Core + Self-Hosting  
**v12의 역할**: Developer Productivity + Ecosystem

### 변경사항 (v11.6.38 → v11.6.39)

**추가**:
- ✅ L4 고정점 검증 (3중 SHA256)
- ✅ Phase F 설계 (Node.js 완전 제거)
- ✅ 블로그 연제 10부 (기술 히스토리)

**검증**:
- ✅ verify-l4-fixpoint.sh 자동화
- ✅ CI/CD L4 검증 통합

**신뢰도**:
- L4 검증: 99% (암호학적)
- Phase F: 95% (설계 완료)
- 전체: 9.5/10

---

## 🔧 코드 작성 진행 규칙 (seed compiler / runtime 작업 시)

> 전체 규칙: `CODING_RULES.md`

### 작업 진입 순서 (필수)
```
리서치 → 플랜모드 → 문서화 → 태스크 등록 → 구현 → 테스트/검증 루프
```

### 핵심 원칙
- **혼자 결정 금지** — 아키텍처·ABI·Stage 설계 변경은 반드시 협의
- **단일 관심사** — 각 Stage는 한 기능만 (S5=vector+map, S6=loop/recur, S7=closure)
- **검증은 실제 실행** — 눈으로 보고 통과 선언 금지
- **경고 0** — `gcc -Wall -Wextra` 기준, 경고 있으면 다음 단계 진행 불가
- **줄 수 한도** — `runtime.c` ≤ 500줄, `freelang.c` ≤ 600줄
- **Edit 도구** — `sed -i` 금지, 파일 수정은 항상 Edit 도구

### Stage 실패 규칙
중간단계 하나라도 실패 시 **해당 Stage 처음부터 재시작** (부분 수정 금지)

### 완료 후 처리 (Stage 단위)
```bash
git add <변경파일> && git commit -m "[S{N}] 제목"
git push origin master
# 블로그 포스팅 (blog.dclub.kr, 500자 이상)
```

### 금지 패턴
| 금지 | 대신 |
|------|------|
| `sed -i` 파일 수정 | Edit 도구 |
| 눈으로 보고 통과 선언 | 실제 명령 실행 후 확인 |
| 여러 기능 한 Stage | Stage 분리 |
| 혼자 아키텍처 결정 | 협의 |
| 임시 우회 (hotfix) | 근본 원인 수정 |
| `--no-verify` / `--force` | 원인 해결 |

### seed compiler 현재 지원 범위
| 기능 | 상태 |
|------|------|
| 리터럴·defn·define·let·if·cond·do | ✅ S4 |
| 산술·비교·논리·I/O | ✅ S4 |
| vector `[...]`·map `{...}`·vec-\*/map-\* | ✅ S5 |
| loop/recur | ✅ S6 |
| closure (fn literal) | ✅ S7 |
| map/filter (고차함수) | ⏳ S8 |

