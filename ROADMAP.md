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
| AI-Native Phase 1~4 (fn-meta, effects, ^pure, property-based) | 2026-05-01 |
| P0~P1: 에러처리, 병렬실행, 보상TX, Observability | 2026-04-29 |
| MariaDB Pool + MongoDB Wire Protocol | 2026-04-30 |
| REPL 디버거 강화 | 2026-04-30 |

---

## 다음 단계

### Phase L3: TypeScript 독립 (다음 세션)

**목표**: `stage1.js`가 자기 자신을 컴파일하여 `stage2.js` 생성, 동일 출력 검증

**남은 작업**:
1. `self/main.fl`의 `cli_main` 함수를 `self/all.fl`에 올바르게 포함
2. `stage2.js` 실행 가능 확인 (`node stage2.js input.fl out.js`)
3. L3 검증 스크립트 작성 (`verify-l3-proof.sh`)
4. `stage1.js == stage2.js` 출력 일치 확인

**예상 작업량**: 1세션

---

### Phase L4: 완전 독립 (장기)

**목표**: Node.js 없이 실행 가능한 단일 바이너리

**옵션**:
- Node.js SEA (Single Executable Application)
- Bun 컴파일
- 자체 런타임 (매우 장기)

---

### 실패 테스트 수정 (병행)

| Suite | 실패 수 | 우선순위 |
|-------|--------|---------|
| ai-library | ~20개 | P2 |
| semantic-preservation | ~18개 | P1 |
| self-hosting | ~18개 | P1 |

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|-----------|
| 11.1.0 | 2026-05 | L2 100% 완성, AI-Native Phase 1~4 |
| 11.0.x | 2026-04 | L1 자가호스팅, P0~P1 완성, MongoDB |
