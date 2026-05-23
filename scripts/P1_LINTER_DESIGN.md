# P1 Linter 설계 (FreeLang v11)

## 목표
FreeLang v11 P1 코딩규칙 6가지를 자동으로 검증하는 linter 구현 (P0 완료 후)

## 검증 규칙 (6개)

### Rule P1-1: DB 절대경로 검증 (위험도: HIGH)

**문제**: 상대경로 db-query 호출 → 운영 환경 경로 불일치

```lisp
;; ❌ 위험: 상대경로
(db-query "db/schema.db" "SELECT ...")

;; ✅ 안전: 절대경로
(db-query "/home/kimjin/kim/services/kimdb/db/schema.db" "SELECT ...")

;; ✅ 안전: 환경변수
(db-query (get (env) "DB_PATH") "SELECT ...")
```

**검출 로직**:
1. db-query, db-get, db-post 호출 찾기
2. 첫 번째 인자가 리터럴 문자열인지 확인
3. 리터럴 문자열이면:
   - `/` 로 시작 → OK (절대경로)
   - `$` 로 시작 → OK (변수)
   - 그 외 → ❌ 경고

**거짓 양성 최소화**:
- 변수명 패턴: `$db-path`, `$db-file` 등은 자동 통과
- 함수 호출 (get, env, ...) 는 전파 분석 안 함 (보수적)

---

### Rule P1-2: HTTP 응답 json-parse 검증 (위험도: HIGH)

**문제**: http-get 응답을 문자열로 취급 → 타입 오류

```lisp
;; ❌ 위험: 자동 파싱 안 됨
(let [[$resp (http-get url)]]
  (get $resp "status"))  ;; $resp는 문자열!

;; ✅ 안전: 명시적 파싱
(let [[$resp (http-get url)]
      [$data (json-parse $resp)]]
  (get $data "status"))

;; ✅ 안전: 헬퍼 함수
(let [[$data (http-get-json url)]]
  (get $data "status"))
```

**검출 로직**:
1. http-get, http-post, http-patch, http-delete 호출 찾기
2. 반환값을 변수에 바인드한 후:
   - (get var ...) 호출 → ⚠️ 경고: json-parse 필요
   - (get var ... "key") 호출 → ⚠️ 경고
   - let에서 (json-parse var) 있으면 → OK

**거짓 양성 최소화**:
- http-get-json, http-get-bearer-json 등 헬퍼 → 자동 통과
- json-parse가 이미 적용되었으면 → OK
- 변수 재할당 감지하기 (복잡하면 생략)

---

### Rule P1-3: 라우트 params 구조 검증 (위험도: MEDIUM)

**문제**: req.params 직접 접근 → 구조 불명확, 타입 추론 불가

```lisp
;; ❌ 위험: 중첩 get
(get (get $req "params") "id")

;; ✅ 안전: req.fl 헬퍼
(req-param $req "id")

;; ✅ 안전: 구조 분해
(let [{:id $id} (get $req "params")]
  $id)
```

**검출 로직**:
1. (get (get $req "params") ...) 패턴 찾기
2. 또는 (get $req "params" "key") 이중 get 패턴
3. 발견 시 → 경고: req-param 또는 구조 분해 권장

**거짓 양성 최소화**:
- req-param 함수 호출 → 자동 통과
- 구조 분해 (get {...} var) → OK

---

### Rule P1-4: 문자열 보간 최적화 (위험도: LOW)

**문제**: (str "a" "b" "c") 반복 호출 → 성능 저하

```lisp
;; ⚠️ 비효율: 많은 인자
(str "name=" $name "&age=" $age "&email=" $email)

;; ✅ 최적: 보간
(str `name=${$name}&age=${$age}&email=${$email}`)
```

**검출 로직**:
1. (str ...) 호출 찾기
2. 리터럴 문자열 4개 이상 이면 → ⚠️ 경고: 보간 고려
3. 또는 기호 + 문자열 반복 패턴 → 경고

**거짓 양성 최소화**:
- 2-3개 인자는 무시
- 백틱 문자열 (보간) 이미 있으면 → OK

---

### Rule P1-5: 타입 안전성 (위험도: MEDIUM)

**문제**: nil 전파 또는 타입 불일치

```lisp
;; ❌ 위험: nil 체크 없음
(let [[$user (db-get ...)]]
  (str "name=" (get $user "name")))  ;; $user가 nil이면 크래시

;; ✅ 안전: nil 체크
(let [[$user (db-get ...)]]
  (if $user
    (str "name=" (get $user "name"))
    "unknown"))

;; ✅ 안전: safe-get (nil → nil)
(str "name=" (safe-get $user "name"))
```

**검출 로직**:
1. db-get, db-post 호출 후 직접 (get ...) 사용 → ⚠️ 경고
2. (json-parse ...) 후 직접 (get ...) → ⚠️ 경고
3. nil 가능성 있는 함수 호출 후 사용 → 경고

**거짓 양성 최소화**:
- 이미 if 블록 내 → OK
- safe-get 사용 → OK
- (or $var default) 패턴 → OK

---

### Rule P1-6: 에러 처리 패턴 (위험도: HIGH)

**문제**: try-catch 없이 위험한 작업 수행 → 예외 누락

```lisp
;; ❌ 위험: 에러 처리 없음
(http-get url)
(db-query ...)
(json-parse $str)

;; ✅ 안전: try-catch
(try
  (http-get url)
  (catch $e
    (do
      (println "ERROR:" $e)
      nil)))

;; ✅ 안전: assert
(assert (http-get url) "HTTP 실패")
```

**검출 로직**:
1. 위험 함수 호출 목록:
   - http-*: http-get, http-post, http-patch, http-delete
   - db-*: db-query, db-get, db-post
   - json-parse
   - file-read, file-write
   - (find ...), (reduce ...)

2. 호출이 try 블록 내에 없으면 → ⚠️ 경고
3. 또는 assert 래핑이 없으면 → 경고

**거짓 양성 최소화**:
- 최상위 서버 핸들러는 기본 try 보유 (생략 가능)
- (do ...) 내에서도 try 있으면 OK
- 라이브러리 함수는 호출자가 책임 (래핑 안 함)

---

## 출력 형식

```
❌ P1-1 [file.fl:42:8] DB 절대경로: (db-query "db/schema.db" ...)
   제안: (db-query "/home/..." ...)

❌ P1-2 [file.fl:58:12] HTTP 응답 json-parse: $resp를 (get)로 접근하기 전 파싱 필요
   제안: (let [$data (json-parse $resp)] ...)

❌ P1-3 [file.fl:75:5] 라우트 params 구조: 중첩 get 대신 req-param 사용
   제안: (req-param $req "id")

⚠️  P1-4 [file.fl:119:8] 문자열 보간 최적화: (str ...) 인자 4개 이상
   제안: (str `...${...}...`)

⚠️  P1-5 [file.fl:135:10] 타입 안전성: nil 체크 없이 (get) 사용
   제안: (if $var (get $var "key") default)

❌ P1-6 [file.fl:152:3] 에러 처리: (http-get) try-catch 없음
   제안: (try (http-get ...) (catch $e ...))
```

---

## 테스트 케이스

### test-p1-violations.fl (예상: 6개 위반)

```lisp
;; P1-1: DB 절대경로
(db-query "schema.db" "SELECT ...")

;; P1-2: HTTP json-parse
(let [[$resp (http-get "http://api.example.com")]]
  (str "Status: " (get $resp "status")))

;; P1-3: 라우트 params
(let [[$id (get (get $req "params") "id")]]
  $id)

;; P1-4: 문자열 보간 (4개 이상)
(str "a=" $a "&b=" $b "&c=" $c "&d=" $d)

;; P1-5: 타입 안전성
(let [[$user (db-get "users" {:id 1})]]
  (str "Name: " (get $user "name")))

;; P1-6: 에러 처리 없음
(http-post url {:data $data})
```

---

## 구현 전략

### Phase 1: Python 기본 (1-2시간)

**파일**: `/home/kimjin/freelang-v11/scripts/lint-p1.py`

**의존성**:
- lint-p0.py의 tokenizer 재사용
- 토큰 기반 패턴 매칭
- 상태 추적 (변수 바인딩, 스코프)

**구조**:
```python
class P1Linter:
    def _check_p1_1_db_path(self)
    def _check_p1_2_http_json(self)
    def _check_p1_3_route_params(self)
    def _check_p1_4_string_interp(self)
    def _check_p1_5_type_safety(self)
    def _check_p1_6_error_handling(self)
```

### Phase 2: 통합 (30분)

**파일**: `/home/kimjin/freelang-v11/scripts/lint-p0-p1.py`

```bash
python3 lint-p0-p1.py app/*.fl  # 11개 규칙 동시 검증
```

---

## 성공 기준

| 지표 | 목표 |
|------|------|
| 테스트 통과 | 6/6 위반 감지 |
| 거짓 양성 | < 10% |
| 실행 시간 | <1초 (100개 파일) |
| 메모리 | <50MB |

---

## 다음 단계

1. **P1 Linter 구현** (2-3시간)
2. **v11.8.0 안정화 로드맵** (Option C)
3. **교육자료 100+ 예제** (Option B)

---

**상태**: 설계 완료  
**다음**: Phase 1 구현 시작
