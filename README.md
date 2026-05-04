# FreeLang v11

> AI가 코드를 작성하고 실행하는 언어. Lisp 스타일 S-expression.  
> **500+ 내장 함수 · 자가 컴파일 · MCP 샌드박스 실행**

---

## v11.3.7 릴리스 (2026-05-03) 🎉

**마일스톤**: 종합적 Map 직렬화 수정 + 한글 문자 데이터 전송 복구  
**버그 수정**: 6개 모듈 (json_str, json_set, kimdbReq, callHelper, saveCheckpoint, AI API)  
**근본 원인**: `JSON.stringify(Map)` → `{}` (데이터 손실)  
**테스트**: 832/832 통과 (100%)  
**상태**: ✅ **배포 완료**

### 핵심 개선사항
- 🔧 **db-post**: 한글 데이터 정상 저장 (KimDB)
- 🔧 **데이터 계층**: MongoDB/Checkpoint/AI API 모두 Map 처리
- 🔧 **재귀적 변환**: 중첩된 Map 구조까지 완전 지원

### 이전 릴리스

#### v11.3.6 (2026-05-03)
**완성도**: 9.5/10 (RC1 → 프로덕션)  
**버그 수정**: 89개 (블로그 #54-62)  
**테스트**: 832/832 통과 (100%)  
**상태**: ✅ **배포 완료**

| 단계 | 설명 | 상태 |
|------|------|------|
| **L0** | TypeScript → `bootstrap.js` | ✅ 완료 |
| **L1** | `bootstrap.js`가 `self/all.fl` → `stage1.js` | ✅ 완료 |
| **L2** | `bootstrap.js` == `stage1.js` 의미 동등성 증명 | ✅ **17/17 (100%)** |
| **L3** | `stage1.js`가 자기 자신을 컴파일 → `stage2.js` | ✅ **완료** (`scripts/verify-l3-proof.sh`) |
| **L4** | TypeScript 완전 독립 (Node.js SEA 바이너리) | 📋 예정 |

**자기 호스팅**: L2 17/17 + L3 ✅ 완전 달성

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

# L2 증명 검증
bash scripts/verify-l2-proof.sh --prepare
bash scripts/verify-l2-proof.sh --run

# L3 증명 검증
bash scripts/verify-l3-proof.sh
```

---

## 문법 예시

```lisp
;; 함수 정의
(defn greet [name]
  (str "Hello, " name "!"))

;; 조건 / 재귀
(defn factorial [n]
  (if (<= n 1) 1
    (* n (factorial (- n 1)))))

;; 컬렉션
(map (fn [x] (* x 2)) [1 2 3])      ; → [2 4 6]
(filter (fn [x] (> x 1)) [1 2 3])   ; → [2 3]
(reduce + 0 [1 2 3 4 5])            ; → 15

;; HTTP 서버
(server_start 3000 (fn [req]
  (server_json {"message" "ok"})))

;; DB (MariaDB)
(db_query "SELECT * FROM users WHERE id = ?" [42])

;; AI 메타 (AI-Native)
(defn ^pure add [a b] (+ a b))
(fn-meta add)  ; → {:pure true, :effects []}
```

---

## 디렉토리 구조

```
freelang-v11/
├── src/                  TypeScript 소스 (bootstrap 원본)
│   ├── lexer.ts
│   ├── parser.ts
│   ├── codegen-js.ts
│   └── stdlib-*.ts
├── self/                 FreeLang으로 작성된 컴파일러 (자가 호스팅)
│   ├── all.fl            진입점 (lexer+parser+codegen 통합)
│   ├── lexer.fl
│   ├── parser.fl
│   ├── ast.fl
│   ├── codegen.fl
│   └── main.fl
├── tests/
│   └── l2/               L2 증명 테스트 케이스 (17개)
├── scripts/
│   └── verify-l2-proof.sh
├── bootstrap.js          TypeScript 컴파일 결과 (L0)
├── stage1.js             self/all.fl 컴파일 결과 (L1)
└── docs/
    ├── CLAUDE_AI.md      AI 통합 가이드
    ├── MISTAKES-100.md   실수 100선
    └── ...
```

---

## 문서

| 문서 | 용도 |
|------|------|
| [TOOLS.md](./TOOLS.md) | 전체 함수 레퍼런스 |
| [STATE_OF_V11.md](./STATE_OF_V11.md) | 현재 상태 + 수치 |
| [ROADMAP.md](./ROADMAP.md) | L3/L4 로드맵 |
| [docs/CLAUDE_AI.md](./docs/CLAUDE_AI.md) | AI 통합 가이드 |
| [docs/MISTAKES-100.md](./docs/MISTAKES-100.md) | 실수 100선 |
| [CLAUDE.md](./CLAUDE.md) | Claude 빠른 레퍼런스 |
