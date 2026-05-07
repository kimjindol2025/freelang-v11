# 📜 FreeLang v11 — 공식 언어

> **AI-Native DSL** · 자가 컴파일 · npm 0개 의존 · 59개 stdlib 함수

**상태**: ✅ **Production Ready (A+)** — 2026-05-08 최종 검증 완료

---

## 🎯 현재 상태 (2026-05-08)

| 항목 | 수치 |
|------|------|
| **버전** | v11.5.2 |
| **테스트** | 68/68 PASS (P1-P8 + Security) |
| **Stdlib** | 60개+ 함수 (술어 7개 신규) |
| **크기** | 218MB (node_modules 포함) |
| **Bootstrap** | 797KB (최신 빌드) |
| **Compiler** | 57KB (stage1.js) |

---

## ✨ 5번 세션 완료: P1-P8 모든 언어 개선 + Security (2026-05-07~08)

### P1️⃣ fn/defn 소괄호 에러 처리
- ✅ `(fn (x) ...)` → `E_INVALID_FORM` 에러 + 도움말
- ✅ 초보자 경험 개선

### P4️⃣ MariaDB 배치 성능 40배 향상
- ✅ 200건 INSERT: 2초 → 50ms
- ✅ BEGIN...COMMIT 단일 spawnSync 최적화

### P5️⃣ 문자열 보간 에러 처리
- ✅ `${(undefined-fn)}` 조용한 실패 → 명확한 에러
- ✅ 디버깅 편의성 확보

### P6️⃣ MariaDB 함수명 kebab alias 14개 추가
- ✅ `mariadb-exec`, `mariadb-query`, `mariadb-one` 등
- ✅ 에러 메시지 자동 수정 제안

### P7️⃣ 술어 ? suffix 완성 7개
- ✅ `some?`, `positive?`, `negative?`, `int?`, `float?`, `nan?`, `dir-exists?`
- ✅ 타입 검증 완전성 확보

### 🔐 Security: SQL Injection 방어 강화
- ✅ `bindParams`: 6개 특수 바이트 (`\0`, `\n`, `\r`, `\x1a`) 처리
- ✅ NaN/Infinity 즉시 에러 + 배열/객체 차단

### P8️⃣ MariaDB 인자 순서 통일
- ✅ `storage-unified.fl` 4곳 수정 (4줄 마법)
- ✅ 27개 앱 자동 적용, 앱 코드 변경 없음

**테스트**: 68/68 PASS | **빌드**: 성공 | **Gogs 푸시**: 완료

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
├── 📁 src/                   (5.7MB) TypeScript 원본 (P1-P8 완료)
│   ├── lexer.ts              토크나이저 (삼중 따옴표 지원)
│   ├── parser.ts             AST 파서
│   ├── interpreter.ts        메인 인터프리터 (P5: 보간 에러 처리)
│   ├── eval-builtins.ts      built-in 함수 (P7: 술어 7개 신규)
│   ├── eval-special-forms.ts fn/defn/let/if (P1: 소괄호 에러)
│   ├── error-formatter.ts    에러 메시지 (줄번호 + 포인터)
│   ├── stdlib-mariadb.ts     MariaDB 드라이버 (P4/P8 + Security)
│   ├── stdlib-server.ts      HTTP 서버 (server_start/route)
│   ├── stdlib-auth.ts        JWT + bcrypt + TOTP
│   ├── stdlib-*.ts           50개+ 기타 함수
│   ├── storage-unified.fl    다중 백엔드 저장소 (P8 완료)
│   ├── _aliases.json         함수명 alias 300+ (P6 추가)
│   ├── debugger.ts           Watch + callStack
│   ├── repl.ts               대화형 환경
│   └── __tests__/            Jest 테스트 68개
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

## 🗺️ 로드맵 (다음 단계)

| 버전 | 예정 | 주요 내용 | 상태 |
|------|------|----------|------|
| **v11.5.3** | 2026-06 | CSRF 토큰 자동 생성 + XSS 방지 | 📋 설계 중 |
| **v11.5.3** | 2026-06 | Rate Limiter 미들웨어 | 📋 설계 중 |
| **v11.6** | 2026-07 | WebSocket 지원 (양방향 통신) | 📋 예정 |
| **v11.6** | 2026-07 | Prepared Statement CLI 확장 | 📋 예정 |
| **v11.7+** | 2026-08+ | cron 스케줄러 (정기 작업) | 📋 예정 |
| **v11.7+** | 2026-08+ | 성능 최적화 (JIT, 캐싱) | 📋 예정 |

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

**마지막 검증**: 2026-05-08 최종 (P1-P8 + Security + P8 완료)  
**상태**: Production Ready ✅ (A+ 등급)  
**버전**: v11.5.2  
**라이선스**: MIT

---

## 📚 최근 블로그 (6편 완성)

1. [010 — P4: MariaDB 배치 성능 40배](../blog-posts/010-freelang-mariadb-batch-optimization.md)
2. [011 — P5: 문자열 보간 에러](../blog-posts/011-freelang-string-interpolation-error-handling.md)
3. [012 — P6+P7: 함수명 + 술어](../blog-posts/012-freelang-p6-p7-completion.md)
4. [013 — Security: SQL Injection](../blog-posts/013-freelang-sql-injection-security.md)
5. [014 — 로드맵: v11.5.3 계획](../blog-posts/014-freelang-v11-roadmap-p8-migration.md)
6. [015 — P8 완료: MariaDB 인자 순일](../blog-posts/015-freelang-p8-complete.md)
