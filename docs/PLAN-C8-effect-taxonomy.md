# PLAN — C8: Effect Taxonomy Normalization

**Date**: 2026-05-21
**Branch**: `feature/effect-taxonomy`
**Base**: `8a5ded96` (fx worktree, `feature/effect-enforcement` frozen release)
**Task**: `t_1779339704348` (tasks.dclub.kr)
**SPEC node**: `task-effect-taxonomy` in `SPEC.airc`

> 본 PLAN.md는 11절 코딩규칙 1절 (문서화) 충족용. 결정·근거·alias_table 등 권위 정의는 `SPEC.airc`의 `dec-011` / `task-effect-taxonomy` 노드가 단일 출처. 본 문서는 그 사본·요약이 아니라 인덱스다.

## 1. 문제

`EFFECT_CATALOG` (L0, `eval-special-forms.ts:88`) 와 `BUILTIN_EFFECTS` (L1, `builtin-effects.ts`) 가 두 개의 평행 어휘 체계로 운영되고 있다:

- **L0** 10종: `http`, `file-read`, `file-write`, `db-read`, `db-write`, `shell`, `io`, `time`, `random`, `server`
- **L1** 6종: `pure`, `io`, `net`, `process`, `time`, `random`

mismatch 사례:
- 어휘 차이: `http-get` → L0=`http` vs L1=`net`
- 세분화 차이: `file-read/write` → L0 분리 vs L1 `io` 통합
- 함수명 분기: `db-exec`(L1만) vs `db-execute`(L0만), `rand`(L1만) vs `random`(L0만)
- L0 hole: `file-append-line`, `db-transaction`, `ws-send`, `process-spawn`, `now-ms`, `sleep`, `uuid` (L1에는 있고 L0에는 없음)

drift 누적 시 enforcement 의미가 흔들리고 dec-005 (6종 어휘 lock) 도 운영상 무력화된다.

## 2. 결정 (B안 — 사용자 승인 2026-05-21)

`dec-011` LOCK:
- **L0** (EFFECT_CATALOG) = **compatibility-only taxonomy, non-authoritative**
- **L1** (BUILTIN_EFFECTS + EffectTag) = **canonical effect enforcement source of truth**

alias_table (`L0 → L1`):
```
http       → net
file-read  → io
file-write → io
db-read    → io
db-write   → io
shell      → process
server     → net
io         → io
time       → time
random     → random
```

### 운영 원칙
1. 신규 effect 는 L1 에서 먼저 흡수, L0 는 alias 만 추가
2. L0 확장 (세분화 어휘 추가) 금지 — graveyard `:db/:gpu/:fs-*` `final:true` 승격으로 확정
3. 함수명 차이는 L0 catalog 확장으로 흡수, L1 영향 없음 (`db-exec=db-write`, `rand=random`)
4. `ws-send` 는 L0=`http` 로 흡수 (L1=`net` 도달), 신규 카테고리 금지

### 거부된 대안
- **A안 — L0 확장**: graveyard 경고 "taxonomy explosion → enforcement dilution" 위반
- **C안 — bidirectional bridge**: MVP 단계 과설계

## 3. 구현 계획 (4 commits)

| Commit | 범위 | 검증 |
|--------|------|------|
| **C8-1** ✅ | `SPEC.airc` 갱신 — `hot`, `dec-011` LOCK, graveyard final, lock 배열, task 노드 | `python3 -c "json.load(...)"` PASS |
| **C8-2** | `src/effect-aliases.ts` 신규 — `toCanonical(l0: string): EffectTag` 1함수 | unit test 1종 (10 alias entry 망라) |
| **C8-3** | `src/eval-special-forms.ts` EFFECT_CATALOG hole 보강 — 7건 + 함수명 alias 2건 | catalog ⊇ BUILTIN_EFFECTS keys 확인 |
| **C8-4** | `src/__tests__/effect-taxonomy-consistency.test.ts` 신규 — drift 회귀 차단 | jest 1192+ PASS |

### Success criteria
- `BUILTIN_EFFECTS` 전 키에 대해 L0 catalog 등록 보장 (hole 0)
- `toCanonical(EFFECT_CATALOG[name]) ⊆ BUILTIN_EFFECTS[name]` 의 EffectTag set (consistency)
- jest 1192+ PASS (회귀 0)
- bootstrap.js SHA 무관 (dec-010 `scope_out`)

## 4. 11절 규칙 매핑

| 절 | 적용 |
|----|------|
| 1 — 순서 | 리서치(SPEC.airc/builtin-effects.ts 정독) → 플랜(본 문서) → 태스크(`t_1779339704348`) → 구현 |
| 2 — 협의 | B 선택지 + dec-011 LOCK + ws-send 분류 사용자 승인 |
| 3 — Stage | C8-1~C8-4 단일 관심사. 실패 시 해당 commit 만 재시작 |
| 4 — 품질 | `effect-aliases.ts` ≤ 100줄 예상, tsc 경고 0 |
| 5 — 도구 | Edit/Write only |
| 6 — 의존성 | 신규 npm 0 |
| 7 — 롤백 | 핫픽스 금지. 실패 시 해당 commit `git reset` |
| 8 — 완료 | commit → gogs push → 블로그 (커밋·Stage 단위) |
| 9 — 태스크 | `t_1779339704348` 단계별 log |
| 10 — 보안 | SPEC·TS 텍스트만, 토큰·평문 없음 |
| 11 — 롤백 기준 | 검증 실패 2회 시 git reset, 3회째는 협의 |

## 5. 작업 위치

- 워크트리: `/root/kim/freelang-v11-fx`
- 브랜치: `feature/effect-taxonomy`
- master 디렉토리 (`/root/kim/freelang-v11`) 미접촉 — 백그라운드 에이전트 작업 흐름 보존
- fx 워크트리 자체의 untracked·M 파일들 (`runtime-*.ts`, `_stdlib-signatures.json`) 도 미접촉 — 커밋에 미포함

## 6. 참조

- `SPEC.airc` — `dec-005` (6종 어휘 lock), `dec-007` (단일 gate), `dec-010` (bootstrap out-of-scope), `dec-011` (본 작업의 LOCK), `arch-l0-l1-layers` (2-layer 보존)
- `docs/DESIGN-EFFECT-ENFORCEMENT.md` — Effect Enforcement MVP 설계
- 메모리: `project_effect_enforcement_done.md` — 9-commit frozen release 상태
