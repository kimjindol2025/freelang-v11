# Phase C — CI 통합 가이드 (Full Pipeline)

## 개요

FreeLang v11 CI/CD 자동화 가이드. `phase-c-full.yml` 워크플로우를 통해 PR 검증, 자가호스팅 검증, 전체 Jest 통합 테스트를 자동으로 실행합니다.

## CI 구조

### 4-Phase 파이프라인

```
Phase 1: Scan & Verify (Fast)
├─ FL-Token Scan (early-fail)
├─ Fixed-Point Verify (5-stage SHA)
└─ Let-Regression (quick)
         ↓ (success only)
Phase 2: Regression Tests
├─ Jest Codegen Tests (5 tests)
         ↓ (parallel with Phase 3)
Phase 3: Full Jest (Sharded)
├─ Shard 1/3 (~200 tests)
├─ Shard 2/3 (~200 tests)
└─ Shard 3/3 (~200 tests)
         ↓ (all)
Phase 4: Summary & Artifacts
└─ Status Report + Upload
```

### 트리거

- **PR**: 자동 실행 (feature/*, master 대상)
- **Push**: 자동 실행 (feature/*, master)
- **Nightly**: 매일 02:00 UTC (전체 self-hosting chain)
- **Manual**: GitHub Actions UI에서 수동 실행

## 로컬 검증 (CI 실행 전)

### 빠른 검증 (2분)

```bash
# 1. stage1 재생성
bash scripts/build-stage1.sh

# 2. 토큰 검사
bash scripts/scan-for-fl-tokens.sh stage1.js

# 3. 고정점 검증
bash scripts/verify-fixed-point.sh
```

**예상 결과:**
```
✅ All files clean — no FL tokens found
✅ Fixed-Point Verified: 5/5 stages match
```

### 회귀 테스트 (5분)

```bash
# 4. Let-in-expression 회귀
node scripts/check-let-regressions.js

# 5. Jest 회귀
npm test -- src/__tests__/codegen.let.test.ts --silent
```

### 전체 Jest (20-40분)

```bash
# 병렬 실행 (권장, 로컬)
./scripts/run-jest-shard.sh all

# 또는 순차 실행
npm test
```

## CI 실행 상황 모니터링

### GitHub Actions 페이지

1. [Actions 탭](https://github.com/your-org/freelang-v11/actions) 방문
2. "Phase C — Full Integration" workflow 선택
3. 최근 run 클릭 → 진행 상황 확인

### 각 Phase 상태

- ✅ **Scan & Verify**: 초록색 → 모두 통과
- ⚠️ **Regression**: 노란색 → 1개 이상 실패 (계속 진행)
- ❌ **Full Jest**: 빨간색 → 1개 이상 shard 실패

### Artifact 다운로드

실패 시 자동으로 artifact 저장:
- `scan-verify-artifacts/`: stage*.js, 빌드 로그
- `jest-results-shard-{1,2,3}/`: 각 shard 결과 (junit.xml, coverage)

**GitHub UI 에서:**
1. Failed Run 클릭
2. "Artifacts" 섹션
3. 원하는 artifact 다운로드

## 실패 시 디버깅

### Scan 단계 실패

```
❌ [ERROR] stage1.js:42:10
   Pattern: 물음표 함수 (FL builtin)
   Found: "null?"
```

**원인:** Builtin 함수가 JS로 치환되지 않음

**조치:**
1. 발견된 파일과 라인 확인 (artifact)
2. `src/codegen-js.ts` BUILTIN_MAP 확인
3. 해당 symbol 추가 또는 매핑 수정
4. `npm run build` 후 재제출

### Fixed-Point 실패

```
❌ Fixed-Point Failed: 1 divergence(s) detected
stage2: abc123... ❌ (differs from stage1)
```

**원인:** 결정론적이지 않은 생성 결과

**조치:**
1. Artifact에서 stage*.js 비교
   ```bash
   diff stage1.js stage2.js | head -50
   ```
2. 마지막 커밋과 비교
   ```bash
   git diff HEAD~1 src/codegen-js.ts
   ```
3. 의도적 변경인가?
   - **YES**: PR에 명시적으로 "SHA baseline update: <new-hash>" 주석 추가
   - **NO**: 로직 재검토 후 수정

### Jest 실패

```
Jest: 643 passed, 2 failed

FAIL  src/__tests__/lexer.test.ts
  ● Parsing › should parse multiple tokens

Expected: "SYMBOL"
Received: "UNKNOWN"
```

**조치:**
1. 실패한 테스트 확인
2. 로컬에서 재현
   ```bash
   npm test -- src/__tests__/lexer.test.ts --no-coverage
   ```
3. 최근 코드 변경 검토
4. 수정 후 재제출

### 모든 Shard 실패

원인: 일반적으로 의존성 또는 setup 문제

**조치:**
1. `npm ci` 재실행 (캐시 무시)
2. Node 버전 확인 (로컬 ≥ 20)
3. 의존성 문제 확인
   ```bash
   npm audit
   npm install --legacy-peer-deps  # if needed
   ```

## PR 체크리스트 (머지 전)

PR 제출 시 다음을 확인하세요:

- [ ] 로컬 검증 완료 (토큰, 고정점, 회귀)
- [ ] CI 모든 단계 PASS (green)
- [ ] Artifact 검증 (실패 시에만)
- [ ] PR 템플릿의 체크리스트 완성
- [ ] 커밋 메시지 명확성
- [ ] Code review 요청

## Nightly Run (자동)

매일 02:00 UTC (GitHub Actions 시간)에 전체 self-hosting + Jest 실행.

### Nightly 결과 확인

1. Actions 탭 → "Phase C" workflow 필터
2. "nightly-self-host" job 확인
3. 실패 시: 담당자 알림

### Nightly Artifact

30일 보관:
- `nightly-results-<run_id>/stage*.js`

## 최적화 팁

### CI 시간 단축

- **Local Build Cache**: `npm ci --prefer-offline` 사용 중
- **Parallel Shards**: Jest 3 shards (각 ~200 tests)
- **Early-Fail**: Scan 실패 시 이후 단계 스킵

### 캐시 관리

GitHub Actions 캐시:
- `npm ci --prefer-offline` 자동 사용
- ~5분 절약 (node_modules 설치 생략)

캐시 무효화 (문제 시):
1. Actions 탭 → Caches
2. 해당 workflow cache 삭제
3. 새로운 run 시 재생성

## 문제 신고 및 개선

### 알려진 이슈

| 이슈 | 상태 | 대응 |
|------|------|------|
| Jest flaky (test X) | 🟡 Investigating | --retries 적용 대기 |
| Nightly timeout (50+m) | 🔴 Open | Shard 수 증가 계획 |

### 개선 제안

Workflow 개선 사항:
- [ ] Slack 알림 통합
- [ ] Code coverage 리포팅
- [ ] Performance regression 감지
- [ ] Automated bisect (실패 시)

## 참고 문서

- [PHASE-C-SCAN.md](./PHASE-C-SCAN.md) — FL Token Scan 상세 가이드
- [.github/workflows/phase-c-full.yml](../.github/workflows/phase-c-full.yml) — CI Workflow 정의
- [.github/pull_request_template.md](../.github/pull_request_template.md) — PR 템플릿
