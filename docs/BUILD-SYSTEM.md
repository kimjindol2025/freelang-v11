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
│  [Experimental Path]       ← Future (not implemented)          │
│  self-host compiler                                            │
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

## 3. Experimental Path

**현재 구현되지 않음.** 향후 자주국방(self-hosting sovereignty) 진화 트랙.

### Future scope

- `stage1.js`를 확장해 bootstrap.js 전체를 self-host 컴파일하는 stage2 작업
- 또는 별도 FreeLang으로 작성된 compiler가 TS 소스를 직접 컴파일
- 최종 목표: 외부 npm(esbuild) devDependency 0

### Status

- **Not in production build path.** Production은 esbuild 사용 (정식 결정 2026-05-21)
- 진화 계획은 별도 SPEC.airc task / PLAN으로 등록 후 진행
- 현재 stage1.js는 runtime helpers만 — 컴파일러 진화 작업 미착수

---

## 4. History

| 시점 | 사건 |
|------|------|
| ~2026-04 | `scripts/build.js`가 esbuild로 bootstrap.js 빌드 — 정식 production path |
| `71a638ff` (Phase X-2) | "npm esbuild 제거" — `scripts/build.js`에서 esbuild 호출 삭제, dependency 5→4. 그러나 다른 빌드 스크립트(`build-runtime.sh`, `build-stage1-final.sh`)는 esbuild 유지 |
| ~2026-04~05 | bootstrap.js 갱신은 외부 임시 스크립트(`/tmp/build-p18.js` 등)로만 가능한 hidden pipeline 상태 진입 |
| `2026-05-21` | P1 build pipeline unification 결정 — esbuild 정식화, scripts/build.js 복원, BUILD-SYSTEM.md 신설 |

---

## 5. Dependencies

`package.json` devDependencies:

| Package | Version | Role |
|---------|---------|------|
| `esbuild` | `^0.28.0` | Production build path bundler |
| `jest` | `^29.7.0` | Test runner |
| `@types/jest` | `^29.5.14` | Type definitions |
| `@types/node` | `^20.19.37` | Type definitions |

**Runtime dependencies (production)**: 0 — Node.js 내장 모듈만 사용. `bootstrap.js` 자체는 외부 npm 패키지 require 없음.

---

## 6. Cross-references

- PLAN: `docs/PLAN-build-pipeline-unify.md`
- SPEC: `SPEC.airc` `dec-010` (bootstrap SHA scope_out)
- 관련 commit: `71a638ff` (Phase X-2 부분 조치)
- 메모리: `feedback_freelang_claims.md` (외부 npm 0개 — esbuild는 dev 영향 없음)
- 메모리: `bootstrap_js_from_ts.md` (정정 대상 — 31일 전 정보, BUILD-SYSTEM.md가 source of truth)
