# D-12 닫기 기록

## 판정 근거

D-12 대상 브랜치 `db-stability`는 `963632add97cb0534a04d4707956ffe45d9e7e0e`로 유지됐다. V-6의 유효 결과(전체 2/2, LOAD2 10/10 두 회, pool 8/8, native bootstrap 고정점, orphan zombie 검출 1·정상 0)를 인정한다. V-5의 잘못된 실행 설정과 V-6 첫 준비 오류 실행은 시험 결과가 아닌 준비 오류 증거로만 보존했다.

V-1에서 clean clone의 전체·LOAD2가 외부 `freelang-tools` 준비 누락과 연결돼 실패했고 pool에서는 좀비 범위와 FD 합계 계측 문제가 남아 닫기를 보류했다. 이후 native 도구 버전을 고정하고 준비 절차를 문서화했다. pool 좀비 검사는 실행 세션·프로세스 그룹의 범위로 바꿔 부모가 종료한 고아 zombie도 포함하며, orphan 제어 시험에서 1개 검출·정상 상태 0개를 확인했다. LOAD2 FD 계측은 worker 교체 중 닫혔다 다시 열리는 SQLite main/WAL FD를 누수 합계에서 제외하고, 의도적 FD 누수 제어에서 이를 계속 검출했다. 기대값·임계값은 바꾸지 않았다.

## V-1부터 V-6 결과

아래 HEAD는 각 지시서의 시작 기준이다. `n/n`은 해당 지시서 원보고서의 최종 점수이며, V-3 원문 마지막 줄은 공백 형식 `V3_SUMMARY 4/4`였다.

| 지시서 | 시작 HEAD | 원보고서 결과 | 마감 시 판정 |
|---|---|---:|---|
| V-1 | 보고서 시작 HEAD 미기록; 대상 `db-stability` `963632add97cb0534a04d4707956ffe45d9e7e0e` | `V1_SUMMARY=3/5` | 보류 원인 확인, 후속 조치에서 해소 |
| V-2 | `5f8aa28bd18c93085337d7f617150109e8f0cc99` | `V2_SUMMARY=4/5` | 외부 도구 환경 차이 확인; pool 증거 미완료 |
| V-3 | `c22dc19c59208d78c6fd30398c3a6f3fe9a45c4c` | `V3_SUMMARY 4/4` | 도구 누락·zombie 범위·worker FD 변화의 증거 확보 |
| V-4 | `54ffb895cdb66205ca9ef3758c87c7b26243e46a` | `V4_SUMMARY 5/5` | pool zombie 범위 축소 결과 확인 |
| V-5 | `08cc4100e3e94571ece8d6c71913ac0b31c57875` | `V5_SUMMARY 1/5` | 잘못된 도구/컴파일러 설정; 무효 증거로 보존 |
| V-6 | `3f1721470b17986a3141ea9cf4b456702f25b8a4` | `V6_SUMMARY 6/6` | 유효 전체·LOAD2·pool·bootstrap·누수/zombie 제어 통과 |

## V-7 가벼운 새 복제 확인

Forgejo와 GitHub에서 각각 새로 받은 `recheck-v1` 복제본 모두 `5774279c2f5355246f07c05bf657e17331efbf21`에서 시작했다. V-7에서는 지정된 가벼운 확인만 수행했다. orphan zombie 제어 결과 `ORPHAN_ZOMBIE_PARENT_EXITED=1`, `ORPHAN_ZOMBIE_STATE=Z`, `ORPHAN_ZOMBIE_DETECTED=1`, `ORPHAN_ZOMBIE_REAPED=1`, `ORPHAN_ZOMBIE_CHECK=PASS`였다. pool 결과 `V7_POOL_RC=0`, `LOAD2_SUMMARY=10/10`, `CAP_SUMMARY=6/6`, `POOL_SUMMARY=8/8`이었다. 전체 무거운 시험은 재실행하지 않았다.

## D-12 최종 판정

최종 고정점 SHA-256 원문: `1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448` (stage 2/3/4 일치). db-stability 기준 HEAD는 변경하지 않았다.

언어 성과: D-12에서 언어 결함은 확인되지 않았다. 근거는 V-6 전체 시험 2회와 LOAD2/pool 검증, native bootstrap 고정점 `1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448`이다. 변경은 검사/측정 도구와 준비 문서에 한정됐다.

남은 후보는 후속 조사 목록으로만 둔다: V-2에서 당시 확보하지 못한 pool 실패 순간의 FD/포트 자료를 다음 pool 진단 시 보강할지 검토한다. GitHub 검토의 `raw_tcp` 지적은 코2 작업 범위이며 여기서 다루지 않는다. 현재 D-12 종료를 막는 미통과 항목은 없다.

FIXPOINT_LOG: D-12 닫기, 해시 변경 없음
