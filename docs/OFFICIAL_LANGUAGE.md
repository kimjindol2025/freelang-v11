# 📜 FreeLang v11 — 공식 언어 선언

**선언일:** 2026-05-04  
**상태:** 🟢 Active (Production Ready)  
**버전:** v11.1.0-alpha

---

## 🎯 공식 선언

**FreeLang v11**은 다음 모든 프로젝트의 **공식 언어**입니다:

- ✅ dclub 마이크로서비스 (백엔드)
- ✅ dclub-mail-fl (메일 시스템)
- ✅ FreeLang 생태계 (stdlib, 플러그인)
- ✅ AI 에이전트 기본 구현 언어

**정책:**
- 새 프로젝트: **반드시 FreeLang으로 작성**
- 기존 프로젝트: 점진적 마이그레이션
- 외부 npm: **최소화 (현재 0개)**

---

## 📁 폴더 구조

```
/root/freelang-v11/                    # 🏠 공식 저장소
├── src/                               # TypeScript 원본
│   ├── lexer.ts                      # 토큰화
│   ├── parser.ts                     # 파싱
│   ├── interpreter.ts                # 실행
│   ├── debugger.ts                   # 디버거 (watch + callStack)
│   ├── repl.ts                       # REPL (:watch 명령어)
│   └── stdlib-*.ts                   # 표준 라이브러리 (59개 함수)
│
├── self/                              # 자체호스팅 (FreeLang로 작성)
│   ├── all.fl                        # 통합 소스
│   ├── lexer.fl                      # 자체 렉서
│   ├── parser.fl                     # 자체 파서
│   └── codegen.fl                    # 자체 코드생성
│
├── bootstrap.js                      # 부트스트랩 (TS 컴파일 결과, 1.4MB)
├── stage1.js                         # Canonical 컴파일러 (57KB)
│
├── docs/                              # 📚 문서
│   ├── ARCHITECTURE.md               # 전체 구조
│   ├── AI_SYSTEM_PROMPT.md           # AI 학습 자료
│   ├── CLAUDE_AI.md                  # Claude 5분 가이드
│   └── MISTAKES-100.md               # 100가지 실수
│
├── tests/                             # 테스트 (751개 PASS)
│   └── *.test.ts
│
├── CLAUDE.md                          # ⭐ Claude 빠른 레퍼런스
├── OFFICIAL_LANGUAGE.md              # 이 파일
└── package.json                      # v11.1.0-alpha
```

---

## ⚡ 5분 시작하기

### 1️⃣ 설치
```bash
cd /root/freelang-v11
npm install
npm run build
```

### 2️⃣ 첫 프로그램
```bash
# hello.fl 작성
echo '(println "Hello, FreeLang!")' > hello.fl

# 실행 (Interpret 경로)
node bootstrap.js run hello.fl
# 출력: Hello, FreeLang!

# 또는 Compile 경로 (더 빠름)
node stage1.js hello.fl hello.js
node hello.js
```

### 3️⃣ 변수 + 함수
```fl
;; hello-fn.fl
(define name "김진")
(defn greet [$n] (str "안녕, " $n "!"))
(println (greet name))
```

```bash
node bootstrap.js run hello-fn.fl
# 출력: 안녕, 김진!
```

### 4️⃣ HTTP 서버
```fl
;; server.fl
(defn handle-get [$req]
  (server_json {:message "Hello"}))

(server_get "/api/hello" "/handle-get")
(server_start 3000)
```

```bash
node bootstrap.js run server.fl
# 출력: 🚀 서버 시작: http://localhost:3000
```

### 5️⃣ REPL 대화형 환경
```bash
node bootstrap.js repl
fl> (+ 1 2 3)
→ 6
fl> :help
[도움말 출력]
```

---

## 📖 각 문서의 용도

| 파일 | 대상 | 내용 |
|------|------|------|
| **CLAUDE.md** | Claude AI | 빠른 레퍼런스 (함수명, 예제) |
| **AI_SYSTEM_PROMPT.md** | AI 학습 | 396개 함수 전체 + 패턴 |
| **ARCHITECTURE.md** | 시스템 이해 | 컴파일러 파이프라인, 자체호스팅 |
| **MISTAKES-100.md** | 코딩 | 자주 틀리는 100가지 |
| **OFFICIAL_LANGUAGE.md** | 정책 | 이 파일 (공식 선언) |

---

## 🔧 명령어 치트시트

```bash
# 실행 (interpret 경로, 빠름)
node bootstrap.js run app.fl

# 파일 변경 감지 자동 재실행
node bootstrap.js run app.fl --watch

# 문법 검사 (오류만 빠르게)
node bootstrap.js check app.fl

# 코드 자동 포맷
node bootstrap.js fmt app.fl

# 컴파일 (JS 생성, stage1 사용)
node stage1.js app.fl app.js
node app.js

# REPL 시작
node bootstrap.js repl

# 함수 검색
node bootstrap.js ls-fns "http"
node bootstrap.js fn-doc str_split

# 디버그 모드
node bootstrap.js debug app.fl
```

---

## 💻 IDE 통합

### VSCode
```json
{
  "extensions": [
    "FreeLang" // 곧 출시
  ]
}
```

**현재:** 문법 강조 미지원 (계획 중)

---

## 🎓 학습 경로

### 1단계: 기본 (30분)
1. CLAUDE.md 읽기
2. `hello.fl` 작성 + 실행
3. `(define x 42)` 변수 테스트
4. `(defn f [$x] ...)` 함수 정의

### 2단계: 중급 (2시간)
1. 배열: `(map fn [1 2 3])`
2. 맵: `{:key value}`
3. 조건: `(if (> x 0) "yes" "no")`
4. 반복: `(loop [i 0] ...)`

### 3단계: 고급 (1일)
1. HTTP 서버: `(server_start 3000)`
2. 데이터베이스: `(mariadb_connect ...)`
3. 비동기: `(async-call ...)`
4. 에러 처리: `(try ... (catch $e ...))`

---

## 📊 프로젝트별 언어 사용

| 프로젝트 | 언어 | 파일 | 상태 |
|---------|------|------|------|
| **freelang-v11** | FL + TS | 150+ | ✅ Active |
| **dclub-mail-fl** | FL | 12개 | ✅ 완료 |
| **dclub-e2e** | FL | 8개 | ✅ 완료 |
| **새 프로젝트** | FL | - | 📝 계획 중 |

---

## 🔐 버전 정보

```
Version:    11.1.0-alpha
Date:       2026-05-04
Bootstrap:  1.4MB (TS compiled)
Stage1:     57KB (FL compiled)
Tests:      751 PASS (100%)
Status:     A+ (Production Ready)
```

---

## 📌 핵심 원칙

1. **자주국방**: npm 0개 (Node.js 표준만 사용)
2. **결정론성**: 3회 컴파일 고정점 달성
3. **AI-Native**: 함수 메타, 타입 힌트 지원
4. **자체호스팅**: FreeLang으로 FreeLang 컴파일

---

## 📞 지원

- **버그 리포트**: gogs.dclub.kr/kim/freelang-v11/issues
- **질문**: CLAUDE.md, MISTAKES-100.md 참고
- **피드백**: 이 파일 업데이트

---

**선언:** FreeLang v11은 공식 언어입니다. 모든 새 프로젝트는 이를 기본 언어로 사용합니다.

**최종 업데이트:** 2026-05-04
