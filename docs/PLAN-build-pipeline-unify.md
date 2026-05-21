# PLAN — P1: Build Pipeline Unification

**Date**: 2026-05-21
**Branch**: `feature/build-pipeline-unify`
**Base**: `56b3f674` (fx worktree, `feature/effect-taxonomy`)
**Task**: `t_1779346120945` (tasks.dclub.kr)
**SPEC node**: 해당사항 없음 — `dec-010 scope_out` (bootstrap.js out-of-scope) 영역

> 본 PLAN.md는 11절 코딩규칙 1절(문서화) 충족용. 결정·근거는 본 문서가 단일 출처.

## 1. 문제

`scripts/build.js`와 실제 빌드 파이프라인이 분리되어 있다.

### 1.1 현재 상태 (검증 결과, 2026-05-21)

- **`bootstrap.js`** (1824240 bytes, 48038줄, md5 `e1037069738b8dc94fc6289e5c5fe7aa`)
  - 헤더 시그니처: `__create`, `__defProp`, `__esm`, `__commonJS` → **esbuild 산출물**
  - 라인 길이 변동 (L1=19, L40000=92) → **unminified**
  - main / fx 양쪽 worktree에 byte-identical 공유

- **`scripts/build.js`** (84줄)
  - esbuild import/호출 **0개** (주석에만 "Phase X-2 esbuild 제거" 언급)
  - 실질 작동: `extractSignatures` + `gen-ai-prompt` + alias lint + bootstrap 존재 검증
  - `npm run build`는 bootstrap.js를 **재생성하지 않음**

- **`/tmp/build-p18.js`** (외부 임시)
  - `71a638ff^` (Phase X-2 직전) esbuild 설정 복원
  - `src/cli.ts → bootstrap.js` 번들링 (minify=true 설정 — 실제 산출물은 unminified이므로 사용 안 됐거나 다른 경로로 빌드됨)

- **`stage1.js`** (432줄)
  - "FreeLang v11 Runtime Helpers" — **컴파일러 아님**
  - bootstrap.js를 만드는 self-host 컴파일러 경로는 **현재 존재하지 않음**

### 1.2 모순

| 출처 | 주장 | 현실 |
|------|------|------|
| `scripts/build.js:54` | "Phase X-2: npm esbuild 제거" | 부분 조치 — `scripts/build.js`만 해당. `build-runtime.sh`, `build-stage1-final.sh`는 여전히 esbuild 사용 |
| 메모리 `feedback_bootstrap_js_from_ts.md` (31일 전) | "esbuild로 번들된 산출물" | ✅ 정확하나 outdated |
| 인수인계 노트 (2026-05-21) | "fx의 48038줄 = self-host 정식 경로 산출물" | ❌ 부정확. 실제는 esbuild 산출물 |
| `package.json` "build" 스크립트 | `node scripts/build.js` | 검증만, 재빌드 안 함 |

→ 외부 임시 스크립트로만 bootstrap.js 갱신 가능한 **hidden build pipeline** 상태.

## 2. 결정 (사용자 승인 2026-05-21)

**A안 — esbuild 정식화 + 문서 정정**

### 2.1 Build path 정의 (3-track)

```
[Production Build Path]
  TS (src/cli.ts + stdlib-*.ts) → esbuild → bootstrap.js (truth artifact)

[Runtime Path]
  stage1.js + interpreter + effect system (실행 시 사용)

[Experimental Path]
  self-host compiler (FUTURE — not implemented yet)
```

### 2.2 실행 항목

1. `/tmp/build-p18.js`의 esbuild 설정을 `scripts/build.js`로 흡수
2. minify=**false** (현실 산출물 보존, fx 48038줄 unminified 유지)
3. `/tmp/build-p18.js` 폐기
4. esbuild는 devDependency로 정식 인정 (이미 `^0.28.0` 존재)
5. 메모리 정정 3건 + 신규 `docs/BUILD-SYSTEM.md` 1건
6. self-host는 build system에서 제거 — future label만 `docs/BUILD-SYSTEM.md`에 유지

### 2.3 거부된 대안

- **B안 (self-host 진화 로드맵)**: stage1.js는 432줄 runtime helpers. bootstrap.js 컴파일러로 진화시키려면 stage2 신규 작업 — P1 범위 초과
- **C안 (이원화 명시)**: 모순 고정 + 장기 부채 누적

## 3. 구현 계획 (5 commits)

| Commit | 범위 | 검증 |
|--------|------|------|
| **BP-1** | `docs/PLAN-build-pipeline-unify.md` (본 문서) — DESK `t_1779346120945` 트레이스 시작 | 문서 존재 |
| **BP-2** | `docs/BUILD-SYSTEM.md` 신규 — 3-track 구조 + self-host future label | markdown 가독 |
| **BP-3** | `scripts/build.js` esbuild 복원 — /tmp/build-p18.js 흡수, minify=false, 기존 `extractSignatures` / `gen-ai-prompt` / alias lint 보존 | `node scripts/build.js` 실행 성공 |
| **BP-4** | bootstrap.js 재생성 + size/header 검증 | size 1.7~1.9MB, `__create` 시그니처 유지 |
| **BP-5** | `npm run test:fast` 회귀 — 1192+ PASS | jest 결과 |

### Success criteria
- `scripts/build.js` 실행만으로 bootstrap.js 정상 재생성
- `/tmp/build-p18.js` 의존 제거 — repo 외부 스크립트 0
- test:fast 1192+ PASS (회귀 0)
- 메모리 정정 3건 갱신 후 인수인계 노트와 일관

## 4. 11절 규칙 매핑

| 절 | 적용 |
|----|------|
| 1 — 순서 | 리서치(완료, 8주장 재검증) → 플랜(본 문서) → 태스크(`t_1779346120945`) → 구현 |
| 2 — 협의 | A안 + base/minify/DESK 등록 모두 사용자 승인 |
| 3 — Stage | BP-1~BP-5 단일 관심사. 실패 시 해당 commit reset |
| 4 — 품질 | `scripts/build.js` ≤ 150줄, tsc/eslint 경고 0 |
| 5 — 도구 | Edit/Write only (sed -i 금지) |
| 6 — 의존성 | 신규 npm 0 — esbuild는 이미 devDependency |
| 7 — 롤백 | 핫픽스 금지. 실패 시 해당 commit reset |
| 8 — 완료 | commit → gogs push → 블로그 (전체 작업 완료 후) |
| 9 — 태스크 | `t_1779346120945` 단계별 log (BP-1~BP-5) |
| 10 — 보안 | 빌드 스크립트는 토큰/평문 0, 환경변수 미사용 |
| 11 — 롤백 기준 | 검증 실패 2회 → 해당 commit reset, 3회째 협의 |

## 5. 작업 위치

- 워크트리: `/root/kim/freelang-v11-fx`
- 브랜치: `feature/build-pipeline-unify` (base 56b3f674)
- main worktree (`/root/kim/freelang-v11`): 미접촉
- background agent C8 taxonomy 작업 흐름 보존
- fx 워크트리의 기존 untracked 파일 (`src/runtime-*.ts`, `src/_stdlib-signatures.json`) 미접촉

## 6. 함정 알림

1. **stash pop 후 background agent 원복**: 변경 적용 → 즉시 add → 즉시 commit
2. **`/tmp/build-p18.js` 폐기**: BP-3 commit에 포함 또는 별도 cleanup commit
3. **bootstrap.js byte-identical 보장 없음**: esbuild 버전 차이 가능. size/header 호환 + test:fast PASS가 회귀 기준
4. **메모리 `bootstrap_js_from_ts.md` 정정 타이밍**: 전체 완료 후 일괄. 도중 자동 트리거 방지

## 7. 참조

- 인수인계: 메모리 `project_freelang_v11_handoff_2026-05-21.md` (P1 항목)
- baseline: 메모리 `project_freelang_v11_baseline.md`
- 정정 대상: 메모리 `feedback_bootstrap_js_from_ts.md` (31일 전, outdated)
- 정합: 메모리 `feedback_freelang_claims.md` (외부 npm 0 — esbuild는 dev 영향 없음)
- 관련 commit: `71a638ff Phase X-2: npm esbuild 제거 (부분 조치)`
- 양식 차용: `docs/PLAN-C8-effect-taxonomy.md`
