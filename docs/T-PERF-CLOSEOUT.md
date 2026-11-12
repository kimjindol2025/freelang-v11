# Self-compile performance closeout

## Status

**Deferred.** The shopping-mall and database work takes priority. This record
closes the current performance-investigation track without changing compiler
source, tests, timeouts, or runners.

## Measurements

| Investigation | Result |
|---|---|
| T-13 self-compile | 474.429 seconds; generated output SHA-256 was identical across the two recorded runs; peak RSS was about 277 MB under the CPU-profiled run. |
| T-15 lexer-only run | 10,772 tokens from `self/all.fl` in 21.481 seconds. |
| T-15 self-compile retry | The same self-compile command did not complete within 15 minutes. |

The approximately eight-minute T-13 result and the 15-minute-or-longer T-15
retry are materially different. Treat the available timing figures as evidence
of an **unstable measurement environment**, not as a reliable before/after
baseline for an optimization claim.

## Bottleneck candidates

| Status | Location | Evidence |
|---|---|---|
| Confirmed | `self/all.fl:60-64`, `self/all.fl:186-194`; `src/eval-builtins.ts:295` | The lexer adds each token with `append`; the runtime implementation copies the existing array. This makes token accumulation repeatedly copy the growing token list. |
| Confirmed | `src/interpreter.ts:1705-1708` | Each S-expression evaluation constructs four dispatch `Set` objects. This is a per-evaluation allocation on the CPU-profiled recursive interpreter path. |
| Likely | `self/all.fl:512-521`, `self/all.fl:600-608`, `self/all.fl:714-895` | Parser and code generator repeatedly use `append` and string accumulator concatenation. Their cost has not been isolated with a stable timing baseline. |

## T-3 tail-call check

The T-3 self-call branch at `src/eval-call-function.ts:146-148` was checked
without source changes. The non-tail-recursive program below returned `55`, as
expected:

```freelang
(defn f [n] (if (= n 0) 0 (+ n (f (- n 1)))))
(f 10)
```

This confirms only the tested result; it is not a broader proof of all
tail-call semantics.

## Resume order

1. Fix the measurement environment first: use the same machine and a known,
   stable background load.
2. Investigate the dispatch-set allocation at `src/interpreter.ts:1705-1708`
   first. It occurs for every evaluated S-expression and therefore has the
   strongest expected impact.
3. Then measure and address the lexer accumulation and parser/code-generator
   accumulation candidates separately.

## T-26 — T-21 기준 switch 수정 최종 확인

### 범위와 판정

- 판정: **T26=계속**. 지정 기준인 Jest 1,432개 통과, 실패 0개, 세 묶음 완료, 생성 결과 동일을 모두 충족했다.
- 시작 커밋: `2b70d9104c4e85cbaf714a04e5e7e1aa5609cf2f`, 가지: `perf/t26-on-t21`.
- 소스 수정 커밋: `b8e6a91c7a20c5749e40bb0d1a359e3eb459676d`.
- 측정 커밋: `df11f4e8f3f412baadebd27bd96135add97651ce`. 소스 수정 커밋과 interpreter 내용이 같고, 선택 사항으로 허용된 새 수동 측정 워크플로만 추가했다.
- T-21에는 이미 모듈 단위로 재사용하는 Set 4개가 있었다. 이를 문자열 switch 분기로 바꿨다. 이전 절의 식마다 Set을 생성한다는 설명은 이 기준 커밋에는 적용되지 않는다.
- T-24의 분기 방식만 적용하면서 T-21의 115개 연산 이름과 기존 처리 함수를 보존했다. 특히 T-24의 오래된 코드에는 없는 `fn-meta`, `check-arg-type`, `validate-args`를 유지했다.
- 기존 CI, 테스트, 기대값, 시간 제한, 실행기 및 다른 최적화는 변경하지 않았다. 로컬 테스트·자기 컴파일·속도 측정은 실행하지 않았다.

### 기존 GitHub 검사

[기존 검사 실행 43245679993](https://api.github.com/repositories/1215150205/actions/runs/43245679993)은 소스 수정 커밋에서 설정 변경 없이 실행하여 성공했다. 각 묶음의 Jest JSON 산출물을 직접 집계했다.

| 묶음 | 통과 | 실패 | 건너뜀 | todo | 완료 |
|---|---:|---:|---:|---:|---|
| 1 | 385 | 0 | 0 | 0 | 예 |
| 2 | 458 | 0 | 0 | 0 | 예 |
| 3 | 589 | 0 | 0 | 0 | 예 |
| 합계 | 1,432 | 0 | 0 | 0 | 모두 완료 |

새로 생긴 실패는 없다. Jest JSON 산출물의 SHA-256은 다음과 같다.

| 묶음 | 산출물 SHA-256 |
|---|---|
| 1 | `7c3bd9ea8530c465bc6bdfc51d3034ffb623447f04652c4b6c102ba98ad8b5a9` |
| 2 | `df4946ca8d04ab7bd156e463103541a2cb8ed1e25f3dc6e0c57ad2d80d85fbf5` |
| 3 | `1f2fc0e9c0b474a844dcd454ee84657d32068cb2f6e6184ed47ea0df81a3debb` |

### 같은 기계에서 새로 측정

[측정 실행 43245832692](https://api.github.com/repositories/1215150205/actions/runs/43245832692)에서 T-21 기준 코드와 수정 코드를 번갈아 세 번씩 실행했다. 새 `perf.yml`은 수동 실행만 허용한다. 설치·빌드는 시간 측정에서 제외하고, 같은 입력과 잠금 파일을 확인한 뒤 기존 bootstrap 진입점으로 자기 컴파일했다.

- CPU: AMD EPYC 9V45 96-Core Processor, 할당 CPU 4개, x86_64.
- 환경: Ubuntu 24.04, Node v24.22.2.
- 순서: 기준 → 수정 → 기준 → 수정 → 기준 → 수정.

| 코드 | 1회(초) | 2회(초) | 3회(초) | 평균(초) | 최대 RSS(KiB) |
|---|---:|---:|---:|---:|---:|
| T-21 기준 | 8.52 | 8.31 | 8.30 | 8.3767 | 461148 |
| switch 수정 | 9.00 | 8.63 | 8.72 | 8.7833 | 436004 |

개선율 `(기준 평균 - 수정 평균) / 기준 평균 × 100`은 **-4.85%**다. 이번 측정에서는 수정 후 약 4.85% 느렸다. T-21 대비 속도 개선은 확인되지 않았다. 세 번의 측정만으로 일반적인 성능 차이를 확정하지 않는다.

여섯 번의 컴파일은 모두 성공했고 생성 파일은 `cmp`로 바이트 단위 동일함을 확인했다. 여섯 파일의 SHA-256은 모두 다음과 같다.

`f6e0932faea007d4d95e4f6953d6174d31d94c19dda6f615510537d2b70d38b8`

이는 해당 입력에 대한 생성 결과 동등성 확인이며, 모든 프로그램의 실행 의미 동등성을 증명한 것은 아니다.

측정 산출물 검증용 SHA-256:

| 산출물 | SHA-256 |
|---|---|
| measurements.tsv | `d25f2d46117967afacd27ef685e089eb311fd6680329652588ff45dd22cc30d9` |
| environment.txt | `adc1298e69d22fab2384bb9482a05596bc94982a3c0afadd6ae4e7d37df3925c` |
| equality.txt | `0ac3965dce07acbf86717e4baec8e2ffc8f9e3c8ece0a609c528d2f79762eccd` |

### 과거 측정과의 구분

T-24의 42.82초 → 16.24초, 약 62.07% 개선은 [과거 측정 실행 43228391427](https://api.github.com/repositories/1215150205/actions/runs/43228391427)의 인용이다. 그 비교는 T-21과 다른 기준 코드 및 CPU에서 수행됐다. 이미 Set을 재사용하는 T-21에 대한 추가 62% 개선으로 해석할 수 없다. 이번에 확정한 것은 기존 검사 전부 통과와 생성 결과 동일이며, T-21 대비 속도 개선 주장은 하지 않는다.

변경 파일: `interpreter.ts`, 새 `perf.yml`, 이 문서 `T-PERF-CLOSEOUT.md`. 다른 가지의 워크플로·문서는 가져오지 않았다.
