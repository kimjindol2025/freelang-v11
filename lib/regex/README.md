# 정규식 v0.1

`(load "lib/regex/regex.fl")`. 파서와 명시적 스택 VM은 FreeLang 코드이며
JS·호스트 정규식 엔진·외부 라이브러리를 호출하지 않는다. 문자열 모듈과 같은 Result 반환형이다.

| 함수 | 인자 → value |
|---|---|
| regex-match? | pattern, text → 일치 구간 존재 여부 (전체 일치는 `^...$`) |
| regex-find | pattern, text → 첫 `{start,end,text}` 또는 nil |
| regex-find-all | pattern, text → 겹치지 않는 일치 구간 목록 |
| regex-replace | pattern, text, replacement → 모든 일치 구간을 리터럴 replacement로 치환 |
| regex-split | pattern, text → 구분 구간 사이 문자열 목록, 양끝 빈 문자열 보존 |
| regex-find-limit | pattern, text, limit → regex-find와 같음, 명시적 단계 상한 1..10000 |

지원: 리터럴, `. * + ? |`, `()`, `[a-z]`, `[^...]`, `\d \w \s`,
`^ $`, `{n}`, `{n,m}`, `{n,}`. 범위는 코드 포인트 비교다. 인덱스는 0부터,
end는 제외한다. 왼쪽 시작점 우선·왼쪽 선택지 우선·탐욕적 반복을 사용한다.
`.`은 LF/CR/U+2028/U+2029를 제외한다. `\d`와 `\w`는 ASCII,
`\s`는 문자열 trim과 같은 Unicode White_Space다. `\n \r \t`와 메타문자 이스케이프를 지원한다.
그룹은 묶음만 제공하고 캡처 결과는 제공하지 않는다.

빈 일치 뒤에는 코드 포인트 하나를 건너 다음 검색을 시작한다. 치환·분리에서는
건너뛴 원문을 보존한다. 빈 패턴은 길이+1개 경계에서 일치한다.

오류: 깨진 패턴은 INVALID_PATTERN, 뒤돌아보기·앞보기·역참조·이름 그룹·
비캡처 그룹·플래그·Unicode 속성·게으른/소유 반복 등 미지원 문법은
UNSUPPORTED_SYNTAX (소유 반복의 중복 수량자는 INVALID_PATTERN).
오류의 position은 패턴 코드 포인트 인덱스다. 잘못된 UTF-8은 기존 Unicode 오류를 그대로 반환하며 그 position은 바이트다.

VM 상태 전이·검색 시도에 공유 단계 예산을 사용한다. 공개 호출당 10000단계,
find-all/replace/split의 모든 일치가 같은 예산을 공유한다. 초과하면 STEP_LIMIT이며
부분 결과를 반환하지 않는다. 빈 일치 반복도 진전 여부를 검사해 종료한다.
파싱은 패턴 256코드 포인트/1024바이트, 그룹 깊이 32, 수량자 상한 1000으로
제한하며 초과는 PATTERN_LIMIT이다. 입력 16384바이트 초과는 INPUT_LIMIT이다.
이는 시간 제한이나 스트리밍 엔진이 아니며 큰 입력의 별도 분할 처리를 제공하지 않는다.
오류 후 다음 호출의 예산·파서 상태는 독립적이다.

시험: `python3 tests/lib-contract/run-str-regex.py --compiler <native-compiler>`.
