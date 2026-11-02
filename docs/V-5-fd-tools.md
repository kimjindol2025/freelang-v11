# V-5 LOAD2 FD 측정과 외부 도구 고정

접수번호: RUN-20261103-01 / 담당: 코1

- 기준 `recheck-v1`: `08cc4100e3e94571ece8d6c71913ac0b31c57875`
- 대상 `db-stability`: `963632add97cb0534a04d4707956ffe45d9e7e0e`
- 작업 시작 복제본: 기준 HEAD 일치, `CLEAN=1`
- 이 보고서의 경로 표기는 `<가림>`이다.

## 결과 요약

외부 도구 저장소 pin과 새 컴퓨터용 native 준비 문서를 작성했다. LOAD2 FD 집계 코드는 SQLite main/WAL 핸들을 제외하도록 바꾸고 기존 ±1 판정식을 유지했다. 그러나 첫 전체 시험은 필요한 환경 지정 없이 실행되어 실패했고, 그 실행 안의 pool도 seed 바이너리를 시험 컴파일러로 넘긴 결과 컴파일 오류로 실패했다. V-5의 중단 조건에 따라 재시험을 하지 않았다. FD self-check, 지정된 전체/LOAD2 횟수, pool 재시험, native bootstrap은 완료로 보고하지 않는다. `D-12 닫기 재판정 가능` 상태가 아니다.

## 1. LOAD2 FD 측정 변경

변경 위치는 `tests/run-task938-load.sh:175-245, 363-368`이다. 이전 구현은 `server_snapshot`에서 서버 및 직접 자식의 `/proc/<pid>/fd/*` 개수를 전부 더했다. 변경 후 `fd_count_excluding_sqlite`가 `readlink` 대상으로 확인한 뒤 SQLite main DB 및 `-wal` 파일을 가리키는 FD만 합계에서 제외한다. `(deleted)` 표기도 제외 대상이다. 다른 파일, 소켓 등은 그대로 센다. `fd_is_stable`은 이전 판정식 `end <= start + 1 && start <= end + 1`을 그대로 사용하며 RSS 기준 `+2048`도 유지했다.

기존 방식의 참고 결과(V-3 기록): `LOAD_RESOURCE_START ... fd=48`, `LOAD_RESOURCE_END ... fd=46`, `LOAD_RESOURCE_STABLE=0`, `LOAD2_SUMMARY=9/10`, `FDFIX_SUMMARY=4/5`였다. V-3에서 감소한 두 핸들은 종료된 worker의 SQLite main/WAL FD로 판정됐다.

의도적 누수 확인은 LOAD2 안에 자체 검사로 추가했다. DB/WAL FD 2개를 연 상태에서 정규화된 FD 수가 안정적인지 확인하고, 별도 `/dev/null` FD 2개를 열어 기존 ±1 검사로 불안정 판정이 나오는지 확인하도록 했다. 전체 실행이 해당 구간에 도달하지 못했으므로 `LOAD_FD_DB_TURNOVER_*`와 `LOAD_FD_LEAK_*` 결과는 **미측정**이다. 수정 동작은 아직 실부하 검증되지 않았다.

## 2. freelang-tools pin 및 fresh clone 준비

`tests/run-task920.sh:5-12`에서 도구 저장소 HEAD를 `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`와 비교하도록 했다. 다르면 `FREELANG_TOOLS_COMMIT_MISMATCH`로 실패한다. 저장소 이름은 `freelang-tools`다.

`docs/TOOLS-SETUP.md`에 clone, detached checkout, HEAD/실행 권한/해시 확인을 기록했다. Node/npm/JS 설치 절차는 포함하지 않았다. 저장소를 별도로 fresh clone하고 지정 commit으로 checkout한 결과 HEAD는 `5bbfb771e5f9c83f0b9664e306ff143a0a2b556c`였다. 실행 파일 해시는 다음과 같고 문서의 기대값과 일치했다.

```text
b9681984c7b92d581da56bf73af84053817efc5a618192ab5c9586a58c91e814  scripts/cgc-native
55321a11271135b3c27bc1a4e6cd393e6a812de5b208db47884afb7c0e5cd16c  scripts/fl-cgc-run
```

## 3. 첫 전체 시험과 중단

시험 전 `ps` 확인 후 `flock -o /tmp/fl-heavy.lock` 아래 TASK946 전체 시험을 1회 실행했다. 실제 명령에서 `FL_TOOLS_ROOT`를 fresh tools clone으로 지정하지 않아 기본 형제 경로가 없었다. 또한 전체 스크립트에 bootstrap된 stage2 대신 seed 바이너리를 컴파일러 인자로 전달했다. 이는 준비 완료 상태의 유효한 재시험이 아니다. 재실행해 결과를 덮지 않았으며, 관측된 실패는 숨기지 않고 기록한다.

원문 결과:

```text
LOAD_FAST_SUITE_RC=1
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_RECOVERY_RC=0 ROWS=1
FDFIX_RECOVERY_OR_OOM=FAIL
TASK942_LEGACY_RC=1
TASK942_POOL_RC=1
TASK946_FAST_SUMMARY=0/2
```

legacy quick의 첫 오류 원문(경로 가림):

```text
<가림>/tests/run-task920.sh: line 5: cd: <가림>/../freelang-tools: No such file or directory
```

pool의 첫 C 컴파일 오류 원문(경로 가림):

```text
<가림>/server.c:97:23: error: implicit declaration of function ‘fl_verify_password’; did you mean ‘fl_auth_verify_password’?
<가림>/server.c:97:23: error: incompatible type for argument 1 of ‘fl_truthy’
<가림>/server.c:97:146: error: implicit declaration of function ‘auth_random_token’; did you mean ‘fl_auth_random_token’?
<가림>/server.c:126:21: error: implicit declaration of function ‘fl_hash_password’; did you mean ‘fl_auth_hash_password’?
<가림>/server.c:127:15: error: incompatible types when assigning to type ‘FLValue’ from type ‘int’
<가림>/server.c:132:5: error: implicit declaration of function ‘server_static’; did you mean ‘server_put’?
```

전체 스크립트가 legacy 실패 뒤 pool 하위 항목을 계속 실행했으므로 `TASK942_POOL_RC=1`도 기록한다. 이는 지정 환경과 bootstrap compiler를 사용한 pool 결과가 아니다. 해당 시험에서는 LOAD2 FD 검사 구간에 도달하지 않았고 `LOAD2_SUMMARY`도 나오지 않았다. V-5의 실패 시 중단 규칙에 따라 추가 시험을 중단했다. 따라서 전체 2회, 독립 LOAD2 2회, pool 재시험은 미실행이다.

## 4. V-1부터 V-5까지 실패 항목 정리

| 지시서 | 당시 실패/미확인 | 원인 및 조치 | 현재 확인 상태 |
|---|---|---|---|
| V-1 | clean clone에서 전체 fast 2회 RC 1, LOAD2 wrapper RC 1; pool 6/8 | 외부 `freelang-tools` 부재로 quick BASE_RC 실패. pool 1은 전역 zombie 검사, pool 6 FD 수명 변화. V-4에서 zombie 범위를 시험 프로세스 tree로 좁힘 | V-4 pool 3회 `POOL_SUMMARY=8/8`; LOAD2 FD는 이번 변경 후 미검증 |
| V-2 | 전체/LOAD2 종료 원인 확인; pool 1·6 현장 증거 부족 | LOAD2 `BASE_RC` 전파와 도구 환경 차이를 확인; 추가 원인 확정 진행 | V-3/V-4 문서에 후속 진단 보존 |
| V-3 | 전체·LOAD2는 외부 도구 준비 절차 부재, pool FD 두 핸들 원인 좁힘 | worker 교체 시 SQLite main/WAL close/open이 FD 합계를 바꾸는 시험 측정 문제로 판단 | V-4에서 zombie 범위 수정, V-5에서 SQLite FD 제외를 구현했으나 이번 유효 부하 검증은 미완료 |
| V-4 | pool 1 범위 수정 검증 및 도구/FD 남은 원인 | 승인된 검사 범위 축소. pool 3회 모두 8/8. 도구 고정과 LOAD2 계측은 후속 과제 | V-5에서 도구 pin/setup 문서 작성. 새 계측은 미검증 |
| V-5 | 전체 1회 설정 오류 실패; LOAD2 FD 자체검사·독립 2회·pool·bootstrap 미실행 | 실행 설정 누락과 잘못 전달된 seed compiler가 확인됨. 실패 후 재실행 금지 조건에 따라 중단 | D-12 종료 판정 불가 |

이 실행에서 언어 결함을 판정할 유효한 증거는 없다. pool compiler 오류는 seed 바이너리를 넘긴 잘못된 시험 설정에서 관측됐으므로 언어 결함으로 분류하지 않는다. 개선 후보는 실행 진입 전에 `FL_TOOLS_ROOT`와 stage2 compiler를 확인하는 절차를 명확히 하고, 수정한 LOAD2 FD 계측을 올바른 준비 상태에서 별도 재검증하는 것이다. 코드는 더 바꾸지 않았다.

## 5. 미완료 항목 및 점수

native bootstrap은 실행하지 않았다. stage2=3=4 고정점 해시는 이번에 측정되지 않았다. 전체/LOAD2 각 2회 및 pool 8/8 유지도 확인되지 않았다. 실패한 첫 실행 이후의 중단 규칙을 지켰다.

완료 1/5: 외부 도구 고정 문서와 fresh clone 확인. FD 구현은 작성했으나 요청한 동작 확인을 끝내지 못했고, 나머지 재시험 및 bootstrap은 미실행이다.

V5_SUMMARY 1/5
