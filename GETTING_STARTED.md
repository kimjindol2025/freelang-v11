# FreeLang v9 - 빠른 시작 가이드

**4개 표준 자동 적용 완료**
**작성일**: 2026-04-04

---

## 🚀 5분 안에 시작하기

### 1단계: 의존성 설치

```bash
cd /data/data/com.termux/files/home/freelang-v9
npm install
```

### 2단계: 빌드

```bash
npm run build
```

### 3단계: 테스트 실행

```bash
npm test
```

### 4단계: 성능 벤치마크

```bash
npm run benchmark
```

---

## 📚 주요 명령어

### 테스트

```bash
# 모든 테스트 실행
npm test

# Watch 모드 (파일 변경 감지)
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage

# CI 환경에서 실행
npm run test:ci

# 기존 테스트 호환성
npm run test-legacy
```

### 빌드 및 실행

```bash
# TypeScript → JavaScript 컴파일
npm run build

# HTTP 서버 시작
npm start
npm run server

# 성능 벤치마크
npm run benchmark
```

### 레거시 테스트

```bash
# 파서 테스트
npm run test-parser

# 인터프리터 테스트
npm run test-interpreter

# 엔드-투-엔드 테스트
npm run test-e2e
```

---

## 📁 프로젝트 구조

```
freelang-v9/
├── 📄 설정 파일
│   ├── tsconfig.json           # TypeScript 설정
│   ├── jest.config.js          # Jest 설정
│   └── package.json            # NPM 패키지 정의
│
├── 📊 CI/CD
│   └── .github/workflows/
│       ├── test.yml            # 테스트 자동화
│       └── performance.yml     # 성능 모니터링
│
├── 📝 명세서
│   ├── SPEC.md                 # 언어 명세 (3,500줄)
│   ├── openapi.yaml            # HTTP API 명세
│   └── README.md               # 프로젝트 개요
│
├── 🧪 소스 코드
│   └── src/
│       ├── lexer.ts            # 렉서 (토큰화)
│       ├── parser.ts           # 파서 (AST 생성)
│       ├── ast.ts              # AST 정의
│       ├── interpreter.ts      # 인터프리터
│       ├── token.ts            # 토큰 정의
│       ├── http-server-runner.ts  # HTTP 서버
│       ├── __tests__/          # 테스트
│       │   ├── setup.ts        # 테스트 환경
│       │   ├── lexer.test.ts   # 렉서 테스트
│       │   ├── parser.test.ts  # 파서 테스트
│       │   └── interpreter.test.ts  # 인터프리터 테스트
│       ├── runtime/            # 런타임 (확장 가능)
│       └── stdlib/             # 표준 라이브러리 (확장 가능)
│
├── 🔧 스크립트
│   └── scripts/
│       └── benchmark.js        # 성능 벤치마크
│
└── 📚 예제
    ├── examples/
    │   ├── simple-intent.fl
    │   ├── api-server.fl
    │   └── http-server.fl
    └── v9-examples.fl
```

---

## 🧪 테스트 시스템

### 테스트 파일 구성

#### 1. Lexer 테스트 (15개)
```bash
npm test -- lexer.test
```
- 토큰 인식 (10개 테스트)
- 고급 문법 (5개 테스트)
- 에러 처리 (3개 테스트)

#### 2. Parser 테스트 (17개)
```bash
npm test -- parser.test
```
- 기본 식 파싱 (10개 테스트)
- 제네릭 및 타입 (5개 테스트)
- 비동기 기능 (2개 테스트)

#### 3. Interpreter 테스트 (20개)
```bash
npm test -- interpreter.test
```
- 기본 실행 (10개 테스트)
- 비동기 실행 (5개 테스트)
- 타입 시스템 (3개 테스트)
- 에러 처리 (2개 테스트)

### 커버리지 목표

| 지표 | 목표 |
|------|------|
| Line Coverage | 90%+ |
| Branch Coverage | 85%+ |
| Function Coverage | 90%+ |
| Statement Coverage | 90%+ |

---

## 📊 성능 모니터링

### 로컬 벤치마크 실행

```bash
npm run benchmark
```

### 성능 지표

6개 카테고리 자동 측정:

1. **렉싱** (Lexing)
   - 목표: >1000 ops/sec
   - 측정: 1000회 반복

2. **파싱** (Parsing)
   - 목표: >50 ops/sec
   - 측정: 100회 반복

3. **실행** (Execution)
   - 목표: >1000 ops/sec
   - 측정: 1000회 반복

4. **메모리** (Memory)
   - 목표: <100MB
   - 측정: 1000개 할당

5. **컴파일** (Compilation)
   - 목표: <100ms
   - 측정: TypeScript 컴파일

6. **동시성** (Concurrency)
   - 목표: >100 ops/sec
   - 측정: 100개 Promise

### GitHub Actions 자동 실행

```yaml
# Push 시 자동 실행
- main 또는 develop 브랜치로 푸시

# 매일 자동 실행
- 매일 자정 (UTC)
```

---

## 📖 문서

### 언어 명세서 (SPEC.md)

완전한 FreeLang v9 언어 정의:

- **어휘 분석**: 토큰 및 예약어
- **문법**: EBNF 형식의 파서 문법
- **타입 시스템**: 원시, 복합, 제네릭 타입
- **표현식**: 연산자, 함수 호출, 람다
- **문장**: 변수, 조건, 반복
- **함수**: 선언, 클로저, 고차 함수
- **객체/구조체**: 정의 및 사용
- **에러 처리**: try-catch, Result 타입
- **비동기**: Promise, async/await
- **모듈**: import/export
- **표준 라이브러리**: 33개 내장 함수
- **예제**: 5개 완전 프로그램

### HTTP API 명세 (openapi.yaml)

OpenAPI 3.0.0 준수:

| 엔드포인트 | 설명 |
|-----------|------|
| POST `/api/compile` | 코드 컴파일 |
| POST `/api/execute` | 코드 실행 |
| POST `/api/analyze` | 코드 분석 |
| POST `/api/lint` | 스타일 검사 |
| POST `/api/test` | 테스트 실행 |
| POST `/api/format` | 코드 포맷팅 |
| POST `/api/benchmark` | 성능 측정 |
| POST `/api/debug` | 디버그 정보 |
| GET `/api/version` | 버전 정보 |
| GET `/api/health` | 헬스 체크 |

---

## 🔍 대표 예제

### 예제 1: 변수 및 함수

```freelang
var x = 10

fn add(a, b) {
  a + b
}

var result = add(x, 5)
print(result)  // 15
```

### 예제 2: 조건문

```freelang
var age = 25

if (age >= 18) {
  print("Adult")
} else {
  print("Minor")
}
```

### 예제 3: 배열 및 반복

```freelang
var numbers = [1, 2, 3, 4, 5]

for n in numbers {
  print(n * 2)
}

var doubled = numbers.map((x) => x * 2)
```

### 예제 4: 비동기

```freelang
async fn fetchData() {
  var response = await fetch("/api/data")
  var data = await response.json()
  data
}

async fn main() {
  var result = await fetchData()
  print(result)
}
```

### 예제 5: 에러 처리

```freelang
fn divide(a, b) {
  if (b == 0) {
    throw "Division by zero"
  }
  a / b
}

try {
  var result = divide(10, 0)
} catch (e) {
  print("Error: " + e)
}
```

---

## 🐛 디버깅

### 테스트 실행 시 자세한 정보

```bash
# 자세한 로그 활성화
npm test -- --verbose

# 특정 테스트만 실행
npm test -- lexer.test

# Watch 모드로 개발
npm run test:watch
```

### 타입 에러 확인

```bash
npm run build
```

### 성능 프로파일링

```bash
# 메모리 누수 감지 활성화
npm test -- --detectOpenHandles

# 커버리지 분석
npm run test:coverage
```

---

## 📈 진행 상황

### Phase 1: 기초 설정 (완료)
- ✅ TypeScript 마이그레이션
- ✅ Jest 테스트 프레임워크
- ✅ GitHub Actions 워크플로우
- ✅ 성능 벤치마크 스크립트
- ✅ 언어 명세서 작성
- ✅ API 명세 (OpenAPI)

### Phase 2: 테스트 확대 (진행 중)
- 🟡 커버리지 90%+ 달성
- 🟡 엣지 케이스 테스트 추가
- 🟡 통합 테스트 추가
- 🟡 성능 기준선 확정

### Phase 3: 표준 통합 (예정)
- 입력 검증 (validation.fl)
- 에러 처리 (error-handling-template.fl)
- 보안 정책 (SECURITY.md)
- 문서 자동화

---

## ❓ FAQ

### Q1: 테스트가 실패하면?

```bash
# 의존성 재설치
npm install

# 캐시 제거
npm run build -- --clean

# 전체 테스트 실행
npm test
```

### Q2: 성능이 기준 이하면?

1. 벤치마크 결과 확인: `benchmark-results.json`
2. 병목 지점 분석
3. 최적화 적용
4. 다시 벤치마크 실행

### Q3: 타입 에러가 있으면?

```bash
npm run build

# 수정 후
git add .
git commit -m "Fix type errors"
```

### Q4: Watch 모드에서 빠르게 반복?

```bash
npm run test:watch

# 파일을 변경하면 자동으로 테스트 실행
```

---

## 🔗 관련 문서

- **SPEC.md** - 완전한 언어 명세
- **openapi.yaml** - HTTP API 명세
- **21_FREELANG_V9_COMPLETE.md** - 작업 완료 보고서
- **README.md** - 프로젝트 개요
- **CLAUDE.md** - Claude 사용 가이드

---

## 📞 지원

### 문제 발생 시
1. 이 가이드의 FAQ 확인
2. SPEC.md의 해당 섹션 읽기
3. 테스트 파일 검토
4. 로그 메시지 확인

### 개선 제안
- GitHub Issues 작성
- Pull Request 제출
- 문서 개선 제안

---

## ✨ 요약

이제 준비가 완료되었습니다:

1. ✅ **52개 테스트** - 렉서, 파서, 인터프리터
2. ✅ **자동 성능 모니터링** - 6개 카테고리
3. ✅ **CI/CD 통합** - GitHub Actions 완전 설정
4. ✅ **완전한 명세** - 3,500줄의 상세 문서

시작하려면:
```bash
npm install
npm test
npm run benchmark
```

행운을 빕니다! 🚀

---

**마지막 업데이트**: 2026-04-04
**버전**: v9.0.0
