# FreeLang v11 문서 색인

**이 폴더의 모든 문서를 빠르게 찾는 길라잡이**

---

## 🤖 AI/개발자가 **먼저 읽을 문서**

### 1. [AI_LEARNING_PATH.md](./AI_LEARNING_PATH.md) ⭐⭐⭐
**읽는 시간**: 30분  
**대상**: Claude 및 AI 에이전트  
**내용**:
- 언어 철학 & 설계 철학
- 기본 문법 (defn, let, map, filter 등)
- **AI가 자주 하는 7가지 실수와 해결책**
- 코드 생성 후 체크리스트

**먼저 이것을 읽으세요!** 다른 모든 이해는 여기서 시작.

---

### 2. [STDLIB_REFERENCE.md](./STDLIB_REFERENCE.md) ⭐⭐
**읽는 시간**: 필요할 때 (함수 검색용)  
**대상**: 함수 사용 시 참고  
**내용**:
- 30개+ stdlib 함수 상세
- 시그니처 (파라미터, 반환값)
- 각 함수의 예제
- 자주 틀리는 순서/파라미터

**코드 생성 중 함수명 확실하지 않으면 여기 검색**

---

### 3. [AI_QUICKSTART.md](./AI_QUICKSTART.md) ⭐⭐
**읽는 시간**: 5분 (생성 후)  
**대상**: 코드 생성 후 검증  
**내용**:
- 컴파일 테스트 방법
- 에러 메시지 해석
- 빠른 디버깅 팁

**코드를 만든 후 "올바른가?" 확인할 때 사용**

---

## 📚 참고용 문서

### 4. [AI_REFERENCE.md](./AI_REFERENCE.md)
- 전체 함수 시그니처 (간단 버전)
- 모듈별 분류 (io, string, array, map 등)

### 5. [AI_SYSTEM_PROMPT.md](./AI_SYSTEM_PROMPT.md)
- 자동 생성된 전체 stdlib 함수 문서 (3,777개)
- 시스템 프롬프트 용도

### 6. [AI_SYSTEM_PROMPT_MINI.md](./AI_SYSTEM_PROMPT_MINI.md)
- 축약 버전 (가장 자주 사용하는 함수만)
- 토큰 절약용

### 7. [STDLIB_NAMING_AUDIT.md](./STDLIB_NAMING_AUDIT.md)
- stdlib 함수명 규칙
- 하이픈(-) vs 언더스코어(_) 정책
- 파라미터 순서 규칙

---

## 📊 성능 & 벤치마크

### 8. [../benchmark-results.json](../benchmark-results.json) ⭐ 성능 데이터
**실측 성능 (검증됨)**:
- **Lexing**: 530만 ops/sec
- **Parsing**: 31만 ops/sec
- **Execution**: 99만 ops/sec
- **Memory**: 75MB (heapUsed)
- **Compilation**: 128만 lines/sec
- **Concurrency**: 23,938 ops/sec (async)

이 파일은 자동 생성되며, 빌드마다 업데이트됨.

---

## 🛠️ 구현/배포 문서

### 9. [API.md](./API.md)
- HTTP 서버 API (server_get, server_post 등)
- 요청/응답 형식

### 10. [DEPLOYMENT.md](./DEPLOYMENT.md)
- 프로덕션 배포 가이드
- Docker, CI/CD 설정

### 11. [ARCHITECTURE.md](./ARCHITECTURE.md)
- FreeLang 컴파일러 아키텍처
- 파서, 코드생성, 인터프리터 구조

---

## 📖 예제 & 튜토리얼

### 12. [guide/](./guide/)
- 초급자 튜토리얼
- 단계별 학습

### 13. [examples/patterns/](../examples/patterns/) ⭐⭐ 실무 패턴 10개
**AI/개발자가 반드시 봐야 할 실무 예제**:

1. **01-map-filter-reduce.fl** — 고차 함수 마스터
2. **02-error-handling.fl** — try-catch 패턴
3. **03-type-validation.fl** — 타입 검증 (입력 안전화)
4. **04-state-management.fl** — 불변 상태 관리
5. **05-api-integration.fl** — HTTP 요청/응답
6. **06-database-operations.fl** — DB 쿼리
7. **07-string-processing.fl** — 문자열 처리
8. **08-data-transformation.fl** — JSON 변환
9. **09-decision-logic.fl** — 조건 분기 (cond/case)
10. **10-agent-orchestration.fl** ⭐ — AI 에이전트 작업 조정

**읽는 순서**:
```
기본: 01 → 02 → 03 (고차, 에러, 타입)
실무: 04 → 05 → 06 (상태, API, DB)
고급: 08 → 09 → 10 (변환, 로직, 에이전트)
```

각 파일은 2-3KB, 주석 포함, 그대로 실행 가능.

### 14. [examples/](../examples/)
- 초보자 예제 (hello.fl, factorial.fl)
- 브라우저 테스트

---

## 🎯 읽는 순서 가이드

### 빠른 시작 (30분)
```
1. AI_LEARNING_PATH.md 읽기
2. 간단한 코드 작성 (hello.fl)
3. 컴파일 & 실행
4. 완료!
```

### 실무 코드 작성 (1시간)
```
1. AI_LEARNING_PATH.md ✅
2. STDLIB_REFERENCE.md에서 필요한 함수 검색
3. examples/patterns/에서 유사 패턴 참고
4. 코드 작성
5. AI_QUICKSTART.md의 체크리스트 확인
6. 컴파일 & 실행
```

### 깊이 있는 학습 (2-3시간)
```
1. AI_LEARNING_PATH.md ✅
2. STDLIB_REFERENCE.md 전체 읽기
3. ARCHITECTURE.md로 컴파일러 이해
4. src/__tests__/ 의 테스트 코드 읽기 (실제 동작)
5. examples/patterns/ 모든 코드 분석
```

---

## ⚠️ 자주하는 실수 (미리보기)

다음을 헷갈리는 AI는 AI_LEARNING_PATH.md를 다시 읽으세요:

```lisp
❌ (map [1 2 3] fn)       → ✅ (map fn [1 2 3])
❌ (console-log "hi")     → ✅ (println "hi")
❌ (= x null)             → ✅ (nil? x)
❌ {a 1 b 2}              → ✅ {:a 1 :b 2}
❌ (reduce init list fn)  → ✅ (reduce fn init list)
```

**더 많은 실수?** → AI_LEARNING_PATH.md의 "AI가 자주 하는 실수"

---

## 🔍 빠른 검색

함수명을 찾고 싶은데 확실하지 않으면:

1. **STDLIB_REFERENCE.md**에서 `Ctrl+F` 검색
2. **STDLIB_NAMING_AUDIT.md**에서 규칙 확인
3. **src/stdlib-*.ts**에서 구현 코드 확인

---

## 📞 피드백

이 문서들이 도움이 되지 않으면:
- AI_LEARNING_ASSESSMENT.md 참고 (개선 계획)
- /root/kim/CLAUDE.md의 메모리 시스템 확인

---

**TL;DR**: **AI_LEARNING_PATH.md부터 읽으세요!**
