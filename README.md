# FreeLang v11

**AI가 코드를 작성하고 실행하는 언어. Lisp 스타일 S-expression.**

```bash
node bootstrap.js run app.fl
```

---

## 빠른 시작

```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install

# Hello World
node bootstrap.js run -c '(println "Hello FreeLang!")'

# 파일 실행
node bootstrap.js run app.fl
```

---

## 문법

```lisp
; 함수 정의
(defn add [a b] (+ a b))
(add 1 2)  ; → 3

; 조건
(if (> x 0) "양수" "음수")

; 컬렉션
(map (fn [x] (* x 2)) [1 2 3])   ; → [2 4 6]
(filter (fn [x] (> x 1)) [1 2 3]) ; → [2 3]

; HTTP 서버
(server_start 40000)
(server_get "/api/hello" "hello-handler")
(defn hello-handler [req] (server_json {:ok true}))

; 파일 I/O
(file_write "/tmp/data.json" (json_stringify {:key "val"}))
(file_read "/tmp/data.json")

; DB
(def db (mariadb_connect DB_URL))
(mariadb_query db "SELECT * FROM users WHERE id = ?" [id])
```

---

## 함수 검색

```lisp
(help)           ; 카테고리 목록
(help "server")  ; server 관련 함수
(help "file")    ; 파일 I/O 함수
```

---

## 주요 내장 함수

| 분류 | 함수 |
|------|------|
| 문자열 | `str` `length` `substring` `split` `trim` `upper_case` `lower_case` |
| 배열 | `append` `map` `filter` `reduce` `get` `length` `sort` |
| 맵 | `assoc` `dissoc` `get` `map_set` `map_entries` |
| 파일 | `file_read` `file_write` `file_exists` `file_mkdir` |
| HTTP | `http_get` `server_start` `server_get` `server_post` `server_json` |
| DB | `mariadb_connect` `mariadb_query` `mariadb_one` |
| 시간 | `now_ms` `now_iso` `sleep_ms` |
| JSON | `json_stringify` `json_parse` |
| 환경 | `shell_env` `shell_capture` |

---

## 개발 워크플로우

```bash
# 소스 수정 후 빌드 (esbuild, ~130ms)
npm run build

# 빠른 테스트
npm test

# 전체 검증 대시보드 (커밋 전 권장)
bash scripts/verify-all.sh
```

| 스크립트 | 용도 |
|---------|------|
| `npm run build` | esbuild 번들 → bootstrap.js |
| `npm test` | jest fast (일반 개발) |
| `npm run test:full` | jest 전체 suite |
| `npm run test:coverage` | 커버리지 포함 |
| `npm run verify:fixed-point` | self-hosting 고정점 검증 |
| `npm run verify:build-deterministic` | 빌드 결정론 체크 |
| `bash scripts/verify-all.sh` | 통합 검증 대시보드 |

> **규칙**: `src/*.ts` 수정 → `npm run build` → `npm test` → push  
> `bootstrap.js` 직접 수정 금지 (빌드 시 덮어씌워짐)

---

## AI-First 설계

- **snake_case / kebab-case 모두 허용** — `file_read` = `file-read`
- **에러 힌트** — 잘못된 함수명 사용 시 정답 안내
- **콜 스택 표시** — 에러 발생 위치 추적
- **`(help)`** — 런타임 함수 검색

---

## 현황

| 항목 | 상태 |
|------|------|
| 테스트 | ✅ 372+ PASS |
| 자가 컴파일 | ✅ Fixed-point SHA256 검증 |
| 결정론 | ✅ 동일 입력 → 동일 출력 |
| 표준 라이브러리 | ✅ 500+ 함수 |
| MCP 서버 | ✅ mcp.dclub.kr (fl_eval sandbox) |

---

**Repo:** https://gogs.dclub.kr/kim/freelang-v11.git  
**Ref:** `CLAUDE.md` — 함수 레퍼런스 + 자주 틀리는 것
