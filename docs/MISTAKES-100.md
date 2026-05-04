# FreeLang v11 — "실수 100선" 인덱스 (재분류)

> 이 문서는 v11.4.2까지 100개 실수를 한 곳에 모아 관리하던 곳이었다.
> 분석 결과 **80%는 사용자 실수가 아니라 언어 결함/학습 자료**였다.
> 정확성을 위해 3개 문서로 분리.

## 분류 결과 (재계산)

| 본질 | 개수 | 문서 | Phase |
|------|-----|-----|-------|
| 🔧 언어 디자인 결함 | **44** | [LANGUAGE-FAULTS.md](LANGUAGE-FAULTS.md) | **X (v11.5.1)** |
| 📚 정상 동작 (학습) | 25 | [LEARNING.md](LEARNING.md) | — |
| 💡 학습 부족 (안내) | 20 | [MISTAKES.md](MISTAKES.md) | G+ (✅ ALIAS 완료) |
| 🚧 언어 미구현 | 5  | [MISTAKES.md](MISTAKES.md) | Y |
| 📝 문서 오류 | 3  | [LEARNING.md](LEARNING.md) | Z |
| 💀 진짜 부주의 | 3  | [MISTAKES.md](MISTAKES.md) | wrapper hint |
| **합계** | **100** | — | — |

## 어디서 무엇을 봐야 하나

- **AI/사용자 실수** (28개) → `MISTAKES.md`
  - 다른 언어 습관 → ALIAS 자동 처리
  - 미구현 → Phase Y 대기
  - 부주의 → wrapper hint

- **Lisp 학습 자료** (28개) → `LEARNING.md`
  - 정상 동작 (실수 아님)
  - 문서 오류 정정

- **언어 결함** (44개) → `LANGUAGE-FAULTS.md`
  - 인자 순서/작명/시그니처 비일관
  - **v11.5.x Phase X에서 통일 + 마이그레이션 도구 제공**

## 자동 카운트

```bash
node scripts/verify-mistakes-coverage.js   # 처리율
node scripts/gen-mistakes-split.js         # 3개 문서 재생성
```

`MISTAKES-COVERAGE.json` (자동 갱신):
- 매핑된 항목: 33/100 (Phase G+ ALIAS hint)
- 진짜 자동 (코드 그대로): 2 (#23 let, #26 [FUNC])
- 옵션 헬퍼 호출: 8 (smart-* / http-*-json)

## 분류 변경의 의미

기존 명명: *"실수 100선"* — 사용자 책임 프레임
재분류 후: 사용자 실수 28%, 학습 자료 28%, **언어 결함 44%**

→ Phase H에서 ALIAS 더 추가하는 건 응급처치.
→ Phase X (v11.5.1) 언어 통일이 진짜 fix.
