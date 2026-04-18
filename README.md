# FreeLang v11

> **AI 가 읽고, AI 가 쓰고, AI 가 고치는 풀스택 언어.**
> 인간용 장식은 전부 제거되었습니다.

---

## 🎯 기본 정의

### FreeLang v11 은 무엇인가

1. **AI 를 위한 (For AI)**
   — 에러 메시지는 `file:line` 기계 파싱 가능, 출력은 JSON/`key=value`, ANSI 색·이모지 금지.
2. **AI 가 편하게 (By AI)**
   — `fn-doc <name>` 로 stdlib 시그니처 조회, `test:fast` 로 coverage 없이 즉시 피드백, Strict `$var` resolution 으로 silent failure 제거.
3. **AI 가 발전하게 (With AI)**
   — Claude Code 같은 agentic 도구가 하루에 다수 버전을 iterate 하도록 설계된 tight feedback loop.

### 그 외 모든 것은 **비-목표**

- **셀프 호스팅 불가.** 인터프리터는 TypeScript (`src/interpreter.ts`) → `bootstrap.js` 번들. FL 로 FL 파서·인터프리터를 작성할 계획 없음.
- **인간 개발자 편의 기능 금지.** VS Code 확장, 친화적 한국어 에러 매핑, 이모지 진행바 — 전부 롤백됨 (v11.9).
- **LLM training data 부재.** AI 가 v11 을 이해하려면 `CLAUDE.md` 프롬프트를 매번 주입해야 함. 주류 언어 대비 구조적 열위.
- **비즈니스 앱의 "권장 언어" 아님.** Next.js / Python 으로 10× 빠름. v11 의 비교 우위는 "AI-first convention" 철학 그 자체.

---

## 📊 정직한 수치 (2026-04-18 측정)

| 항목 | 값 | 측정 방법 |
|------|------|-----------|
| **bootstrap.js 크기** | 1.06 MB | `ls -l bootstrap.js` (esbuild 번들, 삭제됨 — `npm run build` 재생성) |
| **빌드 시간** | 63 ~ 86 ms | `npm run build` (오늘 세션 실측 범위) |
| **테스트** | **583 / 583 PASS** (17 suites) | `npm test` (2026-04-17 19:20 실측) |
| **커버리지 (lines)** | **24 %** | `npm run test:coverage` (threshold 75% 미달) |
| **stdlib 모듈** | 41 | `scripts/gen-stdlib-docs.js` |
| **stdlib 함수** | 265 | `docs/API.md` |
| **git 총 커밋** | 450 | `git log --oneline \| wc -l` |
| **런타임 요구** | Node.js v25 | 다른 의존성 없음 |
| **선택적 요구** | `mariadb` CLI | `stdlib-mariadb` 사용 시에만 |

### 과거 README 의 거짓 주장 (제거됨)

- ~~"Phase 1~151 모두 완성"~~ — Phase 번호 체계에 검증 불가능
- ~~"Tests 444/446 PASS"~~ — 오늘 기준 583/583 (번호 outdated)
- ~~"150 개 AI 블록"~~ — AST 파싱은 되나 실제 효용성 미측정
- ~~"Dependencies: 0"~~ — Node.js v25 런타임 필요. "외부 npm 패키지 0" 이 정확

---

## ⚡ 빠른 시작

```bash
git clone https://gogs.dclub.kr/kim/freelang-v11.git
cd freelang-v11
npm install                        # ts-jest, esbuild, typescript (dev only)
npm run build                      # bootstrap.js 재생성
echo '(println "hello")' > hi.fl
node bootstrap.js run hi.fl        # → hello
```

### AI 가 쓰는 루프

```bash
# 1) 함수 조회 (JSON stdout)
node bootstrap.js fn-doc mariadb_query
# {"query":"mariadb_query","found":true,"exact":[{"name":"mariadb_query",
#  "module":"mariadb","params":"db sql [params]","returns":"rows[] (SELECT)"}]}

# 2) 수정 → 빠른 검증 (coverage 없이)
npm test                           # ~11s

# 3) 에러는 파일:라인 포함
node bootstrap.js run my.fl
# → Undefined variable: '$x' (my.fl:3)
```

---

## 🧭 설계 규약 (AI-first)

### 출력 규약

- **모든 CLI 출력**: JSON 또는 `key=value` 한 줄
- **에러**: stdout 은 정상, stderr 로 에러 JSON. 종료 코드 의미 있게
- **로그**: `app=running pid=X port=Y` 형태. 이모지·색 금지
- **원본 passthrough**: MariaDB 에러코드(`ERROR 1146`) 그대로 노출 — AI 가 패턴 매칭

### 언어 규약

- 변수: `$x` (Strict throw) 또는 `x` (permissive, `FL_STRICT=1` 로 strict 가능)
- `let` 3 종: `[[$x expr]]`, `[$x expr]`, `[x expr]` 전부 동치
- 함수 3 종: `[FUNC]` 블록, `(fn [...] body)`, `(defn name [...] body)`
- 에러 위치: 파서가 모든 AST 노드에 `line` 전파, 인터프리터 throw 시 `(file.fl:N)` 포함

### 정책 (변경 금지)

- 인간 UX 장식 금지 (색/이모지/친화 메시지). v11.6 추가 → v11.9 롤백
- VS Code 확장·snippets·syntax 하이라이팅 금지 (인간 개발자 도구)
- CLAUDE.md 의 한국어는 예외 (AI 지침서)

자세한 내용: `CLAUDE.md`, `docs/blog/2026-04-17-v11-ai-first-evolution.md`

---

## 🚫 하지 않는 것

| 요구 | v11 | 대신 사용 |
|------|-----|----------|
| 대규모 프로덕션 앱 | No | Next.js, FastAPI |
| 타입 안전 | No (runtime 만) | TypeScript, Rust |
| 풍부한 생태계 | No (stdlib 41 모듈) | npm (3M+ 패키지) |
| LLM 학습된 언어 | No | Python/JavaScript |
| 정적 단일 바이너리 | No (Node.js 필요) | Go, Rust, Zig |
| **셀프 호스팅** | **No. 비-목표** | — |
| IDE 지원 (LSP) | No | — |
| 인간 협업 친화 | No (정책) | — |

---

## 📁 구조

```
freelang-v11/
├── bootstrap.js           # 1.06 MB, esbuild 번들, 유일한 배포 artifact
├── src/                   # TypeScript 구현
│   ├── interpreter.ts     # 평가 엔진 (strict symbol resolution)
│   ├── eval-special-forms.ts  # fn / defn / let / if / ...
│   ├── eval-builtins.ts   # 5,540 줄 (God file — 분할 예정)
│   ├── stdlib-*.ts        # 41 개 stdlib 모듈
│   ├── stdlib-loader.ts   # 모듈 등록 순서
│   └── web/               # App Router + SSR (미성숙)
├── stdlib/web/            # .fl 로 작성된 UI/포매터 라이브러리
├── scripts/build.js       # esbuild Node API 직접 호출 (bin wrapper 우회)
├── scripts/gen-stdlib-docs.js  # src/stdlib-*.ts → docs/API.md
├── docs/API.md            # 41 모듈 × 265 함수 자동 문서
├── docs/blog/             # 개발 로그
└── CLAUDE.md              # AI 지침서 (한국어)
```

---

## 🔬 알려진 한계 (2026-04-18)

1. **모듈 시스템**: `[IMPORT "path" :as alias]` 파싱은 되나 `alias/func` 네임스페이스 호출 미구현 (2026-04-17 직접 확인)
2. **App Router**: `/` 페이지 렌더 시 Internal Server Error. `app/api/**/route.fl` 자동 스캔 미지원 (백엔드 AI 가 Q1~Q2 로 진행 중)
3. **테스트 커버리지 24 %**: `eval-builtins.ts` (5,540 줄, 12 % 커버)
4. **네이밍 일관성**: `json_parse` vs `json-parse`, `count` vs `length` 중복
5. **빌드 이슈**: esbuild 0.28.0 + Node v25 에서 bin wrapper 동작 불량 → `scripts/build.js` 로 Node API 직접 호출 우회
6. **셀프 호스팅 불가**: 명시적 비-목표

---

## 📜 라이선스

MIT

---

## 🔗 리소스

- 저장소: https://gogs.dclub.kr/kim/freelang-v11
- AI 지침서: `CLAUDE.md`
- API 레퍼런스: `docs/API.md`
- 개발 로그: `docs/blog/2026-04-17-v11-ai-first-evolution.md`

---

**2026-04-18 기준. 수치가 outdated 되면 `scripts/gen-stdlib-docs.js` 재실행 + `npm test` + `ls -l bootstrap.js` 로 확인하여 갱신. 과장·추정 수치 금지.**
