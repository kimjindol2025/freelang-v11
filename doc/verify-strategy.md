# Release Gate 전략 (verify-core vs verify-full)

**현재 상태**: make verify 명령이 혼재 (core + optional)

**권장**: 두 가지 명령으로 분리

---

## 현재 verify 구조

```bash
make verify
├─ [1/4] semantic-test     ✅ P2 Core
├─ [2/4] parity-test       ✅ P2 Core
├─ [3/4] native-test       ✅ P2 Core
└─ [4/4] verify-all        ⏳ Optional (browser.js 이슈)
```

**문제**: optional 항목이 실패하면 전체 verify가 실패로 표시됨.

---

## 권장 분리 구조

### make verify-core (필수)

P2-Core 검증만 포함. CI/CD 기본값.

```bash
make verify-core
├─ semantic-test    (7 invariants)
├─ parity-test      (4 files JS/C)
└─ native-test      (FL→C→ELF)

출력: ✅ PASS / ❌ FAIL
```

### make verify-full (선택)

모든 검증 포함. 릴리즈 전 최종 확인용.

```bash
make verify-full
├─ verify-core      (필수)
├─ verify-all       (build + self-host + bench)
└─ verify-parity    (advanced files)

출력: ✅ PASS / ⏳ WARN (일부 optional)
```

### make release (최종)

verify-core 통과 시에만 실행 가능.

```bash
make release
├─ verify-core     (필수 통과)
├─ tag 생성        (v11.X.X)
└─ 블로그 공지

조건: verify-core PASS
```

---

## Makefile 변경 (제안)

```makefile
# P2-Core: Release candidate gate
verify-core:
	@echo "╔════════════════════════════════════╗"
	@echo "║   P2-Core Release Gate             ║"
	@echo "╚════════════════════════════════════╝"
	@$(MAKE) semantic-test
	@$(MAKE) parity-test
	@$(MAKE) native-test
	@echo "✅ verify-core PASS"

# Full verification (optional)
verify-full: verify-core
	@echo "╔════════════════════════════════════╗"
	@echo "║   Full Verification (Optional)     ║"
	@echo "╚════════════════════════════════════╝"
	@$(MAKE) verify-all

# Release gate (requires verify-core)
release: verify-core
	@echo "✅ Release candidate approved"
	@echo "Tag: $(VERSION)"
	@git tag -a $(VERSION) -m "P2-Core release"
	@git push origin $(VERSION)
```

---

## 역할 정의

| 대상 | 명령 | 목적 | 실패 시 |
|------|------|------|--------|
| 개발자 | make verify-core | PR 전 검증 | Fix required |
| CI/CD | make verify-core | 머지 전 자동 검증 | Block merge |
| 릴리즈 | make release | 공식 배포 | Require manual approval |
| 심화 분석 | make verify-full | 성능/호환성 확인 | Log warning |

---

## 마이그레이션 경로

### Step 1: verify-core 추가 (지금)
```bash
cp Makefile Makefile.bak
# 위 Makefile 변경사항 적용
```

### Step 2: 테스트
```bash
make verify-core
make verify-full
make release VERSION=v11.7.12
```

### Step 3: CI 업데이트
```yaml
# .github/workflows/ci.yml (또는 gogs CI)
- name: Verify Core
  run: make verify-core
```

### Step 4: 기존 verify 제거 (선택)
```makefile
# 기존 verify 제거 또는 verify-full로 이름 변경
```

---

## 주의사항

1. **browser.js** 빌드 이슈 분리
   - verify-core에 포함 금지
   - verify-full에 포함 (optional)

2. **실패 모드** 명확화
   - semantic-test 실패: 의미론 위반 (즉시 fix)
   - parity-test 실패: JS/C 불일치 (즉시 fix)
   - native-test 실패: pipeline 오류 (즉시 fix)
   - verify-all 실패: 선택적 (log + 재조사)

3. **성능 기준** (verify-full에만)
   - Benchmark 목표 설정 (향후 P3)
   - 성능 회귀 감지 (선택적 경고)

---

## 예상 효과

- ✅ 명확한 release gate
- ✅ CI/CD 통과율 향상
- ✅ 개발자 신뢰 강화
- ✅ 선택적 항목과 필수 항목 분리

---

**우선순위**: 
1. verify-core Makefile 추가 (즉시)
2. CI 업데이트 (1주)
3. 기존 verify 정리 (선택)

**예상 완료**: 이번 주말
