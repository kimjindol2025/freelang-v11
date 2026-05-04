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
| **L3** | `stage1.js` → `stage2.js` (자기 자신 컴파일) | ✅ **완료** | 2026-05-03 달성 |
| **L4** | TypeScript 완전 독립 | 📋 예정 | Node.js SEA 검토 중 |

### L3 달성 내용
```bash
node bootstrap.js compile self/all.fl -o stage1.js --runtime
node stage1.js self/all.fl /tmp/stage2.js     # 컴파일: 성공
node /tmp/stage2.js test.fl out.js && node out.js  # 실행: 정상
bash scripts/verify-l3-proof.sh                # ✅ L3 VERIFIED
```

**핵심 버그 수정**: `cg-stmts` 추가 - `while` 루프 body에서 `return`을 삽입하지 않도록.
이전엔 `cg-do-body`가 while body에 `return`을 삽입해 IIFE 첫 반복 후 탈출, Symbol 렉서가 한 글자만 읽는 문제 발생.

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
