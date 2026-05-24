# Phase C: Bootstrap Audit Plan (2026-05-24)

**목표**: TS 의존성을 정확히 지도화하고 제거 순서 결정  
**범위**: bootstrap.ts, bootstrap.js, cli.ts, build.ts, scripts/, cgc-main.fl  
**결과물**: bootstrap-audit.md (의존성 매트릭스)

---

## C-1: Audit Matrix 구조

각 모듈을 다음 항목으로 분류:

```
Module:        <filename>
Owner:         <author/team>
Size:          <lines of code>
Role:          <기능 설명>

Dependency:
  - Runtime:   <runtime에 필요한가?>
  - Build:     <빌드 시 필요한가?>
  - Bootstrap: <부트스트랩 시 필요한가?>

Current:       TypeScript
Replaceability: 
  - Category A: 제거 가능 (핵심 아님)
  - Category B: FL로 대체 가능 (구현 필요)
  - Category C: 현재 필수 (유지)

Candidate:     <FL 대체 파일명>
Effort:        <추정 개발 시간>
Priority:      <제거 우선도>
Risk:          <제거 시 위험도>
```

---

## C-2: 조사 대상 모듈

### Tier 1: 직접 TS 파일
- [ ] `bootstrap.ts` — 메인 진입점
- [ ] `cli.ts` — CLI 명령 dispatcher
- [ ] `build.ts` — 빌드 로직

### Tier 2: 지원 파일
- [ ] `scripts/` — 빌드 스크립트
- [ ] `*.ts` in `self/` — 자가호스팅 관련

### Tier 3: JS 래퍼
- [ ] `bootstrap.js` — TS 컴파일 결과
- [ ] node_modules 의존성

### Tier 4: 런타임 의존성
- [ ] NodeJS API 호출
- [ ] 파일 I/O
- [ ] 프로세스 관리

---

## C-3: 분류 체계

### Category A: 제거 가능
**특징**: 핵심 기능 아님, 편의성 제공만

**예상 대상**:
- 레거시 헬퍼 함수
- 임시 래퍼
- 호환성 shim
- 개발용 CLI 옵션

**처리**: 즉시 제거

### Category B: FL로 대체 가능
**특징**: 기능은 필요하나 FL로 재구현 가능

**예상 대상**:
- CLI 디스패처
- 인자 파서
- 파일 읽기/쓰기 (FL stdlib 사용)
- 빌드 명령 오케스트레이션

**처리**: 
1. FL 구현 완성
2. 테스트
3. 교체

### Category C: 현재 필수
**특징**: 제거 불가, 유지 필수

**예상 대상**:
- Parser bootstrap (cgc-main.fl 파싱에 필요)
- Compiler loader (바이너리 로드)
- GC/메모리 관리 (runtime)
- 타입 시스템 핵심

**처리**: 유지, 최소화 노력

---

## C-4: 의존성 구분

### Runtime Dependency
```
자가컴파일 중 실행 시 필요한 것들

예:
- 입력 파일 읽기
- 출력 파일 쓰기
- GC, 메모리 관리
```

### Build Dependency
```
개발 시 빌드할 때만 필요

예:
- TS 컴파일러 (tsc)
- 타입 체크
- 린터
```

### Bootstrap Dependency
```
자가컴파일 과정의 부트스트랩 단계

예:
- cgc-main.fl 파싱 (첫 컴파일)
- 초기 바이너리 생성
```

---

## C-5: 핵심 질문

### Q1: 가장 먼저 제거할 파일은?
**정답 후보**:
- [ ] cli.ts — CLI 기능을 freelang-cli.fl로 이동
- [ ] build helpers — 빌드 최소화
- [ ] 개발용 스크립트

### Q2: 마지막까지 남아야 하는 파일은?
**정답 후보**:
- [ ] bootstrap.ts — 초기 파싱
- [ ] core/parser.ts — AST 생성
- [ ] runtime/gc.ts — 메모리 관리

### Q3: Native compiler 생성에 실제로 필요한 것은?
**정답 후보**:
- cgc-main.fl (TS 의존 아님 ✅)
- Parser bootstrap (TS로 작성됨 ❌)
- Linker config (text 파일 ✅)

---

## C-6: 조사 절차

### Phase C-1: 정적 분석 (1-2시간)
```
각 TS 파일을 읽고 분류

체크리스트:
- [ ] bootstrap.ts 분석
- [ ] cli.ts 분석
- [ ] build.ts 분석
- [ ] scripts/ 분석
- [ ] 의존성 그래프 작성
```

### Phase C-2: 동적 분석 (1-2시간)
```
실제 빌드 과정에서 어떤 코드가 실행되는지 추적

추적 방식:
- console.log 추가
- import 로깅
- 함수 호출 추적
```

### Phase C-3: 매트릭스 작성 (1시간)
```
분석 결과를 bootstrap-audit.md로 작성

포맷:
Module | Role | Category | Candidate | Priority
```

### Phase C-4: 제거 순서 결정 (30분)
```
의존성 그래프 기반 제거 순서 결정

규칙:
1. Category A 먼저 제거
2. Category B는 FL 구현 후 교체
3. Category C는 유지
```

---

## C-7: 예상 결과

### 가능성 높은 구조

**1순위 제거**:
- cli.ts (dispatcher)
- build helper scripts
- dev-only utilities
- type annotations

**2순위 제거**:
- bootstrap wrapper logic
- command builders
- utility functions

**최후 잔존**:
- bootstrap.ts (parser 초기화)
- core/parser.ts (AST 생성)
- 타입 시스템

### TS 제거 후 스택

```
현재:
TypeScript
    ↓
Node.js
    ↓
ELF (native)

Phase C 후:
FreeLang (CLI)
    ↓
FreeLang (cgc-native)
    ↓
ELF (native)
```

---

## C-8: 성공 기준

### Phase C 완료 조건

- [ ] 모든 모듈 분류 완료
- [ ] 의존성 그래프 작성
- [ ] bootstrap-audit.md 작성
- [ ] 제거 순서 확정
- [ ] Phase D 진입 가능

### Phase D 진입 조건

다음 질문에 명확히 답변 가능:

1. "가장 먼저 제거할 TS 파일은?"
   - 파일명
   - FL 대체 구현
   - 소요 시간

2. "마지막까지 남을 TS 파일은?"
   - 이유
   - 의존성
   - 유지 방안

3. "Native compiler 생성 경로는?"
   - cgc-main.fl → bootstrap.ts → cgc-native
   - 또는 cgc-main.fl → freelang-cli.fl → cgc-native

---

## 예상 일정

```
C-1: 정적 분석        1-2시간
C-2: 동적 분석        1-2시간
C-3: 매트릭스 작성    1시간
C-4: 순서 결정        30분
────────────────────────────
총 예상 시간: 4-5시간

현재 토큰 사용: ~95%
→ 다음 세션에서 실행
```

---

## 커밋 계획

### 이번 세션
- [ ] PHASE-C-BOOTSTRAP-AUDIT-PLAN.md 작성
- [ ] Gogs 커밋

### 다음 세션
- [ ] Phase C 실행
- [ ] bootstrap-audit.md 생성
- [ ] Phase D 진입

---

**상태**: Phase C 준비 완료  
**다음**: Bootstrap Audit 실행
