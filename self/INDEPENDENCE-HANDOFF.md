# FreeLang 자주독립 달성 — 인계 문서

**달성일**: 2026-05-31  
**목표**: `PATH=/usr/bin:/bin fl-native.sh run hello.fl` — Node.js/Bun 없이 실행  
**상태**: ✅ **완전 달성**

---

## 달성 요약

```
FL 소스 (.fl)
    ↓  bin/cgc-bin  [323KB, 순수 C]
C 코드 (.c)
    ↓  gcc
ELF 바이너리
    ↓  실행
출력
```

Node.js 없이, Bun 없이, 97MB 번들 없이 동작한다.

---

## Stage 완료 현황

| Stage | 내용 | 상태 |
|-------|------|------|
| S1 | Level 3 부트스트랩 — `all.fl.out.js` 자기 컴파일 | ✅ |
| S2 | FL→C 코드젠 기본 (`codegen-c.fl`) | ✅ |
| S3 | C 런타임 구현 | ✅ |
| S4 | 바이너리 배포 (`bin/cgc-bin`) | ✅ |
| S5 | Heap Object System (FLVector + FLMap) | ✅ |
| S6 | `loop/recur` → C while 변환 | ✅ |
| S7 | Closure (fn literal) 구현 | ✅ |
| S8 | map/filter/reduce 고차함수 | ✅ |
| S9 | map-keys/map-vals/map-entries | ✅ |
| S10 | 현황 탐사 — 버그 목록화 | ✅ |
| S11 | runtime 버그 3개 수정 | ✅ |
| S12 | x86 cgc-bin 빌드 + ELF 고정점 검증 | ✅ |

---

## 핵심 파일

| 파일 | 역할 | 크기 |
|------|------|------|
| `bin/cgc-bin` | FL→C 컴파일러 (x86 ELF) | 323KB |
| `self/cgc-main.fl` | cgc-bin 소스 (FL로 작성) | 198 nodes |
| `scripts/fl-native.sh` | FL 직접 실행 진입점 | — |
| `scripts/build-cgc-native.sh` | 결정론적 ELF 빌드 | — |
| `runtime/core.c` | FL 값 타입, 비교, 맵 | — |
| `runtime/collection.c` | 벡터/맵 조작, uuid | — |
| `runtime/math.c` | 산술, 문자열, substring | — |
| `runtime/io.c` | 파일 I/O | — |
| `runtime/json.c` | JSON 파싱/직렬화 | — |
| `runtime/process.c` | 프로세스/환경 | — |
| `runtime/error.c` | 에러 처리 | — |
| `runtime/cgc-bridge.c` | CGC 전용 브리지 | — |

런타임 총 합계: 2,639줄 C

---

## 실행 방법

```bash
# FL 파일 직접 실행 (FL → C → ELF → 실행)
bash scripts/fl-native.sh run hello.fl

# ELF만 빌드
bash scripts/fl-native.sh build hello.fl -o ./hello
./hello

# cgc-bin 자가 재빌드 (Node.js 불필요)
bin/cgc-bin self/cgc-main.fl /tmp/new.c
bash scripts/build-cgc-native.sh /tmp/new.c bin/cgc-bin
```

---

## L4 고정점 검증 결과

**날짜**: 2026-05-31  
**결과**: ✅ ELF 레벨 완전 고정점 달성

```
bin/cgc-bin (A)
  └─ cgc-main.fl → fp1.c  SHA256: 82a86b5c...
        └─ gcc → fp_bin1  SHA256: 90d01409...
              └─ cgc-main.fl → fp2.c  SHA256: 82a86b5c... (동일)
                    └─ gcc → fp_bin2  SHA256: 90d01409... (동일)
                          └─ cgc-main.fl → fp3.c  SHA256: 82a86b5c...
                                └─ gcc → fp_bin3  SHA256: 90d01409...
```

3세대 전부 SHA256 일치. 강한 고정점 (strong fixed-point) 확인됨.

결정론성 보장 방법: `build-cgc-native.sh`가 컴파일 전 입력 파일을
`/tmp/_cgc_build_input.c` 고정 이름으로 복사 → ELF `.strtab` 동일화.

---

## S11에서 수정된 버그 3개

### Bug 1: `obj-entries` ES6 Map 미지원
- **위치**: `src/eval-builtins.ts`
- **증상**: 파서 AST의 Map 필드가 ES6 `Map` 객체인데 `Object.entries()`는 `[]` 반환
  → 맵 리터럴 AST가 빈 맵으로 변환 → 파서 0 nodes 출력
- **수정**: `instanceof Map` 분기 추가

### Bug 2: `fl_lt/gt/lte/gte` 문자열 비교 불가
- **위치**: `runtime/core.c`
- **증상**: `fl_num()` 숫자 변환만 수행 → 문자열 입력 시 포인터값 반환
  → `is_alpha_p("p")` = false → 렉서가 `println`을 `"p"` 1글자로 파싱
- **수정**: `a.tag==FL_STRING` 조건 분기로 `strcmp` 사용

### Bug 3: `substring` 배열 슬라이스 미구현
- **위치**: `runtime/math.c`
- **증상**: `substring(vec, 1, n)`이 `FL_VECTOR` 입력 시 `""` 반환
  → `parse_sexpr`에서 `rest` 배열 유실 → 인자 없는 함수 호출 생성
- **수정**: `FL_VECTOR` 분기 추가 (벡터 슬라이스 구현)

---

## 검증된 FL 패턴

```lisp
;; 기본 출력
(println "Hello from FL!")
(println (+ 1 2 3))           ; → 6

;; loop/recur
(defn sum-to [n]
  (loop [i 0 acc 0]
    (if (> i n) acc (recur (+ i 1) (+ acc i)))))
(println (sum-to 10))         ; → 55

;; 재귀
(defn factorial [n]
  (if (<= n 1) 1 (* n (factorial (- n 1)))))
(println (factorial 10))      ; → 3628800
```

---

## 이전 → 현재

| 항목 | S9 완료 (2026-05-14) | 현재 (2026-05-31) |
|------|----------------------|-------------------|
| 네이티브 바이너리 | Bun 번들 97MB | cgc-bin 323KB |
| FL 직접 실행 | 불가 | `fl-native.sh run` |
| PATH 제한 환경 | 불가 | ✅ 동작 |
| L4 고정점 | 미달성 | SHA256: `90d01409...` |
| Node.js 의존 | 있음 | **없음** |
| 경량화 비율 | — | **97MB → 323KB (300배)** |
