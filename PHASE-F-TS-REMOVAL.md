# Phase F: Complete TypeScript Removal

**날짜**: 2026-05-25  
**상태**: ✅ 설계 완료 (L4 검증됨)  
**예상 소요시간**: 2.5시간  

---

## 현황

### L4 고정점 달성 확인 ✅

```
2026-05-25 검증 완료:

Step 1: bootstrap.js (Node.js) 사용
  cgc-main.fl → gen1.c
  SHA256: 5c1edeafb7ae346f2347a9321b0bfe8dfef7ae0be91c5e049b6bcfcbb57f2f74

Step 2: gen1-bin (네이티브) 사용
  cgc-main.fl → gen2.c
  SHA256: 5c1edeafb7ae346f2347a9321b0bfe8dfef7ae0be91c5e049b6bcfcbb57f2f74 ✅

Step 3: gen2-bin 생성
  gcc링크 → 262,688 bytes ELF

Step 4: gen2-bin (네이티브) 사용
  cgc-main.fl → gen3.c
  SHA256: 5c1edeafb7ae346f2347a9321b0bfe8dfef7ae0be91c5e049b6bcfcbb57f2f74 ✅

결과: 3중 SHA256 동일 = 고정점 달성 ✅
```

### 의미

FreeLang 컴파일러가 자신을 **정확히 재생성** 가능하다는 증명.

```
현재 상태:
  bootstrap.js → gen1.c → gen1-bin → gen2.c → gen3.c
  (TS로 1회 부트스트랩)    ↑네이티브 이후로는 불필요

목표 상태:
  gen1-bin을 미리컴파일된 바이너리로 배포
  → 초기부터 bootstrap.js 불필요
  → Node.js 완전 제거
```

---

## Phase F 실행 계획

### F-1: gen1-bin 정규화 (30분)

**목표**: 기존 `/tmp/gen1-bin`을 프로젝트 구조에 통합

**작업**:

1. **gen1-bin 배포**
   ```bash
   cp /tmp/gen1-bin ./dist/gen1-bin
   chmod 755 ./dist/gen1-bin
   ```

2. **새 entry point 스크립트**
   ```bash
   mkdir -p ./dist
   cat > ./dist/freelang-cgc << 'EOF'
   #!/bin/bash
   exec /home/kimjin/freelang-v11/dist/gen1-bin "$@"
   EOF
   chmod 755 ./dist/freelang-cgc
   ```

3. **검증**
   ```bash
   ./dist/gen1-bin self/cgc-main.fl > /tmp/test-gen2.c
   # → C 코드 생성 가능 확인
   ```

**산출물**:
- `/dist/gen1-bin` (262KB)
- `/dist/freelang-cgc` (wrapper)

---

### F-2: bootstrap.js 의존성 제거 (1시간)

**목표**: 빌드 시스템에서 Node.js/bootstrap.js 참조 완전 제거

**영향받는 파일**:
1. `scripts/build.sh`
   - 모든 `node bootstrap.js` 호출 → `./dist/gen1-bin` 변경
   
2. `scripts/build-cgc-native.sh`
   - 수정 없음 (gcc는 독립적)

3. `Makefile` / `package.json`
   - Node.js 의존성 제거 (선택적)
   - 빌드 명령 업데이트

4. `bootstrap.js` 파일 처리
   ```bash
   git mv bootstrap.js bootstrap.js.v11-archived
   ```

**검증 단계**:
```bash
# bootstrap.js 없이 컴파일 가능 확인
./dist/gen1-bin self/cgc-main.fl > /tmp/verify-gen2.c
diff /tmp/verify-gen2.c <(node bootstrap.js compile self/cgc-main.fl)
# → 동일해야 함
```

**산출물**:
- 업데이트된 `scripts/build.sh`
- 기록된 `bootstrap.js.v11-archived`

---

### F-3: CI/CD 재구성 (1시간)

**목표**: bootstrap.js 없이도 L4 검증 가능한 독립 스크립트

**신규 스크립트**: `scripts/verify-l4-standalone.sh`

```bash
#!/bin/bash
# bootstrap.js 불필요한 L4 검증

set -e

echo "=== L4 Fixed-Point Verification (Standalone) ==="
echo ""

# Step 1: Native compile (gen1-bin)
echo "Step 1: Native compile gen1-bin → gen2.c"
./dist/gen1-bin self/cgc-main.fl > /tmp/gen2.c
SHA2=$(sha256sum /tmp/gen2.c | awk '{print $1}')
echo "gen2.c SHA256: $SHA2"

# Step 2: Compile to binary
echo ""
echo "Step 2: Compile gen2.c → gen2-bin"
bash scripts/build-cgc-native.sh /tmp/gen2.c -o /tmp/gen2-bin
echo "✅ gen2-bin created"

# Step 3: Native compile (gen2-bin)
echo ""
echo "Step 3: Native compile gen2-bin → gen3.c"
/tmp/gen2-bin self/cgc-main.fl > /tmp/gen3.c
SHA3=$(sha256sum /tmp/gen3.c | awk '{print $1}')
echo "gen3.c SHA256: $SHA3"

# Verify
echo ""
if [ "$SHA2" = "$SHA3" ]; then
  echo "🎉 L4 FIXED-POINT ACHIEVED"
  echo "✅ Native compiler is self-hosting"
  echo "✅ bootstrap.js not required"
  exit 0
else
  echo "❌ Fixed-point failed"
  echo "SHA2: $SHA2"
  echo "SHA3: $SHA3"
  exit 1
fi
```

**CI/CD 통합**:
- `.github/workflows/ci.yml` 업데이트
- `make verify-standalone` 타겟 추가
- README.md 업데이트 (bootstrap.js 제거 공식화)

**산출물**:
- `scripts/verify-l4-standalone.sh`
- 업데이트된 CI/CD 파이프라인
- 업데이트된 README.md

---

## 예상 효과

### Before (현재)
```
FreeLang v11
├── src/ (TypeScript, 44K줄)
├── dist/ (JavaScript, 컴파일 산출)
├── bootstrap.js (Node.js entry point)
├── runtime/ (C 모듈, 독립적)
└── scripts/
    └── build.sh (Node.js 호출)

의존성: Node.js 필수
```

### After (Phase F 완료)
```
FreeLang v11
├── src/ (TypeScript, 44K줄 — 아카이브)
├── dist/ (JavaScript, 아카이브)
├── dist/gen1-bin (네이티브 바이너리, 262KB)
├── bootstrap.js.v11-archived (히스토리)
├── runtime/ (C 모듈, 독립적)
└── scripts/
    └── build.sh (gen1-bin 호출)

의존성: Node.js 제거 ✅
```

---

## 타이밍

| 단계 | 예상시간 | 필수여부 |
|------|---------|--------|
| F-1: gen1-bin 정규화 | 30분 | 필수 |
| F-2: bootstrap.js 제거 | 1시간 | 필수 |
| F-3: CI/CD 재구성 | 1시간 | 필수 |
| **합계** | **2.5시간** | |

---

## 위험도 분석

| 항목 | 위험도 | 완화책 |
|------|--------|--------|
| gen1-bin 크기/성능 | 낮음 | 기존 테스트로 검증 |
| 빌드 시스템 파괴 | 중간 | git tag v11 커밋 전 검증 |
| 배포 호환성 | 낮음 | gen1-bin은 포식적 호환 |

---

## 문서 업데이트

| 파일 | 변경사항 |
|------|---------|
| README.md | "Node.js-independent FreeLang v11" 선언 |
| ROADMAP.md | Phase F 완료 추가 |
| STATE_OF_V11.md | bootstrap.js 제거 완료 기록 |
| BUILD-SYSTEM.md | gen1-bin 사용 법칙 추가 |

---

## Lock Items

| 항목 | 결정 | 근거 |
|------|------|------|
| **gen1-bin entry point** | 고정 | L4 검증으로 이미 확인 (2026-05-25) |
| **SHA256 검증 메커니즘** | 고정 | 3중 확인으로 신뢰성 99% |
| **bootstrap.js 제거** | 필수 | Node.js 의존성 0 달성 |

---

## 신뢰도

| 항목 | 확신도 |
|------|--------|
| L4 고정점 달성 | 99% |
| gen1-bin 정상성 | 98% |
| TS 제거 가능성 | 95% |
| F-1/2/3 예상 시간 | 90% |

---

## 다음 단계 (Phase G: 배포)

Phase F 완료 후:

1. **v11.7.13 릴리스**
   - "Node.js-independent" 공식화
   - gen1-bin 바이너리 배포

2. **마케팅**
   - 3부작 블로그 (기술/성능/배포)
   - Gogs 공식 공지

3. **최적화** (선택)
   - gen1-bin 크기 최소화
   - 빌드 시간 프로파일링

