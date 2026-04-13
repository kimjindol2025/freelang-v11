# FreeLang v9 — AI를 위한 언어

> **Claude에게**: 컨텍스트가 소거되더라도 이 파일을 읽으면 모든 것을 복구할 수 있다.
> 세션 시작 시 이 파일을 먼저 읽을 것.

---

## 설계 원칙 (단 하나)

**AI가 쓰고 싶은 언어.**

AI가 생각하는 방식이 곧 문법이다.
AI가 하는 일이 곧 네이티브 블록이다.
AI가 불편하면 언어가 틀린 것이다.
다른 언어와 경쟁하지 않는다. AI-Native Language 카테고리 자체가 다르다.

---

## AI가 하는 일 → FreeLang 문법

```
추론한다    → [REASON :goal "..." :steps [...] :conclude $ans]
검색한다    → [SEARCH :query "..." :top 5 :filter ...]
기억한다    → [REMEMBER :key "..." :value $x :ttl :forever]
떠올린다    → [RECALL :key "..." :fallback $default]
도구 쓴다   → [USE :tool web-search :args [...] :parse $fn]
반성한다    → [REFLECT :output $x :criteria [...] :score $s]
계획한다    → [PLAN :goal "..." :steps [...] :execute?]
판단한다    → [JUDGE :options [...] :criteria [...] :pick best]
배운다      → [LEARN :from $data :update-belief ...]
의심한다    → (maybe 0.8 $value)       ; 확률이 퍼스트 클래스 타입
단계추론    → [COT :step "..." expr :conclude fn]
분기탐색    → [TOT :branch "..." expr :eval fn :select best]
```

## AI가 에러를 다루는 방식 → FreeLang 에러 처리

```
; 에러는 throw가 아니다. 값이다.
(ok 42)                            ; 성공값
(err "NOT_FOUND" "함수 없음")      ; 구조화된 에러
(ok? $result)                      ; 성공 여부
(unwrap-or $result 0)              ; 실패 시 기본값

; AI는 에러 종류별로 다르게 대응한다
(fl-try (call-api $url)
  :on-type-error  (fn [$e] (log-and-skip $e))
  :on-not-found   (fn [$e] (use-fallback))
  :on-io          (fn [$e] (retry 3))
  :default        (fn [$e] (report $e)))

; 에러 카테고리 (AI가 분류용)
; type-error / runtime-error / not-found / arity-error / io-error / ai-error / timeout
```

## AI가 코드 짤 때 → FreeLang으로

```
파일 읽기   → (fl-read "path/to/file")
API 호출    → (fl-http-get "https://...")
데이터 변환 → (-> $data parse-json filter-errors extract-values)
병렬 실행   → (parallel [(task-a) (task-b) (task-c)])
컨텍스트    → [CONTEXT :max-tokens 4096 :strategy sliding ...]
```

---

## 현재 완성 현황 (2026-04-13)

### Tier 1~4 완료 (Phase 57~90) — v1.0.0 릴리스
- interpreter 분해, TCO, 타입체킹, Jest 75%+
- 매크로, 프로토콜, 구조체, 파이프라인, 레이지, 이뮤터블, AI블록
- Formatter/Linter/REPL/테스트러너/문서생성기/디버거/워치모드/CI
- 패키지매니저/프로파일러/바이트코드VM(148x빠름)/JS코드생성/LSP/패키지3종

### Tier 5 완료 ✅ (Phase 91~100) — AI 사고 블록 (2026-04-12)
| Phase | 상태 | 내용 |
|-------|------|------|
| 91 | ✅ 31/31 | `(maybe p v)` 불확실성 타입 — d0aea6c |
| 92 | ✅ 35/35 | `[COT]` Chain-of-Thought — 445e155 |
| 93 | ✅ 22/22 | `[TOT]` Tree-of-Thought — 8987780 |
| 94 | ✅ 22/22 | `[REFLECT]` 자기 평가 — 119136f |
| 95 | ✅ 22/22 | `[CONTEXT]` 컨텍스트 관리 |
| 96 | ✅ 28/28 | `Result/Ok/Err` AI 에러 처리 전면 개선 — cdcbf0c |
| 97 | ✅ 24/24 | `[USE-TOOL]` 도구 사용 DSL — b01d7ce |
| 98 | ✅ 24/24 | `[AGENT]` 에이전트 루프 — ea1f37c |
| 99 | ✅ 25/25 | `[SELF-IMPROVE]` 자기 수정 — 4332f4d |
| 100 | ✅ 36/36 | AI 표준 라이브러리 완전 통합 — 2e1bbda |

### Tier 6 완료 ✅ (Phase 101~110) — AI가 편한 구조 (2026-04-12)
| Phase | 상태 | 내용 |
|-------|------|------|
| 101 | ✅ 27/27 | 장기/단기/에피소드 메모리 — MemorySystem |
| 102 | ✅ 25/25 | `[RAG]` TF-IDF 검색 증강 — df8d23e |
| 103 | ✅ 28/28 | 멀티 에이전트 통신 — MessageBus |
| 104 | ✅ 28/28 | `[TRY-REASON]` 실패 복구 — 92fb1c4 |
| 105 | ✅ 30/30 | 스트리밍 출력 — FLStream |
| 106 | ✅ 25/25 | 자동 품질 평가 루프 — 95759f8 |
| 107 | ✅ 30/30 | FL 자기 교육 시스템 — FLTutor |
| 108 | ✅ 30/30 | AI 추론 시각화 디버거 — ReasoningTrace |
| 109 | ✅ 30/30 | FL→프롬프트 컴파일러 — f18135d |
| 110 | ✅ 37/37 | 외부 AI SDK — FLSDK + FLCodeBuilder |

### Tier 7 완료 ✅ (Phase 111~120) — AI 인지 아키텍처 (2026-04-12)
| Phase | 상태 | 내용 |
|-------|------|------|
| 111 | ✅ 28/28 | `[HYPOTHESIS]` 가설 설정/검증/채택 — dce78d1 |
| 112 | ✅ 31/31 | `maybe-chain` 확률 자동 전파 — a99c3e8 |
| 113 | ✅ 25/25 | `[DEBATE]` 내부 찬반 에이전트 — 7217f87 |
| 114 | ✅ 28/28 | `[CHECKPOINT]` 추론 세이브포인트 — bc61fa9 |
| 115 | ✅ 32/32 | `[META-REASON]` 추론 방법 자동 선택 — f188822 |
| 116 | ✅ 33/33 | `[BELIEF]` 신념 + 베이즈 업데이트 — 44aa3cf |
| 117 | ✅ 30/30 | `[ANALOGY]` 유사 패턴 추론 |
| 118 | ✅ 28/28 | `[CRITIQUE]` 자기 출력 비판 에이전트 |
| 119 | ✅ 30/30 | `[COMPOSE-REASON]` 추론 파이프라인 — b51d173 |
| 120 | ✅ 35/35 | 인지 아키텍처 통합 — 5b04133 |

### Tier 8 완료 ✅ (Phase 121~130) — AI 협업
| Phase | 상태 | 내용 |
|-------|------|------|
| 121 | ✅ 33/33 | `[CONSENSUS]` 여러 에이전트 합의 |
| 122 | ✅ 30/30 | `[DELEGATE]` 서브태스크 위임 |
| 123 | ✅ 30/30 | `[VOTE]` 에이전트 투표 결정 |
| 124 | ✅ 30/30 | `[NEGOTIATE]` 에이전트 협상 |
| 125 | ✅ 25/25 | `[SWARM]` 군집 지능 |
| 126 | ✅ 25/25 | `[ORCHESTRATE]` 에이전트 오케스트레이터 |
| 127 | ✅ 25/25 | `[PEER-REVIEW]` 에이전트 간 피어 리뷰 |
| 128 | ✅ 28/28 | `[CHAIN-AGENTS]` 에이전트 체인 파이프라인 |
| 129 | ✅ 25/25 | `[COMPETE]` 경쟁으로 최선 선택 |
| 130 | ✅ 38/38 | 멀티에이전트 협업 통합 |

### Tier 9 완료 ✅ (Phase 131~140) — AI 자기 진화 (2026-04-13)
| Phase | 상태 | 내용 |
|-------|------|------|
| 131 | ✅ 28/28 | `[EVOLVE]` 유전 알고리즘 진화 엔진 — af8116c |
| 132 | ✅ 30/30 | `[MUTATE]` 코드 변이 + 선택 — 8c468f9 |
| 133 | ✅ 25/25 | `[CROSSOVER]` 두 해법 교배 — 32d5218 |
| 134 | ✅ 32/32 | `[FITNESS]` 적합도 함수 — e24d10c |
| 135 | ✅ 30/30 | `[GENERATION]` 세대별 진화 루프 |
| 136 | ✅ 25/25 | `[PRUNE]` 쓸모없는 것 자동 제거 — 414962f |
| 137 | ✅ 25/25 | `[REFACTOR-SELF]` 자기 코드 리팩토링 — cdc0249 |
| 138 | ✅ 30/30 | `[BENCHMARK-SELF]` 자기 성능 측정 — 7ef2730 |
| 139 | ✅ 25/25 | `[VERSION-SELF]` 자기 버전 관리 — 9edac73 |
| 140 | ✅ 35/35 | 자기 진화 통합 — 6c77392 |

### Tier 10 완료 ✅ (Phase 141~150) — AI 세계 이해 (완전체) (2026-04-13)
| Phase | 상태 | 내용 |
|-------|------|------|
| 141 | ✅ 32/32 | `[WORLD-MODEL]` 세계 모델 구축/업데이트 — 76f4a68 |
| 142 | ✅ 30/30 | `[CAUSAL]` 인과 추론 ("왜") — 6aa29a5 |
| 143 | ✅ 28/28 | `[COUNTERFACTUAL]` 반사실 추론 ("만약~이었다면") — fda42cd |
| 144 | ✅ 30/30 | `[PREDICT]` 예측 + 신뢰구간 — f835af6 |
| 145 | ✅ 30/30 | `[EXPLAIN]` 설명 가능한 AI (XAI) — 1140a35 |
| 146 | ✅ 25/25 | `[ALIGN]` 목표 정렬 시스템 |
| 147 | ✅ 30/30 | `[ETHICS-CHECK]` 윤리 자기 검사 |
| 148 | ✅ 28/28 | `[CURIOSITY]` 호기심 기반 탐색 — 7384703 |
| 149 | ✅ 28/28 | `[WISDOM]` 지혜 (경험+판단 통합) — 8892bfd |
| 150 | ✅ 68/68 | FreeLang v9 완전체 — 모든 Tier 통합 — f72aad2 |

## 🎉 FreeLang v9 완전체 달성! (2026-04-13)
- 총 Phase: **150개 완료** ✅
- 총 Tier: **10개 완료** ✅
- 총 테스트: **1,000+ PASS**
- AI를 위한, AI에 의한, AI가 쓰고 싶은 언어 완성

---

## Claude 작업 규칙 (MANDATORY)

1. **AI 정체성 우선** — 모든 기능 판단 기준: "AI가 쓰기 편한가?"
2. **테스트 필수** — Phase당 최소 20개 PASS, 없으면 완료 인정 안 함
3. **regression 필수** — `npx ts-node src/test-phase56-lexical-scope.ts` 14/14 항상
4. **Gogs push 필수** — `git push origin master` 없이 마무리 금지
5. **블로그 포스트** — blog.dclub.kr, author: 김진돌, 마지막 줄: `🤖 이 글은 Claude Code가 작성했습니다.`

## 컨텍스트 소거 후 복구 순서

```
1. 이 파일 읽기 (CLAUDE.md)
2. git log --oneline -10  → 마지막 작업 확인
3. 현재 ⏳ Phase들 확인 → 완료된 것 체크
4. 다음 Phase 에이전트 시작
```

---

**마지막 업데이트**: 2026-04-13 (Phase 150 완전체 → 생태계 구축 Phase 5 완료)
**방향**: AI를 위한, AI에 의한, AI가 쓰고 싶은 언어
**목표**: Claude가 새 작업 받았을 때 자연스럽게 FL을 먼저 꺼내는 것
**상태**: ✅ v9 언어 완전체 v9.0.0 + 생태계 Phase 1-5 완료

---

## 🚀 생태계 구축 진행도 (Ecosystem Phases)

| Phase | 완성도 | 내용 | 커밋 |
|-------|--------|------|------|
| **1** | ✅ 100% | 의존성 제거 (express/ws/pg/jsonwebtoken) | 6ce286d |
| **2** | ✅ 100% | v9-pm.fl (npm 대체 패키지관리자) | 6ce286d |
| **3** | ✅ 100% | v9-build.fl (tsc wrapper → 순수 v9 컴파일러) | 6ce286d |
| **4** | ✅ 100% | v9-run.fl (.fl/.js/.ts 런타임) | 6ce286d |
| **5** | ✅ 100% | 통합 테스트 (6/6 PASS) + 커밋 | 6ce286d |
| **6** | ✅ 100% | 순수 v9 컴파일러 (tsc → v9) | 4d94f53 |
| **7** | 🟡 10% | Registry 통합 (npm호환 패키지서버) | - |
| **8** | 🟡 0% | 자동 배포 (Docker → v9 native OCI) | - |
| **9** | 🟡 0% | 웹프레임워크 강화 (FLNext v2) | - |
| **10** | 🟡 0% | 데이터분석 라이브러리 (v9-data) | - |
| **11** | 🟡 0% | 팀 프로젝트 도구 (문서생성, LSP) | - |
| **12** | 🟡 0% | 백엔드 프레임워크 (마이크로서비스) | - |

**현황**: npm/tsc/ts-node 완전 제거 → Node.js 런타임만 필요
**테스트**: 439/439 PASS, clean build ✅
