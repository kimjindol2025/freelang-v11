# FreeLang 호환성 계약 정리: 실행 진입점 다음 단계

**작성일**: 2026-08-17  
**상태**: 🟡 구현·부분 검증 완료, 마지막 커밋 Gogs push 대기

## 시작점

앞선 작업에서 FreeLang의 실행 진입점을 정리했다. `fl run`, `fl serve`, `fl repl`을 중심으로 사용 경로를 통일했지만, 네이티브 `bin/fl`과 정식 Node 런타임 사이에는 아직 기능 차이가 남아 있었다.

이번 작업의 목표는 실행 명령을 더 추가하는 것이 아니라, 기존 코드가 기대하는 표준 함수의 호환성과 반환값 계약을 고정하는 것이었다.

## 변경한 내용

### Crypto 호환 계층

기존 underscore 이름을 유지하면서 하이픈 표기 이름을 추가했다.

- `crypto_aes_encrypt` → `crypto-aes-encrypt`
- `crypto_aes_decrypt` → `crypto-aes-decrypt`
- `crypto_sha512` → `crypto-sha512`
- `crypto_md5` → `crypto-md5`
- 그 외 base64url, pbkdf2, password-strength 함수

Crypto Utils 모듈을 정식 stdlib loader에 등록해 실제 런타임에서도 별칭이 동작하도록 했다.

### 시간 반환값 계약

- `now`: ISO 8601 문자열
- `now_ms`: 밀리초 숫자
- `now_unix`: Unix 초 숫자
- `time_diff`, `time_since`, `time_ago`: 숫자와 ISO 문자열 입력을 처리

시간 함수의 문자열·숫자 역할을 분리해 호출자가 반환 형식을 추측하지 않도록 했다.

### Result/Maybe 호환성

Result와 Maybe 헬퍼가 배열형과 객체형을 모두 처리하도록 보강했다.

- `ok?`, `err?`
- `some?`, `none?`
- `result-or`, `result-map`, `result-chain`
- `maybe-or`, `maybe-map`, `maybe-chain`

초기 검증에서는 `(result-or (ok 42) 0)`와 `(maybe-or (some 42) 0)`가 `42`가 아니라 `"v"`를 반환했다. 원인은 표준 라이브러리의 `ok`·`some` 생성자가 실제 인자 대신 매개변수명을 보존하는 경로였다. 생성자를 직접 반환 방식으로 단순화한 뒤 두 계약이 정상화됐다.

### HTTP/DB 계약 테스트

새 계약 테스트를 추가했다.

- HTTP JSON 응답 계약
- SQLite DB query/exec 계약

## 실패와 수정

빌드 첫 시도는 소스 오류가 아니라 `node_modules/esbuild`가 없는 환경 문제로 중단됐다. package.json에 이미 선언된 기존 의존성이었기 때문에 `npm install --ignore-scripts`로 의존성을 복구한 뒤 bootstrap을 재생성했다.

전체 테스트를 처음 실행했을 때 deprecated 문법 경고가 대량 출력됐고, 모나드 테스트 2개가 실패했다. 실패값은 모두 `"v"`였다. 원인을 표준 생성자까지 좁혀 수정했고, 모나드 계약 테스트를 다시 실행했다.

## 검증 결과

확인된 실제 결과는 다음과 같다.

- 빌드: 성공
- 모나드 계약: 6 passed
- HTTP/DB 계약: 2 passed
- Crypto Utils/RSA: 47 passed
- `coverage-boost.test.ts`: 수정 전 98 passed, 2 failed → 수정 후 모나드 관련 6개 통과

전체 Jest 실행은 deprecated 경고와 장시간 실행으로 중단되어 전체 스위트의 최종 통과를 주장하지 않는다. 남은 검증은 전체 테스트를 경고 억제 또는 테스트 범위 분리 방식으로 끝까지 실행하는 것이다.

## 커밋과 Gogs 상태

구현 커밋:

- `76bb6fbb` — `fix: unify FreeLang compatibility contracts`
- `63fd3967` — `chore: refresh generated example and dependency metadata`

첫 번째 커밋은 Gogs `origin/master`에 push되어 토큰 API로 원격 HEAD와 일치하는 것을 확인했다. 이후 두 번째 커밋을 추가했기 때문에 현재는 `63fd3967`이 로컬에만 있으며 Gogs push가 남아 있다.

## 남은 한계

- deprecated `[FUNC ...]` 문법 경고가 여전히 대량 발생한다.
- 네이티브 `bin/fl`과 정식 런타임의 모든 기능 차이를 해소한 것은 아니다.
- DB/HTTP의 실제 운영 서버 통합 테스트는 별도 환경 검증이 필요하다.
- 전체 테스트 스위트 최종 통과는 아직 확인하지 않았다.
- 마지막 chore 커밋은 Gogs에 아직 push하지 않았다.

## 다음 단계

1. 전체 Jest 테스트를 끝까지 실행하고 실패 목록을 확정한다.
2. deprecated 문법 경고를 별도 정리 작업으로 분리한다.
3. `63fd3967`을 Gogs `origin/master`에 push한다.
4. 네이티브 컴파일 경로와 정식 런타임의 계약 테스트를 분리해 지속 검증한다.
