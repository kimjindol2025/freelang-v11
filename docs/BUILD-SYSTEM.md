# Build System — FreeLang v11

**Status**: Production (2026-05-21~)
**Decision**: 2026-05-21 P1 build pipeline unification (PLAN: `docs/PLAN-build-pipeline-unify.md`)
**SPEC scope**: `dec-010 scope_out` — bootstrap.js는 effect enforcement SHA validation 범위 밖

---

## Overview

FreeLang v11은 세 개의 분리된 빌드 트랙을 가진다. 각 트랙은 독립적인 source of truth와 도구 체인을 가진다.

```
┌───────────────────────────────────────────────────────────────┐
│  [Production Build Path]   ← Truth artifact                    │
│  src/cli.ts + stdlib-*.ts  →  esbuild  →  bootstrap.js         │
├───────────────────────────────────────────────────────────────┤
│  [Runtime Path]            ← Execution                         │
│  stage1.js + interpreter + effect system                       │
├───────────────────────────────────────────────────────────────┤
│  [Native Build Path]       ← L4 Self-Hosting (2026-05-24)      │
│  self/cgc-main.fl → gen1.c → gcc → cgc-native1 (ELF)          │
└───────────────────────────────────────────────────────────────┘
```

---

## 1. Production Build Path

**bootstrap.js는 truth artifact다**. 모든 v11 실행(`node bootstrap.js run ...`)은 이 파일을 사용한다.

### Sources

- **Entry**: `src/cli.ts`
- **Bundle scope**: `src/stdlib-*.ts`, `src/eval-*.ts`, `src/runtime-*.ts`, 기타 `src/**/*.ts`
- **외부 의존 (external)**: Node.js 내장 모듈만 (`fs`, `net`, `tls`, `crypto`, `worker_threads` 등)

### Tooling

- **Bundler**: `esbuild ^0.28.0` (devDependency)
- **Format**: CommonJS, platform `node`, target `node18`
- **Minify**: **false** — unminified 유지 (가독성·디버깅·SHA 비교 안정성)
- **Loader**: `.json` → `json` (stdlib signature JSON embed 대응)

### Command

```bash
npm run build           # = node scripts/build.js
```

`scripts/build.js`가 다음을 수행한다:
1. `extractSignatures` — `src/stdlib-*.ts` 주석에서 함수 시그니처 추출 → `src/_stdlib-signatures.json`
2. `gen-ai-prompt.js` — AI 시스템 프롬프트 자동 생성 (AI-1 통합)
3. `lint-stdlib-aliases.js` — alias drift advisory
4. **esbuild bundle** — `src/cli.ts` → `bootstrap.js`
5. Size/header 검증

### Output

- `bootstrap.js` — 약 1.7~1.9MB, ~48k 줄, unminified
- 헤더 시그니처: `var __create = Object.create;` ... (esbuild interop wrapper)
- 변경 후 commit 필수 — 산출물도 repo에 포함 (Phase X-2 정책)

### Verify

```bash
npm run test:fast       # jest 회귀 (≥ 1192 PASS 기준, 2026-05-21 시점)
```

---

## 2. Runtime Path

bootstrap.js가 실행될 때 사용하는 보조 컴포넌트들. **빌드 산출물이 아님** — repo에 직접 commit된 source.

### Components

- **`stage1.js`** (432줄) — FreeLang v11 Runtime Helpers
  - 산술/논리/I/O 등 v11 인터프리터가 호출하는 helper 모음
  - bootstrap.js와 분리된 source — 직접 편집 가능
- **`self/runtime/*.js`** — `scripts/build-runtime.sh`로 빌드된 자체 모듈
  - 예: `self/runtime/http-server.js` ← `src/stdlib-http-server.ts`
  - `scripts/build-runtime.sh`는 esbuild 사용 (production path와 동일 도구)
- **Effect system** — `src/effect-*.ts`, `src/builtin-effects.ts` (bootstrap.js에 번들됨)

### Note

`stage1.js`는 컴파일러가 아니라 runtime helper다. bootstrap.js를 생성할 수 없다. self-host로 오해 금지.

---

## 3. Native Build Path (L4 Self-Hosting)

**Status**: Production (2026-05-24)

네이티브 ELF 컴파일러로 FreeLang을 자신을 재컴파일하는 자가호스팅 경로. L4 고정점 달성.

### Tooling

- **Source**: `self/cgc-main.fl` (FreeLang compiler, 1521줄)
- **Intermediate**: `gen1.c` (142KB, ~2874 lines)
  - bootstrap.js 또는 이전 gen-bin에서 생성
  - 순수 C 코드 (forward declarations + functions + main)
- **Compiler**: GCC (또는 clang)
  - 플래그: `-Wall -Wextra -I runtime`
  - Output: ELF 64-bit executable
- **Runtime modules** (8개, 총 ~50KB):
  - `runtime/core.c` — FLValue 타입, 기본 함수
  - `runtime/collection.c` — 배열/맵
  - `runtime/io.c` — 파일 I/O
  - `runtime/math.c` — 수학, `fl_get_argv()`
  - `runtime/error.c` — 오류 처리
  - `runtime/process.c` — 프로세스
  - `runtime/json.c` — JSON
  - `runtime/cgc-bridge.c` — compiler bridge
- **Linker flags**: `-lm` (math library)

### Build Chain

```
gen1.c (bootstrap.js로부터)
  ↓ gcc + 8 runtime modules
cgc-native1 (ELF 257KB)
  ↓ cgc-native1 self/cgc-main.fl
gen2.c
  ↓ [identical to gen1.c ✅]
cgc-native2 (ELF)
  ↓ cgc-native2 self/cgc-main.fl
gen3.c
  ↓ [identical to gen2.c ✅]
[Fixed-point verified]
```

### Scripts

- **`scripts/build-cgc-native.sh`** — C → 네이티브 바이너리 자동 링크
  ```bash
  bash scripts/build-cgc-native.sh <input.c> <output-bin>
  ```
- **`scripts/verify-l4-fixpoint.sh`** — L4 고정점 검증
  ```bash
  bash scripts/verify-l4-fixpoint.sh
  ```

### Verification

```
SHA256 Identity Check:
  gen1.c:  5c1edeafb7ae346f2347a9321b0bfe8dfef7ae0be91c5e049b6bcfcbb57f2f74
  gen2.c:  5c1ede... ✅ (identical)
  gen3.c:  5c1ede... ✅ (identical)

PATH Restriction:
  PATH=/usr/bin:/bin cgc-native1 self/cgc-main.fl → Success ✅
```

### Implications

- **Zero Node.js dependency** (bootstrap.js 제외, 초기 gen1.c 1회만)
- **Platform-independent** (gcc 표준, 모든 Unix/Linux)
- **Deterministic** (same input = same output, bit-for-bit)
- **Self-verifying** (fixed-point proof = compiler stability)

---

## 4. Future Path (L5+)

**목표**: bootstrap.js 의존성 완전 제거

### Options

1. **gen1.c를 순수 C로 작성** (10,000줄+ 수동 작업)
2. **Go/Rust/C++ 기존 컴파일러로 부트스트랩**
3. **다른 언어(OCaml, Haskell)로 작성된 중간 컴파일러**

### Timeline

- L4 현재 상태: 2026-05-24 달성
- E-0 (L4 정착): 2026-05-24 ~ 2026-06-07
- L5 연구: 2026-06-08+

---

## 5. History (updated)

---

## 6. History

| 시점 | 사건 |
|------|------|
| ~2026-04 | `scripts/build.js`가 esbuild로 bootstrap.js 빌드 — 정식 production path |
| `71a638ff` (Phase X-2) | "npm esbuild 제거" — `scripts/build.js`에서 esbuild 호출 삭제, dependency 5→4. 그러나 다른 빌드 스크립트(`build-runtime.sh`, `build-stage1-final.sh`)는 esbuild 유지 |
| ~2026-04~05 | bootstrap.js 갱신은 외부 임시 스크립트(`/tmp/build-p18.js` 등)로만 가능한 hidden pipeline 상태 진입 |
| `2026-05-21` | P1 build pipeline unification 결정 — esbuild 정식화, scripts/build.js 복원, BUILD-SYSTEM.md 신설 |
| `2026-05-24` | **Phase D (L4 Native)**: gen1.c → cgc-native1 (ELF) → gen2.c (SHA identical). Native Build Path 공식화. Commit b83a5ba6 |

---

## 7. Dependencies

`package.json` devDependencies:

| Package | Version | Role |
|---------|---------|------|
| `esbuild` | `^0.28.0` | Production build path bundler |
| `jest` | `^29.7.0` | Test runner |
| `@types/jest` | `^29.5.14` | Type definitions |
| `@types/node` | `^20.19.37` | Type definitions |

**Runtime dependencies (production)**: 0 — Node.js 내장 모듈만 사용. `bootstrap.js` 자체는 외부 npm 패키지 require 없음.

---

## 8. Cross-references

- PLAN: `docs/PLAN-build-pipeline-unify.md`
- SPEC: `SPEC.airc` `dec-010` (bootstrap SHA scope_out)
- 관련 commit: `71a638ff` (Phase X-2 부분 조치)
- 메모리: `feedback_freelang_claims.md` (외부 npm 0개 — esbuild는 dev 영향 없음)
- 메모리: `bootstrap_js_from_ts.md` (정정 대상 — 31일 전 정보, BUILD-SYSTEM.md가 source of truth)
