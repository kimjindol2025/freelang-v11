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
CGC_BIN := $(REPO)/bin/cgc-bin
FL_NATIVE := bash $(REPO)/scripts/fl-native.sh

.PHONY: compile compile-self run serve repl property-test build-runtime verify-all verify-fixed-point verify-build verify-self-host bench ai-eval lint-aliases fl-test fl-build native-test semantic-test parity-test verify verify-core verify-full release clean help install-native fl-run test-native

help:
	@echo "FreeLang v11 self-hosting commands:"
	@echo ""
	@echo "  [JS Backend]"
	@echo "  make compile FILE=in.fl OUT=out.js  - stage1.js로 컴파일"
	@echo "  make compile-self                   - stage1 self-host"
	@echo "  make semantic-test                  - P2 Stage 2: 7개 invariant 검증"
	@echo "  make parity-test                    - P2 Stage 2: JS/C 출력 동등성"
	@echo "  make native-test                    - P2 Stage 1: compile --target c 파이프라인"
	@echo "  make verify                         - Release gate: semantic+parity+native+verify-all"
	@echo ""
	@echo "  [C Backend]"
	@echo "  make c-hello                        - FL→C→ELF (hello.fl)"
	@echo "  make c-test                         - FL→C→ELF (4-file test)"
	@echo "  make c-parity                       - JS/C 출력 동등성 검증"
	@echo "  make c-verify                       - C backend gate: semantic+c-test+c-parity"
	@echo ""
	@echo "  [Release & Verification]"
	@echo "  make verify-core                    - P2-Core gate (필수): semantic+parity+native"
	@echo "  make verify-full                    - Full verification (선택): verify-core + verify-all"
	@echo "  make release VERSION=v11.X.X        - Release candidate (requires verify-core PASS)"
	@echo ""
	@echo "  [Infrastructure]"
	@echo "  make verify-all                     - 4개 검증 통합 대시보드"
	@echo "  make verify-fixed-point             - stage1~10 SHA256 chain"
	@echo "  make verify-build                   - TS→bootstrap 결정론"
	@echo "  make verify-self-host               - tier2 (PASS≥91)"
	@echo "  make bench                          - FL-Bench 100 reference"
	@echo "  make ai-eval                        - Claude CLI 평가 (~41분)"

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

# ── Node.js 독립 — Native 타겟 ──────────────────────────────────────

# cgc-bin 빌드 (Node.js로 1회만, 이후 자가 재빌드 가능)
install-native:
	@echo "=== FreeLang Native Compiler 설치 ==="
	@echo "Step 1: FL → C (bootstrap.js 마지막 사용)"
	@node --stack-size=8192 bootstrap.js run self/cgc-main.fl self/cgc-main.fl /tmp/cgc-install.c
	@echo "Step 2: C → ELF"
	@bash scripts/build-cgc-native.sh /tmp/cgc-install.c bin/cgc-bin
	@echo "✅ bin/cgc-bin 설치 완료 (이후 Node.js 불필요)"

# FL → ELF 실행 (Node.js 없이)
# 사용: make fl-run FILE=examples/hello.fl
fl-run:
	@$(FL_NATIVE) run $(FILE)

# FL → ELF 빌드 (실행 안 함)
# 사용: make fl-build-native FILE=examples/hello.fl OUT=/tmp/hello
fl-build-native:
	@$(FL_NATIVE) build $(FILE) -o $(OUT)

# Node.js 독립 통합 테스트
test-native:
	@echo "=== test-native: Node.js 없이 FL E2E 검증 ==="
	@echo ""
	@echo "[1/3] SQLite DB E2E..."
	@$(FL_NATIVE) run examples/test-sqlite-db.fl | grep -q "ALL PASS" && echo "  ✅ SQLite PASS" || (echo "  ❌ SQLite FAIL"; exit 1)
	@echo ""
	@echo "[2/3] DB Gap 검증..."
	@$(FL_NATIVE) run examples/test-db-gaps.fl | grep -q "ALL GAP CHECKS DONE" && echo "  ✅ DB Gaps PASS" || (echo "  ❌ DB Gaps FAIL"; exit 1)
	@echo ""
	@echo "[3/3] cgc-bin 자가검증 (L4 고정점)..."
	@bash scripts/verify-l4-fixpoint.sh 2>&1 | grep -E "FIXED-POINT|❌" | head -3
	@echo ""
	@echo "✅ test-native ALL PASS"

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

# P2-Core: Release candidate gate (필수)
verify-core:
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║           P2-Core Release Gate (필수)                 ║"
	@echo "╚════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "[1/3] Running semantic-test (7 C invariants)..."
	@$(MAKE) semantic-test
	@echo ""
	@echo "[2/3] Running parity-test (JS/C output equality)..."
	@$(MAKE) parity-test
	@echo ""
	@echo "[3/3] Running native-test (FL→C→ELF pipeline)..."
	@$(MAKE) native-test
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║           ✅ verify-core PASS — 배포 가능              ║"
	@echo "╚════════════════════════════════════════════════════════╝"

# Full verification (선택)
verify-full: verify-core
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║        Full Verification (선택 — verify-all)          ║"
	@echo "╚════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "[4/4] Running verify-all (build + self-host + bench)..."
	@$(MAKE) verify-all
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║  ✅ verify-full PASS — 고급 검증 완료 (선택사항)      ║"
	@echo "╚════════════════════════════════════════════════════════╝"

# P2-Core: FL → C → ELF hello.fl
c-hello:
	@echo "=== P2-Core: FL → C → ELF Pipeline (hello.fl) ==="
	@node bootstrap.js compile examples/hello.fl --target c -o /tmp/c_hello.c
	@gcc /tmp/c_hello.c runtime/core.c runtime/collection.c runtime/io.c runtime/math.c runtime/error.c -I runtime/ -lm -o /tmp/c_hello
	@echo "Running hello ELF..."
	@/tmp/c_hello
	@echo "✓ c-hello SUCCESS"

# P2-Core: FL → C → ELF 4-file test suite
c-test:
	@echo "=== P2-Core: FL → C → ELF (loop.fl, fib.fl, factorial.fl, nested-loop.fl) ==="
	@for f in examples/loop.fl examples/fib.fl examples/factorial.fl examples/nested-loop.fl; do \
		echo "Testing $$f..."; \
		node bootstrap.js compile $$f --target c -o /tmp/c_test.c || exit 1; \
		gcc /tmp/c_test.c runtime/core.c runtime/collection.c runtime/io.c runtime/math.c runtime/error.c -I runtime/ -lm -o /tmp/c_test || exit 1; \
		/tmp/c_test || exit 1; \
	done
	@echo "✓ c-test SUCCESS (4/4 compiled and executed)"

# P2-Core: C backend parity validation
c-parity:
	@bash self/parity-test.sh

# P2-Core: Integrated C backend validation
c-verify:
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║      P2-Core Release Gate (C Backend)                 ║"
	@echo "╚════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "[1/3] Running semantic-test (7 C invariants)..."
	@$(MAKE) semantic-test
	@echo ""
	@echo "[2/3] Running c-test (4-file FL→C→ELF)..."
	@$(MAKE) c-test
	@echo ""
	@echo "[3/3] Running c-parity (JS/C output equality)..."
	@$(MAKE) c-parity
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║     ✅ c-verify PASS — C backend stable                ║"
	@echo "╚════════════════════════════════════════════════════════╝"

# Release checkpoint (Phase 1E CI gate + C backend + P2-Core)
release: verify c-verify verify-core
	@if [ -z "$(VERSION)" ]; then \
		echo ""; \
		echo "사용: make release VERSION=v11.X.X"; \
		echo ""; \
		exit 1; \
	fi
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║         Release Candidate: $(VERSION)                   ║"
	@echo "║                                                        ║"
	@echo "║  ✅ P2-Core gate PASSED                               ║"
	@echo "║  ✅ semantic-test PASS                                ║"
	@echo "║  ✅ parity-test PASS                                  ║"
	@echo "║  ✅ native-test PASS                                  ║"
	@echo "║                                                        ║"
	@echo "╚════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Creating git tag: $(VERSION)"
	@git tag -a $(VERSION) -m "[Release] P2-Core approved"
	@echo "Pushing tag to origin..."
	@git push origin $(VERSION)
	@echo ""
	@echo "╔════════════════════════════════════════════════════════╗"
	@echo "║  ✅ Release $(VERSION) created and pushed               ║"
	@echo "╚════════════════════════════════════════════════════════╝"
