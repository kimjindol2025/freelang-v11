# FreeLang v11-1: Layer Mapping (아키텍처 분류표)

## 개요

프로젝트 구조를 5계층 아키텍처에 따라 분류.
각 계층의 역할과 현재 포함된 파일을 명시.

---

## Layer 4: Core (언어 의미론)

**목표**: 작고 안정적인 언어 엔진
**포함 원칙**: 언어 의미론에만 필수적인 것

### 파서 & 렉서
- `lexer.ts` — 토크나이저
- `token.ts` — 토큰 타입
- `parser.ts` — AST 생성
- `ast.ts` — AST 노드 타입
- `ast-helpers.ts` — AST 유틸

### 인터프리터
- `interpreter.ts` — 메인 인터프리터 (2,367줄)
- `interpreter-context.ts` — 컨텍스트
- `interpreter-scope.ts` — 렉시컬 스코프
- `eval-call-function.ts` — 함수 호출
- `eval-special-forms.ts` — 특수 폼 (if, let, defn, try-catch)
- `eval-pattern-match.ts` — 패턴 매칭
- `eval-module-system.ts` — 모듈 로드

### 타입 & 검증
- `type-system.ts` — 타입 정의
- `type-checker.ts` — 타입 체크
- `type-inference.ts` — 타입 추론
- `protocol.ts` — 프로토콜 시스템

### 런타임 기본
- `async-runtime.ts` — 비동기 런타임
- `runtime-entry.ts` — 런타임 진입
- `errors.ts` — 에러 타입
- `effect-enforcer.ts` — 이펙트 강제
- `return-signal.ts` — 반환 시그널

### 컴파일 & 최적화
- `compiler.ts` — 컴파일 진입
- `codegen-js.ts` — JS 코드생성
- `optimizer.ts` — 최적화
- `tco.ts` — 꼬리재귀 최적화

**파일 수**: ~35개
**목표 크기**: ~3MB (bootstrap.js)
**의존성**: 최소 (stdlib만)

---

## Layer 2: StdLib (범용 유틸)

**목표**: 자주 쓰이고, 언어 기능 자체는 아닌 것
**포함 원칙**: 재사용 가능한 함수/모듈

### 기본 유틸
- `stdlib-loader.ts` — StdLib 로더
- `stdlib-types.ts` — 기본 타입 (maybe, result)
- `stdlib-helpers.ts` — 공통 헬퍼
- `stdlib-error.ts` — 에러 처리

### 컬렉션
- `stdlib-collection.ts` — list/map 유틸
- `lazy-seq.ts` — 지연 시퀀스
- `immutable.ts` — 불변 컬렉션

### 데이터
- `stdlib-text-processor.ts` — 문자열 처리
- `stdlib-data.ts` — 데이터 유틸
- `stdlib-json` — JSON (stdlib-types 내)
- `stdlib-table.ts` — 테이블 포매팅

### 시간 & 수학
- `stdlib-time.ts` — 시간 함수
- `stdlib-math.ts` — 수학 (FL 구현)
- `stdlib-stats.ts` — 통계

### 검증 & 테스트
- `stdlib-validation.ts` — 입력 검증
- `stdlib-test.ts` — 테스트 유틸
- `stdlib-optional.ts` — Optional 타입

**파일 수**: ~20개
**특징**: Core 없이도 독립적으로 사용 가능

---

## Layer 3: Extensions (도메인 기능)

**목표**: 특정 도메인(web, db, agent, etc)의 확장팩
**포함 원칙**: Core는 몰라도 되지만, 도메인에서 필요한 것

### HTTP & Web
- `stdlib-http.ts` — HTTP 클라이언트
- `stdlib-http-server.ts` — HTTP 서버 (1,268줄)
- `http-server-runner.ts` — 서버 런너

### 데이터베이스
- `stdlib-db.ts` — DB 추상화
- `stdlib-db-query.ts` — 쿼리 빌더
- `stdlib-pg.ts` — PostgreSQL
- `stdlib-mariadb.ts` — MariaDB (672줄)
- `stdlib-mongodb.ts` — MongoDB
- `stdlib-orm.ts` — ORM

### 에이전트 & 워크플로우
- `stdlib-workflow.ts` — 워크플로우 (950줄)
- `stdlib-agent.ts` — 에이전트
- `agent.ts` — 에이전트 런타임
- `agent-chain.ts` — 에이전트 체인
- `multi-agent.ts` — 멀티 에이전트

### AI & 통합
- `stdlib-ai.ts` — AI 통합
- `stdlib-ai-native.ts` — AI-Native 패턴
- `stdlib-ai-workflow.ts` — AI 워크플로우

### 통신 & 메시징
- `stdlib-ws.ts` — WebSocket
- `stdlib-wsc.ts` — WebSocket 클라이언트
- `stdlib-pubsub.ts` — Pub/Sub
- `stdlib-channel.ts` — 채널
- `stdlib-queue-helpers.ts` — 큐

### 보안 & 인증
- `stdlib-crypto.ts` — 암호화
- `stdlib-crypto-rsa.ts` — RSA
- `stdlib-auth.ts` — 인증
- `stdlib-webauthn.ts` — WebAuthn
- `stdlib-totp.ts` — TOTP

### 기타
- `stdlib-cache.ts` — 캐싱
- `stdlib-shell.ts` — 셸 명령
- `stdlib-process.ts` — 프로세스
- `stdlib-mail.ts` — 메일
- `stdlib-feed.ts` — 피드
- `stdlib-rest-crud.ts` — REST CRUD
- `stdlib-middleware.ts` — 미들웨어

**파일 수**: ~30개
**특징**: 도메인별 독립적, Core와 분리

---

## Layer 5: Experiments (불안정, 자주 변경)

**목표**: 아직 안정화 전이거나 연구용 기능
**위치**: `src/experiments/`
**포함 원칙**: 베타 단계, 자주 API 변경

### Phase 121-130: Consensus & Multi-Agent
- `consensus.ts`, `delegate.ts`, `vote.ts`, `negotiate.ts`
- `swarm.ts`, `orchestrate.ts`, `peer-review.ts`
- `compete.ts`, `chain-agents.ts`, `multi-agent-hub.ts`

### Phase 131-140: Evolution & Self-Improvement
- `evolve.ts`, `mutate.ts`, `crossover.ts`, `fitness.ts`
- `generation.ts`, `prune.ts`, `benchmark-self.ts`
- `refactor-self.ts`, `version-self.ts`, `self-evolution-hub.ts`

### Phase 141-149: High-Order AI Reasoning
- `world-model.ts`, `causal.ts`, `counterfactual.ts`, `predict.ts`
- `align.ts`, `ethics-check.ts`, `curiosity.ts`, `wisdom.ts`, `explain.ts`

### Phase 113-120: Foundation Reasoning
- `debate.ts`, `checkpoint.ts`, `meta-reason.ts`, `belief.ts`
- `analogy.ts`, `critique.ts`, `compose-reason.ts`, `cognitive.ts`

### Wrappers & Support
- `eval-phase150.ts` — Phase 150 래퍼 (실험)
- `freelang-v9-complete.ts` — 통합 시스템

**파일 수**: 38개 모듈 + 36개 테스트
**특징**: 독립적 진화, Core와 격리

---

## Layer 1: Temporary (임시/호환성)

**목표**: 급하게 막힌 기능을 여기 넣고 나중에 정리
**위치**: `src/compat/`, `src/temp/` (아직 미정의)
**포함 원칙**: 임시, 호환성, 스크래치

**현재 상태**: 미정의 (필요시 생성)

---

## 의존성 방향 (일방향)

```
Temp → StdLib → Extensions ↘
                           → Core (의존 X)
Experiments (격리, 별도 위임)
```

- **Core**: 아무것도 import X (스스로 완결)
- **Extensions**: StdLib + Core만 import
- **StdLib**: 서로 import 가능 (내부 의존)
- **Experiments**: eval-builtins-experiments.ts를 통해 lazy 위임
- **Temporary**: 필요한 것 자유 import (정리 대기)

---

## 빌드 & 배포

### bootstrap.js 크기 분해 (현재)
- Core: ~1.2MB (interpreter, parser, evaluator)
- StdLib: ~200KB (기본 유틸)
- Extensions: ~200KB (HTTP, DB, workflow)
- Experiments: ~800KB (AI 추론 모듈 — eval-builtins-ai.ts로 lazy 로드됨)
- **총**: ~1.6MB

### 최적화 목표
- Core 안정화: <1MB
- Extensions 선택적 로드: on-demand import
- Experiments 분리: 별도 번들 고려
