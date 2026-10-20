# 날짜·시간 v0.1

`(load "lib/time/time.fl")` — load 경로는 이를 부르는 모듈 기준이다.
구현은 FreeLang이며 기존 네이티브 `now-ms`, 숫자·문자열 연산을 재사용한다.

내부 시각은 UTC 유닉스 밀리초 정수다. 달력은 역산 그레고리력이며
0001-01-01T00:00:00.000Z부터 9999-12-31T23:59:59.999Z까지 지원한다.
지역 이름 시간대·DST·윤초는 지원하지 않는다. 시차는 분 단위 정수이고
-1439..1439 범위다. 정수 값인 숫자 입력을 허용하고 숫자 결과는 정수로 반환한다.

| 함수 | 반환값 |
|---|---|
| `now-ms()` | 유닉스 밀리초 정수, 기존 기본 함수 |
| `now-s()` | 현재 유닉스 초 정수, 소수점 버림 |
| `now-iso()` | UTC `YYYY-MM-DDTHH:mm:ss.SSSZ` 문자열 |
| `time-parse(text)` | Result(UTC 밀리초) |
| `time-format(t, pattern, offsetMinutes)` | Result(문자열) |
| `time-add(t, n, unit)` | Result(밀리초), n은 -1000000000..1000000000 정수 |
| `time-diff(a, b)` | Result(a − b 밀리초), 음수 허용 |
| `weekday(t)` | Result(0=일요일 … 6=토요일), UTC |
| `leap-year?(year)` | Result(참/거짓) |
| `days-in-month(year, month)` | Result(해당 월의 일수) |
| `duration-format(ms, style)` | Result(문자열) |
| `stopwatch-start()` | 현재 밀리초 시작 값 |
| `stopwatch-elapsed(start)` | Result(지난 밀리초 정수) |

Result는 `{"ok" true "value" 값}` 또는
`{"ok" false "error" {"code" 코드 "message" 설명 "position" 0}}`다.
`INVALID_ARGUMENT`는 연산 인자·단위·형식 오류, `INVALID_TIME`은 잘못된 시각·달력 값(시각 타입 오류 포함)이다.
위치는 현재 전체 입력/호출을 뜻하는 0이며 문자별 진단 위치는 제공하지 않는다.
오류 뒤에도 다음 호출을 실행할 수 있다.

파싱 문법: `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm:ss[.S|.SS|.SSS]`에
선택적으로 `Z` 또는 `±HH:MM`을 붙인다. 시차가 없으면 UTC다.
날짜만 있는 입력에도 시차 접미사를 허용한다. 대문자 T/Z, 고정 폭 날짜·시각만
지원하며 분수 초가 3자리를 넘거나 윤초·잘못된 날짜가 있으면 오류다.

형식 지정자: `YYYY` 연, `MM` 월, `DD` 일, `HH` 시(00~23), `mm` 분,
`ss` 초, `SSS` 밀리초, `Z` 시차(`+09:00`). 다른 글자는 그대로 출력한다.
pattern은 최대 1024바이트다. offsetMinutes=540이면 UTC+09:00이다.

time-add 단위는 `s`, `m`, `h`, `d`, `month`, `year`다.
month/year 덧셈에서 해당 날짜가 없으면 결과 달의 마지막 날로 맞춘다.
예: 2024-01-31 + 1 month = 2024-02-29.
일 덧셈은 86400000밀리초이며 UTC에서 달·해를 넘긴다.

duration-format은 0..253402300799999밀리초를 허용한다. `ko`는
`1시간 2분 3초`, `short`는 `1h2m3s`다. 시간은 24 이상 누적할 수 있다.
0인 단위는 생략하며 모두 0이면 `0초`/`0s`다. 1초 미만은 버린다.

stopwatch는 기존 실시간 시계를 재사용한다. 단조 시계는 아니며 시스템 시계가
뒤로 조정되어 시작 값보다 작아지면 INVALID_TIME을 반환한다.
기존 `self/stdlib/time.fl`의 `now`·`time-diff-ms` 계약은 변경하지 않는다.
같은 공개 이름(now-s)을 정의하므로 두 시간 모듈을 한 파일에 함께 load하지 않는다.

```clojure
(load "lib/time/time.fl")
(define parsed (time-parse "2026-10-20T09:00:00+09:00"))
(println (time-format (get parsed "value") "YYYY-MM-DD HH:mm:ss Z" 540))
```

시험: `python3 tests/lib-contract/run-time.py --compiler <현재 네이티브 컴파일러>`.
assertion·집계는 FreeLang이 수행하며 Python은 컴파일·링크·실행 감독만 맡는다.
