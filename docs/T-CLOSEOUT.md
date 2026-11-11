# T-14 — FreeLang v11 테스트 마감 기록

## 기준과 판정

- 기준 가지: `fix/t12-codegen-js`
- 기준 커밋: `03f705d6a1226597e21df722b4d6c7900b31db7d`
- `npm run test:full` 실행: 1회, 종료 코드 1, 381.896초
- Jest 결과: **1,432개 중 1,419 PASS / 13 FAIL**, 60개 suite 중 55 PASS / 5 FAIL
- 추가 게이트 조건: 전역 line coverage 25.7%, 기준 75% 미달. 이 항목은 Jest 테스트 1,432개에 포함되지 않음.
- 이번 실행 전 테스트가 생성한 tracked bootstrap 산출물 3개는 기준 커밋 내용으로 복구했다. 최종 변경은 이 문서만이다.
- 사용자 제공 실패 수열: `105 → 61 → 56 → 39 → 34 → 26 → 22 → 15 → 14`. 과거 각 수치와 T 단계의 대응은 현재 로그에서 독립 확인하지 못해 제공된 수열로만 기록한다.

**판정:** 현재 실행은 13개 Jest 실패를 재현했다. 별도 coverage gate 실패를 포함하면 관측된 실패 항목은 14개다. 따라서 “14개 테스트 실패”로 기록하지 않는다. T-5 원격 가지와 커밋도 확인되지 않았다.

## T-4~T-13 이력

| 단계 | GitHub 가지 / 기준 커밋 | 확인된 변경 또는 결과 |
|---|---|---|
| T-4 | `fix/t4-fail-groups` / `f995aacdfb6d5b1b7750ff64d257e0f67cef1c58` | 누락된 표준 라이브러리 모듈 등록. `bootstrap.js`, `src/stdlib-loader.ts`. |
| T-5 | 일치하는 원격 가지를 찾지 못함 | 커밋과 변경 내용은 확인 불가. 추정하지 않음. |
| T-6 | `fix/t6-easy-groups` / `4323d814ba3dd80d705adf98107a9d8ad252e15a` | workflow 타이밍과 string repeat 호환 처리. |
| T-7 | `fix/t7-regex-groups` / `afc697bbe7021564e6fce8bcd60fccbe6f021877` | pattern-first regex 호환 API 추가. |
| T-8 | `fix/t8-string-helpers` / `81623ba7a1a4a088e937ee0241e7a189bbfb7408` | string/list helper API 추가. |
| T-9 | `fix/t9-array-helpers` / `a3e1d2e837d16fc1a02c8a895bb10f54aaef53b1` | array 변환 helper API 추가. |
| T-10 | `fix/t10-format` / `cd948ac107514b310b549a6082915b1b34b5ff56` | display formatting helper API 추가. |
| T-11 | `fix/t11-fn-meta` / `70c0d05674b5a4057f24f85fd7027c9851512b13` | 함수 metadata 및 인자 검증 API 추가. |
| T-12 | `fix/t12-codegen-js` / `03f705d6a1226597e21df722b4d6c7900b31db7d` | 생성 JavaScript에서 parameter identifier를 출력하도록 수정. |
| T-13 | `fix/t13-stage1-slow` / `4a1ebaae9fc8c187497c9ac0327f85a4e9df36c5` | 코드 변경 없이 Stage1 느린 경로 조사. 무제한 실행 474.429초, 종료 0. CPU profile은 재귀 해석기 dispatch가 병목임을 지지함. |

T-13 보고의 474.429초는 당시 무제한 측정이며, 이번 `test:full`의 60초 제한 시험 결과와 구별한다. 해당 보고는 해석기 재귀 dispatch 경로를 원인으로 제시하지만, 이번 문서에서는 새 성능 측정을 하지 않았다.

## 실패 원장

아래 14행은 **13개 실패 테스트와 1개 별도 coverage gate**다. 테스트 코드·기대값·제한시간·실행기는 변경하지 않았다.

| # | 테스트 이름 | 원인 묶음 | 실행 근거 | 처리 방침 |
|---:|---|---|---|---|
| 1 | `LRU eviction: oldest key removed when full` | 시험 자체 의심 — LRU | `stdlib-new.test.ts`: 기대 `false`, 실제 `true` | 캐시 계약과 fixture를 별도 검토한다. 이 마감에서 기대값은 바꾸지 않는다. |
| 2 | `stage1.js: bootstrap과 동등성 검증` | 시험 자체 의심 — Stage1 동등성 | `semantic-preservation.test.ts`: `stage1.success` 기대 `true`, 실제 `false` | 느린 Stage1 경로와 시험이 검증하는 의미를 분리 조사한다. 동등성 PASS로 간주하지 않는다. |
| 3 | `stage1 self-compile succeeds and produces >=40KB output` | Stage1 60초 timeout 연쇄 | `self-hosting.test.ts`: 60초 실행 timeout (`ETIMEDOUT`) | T-13의 474.429초 무제한 측정을 참고하되, 제한시간은 그대로 둔다. 해석기 dispatch 구조를 후속 과제로 둔다. |
| 4 | `stage1 compiles hello.fl correctly (end-to-end)` | Stage1 timeout 연쇄 | Stage1 산출물 `stage1.js`가 없어 모듈을 찾지 못함 | 3번의 선행 산출물 부재에 따른 연쇄 실패로 추적한다. |
| 5 | `stage2 compile succeeds with normal node count (Parsed 150..200)` | Stage1 timeout 연쇄 | 입력 단계의 `stage1.js` 부재 | Stage1 복구 후 다시 판단한다. 이 실행에서는 재시도하지 않는다. |
| 6 | `stage3 compile succeeds` | Stage1 timeout 연쇄 | 입력 단계의 `stage2.js` 부재 | 선행 stage 산출물 연쇄 실패로 추적한다. |
| 7 | `fixed-point: stage1 == stage2 == stage3 (SHA256)` | Stage1 timeout 연쇄 | stage1~3 산출물을 만들지 못해 해시 비교 불가 | 파일 미생성을 fixed-point 불일치로 오해하지 않는다. |
| 8 | `map-entries primitive: map literal compiles correctly` | Stage1 timeout 연쇄 | probe 실행이 선행 `stage1.js` 부재로 실패 | Stage1 경로가 확보된 뒤에만 재평가한다. |
| 9 | `determinism: stage1 built twice yields identical SHA` | Stage1 60초 timeout 연쇄 | bootstrap에서 Stage1을 다시 만드는 실행이 약 60초에서 `ETIMEDOUT` | 결정성 결론을 내리지 않고, 컴파일 경로가 제한시간 안에 완료되지 않았다고 기록한다. |
| 10 | `fixed-point depth: stage1..stage5 all identical` | Stage1 timeout 연쇄 | `stage3.js` 부재로 다음 단계 생성 불가 | 선행 stage 산출물 연쇄 실패로 추적한다. |
| 11 | `deep fixed-point: stage1..stage10 all identical (10-stage chain)` | Stage1 timeout 연쇄 | 최초 Stage1 및 이후 연결 산출물이 유효하게 생성되지 않음 | 깊은 고정점 검증 결과는 미확정으로 유지한다. |
| 12 | `verify-l2-proof.sh --run 실행 후 결과 확인` | Native L2 proof / 생성 C | `case-05-functions-stage2.c`에서 `unknown` 함수의 implicit declaration로 C 컴파일 실패. Seed 실행 파일은 존재했고 실행 단계에 도달함. | “native seed 없음”은 이번 실행에서 재현되지 않았다. 생성 C의 이름 해석 실패를 후속 분석한다. |
| 13 | `scripts/verify-build-deterministic.sh: 2/2 artifacts identical` | Native proof 출력 계약 | 테스트는 `Build Deterministic` 문구를 기대했으나 출력에는 `NATIVE_FIXED_POINT=PASS`가 있음. 출력상 Stage2·3·4 C 해시 비교는 일치. | 표시 계약과 검증 의미를 별도로 검토한다. 기대 문구를 이 작업에서 바꾸지 않는다. |
| 14 | `test:full` 전역 line coverage threshold (게이트 조건, Jest 테스트 아님) | Coverage gate | 측정 25.7%, 설정 기준 75% 미달 | 실패 테스트 수와 분리 관리한다. 이번 작업에서 coverage 설정은 변경하지 않는다. |

## 변경 및 보존

- 제품 소스 변경: 0
- 테스트 소스·기대값·제한시간·실행기 변경: 0
- 테스트 실행으로 갱신된 tracked bootstrap 산출물 3개: 기준 커밋 버전으로 복구
- 문서 변경: `docs/T-CLOSEOUT.md` 1개
- 시험 실행: `npm run test:full` 1회만 수행
- Stage0 사용·생성·빌드: 없음
- 서버 23·25 접근: 없음
- 외부 메일·외부 AI 연결: 없음

## 마감 판정

`JEST_TOTAL=1432`

`JEST_PASS=1419`

`JEST_FAIL=13`

`ADDITIONAL_GATE_FAILURE=coverage 25.7% < 75%`

`FAILURE_LEDGER_ROWS=14 (13 Jest failures + 1 gate condition)`

`T14_CLOSEOUT=REVISE` — 숫자 14는 14개의 Jest 실패가 아니라 coverage gate를 포함한 14개 관측 항목이다. T-5 이력도 확인되지 않았다. 이 차이를 해결했다고 허위로 표시하지 않는다.
