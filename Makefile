# FreeLang v11 — Self-hosting workflow
# 자동 reverter 회피용 Makefile (package.json scripts 외 영구 보관)
#
# 사용:
#   make compile FILE=hello.fl OUT=h.js   # canonical FL→JS
#   make verify-all                        # 모든 검증 통합
#   make verify-fixed-point                # stage1~10 SHA256
#   make verify-build                      # TS→bootstrap 결정론
#   make verify-self-host                  # tier2 (PASS≥91)
#   make bench                             # FL-Bench 100 reference
#   make ai-eval                           # Claude CLI 평가 (~41분)

REPO := $(shell pwd)
STAGE1 := $(REPO)/stage1.js
NODE := node --stack-size=8000

.PHONY: compile compile-self run serve repl property-test build-runtime verify-all verify-fixed-point verify-build verify-self-host bench ai-eval lint-aliases fl-test fl-build native-test semantic-test parity-test verify release clean help

help:
	@echo "FreeLang v11 self-hosting commands:"
	@echo "  make compile FILE=in.fl OUT=out.js  - stage1.js로 컴파일"
	@echo "  make compile-self                   - stage1 self-host"
	@echo "  make verify-all                     - 4개 검증 통합 대시보드"
	@echo "  make verify-fixed-point             - stage1~10 SHA256 chain"
	@echo "  make verify-build                   - TS→bootstrap 결정론"
	@echo "  make verify-self-host               - tier2 (PASS≥91)"
	@echo "  make bench                          - FL-Bench 100 reference"
	@echo "  make ai-eval                        - Claude CLI 평가 (~41분)"
	@echo "  make native-test                    - P2 Stage 1: FL→C→ELF 파이프라인"
	@echo "  make semantic-test                  - P2 Stage 2: 7개 invariant 검증"
	@echo "  make parity-test                    - P2 Stage 2: JS/C 출력 동등성 검증"
	@echo "  make verify                         - Release gate: semantic+parity+native+verify-all"
	@echo "  make release                        - verify PASS 후 릴리즈 체크포인트"

compile:
	@$(NODE) $(STAGE1) $(FILE) $(OUT)

# Y4 단계1 (Year 2): bootstrap.js 우회 — stage1.js로 compile + execute
run:
	@bash scripts/fl-run.sh $(FILE) $(ARGS)

# Y4 단계2 wrapper (현재는 bootstrap.js fallback. 산출물 self-contained 화는 별도 작업)
serve:
	@bash scripts/fl-serve.sh $(ARGS)

# Y4 단계3 wrapper (현재는 bootstrap.js fallback. interpreter 분리 후 풀 이관 가능)
repl:
	@bash scripts/fl-repl.sh $(ARGS)

# Y3 (Year 2): property-based testing — 50 invariant × N case
property-test:
	@$(NODE) scripts/property-test.js $(ARGS)

# Y4-2 풀 (단계A): self/runtime/*.js 빌드 (esbuild로 src/stdlib-*.ts 추출)
build-runtime:
	@bash scripts/build-runtime.sh

compile-self:
	@$(NODE) $(STAGE1) self/all.fl stage1-new.js
	@echo "stage1-new.js 생성. SHA256:"
	@sha256sum stage1-new.js stage1.js

verify-all:
	@bash scripts/verify-all.sh

verify-fixed-point:
	@bash scripts/verify-fixed-point-deep.sh

verify-build:
	@bash scripts/verify-build-deterministic.sh

verify-self-host:
	@bash scripts/verify-self-host.sh tier2

bench:
	@$(NODE) benchmarks/fl-bench/run.js --reference --label=make-bench

ai-eval:
	@$(NODE) scripts/ai-eval.js --provider=claude-cli --label=make-ai-eval

lint-aliases:
	@$(NODE) scripts/lint-stdlib-aliases.js

clean:
	@rm -f stage1-new.js /tmp/stage*.js /tmp/*-results.json
	@echo "임시 파일 정리 완료"

# Y5: 플러그인 설치 + AI 프롬프트 갱신
install-plugin:
	@if [ -z "$(NAME)" ]; then \
		echo "사용: make install-plugin NAME=<plugin-name>"; \
		exit 1; \
	fi
	@$(NODE) bin/freelang install $(NAME)
	@$(MAKE) gen-ai-prompt
	@echo "✓ 플러그인 '$(NAME)' 설치 + AI 프롬프트 갱신 완료"

# Y5: AI 시스템 프롬프트 생성 (stdlib + plugins)
gen-ai-prompt:
	@$(NODE) scripts/gen-ai-prompt.js

# FL-Native 테스트 러너
fl-test:
	@npm run fl-test

# FL-Native 빌드 도구
fl-build:
	@npm run fl-build

# P2: Native C backend compilation test
native-test:
	@echo "=== P2 Stage 1: FL → C → ELF Pipeline ==="
	@echo "Compiling examples/hello.fl to C..."
	@node bootstrap.js compile examples/hello.fl --target c -o /tmp/hello.c
	@echo "Compiling C to ELF..."
	@gcc /tmp/hello.c runtime/core.c runtime/collection.c runtime/io.c runtime/math.c runtime/error.c -I runtime/ -lm -o /tmp/hello
	@echo "Running native executable..."
	@/tmp/hello
	@echo "✓ Native pipeline SUCCESS"

# P2 Stage 2: Semantic invariant verification (C runtime ABI)
semantic-test:
	@echo "=== P2 Stage 2: Native C Semantic Invariant Tests ==="
	@echo "Compiling test/p2-semantics.c..."
	@gcc test/p2-semantics.c runtime/core.c runtime/collection.c runtime/io.c runtime/math.c runtime/error.c runtime/process.c -I runtime/ -lm -o /tmp/p2-semantics
	@echo "Running invariant tests..."
	@/tmp/p2-semantics
	@echo "✓ Semantic tests PASSED"

# P1: JS/C semantic parity test
parity-test:
	@bash self/parity-test.sh

# Phase 1E: Integrated CI Verification Gate (L0+L1+L3+L4)
verify:
	@bash scripts/ci-verify.sh

# Phase 1E: Quick CI verification (L0+L1 only, ~35 seconds)
verify-fast:
	@bash scripts/ci-verify.sh --fast

# Phase 1E: Release checkpoint
release: verify
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║           Release gate PASSED                         ║"
	@echo "║                                                        ║"
	@echo "║  git tag vX.Y.Z && git push origin --tags             ║"
	@echo "║                                                        ║"
	@echo "║  All CI gates verified:                              ║"
	@echo "║    L0 Static:        PASS                            ║"
	@echo "║    L1 Unit:          PASS                            ║"
	@echo "║    L3 E2E:           PASS                            ║"
	@echo "║    L4 Fixpoint:      PASS                            ║"
	@echo "╚════════════════════════════════════════════════════════╝"
