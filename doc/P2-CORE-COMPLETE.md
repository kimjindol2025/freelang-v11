# FreeLang v11 P2-Core Complete

**Release**: v11.7.12  
**Status**: ✅ Semantic correctness verified. Native backend validated. Release gate established.

---

## Transition Milestone

```
Before: "Native backend 가능성"
After:  "Native backend 회귀 검증 체계"
```

---

## 4개 기준선 (Permanent Assets)

### B1: semantic-test
**역할**: 의미론 기준선  
**범위**: 7개 불변식 (status0, inflight, stale-state, dedup, projection, append-only, transition)  
**파일**: `test/p2-semantics.c`  
**실행**: `make semantic-test`

### B2: parity-test
**역할**: JS ↔ C 동등성 기준선  
**범위**: 4개 파일 (loop.fl, fib.fl, factorial.fl, nested-loop.fl)  
**파일**: `self/parity-test.sh`  
**실행**: `make parity-test`

### B3: verify-core
**역할**: 릴리즈 최소 게이트  
**범위**: B1 + B2 + native-test  
**파일**: `Makefile`  
**실행**: `make verify-core`

### B4: release
**역할**: 배포 절차  
**동작**: verify-core PASS → git tag → git push  
**파일**: `Makefile`  
**실행**: `make release VERSION=v11.X.X`

---

## 핵심 의미

**이전**:
```
변경 후 정상인지 감각으로 판단
↓
불확실성 높음
```

**현재**:
```
변경 후 정상인지 기계적으로 판정 가능
↓
make verify-core PASS/FAIL로 명확하게 판정
```

---

## 프로젝트 진척도 평가

| 영역 | 상태 | 평가 |
|------|------|------|
| Frontend/DSL | ✅ | 성숙 |
| Semantic Model | ✅ | 성숙 |
| Native Backend | ✅ | 핵심 경로 검증 완료 |
| Self-hosting | ⏳ | 부분 달성 |
| Higher-order Runtime | ⏳ | 후속 과제 |

---

## Commit Chain (P2-Core)

```
0806af9c — [P2 Stage 3] C 코드 생성 검증 (G1~G4)
  ↓
2488c188 — [P2 Stage 4] 의미론 불변식 검증 (7/7)
  ↓
2f9f0acd — [Build] Makefile parity-test + verify + release gate
  ↓
cb573f7c — [Build] verify-core/verify-full/release 명령 추가
```

---

## 다음 사이클 우선순위

### 1. P2-Extended (closure/recur)
**이유**: 현재 Native 경계의 마지막 큰 기술 부채  
**트래킹**: 
- `doc/closure-gap.md` (free variable capture 4 phase)
- `doc/recur-gap.md` (recur 제약 정리)

### 2. codex v1.0 freeze
**이유**: A/B/C audit, generator, linter v0.2 모두 완료 단계  
**산출물**: `doc/CODEX.airc`

### 3. Kotlin backend (cgjvm Phase2)
**이유**: Native C 경로가 기준선 역할 가능  
**기반**: B1~B4 동일 패턴 적용

---

## 기술 기록

### P1 성과
- 의미론 불변식 7개 검증 (semantic-test)
- JS backend 회귀 검증 완료

### P2-Core 성과
- FL → C → ELF 파이프라인 동작
- JS/C 동등성 검증 (parity-test)
- Runtime ABI 정합
- CLI --target c 구현
- Release gate 확립

### P2-Extended (미실행)
- closure capture (자유 변수 캡처)
- recur parity (tail call 최적화)
- higher-order function (고급 패턴)

### P3 (설계만)
- Closure environment model (3 옵션)
- AOT/JIT boundary
- Performance targets (10배)

---

## 사용 가이드

### 개발자 (PR 전)
```bash
make verify-core
```
→ 필수 3개 gate만 검증 (빠름)

### CI/CD (머지 전)
```bash
make verify-core
```
→ 변경사항이 semantic/parity/native 위반 없는지 확인

### 릴리즈 (배포 전)
```bash
make verify-full
```
→ 전체 검증 포함 (slow path)

### 공식 배포
```bash
make release VERSION=v11.X.X
```
→ verify-core PASS 후 git tag + push

---

**상태**: 검증 가능한 Native Backend 달성.  
**다음**: P2-Extended 구현 계획 단계.

