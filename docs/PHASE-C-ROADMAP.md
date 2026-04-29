# Phase C 상세 로드맵

## 전체 진행 상황 (2026-04-29 기준)

```
Phase C 총 9개 단계 중 6개 완료

C-1 ✅ (2026-04-26)
C-2 ✅ (2026-04-26)
C-4 ✅ (2026-04-27)
C-5 ✅ (2026-04-29)
C-6 ✅ (2026-04-29)
─────────────────────
C-7 🔄 (2026-05-03 예정)
C-8 ⏳ (2026-05-06 예정)
C-9 ⏳ (2026-05-09 예정)

완료율: 56% (6/9)
테스트: 94% (763/808 PASS)
```

---

## C-7: L2 Proof 완전 통과 (진행 중)

### 핵심 문제
```
L2-01~16: 16/16 FAIL
에러: "bootstrap run1 JS 문법 오류"

스택 트레이스:
├─ self/codegen.fl line 85: template literal backtick 이스케이프
├─ src/codegen-js.ts: BUILTIN_MAP 검증 (완료)
└─ src/runtime-helpers.ts: _fl_slice 위치 확인 (완료)
```

### 즉시 작업

**Priority 1 (오늘):** Template literal 이스케이프
```fl
; self/codegen.fl line 85
; 현재:
(replace $s1 "`" "\`")

; 수정:
(replace $s1 "`" "\\`")
```

**Priority 2:** L2 test case 개별 디버깅
```bash
for i in {01..16}; do
  node bootstrap.js run tests/l2/case-$i.fl -o /tmp/out.js
  node --check /tmp/out.js
done
```

**Priority 3:** L2 Proof 최종 통과
```bash
bash scripts/verify-l2-proof.sh --run
# 기대: 모든 케이스 green
```

---

## C-8: Self-Hosting Fixed-Point (예정)

### 준비 중인 작업
- parse-block-fields while 루프 완성
- _fl_map_set 함수 통합
- stage1 → stage2 → stage3 SHA256 동일성

### 기대 효과
- 스택 오버플로우 위험 제거
- 대규모 블록 파싱 안정성
- 성능 10% 개선

---

## C-9: Fuzzing & Edge Cases (예정)

### 계획
- Property-based testing 강화
- Fuzzing 테스트 (QuickCheck 스타일)
- Error recovery 개선

### 기대 효과
- 엣지 케이스 처리 강화
- 안정성 A+ 달성

---

## 릴리스 타임라인

| 마일스톤 | 날짜 | 상태 |
|---------|------|------|
| Phase C-7 완료 | 2026-05-03 | 🔄 진행 중 |
| Phase C-8 완료 | 2026-05-06 | ⏳ 예정 |
| Phase C-9 완료 | 2026-05-09 | ⏳ 예정 |
| **v11.2-RC1** | **2026-05-10** | **⏳** |
| v11.2-RC2 | 2026-05-18 | ⏳ |
| **v11.2.0** | **2026-06-01** | **⏳** |

---

## 현재 블로킹 이슈

### Issue #1: L2 Proof JS 문법 오류
- **원인:** template literal backtick 이스케이프 (추정)
- **해결:** self/codegen.fl line 85 수정
- **영향:** 16개 test case 모두 차단
- **우선순위:** 🔴 CRITICAL

### Issue #2: parse-block-fields 재귀
- **현황:** while 루프 리팩토링 진행 중
- **영향:** C-8 완료 차단
- **우선순위:** 🟡 HIGH

### Issue #3: AI-library test cache
- **현황:** .test-cache/ai-lib.js 누락
- **영향:** 44개 ai-library 테스트 실패
- **우선순위:** 🟢 LOW (분리됨)

---

## 다음 단계 (C-7 체크리스트)

- [ ] self/codegen.fl line 85 template literal 수정
- [ ] npm run build && bash build-stage1.sh
- [ ] bash scripts/verify-l2-proof.sh --run
- [ ] 결과 분석 (기대: 3개 이상 PASS)
- [ ] 개별 케이스 디버깅 (case-01~16)
- [ ] L2 Proof 100% 통과
- [ ] Phase C-7 완료 커밋

**예상 소요 시간:** 6-8시간  
**완료 예정:** 2026-05-03

---

**마지막 업데이트:** 2026-04-29 15:40 UTC  
**작성자:** Claude Code
