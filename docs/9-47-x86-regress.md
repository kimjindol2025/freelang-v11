# 9-47 x86 백엔드 회귀 확인

실행 위치: `freelang-v11` 작업본, 경로 `<가림>`. 23·25 서버 접속·실행은 0회다. 앱 입력은 읽기 전용으로 사용했다. 무거운 시험은 지정 잠금 파일을 비점유 확인 후 획득해 순차 실행했으며, 잠금 경합 시 종료 코드는 `73`이었다.

기준 시작점은 9-46 HEAD `fc5d3f4d042185714842f655f857fc264255640e`다. 시드 컴파일러는 `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2`다.

## 1. 16-worker `/ok` 측정과 bisect 결과

9-46 보고서의 기존 원문은 `workers=16 route=ok ... errors=16891 error_pct=90.052`다. 이 실행은 이번 작업에서 재현되지 않아 원인을 커밋에 귀속하지 않았다.

같은 9-44 worker16 실행기를 기준 커밋과 9-46 HEAD에서 각각 실행한 원문:

```text
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.015 requests=2225900 rps=37089.10 p50_ms=25.860 p99_ms=85.988 max_ms=205.381 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2225900,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2225900
LOAD_STAGE stage=94401 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=60.017 requests=2231722 rps=37185.02 p50_ms=25.497 p99_ms=86.304 max_ms=200.808 errors=0 error_pct=0.000 connect_refused=0 connect_timeout=0 connect_other=0 io_errors=0 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=0 recv_other=0 incomplete_response=0 invalid_status=0 route_counts=ok:2231722,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=200:2231722
```

`strace -f -e trace=execve` 아래의 전체 fast 실행에서는 `/ok` 결과가 달랐다:

```text
POOL_BENCH workers=16 route=ok LOAD_STAGE stage=947 concurrency=1000 created=1000 create_failures=0 duration_s=60 elapsed_s=61.977 requests=19923 rps=321.46 p50_ms=3071.729 p99_ms=4100.379 max_ms=5123.874 errors=14946 error_pct=75.019 connect_refused=0 connect_timeout=70 connect_other=0 io_errors=14876 other_http=0 status_503=0 retry_after_missing=0 overload_rejected=0 rejection_pct=0.000 write_http_200=0 send_timeout=0 send_other=0 recv_timeout=14876 recv_other=0 incomplete_response=0 invalid_status=14876 route_counts=ok:19923,static:0,jwt:0,read:0,write:0,slow300:0 status_codes=0:14946,200:4977
```

따라서 이번 실행에서 오류 0% 복귀는 확인하지 못했다. 격리 worker16에서는 두 체크포인트 모두 0%였고, 전체 strace 실행은 75.019%였다. 측정 조건에 따라 결과가 달라 원인 커밋과 부하 도구/서버 원인은 **미확인**이다. 커밋별 수치로 원인을 단정하지 않았다.

기준 커밋의 pool 전체를 strace 아래서 보조 비교하려 한 실행은 잠금 경합으로 시험 진입 전 종료 코드 `73`을 반환했다. 해당 비교 측정값은 없다.

## 2. LOAD2/FDFIX 재현

같은 `run-task938-load.sh`와 환경 설정으로 확인한 자원 스냅샷 및 집계 원문:

```text
c65d409a8e37d642ebd7d7e6bebeab1fcbf483e9: LOAD_RESOURCE_START rss_kb=34000 fd=48; LOAD_RESOURCE_END rss_kb=29964 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
3674fc533ea4b4711eb59f0e8880e05d2c1d79e1: LOAD_RESOURCE_START rss_kb=33436 fd=48; LOAD_RESOURCE_END rss_kb=30064 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
4fdc307d0b700b3f5cb8edff79da3774277bdedc: LOAD_RESOURCE_START rss_kb=36960 fd=48; LOAD_RESOURCE_END rss_kb=30040 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
d19b898e436cd1a4c33c3413be3ae74c370be6ba: LOAD_RESOURCE_START rss_kb=35504 fd=48; LOAD_RESOURCE_END rss_kb=30284 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
8c5b0f511061843b005d3908a9aa053fea095ac5: LOAD_RESOURCE_START rss_kb=35268 fd=48; LOAD_RESOURCE_END rss_kb=32452 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
0f96eaded72659ac25b24539f9dacd0b5570cac7: LOAD_RESOURCE_START rss_kb=35248 fd=48; LOAD_RESOURCE_END rss_kb=30132 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
fc5d3f4d042185714842f655f857fc264255640e first run: LOAD_RESOURCE_START rss_kb=34376 fd=48; LOAD_RESOURCE_END rss_kb=29668 fd=46; LOAD_RESOURCE_STABLE=0; LOAD2_SUMMARY=9/10; FDFIX_SUMMARY=4/5
fc5d3f4d042185714842f655f857fc264255640e repeat: LOAD_RESOURCE_START rss_kb=37268 fd=48; LOAD_RESOURCE_END rss_kb=30424 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
strace full fast pool: LOAD_RESOURCE_START rss_kb=35240 fd=48; LOAD_RESOURCE_END rss_kb=31216 fd=48; LOAD_RESOURCE_STABLE=1; LOAD2_SUMMARY=10/10; FDFIX_SUMMARY=5/5
```

첫 실패와 같은 HEAD의 반복 및 최종 strace 실행은 통과했다. 첫 실패의 상세 유일한 LOAD2 미통과 항목은 `LOAD_RESOURCE_STABLE=0`이며, FD 최종값이 `46`이었다. FDFIX의 5번째 점수는 LOAD2가 `10/10`인지에 연동되어 있어 독립 실패는 아니다. 전체 fast pool 반복 실행에서 `LOAD2_SUMMARY=10/10`, `FDFIX_SUMMARY=5/5`를 확인했다. 일시적인 FD 측정 변동인지의 원인은 미확인으로 남겼고 기대값·기준은 바꾸지 않았다.

기준점과 HEAD 사이에서 첫 실패 커밋을 특정하지 못했다. `0f96eade`와 그 이전 체크포인트는 통과했고, HEAD의 실패가 동일 HEAD 반복에서 사라졌다. 재현 가능한 나쁜 체크포인트가 없어 이 항목은 확정적인 코드 bisect 결과로 간주하지 않는다.

## 3. task920 ABI 기록과 검증

`tests/task923/abi-lowered.tsv`에 `doseq`, `h`, `s` lowering 설명을 추가했다. `min`은 이미 `c-runtime-name`의 `fl_min` mapping에 있어 중복 lowering 행을 제거했다. `abi-hold.tsv` 등 기준 ABI 파일은 변경하지 않았다.

전체 task920 실행의 ABI 관련 원문:

```text
BUILTINS_TOTAL=302
MATCHED=266
MISSING_IN_RUNTIME=0
UNUSED_RUNTIME=77
ABI_MAPPED=266
COMPILER_LOWERED=36
ABI_HOLD=0
MISSING_IN_RUNTIME_ITEMS=none
ABI_SUMMARY=8/8
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
```

## 4. `_app.fl` 입력 재확인

9-44·9-45에서 사용한 입력과 일치하는 읽기 전용 `_app.fl`을 찾았다. 10459행이며 10460행의 `(server-start 40850)`가 9-44 기록과 일치한다. 현재 컴파일 시 GCC 호출 전에 다음 진단으로 종료했다:

```text
APP_COMPILE_RC=1
APP_GCC_ERROR_COUNT=not-run
[CGC-ERR] C symbol collision: not-found-handler -> not_found_handler conflicts with not_found_handler
```

`not_found_handler` 및 `not-found-handler` 정의는 각각 입력 147행과 1111행에 있고, 등록 호출은 10457행이다. 사용자 정의 이름 충돌은 기존 task920 계약대로 거부되므로 앱 입력은 수정하지 않았다. C 출력과 GCC 실행에 도달하지 않아 GCC 오류 수는 0이라고 보고하지 않는다.

## 5. 고정점·전체 fast 시험 원문

시드와 stage2=3=4의 해시 원문:

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2
672e36425b0cdbe00c6260812c38e266b209acbe277ab56ae58991ed04d04f0d
672e36425b0cdbe00c6260812c38e266b209acbe277ab56ae58991ed04d04f0d
672e36425b0cdbe00c6260812c38e266b209acbe277ab56ae58991ed04d04f0d
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

전체 fast 실행은 커밋된 `tests/run-task946-full.sh`를 `strace -f -e trace=execve` 아래 끝까지 실행했다:

```text
TASK942_LEGACY_RC=0
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
TASK942_POOL_RC=0
POOL_SUMMARY=8/8
TASK946_FAST_SUMMARY=2/2
EXECVE node=0 npm=0 npx=0 JS=0 Python=0
```

## 6. X86_SUMMARY

```text
a. PARTIAL — 격리 worker16 측정은 기준점·HEAD 모두 `error_pct=0.000`; 전체 strace pool에서는 `error_pct=75.019`. 9-46의 `90.052` 원인 커밋은 미확인.
b. PASS — 최종 전체 pool `LOAD2_SUMMARY=10/10`, `FDFIX_SUMMARY=5/5`.
c. PASS — task920 전체 ABI `ABI_SUMMARY=8/8`; 기준 ABI 파일 변경 0.
d. PARTIAL — 입력 재확인 및 빌드 시도 완료. 사용자 심볼 충돌로 GCC 단계에 도달하지 않아 GCC 오류 수 미확인.
e. PASS — seed hash 유지, stage2=3=4, 전체 fast SUMMARY 완료 및 node/npm/npx/JS/Python 각 0.
X86_SUMMARY=3/5 (PASS 항목 b,c,e; a,d 미완료)
```

## 7. 변경·검사 및 남은 확인

- 바뀐 파일: `tests/task923/abi-lowered.tsv:12`, `:17`, `:30` — task920 lowering/mapping inventory. `min`의 기존 C runtime mapping은 `self/cgc-main.fl:803`에 있다.
- 앱, `erp`, `grok-router`, `test11-hello`, 기준 ABI 파일 및 기대값은 변경하지 않았다. 새 JS/Python 소스는 추가하지 않았다.
- 민감 정보 검사: `SENSITIVE_SCAN=0`; 변경 파일에서 로컬 경로·주소·자격 증명 패턴 0건.
- 원인 미확인: 16-worker 오류율이 전체 strace 실행에서만 재현된 원인, LOAD2 FD 스냅샷 단발 변동의 원인.
- 남은 막힘: `_app.fl`의 `not-found-handler`/`not_found_handler` 사용자 이름 충돌. task920 계약상 앱은 수정하지 않았다.
- 실행 위치: `<가림>`.
- 이 보고서는 최종 보고서 커밋 및 두 원격 HEAD 동기화 후 해시를 덧붙인다.
