# G-4 sync-check 검증

## 판정

```text
G4_SUMMARY=5/5
```

후보는 seed, 고정점, native 빌드 실행 계약, `/about`, 동시성 확인을 통과했다. G-4a의 전체 Jest 실행은 끝나지 않았지만, G-4b에서 빠른 시험 60개 suite를 양쪽에서 파일별 제한 시간 아래 다시 실행했다. 실패·timeout 상태와 완료된 실패 assertion 이름이 양쪽에서 같아 후보에서만 실패한 시험은 0개다. 이 확인 작업에서 master에는 푸시하지 않았다.

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

보고서 변경은 `forgejo-sync-check` 브랜치에만 반영하고 Forgejo 다음 GitHub 순으로 동기화한다. master는 변경하지 않았다. 전체 빠른 시험의 완료 결과와 양쪽 전체 실패 목록은 미확인으로 남는다.

## G-4a 재검증 시도 (2026-10-31)

시작 전 `ps` 확인에서 다른 무거운 시험이 실행 중이어서, 지시대로 suite별 재검증은 시작하지 않았다. 확인된 관련 프로세스 원문에서 로컬 경로만 가렸다.

```text
3245234  128192 Ss   03:11 bash <가림>
3245256 3245234 S    03:11 unshare <가림>
3245257 3245256 S    03:11 bash <가림>
3247407 3245257 S    01:00 strace <가림>
3247410 3247407 S    01:00 bash <가림>
OTHER_HEAVY_FOUND=1
```

확인된 명령은 `verify-l08-platform-all.sh`이며, 하위 `strace`는 `verify-l08-atom-snapshot.sh`를 실행 중이었다. 따라서 G-4a에서는 후보와 master의 suite별 시험을 하나도 시작하지 않았다. 기존 결과를 기준으로 `G4_SUMMARY=4/5`이며, ⑤는 계속 미확인이다. 잠금 점유가 없어지는 뒤에만 재시도할 수 있다.

### G-4a 재검증 재시도 전 확인 (2026-10-31)

다시 실행 직전에도 무거운 검증 두 가지가 진행 중이었다. 아래는 `ps -eo pid,ppid,stat,etime,pcpu,comm,args` 결과에서 관련 행이며, 로컬 경로만 가렸다.

```text
3245234  128192 Ss   16:59  0.0 bash <가림>/verify-l08-platform-all.sh
3245256 3245234 S    16:59  0.0 unshare <가림>
3245257 3245256 S    16:59  0.0 bash <가림>/verify-l08-platform-all.sh
3260546 3245257 S    00:00 13.6 strace <가림>/verify-l08-extern-self.sh
3259591  128192 Ss   01:25  0.0 bash <가림>/verify-l08-editor-ui.sh
3259615 3259591 R    01:25 16.2 strace <가림>/verify-l08-editor-ui.sh
3259618 3259615 S    01:25  0.0 bash <가림>/verify-l08-editor-ui.sh
OTHER_HEAVY_TESTS_FOUND=2
```

지시대로 이 재시도에서도 suite별 Jest 명령을 시작하지 않았다. ⑤와 `G4_SUMMARY=4/5`는 미확인 상태 그대로다.

## G-4b 대기 기록 및 5번 재검증

무거운 작업 확인은 `ps -eo pid,ppid,stat,etime,comm,args`로 저장했다. 아래는 각 약 5분 간격 스냅샷에서 관련 행만 추린 원문이며, 경로는 `<가림>` 처리했다.

```text
2026-10-31 09:54:10 ps-000: 3245234 128192 Ss 18:29 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 18:29 unshare <가림>; 3245257 3245256 S 18:29 bash <가림>/verify-l08-platform-all.sh; 3262365 3245257 S 00:17 strace <가림>/verify-l08-atom-update.sh; 3262368 3262365 S 00:17 bash <가림>/verify-l08-atom-update.sh
2026-10-31 09:59:32 ps-001: 3245234 128192 Ss 23:52 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 23:52 unshare <가림>; 3245257 3245256 S 23:52 bash <가림>/verify-l08-platform-all.sh; 3269333 3245257 S 00:14 strace <가림>/verify-l08-arena-cache.sh; 3269336 3269333 S 00:14 bash <가림>/verify-l08-arena-cache.sh
2026-10-31 10:04:52 ps-002: 3245234 128192 Ss 29:11 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 29:11 unshare <가림>; 3245257 3245256 S 29:11 bash <가림>/verify-l08-platform-all.sh; 3273296 3245257 S 02:12 strace <가림>/verify-l08-timer-sanitizers.sh; 3273299 3273296 S 02:12 bash <가림>/verify-l08-timer-sanitizers.sh
2026-10-31 10:11:07 ps-003: 3245234 128192 Ss 35:27 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 35:27 unshare <가림>; 3245257 3245256 S 35:27 bash <가림>/verify-l08-platform-all.sh; 3280239 3245257 R 01:28 strace <가림>/verify-l08-fd-faults.sh; 3280242 3280239 S 01:28 bash <가림>/verify-l08-fd-faults.sh
2026-10-31 10:16:24 ps-004: 3245234 128192 Ss 40:44 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 40:44 unshare <가림>; 3245257 3245256 S 40:44 bash <가림>/verify-l08-platform-all.sh; 3286627 3245257 R 00:37 strace <가림>/verify-l08-http-platform.sh; 3286630 3286627 S 00:37 bash <가림>/verify-l08-http-platform.sh
2026-10-31 10:21:40 ps-005: 3245234 128192 Ss 46:00 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 45:59 unshare <가림>; 3245257 3245256 S 45:59 bash <가림>/verify-l08-platform-all.sh; 3291217 3245257 S 01:12 bash <가림>/verify-l08-phase3-all.sh; 3291221 3291217 R 01:12 strace <가림>/verify-l08-phase3-self.sh; 3291224 3291221 S 01:12 bash <가림>/verify-l08-phase3-self.sh
2026-10-31 10:26:56 ps-006: 3245234 128192 Ss 51:16 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 51:16 unshare <가림>; 3245257 3245256 S 51:16 bash <가림>/verify-l08-platform-all.sh; 3291217 3245257 S 06:28 bash <가림>/verify-l08-phase3-all.sh; 3295000 3291217 S 03:09 bash <가림>/verify-l08-phase2-all.sh; 3295004 3295000 S 03:09 strace <가림>/verify-l08-phase2-self.sh; 3295007 3295004 S 03:09 bash <가림>/verify-l08-phase2-self.sh
2026-10-31 10:32:15 ps-007: 3245234 128192 Ss 56:34 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 56:34 unshare <가림>; 3245257 3245256 S 56:34 bash <가림>/verify-l08-platform-all.sh; 3291217 3245257 S 11:47 bash <가림>/verify-l08-phase3-all.sh; 3295000 3291217 S 08:27 bash <가림>/verify-l08-phase2-all.sh; 3301137 3295000 S 04:39 bash <가림>/verify-l08-all.sh; 3301141 3301137 S 04:39 strace <가림>/verify-l08-c01-c03.sh; 3301144 3301141 S 04:39 bash <가림>/verify-l08-c01-c03.sh
2026-10-31 10:37:32 ps-008: 3245234 128192 Ss 01:01:52 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 01:01:52 unshare <가림>; 3245257 3245256 S 01:01:52 bash <가림>/verify-l08-platform-all.sh; 3291217 3245257 S 17:04 bash <가림>/verify-l08-phase3-all.sh; 3295000 3291217 S 13:45 bash <가림>/verify-l08-phase2-all.sh; 3301137 3295000 S 09:57 bash <가림>/verify-l08-all.sh
2026-10-31 10:42:49 ps-009: 3245234 128192 Ss 01:07:09 bash <가림>/verify-l08-platform-all.sh; 3245256 3245234 S 01:07:09 unshare <가림>; 3245257 3245256 S 01:07:09 bash <가림>/verify-l08-platform-all.sh; 3291217 3245257 S 22:21 bash <가림>/verify-l08-phase3-all.sh; 3295000 3291217 S 19:02 bash <가림>/verify-l08-phase2-all.sh; 3301137 3295000 S 15:14 bash <가림>/verify-l08-all.sh
2026-10-31 10:48:07 ps-010: OTHER_HEAVY_FOUND=0
```

`ps-010`에서 0개를 확인한 뒤 `/tmp/fl-heavy.lock`을 획득해, strace 없이 후보 `f1f39da5a2ab00bc77df9dc49370705cb7f9d214`와 GitHub master `29c57e38b3bd014822cf33fe3df8c1815fee707e`의 빠른 Jest 시험을 suite별로 각각 1회 실행했다. 제한은 suite당 120초였다. 처음 한 차례는 suite 경로 접두부를 빠뜨려 `--passWithNoTests`가 빈 시험을 성공 처리했으므로 무효로 제외했다. 올바른 경로로 재실행한 결과만 아래 집계에 포함한다.

```text
CANDIDATE_HEAD=f1f39da5a2ab00bc77df9dc49370705cb7f9d214
MASTER_HEAD=29c57e38b3bd014822cf33fe3df8c1815fee707e
CANDIDATE_SUITES=60
MASTER_SUITES=60
CANDIDATE_FAIL_SUITES=11
CANDIDATE_TIMEOUT_SUITES=2
MASTER_FAIL_SUITES=11
MASTER_TIMEOUT_SUITES=2
CANDIDATE_COMPLETED_TESTS=1384
CANDIDATE_PASSED=1287
CANDIDATE_FAILED=97
CANDIDATE_JSON_SUITES=58
MASTER_COMPLETED_TESTS=1384
MASTER_PASSED=1287
MASTER_FAILED=97
MASTER_JSON_SUITES=58
FAILED_ASSERTION_DIFF_RC=0
SUITE_STATUS_DIFF_RC=0
```

| 양쪽 모두 실패 | 후보에서만 실패 | master에서만 실패 |
|---|---|---|
| `advanced.test.ts`, `ai-library.test.ts`, `build-determinism.test.ts`, `l2-proof.test.ts`, `p1-1-parallel-tasks.test.ts`, `p1-4-observability.test.ts`, `semantic-preservation.test.ts`, `stdlib-f4.test.ts`, `stdlib-helpers.test.ts`, `stdlib-new.test.ts`, `stdlib-perf.test.ts`; timeout: `errors.test.ts`, `self-hosting.test.ts` | 없음 | 없음 |

완료된 JSON 결과에서 실패 assertion은 양쪽 모두 `97`개이며, 실패명 비교는 차이 `0`이다. timeout된 suite는 `errors.test.ts`, `self-hosting.test.ts`로 양쪽이 같다. 후보에서만 실패한 항목이 없어 해당 항목의 오류 첫 줄은 없다.

```text
G4_SUMMARY=5/5
```
