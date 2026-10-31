# G-4 sync-check 검증

## 판정

```text
G4_SUMMARY=4/5
```

후보는 seed, 고정점, native 빌드 실행 계약, `/about`, 동시성 확인을 통과했다. 전체 빠른 시험은 후보와 GitHub master 모두 같은 suite 결과까지 진행됐으나, 두 실행 모두 10분 동안 추가 suite 결과가 없어 각각 SIGTERM으로 종료했다. 따라서 전체 실패 목록 비교가 완료되지 않았고, 후보에서만 새로 실패하는 시험이 0개라는 항목은 미확인이다. 이 확인 작업에서 master에는 푸시하지 않았다.

## 0. 후보 HEAD

```text
WORKTREE_HEAD=f1f39da5a2ab00bc77df9dc49370705cb7f9d214
```

비교 기준 master:

```text
29c57e38b3bd014822cf33fe3df8c1815fee707e
```

## 1. seed 비교

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
CMP=0
```

## 2. 고정점 및 빌드 실행 계약

stage 2/3/4 해시와 비교 원문:

```text
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage2.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage3.c
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>/stage4.c
CMP_2_3=0
CMP_3_4=0
```

빌드 명령은 `strace -f -e trace=execve` 아래서 실행했다. 해당 trace의 `execve` 총수는 `492`이며, 실행 파일별 집계 원문은 다음과 같다.

```text
NODE=0
NPM=0
NPX=0
JS=0
PYTHON=0
```

## 3. 앱 확인

```text
APP_START=PASS
ABOUT_HTTP=200
ABOUT_BODY_FIRST_LINE=<!doctype html>
```

## 4. 동시 접속 시험

세 번 모두 현재 후보에서 실행했다. 각 반복은 GET 50/50, POST 20/20으로 응답했고 SQLite 항목 증가량은 20이었다. 실패 응답은 없었다.

```text
CONC_RUN=current/1 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
APP_STDERR_END
CONC_SUMMARY=8/8
CONC_RUN=current/2 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
APP_STDERR_END
CONC_SUMMARY=8/8
CONC_RUN=current/3 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
POST_FAILURE_DETAILS_BEGIN
POST_FAILURE_DETAILS_END
APP_STDERR_BEGIN
APP_STDERR_END
CONC_SUMMARY=8/8
```

같은 스크립트가 기준 런타임도 실행했으며 참고 결과는 다음과 같다.

```text
CONC_RUN=baseline/1 RC=0
BULK_RESPONSES=GET_50/50 POST_20/20
SQLITE_ITEM_COUNT_BEFORE=0 AFTER=20 DELTA=20
CONC_SUMMARY=8/8
```

## 5. 빠른 시험 비교

명령은 두 worktree에서 동일하게 `npm test`였다. 기준 커밋은 `29c57e38b3bd014822cf33fe3df8c1815fee707e`다. 후보는 약 10분, master도 약 10분 동안 CPU를 사용했지만 추가 suite 결과가 없었다. 두 Node 프로세스에 SIGTERM을 보냈고 두 실행의 종료 코드는 `143`이다. 이는 완료된 Jest 요약이 아니다.

실행 이력 보충: 앞서 `timeout --signal=TERM --kill-after=5s 300s npm test`를 잠금 밖에서 한 차례 실행했다. 빠른 시험으로 잘못 분류했고, 이때 다른 저장소의 무거운 시험이 실행 중이었다. 이 시도는 전체 요약 없이 종료되어 비교 자료에서 제외했으며, 종료 코드는 기록하지 못했다. 아래 후보/master 비교는 이후 잠금 아래에서 각각 한 차례씩 실행한 결과다.

후보에서 관찰한 suite 원문:

```text
PASS src/__tests__/web-integration.test.ts
FAIL src/__tests__/advanced.test.ts
PASS src/__tests__/coverage-boost.test.ts
PASS src/__tests__/migrate.test.ts (5.417 s)
PASS src/__tests__/p1-semantics-transition.test.ts
PASS src/__tests__/stdlib-crypto-utils.test.ts (13.247 s)
```

master에서 관찰한 suite 원문:

```text
PASS src/__tests__/web-integration.test.ts (17.453 s)
FAIL src/__tests__/advanced.test.ts
PASS src/__tests__/coverage-boost.test.ts
PASS src/__tests__/migrate.test.ts (5.597 s)
PASS src/__tests__/p1-semantics-transition.test.ts
PASS src/__tests__/stdlib-crypto-utils.test.ts (13.314 s)
```

현재까지 양쪽에서 공통으로 관찰된 실패 suite는 `src/__tests__/advanced.test.ts`다. 다만 `Test Suites:`, `Tests:`, 전체 완료 결과가 생성되지 않아 전체 실패 목록을 만들 수 없다. 후보 전용 실패 0건 여부와 master 전용 실패 목록은 미확인이다.

```text
CANDIDATE_FAST_RC=143
MASTER_FAST_RC=143
```

## G4_SUMMARY 세부

| 항목 | 결과 |
|---|---|
| ① 후보 HEAD 및 seed 일치 | PASS |
| ② 고정점 및 node·npm·npx·JS·Python 실행 수 0 | PASS |
| ③ `/about` HTTP 200 | PASS |
| ④ 동시성 3회 모두 `CONC_SUMMARY=8/8` | PASS |
| ⑤ 후보에서만 새로 실패하는 시험 0개 | UNVERIFIED — 양쪽 전체 빠른 시험이 완료되지 않음 |

## 원격 상태 및 미확인 사항

보고서 커밋 후 `forgejo-sync-check` 브랜치만 Forgejo에 먼저, GitHub에 다음으로 푸시한다. master는 변경하지 않는다. 전체 빠른 시험의 완료 결과와 양쪽 전체 실패 목록은 미확인으로 남는다.
