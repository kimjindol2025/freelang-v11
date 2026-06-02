# FreeLang v11 — AI 함수 명세

> AI(Claude) 전용. 함수 이름·인자 순서·실수 패턴 집중 정리.
> 최종 갱신: 2026-06-02

---

## ⚠️ AI 자주 틀리는 패턴 (최우선 확인)

```
❌ (map arr fn)      ✅ (map fn arr)       ; fn 먼저
❌ (filter arr fn)   ✅ (filter fn arr)    ; fn 먼저
❌ (sort-by arr fn)  ✅ (sort-by fn arr)   ; fn 먼저
❌ (take arr n)      ✅ (take n arr)       ; n 먼저
❌ (drop arr n)      ✅ (drop n arr)       ; n 먼저
❌ (str-includes sub s) ✅ (str-includes s sub)  ; s 먼저
❌ (assoc m :k v)    ✅ (assoc m "k" v)   ; 문자열 키
❌ (def x 1)         ✅ (define x 1)
❌ (merge a b)       ✅ (obj-merge a b)
```

---

## 문자열

```
(str v1 v2 ...)                    → 문자열 연결
(str-includes s sub)               → boolean
(str-starts-with s prefix)         → boolean
(str-ends-with s suffix)           → boolean
(str-split s sep)                  → [string]
(str-split s sep n)                → 최대 n개로 분할
(str-replace s old new)            → string (첫 번째만)
(str-replace-all s old new)        → string (전체)
(str-trim s)                       → string
(str-to-upper s)                   → string
(str-to-lower s)                   → string
(str-to-num s)                     → number | nil
(str-slice s start end)            → string
(str-pad-left s n ch)              → string
(str-pad-right s n ch)             → string
(str-index-of s sub)               → number (-1이면 없음)
(str-blank? s)                     → boolean (nil/빈/공백)
(str-format "%s %d" v1 v2)         → string (printf 스타일)
(str-lines s)                      → [string]
(str-join sep arr)                 → string   ← sep 먼저!
(str-repeat s n)                   → string
(str-count s sub)                  → number (등장 횟수)
```

**삼중따옴표 보간:**
```fl
(let [name "Kim"]
  """<h1>${name}</h1>""")          ; 변수 보간 가능
```

---

## 배열

```
; 생성
(range start end)                  → [number]  (end 미포함)
(repeat n val)                     → [val, val, ...]

; 기본
(length arr)                       → number
(first arr)                        → any | nil
(last arr)                         → any | nil
(rest arr)                         → [any] (첫 번째 제외)
(nth arr n)                        → any

; 변환 — fn 먼저!
(map fn arr)                       → [any]
(filter fn arr)                    → [any]
(reduce fn init arr)               → any
(map-indexed fn arr)               → [any]  ; fn받는 인자: (idx val)

; 순서
(reverse arr)                      → [any]
(sort arr)                         → [any]
(sort-by fn arr)                   → [any]   ← fn 먼저!

; 슬라이싱 — n 먼저!
(take n arr)                       → [any]   ← n 먼저!
(drop n arr)                       → [any]   ← n 먼저!
(take-while fn arr)                → [any]
(drop-while fn arr)                → [any]

; 추가/제거
(push arr val)                     → [any] (불변)
(conj arr val)                     → [any]
(into arr1 arr2)                   → [any]

; 검색
(includes-item arr val)            → boolean
(index-of arr val)                 → number
(find-first fn arr)                → any | nil
(some fn arr)                      → any | nil
(every? fn arr)                    → boolean
(any? fn arr)                      → boolean

; 집계
(sum arr)                          → number
(average arr)                      → number
(count-if fn arr)                  → number
(distinct arr)                     → [any]
(flatten arr)                      → [any]
(flatten-1 arr)                    → [any] (1단계만)
(group-by fn arr)                  → {key: [items]}
(frequencies arr)                  → {val: count}
(zip arr1 arr2)                    → [[a,b], ...]
(partition n arr)                  → [[any], ...]

; arr_ 접두사 버전 (snake_case)
(arr-take arr n)                   → [any]   ; 주의: 인자 순서 반대!
(arr-drop arr n)                   → [any]
(arr-includes arr item)            → boolean
(arr-unique arr)                   → [any]
(arr-flatten arr)                  → [any]
(arr-sum arr)                      → number
(arr-group-by arr key)             → {key: [items]}  ; key는 문자열
(arr-sort-by arr key)              → [any]            ; key는 문자열
(arr-pluck arr key)                → [any]
```

---

## 맵/객체

```
; 읽기
(get m key)                        → any | nil
(get m key default)                → any
(get-in m [k1 k2])                 → any | nil
(get-in m [k1 k2] default)         → any
(?. m :k1 :k2)                     → any | nil (nil 안전 접근)
(?? a b)                           → a가 nil이면 b

; 쓰기 (불변)
(assoc m "key" val)                → map  ← 반드시 문자열 키
(assoc-in m ["k1" "k2"] val)       → map
(dissoc m "key")                   → map
(update m "key" fn)                → map
(update-in m ["k"] fn)             → map

; 병합/변환
(obj-merge m1 m2)                  → map
(obj-pick m ["k1" "k2"])           → map
(obj-omit m ["k1" "k2"])           → map
(obj-keys m)                       → [string]
(obj-values m)                     → [any]
(obj-entries m)                    → [[k,v], ...]
(map-vals fn m)                    → map
(map-keys fn m)                    → map
(filter-vals fn m)                 → map
(has-key? m "key")                 → boolean
(select-keys m ["k1" "k2"])        → map
(rename-keys m {"old" "new"})      → map
(merge-with fn m1 m2)              → map

; 키워드 접근 (:key 형태도 동작)
(get user :name)                   → "Alice"
(assoc user :email "a@b.com")      → map  ; :keyword → "keyword" 자동 변환
```

---

## 제어 흐름

```
(if cond then else)
(when cond body)
(when-not cond body)
(cond
  (= x 1) "one"
  (= x 2) "two"
  :else "other")
(case x
  1 "one"
  2 "two"
  "default")
(do expr1 expr2 ...)               → 마지막 값
(let [x 1 y 2] body)
(loop [i 0] (if (< i 10) (recur (inc i)) i))
(for [x arr :when (> x 0)] (* x 2))
(dotimes [i 5] (println i))
(doseq [x arr] (println x))
(try body (catch e handler) (finally cleanup))
```

---

## 타입 체크

```
(nil? x)          (not (nil? x))
(string? x)       (number? x)       (boolean? x)
(array? x)        (map? x)          (fn? x)
(integer? x)      (float? x)
(empty? x)        (not-empty? x)    (nil-or-empty? x)
(str-blank? x)                      ; nil/빈/공백
(type-of x)       → "nil"|"string"|"number"|"boolean"|"array"|"map"|"function"
```

---

## 서버/HTTP

```
; 서버 시작
(server-start 40001)

; 라우트 등록
(server-get "/path" (fn [req] response))
(server-post "/path" (fn [req] response))
(server-put "/path" (fn [req] response))
(server-delete "/path" (fn [req] response))

; 응답
(server-html "<h1>hi</h1>")
(server-json {:ok true :data []})
(server-status 404 "Not Found")
(server-redirect "/login")
(server-file "/path/to/file" "mime/type")
(server-text "plain text")
(let [c (server-set-cookie "name" "val" {:max_age 3600})]
  (server-html-cookie "<h1>ok</h1>" c))

; 요청 파싱
(get req "method")                 → "GET"
(get req "path")                   → "/api/users"
(get req "body")                   → map (JSON 자동 파싱)
(get req "query")                  → map
(get req "params")                 → map (경로 파라미터)
(get req "headers")                → map
(get req "cookies")                → map
; 또는 헬퍼:
(server-req-param req "id")
(server-req-query req "page")
(server-req-header req "authorization")
(server-req-cookie req "session")

; 외부 HTTP
(http-get "https://api.example.com/data")  → {ok, status, body}
(http-post-json "https://..." {:key "val"})
(http-ok? result)                  → boolean
(http-body result)                 → parsed body
```

---

## 데이터베이스 (MariaDB/SQLite)

```
(define db {"host" "localhost" "port" 3306
            "user" "u" "password" "p" "database" "db"})

(db-query db "SELECT * FROM t WHERE id=?" [id])   → [row, ...]
(db-exec  db "INSERT INTO t (a) VALUES (?)" [val]) → result
(db-transaction db (fn [] ...))
```

---

## 인증

```
(auth-jwt-sign {:user_id 1} "secret" 3600)        → token
(auth-jwt-verify token "secret")                   → payload | nil
(auth-jwt-expired token)                           → boolean
(auth-hash-password "pass123")                     → hash
(auth-verify-password "pass123" hash)              → boolean
(auth-csrf-token "secret")                         → token
(auth-csrf-verify token "secret")                  → boolean
(auth-bearer-extract req)                          → token | nil
```

---

## 파일

```
(file-read "/path/to/file")        → string
(file-write "/path" "content")     → boolean
(file-append "/path" "content")    → boolean
(file-exists "/path")              → boolean
(file-delete "/path")              → boolean
(file-exists? "/path")             → boolean  ; ? 버전도 동작
```

---

## 환경변수 / 유틸

```
(fl-env-get "KEY" "default")       → string  ; process.env 읽기
(now-ms)                           → number (Unix ms)
(uuid)                             → string
(sleep ms)                         → nil
(println v1 v2)                    → nil
(json-parse str)                   → any
(json-stringify val)               → string
(html-escape str)                  → string
(js-escape str)                    → string
(rand)                             → 0.0~1.0
(rand-int n)                       → 0~n-1
(rand-int min max)                 → min~max-1
(format-date ms "YYYY-MM-DD")      → string
(re-test "pattern" str)            → boolean
(inc n)  (dec n)
(abs n)  (round n)  (floor n)  (ceil n)
(min a b)  (max a b)  (pow a b)  (sqrt n)
(mod a b)  (quot a b)  (rem a b)
```

---

## atom / 상태 (Island에서 사용)

```
(atom 0)                           → atom
@atom                              → 현재 값 (deref 단축)
(deref atom)                       → 현재 값
(swap! atom fn)                    → 새 값  ; fn: oldVal → newVal
(reset! atom val)                  → val

; 글로벌 store (Island 간 공유)
(get-store "key")                  → any
(dispatch "key" val)               → nil
(watch-store fn)                   → unsubscribe-fn
```

---

## 함수형 유틸

```
(comp f g)                         → (fn [x] (f (g x)))  ; 오른쪽→왼쪽
(partial fn arg1)                  → fn
(complement fn)                    → fn (결과 반전)
(constantly val)                   → (fn [& _] val)
(juxt f g)                         → (fn [x] [(f x) (g x)])
(apply fn arr)                     → fn 호출
(tap val fn)                       → val (side-effect용)
```

---

## AI 오류 방지 체크리스트

작성 전 확인:

- [ ] `map`/`filter`/`sort-by` → fn이 첫 번째 인자
- [ ] `take`/`drop` → n이 첫 번째 인자
- [ ] `assoc` → 키는 반드시 문자열 (`"key"` not `:key`)
- [ ] `str-join` → sep이 첫 번째 인자
- [ ] `db-query` → params는 벡터 `[val1 val2]`
- [ ] `(define x 1)` not `(def x 1)`
- [ ] `(obj-merge a b)` not `(merge a b)`
- [ ] `(server-start port)` not `(server_listen port)`
- [ ] Island atom → `let` 최상위에서 선언 (호이스팅됨)
