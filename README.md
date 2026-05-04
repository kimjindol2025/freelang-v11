# 📜 FreeLang v11 — 공식 언어

> **AI-Native DSL** · 자가 컴파일 · npm 0개 의존 · 59개 stdlib 함수

**상태**: ✅ **Production Ready (A+)** — 2026-05-04 검증 완료

---

## 🎯 현재 상태 (2026-05-04)

| 항목 | 수치 |
|------|------|
| **버전** | v11.1.0-alpha |
| **테스트** | 751 PASS (100%) |
| **Stdlib** | 59개 함수 |
| **크기** | 218MB (node_modules 포함) |
| **Bootstrap** | 1.4MB (interpreter) |
| **Compiler** | 57KB (stage1.js) |

---

## ✨ 어제 완료한 작업 (2026-05-03 ~ 05-04)

### 1️⃣ REPL 디버거 강화
- ✅ **Watch 기능** — 변수 감시 (`:watch $var`)
- ✅ **Call Stack** — 호출 경로 추적 (`:stack`)
- ✅ **새 명령어** — `:unwatch`, `:watches`
- ✅ **자동완성** — 15개 명령어 (`:break`, `:step`, `:continue` 등)

### 2️⃣ 공식 언어 선언
- ✅ **OFFICIAL_LANGUAGE.md** — 정책 문서 작성
- ✅ **5분 시작하기** — 5단계 가이드 작성
- ✅ **폴더 구조 명시** — 각 디렉토리 용도 명확화

### 3️⃣ 루트 디렉토리 극단 정리
- ✅ **80개 → 23개** (71% 감소)
- ✅ **35MB+ 삭제** (백업, 임시, 테스트 파일)
- ✅ **모든 문서 docs/로 통합**

### 4️⃣ 양쪽 저장소 동기화
- ✅ **gogs**: https://gogs.dclub.kr/kim/freelang-v11
- ✅ **GitHub**: https://github.com/kimjindol2025/freelang-v11
- ✅ **커밋**: 1682ef00 (루트 정리)

---

## 🚀 빠른 시작

### 설치 & 실행
```bash
git clone https://github.com/kimjindol2025/freelang-v11.git
cd freelang-v11
npm install && npm run build

# Hello World
node bootstrap.js run -c '(println "Hello, FreeLang!")'

# REPL 시작
node bootstrap.js repl
```

### REPL 디버거 사용
```
fl> (define count 42)
fl> :watch $count
👁 watching: $count

fl> :watches
  $count = 42

fl> :debug on
fl> :break my-func
fl> :stack
```

### 파일 실행
```bash
# Interpret 경로 (빠른 개발)
node bootstrap.js run app.fl

# Compile 경로 (프로덕션)
node stage1.js app.fl app.js
node app.js
```

---

## 📁 폴더 구조 (23개 핵심 항목)

```
freelang-v11/
├── 📄 README.md              ← 이 파일
├── 📄 package.json
├── 📄 Makefile

├── 🔨 bootstrap.js           (1.4MB) TypeScript 컴파일 결과
├── 🔨 stage1.js              (57KB) FreeLang 컴파일러
│
├── 📁 src/                   (5.7MB) TypeScript 원본
│   ├── debugger.ts           Watch + callStack 추가 ✨ NEW
│   ├── repl.ts               3새 명령어 추가 ✨ NEW
│   ├── lexer.ts, parser.ts, interpreter.ts
│   └── stdlib-*.ts           (59개 함수)
│
├── 📁 self/                  (4.8MB) 자체호스팅 (FreeLang)
│   ├── all.fl                통합 소스
│   ├── lexer.fl, parser.fl, codegen.fl
│   └── stdlib/               (54개 파일)
│
├── 📁 tests/                 (687KB)
│   ├── *.test.ts             751개 테스트
│   └── l2-proof/             L2 자가증명
│
├── 📁 docs/                  모든 문서 (8개)
│   ├── OFFICIAL_LANGUAGE.md  공식 언어 선언 ✨ NEW
│   ├── CLAUDE.md             Claude AI 레퍼런스
│   ├── ARCHITECTURE.md       시스템 구조
│   └── ...
│
├── 📁 scripts/               빌드 도구
│   ├── verify-l2-proof.sh
│   └── build.js
│
└── 🐳 Dockerfile
```

---

## 💻 주요 명령어

```bash
# 빌드
npm run build                  # bootstrap.js 재생성

# 실행
node bootstrap.js run app.fl   # Interpret (개발)
node stage1.js app.fl app.js   # Compile (프로덕션)

# 검사
node bootstrap.js check app.fl # 문법 검사
node bootstrap.js fmt app.fl   # 자동 포맷

# REPL
node bootstrap.js repl         # 대화형 환경
```

---

## 📚 문서 가이드

| 문서 | 용도 | 특징 |
|------|-----|------|
| **OFFICIAL_LANGUAGE.md** | 정책 선언 | 5분 시작하기 포함 |
| **CLAUDE.md** | Claude AI용 | 함수명, 예제, 실수 100선 |
| **docs/ARCHITECTURE.md** | 시스템 이해 | 컴파일 파이프라인, 자체호스팅 |
| **docs/AI_SYSTEM_PROMPT.md** | AI 학습 | 396개 함수 + 패턴 |

---

## 🔍 검증 결과

### 빌드 상태
✅ `npm run build` — 성공  
✅ bootstrap.js 1.4MB 재생성  
✅ 모든 stdlib 함수 포함

### 테스트
✅ 751개 PASS (100%)  
✅ L2 증명 17/17 (자가 컴파일)  
✅ L3 증명 완료 (자기 자신 컴파일)

### 저장소
✅ gogs: https://gogs.dclub.kr/kim/freelang-v11  
✅ GitHub: https://github.com/kimjindol2025/freelang-v11  
✅ 커밋: 1682ef00 (최신)

---

## 🎓 학습 경로

### 1단계: 5분 (기본)
```fl
;; OFFICIAL_LANGUAGE.md 읽기
(println "Hello, FreeLang!")
(define x 42)
(defn add [$a $b] (+ $a $b))
```

### 2단계: 30분 (중급)
```fl
(map fn [1 2 3])
{:key "value"}
(if (> x 0) "yes" "no")
(server_start 3000)
```

### 3단계: 2시간 (고급)
```fl
(try (json_parse "bad") (catch $e ...))
(async-call ...)
(mariadb_connect {...})
:watch $var
```

---

## 🔧 최근 개선사항

### debugger.ts (Watch 기능)
- `addWatch(varName)` — 변수 감시 추가
- `removeWatch(varName)` — 감시 해제
- `getWatchValues(env)` — 현재값 조회
- `pushCall()`, `popCall()`, `getStack()` — call stack 추적

### repl.ts (새 명령어)
- `:watch $var` — 변수 감시 추가
- `:unwatch $var` — 감시 제거
- `:watches` — 감시 중인 변수 출력
- 자동완성 15개 (`:break`, `:step` 등)

---

## 📊 아키텍처

```
FreeLang 소스 (.fl)
    ↓ [LEXER]
Token 리스트
    ↓ [PARSER]
AST 노드
    ↓ [CODEGEN]
JavaScript 코드
    ↓ [Node.js V8]
실행 결과
```

**자체호스팅 (Self-Hosting):**
```
bootstrap.js (TS)
    ↓ interpret self/all.fl
stage1.js (FL → JS)
    ↓ compile self/all.fl
stage2.js (동일)
    → 고정점 달성 ✅
```

---

## 🏆 핵심 특징

| 특징 | 상태 |
|------|------|
| **npm 0개** | ✅ Node.js 표준만 사용 |
| **자가 컴파일** | ✅ FreeLang으로 FreeLang 컴파일 |
| **고정점** | ✅ 3회 컴파일 SHA256 동일 |
| **59개 stdlib** | ✅ 모든 주요 기능 포함 |
| **AI-Native** | ✅ 함수 메타, 타입 힌트 |
| **프로덕션** | ✅ A+ 등급 |

---

## 🔗 링크

- **공식 언어 선언**: [OFFICIAL_LANGUAGE.md](docs/OFFICIAL_LANGUAGE.md)
- **Claude AI 가이드**: [CLAUDE.md](docs/CLAUDE.md)
- **시스템 아키텍처**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **전체 함수**: [docs/TOOLS.md](docs/TOOLS.md)
- **100가지 실수**: [docs/MISTAKES-100.md](docs/MISTAKES-100.md)

---

## 📞 지원

- 🐛 버그 리포트: gogs 또는 GitHub Issues
- 💬 질문: docs/CLAUDE.md 참고
- 📝 기여: CONTRIBUTING.md 참고

---

**마지막 검증**: 2026-05-04 14:00 KST  
**상태**: Production Ready ✅  
**버전**: v11.1.0-alpha  
**라이선스**: MIT
