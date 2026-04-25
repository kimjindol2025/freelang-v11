# FreeLang v11 패턴 예제 모음

**목적**: AI가 일반적인 코딩 패턴을 배우고, 이를 바탕으로 버그 없는 코드를 생성하도록 돕기

**대상**: AI 에이전트, 개발자 (AI 입장에서 학습하려는 사람)

**예제 수**: 10개 (총 50+ 패턴)

---

## 📚 패턴 목록

### 1️⃣ [map, filter, reduce 기본 사용법](./01-map-filter-reduce.fl)
**주제**: 함수형 데이터 처리

**주요 패턴**:
- `(map fn list)` — 요소 변환
- `(filter predicate list)` — 조건 필터링
- `(reduce fn init list)` — 누적 계산
- 조합 활용 (map + filter)
- 복잡한 변환

**AI 학습 포인트**:
- ✅ 함수형 프로그래밍의 기초
- ✅ 함수 인자 순서 (함수가 먼저!)
- ✅ case 문으로 등급 결정

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/01-map-filter-reduce.fl
```

---

### 2️⃣ [에러 처리 (try-catch)](./02-error-handling.fl)
**주제**: 안전한 에러 처리

**주요 패턴**:
- 기본 `try-catch`
- 중첩된 에러 처리
- 에러 무시 + 기본값 반환
- 명시적 검증 + 에러 발생
- Promise 기반 비동기 에러
- 다중 에러 처리

**AI 학습 포인트**:
- ✅ try-catch는 필수
- ✅ 에러 메시지는 명확하게
- ✅ 검증 먼저, 처리 나중

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/02-error-handling.fl
```

---

### 3️⃣ [타입 검증 (Type Checking)](./03-type-validation.fl)
**주제**: 버그 예방을 위한 타입 검증

**주요 패턴**:
- 기본 타입 검증 (number?, string?, etc.)
- 복합 타입 검증 (배열 요소)
- nil 안전 처리 (Optional)
- 조건부 타입 검증
- 타입 어서션 (assert)
- 배열 요소 필터링

**AI 학습 포인트**:
- ✅ 모든 외부 입력은 검증
- ✅ nil은 자주 발생 → 항상 체크
- ✅ 타입 강제로 버그 방지

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/03-type-validation.fl
```

---

### 4️⃣ [상태 관리 (State Management)](./04-state-management.fl)
**주제**: AI 에이전트의 메모리/컨텍스트 관리

**주요 패턴**:
- 상태 전이 (state transition)
- 상태 업데이트
- 상태 완료
- 상태 머신 (state machine)
- 상태 조회 헬퍼

**AI 학습 포인트**:
- ✅ 불변성: 상태는 복사본으로 수정
- ✅ merge로 상태 갱신
- ✅ case로 상태별 처리

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/04-state-management.fl
```

---

### 5️⃣ [API 통합 (REST API)](./05-api-integration.fl)
**주제**: 외부 API 호출 및 처리

**주요 패턴**:
- 기본 GET 요청
- 쿼리 파라미터
- 인증 헤더
- POST 요청
- 복잡한 API 플로우
- 재시도 로직 (Retry)
- 병렬 호출
- 응답 검증
- 배치 처리

**AI 학습 포인트**:
- ✅ 항상 try-catch로 감싸기
- ✅ 응답은 nil 체크
- ✅ 재시도는 지수 백오프

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/05-api-integration.fl
```

---

### 6️⃣ [데이터베이스 작업 (Database)](./06-database-operations.fl)
**주제**: 데이터베이스 쿼리 및 조작

**주요 패턴**:
- SELECT (조회)
- WHERE 조건
- INSERT (삽입)
- UPDATE (수정)
- DELETE (삭제)
- 트랜잭션
- 집계 함수 (COUNT, SUM, AVG)
- 페이지네이션
- 조인 쿼리
- 결과 매핑

**AI 학습 포인트**:
- ✅ SQL은 파라미터 바인딩
- ✅ 트랜잭션은 한 블록으로
- ✅ 결과는 map으로 가공

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/06-database-operations.fl
```

---

### 7️⃣ [문자열 처리 (String Processing)](./07-string-processing.fl)
**주제**: 텍스트 데이터 분석 및 변환

**주요 패턴**:
- 문자열 연결
- 분할 및 처리
- 검색 및 치환
- 대소문자 변환
- 공백 제거
- 포함 여부 확인
- 이메일/URL 검증
- 문자열 템플릿
- 유효성 검사
- 문자열 분류

**AI 학습 포인트**:
- ✅ str()로 연결
- ✅ str-split()로 파싱
- ✅ str-includes()로 검증

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/07-string-processing.fl
```

---

### 8️⃣ [데이터 변환 (Data Transformation)](./08-data-transformation.fl)
**주제**: 한 형식에서 다른 형식으로 변환

**주요 패턴**:
- 배열 ↔ 맵 변환
- 중첩 구조 평탄화
- 그룹핑 (Group By)
- 데이터 병합
- 필드 선택 (Pick)
- 필드 제외 (Omit)
- 정규화 (Normalize)
- 조건부 변환
- 요약 (Summary)

**AI 학습 포인트**:
- ✅ map으로 구조 변환
- ✅ filter로 선택적 추출
- ✅ reduce로 통합 계산

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/08-data-transformation.fl
```

---

### 9️⃣ [의사결정 로직 (Decision Logic)](./09-decision-logic.fl)
**주제**: 조건부 처리 및 분기

**주요 패턴**:
- if-else 중첩
- and/or 조건
- case 문
- 기본값 처리
- 조건부 필터링
- 조건부 변환
- 우선순위 선택
- 조건부 액션
- early return (throw)

**AI 학습 포인트**:
- ✅ case는 깔끔한 코드
- ✅ and/or로 복합 조건
- ✅ throw로 early return

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/09-decision-logic.fl
```

---

### 🔟 [에이전트 오케스트레이션 (Agent Orchestration)](./10-agent-orchestration.fl)
**주제**: AI 에이전트가 복잡한 작업을 조화롭게 실행

**주요 패턴**:
- 작업 큐 관리
- 작업 실행 엔진
- 조건부 작업 흐름
- 에이전트 실행 루프
- 컨텍스트 관리
- 결과 수집
- 병렬 작업
- 에러 복구
- 작업 의존성
- 에이전트 모니터링

**AI 학습 포인트**:
- ✅ 상태 머신으로 흐름 제어
- ✅ reduce로 누적 실행
- ✅ 에러 처리는 필수

**실행 방법**:
```bash
node bootstrap.js run examples/patterns/10-agent-orchestration.fl
```

---

## 🎯 추천 학습 순서

### 초급 (기초 다지기)
1. map, filter, reduce 기본
2. 에러 처리
3. 타입 검증

### 중급 (실무 패턴)
4. 상태 관리
5. 문자열 처리
6. 의사결정 로직

### 고급 (복잡한 작업)
7. API 통합
8. 데이터베이스
9. 데이터 변환
10. 에이전트 오케스트레이션

---

## 💡 각 패턴의 실행 방법

### 전체 실행
```bash
cd examples/patterns
for f in *.fl; do
  echo "=== $f ==="
  node ../../bootstrap.js run "$f"
done
```

### 특정 패턴만 실행
```bash
node bootstrap.js run examples/patterns/01-map-filter-reduce.fl
```

### 테스트 포함
```bash
npm test -- --testPathPattern="patterns"
```

---

## 🔍 패턴 내 검색

각 파일의 "패턴 A, B, C..." 를 찾고 싶다면:

```bash
grep -n "패턴 A" examples/patterns/*.fl
grep -n "defun" examples/patterns/01-map-filter-reduce.fl
```

---

## ✨ 사용 팁

1. **복사 & 수정**: 각 패턴을 복사해서 자신의 코드에 맞게 수정
2. **조합**: 여러 패턴을 조합해서 복잡한 로직 구성
3. **검증**: 생성한 코드를 이 패턴들과 비교해 맞는지 확인
4. **확장**: 새 패턴이 생기면 여기에 추가

---

## 📞 AI를 위한 요약

**이 10개 패턴을 마스터하면**:
- ✅ 80%의 일반적인 AI 작업 가능
- ✅ 버그 없는 코드 생성 가능
- ✅ 복잡한 에이전트 로직 작성 가능

**금지된 패턴** (자주 틀림):
- ❌ `(map [1 2 3] fn)` — 순서 틀림
- ❌ `(if x then)` — else 없음
- ❌ 변수 수정 시도 — 불변성 위반
- ❌ 에러 처리 없음 — 항상 try-catch

---

## 🚀 다음 단계

- [stdlib 참조](../docs/STDLIB_REFERENCE.md) 읽기
- [AI 학습 경로](../docs/AI_LEARNING_PATH.md) 학습
- 실제 AI 코드 생성 및 테스트
