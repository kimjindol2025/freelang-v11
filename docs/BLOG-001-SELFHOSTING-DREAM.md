# 연제-001: 자가호스팅의 꿈

**작성**: 2026-05-25  
**분류**: FreeLang v11 자가호스팅 여정  
**길이**: ~5분 읽기  

---

## 시작: 문제

2026년 초, FreeLang v11은 완성 단계였습니다.

하지만 한 가지 문제가 있었습니다:

```
FreeLang 컴파일러 자신이 TypeScript로 작성되어 있다.

bootstrap.js (44,988줄 TS)
  ↓
cgc-main.fl (1,528줄 FreeLang)
  ↓ 컴파일
gen1.c (142KB C 코드)
```

**문제**: FreeLang 컴파일러를 사용하려면 Node.js가 필요했습니다.

이는 언어 자부심의 문제였습니다.

---

## 질문

**"FreeLang으로 FreeLang을 컴파일할 수 있을까?"**

만약 그렇다면:
- FreeLang은 "자가호스팅 언어"가 되고
- Node.js 의존성을 제거할 수 있고
- 진정한 "독립형 언어"가 될 수 있다

---

## 자가호스팅이란?

**정의**: 언어의 컴파일러가 그 언어 자신으로 작성되어 있는 상태.

**예시**:
- **Python**: Python으로 작성된 CPython
- **Rust**: Rust로 작성된 rustc
- **Go**: Go로 작성된 go
- **C**: C로 작성된 gcc (자신을 컴파일)

**FreeLang의 꿈**: cgc-main.fl은 이미 FreeLang입니다.  
나머지는 검증의 문제입니다.

---

## 로드맵: Phase A-F

우리는 5개월 간의 계획을 세웠습니다.

| Phase | 목표 | 상태 |
|-------|------|------|
| **A** | Self-host Gap Audit | ✅ 완료 (2026-05-24) |
| **B-1** | Recur TCO | ✅ 완료 (2026-05-24) |
| **B-2** | Closure Capture | ✅ 완료 (2026-05-24) |
| **B-3** | HOF (map/filter) | ✅ 완료 (2026-05-24) |
| **C** | Bootstrap Audit | ✅ 완료 (2026-05-24) |
| **D** | L4 Native Self-Hosting | ✅ 완료 (2026-05-24) |
| **E-0** | L4 Stabilization | ✅ 완료 (2026-05-24) |
| **E-1~3** | (진행 중) | 🔄 |
| **F** | TS Removal | 📋 설계 완료 (2026-05-25) |

---

## 성과: L4 달성

**2026-05-25**, 우리는 증명했습니다:

```
gen1.c (bootstrap.js로 생성)
  ↓ SHA256 = 5c1ede...
  
gen1-bin (네이티브 컴파일러)
  ↓ cgc-main.fl 컴파일
  
gen2.c 생성
  ↓ SHA256 = 5c1ede... ✅

gen2.c → gcc → gen2-bin

gen2-bin (또 다른 네이티브 컴파일러)
  ↓ cgc-main.fl 컴파일
  
gen3.c 생성
  ↓ SHA256 = 5c1ede... ✅

결론: gen1.c == gen2.c == gen3.c
```

**의미**: FreeLang 컴파일러가 자신을 **정확히 재생성**합니다.

이것이 **"자가호스팅 고정점 (Level 4 Fixed-Point)"**입니다.

---

## 다음은?

이 연제에서 우리는:

1. **Phase A~E**: 자가호스팅의 기술적 도전
2. **L4 검증**: 3중 SHA256 검증의 의미
3. **Phase F**: TypeScript 완전 제거 계획

을 다룹니다.

---

## 통계

| 항목 | 수치 |
|------|------|
| 총 Phase | 6개 (A-F) |
| 소요 기간 | 5개월 (2026-01~05) |
| 완료 단계 | 7개 (A, B1-B3, C, D, E-0) |
| 코드 라인 | 8,500줄 (cgc-main.fl + runtime) |
| 검증 메커니즘 | SHA256 3중 비교 |
| Node.js 의존 제거 | 가능 입증됨 ✅ |

---

## 이번 연제의 내용

### 1부: 기초 (연제-001~002)
- 자가호스팅이란?
- Phase A: Gap Audit

### 2부: 기술 (연제-003~006)
- Phase B: P2-Core 구현
- Phase C: Bootstrap 감사

### 3부: 성과 (연제-007~010)
- Phase D: L4 달성
- Phase E: 안정화
- L4 검증: 과학
- Phase F: 미래

---

다음 편에서는 **Phase A: 자가호스팅 간격**을 살펴봅니다.
