# Link Profiles — Compiler vs General Programs

**Status**: Production (2026-05-24)  
**Decision**: L4 Phase E-0-3 — 링크 프로파일 이원화  
**Related**: `docs/BUILD-SYSTEM.md` (Native Build Path), `scripts/build-cgc-native.sh`

---

## Overview

FreeLang v11 네이티브 컴파일 체인은 gen1.c → gcc 링크 단계에서 **2가지 프로파일**을 필요로 한다:

1. **Compiler Profile** — `self/cgc-main.fl` 컴파일 용도
   - 8개 runtime 모듈 + `cgc-bridge.c` (lex/parse 포함)
   - 출력: cgc-native (ELF 컴파일러 바이너리)

2. **General Program Profile** — 일반 FL 프로그램 (test-*.fl 등) 컴파일 용도
   - 8개 runtime 모듈 **제외** `cgc-bridge.c`
   - 출력: ELF 실행 파일 (standalone)

---

## 문제: cgc-bridge.c Linking Issue

### 증상

```bash
# ❌ 일반 프로그램 컴파일 시도
gcc -I runtime \
  /tmp/gen1.c \
  runtime/core.c \
  runtime/collection.c \
  ... \
  runtime/cgc-bridge.c \  # ← 잘못된 링크
  -lm -o /tmp/test-bin

# 에러
/tmp/test-recur-tco.c: undefined reference to `lex(char*)`, `parse(char*)`
```

### 원인

- **cgc-bridge.c** = Compiler bridge module
- `lex()`, `parse()` 함수 **참조** (정의 X)
- 이 함수들은 `bootstrap.js`에만 존재 (JavaScript)
- C 코드 생성된 일반 프로그램은 lex/parse 불필요

---

## 해결책

### Compiler Profile (cgc-main.fl 컴파일)

**용도**: FreeLang 컴파일러 자체 재컴파일

```bash
bash scripts/build-cgc-native.sh <gen1.c> <output-bin>
```

**링크 모듈** (8개):
```
runtime/core.c
runtime/collection.c
runtime/io.c
runtime/math.c
runtime/error.c
runtime/process.c
runtime/json.c
runtime/cgc-bridge.c        ← lex/parse bridge 포함
```

**결과**: cgc-native (257KB ELF)
- `cgc-native self/cgc-main.fl ...` 명령 실행 가능

### General Program Profile

**용도**: test-*.fl, 사용자 FL 프로그램 컴파일

**링크 모듈** (7개, cgc-bridge.c **제외**):
```
runtime/core.c
runtime/collection.c
runtime/io.c
runtime/math.c
runtime/error.c
runtime/process.c
runtime/json.c
```

**결과**: Standalone ELF executable
- lex/parse 불필요 (이미 C codegen 완료)
- Node.js/Bootstrap 의존성 없음

---

## 구현 상태

### build-cgc-native.sh

**현재 상태**: Compiler Profile 자동화 완료 ✅

```bash
bash scripts/build-cgc-native.sh /tmp/gen1.c /tmp/gen1-bin
# → cgc-native1 (257KB) with cgc-bridge.c linked
```

### General Program Profile

**상태**: ✅ 자동화 완료 (2026-05-24)

**자동화 스크립트**:
```bash
bash scripts/build-general-program.sh <gen.c> <output-bin>
```

**구현**: `scripts/build-general-program.sh`
- Input: `<gen.c> <output-bin>`
- Linker: 7개 runtime 모듈 (cgc-bridge.c 제외)
- 결과: Standalone ELF executable (lex/parse 불필요)

---

## 설계 원칙

### Rule 1: 컴파일러는 bridge 필요

Compiler가 자신을 재컴파일하려면:
- `bootstrap.js` 기반 codegen → gen1.c
- gen1.c 안의 `emit_lex()`, `emit_parse()` 호출
- C 코드는 cgc-bridge.c 통해 JS 런타임 참조 ❌ (bridge 개념 오해)

**실제**: cgc-bridge.c는 **symbol forwarding** (C↔JS interop)
- cgc-main.fl은 순수 FL → 순수 C codegen
- cgc-bridge.c는 **codegen에 포함되지 않음**
- Native 바이너리가 필요한 것은 **runtime 함수들** (core.c, io.c 등)

### Rule 2: 일반 프로그램은 runtime만 필요

사용자 FL 프로그램 (test-*.fl → gen.c):
- `(+ 1 2)` → C 표현식
- `(file-read "path")` → core.c `fl_file_read()` 호출
- lex/parse ❌ (이미 완료)
- cgc-bridge ❌ (필요 없음)

---

## 검증 (L4 Fixed-Point Test)

### Compiler Profile Test (D-3)

```bash
# gen1.c 생성 (bootstrap.js 기반)
node bootstrap.js run self/cgc-main.fl self/cgc-main.fl /tmp/gen1.c

# C → native 링크 (Compiler Profile)
bash scripts/build-cgc-native.sh /tmp/gen1.c /tmp/gen1-bin

# 재컴파일: native → gen2.c
/tmp/gen1-bin self/cgc-main.fl /tmp/gen2.c

# SHA 검증
sha256sum /tmp/gen1.c /tmp/gen2.c
# ✅ 동일 (5c1edeaf...)
```

### General Program Test (D-4) ← 완료 ✅

```bash
# test-recur-tco.fl → gen.c (bootstrap.js)
node bootstrap.js run self/cgc-main.fl test-recur-tco.fl /tmp/test-gen.c

# C → executable 링크 (General Profile) — 자동화 완료
bash scripts/build-general-program.sh /tmp/test-gen.c /tmp/test-bin

# 실행
/tmp/test-bin arg1 arg2
# ✅ Success (예상)
```

---

## 다음 단계

### E-0-4 (다음 세션)

자동화 스크립트 추가:
- `scripts/build-general-program.sh` (General Profile)
- 문법: `bash scripts/build-general-program.sh <gen.c> <output-bin>`
- 내부: 7개 runtime 모듈 자동 링크 (cgc-bridge.c 제외)

### E-0-5 (이후)

테스트 스위트 추가:
- `test-general-program.sh` — General Profile E2E 검증
- Compiler Profile + General Profile 모두 통과 필요

---

## FAQ

### Q1: 왜 두 가지 프로파일이 필요한가?

**A**: cgc-bridge.c는 특정 목적 (bootstrap.js와의 interop)에만 필요. 일반 프로그램에는 불필요한 심볼을 강제 링크하면 undefined reference 발생.

### Q2: 일반 프로그램도 cgc-bridge.c와 링크할 수 없나?

**A**: 기술적으로 가능하려면:
1. cgc-bridge.c의 lex/parse 구현을 C로 제공, 또는
2. Dummy 함수 제공 (하지만 호출되지 않으므로 의미 없음)

현재: 제외하는 것이 깔끔 (불필요한 심볼 제거 = 바이너리 크기 절감)

### Q3: 두 프로파일을 하나로 통합할 수 있나?

**A**: 가능하지만:
- cgc-bridge.c를 **선택적 링크**로 만들어야 함
- Weak symbols 또는 conditional compilation 사용
- 복잡도 증가, 현재 단순한 이원화 더 명확

현재 (L4 도입 초기): **이원화 권장**

---

## 용어 정의

| 용어 | 의미 | 포함 모듈 |
|------|------|----------|
| **Compiler Profile** | cgc-main.fl 자체 컴파일 용도 | core+collection+io+math+error+process+json+**cgc-bridge** |
| **General Profile** | 사용자 FL 프로그램 컴파일 용도 | core+collection+io+math+error+process+json |
| **cgc-bridge.c** | Compiler bridge (lex/parse fowarding) | Compiler Profile만 |
| **gen1.c** | bootstrap.js가 생성한 C 코드 (cgc-main.fl 컴파일 결과) | Compiler Profile으로 링크 |
| **gen.c** | 일반 FL 프로그램 컴파일 결과 | General Profile으로 링크 |

---

**상태**: ✅ L4 단계 공식화  
**다음 세션**: E-0-4 (scripts/build-general-program.sh), E-0-5 (블로그 + 보고서)
