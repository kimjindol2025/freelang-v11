# V-7 D-12 닫기 최종 기록

RUN-20261103-09. 대상 `db-stability` HEAD는 `963632add97cb0534a04d4707956ffe45d9e7e0e`다. 무거운 전체 시험은 실행하지 않았다.

## 새 복제본

| 원격 | 새 복제본 `recheck-v1` HEAD | 결과 |
|---|---|---|
| Forgejo | `5774279c2f5355246f07c05bf657e17331efbf21` | 일치 |
| GitHub | `5774279c2f5355246f07c05bf657e17331efbf21` | 일치 |

## 가벼운 확인

orphan zombie 확인은 1회 통과했다: `ORPHAN_ZOMBIE_PARENT_EXITED=1`, `ORPHAN_ZOMBIE_SID=3164599 PGID=3164599 STATE=Z`, `ORPHAN_ZOMBIE_DETECTED=1`, `ORPHAN_ZOMBIE_REAPED=1`, `ORPHAN_ZOMBIE_CHECK=PASS`.

pool 확인은 `flock -o /tmp/fl-heavy.lock` 아래 1회 실행했다. 원문 결과: `V7_POOL_RC=0`, `LOAD2_SUMMARY=10/10`, `CAP_SUMMARY=6/6`, `POOL_SUMMARY=8/8`. 실행 전 `ps`를 확인했다.

## 이전 지시서 마감 요약

| 지시서 | 시작 기준 HEAD | 최종 기록 |
|---|---|---|
| V-1 | 보고서 시작 HEAD 미기록; 대상 `963632add97cb0534a04d4707956ffe45d9e7e0e` | `V1_SUMMARY=3/5`; 전체/LOAD2 환경 실패와 pool 1·6 미통과로 보류 |
| V-2 | `5f8aa28bd18c93085337d7f617150109e8f0cc99` | `V2_SUMMARY=4/5`; pool 자료 일부 미확보 |
| V-3 | `c22dc19c59208d78c6fd30398c3a6f3fe9a45c4c` | `V3_SUMMARY 4/4`; 원문 형식 그대로 |
| V-4 | `54ffb895cdb66205ca9ef3758c87c7b26243e46a` | `V4_SUMMARY 5/5` |
| V-5 | `08cc4100e3e94571ece8d6c71913ac0b31c57875` | `V5_SUMMARY 1/5`; 설정 오류는 증거로만 보존 |
| V-6 | `3f1721470b17986a3141ea9cf4b456702f25b8a4` | `V6_SUMMARY 6/6`; 전체 2/2, LOAD2 두 번 10/10, pool 8/8, 고정점 통과 |
| V-7 | `5774279c2f5355246f07c05bf657e17331efbf21` | 새 복제 확인, zombie 제어, pool 가벼운 확인 완료 |

V-1 보류 원인은 외부 도구 미준비와 pool zombie/FD 계측 문제였다. 도구 버전 pin과 native 준비 문서, zombie 검사 범위 축소 및 고아 zombie 제어, SQLite main/WAL 회전 FD를 제외하는 LOAD2 계측과 의도 누수 제어로 해소했다. 기대값·임계값은 유지됐다.

최종 SHA-256 원문: `1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448` (stage 2/3/4 동일).

언어 성과: D-12에서 언어 결함은 확인되지 않았다. 근거: V-6 전체 시험, LOAD2, pool과 native bootstrap의 위 고정점 해시. 수정은 시험 도구 측정과 준비 문서에 한정됐다.

남은 D-12 위험은 미확보였던 과거 pool 실패 순간의 FD/포트 증거를 후속 진단에서 보강할지 검토하는 정도이며, 현재 종료 판정에는 미통과가 없다. GitHub `raw_tcp` 검토 지적은 코2 담당 범위여서 변경하지 않았다.

FIXPOINT_LOG에 기록: `D-12 닫기, 해시 변경 없음`.

## 원격 확인 및 푸시 상태

V-6 작업 폴더의 원격 이름은 Forgejo `forgejo`, GitHub `origin`이었다. 두 원격의 `recheck-v1` ref는 모두 `5774279c2f5355246f07c05bf657e17331efbf21`로 일치해 대응 원격으로 확정했다. 두 `db-stability` ref도 모두 `963632add97cb0534a04d4707956ffe45d9e7e0e`였다. 주소는 기록하지 않았다. 새 Forgejo 복제본에서 이 두 원격을 사용해 Forgejo 먼저, GitHub 다음 순서로 푸시한다.

새 마감 문서 최초 커밋 HEAD: `2ded012ef7d949386fe1e624f7379c5bc933a196`.

V7_SUMMARY 4/4
