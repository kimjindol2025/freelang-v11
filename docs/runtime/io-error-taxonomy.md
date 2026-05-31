# FreeLang IO Error Taxonomy (S40-B)

## 에러 형식

모든 IO 에러는 다음 4-tuple 배열로 표현된다:

```
["io-err" severity source message]
```

| 필드 | 타입 | 값 |
|------|------|-----|
| 0 | string | 항상 `"io-err"` |
| 1 | severity | `"fatal"` \| `"recoverable"` |
| 2 | source | `"queue-overflow"` \| `"handler"` \| `"write"` |
| 3 | string | 오류 메시지 |

## severity 분류

### fatal
런타임이 정상 동작을 보장할 수 없는 상태.
FL 코드에서 `(fl-error-fatal?)` 로 감지 후 처리 필요.

| 조건 | source |
|------|--------|
| event queue가 cap(기본 10000)을 초과 | `queue-overflow` |
| evaluator stack overflow | `handler` |
| evaluator out of memory | `handler` |

### recoverable
개별 이벤트 처리 실패. 다음 이벤트는 정상 처리 가능.

| 조건 | source |
|------|--------|
| FL handler 함수가 throw | `handler` |
| sock.write() 실패 (연결 끊김 등) | `write` |

## accessor builtin

```lisp
(fl-error-severity err)   ; → "fatal" | "recoverable"
(fl-error-source err)     ; → "queue-overflow" | "handler" | "write"
(fl-error-message err)    ; → 오류 메시지 문자열
```

## 조회/소비 builtin

```lisp
(fl-error-queue-size)         ; → number
(fl-error-drain)              ; → 전체 에러 배열, queue 비움
(fl-error-fatal?)             ; → true if any fatal in queue
(fl-error-filter "fatal")     ; → fatal 에러만 추출·제거
(fl-error-filter "recoverable") ; → recoverable 에러만 추출·제거
(fl-error-filter "all")       ; = fl-error-drain
```

## 권장 패턴

```lisp
; reactor loop 안에서 fatal 감지 후 graceful shutdown
(loop []
  (fl-event-drain)
  (when (fl-error-fatal?)
    (let [fatals (fl-error-filter "fatal")]
      (println (str "FATAL: " fatals))
      (tcp-server-stop PORT)
      (error "runtime fatal — shutting down")))
  (let [errs (fl-error-filter "recoverable")]
    (when (not (empty? errs))
      (println (str "recoverable errors: " (length errs)))))
  (sleep 1)
  (recur))
```

## queue cap 설정

```lisp
(fl-queue-cap)      ; → 현재 cap (기본 10000)
(fl-queue-cap 500)  ; → cap을 500으로 변경, 이전 값 반환
```

overflow 발생 시: 신규 이벤트 drop + `[io-err fatal queue-overflow ...]` 자동 추가.
