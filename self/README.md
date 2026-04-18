# `self/` — FreeLang 셀프호스팅 디렉토리

v11 → v12 로 가는 100 단계 셀프호스팅 구현.
목표: FL 로 FL 파서·인터프리터·코드젠을 작성해 `bootstrap.js` 를 완전 대체.

## 구조

- `token.fl / lexer.fl / ast.fl / parser.fl` — 프론트엔드
- `scope.fl / interpreter.fl / call.fl` — 런타임
- `codegen.fl` — FL → JS (Phase 10)
- `main.fl` — 진입점 (모든 모듈 로드)
- `special/*.fl` — 31 개 특수폼
- `builtins/*.fl` — 342 개 빌트인
- `stdlib/*.fl` — 47 개 stdlib 모듈 FL 재작성
- `fixtures/` — TS vs self diff 검증용 샘플
  - `lex/` — 렉서 단위 입력
  - `parse/` — 파서 단위 입력
  - `eval/` — 인터프리터 단위 입력

## 검증 원칙

1. 모든 단계는 `scripts/self-diff.sh` 로 TS 구현과 bit-for-bit 동등 확인
2. 성능은 `scripts/bench.sh` 로 측정 (hello/fib(30)/json-parse(1MB))
3. CHANGELOG 에 `phase=NN stage=MM time_ms=XXX` 실측 기록

## 실행

```bash
# TS interpreter 로 self 실행 (Level 1)
node bootstrap.js run self/main.fl hello.fl

# self interpreter 가 self 코드를 해석 (Level 2-3)
# Phase 09 에서 구현
```
