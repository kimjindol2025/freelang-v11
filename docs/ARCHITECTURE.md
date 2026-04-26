# FreeLang v11 — 시스템 아키텍처

> **목적**: "프리랭을 딱 보면 전체 흐름이 파악되는 문서"

---

## 전체 흐름도

### 1. 컴파일 파이프라인

```
FreeLang 소스코드 (.fl)
    ↓ [LEXER — self/lexer.fl]
    ↓ 24개 함수 (lex: src → tokens)
    ↓ 
Token 리스트
    ↓ [PARSER — self/parser.fl]
    ↓ 30개 함수 (parse: tokens → AST)
    ↓
AST Node 리스트
    ↓ [CODEGEN — self/codegen.fl]
    ↓ ~80개 함수 (cg: AST → JS + prelude)
    ↓
JavaScript 코드 (실행 가능)
    ↓ [Node.js V8 엔진]
    ↓
실행 결과
```

**입출력 형태:**
- **Token**: `{:kind :type :value :line :col}`
  - kind: `LParen | RParen | Number | String | Symbol | Variable | Keyword`
- **AST Node**: `{:kind :value :name :args :fields :line}`
  - kind: `literal | variable | keyword | sexpr | block | pattern-match | await | throw`
- **JS Output**: 런타임 prelude + 생성 코드

---

### 2. 자체호스팅 (Self-Hosting) 체인

```
bootstrap.js (TS 컴파일 결과, 1.3MB)
    ↓ interpret 방식 (AST 직접 평가)
    ↓ (bootstrap.js가 self/all.fl을 interpret)
    ↓
stage1.js (FL로 작성한 컴파일러, 57KB)
    ↓ compile 방식 (FL → JS 생성)
    ↓ (stage1.js가 self/all.fl을 compile)
    ↓
stage2.js (동일한 컴파일 결과)
    ↓
stage3.js ... stage10.js
    ↓
✅ 고정점 달성: SHA256(`0aab7ab1...`) 완전 일치
```

**의미:** stage1.js가 자신을 다시 컴파일해도 동일한 코드 생성 → 완벽한 자체호스팅 달성

---

### 3. 실행 경로 (3가지)

#### 경로 A: Compile + Execute (가장 최신)

```bash
node --stack-size=8000 stage1.js input.fl output.js  # compile
node output.js                                         # execute
```

- **도구**: stage1.js (canonical 컴파일러)
- **장점**: 빠름 (V8 JIT), 코드 검사 가능
- **사용처**: production, benchmark, CI/CD

#### 경로 B: Interpret (개발 중심)

```bash
node bootstrap.js run input.fl  # interpret + execute
```

- **도구**: bootstrap.js (TS 구현 interpreter)
- **장점**: 즉시 결과, 디버깅 용이
- **사용처**: REPL, 개발 서버, 테스트

#### 경로 C: Web Server (유일한 특수 경로)

```bash
node bootstrap.js serve app/ --port 3000
```

- **도구**: bootstrap.js (HTTP 서버 기능 포함)
- **장점**: Full-stack (라우팅, SSR, 404 처리)
- **사용처**: 웹 애플리케이션 개발
- **제약**: interpreter 의존 (stage1로는 불가)

---

## 핵심 파일 트리

```
freelang-v11/
├── self/                          # 자체 호스팅 코어
│   ├── lexer.fl         (188줄)   # 토큰화 (lex: src → tokens)
│   ├── parser.fl        (231줄)   # 파싱 (parse: tokens → AST)
│   ├── codegen.fl       (909줄)   # 코드 생성 (cg: AST → JS)
│   ├── all.fl           (1816줄)  # 통합 파일 (자가 컴파일 입력)
│   ├── main.fl          (~50줄)   # 드라이버 (CLI 진입점)
│   ├── stdlib/          (54개 파일, 629개 함수)
│   │   ├── string.fl, list-extra.fl, math.fl, http.fl, ai.fl, ...
│   │   └── mongodb.fl (BSON/Wire 프로토콜)
│   └── runtime/         (3개 파일)
│       ├── repl.js      (5.4KB)   # REPL (bootstrap 미사용)
│       ├── http-server.js (23KB)  # HTTP 서버 (interpreter 의존)
│       └── interpreter.js (1.1MB) # 인터프리터 번들
├── src/                           # TypeScript 원본
│   ├── cli.ts                     # CLI 명령어 (cmdInstall, cmdPublish)
│   ├── eval-special-forms.ts      # (use) 탐색 경로 구현
│   ├── stdlib-*.ts                # stdlib 정의 (자동 → bootstrap.js 번들)
│   └── interpreter.ts             # interpreter 구현
├── bin/
│   └── freelang                   # CLI 진입점 (Node.js)
├── bootstrap.js         (1.3MB)   # 부트스트랩 (1회성, stage1 생성 전용)
├── stage1.js            (57KB)    # Canonical 컴파일러
├── Makefile                       # 주요 명령어 (make verify-all, make compile-self)
├── docs/
│   ├── ARCHITECTURE.md            # 이 파일
│   ├── AI_SYSTEM_PROMPT.md        # AI 학습 (396개 함수 시그니처)
│   ├── AI_QUICKSTART.md           # AI 5분 가이드
│   ├── PLUGIN_GUIDE.md            # 플러그인 작성법
│   └── ...
├── scripts/
│   ├── verify-all.sh              # 통합 검증 (4개 항목)
│   ├── verify-fixed-point-deep.sh # 고정점 검증 (stage1~10)
│   ├── verify-self-host.sh        # tier2 PASS≥91
│   ├── gen-ai-prompt.js           # AI 프롬프트 생성
│   └── property-test.js           # Property-based testing (200 invariant)
└── tests/                         # 테스트 스위트
    ├── *.test.ts                  # Jest 테스트 (751 PASS)
    └── l2-proof/                  # L2 증명 (12/12 PASS)
```

---

## 플러그인 시스템 (Y5)

### (use NAME) 탐색 순서

```
(use auth)
    ↓ 우선순위 탐색
    ├─ ./plugins/auth.fl         (로컬 프로젝트)
    ├─ ~/.fl/plugins/auth.fl     (글로벌 설치)
    ├─ ./self/stdlib/auth.fl     (내장 stdlib)
    ├─ ./auth.fl                 (현재 디렉토리)
    └─ ./auth                    (확장자 없음)
    ↓ 첫 매치 → 로드 + 컴파일
```

### 플러그인 라이프사이클

```
1. freelang new weather --plugin
   → plugins/weather.fl (메타 블록 포함)

2. (편집)
   ;; plugin: weather
   ;; version: 1.0.0
   [FUNC weather/forecast ...]

3. freelang install weather
   → ~/.fl/plugins/weather.fl (복사)

4. make gen-ai-prompt
   → AI_SYSTEM_PROMPT.md (함수 목록 추가)

5. freelang publish plugins/weather.fl
   → gogs.dclub.kr/kim/fl-plugins (등록)

6. 다음 AI: (use weather) → weather/forecast 즉시 사용
```

---

## 성능 특성

| 항목 | 수치 |
|------|------|
| 컴파일 속도 | ~100ms (hello.fl → JS) |
| 자가 컴파일 | ~2초 (self/all.fl → stage1-new.js) |
| 고정점 검증 | ~5초 × 10 = 50초 |
| 전체 verify-all | ~3.8분 (4개 검증 통합) |
| Property test | ~30초 (200 invariant × 10 case) |
| 번들 크기 | bootstrap.js 1.3MB, stage1.js 57KB |
| AI학습 토큰 | AI_SYSTEM_PROMPT.md 6K tokens |

---

## 상태 (2026-04-26)

✅ **완료**:
- Phase A~E (언어 품질 95점)
- Y1~Y5 (자체호스팅, 플러그인, AI 지원)
- Phase 4 (기술 부채 0개)

⚠️ **제약**:
- bootstrap.js: 영구 의존 (HTTP 서버 기능)
- Stage1: codegen 전용 (interpreter 없음)

🎯 **등급**: **A+ (95/100)** — Production ready
