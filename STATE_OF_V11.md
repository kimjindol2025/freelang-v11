# FreeLang v11 현재 상태

**업데이트**: 2026-05-03  
**버전**: 11.1.0

---

## 자가 호스팅 단계

| 단계 | 설명 | 상태 | 비고 |
|------|------|------|------|
| **L0** | TypeScript → `bootstrap.js` | ✅ 완료 | 38,661줄 |
| **L1** | `bootstrap.js` → `stage1.js` (`self/all.fl` 컴파일) | ✅ 완료 | 620줄 |
| **L2** | `bootstrap.js` == `stage1.js` 의미 동등성 | ✅ **17/17 (100%)** | 2026-05-02 달성 |
| **L3** | `stage1.js` → `stage2.js` (자기 자신 컴파일) | 🔧 진행 중 | `cli_main` 연결 필요 |
| **L4** | TypeScript 완전 독립 | 📋 예정 | Node.js SEA 검토 중 |

### L3 현황
```bash
node stage1.js self/all.fl /tmp/stage2.js   # 컴파일: 성공 (8,523줄 생성)
node /tmp/stage2.js input.fl out.js          # 실행: ReferenceError: cli_main is not defined
```
`self/main.fl`의 `cli_main`이 `self/all.fl`에 올바르게 포함되지 않아 실행 불가. 수정 필요.

---

## 테스트 현황

| 항목 | 수치 |
|------|------|
| 전체 테스트 | 832개 |
| 통과 | 775개 (93.2%) |
| 실패 | 56개 |
| 실패 suite | ai-library (3개), semantic-preservation, self-hosting |

---

## 언어 기능

### Tier 1: 핵심 ✅
- Lexer / Parser / Codegen
- Stdlib 500+ 함수 (HTTP, DB, File, Crypto, AI, WebSocket 등)
- 재귀, 클로저, 고차함수
- Pattern matching, let/let*
- try/catch/finally
- loop/recur (TCO)
- async/await
- Template literal (`${}`)

### Tier 2: 프로덕션 ✅
- 자가 호스팅 L2 완전 증명
- AI-Native (fn-meta, ^pure, effects 추론) Phase 1~4
- MariaDB Pool + MongoDB Wire Protocol
- Rate Limiting + CSP + multipart
- REPL 디버거 (watch, callStack)
- MCP 서버 (`mcp.dclub.kr`, `fl_eval`)

### Tier 3: 진행 중 🔧
- L3 자가 컴파일 (stage2)
- 실패 테스트 suite 3개 수정

---

## 파일 크기

| 파일 | 크기 |
|------|------|
| `bootstrap.js` | 38,661줄 (1.4MB) |
| `stage1.js` | 620줄 |
| `self/all.fl` | (컴파일러 전체 FL 소스) |
