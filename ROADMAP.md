# FreeLang v11 공식 로드맵

> **언어 정의**: AI 에이전트 실행 엔진  
> **설계 철학**: Deterministic + Self-Hosted + AI-First  
> **현황 기준**: 2026-04-28

---

## 🎯 전략 요약

```
Phase A (즉시 ~ 2주)    → Bootstrap 폐기 (primary = stage1)
Phase B (3-4주)         → Codegen 모듈 스코핑 (필요시)
Phase C (완료)          → C1/C2/C4 완료, C3 미해결 (미루기)
Phase D (장기)          → 모듈 시스템 v12+ (추후 제공)
```

---

## 📌 Phase A: Bootstrap 폐기 및 Self-Parser 승격

**목표**: stage1.js를 primary compiler로, bootstrap.js 제거

### A-1: 기초 정리 ✅ (2026-04-28 완료)
- [x] self/parser.fl 중복 AST 함수 제거
- [x] build-stage1.sh concat 순서 정정 (ast 먼저)
- [x] stage1.js 재생성 (1925줄)
- [x] README 설계 철학 공식화

### A-2: Self-Parser 문법 통합 (2주) 🟢 거의 완료

**요구사항**: self-parser = bootstrap 문법의 상위 집합

**격차 조사 완료** (Blog #602):
- [x] try/catch 확인: ❌ **격차** (Bootstrap O, Self-Parser X)
- [x] cond 확인: ✅ 호환 (Phase 2에서 구현)
- [x] loop 확인: ❌ 격차 (Bootstrap O, Self-Parser X, 특수형)
- [x] match 확인: ✅ 모두 미지원

**결과**: self-parser 호환도 **87%** (try/catch 추가로 90%+)

**진행 현황** (2026-04-29 Session 3 최종):
- [x] **Try-Catch 구현** (A-2-1) ✅ 완료
  - [x] src/parser.ts: TS 형식 + self-hosted 호환 파싱
  - [x] src/codegen-js.ts: Try-Catch 코드젠
  - [x] Catch 핸들러 다중 식 지원 (수정)
  - [x] Bootstrap.js 검증 ✅ (패턴 A-E 작동)
  - [x] Self-hosted 소스 (self/codegen.fl) 준비 완료
  - 🟠 Stage1 자체호스팅: 런타임 헬퍼 누락 (미루기 - phase2 이후)
  - 🟠 알려진 문제: throw 메시지 전달 미완
- [x] **Template Literal** (A-2-2) ✅ 완료
  - [x] ${varName} 변수 치환
  - [x] ${(expr)} 표현식 평가
  - [x] 코드젠 JavaScript 템플릿 리터럴 생성
- [ ] Loop 특수형 (A-2-3, 미루기)
- [ ] **Let Block Fields 버그** (Phase C-5)
  - 근본 원인: Array block fields 부재
  - 임시 해결: cg-let-1d/2d null check ✅
  - 상태: 자체호스팅 안정화 후 처리

### A-3: Bootstrap 최소화 (1주)
**역할**: stage1 생성 전용으로 축소

**작업**:
```
1. bootstrap.js verify-self-host 제거
   (대신 node stage1.js verify-self-host 사용)
2. 배포 문서 업데이트
3. CI/CD 파이프라인 변경
```

**검증**: stage1만으로 전체 빌드 가능 확인

### A-4: Phase A 완료 선언 (2주 말) 🟢 준비중
**상태** (2026-04-29):
- A-1: ✅ 기초 정리 완료
- A-2: ✅ Try-Catch + Template Literal 완료 (Loop defer)
- A-3: ⏳ Bootstrap 최소화 (자체호스팅 완성 후)
- A-4: 🔄 v11.1.0-alpha 선언 준비

**다음 작업**:
```
[ ] A-4 커밋: "Phase A: Try-Catch & Template Literal 완료"
[ ] A-4 블로그: "Phase A-2 완료 — AI 에이전트 안정 기능"
[ ] A-4 버전: v11.1.0-alpha (bootstrap.js 안정)
```

---

## 🔧 Phase B: Codegen 모듈 스코핑 (조건부)

**상태**: 설계 검토 중 (필요시만)

### 현황
- 자체호스팅 에러: str_repeat 등 helper 함수 중복
- **AI 관점**: 현재 flat namespace가 더 나음
- **결정**: 모듈 시스템은 v12+ 이후

### 임시 조치 (필요시)
```
Option 1: str_repeat → string_str_repeat (prefix 추가)
Option 2: Phase B 스킵 (권장)
```

**결정**: 🟢 **필요시만** (지금은 불필요)

---

## ✨ Phase C: 증명 강화 (진행 중)

**현황** (2026-04-29):
- C1: - 연산자 가변인자 ✅
- C2: append 가변인자 ✅
- C3: loop 식별자 충돌 🟠 (미루기)
- C4: let-rec 패턴 ✅
- **C5: Let Block Fields 버그** 🔴 (발견, 임시 해결)
  - 문제: Array block의 fields가 null/비어있음 → codegen 실패
  - 근본 원인: Parser (parseArray) vs Interpreter 호환성 미정
  - 임시 해결: cg-let-1d/2d에 null check 추가 (2026-04-29)
  - 우선순위: 자체호스팅 안정화 후 (phase1 이후)

**결정** (2026-04-29 Session 3):
- [x] C3 미루기: loop 식별자 충돌 (v12+ 모듈 시스템 시점)
- [x] C5 미루기: Let Block Fields (자체호스팅 phase2 시점)
- [ ] Property test: examples/patterns/ 검증 (다음 단계)
- [ ] Phase C 완료 선언 (C5 제외)

---

## 📅 v12: 모듈 시스템 (장기)

**시기**: 2026-Q3 이후 (현재 불필요)

**계획**:
```
- 네임스페이스 문법 추가
- import/export 지원
- 순환 의존성 처리
```

**이유**: 현재는 AI 1회 요청 = 1파일 패턴에 최적화

---

## 🎓 평가 기준

### Phase A 성공 (2주)
```
✅ Stage1만으로 빌드 가능
✅ Bootstrap 제거 (또는 불필요)
✅ verify-self-host tier2 > 91 PASS
✅ 버전 v11.1.0-alpha 배포
```

### 최종 등급
```
현재: A (자체호스팅 고정점 달성)
Phase A 완료: A+ (bootstrap 폐기)
Phase B/C: A++ (필요시)
```

---

## 📊 타임라인

```
Week 1 (지금~4월 30일)
├─ A-1 완료 ✓
├─ A-2 격차 조사
└─ A-3 CI/CD 준비

Week 2 (5월 1~7일)
├─ A-2 구현 (필요시)
├─ A-3 완료
└─ A-4 선언

Week 3+ (5월 8일~)
├─ Phase B (필요시)
├─ Phase C 완료
└─ v11.1.0 정식 배포
```

---

## 🚀 최종 비전

**FreeLang v11.1** (2026-05월 말):
```
✅ Self-hosted compiler (bootstrap 폐기)
✅ AI 에이전트 안정 엔진
✅ 완벽한 결정론과 재현성
✅ 자주국방 원칙 (외부 의존 0)
```

**평가**: **A+ (Production Ready)**

---

## 📝 추적

- 로드맵 정책: ROADMAP.md (이 파일)
- Phase 진행: gogs Issues
- 기술 논의: blog.dclub.kr (포스팅)
- 일일 상태: CLAUDE.md 메모리
