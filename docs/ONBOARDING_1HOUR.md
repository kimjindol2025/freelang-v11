# FreeLang v11 — 1시간 온보딩

**대상**: FreeLang을 처음 쓰는 개발자  
**목표**: 1시간 안에 첫 풀스택 프로그램 작성  
**전제**: Node.js 20+ 설치

---

## 0~5분: 설치 + Hello World

```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install
npm run build
```

```bash
echo '(println "Hello, FreeLang!")' > hello.fl
node bootstrap.js run hello.fl
# → Hello, FreeLang!
```

축하합니다. 1번째 FL 프로그램 완성.

---

## 5~15분: 핵심 문법 5가지

### 1. 변수 + 함수
```fl
(define x 42)
(defn double [n] (* n 2))
(println (double x))   ;; → 84
```

### 2. 조건 + 패턴
```fl
(defn grade [score]
  (cond
    [(>= score 90) "A"]
    [(>= score 80) "B"]
    [true "F"]))
(println (grade 85))   ;; → B
```

### 3. 컬렉션 + 고차함수
```fl
(println (map (fn [x] (* x x)) (list 1 2 3 4 5)))
;; → [1, 4, 9, 16, 25]

(println (reduce + 0 (range 1 11)))  ;; 1..10 합
;; → 55
```

### 4. 맵 (객체)
```fl
(define user {:name "Alice" :age 30})
(println (get user :name))    ;; → "Alice"
(println (get-or user :email "no-email"))    ;; → "no-email"
```

### 5. 에러 처리
```fl
(fl-try
  (/ 10 0)
  (catch err (println "에러:" err)))
```

---

## 15~30분: 작은 웹 서버

`server.fl`:
```fl
(server_get "/" (fn [req]
  {:status 200 :body "Hello from FreeLang!"}))

(server_get "/hello/:name" (fn [req]
  (let [[name (server_req_param req "name")]]
    {:status 200 :body (str "Hi, " name "!")})))

(server_start 8080)
(println "서버 시작: http://localhost:8080")
```

```bash
node bootstrap.js run server.fl
# 다른 터미널에서:
curl http://localhost:8080/         # → Hello from FreeLang!
curl http://localhost:8080/hello/Bob   # → Hi, Bob!
```

---

## 30~45분: AI 도우미와 함께

### Claude/GPT를 위한 시스템 프롬프트
```bash
# 1677 tokens — 시스템 프롬프트에 그대로 붙여넣기
cat docs/AI_SYSTEM_PROMPT_MINI.md
```

AI에게 task를 줘보세요:
> "FreeLang으로 정수 리스트의 평균을 계산하는 average 함수를 작성하세요"

AI 응답을 `solution.fl`로 저장하고 검증:
```bash
node scripts/ai-self-verify.js solution.fl
```

자동으로:
- defun→defn normalize
- ==→= 수정
- 실행 + ErrorCode + 힌트 표시

---

## 45~60분: 자가 검증 + 안전성

### Self-host 결정론
```bash
make verify-all
# → Build determinism + Deep fixed-point + Tier2 + FL-Bench (3.8분)
```

### Strict 모드
```bash
# nil 접근 즉시 잡기
FL_STRICT=1 node bootstrap.js run my.fl

# 타입 검증 (어노테이션 있는 함수만)
FREELANG_STRICT=1 node bootstrap.js run my.fl

# 함수 호출 trace
FL_TRACE=1 node bootstrap.js run my.fl
```

### REPL 디버거
```bash
node bootstrap.js repl
fl> :help            # 명령 목록
fl> :ls              # 정의된 함수
fl> :stack           # 호출 체인
fl> :debug           # debugger ON
fl> (defn foo [x] (+ x 1))
fl> (foo 5)          # → 6
```

---

## 다음 단계 (1시간 후)

| 학습 | 시간 | 자료 |
|------|------|------|
| **2~3h 심화** | docs/AI_LEARNING_PATH.md | 전체 학습 경로 |
| **stdlib 전체** | docs/AI_SYSTEM_PROMPT.md | 393 함수 (5,888 tokens) |
| **자주 틀리는 함정** | docs/AI_QUICKSTART.md | 10 함정 + 해결 |
| **타입 시스템** | docs/TYPE_SYSTEM_GUIDE.md | opt-in 정적 타입 |
| **명명 규칙** | docs/STDLIB_NAMING_AUDIT.md | hyphen vs underscore |
| **자동화 cron** | docs/CRON_AUTOMATION.md | 매일 회귀 검출 |

---

## 실 사례

### OIDC IdP 풀스펙 (외부 npm 0개)
사용자가 18세션·4,100줄로 작성. SQLite + HTTP + crypto + JWT + scrypt + TOTP 모두 직접 구현.
→ 자주권 SaaS의 가능성 실증.

### AI 평가 (FL-Bench 120 task)
| 모델 | PASS율 |
|------|--------|
| Claude Opus 4.7 | 71.8% |
| Claude Sonnet 4.6 | 71.8% |
| Claude Haiku 4.5 | 60.2% |

→ 모델 선택 가이드 가능.

---

## 문제 해결

### `nil` 처리 (P0-1, 2026-04-25 fix)
```fl
(if nil "yes" "no")   ;; → "no" ✅ (이전 버그: "yes")
```

### `(reduce + 0 list)` 패턴
```fl
(println (reduce + 0 (list 1 2 3 4 5)))   ;; → 15 ✅
```

### `($pred x)` 고차함수 호출
```fl
[FUNC apply-fn :params [$pred $x] :body ($pred $x)]
(apply-fn (fn [n] (* n 2)) 5)    ;; → 10 ✅
```

---

축하합니다! 1시간 만에 FreeLang 풀스택 작성, AI 활용, 자가 검증 모두 경험하셨습니다.

다음 가벼운 프로젝트:
- TODO 앱 (CRUD)
- 마크다운 파서
- 로그 분석기
- 작은 OAuth 서버

질문/이슈: https://gogs.dclub.kr/kim/freelang-v11/issues
