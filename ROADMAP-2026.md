# FreeLang v11 로드맵 2026

**현재 상태:** Phase C-6 완료 (2026-04-29)  
**목표:** Phase D 진입 (2026-05-15)  
**최종 목표:** v11.2.0 정식 릴리스 (2026-06-01)

---

## 📋 Phase 현황

### ✅ Phase A: Parser 일원화 (완료)
- **A-1**: Self-parser 확장 (try-catch) ✅
- **A-2**: Template literal ${expr} ✅
- **A-3**: Runtime helpers 통합 ✅
- **A-4**: Bootstrap 최적화 ✅

**Status:** 완료, v11.1.0-alpha 릴리스

---

### ✅ Phase B: Language Stability (완료)
- **B-1**: Loop 특수형식 파서/코드젠 ✅
- **B-2**: Pattern matching (map, array) ✅
- **B-3**: Error recovery & codegen 버그 ✅
- **B-4**: Workflow/Saga 패턴 추가 ✅

**Status:** 완료, v11.1.0 정식 릴리스

---

### 🟢 Phase C: Self-Hosting Stability (진행 중)

#### 완료된 작업 (C-1, C-2, C-4, C-5)
| 단계 | 목표 | 상태 | 완료일 |
|------|------|------|--------|
| C-1 | Codegen 3개 버그 수정 | ✅ | 2026-04-26 |
| C-2 | SHA256 고정점 달성 | ✅ | 2026-04-26 |
| C-4 | Determinism & Property Testing | ✅ | 2026-04-27 |
| C-5 | Let block fields 버그 해결 | ✅ | 2026-04-29 |
| **C-6** | **reduce 표준화 + parser 안정화** | **✅** | **2026-04-29** |

#### 진행 중 (C-7, C-8, C-9)

##### **C-7: Bootstrap 직접 일관성 검증** (진행 중)
**목표:** 2회 컴파일 결과 일치성 검증 (bootstrap.js 직접 사용)

| 작업 | 상태 | 예상 완료 |
|------|------|----------|
| Test case 2회 컴파일 | 🔄 | 2026-05-02 |
| JS 생성 코드 일치성 | ⏳ | 2026-05-02 |
| 결정론적 실행 검증 | ⏳ | 2026-05-03 |
| **C-7 완료** | **⏳** | **2026-05-03** |

**활동:**
- bootstrap.js 직접 컴파일 (자체호스팅 제외)
  - test case 2회 컴파일 SHA256 비교
  - JS 생성 코드 안정성
  - 실행 결과 일관성 확인
  
**발견:** bootstrap.js가 자체호스팅 형식 미지원
- `node bootstrap.js run compiler.fl input.fl output.js` → 미지원
- L2 Proof (자체호스팅)는 차기 Phase로 분리

---

##### **C-8: Self-Hosting Fixed-Point** (예정)
**목표:** stage1 → stage2 → stage3 SHA256 동일성

| 작업 | 상태 | 예상 완료 |
|------|------|----------|
| stage1 자체호스팅 컴파일 | 🟡 부분 | 2026-05-05 |
| stage2 생성 및 검증 | ⏳ | 2026-05-05 |
| stage3 fixed-point 확인 | ⏳ | 2026-05-06 |
| SHA256 고정점 증명 | ⏳ | 2026-05-06 |
| **C-8 완료** | **⏳** | **2026-05-06** |

**활동:**
- parse-block-fields while 루프 리팩토링 완성
  - 재귀 → 명령형 변환 (스택 안정성)
  - _fl_map_set 함수 통합
- 대규모 블록 파싱 테스트
- 성능 벤치마크

---

##### **C-9: Fuzzing & Edge Cases** (예정)
**목표:** 예외 케이스 처리 강화

| 작업 | 상태 | 예상 완료 |
|------|------|----------|
| Property-based testing 강화 | ⏳ | 2026-05-08 |
| Fuzzing 테스트 (QuickCheck 스타일) | ⏳ | 2026-05-08 |
| Error recovery 개선 | ⏳ | 2026-05-09 |
| **C-9 완료** | **⏳** | **2026-05-09** |

##### **C-L2: L2 Proof (자체호스팅 검증)** (차기 Phase)
**목표:** 자체호스팅 컴파일러를 이용한 semantic preservation 증명

| 작업 | 상태 | 예상 완료 |
|------|------|----------|
| bootstrap.js run 커맨드 확장 | ⏳ | 2026-05-10 |
| self/codegen.fl 런타임 실행 | ⏳ | 2026-05-10 |
| L2-01~16 모두 PASS | ⏳ | 2026-05-12 |
| **C-L2 완료** | **⏳** | **2026-05-12** |

**활동:**
- bootstrap.js run 커맨드 형식 확장
  - `node bootstrap.js run compiler.fl input.fl output.js` 지원
  - self/codegen.fl을 컴파일러로 사용
  - 자체호스팅 체인 완성

---

### 🔲 Phase D: Performance & AI (예정)

#### **D-1: Compile-time 최적화**
- Constant folding
- Dead code elimination
- Tail call optimization

**예상:** 2026-05-12~2026-05-14

#### **D-2: Runtime 성능 튜닝**
- Caching strategies
- Memory pool management
- Lazy evaluation 확장

**예상:** 2026-05-15~2026-05-18

#### **D-3: AI 에이전트 통합**
- 자동 코드 생성 (Claude API)
- Prompt caching
- Tool use 최적화

**예상:** 2026-05-20~2026-05-25

---

## 📊 마일스톤

| 마일스톤 | 목표 | 예상 날짜 | 상태 |
|---------|------|---------|------|
| **v11.1.0** | Phase A+B 정식 릴리스 | ✅ 2026-04-29 | 완료 |
| **v11.2-RC1** | Phase C 완료 | 2026-05-10 | 🔄 진행 |
| **v11.2-RC2** | Phase D-1 완료 | 2026-05-18 | ⏳ |
| **v11.2.0** | 정식 릴리스 | 2026-06-01 | ⏳ |

---

## 🎯 Phase C-7 상세 계획 (즉시 진행)

### 현재 문제
```
L2 Proof: 16/16 케이스 실패
원인: "bootstrap run1 JS 문법 오류"
├─ template literal backtick 이스케이프 (self/codegen.fl line 85)
├─ test case 호환성 (defun → defn 완료)
└─ JS syntax validation 실패
```

### 해결 순서

#### **Task C-7-1: Template Literal 이스케이프 정정** (2-3시간)
```
1. self/codegen.fl line 85 검토
   (replace $s1 "`" "\`") → (replace $s1 "`" "\\`")
   
2. src/codegen-js.ts 문자열 이스케이프 검증
   
3. npm run build → all.fl 재생성
   
4. L2 Proof 재실행 (기대: 부분 통과)
```

**완료 신호:**
```
L2-01~16에서 3개 이상 PASS
또는 "JS 문법 오류" → "runtime 오류"로 진전
```

---

#### **Task C-7-2: L2 Test Case 개별 디버깅** (4-6시간)
실패한 케이스별로:
```
1. node bootstrap.js run tests/l2/case-XX.fl -o /tmp/out.js
2. node --check /tmp/out.js (JS 문법 검증)
3. node /tmp/out.js (실행 검증)
4. 결과 비교 (2회 컴파일 동일성)
```

**완료 신호:**
```
L2-01~16에서 14개 이상 PASS
또는 일관된 패턴 발견 (특정 AST 타입 문제 등)
```

---

#### **Task C-7-3: L2 Proof 최종 통과** (2-3시간)
```
1. verify-l2-proof.sh --run 전체 실행
2. 모든 케이스에서:
   ✓ bootstrap run1 ✓ bootstrap run2
   ✓ JS syntax ✓ Runtime
   ✓ Consistency (결과 동일)
3. L2-PROOF-RESULTS.json 모두 green
```

**완료 신호:**
```
총 16개, 통과: 16개, 실패: 0개
통과율: 100%
```

---

## 📈 성공 기준

### Phase C 완료 조건
- ✅ reduce 표준화 (C-6): DONE
- ✅ parser 안정화 (C-6): DONE
- 🔄 L2 Proof 100% (C-7): **진행 중**
- ⏳ fixed-point SHA256 (C-8): 예정
- ⏳ Fuzzing & edge cases (C-9): 예정

### 릴리스 조건
- 모든 Phase C 작업 완료 (C-1~C-9) ✅~⏳
- 테스트 스위트: 90% 이상 PASS (현재: 94%) ✅
- 문서: 완전성 검증 ✅
- 성능: baseline 달성 (TPS, latency) ✅

---

## 📚 참고 자료

| 문서 | 링크 |
|------|------|
| Phase C 현황 | [project_phase_c_progress.md](./memory/project_phase_c_progress.md) |
| Phase C-6 완료 | [session_priority1_2_3_complete.md](./memory/) |
| L2 Proof 설계 | [L2-PROOF-RESULTS.json](./L2-PROOF-RESULTS.json) |
| Bootstrap 검증 | [self-hosting.test.ts](./src/__tests__/self-hosting.test.ts) |

---

## 🚀 즉시 액션 (C-7 시작)

**지금 진행할 작업:**
```bash
# 1. template literal 이스케이프 정정
vim self/codegen.fl  # line 85

# 2. npm rebuild
npm run build
bash build-stage1.sh

# 3. L2 proof 실행
bash scripts/verify-l2-proof.sh --run

# 4. 결과 분석 및 반복
```

**예상 소요 시간:** 6-8시간  
**완료 예정:** 2026-05-03  
**다음 Phase:** C-8 (self-hosting fixed-point)

---

**작성:** 2026-04-29  
**상태:** 🔄 Phase C-7 진행 중  
**담당:** Claude Code + 배경 에이전트
