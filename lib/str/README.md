# 문자열 v0.1

`(load "lib/str/str.fl")` — 호출 파일 기준 상대 경로를 사용한다.
모든 공개 함수는 `{"ok":true,"value":...}` 또는
`{"ok":false,"error":{"code":...,"message":...}}`를 반환한다.
기존 `lib/unicode/unicode.fl` 진입점이 `self/stdlib/encoding.fl`을 재사용한다.
글자·인덱스·너비는 UTF-8 바이트가 아닌 유니코드 코드 포인트다.
결합 문자·ZWJ 이모지 전체를 한 글자로 묶거나 정규화하지 않는다. NUL은 기존 런타임 제한으로 미지원이다.

| 함수 | 인자 → value |
|---|---|
| str-split | text, separator → 문자열 목록. 빈 구분자는 코드 포인트 분리. 끝 빈 항목 보존 |
| str-join | 문자열 목록, separator → 문자열 |
| str-trim | text, `"left"` / `"right"` / `"both"` → 공백 제거 |
| str-replace | text, search, replacement, `"all"` / `"first"` → 겹치지 않는 치환 |
| str-starts?, str-ends?, str-contains? | text, needle → boolean |
| str-index-of | text, needle → 처음 코드 포인트 인덱스, 없으면 -1. 빈 needle은 0 |
| str-pad-left, str-pad-right | text, width, padding → 목표 너비까지 순환 패딩. 기존 글자 자르지 않음 |
| str-repeat | text, count → 반복 문자열 |
| str-lines | text → CRLF/CR/LF로 분리. 끝 빈 줄 보존, 빈 입력은 [] |
| str-format | template, 문자열 값 map → `{name}` 치환. 누락은 MISSING_KEY, 괄호 오류는 INVALID_FORMAT |

trim은 Unicode White_Space 코드 포인트 집합을 사용한다. 잘못된 UTF-8은
INVALID_UTF8, 잘못된 인자·모드·빈 치환 대상·빈 패딩은 INVALID_ARGUMENT이다.
width/count는 정수 0..10000이다. 자동 문자열 변환·서식 지정자·중괄호 이스케이프는 제공하지 않는다.

```clojure
(get (str-index-of "가😀나" "나") "value") ;; 2
(get (str-format "{name}님" {"name" "서윤"}) "value") ;; "서윤님"
```

이 모듈을 불러오면 같은 이름의 문자열 API는 Result 계약으로 연결된다.
불러오지 않은 기존 내장 함수는 기존 반환형과 바이트 인덱스를 유지한다.
HTTP·FS 내부의 기존 문자열 연산은 명시적 내부 기본 함수로 연결해 함께 사용할 수 있다.
공유 모듈은 정규화한 상대 경로 기준 한 번만 확장한다. 심볼릭 링크의 동일성 판정은 하지 않는다.

시험 실행기: `tests/lib-contract/run-str-regex.fl`. `lib/test/README.md`의 네이티브 감독 실행기 빌드 예제에서 소스를 이 파일로 바꿔 빌드하고, `--compiler <native-compiler> --root <repository>`로 실행한다.
