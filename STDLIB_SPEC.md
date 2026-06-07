# FreeLang v11 — StdLib Spec

**계층**: Layer 2 (범용 유틸)  
**원칙**: 자주 쓰이고, 언어 기능 자체는 아닌 것

---

## 1. 문자열 함수 (~35개)

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `str` | `(str v+)` | 값을 문자열로 |
| `strlen` | `(strlen s)` | 문자열 길이 |
| `concat` | `(concat s+)` | 문자열 연결 |
| `split` | `(split s sep)` | 구분자로 분리 |
| `trim` | `(trim s)` | 공백 제거 |
| `upper-case` | `(upper-case s)` | 대문자 변환 |
| `lower-case` | `(lower-case s)` | 소문자 변환 |
| `replace` | `(replace s from to)` | 치환 |
| `substring` | `(substring s start end?)` | 부분 문자열 |
| `includes?` | `(includes? s sub)` | 포함 여부 |
| `starts-with?` | `(starts-with? s prefix)` | 시작 여부 |
| `ends-with?` | `(ends-with? s suffix)` | 끝 여부 |
| `str-join` | `(str-join sep coll)` | 컬렉션 연결 |
| `format` | `(format template args)` | 문자열 포매팅 |

---

## 2. 컬렉션 함수 (~45개)

### 리스트 기본
| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `list` | `(list v*)` | 리스트 생성 |
| `first` | `(first coll)` | 첫 번째 원소 |
| `rest` | `(rest coll)` | 나머지 |
| `last` | `(last coll)` | 마지막 원소 |
| `cons` | `(cons v coll)` | 앞에 추가 |
| `conj` | `(conj coll v)` | 뒤에 추가 |
| `count` | `(count coll)` | 원소 수 |
| `nth` | `(nth coll i)` | i번째 원소 |
| `reverse` | `(reverse coll)` | 역순 |

### 고차 함수
| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `map` | `(map f coll)` | 변환 |
| `filter` | `(filter pred coll)` | 필터링 |
| `reduce` | `(reduce f init coll)` | 축약 |
| `every` | `(every pred coll)` | 전체 조건 |
| `any?` | `(any? pred coll)` | 하나라도 조건 |
| `keep` | `(keep f coll)` | nil 제거 후 변환 |
| `mapcat` | `(mapcat f coll)` | 변환 후 flatten |
| `sort` | `(sort coll)` | 정렬 |
| `sort-by` | `(sort-by f coll)` | 함수 기준 정렬 |
| `group-by` | `(group-by f coll)` | 그룹화 |
| `flatten` | `(flatten coll)` | 평탄화 |
| `zip` | `(zip c1 c2)` | 쌍 묶기 |
| `take` | `(take n coll)` | 앞 n개 |
| `drop` | `(drop n coll)` | 앞 n개 제거 |
| `partition` | `(partition n coll)` | n개씩 분할 |

---

## 3. 맵 함수 (~20개)

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `hash-map` | `(hash-map k v ...)` | 맵 생성 |
| `assoc` | `(assoc m k v)` | 키-값 추가 |
| `dissoc` | `(dissoc m k)` | 키 제거 |
| `merge` | `(merge m1 m2)` | 맵 병합 |
| `keys` | `(keys m)` | 키 목록 |
| `vals` | `(vals m)` | 값 목록 |
| `get` | `(get m k default?)` | 값 조회 |
| `get-in` | `(get-in m [k1 k2])` | 중첩 조회 |
| `assoc-in` | `(assoc-in m [k1 k2] v)` | 중첩 추가 |
| `update` | `(update m k f)` | 값 업데이트 |
| `select-keys` | `(select-keys m keys)` | 일부 키 선택 |
| `rename-keys` | `(rename-keys m old->new)` | 키 이름 변경 |

---

## 4. JSON / 직렬화

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `parse` | `(parse json-str)` | JSON 파싱 |
| `json-response` | `(json-response v)` | JSON 응답 |
| `html-escape` | `(html-escape s)` | HTML 이스케이프 |

---

## 5. 수학 함수

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `+` `-` `*` `/` | `(+ a b)` | 사칙연산 |
| `mod` | `(mod a b)` | 나머지 |
| `abs` | `(abs n)` | 절댓값 |
| `max` | `(max a b)` | 최댓값 |
| `min` | `(min a b)` | 최솟값 |
| `floor` | `(floor n)` | 내림 |
| `ceil` | `(ceil n)` | 올림 |
| `round` | `(round n)` | 반올림 |

---

## 6. 지연 시퀀스 (Phase 69)

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `range` | `(range n)` / `(range s e)` | 범위 시퀀스 |
| `lazy-seq` | `(lazy-seq head tail-fn)` | 지연 시퀀스 생성 |
| `iterate` | `(iterate f init)` | 무한 반복 시퀀스 |
| `take-while` | `(take-while pred seq)` | 조건까지 취득 |

---

## 7. 파일 I/O

| 함수 | 시그니처 | 설명 |
|------|----------|------|
| `read-file` | `(read-file path)` | 파일 읽기 |
| `write-file` | `(write-file path content)` | 파일 쓰기 |
| `file-exists?` | `(file-exists? path)` | 파일 존재 확인 |
| `file-append` | `(file-append path content)` | 파일 추가 쓰기 |
| `file-mkdir` | `(file-mkdir path)` | 디렉토리 생성 |
| `dir-list` | `(dir-list path)` | 디렉토리 목록 |

---

## 8. 타입 검사

| 함수 | 설명 |
|------|------|
| `true?` | boolean true 여부 |
| `false?` | boolean false 여부 |
| `nil?` | nil 여부 |
| `number?` | 숫자 여부 |
| `string?` | 문자열 여부 |
| `list?` | 리스트 여부 |
| `map?` | 맵 여부 |
| `fn?` | 함수 여부 |
