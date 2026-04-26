# FreeLang v11 — 인간 개발자 가이드

> **대상**: FreeLang을 처음 배우는 개발자. 5분에 시작해서 30분이면 기본기 완성.

---

## FreeLang이란?

**한 문장 설명**: Lisp 문법 + JavaScript 파워 + AI 안정성을 갖춘 풀스택 DSL

**더 정확히**:
- **언어**: S-expression 문법 (Lisp/Clojure 스타일)
- **실행**: JavaScript 런타임 (Node.js V8 엔진)
- **장점**: 
  - AI 에이전트가 안정적으로 생성 및 실행 가능
  - 결정론적 실행 (SHA256 보증)
  - 에러 코드 시스템 (디버깅 용이)
  - 자가 호스팅 (컴파일러가 자신을 컴파일 가능)
- **용도**:
  - API 서버 (Express 스타일)
  - 배치 작업 (데이터 처리)
  - AI 워크플로우 (에이전트 실행)
  - 웹 애플리케이션 (풀스택)

**왜 배워야 하나?**
1. AI 시대: LLM이 FL을 자동 생성 가능 (반복 없는 프롬프팅)
2. 간결함: JavaScript 절반의 코드로 동일 기능
3. 안정성: 타입 검사, 에러 처리, 테스트 자동화

---

## 5분 빠른 시작

### 설치

```bash
# npm으로 설치
npm install freelang-cli -g

# 또는 로컬에서
npm install -g ./freelang-cli-1.0.0.tgz
```

### 프로젝트 생성

```bash
freelang new myapp
cd myapp
freelang dev
```

**결과**: http://localhost:3000 에서 웹 서버 시작

### 코드 작성 (app/page.fl)

```fl
;; Hello World 페이지
(defn render []
  (str "<h1>안녕, 프리랭!</h1>"
       "<p>현재 시각: " (now-iso) "</p>"))

(export render)
```

**저장하면 자동 리로드**. 브라우저 새로고침.

### CLI 명령어 (자주 쓰는 것만)

```bash
freelang new myapp              # 프로젝트 생성
freelang dev                    # 개발 서버 (hot reload)
freelang build                  # 프로덕션 빌드
freelang test                   # 테스트 실행
freelang deploy                 # Gogs에 푸시
```

---

## 핵심 개념 (10분)

### 1. 변수와 함수

```fl
;; 변수 (let — 지역 바인딩)
(let [[x 10] [y 20]]
  (+ x y))                      ;; → 30

;; 함수 (defn — 전역 정의)
(defn add [a b]
  (+ a b))

(add 5 3)                        ;; → 8
```

**규칙**:
- `let` 안에서 정의한 변수는 `let` 블록 내에서만 유효
- `defn`으로 정의한 함수는 파일 전체에서 사용 가능
- 변수 이름: `x` 또는 `$x` 모두 가능

### 2. 컬렉션 (배열, 맵, 리스트)

```fl
;; 배열 (indexed access)
[1 2 3]                         ;; array literal
(nth [1 2 3] 0)                 ;; → 1 (0-indexed)
(first [1 2 3])                 ;; → 1
(last [1 2 3])                  ;; → 3

;; 맵 (key-value pairs)
{:name "Alice" :age 30}         ;; map literal
(get {:name "Alice"} :name)    ;; → "Alice"
(get-or {:name "Alice"} :email "no@email") ;; → "no@email"

;; 리스트 (functional style)
(list 1 2 3)                    ;; → (1 2 3)
(map (fn [x] (* x 2)) [1 2 3]) ;; → [2 4 6]
(filter (fn [x] (> x 2)) [1 2 3 4]) ;; → [3 4]
```

### 3. 조건문과 분기

```fl
;; if — 단순 조건
(if (> 5 3)
  "5는 3보다 크다"
  "5는 3보다 작다")

;; cond — 다중 분기
(cond
  [(< x 0) "음수"]
  [(= x 0) "0"]
  [true "양수"])
```

**규칙**: `if`는 항상 3개 인자 (조건, 참, 거짓). 거짓일 경우 nil 아닌 다른 값이 필요하면 `cond` 사용.

### 4. 재귀와 루프

```fl
;; 재귀 (자기 자신 호출)
(defn factorial [n]
  (if (<= n 1)
    1
    (* n (factorial (- n 1)))))

(factorial 5)                   ;; → 120

;; reduce (functional loop)
(reduce + 0 [1 2 3 4 5])       ;; → 15
;; 단계: (+ 0 1) → 1, (+ 1 2) → 3, (+ 3 3) → 6, (+ 6 4) → 10, (+ 10 5) → 15

;; loop (명령형 loop)
(loop [i 0 sum 0]
  (if (< i 5)
    (recur (+ i 1) (+ sum i))
    sum))                       ;; → 10
```

### 5. 비동기 (async/await)

```fl
;; 비동기 함수 정의
(async fetch-user [id]
  (let [[res (await (http-get (str "/api/users/" id)))]]
    (json-parse res)))

;; 호출
(let [[user (await (fetch-user 123))]]
  (println "사용자: " (get user :name)))
```

**규칙**: `await`는 `async` 함수 내에서만 가능.

### 6. 에러 처리

```fl
;; try-catch
(fl-try
  (let [[data (json-parse "{invalid json}")]]
    (println data))
  (catch err
    (println "파싱 오류: " (get err :message))))

;; assert (테스트)
(assert (> 5 3) "5는 3보다 커야 함")
(assert-equals 2 (+ 1 1))
```

---

## 예제 프로젝트 (30분)

### 예제 1: Hello World

**파일**: `app/page.fl`

```fl
(defn render []
  "<h1>Hello, FreeLang!</h1>")

(export render)
```

### 예제 2: JSON API

**파일**: `app/api/users/[id].fl`

```fl
(defn GET [req res]
  (let [[id (get (get req :params) :id)]
        [users (list
                 {:id "1" :name "Alice"}
                 {:id "2" :name "Bob"}
                 {:id "3" :name "Charlie"})]]
    (let [[user (first (filter (fn [u] (= (get u :id) id)) users))]]
      (if user
        (do (response-status res 200)
            (response-body res (json-stringify user)))
        (do (response-status res 404)
            (response-body res (json-stringify {:error "Not Found"})))))))

(export GET)
```

**테스트**:
```bash
curl http://localhost:3000/api/users/1
# → {"id":"1","name":"Alice"}
```

### 예제 3: 데이터 처리 (배치)

**파일**: `batch/process-logs.fl`

```fl
(defn process-logs [log-file output-file]
  (let [[logs (file-read log-file)]
        [lines (split logs "\n")]
        [parsed (map (fn [line]
                       (let [[parts (split line " ")]]
                         {:timestamp (nth parts 0)
                          :level (nth parts 1)
                          :message (join (rest (rest parts)) " ")}))
                     lines)]
        [errors (filter (fn [log] (= (get log :level) "ERROR")) parsed)]]
    (do (println "총 줄 수: " (count lines))
        (println "에러 개수: " (count errors))
        (file-write output-file (json-stringify errors)))))

(process-logs "app.log" "errors.json")
```

**실행**:
```bash
freelang run batch/process-logs.fl
```

### 예제 4: HTTP 서버 (풀스택)

**파일**: `app/layout.fl` (페이지 틀)

```fl
(defn render [content]
  (str "<!DOCTYPE html>"
       "<html>"
       "<head><title>FreeLang App</title></head>"
       "<body>"
       content
       "</body>"
       "</html>"))

(export render)
```

**파일**: `app/page.fl` (홈 페이지)

```fl
(use layout)

(defn GET [req res]
  (response-body res (layout/render
    (str "<h1>환영합니다!</h1>"
         "<p>현재 시각: " (now-iso) "</p>"
         "<a href='/about'>소개 보기</a>"))))

(export GET)
```

**파일**: `app/about.fl` (소개 페이지)

```fl
(defn GET [req res]
  (response-body res "<h1>소개</h1><p>FreeLang으로 만든 웹사이트입니다.</p>"))

(export GET)
```

**실행**:
```bash
freelang dev
# http://localhost:3000 방문
```

---

## 주요 명령어 체크시트

| 명령 | 용도 | 예시 |
|------|------|------|
| `freelang new NAME` | 프로젝트 생성 | `freelang new myapp` |
| `freelang dev` | 개발 서버 (hot reload) | `freelang dev` |
| `freelang build` | 프로덕션 빌드 | `freelang build` |
| `freelang run FILE` | 파일 실행 (한 번) | `freelang run script.fl` |
| `freelang test` | 테스트 실행 | `freelang test` |
| `freelang test FILE` | 특정 파일 테스트 | `freelang test app/api.fl` |
| `freelang deploy` | Gogs에 푸시 | `freelang deploy` |
| `freelang install PLUGIN` | 플러그인 설치 | `freelang install auth` |

---

## 자주 하는 실수 (10가지)

### 1. 빠진 괄호

```fl
;; ❌ 틀림
(defn add [a b] a + b)

;; ✅ 올바름
(defn add [a b] (+ a b))
```

### 2. nil 안전성 무시

```fl
;; ❌ 틀림 — user 없을 때 crash
(get user :name)

;; ✅ 올바름
(get-or user :name "Unknown")
```

### 3. 파이프 연산자 혼동

```fl
;; ❌ 틀림
(-> x (- 50) (* 2))    ;; 실제: (* (- x 50) 2) = 0 ❌

;; ✅ 올바름 (의도를 명확히)
(* (- x 50) 2)         ;; 직접 계산
```

### 4. async 함수 내 await 필수

```fl
;; ❌ 틀림
(let [[data (await (http-get "/api"))]] ...)

;; ✅ 올바름
(async fetch-data []
  (let [[data (await (http-get "/api"))]] ...))
```

### 5. 맵 키 형식

```fl
;; ❌ 틀림
{name "Alice" age 30}

;; ✅ 올바름
{:name "Alice" :age 30}
```

### 6. 배열 인덱싱

```fl
;; ❌ 틀림
(let [[arr [1 2 3]]] (arr 0))

;; ✅ 올바름
(let [[arr [1 2 3]]] (nth arr 0))
```

### 7. 함수 재귀 정의

```fl
;; ❌ 틀림 — 재귀 불가능
(let [[f (fn [n] (f (- n 1)))]] ...)

;; ✅ 올바름
(defn fib [n]
  (if (<= n 1) 1 (+ (fib (- n 1)) (fib (- n 2)))))
```

### 8. filter/map 순서

```fl
;; ❌ 때때로 틀림 (라이브러리 불일치)
(filter list fn)

;; ✅ 안전함
(filter fn list)
```

### 9. 로깅 함수명

```fl
;; ❌ 틀림 — 함수가 없음
(log "메시지")

;; ✅ 올바름
(println "메시지")
```

### 10. 전역 변수 수정

```fl
;; ❌ 틀림 (불변 원칙)
(set! global-var 10)

;; ✅ 올바름 — let으로 새 바인딩
(let [[global-var 10]] ...)
```

---

## 문제 해결 가이드

### "Parsed: 0 nodes" 오류

**원인**: 파일이 파싱되지 않음 (문법 오류)

**해결**:
1. 괄호 개수 확인 (열기/닫기 일치)
2. 따옴표 확인 (문자열 quote)
3. 불법 문자 확인 (한글 변수명 등)

**예시**:
```fl
;; ❌ 틀림 — 닫는 괄호 부족
(defn add [a b] (+ a b)

;; ✅ 올바름
(defn add [a b] (+ a b))
```

### "undefined variable" 오류

**원인**: 변수가 정의되지 않았거나 이름 오류

**해결**:
1. 변수명 철자 확인
2. `let` 블록 범위 확인 (블록 밖에서 접근 불가)
3. `use` 문으로 모듈 import 확인

**예시**:
```fl
;; ❌ 틀림
(let [[x 10]] ...)
x                  ;; undefined — let 블록 밖

;; ✅ 올바름
(let [[x 10]]
  (println x))     ;; let 블록 안에서 사용
```

### "arity mismatch" 오류

**원인**: 함수에 잘못된 개수의 인자 전달

**해결**:
1. 함수 정의에서 인자 개수 확인
2. 호출할 때 인자 개수 맞춰기
3. Rest args (`&`) 확인

**예시**:
```fl
;; ❌ 틀림
(defn add [a b] (+ a b))
(add 1)            ;; 인자 부족

;; ✅ 올바름
(add 1 2)

;; Rest args 사용
(defn print-all [& items]
  (map println items))
(print-all 1 2 3)
```

### "Maximum call stack size exceeded" 오류

**원인**: 무한 재귀 또는 깊은 재귀

**해결**:
1. 재귀 기저 조건 확인 (종료 조건)
2. 재귀 깊이 제한 (TCO 또는 reduce 사용)

**예시**:
```fl
;; ❌ 틀림 — 기저 조건 없음
(defn f [n] (f (- n 1)))

;; ✅ 올바름 — 기저 조건 있음
(defn f [n]
  (if (<= n 0)
    "완료"
    (f (- n 1))))

;; ✅ 더 나은 방법 — tail recursion / reduce
(reduce (fn [acc _] (+ acc 1)) 0 (range 10000))
```

### "Type error" 오류

**원인**: 타입이 맞지 않는 연산 (예: 문자열 + 숫자)

**해결**:
1. 타입 검사 함수 사용 (`string?`, `number?`, `array?`)
2. 타입 변환 (`str`, `int`, `float`)

**예시**:
```fl
;; ❌ 틀림
(+ "10" 5)

;; ✅ 올바름
(+ (int "10") 5)
```

### HTTP 서버가 안 뜨는 경우

**원인**: 포트가 이미 사용 중이거나 권한 부족

**해결**:
```bash
# 포트 변경
freelang dev --port 3001

# 기존 프로세스 종료
lsof -ti:3000 | xargs kill -9
```

### 자동 리로드가 안 될 때

**원인**: 파일 감시자 문제 (보통 WSL/Docker)

**해결**:
```bash
# 명시적 재시작
freelang dev --no-watch

# 수동 재로드 (브라우저 새로고침)
```

---

## 학습 로드맵 (1개월)

**1주차**: 기본 문법
- 변수, 함수, 조건문
- 배열, 맵 조작
- 예제: 계산기, 리스트 필터링

**2주차**: 실제 프로젝트
- 웹 서버 구축 (app/page.fl)
- JSON API 작성
- 라우팅, 요청/응답

**3주차**: 고급 기능
- 비동기 (async/await)
- 플러그인 (use)
- 에러 처리 (fl-try)

**4주차**: 배포 및 최적화
- 프로덕션 빌드
- 성능 최적화
- Gogs 저장소 관리

---

## 공식 자료

- 📘 [ARCHITECTURE.md](./ARCHITECTURE.md) — 시스템 전체 구조
- 📗 [AI_REFERENCE.md](./AI_REFERENCE.md) — AI용 참조 (기계 파싱)
- 📕 [AI_SYSTEM_PROMPT.md](./AI_SYSTEM_PROMPT.md) — 함수 목록 (378개)
- 📙 [AI_QUICKSTART.md](./AI_QUICKSTART.md) — AI 5분 가이드
- 📓 Slack: `#freelang` 채널 (질문, 피드백)

---

## 도움말

질문이나 버그 보고:
- GitHub Issues (공식 저장소)
- Gogs (내부 저장소 — gogs.dclub.kr/kim/freelang-v11)
- 블로그: https://blog.dclub.kr (포스트 검색)

**처음 배우는 분들을 위한 팁**: 문서를 모두 읽으려 하지 말고 **작은 예제부터 시작**해서 필요할 때마다 문서를 참고하세요. 30분이면 충분합니다! 🚀
