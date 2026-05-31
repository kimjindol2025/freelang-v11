# P0 Linter 설계 (FreeLang v11)

## 목표
FreeLang v11 P0 코딩규칙 5가지를 자동으로 검증하는 linter 구현

## 검증 규칙 (5개)

### Rule P0-1: $ 파라미터 강제

**패턴**:
```
(defn name [param ...])     ❌ 파라미터에 $ 없음
(defn name [$param ...])    ✅ OK
(fn [x ...])                ❌ fn도 $ 필수
(fn [$x ...])               ✅ OK
(let [x 1])                 ❌ let 바인딩도 $ 필수
(let [[$x 1]])              ✅ OK
```

**알고리즘**:
```
1. AST 파싱 (sexpr-parser)
2. defn/fn/let 노드 찾기
3. 파라미터 벡터 검사
4. $ prefix 확인
5. 위반 시: report (file:line defn/fn/let name)
```

**예외**:
- &optional, &rest 는 체크 불필요
- 빌트인 함수 (map, filter) 는 무시

---

### Rule P0-2: try-catch 정확한 문법

**패턴**:
```
(try expr (fn [e] ...))              ❌ fn은 람다, catch 아님
(try expr (catch error ...))         ✅ OK
(try expr (catch $e ...))            ✅ OK
```

**알고리즘**:
```
1. try 노드 찾기
2. 2번째 인자 검사
3. (fn ...) 패턴이면 경고
4. (catch varname ...) 형식 확인
5. varname에 $ 필요 여부 검토
```

**예외**:
- 주석 내 패턴은 무시

---

### Rule P0-3: Bearer 토큰 (http-get-bearer)

**패턴**:
```
(let [headers {"Authorization" ...}]
  (http-get url headers))            ❌ Bearer 헤더가 전달 안 됨

(http-get-bearer url $token)         ✅ OK
```

**알고리즘**:
```
1. http-get 호출 찾기
2. 2개 이상 인자 있으면: 경고
   ("Authorization" 헤더를 명시 중이면)
3. http-get-bearer 권장
4. Bearer 토큰 변수명 제안
```

---

### Rule P0-4: let 바인딩 각 줄 분리

**패턴**:
```
(let [x 1 y 2] (+ x y))              ❌ 바인딩이 같은 줄
(let [x 1
      y 2]
  (+ x y))                           ✅ OK (각 줄 분리)
```

**알고리즘**:
```
1. let 노드 찾기
2. 바인딩 벡터 분석
3. 각 바인딩이 다른 줄에 있는지 확인
4. 같은 줄에 2개 이상이면: 경고
5. 파서 오류 가능성 제시
```

---

### Rule P0-5: json-stringify 객체 변환

**패턴**:
```
(str "data=" {:a 1})                 ❌ 객체는 직렬화 불완전
(str "data=" (json-stringify {:a 1})) ✅ OK
```

**알고리즘**:
```
1. str 함수 호출 찾기
2. 인자 분석
3. map/object 타입이 있으면: 경고
4. json-stringify 감싸기 제안
5. false/nil/boolean은 OK (primitive)
```

---

## 출력 형식

```
❌ P0-1 [file.fl:42:15] defn 파라미터에 $ 필요: (defn func [x])
   제안: (defn func [$x])

❌ P0-2 [file.fl:58:10] try-catch: fn은 람다, catch 사용 필수
   제안: (try expr (catch error ...))

❌ P0-3 [file.fl:75:5] http-get 헤더 전달 불가
   제안: http-get-bearer 사용

❌ P0-4 [file.fl:102:8] let 바인딩: 각 줄 분리 필요
   제안: (let [x 1\n      y 2])

❌ P0-5 [file.fl:119:20] str에 객체: json-stringify 필요
   제안: (str "..." (json-stringify obj))
```

---

## 구현 전략

### 방법 1: Python (권장)

**파일**: `/home/kimjin/freelang-v11/scripts/lint-p0.py`

**의존성**:
- `ast_parser.py` (기존 파서 재사용)
- `pathlib`, `re`

**실행**:
```bash
python3 lint-p0.py <file.fl> [--verbose]
python3 lint-p0.py app/*.fl
```

---

### 방법 2: FreeLang (자가호스팅)

**파일**: `/home/kimjin/freelang-v11/scripts/lint-p0.fl`

**장점**: 자가호스팅 검증
**단점**: 성능 느림

---

## 테스트 케이스

### Test 파일: `test-p0-violations.fl`

```lisp
;; P0-1: 파라미터 없는 $
(defn bad-param [x y] (+ x y))      ;; ❌ P0-1 위반

;; P0-2: fn으로 catch
(try (http-get "url") (fn [e] e))   ;; ❌ P0-2 위반

;; P0-3: http-get 헤더
(let [h {"Authorization" "Bearer"}]
  (http-get "url" h))               ;; ❌ P0-3 위반

;; P0-4: let 같은 줄
(let [x 1 y 2] (+ x y))             ;; ❌ P0-4 위반

;; P0-5: 객체 str
(str "result=" {:status "ok"})       ;; ❌ P0-5 위반

;; 정상 코드 (모두 OK)
(defn good [$x $y] (+ $x $y))       ;; ✅
(try expr (catch $e e))              ;; ✅
(http-get-bearer url token)          ;; ✅
(let [[$x 1]
      [$y 2]]
  (+ $x $y))                         ;; ✅
(str "result=" (json-stringify obj)) ;; ✅
```

**예상 출력**: 5개 위반 감지, 5개 정상

---

## 구현 단계

1. **Phase 1**: Python 기본 구조 (P0-1, P0-2)
2. **Phase 2**: P0-3, P0-4 구현
3. **Phase 3**: P0-5 구현
4. **Phase 4**: CI/CD 통합 (pre-commit hook)

---

## 성공 기준

- ✅ test-p0-violations.fl에서 5/5 위반 감지
- ✅ 거짓 양성(false positive) < 5%
- ✅ 실행 시간 < 1초 (100개 파일)
- ✅ 오류 메시지 명확성 >= 9/10
