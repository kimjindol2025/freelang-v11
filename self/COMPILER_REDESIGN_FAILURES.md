# v11 컴파일러 재설계: 예외/실패 추적

## 진행 상황

| 단계 | 상태 | 예외 사항 | 해결책 |
|------|------|---------|--------|
| 1. cg-native 최적화 | ⏳ 진행 중 | - | - |
| 2. rename 통합 | ⏳ 예정 | - | - |
| 3. runtime-prelude 외부화 | ⏳ 예정 | - | - |

## 참조 파일

- **v1-bloated.fl**: 원본 (163줄 cg-native, 100+ 케이스)
- **v2-optimized.fl**: 새 구현 (데이터 기반)

## 발견된 문제들

(진행하면서 기록)

## 발견된 문제 #1: cg-native 중복

### 증거
**String 연산자 중복:**
- 줄 976-985: starts-with?, ends-with?, contains?, split, join, trim, upper, lower, repeat, index-of
- 줄 1083-1092: **완전히 동일한 10개 케이스**

**List 연산자 중복:**
- 줄 994-1006: map, filter, reduce, find, every?, some?, sort, reverse, flatten, distinct (10개)
- 줄 1095-1104: **완전히 동일한 10개 케이스**

### 영향
- 불필요한 20줄 낭비
- cg-native를 163줄에서 143줄로 바로 줄일 수 있음

### 재설계 시 조치
- 중복 제거
- 데이터 기반 구조로 완전히 재작성


## 전략 수정: v1 기반 + loop/recur 유지

### 발견
- v1과 v11 함수 개수: 동일 (151개)
- 새 함수: 없음
- 차이: **loop/recur 변환만**

### 수정된 전략
1. v1-bloated.fl을 기반으로 시작
2. 우리가 추가한 loop/recur 변환은 **유지**
3. **cg-native만 데이터 기반으로 재작성**

### 이점
- 이미 검증된 v1 구조 (스택 오버헤드 낮음)
- loop/recur TCO 최적화 유지
- cg-native 중복 제거 + 데이터 기반
- 더 근본적인 해결

### 진행
다음: v1-bloated를 v2-optimized로 복사 시작
