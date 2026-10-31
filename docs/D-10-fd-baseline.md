# D-10 · legacy FD baseline

실행 위치: 대상 저장소 작업본. 서버 23·25에는 접속하지 않았다.

## 1. 시드 확인

기준 `dec63e63`의 시드 파일과 현재 시드 파일을 `sha256sum` 및 `cmp`로 비교했다.

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  bin/cgc-bin-x86_64-seed-v11
SEED_CMP_RC=0
```

## 2. legacy FD 측정

기준점은 [tests/run-task938-load.sh](../tests/run-task938-load.sh)의 `server_snapshot`이 직접 자식 프로세스까지 모아 FD 수를 합산하는 183–195행이다. warmup 종료 뒤 0.1초 대기하고 다시 스냅샷하여 `INITIAL_FD`를 확정한다(213–221행). 종료점도 같은 `server_snapshot`으로 잰다(306–314행). 판정식은 변경하지 않았다.

원문 판정 기준:

```text
(( FINAL_RSS <= STEADY_RSS_BASELINE + 2048 && FINAL_FD <= STEADY_FD_BASELINE + 1 && STEADY_FD_BASELINE <= FINAL_FD + 1 )) && RESOURCE_STABLE=1
```

세 번 측정하려 했으나 유효한 baseline/end `ls -l /proc/<pid>/fd` 쌍은 2회만 확보했다. 첫 번째 및 세 번째 임시 계측 실행은 PID 목록을 다시 얻는 사이 자식이 사라져 각각 `ls: cannot access .../fd: No such file or directory`가 있었다. 해당 목록은 유효 측정으로 세지 않았다. 네 번째 실행은 같은 `server_snapshot` PID 목록을 쓰도록 계측 위치를 바꿔 완료했다. 다섯 번째는 실행 중 다른 작업공간의 장기 strace 서버 시험이 `ps`에 계속 보여, 겹침 방지 조건을 지키기 위해 중단했다. 따라서 3회 요건은 미완료다.

### 유효 실행 1 (계측 2)

```text
LOAD_RESOURCE_WARM_BASELINE rss_kb=811236 fd=8
LOAD_RESOURCE_COLD_START rss_kb=5944 fd=8
LOAD_RESOURCE_START rss_kb=5944 fd=8
LOAD_RESOURCE_END rss_kb=5944 fd=8
LOAD_RESOURCE_STABLE=1
LOAD_DATABASE_IS_LOCKED=0
LOAD2_SUMMARY=10/10
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_SUMMARY=5/5
```

`ls -l` 원문(경로 대상은 `<가림>` 처리):

```text
total 0
lr-x------. 1 kim kim 64 Oct 31 08:33 0 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 08:33 1 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 08:33 2 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 08:33 3 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 08:33 4 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 08:33 5 -> <가림>
lr-x------. 1 kim kim 64 Oct 31 08:33 6 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 08:33 7 -> socket:[422223841]
```

Baseline와 종료점 모두 같은 FD 종류 수였다.

| 시점 | 소켓 | DB 파일 | journal/WAL/SHM | 파이프 | 기타 | 합계 |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 1 | 1 | 2 | 0 | 4 | 8 |
| 종료 | 1 | 1 | 2 | 0 | 4 | 8 |
| 차이(시작에만 존재) | 0 | 0 | 0 | 0 | 0 | 0 |

### 유효 실행 2 (계측 4)

```text
LOAD_RESOURCE_WARM_BASELINE rss_kb=831872 fd=38
LOAD_RESOURCE_COLD_START rss_kb=5924 fd=8
LOAD_RESOURCE_START rss_kb=12612 fd=38
LOAD_RESOURCE_END rss_kb=5924 fd=8
LOAD_RESOURCE_STABLE=0
LOAD_DATABASE_IS_LOCKED=0
LOAD2_SUMMARY=9/10
FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)
FDFIX_SUMMARY=4/5
```

Baseline `ls -l`에는 같은 서버 스냅샷에 포함된 프로세스 4개의 목록이 있었다. 아래는 각 프로세스의 원문 FD 행이며 경로는 가렸다.

```text
FD 목록 A (8개)
lr-x------. 1 kim kim 64 Oct 31 09:01 0 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 09:01 1 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 09:01 2 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 3 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 4 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 5 -> <가림>
lr-x------. 1 kim kim 64 Oct 31 09:01 6 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 7 -> socket:[426656081]

FD 목록 B/C/D (각 10개, 세 목록 동일한 종류)
lr-x------. 1 kim kim 64 Oct 31 09:01 0 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 09:01 1 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 09:01 2 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 3 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 4 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 5 -> <가림>
lr-x------. 1 kim kim 64 Oct 31 09:01 6 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 7 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 8 -> socket:[426705122]
lrwx------. 1 kim kim 64 Oct 31 09:01 9 -> <가림>
```

종료점에는 서버 프로세스 한 개의 다음 목록만 남았다.

```text
total 0
lr-x------. 1 kim kim 64 Oct 31 09:01 0 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 09:01 1 -> <가림>
l-wx------. 1 kim kim 64 Oct 31 09:01 2 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 3 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 4 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 5 -> <가림>
lr-x------. 1 kim kim 64 Oct 31 09:01 6 -> <가림>
lrwx------. 1 kim kim 64 Oct 31 09:01 7 -> socket:[426656081]
```

| 시점 | 소켓 | DB 파일 | journal/WAL/SHM | 파이프 | 기타 | 합계 |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 4 | 7 | 11 | 0 | 16 | 38 |
| 종료 | 1 | 1 | 2 | 0 | 4 | 8 |
| 차이(시작에만 존재) | 3 | 6 | 9 | 0 | 12 | 30 |

목록에서 시작 시점에만 있던 3개 자식의 descriptor는 각 프로세스의 소켓 1개, DB 파일 2개, WAL 2개, SHM 1개, 표준 스트림·공개 디렉터리 각 1개였다. 종료 목록에는 해당 자식 목록이 없었다. 이 증거는 warmup 직후 스냅샷 시점에 요청 처리 자식들이 아직 살아 있어 baseline FD 수에 포함된다는 점을 보인다. 해당 차이는 종료 시 남는 FD 누수 증거가 아니다. 원인 분류: **시험의 측정 시점 문제**. 제안만 기록: 기준값은 그대로 두고, 스냅샷이 연속해서 안정되거나 자식이 사라진 뒤 baseline을 재는 방식을 검토한다. 실제 수정은 하지 않았다.

## 3. TASK946 전체 빠른 시험

실행하지 못했다. 시험 시작 전 `ps`에서 별도 작업공간의 장기 strace 서버 시험이 활성 상태였고 종료되지 않았다. 부하 및 전체 시험의 무겹침 조건을 지키기 위해 진행하지 않았다. 그러므로 이번 HEAD의 `TASK946_FAST_SUMMARY`, 실패 사례명·응답 코드·오류 첫 줄은 **미측정**이다. 이전 보고서의 TASK946 결과를 이번 HEAD 결과로 간주하지 않았다.

## 4. 고정점 및 실행 수

고정점 단계 전용 strace 실행도 같은 무겹침 조건 때문에 시작하지 않았다. 이번 실행의 stage2/3/4 해시, `CMP_2_3`, `CMP_3_4`, node/npm/npx/JS/Python 실행 수는 **미측정**이다.

## 5. D10_SUMMARY

- ① 시드 일치: 통과 (`SEED_CMP_RC=0` 및 SHA-256 일치).
- ② FD 종류 차이 3회: 미통과 (유효한 baseline/end 쌍 2회만 기록).
- ③ TASK946 실패 원인 분류: 미통과 (이번 HEAD 시험 미실행).
- ④ 고정점 통과 및 실행 수 0: 미통과 (미실행).

```text
D10_SUMMARY=1/4
```

## 6. 미완료 항목

- 다른 무거운 시험이 없는 상태에서 legacy FD 계측을 1회 더 실행해 3회 기록 완성.
- 같은 조건에서 전체 빠른 시험을 실행하고, 실패하면 해당 경우만 2회 재실행해 원인 분류.
- 빌드·고정점 전용 strace를 실행해 해시·cmp·실행 수 기록.
- 민감 정보 검사 후 보고서만 커밋하고 Forgejo, 이어서 GitHub에 push.

## 7. HEAD 및 원격

작업 시작 HEAD `77780c2a7099823a91241e4452204ecc15ee52c3`. 이 보고서만 별도 커밋해 Forgejo에 먼저, GitHub에 이어 push한다. 최종 커밋 해시와 두 원격의 확인된 HEAD는 채팅 완료 보고에 원문으로 기록한다.
