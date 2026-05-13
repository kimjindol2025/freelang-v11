# FreeLang 자주독립 — Node.js/TS 탈피 인계 문서

**프로젝트**: p_1778634866334  
**작성일**: 2026-05-14  
**목표**: `PATH=/usr/bin:/bin ./freelang hello.fl` — Bun/Node.js 없이 실행

---

## 현재 상태 요약

### 완료 (S1–S9)

| Stage | 내용 | 위치 |
|-------|------|------|
| S1 | Level 3 부트스트랩 — `all.fl.out.js` 자기 컴파일 | `self/all.fl.out.js` (56KB) |
| S2 | FL→C 코드젠 기본 구현 | `self/codegen-c.fl` (294줄) |
| S3 | C 런타임 구현 + 단위 테스트 | `runtime/runtime.c` (444줄) |
| S4 | 바이너리 배포 (`bin/fl`) | `bin/fl` (101MB — Bun 번들) |
| S5 | Heap Object System (FLVector + FLMap) | `runtime/runtime.c` |
| S6 | `loop/recur` → C goto 변환 | `self/codegen-c.fl` |
| S7 | Closure (fn literal) 구현 | `self/codegen-c.fl` |
| S8 | map/filter/reduce 고차함수 | `self/codegen-c.fl` |
| S9 | map-keys/map-vals/map-entries | `self/codegen-c.fl` |

### 핵심 발견: bin/fl은 Bun 번들

```
ls -la bin/fl → 101,386,560 bytes (101MB)
strings bin/fl | grep JSC → LazyNode JSC::DFG...
```

`bin/fl`은 Bun JS 런타임이 통째로 들어 있음.  
**진정한 Node.js 탈피가 아님.** PATH 제한 시 실행 불가.

---

## 남은 작업 (S10–S12)

### S10-감사: 현황 정밀 진단 (태스크 t_1778714992232)

```bash
# 1. PATH 제한 테스트
PATH=/usr/bin:/bin ./bin/fl examples/hello.fl
# 예상: 실패 (Bun 의존)

# 2. 컴파일러 C 변환 시도
node self/all.fl.out.js --target c self/all.fl /tmp/freelang_compiler.c
# 확인: --target c 옵션이 이미 구현됐는지?

# 3. 의존 함수 목록화
grep -r "process\." src/stdlib-*.ts | grep -v test
```

### S10-핵심: self/all.fl → C 컴파일 (태스크 t_1778714992482)

**이것이 핵심 목표.**

```bash
# all.fl.out.js로 자기 자신을 C로 컴파일
node self/all.fl.out.js --target c self/all.fl /tmp/fl_compiler.c

# gcc 빌드
gcc /tmp/fl_compiler.c runtime/runtime.c -o /tmp/freelang_native -lm

# PATH 제한 테스트
PATH=/usr/bin:/bin /tmp/freelang_native examples/hello.fl
```

**예상 장벽**:
- `--target c` 옵션이 아직 `all.fl.out.js`에 없을 수 있음
- `codegen-c.fl`이 `all.fl`에 통합돼 있지 않을 수 있음
- 일부 stdlib 함수 (`http-get`, `db-query` 등)는 C로 변환 불가

**우회 전략**: 컴파일러 핵심 (lexer+parser+codegen)만 C로 변환, stdlib은 외부 C 라이브러리로 제공

### S11: stdlib 핵심 3개 C 포팅 (태스크 t_1778714992717)

```c
// runtime/runtime.c에 추가할 함수들
FLValue fl_file_read(FLValue path);
FLValue fl_file_write(FLValue path, FLValue content);
FLValue fl_cli_args(void);
```

### S12: bootstrap.js 교체 선언 (태스크 t_1778714992973)

```bash
# bin/freelang 스크립트 교체
#!/bin/sh
exec "$(dirname "$0")/freelang_native" "$@"
```

---

## 코드베이스 핵심 파일

```
freelang-v11/
├── freelang.c           # C seed compiler (593줄)
├── self/
│   ├── all.fl           # FreeLang 컴파일러 전체 (FL로 작성)
│   ├── all.fl.out.js    # all.fl 컴파일 결과 (56KB JS)
│   ├── codegen-c.fl     # FL→C 코드젠 (294줄)
│   ├── ABI.md           # C backend ABI 헌법
│   └── CODEGEN_C_SCOPE.md  # S2 지원 범위 문서
├── runtime/
│   ├── runtime.h        # FLValue tagged union ABI
│   └── runtime.c        # C 런타임 (444줄)
└── docs/ROADMAP.md      # Stage 1-4 원본 로드맵
```

---

## DESK 태스크 목록

| ID | 제목 | 우선순위 |
|----|------|---------|
| t_1778714992232 | [S10 감사] bin/fl 바이너리 실체 검증 | high |
| t_1778714992482 | [S10] self/all.fl → C 컴파일 (핵심) | urgent |
| t_1778714992717 | [S11] stdlib 핵심 3개 C 포팅 | high |
| t_1778714992973 | [S12] bootstrap.js 교체 선언 | high |

태그: `자주독립`, `p_1778634866334`

---

## 실행 검증 기준

```bash
# 최종 통과 기준
PATH=/usr/bin:/bin ./freelang hello.fl
# → Hello, World!

# Node.js 흔적 없음
ldd ./freelang | grep -E "node|bun"
# → 아무것도 없어야 함
```
