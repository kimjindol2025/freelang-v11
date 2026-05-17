# FreeLang v11 현재 상태

**업데이트**: 2026-05-17 (감사 기반 정정)  
**버전**: v11.7.11

> ⚠️ 이전 문서의 수치는 부정확했음. 2026-05-17 전수 감사 결과로 정정.  
> 상세: [AUDIT_2026_05_17.md](AUDIT_2026_05_17.md)

---

## 자가 호스팅 단계

| 단계 | 설명 | 상태 | 비고 |
|------|------|------|------|
| **L0** | TypeScript → `bootstrap.js` | ✅ 완료 | 1,173줄 / 893KB |
| **L1** | `bootstrap.js` → `self/all.fl` 컴파일 | ✅ 완료 | stage1.js 생성 가능 |
| **L2** | `stage1.js` 실행 가능 (자가 컴파일) | 🔴 **블로킹** | codegen 중복 선언 버그 |
| **L3** | `stage1.js` → `stage2.js` 고정점 | ❌ 미달성 | L2 선행 필요 |
| **L4** | TypeScript 완전 독립 | 📋 예정 | L2/L3 완료 후 |

### L2 블로킹 이슈 (2026-05-17 확인)

```bash
node bootstrap.js compile self/all.fl -o /tmp/s1.js  # ✅ 성공
node /tmp/s1.js                                       # ❌ 즉시 크래시
```

```
SyntaxError: Identifier '_fl_is_digit_q' has already been declared
```

**원인**: codegen이 prelude 함수를 중복 생성. S41.5(TCP 빌트인) 추가 후 도입된 회귀 버그로 추정.

---

## 테스트 현황

| 항목 | 수치 |
|------|------|
| CI (fmt/lint/type-check) | ✅ 3/3 PASS |
| FL-native 테스트 | ✅ 10/10 PASS |
| L2 proof 테스트 | ❌ 0/12 FAIL |
| L2 실패 원인 | codegen 중복 선언 (단일 버그) |

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
- 자가 호스팅 L1 완료 (L2 버그 수정 진행 중)
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
