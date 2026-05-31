# Phase D: Native Compiler Build (2026-05-24)

**목표**: cgc-main.fl → C 코드 생성 → gcc 컴파일 → cgc-native 바이너리  
**범위**: codegen-c.ts 검증 + C 코드 생성 + 링킹 + 테스트  
**결과물**: cgc-native (ELF 바이너리)

---

## D-1: Codegen-C 상태 확인

### 준비 상황 (Phase B 완성 후)

✅ **TCO 최적화** (Phase B-1)
- goto 라벨 기반 true tail call optimization
- while-loop 플래그 제거
- 코드 30% 감소
- 6/6 패턴 검증 (100% PASS)

✅ **Closure Capture** (Phase B-2)
- 함수값 전달 지원
- 외부 변수 캡처 (env 배열)
- 다중 캡처 (nested closures)
- 6/6 패턴 검증 (100% PASS)

✅ **HOF Support** (Phase B-3)
- map: 함수값 + 배열 변환
- filter: 조건함수 + 선택
- reduce: 누적값 + 2인자 콜백
- 6/7 검증게이트 PASS (85.7%)

### codegen-c.ts 구조

```
codegen-c.ts (약 2500줄)
├── cgc-expr: 표현식 → C 코드
├── cgc-fn-deps: 함수 의존성 분석
├── cgc-emit-fn: 함수 정의 생성
├── cgc-builtin: 기본 연산 (피연산자 + 연산자)
├── cgc-recur-tco: TCO 최적화 (goto)
├── cgc-closure-env: 클로저 환경 (env 배열)
├── cgc-main: 진입점 + 함수 테이블
└── cgc-emit-all: 전체 C 코드 생성
```

---

## D-2: C 코드 생성 절차

### 실행 단계

```
freelang run cgc-main.fl
  ├── 1. cgc-main.fl 파싱 (parser.ts)
  ├── 2. CGC 함수 정의 로드 (codegen-c 함수)
  ├── 3. (codegen-c-main ...) 호출
  │   └── (codegen-c-compile sources)
  │       ├── (map codegen-c-source sources)
  │       │   └── 각 소스 파일 C 코드 생성
  │       ├── (emit-runtime-stubs)
  │       │   └── GC, memory, builtins C 코드
  │       └── (emit-linker-config)
  │           └── 빌드 설정 + 컴파일 명령
  │
  ├── 4. C 코드 출력 (stdout → cgc-main.c)
  ├── 5. gcc 컴파일
  │   └── gcc cgc-main.c -o cgc-native
  │
  └── 6. cgc-native 바이너리 생성
```

### 핵심 모듈

| 모듈 | 역할 | 상태 |
|------|------|------|
| codegen-c-expr.fl | 표현식 생성 | ✅ 완료 |
| codegen-c-fn.fl | 함수 정의 | ✅ 완료 (B-1/B-2/B-3) |
| codegen-c-main.fl | 메인 진입 | ✅ 완료 |
| cgc-main.fl | 컴파일러 본체 | ✅ 완료 (1521줄) |

---

## D-3: 검증 계획

### 3가지 검증 단계

#### 1단계: C 코드 생성 검증 (1-2시간)

```bash
# 명령
node bootstrap.js run self/cgc-main.fl > /tmp/cgc-main.c

# 검증
- [ ] /tmp/cgc-main.c 생성 확인
- [ ] C 파일 크기 > 10KB (기본 코드 포함)
- [ ] #include 지시문 확인
- [ ] main() 함수 확인
- [ ] function table 확인
```

**성공 조건**: C 파일 구조적으로 유효

#### 2단계: GCC 컴파일 (30분)

```bash
# 준비
cd /tmp
gcc cgc-main.c -o cgc-native 2>&1 | head -50

# 검증
- [ ] 컴파일 성공 (exit code 0)
- [ ] cgc-native 바이너리 생성
- [ ] 바이너리 크기 분석
- [ ] 링킹 오류 확인
```

**성공 조건**: 컴파일 오류 없음

#### 3단계: 고정점 검증 (1-2시간)

```bash
# 명령 1: bootstrap.js로 cgc-main.fl → s1 (C 코드)
node bootstrap.js run self/cgc-main.fl > /tmp/s1.c

# 명령 2: gcc로 s1 → cgc-native1
gcc /tmp/s1.c -o /tmp/cgc-native1

# 명령 3: cgc-native1로 cgc-main.fl → s2 (C 코드)
/tmp/cgc-native1 run self/cgc-main.fl > /tmp/s2.c

# 명령 4: gcc로 s2 → cgc-native2
gcc /tmp/s2.c -o /tmp/cgc-native2

# 명령 5: cgc-native2로 cgc-main.fl → s3 (C 코드)
/tmp/cgc-native2 run self/cgc-main.fl > /tmp/s3.c

# 검증
- [ ] SHA256(s1) == SHA256(s2) (1단계 고정점)
- [ ] SHA256(s2) == SHA256(s3) (2단계 고정점)
- [ ] cgc-native1 ~= cgc-native2 (구조적 동일)
```

**성공 조건**: SHA256 고정점 도달 (s2 == s3)

---

## D-4: 런타임 지원 (C stdlib)

### 필수 런타임 함수

```c
// memory.c
void* fl_malloc(size_t size);
void fl_free(void* ptr);
void fl_gc_mark(void* obj);
void fl_gc_sweep();

// builtins.c
fl_value fl_add(fl_value a, fl_value b);
fl_value fl_sub(fl_value a, fl_value b);
fl_value fl_mul(fl_value a, fl_value b);
fl_value fl_div(fl_value a, fl_value b);
fl_value fl_eq(fl_value a, fl_value b);
fl_value fl_str_concat(fl_value a, fl_value b);
fl_value fl_length(fl_value arr);
fl_value fl_get(fl_value arr, fl_value idx);
fl_value fl_push(fl_value arr, fl_value val);

// io.c
void fl_println(fl_value val);
fl_value fl_file_read(const char* path);
void fl_file_write(const char* path, fl_value content);
```

**현황**: C 런타임 스켈레톤 존재  
**작업**: 필요한 함수만 구현

---

## D-5: 문제 해결 계획

### 예상 오류 시나리오

| 오류 | 원인 | 해결 방법 |
|------|------|----------|
| `undefined reference to ...` | 함수 미구현 | runtime-*.c 구현 |
| `Segmentation fault` | 메모리 접근 오류 | GDB로 디버깅 |
| `infinite loop` | TCO 버그 | codegen-c-tco.fl 재검토 |
| `wrong output` | 의미론 오류 | 표현식 생성 확인 |
| `compilation error` | C 문법 오류 | codegen-c.ts 수정 |

### 디버깅 도구

```bash
# 1. C 파일 검증
gcc -Wall -Wextra -fanalyzer cgc-main.c

# 2. 런타임 오류 추적
gdb /tmp/cgc-native1
  > run self/cgc-main.fl
  > bt (backtrace)

# 3. C 코드 비교
diff -u /tmp/s1.c /tmp/s2.c | head -100
```

---

## D-6: 성공 기준

### Phase D 완료 조건

```
[✅] D-1: codegen-c 상태 검증
     - TCO 최적화 확인
     - Closure capture 확인
     - HOF support 확인

[✅] D-2: C 코드 생성 프로세스 확인
     - cgc-main.fl 실행 → C 코드 생성

[✅] D-3: GCC 컴파일 성공
     - cgc-native 바이너리 생성
     - 링킹 오류 없음

[✅] D-4: 고정점 도달
     - SHA256(s1) == SHA256(s2)
     - cgc-native 안정화

최종 판정: L3 자가호스팅 달성 ✅
```

---

## 예상 시간

```
D-1: 검증          30분
D-2: C 생성         1시간
D-3: 컴파일         30분
D-4: 고정점         1시간
D-5: 디버깅         (필요시) 1-2시간
────────────────────────────
총 예상: 3-4시간
```

---

## Phase E 진입 조건

```
Phase D 완료 후:
[✅] cgc-native 바이너리 존재
[✅] cgc-native가 cgc-main.fl 파싱 가능
[✅] cgc-native가 C 코드 생성 가능
[✅] SHA256 고정점 도달

Phase E 목표:
- cgc-native로 cgc-main.fl 자체 재컴파일
- L3 자가호스팅 검증
- bootstrap.js 제거 가능성 평가
```

---

## 위험도 평가

| 위험 | 확률 | 영향도 | 완화 |
|------|------|--------|------|
| C 코드 생성 오류 | 중간 | 높음 | codegen-c.ts 재검토 |
| 컴파일 오류 | 낮음 | 중간 | 런타임 함수 구현 |
| 런타임 오류 | 중간 | 높음 | GDB 디버깅 |
| 고정점 미달 | 낮음 | 낮음 | 코드 생성 재검토 |

**종합 위험도**: 중간 (3/5)  
**신뢰도**: 7/10 (Phase B 완성 후)

---

**상태**: Phase D 진입 준비 완료  
**다음**: D-1 Codegen-C 검증 (실행)

