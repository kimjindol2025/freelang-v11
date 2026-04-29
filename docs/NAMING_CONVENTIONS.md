# FreeLang v11 명명 규칙 (Naming Conventions)

**원칙**: 자주국방 — 복수 문법 공존 금지. 단일 표준 고정.

---

## 🎯 핵심 규칙

### 1️⃣ kebab-case 필수
모든 새 함수는 **소문자 + 하이픈**

```fl
✅ file-read, str-to-num, upper-case, map-entries
❌ file_read, strToNum, UPPER_CASE, mapEntries
```

### 2️⃣ Predicate 함수는 `?` 끝
Boolean 반환 함수는 반드시 `?`로 끝남

```fl
✅ nil?, empty?, number?, digit?
❌ is-nil, is-empty, is-number, is_digit
```

### 3️⃣ 모듈-기능 구조
모듈명 + 동작의 조합

```fl
✅ file-read, file-write, file-exists?
✅ mem-recall, mem-remember
✅ agent-spawn, agent-send
❌ read, readFile, fs-read
```

### 4️⃣ 구형 이름 금지 (Deprecated)
다음 이름은 **더 이상 지원하지 않습니다**:

| ❌ 구형 | ✅ 표준 |
|--------|--------|
| `file_read` | `file-read` |
| `file_write` | `file-write` |
| `file_exists` | `file-exists?` |
| `file_append` | `file-append` |
| `file_mkdir` | `file-mkdir` |
| `file_rmdir` | `file-rmdir` |
| `file_delete` | `file-delete` |
| `dir_list` | `dir-list` |
| `get_or` | `get-or` |
| `get_env` | `get-env` |
| `json_keys` | `keys` |
| `json_vals` | `values` |
| `json_set` | `map-set` |
| `num->str` | `num-to-str` |
| `str->num` | `str-to-num` |
| `string->number` | `str-to-num` |
| `uppercase` | `upper-case` |
| `uppercase` | `upper-case` |
| `is-digit?` | `digit?` |
| `is-symbol-char?` | `symbol-char?` |

---

## 📊 표준 함수 예시

### 파일 I/O
```fl
(file-read "path/file.txt")          ;; 읽기
(file-write "path/file.txt" "data")  ;; 쓰기
(file-exists? "path")                ;; 존재 확인
(file-append "path" "line\n")        ;; 추가
(dir-list "path")                    ;; 디렉토리 목록
(file-mkdir "path/subdir")           ;; 디렉토리 생성
```

### 문자열 변환
```fl
(num-to-str 42)          ;; 숫자 → 문자열
(str-to-num "3.14")      ;; 문자열 → 숫자
(upper-case "hello")     ;; 대문자
(lower-case "HELLO")     ;; 소문자
```

### 컬렉션 조작
```fl
(keys {:a 1 :b 2})                  ;; 키 목록
(values {:a 1 :b 2})                ;; 값 목록
(map-set m "key" "value")           ;; 맵 업데이트
(map-entries {:a 1 :b 2})           ;; [["a" 1] ["b" 2]]
```

### 타입 체크
```fl
(nil? x)              ;; null/undefined 확인
(number? x)           ;; 숫자 여부
(string? x)           ;; 문자열 여부
(digit? "5")          ;; 숫자 문자 여부
(symbol-char? "!")    ;; 기호 문자 여부
```

---

## 🚀 신규 함수 작성 가이드

새 함수를 추가할 때:

1. **명명**: kebab-case 사용
   ```typescript
   // ✅ 좋음
   case "my-function": ... 
   case "complex-multi-word-name": ...
   
   // ❌ 나쁨
   case "my_function": ...
   case "myFunction": ...
   ```

2. **Predicate**: `?` 추가
   ```fl
   (define is-empty? (fn [x] (= (length x) 0)))  ;; ❌
   (define empty? (fn [x] (= (length x) 0)))     ;; ✅
   ```

3. **별칭 금지**: 자주국방 원칙
   ```typescript
   // ❌ 금지 — 복수 문법
   case "file-read": case "file_read": ...
   
   // ✅ 표준만
   case "file-read": ...
   ```

---

## 📋 기존 혼재 해결 (완료: 2026-04-29)

| 항목 | 변경 |
|------|------|
| 파일 I/O | `file_*` → `file-*` (7개 함수) |
| 객체 조작 | `json_keys/vals/set` → `keys/values/map-set` |
| 타입 변환 | `num->str`, `str->num` → `num-to-str`, `str-to-num` |
| 대문자 | `uppercase` → `upper-case` |
| Predicate | `is-digit?`, `is-symbol-char?` → `digit?`, `symbol-char?` |

---

## ✅ 검증 방법

```bash
# 구형 이름 사용 검사
grep -r "file_read\|json_keys\|num->str" /root/kim/freelang-v11 --include="*.fl" --include="*.ts"

# 결과: (없음) = 성공
```

---

**마지막 업데이트**: 2026-04-29 (P0-C 완료)  
**관련 PR**: Issue #3 P0-A/P0-B/P0-C 통합
