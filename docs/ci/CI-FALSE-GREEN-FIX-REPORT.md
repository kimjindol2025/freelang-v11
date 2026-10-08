# freelang-v11 CI 거짓 성공 판정 수정 보고서

## CAUSE

기존 workflow는 필수 테스트에 `continue-on-error`가 있어 실패·timeout이 job 성공으로 남을 수 있었습니다. summary도 경고만 출력하고 종료코드 1을 반환하지 않았습니다.

## CHANGE

변경 파일:

- `.github/workflows/phase-c-full.yml`
- `.github/workflows/phase-c-full-slack.yml`
- `scripts/ci-run-check.sh`
- `scripts/ci-write-result.js`
- `scripts/ci-aggregate.js`

변경 내용:

- 필수 verify/regression/Jest 테스트의 성공 여부를 최종 집계
- 실패·timeout·취소·건너뜀·결과 파일 누락·JSON 파손 시 FAIL
- 테스트 시작/종료 시각, 명령, 종료코드 로그 저장
- JSON 결과와 JUnit 결과 생성 및 artifact 업로드
- summary 비정상 시 `exit 1`
- Slack 알림 상태와 제품 검증 상태 분리
- 제품 기능 코드, loader, repeat, 시간 API, Node 버전, Stage1, TCO는 수정하지 않음

## EVIDENCE

초기 상태:

- branch: `master`
- HEAD: `a53ce28923bd94fbdd4dbcd00f4576cb1923cb5b`
- dirty: 없음

검증 결과:

- 정상 입력 → `PASS`
- 실패 주입 → `FAIL`
- 짧은 timeout 주입 → `FAIL`, exit code `124`
- 필수 결과 누락 → `FAIL`
- JSON 파손 → `FAIL`
- 실패 경로 로그 보존 → `PASS`
- JUnit 생성 → `PASS`
- 두 workflow YAML 파싱 → `PASS`
- `git diff --check` → `PASS`

검증 명령은 모두 저장소 외부 임시 디렉터리에서 실행했고, 임시 파일은 정리했습니다.

## UNCERTAINTY

- GitHub Actions 원격 실행은 아직 검증하지 않았습니다.
- 제품 전체 Jest 결과는 실행하지 않았습니다.
- `actionlint`는 환경에 설치되어 있지 않아 YAML 파서 검증만 수행했습니다.
- 로컬 변경은 문서 저장 시점까지 커밋하지 않았습니다.

## STATUS

`LOCAL_GATE_LOGIC=PASS`

`PRODUCT_TESTS=NOT_RUN`

`REMOTE_CI=UNVERIFIED`

`COMMIT=NOT_COMMITTED` (문서 저장 전 상태)

`PUSH=NOT_PUSHED` (문서 저장 전 상태)

`OTHER_LANGUAGE=USED`

`OTHER_LANGUAGE_REASON=GitHub Actions와 기존 Node/Jest 실행 환경에 필요한 최소 CI 집계 스크립트 추가`

