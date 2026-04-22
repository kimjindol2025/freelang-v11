# Phase C — PR 최종 검증 체크리스트

## PR 제목 (권장)

```
Phase C — Self-hosting fixed-point + CI automation (A+B+C)
```

## PR 본문 템플릿

```markdown
## 📝 PR 개요

### 🎯 목적

- ✅ 자가호스팅 결정론성 검증 (5-stage SHA 일치)
- ✅ 회귀 방지 (let-in-expression 5 케이스)
- ✅ FL 토큰 잔재 자동 감지 (6 패턴)
- ✅ CI/CD 파이프라인 자동화 (4-phase)
- ✅ Jest 병렬화 (3 shards, ~10분)

### 📊 주요 변경사항

| 항목 | 파일 수 | 상세 |
|------|--------|------|
| **Phase C-A** | 4개 | let-in-expr 회귀 테스트 + 검증 스크립트 |
| **Phase C-B** | 4개 | FL-token scan 자동화 + 기본 CI |
| **Phase C-C** | 4개 | Full CI integration + Jest 샤딩 |
| **합계** | 12개 | scripts/ + workflows/ + docs/ |

### ✅ 로컬 검증 완료

#### 1️⃣ Stage1 재생성 & Scan

```bash
$ bash scripts/build-stage1.sh
✅ self/all.fl generated (1800 lines)
✅ stage1.js compiled successfully
   Size: 56595 bytes
   Lines: 554

$ bash scripts/scan-for-fl-tokens.sh stage1.js
════════════════════════════════════════════
  FL Token Remnant Scanner
════════════════════════════════════════════

════════════════════════════════════════════
✅ All files clean — no FL tokens found
```

#### 2️⃣ Fixed-Point 검증

```bash
$ bash scripts/verify-fixed-point.sh
🔗 Generating stage chain (1-5)...
  ▸ Compiling stage2.js...
  ▸ Compiling stage3.js...
  ▸ Compiling stage4.js...
  ▸ Compiling stage5.js...

📊 SHA256 Chain:
stage1: 23cafedb614a48a3... (baseline)
stage2: 23cafedb614a48a3... ✅
stage3: 23cafedb614a48a3... ✅
stage4: 23cafedb614a48a3... ✅
stage5: 23cafedb614a48a3... ✅

════════════════════════════════════════════
✅ Fixed-Point Verified: 5/5 stages match
   Deterministic compilation confirmed
```

**Stage1 SHA256:** `23cafedb614a48a38e5c73dc1d49d845e775655e411ba9133275890c712f4820`

#### 3️⃣ Let-in-Expression 회귀 테스트

```bash
$ node scripts/check-let-regressions.js
════════════════════════════════════════════
  Let-in-Expression Regression Tests
════════════════════════════════════════════

✅ Case A: return 내 let
✅ Case B: if 조건의 let
✅ Case C: 인자 위치 let
✅ Case D: 중첩 let
✅ Case E: 복잡한 expression

════════════════════════════════════════════
Results: 5 passed, 0 failed
```

#### 4️⃣ Jest 회귀 테스트

```bash
$ npm test -- src/__tests__/codegen.let.test.ts --silent
PASS  src/__tests__/codegen.let.test.ts (4.5 s)

Codegen — Let-in-Expression (Regression)
  ✓ Case A: return 내 let (123 ms)
  ✓ Case B: if 조건의 let (145 ms)
  ✓ Case C: 인자 위치 let (98 ms)
  ✓ Case D: 중첩 let (112 ms)
  ✓ Case E: 복잡한 expression (187 ms)
```

#### 5️⃣ 전체 Jest (샤드 병렬)

```bash
$ ./scripts/run-jest-shard.sh all
════════════════════════════════════════════
  Jest Full Test Suite (3 Shards Parallel)
════════════════════════════════════════════

🔄 Shard 1/3 started...
  ✅ Shard 1/3 completed

🔄 Shard 2/3 started...
  ✅ Shard 2/3 completed

🔄 Shard 3/3 started...
  ✅ Shard 3/3 completed

════════════════════════════════════════════
✅ All shards completed successfully

Summary: 643 passed, 0 failed (in ~10 minutes)
```

---

### 📋 CI 트리거 체크리스트

PR 생성 후 GitHub Actions에서 확인할 사항:

- [ ] **Phase 1: Scan & Verify** ✅
  - [ ] FL-Token Scan: PASS (no tokens found)
  - [ ] Fixed-Point Verify: PASS (5/5 stages match)
  - [ ] Let-Regression: PASS (5/5 cases)
  - Timeout: 20분

- [ ] **Phase 2: Regression Tests** ✅
  - [ ] Jest Codegen Tests: PASS (5 tests)
  - Timeout: 10분

- [ ] **Phase 3: Full Jest (3 Shards)** ✅
  - [ ] Shard 1/3: PASS (~200 tests)
  - [ ] Shard 2/3: PASS (~200 tests)
  - [ ] Shard 3/3: PASS (~200 tests)
  - Timeout: 45분 (total)

- [ ] **Phase 4: Summary** ✅
  - [ ] All phases GREEN

---

### 🔍 주요 코드 변경 요약

#### src/codegen-js.ts

```diff
+ // 물음표 함수, 예약어, 특수문자 처리 추가
+ const BUILTIN_MAP = { ... }  // 40+ builtin 매핑
+ const JS_RESERVED = new Set([...])  // JS 예약어 목록
+ function flNameToJs(name) { ... }  // 인코딩 함수

- genBlock() case "MAP" / "Array" 추가
- genMapBlock() / genArrayBlock() 메서드 추가
- genVariable() 인코딩 적용
- let IIFE 래핑 (expression context)
```

#### scripts/ (신규)

```
scripts/scan-fl-tokens.js            — 토큰 탐지 엔진 (6 패턴)
scripts/scan-for-fl-tokens.sh        — 쉘 래퍼
scripts/check-let-regressions.js     — 회귀 검증
scripts/run-jest-shard.sh            — Jest 샤딩
scripts/verify-fixed-point.sh        — SHA 검증
scripts/build-stage1.sh              — stage1 빌드 자동화
```

#### .github/ (신규)

```
.github/workflows/phase-c-scan.yml   — 기본 CI (Scan+Verify)
.github/workflows/phase-c-full.yml   — Full CI (4-phase)
.github/pull_request_template.md     — PR 템플릿
```

#### docs/ (신규)

```
docs/PHASE-C-SCAN.md                 — Token Scan 가이드
docs/PHASE-C-CI.md                   — CI 상세 가이드
docs/PHASE-C-PR-CHECKLIST.md         — 이 문서
```

---

### 📊 성능 지표

| 항목 | 로컬 | CI (병렬) |
|------|------|----------|
| Scan | 0.2s | 0.2s |
| Verify (5-stage) | 40s | 40s |
| Regression | 5s | 5s |
| Jest (3 shards) | 10-15m | 15m (parallel) |
| **Total** | **~15-20m** | **~20m** |

---

### 🚨 실패 시 대응

| 단계 | 실패 원인 | 대응 방법 |
|------|---------|---------|
| Scan | FL 토큰 잔재 | codegen mapping 확인 → 추가 → 재제출 |
| Verify | Fixed-point 불일치 | stage*.js diff 확인 → 원인 분석 → 수정 |
| Regression | let-in-expr 깨짐 | IIFE 래핑 로직 재검토 |
| Jest | 테스트 실패 | 해당 shard 로그 확인 → 원인 수정 |

Artifact 다운로드: PR → Actions → 해당 run → Artifacts

---

### ✨ 병합 전 최종 체크

머지 전에 다음을 모두 확인하세요:

- [ ] CI 모든 단계 GREEN (4/4 phases)
- [ ] 코드 리뷰 2인 이상 승인
- [ ] Artifact 검토 (stage1.js SHA 확인)
- [ ] 변경사항 설명서 읽음 (위 요약 참조)
- [ ] 롤백 계획 수립 (필요 시)

### 🎯 병합 후 모니터링 (24시간)

```bash
# 1. master 상태 확인
git log --oneline master | head -5

# 2. Nightly run 상태 관찰
# → GitHub Actions "Nightly-self-host" job 모니터링

# 3. 문제 발생 시
# → Slack 알림 또는 긴급 이슈 생성
# → 필요 시 롤백 PR (git revert)
```

---

## 참고 문서

- [PHASE-C-SCAN.md](./PHASE-C-SCAN.md) — FL Token Scan 상세
- [PHASE-C-CI.md](./PHASE-C-CI.md) — CI 파이프라인 상세
- [.github/pull_request_template.md](../.github/pull_request_template.md) — PR 템플릿
- [.github/workflows/phase-c-full.yml](../.github/workflows/phase-c-full.yml) — CI 워크플로우

---

**문의:** 이상 발견 시 [Issues](https://github.com/your-org/freelang-v11/issues) 생성 또는 담당자 연락.
```

---

이 템플릿을 PR에 그대로 붙여넣기하면 됩니다.
