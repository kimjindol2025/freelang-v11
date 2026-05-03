# FreeLang v11 로드맵

> **언어 정의**: AI 에이전트 실행 엔진  
> **설계 철학**: Deterministic + Self-Hosted + AI-First  
> **업데이트**: 2026-05-03

---

## 완료된 것 ✅

| 항목 | 완료일 |
|------|--------|
| L0: TypeScript bootstrap.js | 초기 |
| L1: self/all.fl → stage1.js | 2026-04 |
| L2: 17/17 의미 동등성 증명 | 2026-05-02 |
| **L3: stage1 → stage2 자기 컴파일 (클로저 검증)** | **2026-05-03** |
| AI-Native Phase 1~4 (fn-meta, effects, ^pure, property-based) | 2026-05-01 |
| P0~P1: 에러처리, 병렬실행, 보상TX, Observability | 2026-04-29 |
| MariaDB Pool + MongoDB Wire Protocol | 2026-04-30 |
| REPL 디버거 강화 | 2026-04-30 |
| npm 11.2.0 배포 | 2026-05-03 |

---

## 현재 진행 중 🔧

### 테스트 93% → 100%

현재: 831/832 (99.9%)  
남은 실패: verify-self-host.sh tier2 PASS 82 → 86 기준

---

## 다음 작업 (우선순위 순)

### P0 — Content-Type 헤더 강제 버그 수정

**파일**: `src/stdlib-http-server.ts` → `sendResponse` 함수  
**증상**: `server_text`/`server_html` 응답이 항상 `application/json`. CSS/JS link 태그로 못 가져옴.  
**수정**: handler return 객체의 `contentType` 또는 `headers["Content-Type"]` 우선 반영  
**완료 조건**: 5개 앱 회귀 테스트 통과

---

### P0 — `freelang patch` 명령 추가

**파일**: `bootstrap.js` (CLI 서브커맨드 추가)  
**증상**: 1000줄+ SPA 파일 수정 시 sed/heredoc escape 충돌. bash가 `${}`/백틱 평가 → Python 우회 강제.  
**수정**:
```bash
freelang patch <file> --find "<text>" --replace "<text>"
freelang patch <file> --insert-after "<anchor>" --content "<block>"
```
**완료 조건**: 특수문자(백틱, ${}, 한글, JSON) 포함 문자열 안전 처리

---

### P1 — 테스트 99.9% → 100%

**남은 1개**: `verify-self-host.sh tier2` PASS 82 → 86  
**원인**: fuzz invariant crash (file_read/write 선언 충돌 해결 중)

---

### P1 — `shell_env` nil 반환 수정

**증상**: 미정의 환경변수가 `""` 반환 → `(or "" default)` 가 `""` 선택  
**수정**: 미정의 시 `nil` 반환 + `(env-or key default)` 헬퍼 추가

---

### P1 — `mariadb_pool_query` 빈 결과 `[]` 반환

**증상**: 빈 테이블 조회 시 `nil` 반환 → `(map fn nil)` 폭발  
**수정**: 빈 결과 시 `nil` 대신 `[]` 반환

---

### P2 — Phase L4: Bun 단일 바이너리

**목표**: `bun build --compile stage1.js --outfile freelang`  
**완료 조건**: Node.js 없이 `./freelang run app.fl` 실행  
**예상 작업량**: 1세션

---

### P2 — 에러 메시지에 파일명 + 컨텍스트

**증상**: `"line 53 col 0"` — 어느 파일인지 모름. 디버깅 2배 소요.  
**수정**: 에러 출력에 파일명 + 해당 줄 코드 3줄 컨텍스트 추가

---

### P3 — WebSocket / Push API / Cron 정밀화

| 기능 | 현황 | 목표 |
|------|------|------|
| WebSocket | community-ws 별도 구현 | stdlib 통합 |
| Push API 서버 측 | 미구현 | Web Push protocol |
| Cron | set_interval 60초 | "매주 월요일 9시" 수준 |

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|-----------|
| 11.2.0 | 2026-05-03 | L3 자기 호스팅 완성, while codegen 수정 |
| 11.1.0 | 2026-05 | L2 100% 완성, AI-Native Phase 1~4 |
| 11.0.x | 2026-04 | L1 자가호스팅, P0~P1 완성, MongoDB |
