# D-1 DB 안정성 보고서

기준: `v11-x86-seed-public`의 `8a166d3ed86fca18be53a16fe3d0c9b4bad34a4c`에서 분기한 `db-stability`. 시험 출력은 임시 디렉터리에 기록했다. 현재 판정은 **8/9**이며 회귀 9번은 미통과다.

## 1. 시험별 결과 원문

커밋된 `tests/run-db-stability.sh`의 `strace -f -e trace=execve` 실행 출력:

```text
DB_CASE_1=PASS CRASHES=100 INTEGRITY=ok COMMITTED=5000 UNFINISHED=0
DB_CASE_2=PASS ERROR=db-exec: PROCESS_ALIVE=1 RECOVERY_WRITE=ok
DB_CASE_3=PASS BATCH_FAILED=1 TRANSACTION_CONTROL_REJECTED=1 PARTIAL_ROWS=0
DB_CASE_4=PASS PROCESSES=8 EACH=5000 ROWS=40000 DUPLICATES=0 LOCK_ERRORS=0
DB_CASE_5=PASS BACKUP_INTEGRITY=ok ROWS=46019 CONTENT_SHA256=f0c61417e397d1a731eb05082a7fc5c35329d68bc09842cabaf659b5363aede1 SOURCE_CMP=0
DB_CASE_6=PASS BIG_ROWS=1001000 API=FreeLang READ_P99_US=297 WRITE_P99_US=3112 MAX_RSS_KB=5260 FD_BEFORE=4 FD_AFTER=4 FILE_BYTES=13082624 INTEGRITY=ok
DB_CASE_7=PASS WAL_BEFORE=4251872 WAL_AFTER=0 CHECKPOINT=0|0|0
DB_CASE_8=PASS SPECIAL=stored LONG_LENGTH=100000 NULL=stored ZERO_BYTE_WRITE=rejected ZERO_BYTE_READ=rejected
DB_CASE_9=FAIL QUICK_RC_OR_SUMMARY_MISMATCH
DB_SUMMARY=8/9
```

100만 행 p99는 FreeLang `fl_db_query`·`fl_db_exec` 호출 1,000회씩의 표본이며, 해당 호스트에서 병행 부하가 실행 중일 때 측정했다. 백업 해시는 백업 시점의 최대 ID까지 원본 내용을 정렬해 비교했다.

## 2. 고친 곳(파일:줄)

- `runtime/db.c:50` 동시 쓰기 잠금 대기 30초.
- `runtime/db.c:11`, `runtime/db.c:169`, `runtime/db.c:251` 0바이트 문자열과 과대 길이 거부, 조회 오류 시 문장 정리.
- `runtime/db.c:124`, `runtime/db.c:269` 다중 SQL 문을 저장점으로 묶고 중간 오류를 되돌림. 배치의 트랜잭션 제어문 거부.
- `tests/db-stability.c:1`, `tests/run-db-stability.sh:1` 9항목 재현과 자원 측정. 집계 스크립트는 실행 전 커밋했고 실행 중 수정하지 않았다.
- `docs/DB_CONTRACT.md:5` 다중 문장과 0바이트 문자열 계약 명시.

## 3. DB_SUMMARY

```text
DB_SUMMARY=8/9
```

회귀 9번이 실패해 9/9 판정은 내리지 않았다.

## 4. http_server.c에 필요한 변경

없음. 이 파일은 수정하지 않았다.

## 5. 해시와 CMP

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  cgc-bin-x86_64-seed-v11
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage2.c
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage3.c
ae2655249d62f6120210454bc2a608764a82f53d4872e1c52721d44e247f31ba  stage4.c
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

seed와 고정점은 지정값 그대로다.

## 6. 빠른 시험 전체 RC·요약·strace

전체 시험은 `strace -f -e trace=execve`에서 `QUICK_RC=1`이었다. 원문 요약:

```text
NAME_SUMMARY=9/9
WARN_SUMMARY=4/4
ABI_SUMMARY=8/8
BUILTIN2_SUMMARY=16/16
HOF_SUMMARY=25/25
FL_TEST_SUMMARY total=41 passed=41 failed=0 not_run=0
TEST_EVIDENCE_SUMMARY=53/53
TCP_SUMMARY=24/24
HTTP_SUMMARY=26/26
AUDIT_SUMMARY=44/44
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
ERP_SUMMARY=22/22
ERP2_SUMMARY=12/12
ERP3_SUMMARY=19/19
CONC_SUMMARY=8/8
SEC_SUMMARY=14/14
AUTH_SUMMARY=16/16
PAGE_SUMMARY=11/11
NET2_SUMMARY=18/18
PW_SUMMARY=11/11
JWT_SUMMARY=19/19
STREAM_SUMMARY=13/13
JSONNUM_SUMMARY=9/9
PAR_SUMMARY=16/16
HTTPATK_SUMMARY=21/21
STATIC_SUMMARY=18/18
TIMEOUT_SUMMARY=8/8
TIMEPREC_SUMMARY=6/6
CASE=process-limit-run-parallel RC=0 SIGNAL=0 FAILED_SLOTS=20 SUCCESSFUL_SLOTS=0 ERROR=E_RUN_PARALLEL_FORK
LOAD_FAST_SUITE_RC=1
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_RECOVERY_RC=0 ROWS=1
FDFIX_RECOVERY_OR_OOM=FAIL
```

기존 OOM 시험의 프로세스 제한 항목이 실패했으며, 이 때문에 `FDFIX_SUMMARY=5/5`와 `LOAD2_SUMMARY=10/10`은 출력되지 않았다. 분리 실행에서는 같은 OOM 시험이 `FORKFAIL_SUMMARY=9/9`로 통과해 호스트 태스크 수 변동에 민감함을 확인했다. 마지막 전체 실행 시 다른 작업의 동시 부하가 진행됐다.

```text
QUICK_STRACE_EXECVE=64635
DB_STRACE_EXECVE=3304
FIXPOINT_STRACE_EXECVE=515
NODE_EXEC_COUNT=0
NPM_EXEC_COUNT=0
NPX_EXEC_COUNT=0
JS_EXEC_COUNT=0
PYTHON_EXEC_COUNT=0
```

## 7. 커밋·두 원격 HEAD·미확인 항목

코드·시험 커밋: `e3035e416679eda24735fb61ece066479316e0ac`. 보고서 커밋 직전 `git ls-remote` 원문:

```text
Forgejo
e3035e416679eda24735fb61ece066479316e0ac	refs/heads/db-stability
GitHub
e3035e416679eda24735fb61ece066479316e0ac	refs/heads/db-stability
```

보고서 자체 커밋은 이 문서에 자기 HEAD를 기록할 수 없어, 푸시 뒤 두 원격 HEAD를 채팅에서 별도 확인한다. 미확인 항목: 빠른 시험 전체 RC=0, FDFIX 5/5, LOAD2 10/10 및 이에 따른 DB 9/9.

커밋 전 전체 diff의 민감 정보 패턴 검사 원문:

```text
SENSITIVE_DIFF_MATCHES=0
```
