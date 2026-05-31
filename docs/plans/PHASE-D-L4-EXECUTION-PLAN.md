# Phase D/L4 Execution Plan

작성일: 2026-05-24

목표: `cgc-main.fl`로 생성한 네이티브 C 컴파일러가 Node/Bun 없이 자기 자신과 주요 입력을 다시 컴파일하고, 고정점과 런타임 안정성을 증명한다.

## 현재 리서치 결과

### 확인된 사실

- `/tmp/gen1.c` 존재
  - 크기: 144,781 bytes
  - 라인 수: 2,874 lines
- 단일 `runtime/runtime.c`는 현재 없음
  - 런타임은 다음 모듈로 분리됨:
    - `runtime/core.c`
    - `runtime/collection.c`
    - `runtime/io.c`
    - `runtime/math.c`
    - `runtime/error.c`
    - `runtime/process.c`
    - `runtime/json.c`
    - `runtime/cgc-bridge.c`
- 아래 모듈 묶음으로 `gen1.c` 링크 성공:

```bash
gcc -Wall -Wextra -I runtime -o /tmp/gen1-bin /tmp/gen1.c \
  runtime/core.c runtime/collection.c runtime/io.c runtime/math.c \
  runtime/error.c runtime/process.c runtime/json.c runtime/cgc-bridge.c -lm
```

- `/tmp/gen1-bin`은 Node/Bun을 링크하지 않음:

```text
linux-vdso
libm
libc
ld-linux
```

- `/tmp/gen1-bin self/cgc-main.fl /tmp/gen2.c` 성공.
- `/tmp/gen1.c`와 `/tmp/gen2.c`의 SHA256이 완전 일치:

```text
5c1edeafb7ae346f2347a9321b0bfe8dfef7ae0be91c5e049b6bcfcbb57f2f74
```

- `/tmp/gen2.c`도 동일 런타임 묶음으로 링크 성공.

### 남은 문제

- `self/test-recur-tco.fl`를 네이티브 gen1으로 C 생성하면 C 파일은 생성되지만, 생성물은 아직 old loop lowering을 사용한다.
  - `_fl_looping`
  - `while (_fl_looping)`
  - `__fl_loop_tmp_*`
- 같은 생성물은 `mod(...)` 호출을 C에 그대로 내보내 gcc 컴파일 실패:

```text
implicit declaration of function 'mod'
error: expected FLValue but argument is int
```

- 현재 `self/codegen-c.fl`와 `self/cgc-main.fl` 모두 `%`는 `fl_mod(...)`로 매핑하지만, `mod` 연산자 매핑은 없음.
- 따라서 `cgc-main.fl` 자체 고정점은 통과하지만, 일반 입력에 대한 codegen surface는 아직 부족하다.

## 단계 정의

### D-2: 링크 계약 고정

목표: gen1/gen2 네이티브 컴파일러 빌드 명령을 공식화한다.

완료 기준:

- `scripts/build-cgc-native.sh` 또는 동등 스크립트 생성.
- `/tmp/gen1.c -> /tmp/gen1-bin` 링크 성공.
- `/tmp/gen2.c -> /tmp/gen2-bin` 링크 성공.
- `ldd` 결과에 Node/Bun/JSC 없음.

주의:

- 문서의 오래된 `runtime/runtime.c` 경로를 모듈화된 runtime 묶음으로 갱신해야 한다.

### D-3: 네이티브 gen1 실행 계약

목표: `/tmp/gen1-bin`이 Node 없이 입력 FL을 C로 생성한다.

완료 기준:

- 인자 없음: usage 출력.
- `self/cgc-main.fl -> /tmp/gen2.c` 성공.
- `gen1.c == gen2.c` SHA 일치.
- `PATH=/usr/bin:/bin /tmp/gen1-bin self/cgc-main.fl /tmp/gen2.c` 성공.

현재 상태:

- 기본 실행과 자기 자신 재생성은 성공.
- 제한 PATH 검증은 아직 별도 실행 필요.

### D-4: 일반 입력 codegen surface 정리

목표: 네이티브 gen1이 대표 FL 입력을 생성하고, 생성된 C가 gcc로 컴파일된다.

우선 대상:

1. `(println (+ 1 2))`
2. `self/test-recur-tco.fl`
3. `self/test-hof-simple.fl`
4. `self/test-closure-capture.fl`

현재 알려진 작업:

- `mod` 연산자 매핑 추가.
- native gen1이 old loop lowering을 내는 원인 확인.
  - `cgc-main.fl` 내부 코드젠이 최신 `self/codegen-c.fl`와 불일치하는지 비교.
  - `self/codegen-c.fl`를 load하는 방식인지, 통합 복사본을 쓰는 방식인지 결정.

완료 기준:

- 대표 입력 4개 모두 C 생성 성공.
- 생성된 C가 gcc 링크 성공.
- 실행 가능한 케이스는 출력 검증 통과.

### D-5: 네이티브 고정점 검증

목표: 네이티브 컴파일러 체인이 반복 단계에서도 안정적임을 증명한다.

검증 체인:

```text
gen1-bin -> gen2.c -> gen2-bin -> gen3.c -> gen3-bin
```

완료 기준:

- `gen1.c == gen2.c == gen3.c` SHA 일치.
- `gen1-bin`, `gen2-bin`, `gen3-bin` 모두 `ldd`상 Node/Bun 없음.
- 제한 PATH에서 모두 실행 가능.

### D-6: L4 선언

목표: Node/Bun 없는 네이티브 compiler path를 공식 선언한다.

완료 기준:

- `PATH=/usr/bin:/bin /tmp/gen1-bin input.fl output.c` 성공.
- 생성 C를 gcc로 빌드하여 실행 성공.
- native fixed-point 통과.
- D-2~D-5 검증 스크립트가 repo 안에 존재.
- 문서의 `runtime/runtime.c` 등 오래된 경로 정리.

## 바로 다음 리서치

1. native gen1이 `mod(...)`를 내는 경로 추적.
2. native gen1이 old loop lowering을 내는 이유 확인.
3. `cgc-main.fl`와 `codegen-c.fl` 코드젠 차이 목록 작성.
4. D-2/D-3 검증 스크립트 초안 작성.
5. 제한 PATH에서 gen1/gen2 실행 검증.

## 위험도

- 가장 큰 위험: `cgc-main.fl`이 최신 `codegen-c.fl`와 drift된 복사본을 가지고 있을 가능성.
- 두 번째 위험: 자기 자신은 고정점이지만 일반 입력의 생성 C가 컴파일되지 않는 false-positive L4 선언.
- 세 번째 위험: runtime 모듈 묶음이 문서/스크립트마다 달라 재현성이 깨지는 문제.
