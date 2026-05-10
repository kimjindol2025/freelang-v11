# FreeLang AI 유지보수 운영 지시서 v1

> **목표**: FreeLang을 "AI가 장기 유지보수 가능한 언어"로 유지한다.  
> 기능 추가보다 안정성, 재현성, 결정론성, 기록 보존을 우선한다.

---

## [핵심 원칙]

### 1. 기록이 증명이다
- 모든 중요한 수정은 이유를 기록한다.
- 성공뿐 아니라 실패·오판·되돌림도 기록한다.
- "왜 이렇게 설계했는가"를 남긴다.
- 블로그/CHANGELOG/검증 결과를 유지한다.

### 2. CI는 항상 초록이어야 한다
- 빨간 CI를 방치하지 않는다.
- 작은 수정이라도 회귀 검증한다.
- "어차피 실패하는 테스트" 상태를 만들지 않는다.
- CI 신뢰도를 최우선으로 유지한다.

### 3. 결정론성을 깨지 않는다
- bootstrap 결과 SHA 변화를 항상 확인한다.
- self-hosting 단계에서 비결정적 동작을 금지한다.
- 랜덤/시간 의존 로직은 격리한다.
- L2 proof 및 deterministic build를 유지한다.

### 4. 확장보다 단순화를 우선한다
- 새 기능 추가 전:
  - 제거 가능한 코드가 있는지 먼저 본다.
  - lazy loading 가능한지 검토한다.
  - optional module화 가능한지 검토한다.
- 사용하지 않는 코드/모듈은 제거한다.
- evaluator core를 오염시키지 않는다.

### 5. AI가 수정하기 쉬운 구조를 유지한다
- giant file를 분리한다.
- builtin registry를 명확히 구분한다.
- optional feature와 core evaluator를 분리한다.
- 의존성 방향을 단순화한다.
- side effect를 최소화한다.

---

## [수정 원칙]

### 6. 최소 수정 원칙
- 가능하면 2줄 수정으로 해결한다.
- 대규모 rewrite를 피한다.
- 동작 유지 상태에서 점진 개선한다.

### 7. 실패 원인을 먼저 분석한다
- 증상만 수정하지 않는다.
- root cause를 추적한다.
- 임시 workaround는 명시적으로 표시한다.

### 8. 보호장치를 먼저 만든다
기능보다 먼저 고려한다:
- timeout
- circuit breaker
- isolation
- cache
- retry limit
- validation harness
- regression test

### 9. blocking 위험을 제거한다
- watchdog/blocking loop를 보호한다.
- 외부 API 실패가 전체 시스템을 멈추게 하지 않는다.
- 단일 실패점(SPOF)을 줄인다.

### 10. self-hosting을 깨지 않는다
- bootstrap compatibility 유지
- stage1/stage2 차이를 검증
- generated JS diff 확인
- parser/evaluator consistency 유지

---

## [AI 행동 규칙]

### 11. 모르는 경우 추측하지 않는다
- "아마" 수정 금지
- grep/test/log 기반으로 수정
- 재현 후 수정

### 12. 수정 후 반드시 검증한다
최소 하나 이상 수행:
- unit test
- integration test
- deterministic build
- bootstrap verify
- runtime smoke test

### 13. 문서와 코드 상태를 맞춘다
- 구현과 문서 불일치 방치 금지
- deprecated API 명시
- alias 변경 기록

### 14. 과잉 엔지니어링 금지
- 미래를 위한 추상화 남발 금지
- 실제 사용 전 generic system 만들지 않는다.
- 작은 구조를 선호한다.

### 15. 시스템 보존을 우선한다
"멋진 기능"보다 우선:
- 안정성
- 재현성
- 유지보수성
- 디버깅 가능성

---

## [권장 작업 우선순위]

| 순위 | 작업 |
|------|------|
| 1 | CI 복구 |
| 2 | 결정론성 유지 |
| 3 | 회귀 수정 |
| 4 | blocking/isolation 개선 |
| 5 | dead code 제거 |
| 6 | lazy loading |
| 7 | 구조 분리 |
| 8 | 성능 최적화 |
| 9 | 신규 기능 |

---

## [블로그 작성 규칙]

- 실제 디버깅 과정을 기록한다.
- 실패 시도도 기록한다.
- 왜 기존 접근이 실패했는지 설명한다.
- 삽질 과정 생략 금지.
- 수정 범위와 위험도를 적는다.
- 검증 결과를 포함한다.

**좋은 예**: "disown 방식 실패 → PRoot 환경 문제 발견 → setsid로 교체"  
**나쁜 예**: "문제 해결 완료"

---

## [장기 목표]

FreeLang의 목표는 **"기능이 가장 많은 언어"가 아니다**.

목표:
- AI가 이해 가능한 구조
- AI가 안전하게 수정 가능한 구조
- 결정론적 self-hosting
- 장기 보존 가능한 개발 기록
- 자동 검증 가능한 언어 생태계
