# FreeLang v11

> AI가 코드를 작성하고 실행하는 언어. Lisp 스타일 S-expression.  
> **500+ 내장 함수 · 자가 컴파일 · MCP 샌드박스 실행**

---

## 특징

| 항목 | 내용 |
|------|------|
| 문법 | Lisp S-expression (snake_case / kebab-case 모두 허용) |
| 런타임 | Node.js 기반, esbuild 번들 단일 파일(`bootstrap.js`) |
| 표준 라이브러리 | 500+ 함수 (HTTP, DB, File, Crypto, AI, WebSocket 등) |
| 테스트 | 797/832 PASS (jest) |
| 자가 컴파일 | Fixed-point SHA256 검증 ✅ |
| MCP 서버 | `mcp.dclub.kr` — `fl_eval` 샌드박스 실행 |

---

## 빠른 시작

```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install

# Hello World
node bootstrap.js run -c '(println "Hello, FreeLang!")'

# 파일 실행
node bootstrap.js run app.fl

# REPL
node bootstrap.js repl
```

---

## 문법 예시

```lisp
;; 함수 정의
(defn greet [name]
  (str "Hello, " name "!"))

(greet "World")  ; → "Hello, World!"

;; 조건 / 재귀
(defn factorial [n]
  (if (<= n 1) 1
    (* n (factorial (- n 1)))))

;; 컬렉션
(map (fn [x] (* x 2)) [1 2 3])        ; → [2 4 6]
(filter (fn [x] (> x 1)) [1 2 3])     ; → [2 3]
(reduce + 0 [1 2 3 4 5])              ; → 15

;; 맵 (구조체)
(def user {:name "Kim" :age 30})
(get user :name)                       ; → "Kim"
(assoc user :age 31)                   ; → {:name "Kim" :age 31}

;; HTTP 서버
(server_start 40000)
(server_get "/api/hello" "hello-handler")
(defn hello-handler [req]
  {:status 200 :body (json_stringify {:ok true})})

;; HTTP 클라이언트
(def res (http_get "https://api.example.com/data"))
(json_parse (get res :body))

;; 파일 I/O
(file_write "/tmp/data.json" (json_stringify {:key "val"}))
(file_read "/tmp/data.json")

;; DB (MariaDB)
(def db (mariadb_connect (shell_env "DATABASE_URL")))
(mariadb_query db "SELECT * FROM users WHERE id = ?" [id])

;; 에러 처리
(try
  (risky_operation)
  (catch e
    (println "에러:" e)))

;; 패턴 매칭
(match status
  :ok    "성공"
  :error "실패"
  _      "알 수 없음")

;; import
(import utils :from "./utils.fl")
(import math :from "./math.fl" :only [add multiply])
```

---

## 주요 내장 함수

| 분류 | 함수 |
|------|------|
| 문자열 | `str` `length` `substring` `split` `trim` `upper_case` `lower_case` `str-contains?` |
| 숫자 | `number` `parse-int` `parse-float` `mod` `abs` `floor` `ceil` `round` |
| 배열 | `append` `map` `filter` `reduce` `get` `length` `sort` `first` `last` `rest` |
| 맵 | `assoc` `dissoc` `get` `map_set` `map_entries` `map_keys` `map_values` |
| 파일 | `file_read` `file_write` `file_exists` `file_mkdir` `file_list` |
| HTTP 서버 | `server_start` `server_get` `server_post` `server_put` `server_delete` `server_json` |
| HTTP 클라이언트 | `http_get` `http_post` `http_put` `http_delete` |
| DB | `mariadb_connect` `mariadb_query` `mariadb_one` `mariadb_exec` |
| MongoDB | `mongodb_connect` `mongodb_find` `mongodb_insert` `mongodb_update` |
| 인증 | `jwt_sign` `jwt_verify` `hash_password` `verify_password` |
| 시간 | `now_ms` `now_iso` `sleep_ms` `date_format` |
| JSON | `json_stringify` `json_parse` |
| 암호화 | `hash_sha256` `hash_md5` `uuid_v4` `crypto_random` |
| AI | `ai_call` `rag_search` `embed` `similarity` |
| WebSocket | `ws_start` `ws_send` `ws_broadcast` |
| 환경 | `shell_env` `shell_capture` `shell_exec` |

```lisp
;; 런타임 함수 검색
(help)            ; 카테고리 목록
(help "server")   ; server 관련 함수
(help "file")     ; 파일 I/O 함수
```

---

## 개발 워크플로우

```
src/*.ts  →  npm run build  →  npm test  →  git push
```

| 스크립트 | 용도 | 시간 |
|---------|------|------|
| `npm run build` | esbuild 번들 → `bootstrap.js` | ~130ms |
| `npm test` | jest fast (일반 개발) | ~10s |
| `npm run test:full` | jest 전체 suite | ~30s |
| `npm run test:coverage` | 커버리지 포함 | ~40s |
| `npm run verify:fixed-point` | self-hosting 고정점 검증 | ~2m |
| `npm run verify:build-deterministic` | 빌드 결정론 체크 | ~1m |
| `bash scripts/verify-all.sh` | 통합 검증 대시보드 | ~5m |
| `python3 scripts/check-parens.py app/*.fl` | 괄호 균형 검증 (line:col) | 즉시 |

> `bootstrap.js` 직접 수정 금지 — 빌드 시 덮어씌워짐

---

## AI-First 설계

- **snake_case / kebab-case 모두 허용** — `file_read` = `file-read`
- **에러 힌트** — 잘못된 함수명 사용 시 가장 유사한 정답 안내
- **콜 스택 표시** — 에러 발생 소스 라인 + 포인터
- **`(help)`** — 런타임 함수 검색
- **MCP 샌드박스** — Claude가 FreeLang 코드를 직접 실행/검증

---

## 현황

| 항목 | 상태 |
|------|------|
| 테스트 | ✅ 797/832 PASS |
| 자가 컴파일 | ✅ Fixed-point SHA256 검증 |
| 결정론 | ✅ 동일 입력 → 동일 출력 |
| 표준 라이브러리 | ✅ 500+ 함수 |
| MCP 서버 | ✅ mcp.dclub.kr (`fl_eval` sandbox) |
| 에러 처리 | ✅ try/catch/finally + 소스 위치 |
| 패턴 매칭 | ✅ match / or / range / struct |
| 병렬 실행 | ✅ workflow_run_async + Promise.all |

---

**Repo:** https://gogs.dclub.kr/kim/freelang-v11.git  
**레퍼런스:** `CLAUDE.md` (함수 전체 목록 + 자주 틀리는 것)  
**MCP:** `mcp.dclub.kr` — `fl_eval` 샌드박스 실행
