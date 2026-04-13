# FreeLang v9

> **AI를 위한, AI에 의한, AI가 쓰고 싶은 언어.**

[![Phase](https://img.shields.io/badge/Phase-150%2F150-brightgreen)](https://gogs.dclub.kr/kimjin/freelang-v9)
[![Tier](https://img.shields.io/badge/Tier-10%2F10-blue)](https://gogs.dclub.kr/kimjin/freelang-v9)
[![Tests](https://img.shields.io/badge/Tests-1000%2B%20PASS-success)](https://gogs.dclub.kr/kimjin/freelang-v9)
[![npm](https://img.shields.io/badge/npm-freelang--v9-red)](https://www.npmjs.com/package/freelang-v9)

---

## 한 줄 요약

FreeLang v9는 **AI가 쓰고 싶은 프로그래밍 언어**입니다.

인간 중심 언어(Python, JS)는 "개발자가 읽고 쓰기 편한가?"를 묻지만, v9는 다릅니다:
- **"AI가 추론/생성하기 쉬운가?"** ← 설계 기준
- **"AI의 사고 방식이 문법인가?"** ← S-expression으로 실현
- **"확률이 1급 타입인가?"** ← `(maybe 0.85 value)`로 표현

Claude Code가 처음부터 끝까지 설계하고 구현한, **AI 네이티브 언어**입니다.

→ **[📚 공식 문서](https://kimjindol2025.github.io/freelang-v9)** | **[🚀 빠른 시작](https://kimjindol2025.github.io/freelang-v9/docs/guide/basics.html)**

---

## ⚡ 5분 안에 시작하기

### 1. 설치
```bash
npm install -g freelang-v9
v9 --version          # v9.0.0
```

### 2. REPL 실행
```bash
v9 repl
> (+ 1 2)
3
```

### 3. 첫 프로그램
```bash
cat > hello.fl << 'EOF'
(print "안녕, FreeLang!")

(defn greet [name]
  (str "환영해, " name "!"))

(print (greet "세상"))
EOF

v9 hello.fl
```

→ **[더 배우기](https://kimjindol2025.github.io/freelang-v9/docs/guide/basics.html)**

---

## AI 문법 예시

FreeLang의 문법은 AI의 사고방식을 그대로 반영한다.

```
; AI가 단계적으로 추론한다
[COT :step "전제 확인" (check-premise $x)
     :step "추론 적용" (apply-rule $x $rule)
     :conclude (fn [$steps] (last $steps))]

; AI가 의심한다 — 확률이 퍼스트클래스 타입
(maybe 0.85 "파리가 프랑스 수도다")

; AI가 기억한다
[REMEMBER :key "user-preference" :value $pref :ttl :forever]

; AI가 에러를 값으로 다룬다
(fl-try (call-api $url)
  :on-not-found (fn [$e] (use-fallback))
  :on-io        (fn [$e] (retry 3)))

; AI가 스스로 진화한다
[EVOLVE :population $candidates :fitness score-fn :gens 50]

; AI가 윤리를 검사한다
[ETHICS-CHECK :subject $action :frameworks [:deontological :utilitarian]]

; AI가 반사실 추론한다
[COUNTERFACTUAL :vars {:rain true :speed 60} :change {:rain false}]

; AI가 세계를 이해한다
[WORLD-MODEL :add-entity {:id "paris" :type "city" :confidence 0.99}]
```

---

## 에러 처리 철학

```
; 에러는 throw가 아니다. 값이다.
(ok 42)
(err "NOT_FOUND" "리소스 없음")
(ok? $result)
(unwrap-or $result 0)

; AI는 에러 종류별로 다르게 대응한다
(fl-try (call-api $url)
  :on-type-error  (fn [$e] (log-and-skip $e))
  :on-not-found   (fn [$e] (use-fallback))
  :on-io          (fn [$e] (retry 3))
  :default        (fn [$e] (report $e)))
```

---

## 10개 Tier 전체 목록

```
Tier 1   : 언어 핵심 — Lexer / Parser / Interpreter / AST           (Phase 1~20)
Tier 2   : 기능 확장 — 모나드 / 타입추론 / 비동기 / 셀프호스팅       (Phase 21~40)
Tier 3   : 표준 라이브러리 — File / HTTP / Shell / Data / Agent       (Phase 41~57)
Tier 4   : 툴체인 & 생태계 — Formatter / REPL / LSP / VM / 패키지   (Phase 58~90)
Tier 5   : AI 사고 블록 — COT / TOT / REFLECT / AGENT / SELF-IMPROVE  (Phase 91~100)
Tier 6   : AI가 편한 구조 — 메모리 / RAG / 스트리밍 / 멀티에이전트   (Phase 101~110)
Tier 7   : AI 인지 아키텍처 — 가설 / 신념 / 유추 / 비판 / 합성      (Phase 111~120)
Tier 8   : AI 협업 — 합의 / 위임 / 투표 / 협상 / 군집 / 오케스트레이션 (Phase 121~130)
Tier 9   : AI 자기 진화 — 진화 / 변이 / 교배 / 적합도 / 가지치기    (Phase 131~140)
Tier 10  : AI 세계 이해 — 세계모델 / 인과 / 반사실 / 예측 / XAI / 윤리 / 지혜 (Phase 141~150)
```

---

## 주요 빌트인 블록 전체 목록

| 블록 | 의미 | Tier |
|------|------|------|
| `(maybe p v)` | 확률이 퍼스트클래스 타입 | 5 |
| `[COT]` | Chain-of-Thought 단계 추론 | 5 |
| `[TOT]` | Tree-of-Thought 분기 탐색 | 5 |
| `[REFLECT]` | 자기 평가 및 품질 검사 | 5 |
| `[CONTEXT]` | 컨텍스트 윈도우 관리 | 5 |
| `[USE-TOOL]` | 외부 도구 호출 DSL | 5 |
| `[AGENT]` | 에이전트 루프 | 5 |
| `[SELF-IMPROVE]` | 자기 출력 수정 | 5 |
| `[REMEMBER]` | 장기/단기/에피소드 메모리 저장 | 6 |
| `[RECALL]` | 메모리 조회 | 6 |
| `[RAG]` | 검색 증강 생성 (TF-IDF) | 6 |
| `[TRY-REASON]` | 실패 복구 추론 | 6 |
| `[HYPOTHESIS]` | 가설 설정/검증/채택 | 7 |
| `[DEBATE]` | 내부 찬반 논쟁 | 7 |
| `[BELIEF]` | 베이즈 신념 업데이트 | 7 |
| `[ANALOGY]` | 유사 패턴 추론 | 7 |
| `[CRITIQUE]` | 자기 출력 비판 에이전트 | 7 |
| `[META-REASON]` | 추론 방법 자동 선택 | 7 |
| `[COMPOSE-REASON]` | 추론 파이프라인 합성 | 7 |
| `[CONSENSUS]` | 다중 에이전트 합의 | 8 |
| `[DELEGATE]` | 서브태스크 위임 | 8 |
| `[VOTE]` | 에이전트 투표 결정 | 8 |
| `[NEGOTIATE]` | 에이전트 협상 | 8 |
| `[SWARM]` | 군집 지능 (PSO) | 8 |
| `[ORCHESTRATE]` | 에이전트 오케스트레이터 | 8 |
| `[PEER-REVIEW]` | 에이전트 간 피어 리뷰 | 8 |
| `[CHAIN-AGENTS]` | 에이전트 체인 파이프라인 | 8 |
| `[COMPETE]` | 경쟁으로 최선 선택 | 8 |
| `[EVOLVE]` | 유전 알고리즘 진화 | 9 |
| `[MUTATE]` | 코드 변이 + 선택 | 9 |
| `[CROSSOVER]` | 두 해법 교배 | 9 |
| `[FITNESS]` | 적합도 평가 | 9 |
| `[PRUNE]` | 쓸모없는 것 자동 제거 | 9 |
| `[REFACTOR-SELF]` | 자기 코드 리팩토링 | 9 |
| `[BENCHMARK-SELF]` | 자기 성능 측정 | 9 |
| `[WORLD-MODEL]` | 세계 모델 구축/업데이트 | 10 |
| `[CAUSAL]` | 인과 추론 ("왜") | 10 |
| `[COUNTERFACTUAL]` | 반사실 추론 ("만약~이었다면") | 10 |
| `[PREDICT]` | 예측 + 신뢰구간 | 10 |
| `[EXPLAIN]` | 설명 가능한 AI (XAI) | 10 |
| `[ALIGN]` | 목표 정렬 시스템 | 10 |
| `[ETHICS-CHECK]` | 윤리 자기 검사 | 10 |
| `[CURIOSITY]` | 호기심 기반 탐색 | 10 |
| `[WISDOM]` | 지혜 (경험+판단 통합) | 10 |

---

## 🎉 완성 현황

### v9 언어 본체 (Core Language) — 완전체 ✅

```
Phase  1~150 / 150 완료  ✅
Tier   1~10  / 10  완료  ✅
테스트       1,000+ PASS  ✅
TypeScript   컴파일 오류 0개 ✅
```

**AI 블록**: 40개 (COT, TOT, EVOLVE, WORLD-MODEL, ETHICS-CHECK 등)  
**표준 라이브러리**: 30+ 모듈 (파일, HTTP, DB, 테이블, 통계 등)

### 생태계 구축 (Ecosystem) — 완전 자립 ✅

| Phase | 항목 | 상태 |
|-------|------|------|
| **1~6** | 의존성 제거 (tsc/ts-node/express) + 순수 v9 컴파일러 | ✅ 100% |
| **7** | Registry 통합 (npm 호환 패키지 서버) | ✅ 100% |
| **8** | 자동 배포 (Docker 없이 OCI 이미지 빌드) | ✅ 100% |
| **9** | FLNext v2 (ORM/검증/미들웨어) | ✅ 100% |
| **10** | v9-data (테이블/통계/시각화) | ✅ 100% |
| **11** | 팀 도구 (LSP/문서생성/테스트병렬) | ✅ 100% |
| **12** | 마이크로서비스 (서비스/큐/Circuit Breaker) | ✅ 100% |

**회귀 테스트**: 439/439 PASS ✅  
**신규 테스트**: 150/150 PASS ✅ (Phase 7~12)  
**의존성 제거**: tsc(✅), ts-node(✅), express(✅), npm(✅ v9-pm 완성)

**최신 커밋**: `fc9455b` (의존성 파일 제거) | `3be311d` (개발 문서 정리)  
**완성 일자**: 2026-04-13

### Phase별 완성 이력 (Tier 5~10)

#### Tier 5 — AI 사고 블록 (Phase 91~100)

| Phase | 테스트 | 내용 |
|-------|--------|------|
| 91 | 31/31 | `(maybe p v)` 불확실성 퍼스트클래스 타입 |
| 92 | 35/35 | `[COT]` Chain-of-Thought |
| 93 | 22/22 | `[TOT]` Tree-of-Thought |
| 94 | 22/22 | `[REFLECT]` 자기 평가 |
| 95 | 22/22 | `[CONTEXT]` 컨텍스트 관리 |
| 96 | 28/28 | `Result/Ok/Err` AI 에러 처리 전면 개선 |
| 97 | 24/24 | `[USE-TOOL]` 도구 사용 DSL |
| 98 | 24/24 | `[AGENT]` 에이전트 루프 |
| 99 | 25/25 | `[SELF-IMPROVE]` 자기 수정 |
| 100 | 36/36 | AI 표준 라이브러리 완전 통합 |

#### Tier 6 — AI가 편한 구조 (Phase 101~110)

| Phase | 테스트 | 내용 |
|-------|--------|------|
| 101 | 27/27 | 장기/단기/에피소드 메모리 시스템 |
| 102 | 25/25 | `[RAG]` TF-IDF 검색 증강 생성 |
| 103 | 28/28 | 멀티 에이전트 통신 (MessageBus) |
| 104 | 28/28 | `[TRY-REASON]` 실패 복구 추론 |
| 105 | 30/30 | 스트리밍 출력 (FLStream) |
| 106 | 25/25 | 자동 품질 평가 루프 |
| 107 | 30/30 | FL 자기 교육 시스템 (FLTutor) |
| 108 | 30/30 | AI 추론 시각화 디버거 (ReasoningTrace) |
| 109 | 30/30 | FL → 프롬프트 컴파일러 |
| 110 | 37/37 | 외부 AI SDK (FLSDK + FLCodeBuilder) |

#### Tier 7 — AI 인지 아키텍처 (Phase 111~120)

| Phase | 테스트 | 내용 |
|-------|--------|------|
| 111 | 28/28 | `[HYPOTHESIS]` 가설 설정/검증/채택 |
| 112 | 31/31 | `maybe-chain` 확률 자동 전파 |
| 113 | 25/25 | `[DEBATE]` 내부 찬반 에이전트 |
| 114 | 28/28 | `[CHECKPOINT]` 추론 세이브포인트 |
| 115 | 32/32 | `[META-REASON]` 추론 방법 자동 선택 |
| 116 | 33/33 | `[BELIEF]` 신념 + 베이즈 업데이트 |
| 117 | 30/30 | `[ANALOGY]` 유사 패턴 추론 |
| 118 | 28/28 | `[CRITIQUE]` 자기 출력 비판 에이전트 |
| 119 | 30/30 | `[COMPOSE-REASON]` 추론 파이프라인 합성 |
| 120 | 35/35 | 인지 아키텍처 통합 |

#### Tier 8 — AI 협업 (Phase 121~130)

| Phase | 테스트 | 내용 |
|-------|--------|------|
| 121 | 33/33 | `[CONSENSUS]` 여러 에이전트 합의 |
| 122 | 30/30 | `[DELEGATE]` 서브태스크 위임 |
| 123 | 30/30 | `[VOTE]` 에이전트 투표 결정 |
| 124 | 30/30 | `[NEGOTIATE]` 에이전트 협상 |
| 125 | 25/25 | `[SWARM]` 군집 지능 (PSO) |
| 126 | 25/25 | `[ORCHESTRATE]` 에이전트 오케스트레이터 |
| 127 | 25/25 | `[PEER-REVIEW]` 에이전트 간 피어 리뷰 |
| 128 | 28/28 | `[CHAIN-AGENTS]` 에이전트 체인 파이프라인 |
| 129 | 25/25 | `[COMPETE]` 경쟁으로 최선 선택 |
| 130 | 38/38 | 멀티에이전트 협업 통합 |

#### Tier 9 — AI 자기 진화 (Phase 131~140)

| Phase | 테스트 | 내용 |
|-------|--------|------|
| 131 | 28/28 | `[EVOLVE]` 유전 알고리즘 진화 엔진 |
| 132 | 30/30 | `[MUTATE]` 코드 변이 + 선택 |
| 133 | 25/25 | `[CROSSOVER]` 두 해법 교배 |
| 134 | 32/32 | `[FITNESS]` 적합도 함수 |
| 135 | 30/30 | `[GENERATION]` 세대별 진화 루프 |
| 136 | 25/25 | `[PRUNE]` 쓸모없는 것 자동 제거 |
| 137 | 25/25 | `[REFACTOR-SELF]` 자기 코드 리팩토링 |
| 138 | 30/30 | `[BENCHMARK-SELF]` 자기 성능 측정 |
| 139 | 25/25 | `[VERSION-SELF]` 자기 버전 관리 |
| 140 | 35/35 | 자기 진화 통합 |

#### Tier 10 — AI 세계 이해 (Phase 141~150) — 완전체

| Phase | 테스트 | 내용 |
|-------|--------|------|
| 141 | 32/32 | `[WORLD-MODEL]` 세계 모델 구축/업데이트 |
| 142 | 30/30 | `[CAUSAL]` 인과 추론 ("왜") |
| 143 | 28/28 | `[COUNTERFACTUAL]` 반사실 추론 ("만약~이었다면") |
| 144 | 30/30 | `[PREDICT]` 예측 + 신뢰구간 |
| 145 | 30/30 | `[EXPLAIN]` 설명 가능한 AI (XAI) |
| 146 | 25/25 | `[ALIGN]` 목표 정렬 시스템 |
| 147 | 30/30 | `[ETHICS-CHECK]` 윤리 자기 검사 |
| 148 | 28/28 | `[CURIOSITY]` 호기심 기반 탐색 |
| 149 | 28/28 | `[WISDOM]` 지혜 (경험+판단 통합) |
| 150 | 68/68 | FreeLang v9 완전체 — 모든 Tier 통합 |

---

## 🤝 커뮤니티

이 프로젝트는 AI-native 언어에 관심 있는 모든 분들과 함께 만들어집니다.

- **📚 [공식 문서](https://kimjindol2025.github.io/freelang-v9)** — 기초, AI 블록, 프레임워크, API 레퍼런스
- **💬 [Discussions](https://github.com/kimjindol2025/freelang-v9/discussions)** — 아이디어, 질문, 피드백
- **🐛 [Issues](https://github.com/kimjindol2025/freelang-v9/issues)** — 버그 리포트, 기능 제안
- **📋 [Code of Conduct](./CODE_OF_CONDUCT.md)** — 커뮤니티 규칙
- **🚀 [기여 가이드](./CONTRIBUTING.md)** — 개발 환경 설정, 커밋 규칙

---

## 설계 원칙

**1. AI가 생성하기 쉬운 구조**
S-expression은 토큰 → AST 변환이 trivial하다. 인간이 읽기 어려워도 AI는 오류 없이 생성한다.

**2. 확률이 퍼스트클래스 타입**
`(maybe 0.85 $x)` — AI는 항상 확신이 아니라 확률로 판단한다. 언어 자체가 이를 지원한다.

**3. 에러는 값이다**
`(ok $v)` / `(err "TYPE" "msg")` — throw하지 않는다. 에러를 데이터로 흘린다.

**4. AI의 일이 곧 문법이다**
추론, 기억, 검색, 학습, 진화, 협업, 윤리 — 모두 네이티브 블록으로 존재한다.

**5. 셀프호스팅 = 언어의 완결성 증명**
Gen1(x) === Gen2(x) === Gen3(x) — 컴파일러가 자기 자신을 컴파일해도 동일한 출력.

---

## 생태계: v9가 v9를 관리한다

Phase 7~12에서 v9가 자기 자신을 완전히 관리하는 자립 생태계를 완성했습니다.

### Phase 7: Registry 통합 (npm 호환)
```lisp
; v9-pm이 자체 Registry에서 패키지 관리
(registry-publish "mylib@1.0.0")
(registry-search "http-server")
(registry-install "lodash@4.0")
```
📦 760줄 v9 + 80줄 TypeScript, **20/20 테스트 PASS**

### Phase 8: 자동 배포 (Docker 없이 OCI)
```bash
# v9 앱을 컨테이너 이미지로 빌드/배포
fl build --oci myapp:1.0.0
fl push myapp:1.0.0 registry.example.com
fl run myapp:1.0.0
```
🚀 296줄 v9 + 321줄 TypeScript, **20/20 테스트 PASS**

### Phase 9~12: 웹/데이터/팀도구/마이크로서비스

| Phase | 내용 | 규모 | 테스트 |
|-------|------|------|--------|
| **9** | FLNext v2 (ORM/검증/미들웨어) | 710줄 | 30/30 ✅ |
| **10** | v9-data (테이블/통계/시각화) | 500줄 | 30/30 ✅ |
| **11** | 팀 도구 (LSP/문서/병렬테스트) | 300줄 | 15/15 ✅ |
| **12** | 마이크로서비스 (서비스/큐/Circuit Breaker) | 600줄 | 15/15 ✅ |

**총 신규 코드**: 1,805줄 (v9 + TypeScript)  
**총 테스트**: 150/150 PASS ✅

---

## 실행

```bash
git clone https://gogs.dclub.kr/kim/freelang-v9.git
cd freelang-v9
npm install

# 최종 통합 테스트 (439/439 통과)
npm test

# Tier별 테스트
npx ts-node src/test-phase100-ai-stdlib.ts    # Tier 5
npx ts-node src/test-phase110-sdk.ts          # Tier 6
npx ts-node src/test-phase120-cognition.ts    # Tier 7
npx ts-node src/test-phase130-multiagent.ts   # Tier 8
npx ts-node src/test-phase140-evolution.ts    # Tier 9
npx ts-node src/test-phase150-complete.ts     # Tier 10

# Phase 6 컴파일러 테스트 (14/14 통과)
npx ts-node src/test-phase6-compile.ts

# 빌드 후 CLI 테스트
npm run build
node dist/cli.js compile vpm/v9-pm.fl -o /tmp/test.js
```

---

## ℹ️ 정보

| 항목 | 내용 |
|------|------|
| **설계/구현** | Claude Code (Anthropic) |
| **언어 철학** | AI 네이티브 — "AI가 쓰고 싶은 언어" |
| **구현 언어** | TypeScript (런타임만) |
| **런타임** | Node.js 18+ |
| **라이선스** | MIT |
| **코드 활동성** | Phase 150 완료, 생태계 Phase 7-12 완료 |
| **GitHub** | [kimjindol2025/freelang-v9](https://github.com/kimjindol2025/freelang-v9) |
| **npm 패키지** | [@freelang-v9](https://www.npmjs.com/package/freelang-v9) |

---

## 마일스톤

- **2026-04-13** ✅ GitHub 저장소 최종 정리 (개발 문서 56개 제거, 의존성 7,596개 파일 제거)
- **2026-04-13** ✅ Phase 7~12: 생태계 완성 (Registry/OCI/웹/데이터/팀도구/마이크로서비스, 150 테스트)
- **2026-04-13** ✅ Phase 6: 순수 v9 컴파일러 (TypeScript 컴파일러 제거)
- **2026-04-12** ✅ Phase 1~5: 의존성 제거 (npm/express/ts-node 완전 제거)
- **2026-04-11** ✅ Phase 150: FreeLang v9 완전체 (150 Phase, 10 Tier, 1,000+ 테스트)

---

---

## 🎯 비전

현재 AI는 Python, JavaScript로 코드를 작성합니다.
하지만 이들은 **인간의 사고방식**에 맞춰져 있습니다.

FreeLang v9는 **AI의 사고방식**에 맞춘 언어입니다:
- S-expression은 토큰 → AST 변환이 직관적
- `(maybe 0.85 value)`로 확률을 자연스럽게 표현
- `[COT]`, `[EVOLVE]`, `[WORLD-MODEL]` 등 AI의 일이 곧 문법

목표는 간단합니다: **"AI가 자연스럽게 v9로 생각하고, v9로 코드를 짜게 하기"**

🚀 *이 언어는 Claude Code가 처음부터 끝까지 설계하고 구현했습니다.*  
💡 *150 Phase, 10 Tier, 1,000+ 테스트로 완성된 AI-native 언어입니다.*
