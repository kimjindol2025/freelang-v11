# FreeLang v11 자체호스팅 완료 체크리스트

**목표**: stage1.js만으로 전체 FreeLang 코드 컴파일 가능  
**현황** (2026-04-29): ~60% (bootstrap.js 필수, 런타임 헬퍼 미포함)

---

## 🔴 블로킹 이슈

### Issue 1: 런타임 헬퍼 함수 미포함
**증상**: `stage1.js verify-self-host` → `_fl_null_q` undefined  
**원인**: stage1.js는 pure JavaScript 출력, 런타임 환경 미포함  
**현재 해결**: Bootstrap.js가 내장 런타임 제공 → stage1.js 독립 실행 불가

**해결 경로**:
- [ ] 옵션 A: stage1.js에 런타임 헬퍼 프리앰블 추가
  - 위치: 생성 코드 최상단 (lexer 함수 정의 이전)
  - 예: `function _fl_null_q(x) { return x === null || x === undefined; }`
  - 영향: 파일 크기 +5-10KB
  
- [ ] 옵션 B: 런타임 라이브러리 분리 (runtime.js)
  - Stage1.js 시작: `const rt = require('./runtime.js');`
  - 구조: stage1.js (순수 컴파일러) + runtime.js (헬퍼)
  - 영향: 배포 모듈화

**권장**: 옵션 A (자체호스팅 단순화) → 옵션 B (차후 모듈화)

---

## 🟡 중요 항목

### Item 1: Bootstrap.js 의존성 제거
**현황**:
```bash
$ node bootstrap.js compile self/all.fl -o stage1.js
# bootstrap.js → self/all.fl 컴파일 → stage1.js 생성
```

**목표**:
```bash
$ node stage1.js compile self/all.fl -o stage1-new.js
# stage1.js → self/all.fl 재컴파일 → stage1-new.js 생성
```

**필요 작업**:
- [ ] stage1.js에 CLI 인터페이스 추가 (compile, run 커맨드)
- [ ] 런타임 헬퍼 프리앰블 추가 (위 Issue 1 해결)
- [ ] stage1.js self-compilation 테스트 (1회 반복)
- [ ] stage1 → stage1' SHA 안정성 검증 (고정점 확인)

### Item 2: 자체호스팅 검증 파이프라인
**현황**: `node bootstrap.js verify-self-host` 사용  
**목표**: `node stage1.js verify-self-host` 사용

**필요 작업**:
- [ ] verify-self-host 커맨드 구현 in stage1.js
- [ ] 테스트: core-fl, type-check, codegen 검증
- [ ] Pass 비율 추적: tier1 > 91/100

---

## ✅ 완료된 항목

- [x] Try-Catch 구현 (Parser/Codegen)
- [x] Template Literal 구현 (Interpreter/Codegen)
- [x] Self/codegen.fl 업데이트 (Try/Template 추가)
- [x] self/all.fl 생성 (1965줄)
- [x] stage1.js 생성 (577줄)
- [x] Bootstrap.js → Stage1 컴파일 검증

---

## 📋 상세 체크리스트

### Phase A-3-1: 런타임 헬퍼 프리앰블 (1-2일)

```
- [ ] bootstrap.js에서 런타임 헬퍼 함수 목록 추출
      예: _fl_null_q, _fl_length, _fl_get, _fl_str, ...
      
- [ ] 헬퍼 정의를 .ts 파일로 분리 (src/runtime-helpers.ts)
      
- [ ] Codegen 수정: stage1.js 생성 시 헬퍼 프리앰블 자동 추가
      
- [ ] 테스트: 
      $ node stage1.js run /tmp/simple.fl
      # 출력: 정상 (헬퍼 정의됨)
```

### Phase A-3-2: CLI 인터페이스 추가 (1-2일)

```
- [ ] stage1.js에 main() 함수 추가
      
- [ ] 커맨드 구현:
      $ node stage1.js compile input.fl -o output.js
      $ node stage1.js run input.fl
      $ node stage1.js verify-self-host
      
- [ ] 인자 파싱 (process.argv 처리)
      
- [ ] 테스트: 모든 커맨드 작동 확인
```

### Phase A-3-3: 고정점 검증 (1일)

```
- [ ] stage1.js 재생성 테스트:
      $ node stage1.js compile self/all.fl -o stage1-new.js
      
- [ ] SHA 비교:
      $ sha256sum stage1.js stage1-new.js
      # 동일해야 함 (고정점 달성)
      
- [ ] 회귀 테스트:
      $ npm test  # 모든 테스트 통과
```

---

## 🚀 수행 순서 (병렬 가능)

1. **지금** (30분): 런타임 헬퍼 함수 목록 추출 (src/bootstrap.js 스캔)
2. **동시** (2시간): src/runtime-helpers.ts 파일 작성
3. **동시** (1시간): Codegen 수정 (프리앰블 추가 로직)
4. **순차** (1시간): npm run build → stage1.js 재생성
5. **검증** (1시간): CLI 인터페이스 테스트

**총 예상**: 3-4시간 (병렬 수행 시 2시간 단축 가능)

---

## ⚠️ 위험 요인

| 위험 | 영향 | 완화 |
|------|------|------|
| 런타임 헬퍼 누락 | 일부 기능 미작동 | 전체 헬퍼 목록화 후 추가 |
| 프리앰블 충돌 | 코드 중복/버그 | 조건부 프리앰블 (이미 있으면 스킵) |
| 고정점 미달성 | 재귀 컴파일 미완 | SHA 비교 자동화 (CI 포함) |
| 회귀 테스트 실패 | 과거 기능 깨짐 | 기존 797 테스트 재실행 |

---

## 📊 체크리스트 상태 추적

- [ ] 런타임 헬퍼 추출 완료
- [ ] runtime-helpers.ts 작성 완료
- [ ] Codegen 프리앰블 통합 완료
- [ ] stage1.js 재생성 성공
- [ ] CLI verify-self-host 실행 성공 (tier1 > 91)
- [ ] 고정점 SHA 일치 확인
- [ ] 회귀 테스트 통과 (797/797)
- [ ] A-3 완료 선언

**진행도**: 0/8 (대기중)
