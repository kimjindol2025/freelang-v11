# Phase C — FL Token Scan + Fixed-Point Verification

## 개요

FreeLang v11 자가호스팅 검증 자동화 가이드. 생성된 JS에서 FL 토큰 잔재를 감지하고, 결정론성(fixed-point)을 검증합니다.

## 로컬 실행

### 1. FL Token Scan (생성 JS 검사)

```bash
# 단일 파일
./scripts/scan-for-fl-tokens.sh stage1.js

# 여러 파일
./scripts/scan-for-fl-tokens.sh stage1.js stage2.js stage3.js

# 와일드카드
./scripts/scan-for-fl-tokens.sh build/*.js
```

**결과:**
```
════════════════════════════════════════════
  FL Token Remnant Scanner
════════════════════════════════════════════

════════════════════════════════════════════
✅ All files clean — no FL tokens found
```

### 2. Fixed-Point 검증 (결정론성)

```bash
bash scripts/verify-fixed-point.sh
```

**결과:**
```
✅ Fixed-Point Verified: 5/5 stages match
   Deterministic compilation confirmed
```

### 3. Let-in-Expression 회귀 테스트

```bash
node scripts/check-let-regressions.js
```

### 4. 전체 통합 검증 (로컬)

```bash
# Stage1 재생성
bash scripts/build-stage1.sh

# 토큰 검사
./scripts/scan-for-fl-tokens.sh stage1.js

# 고정점 검증
bash scripts/verify-fixed-point.sh

# 회귀 테스트
node scripts/check-let-regressions.js

# Jest (643 cases)
npm test
```

## CI 통합

### GitHub Actions

파일: `.github/workflows/phase-c-scan.yml`

자동 실행 트리거:
- `push` to `feature/*` or `master`
- `pull_request` to `feature/*` or `master`

**단계:**
1. Node.js 설정 + 의존성 설치
2. `npm run build` (bootstrap.js 재빌드)
3. `bash scripts/build-stage1.sh` (stage1.js 생성)
4. **FL token scan** (early-fail: 발견 시 즉시 실패)
5. Fixed-point 검증 (5단계 SHA 체인)
6. 회귀 테스트 (let-in-expr 5 cases)
7. Jest 테스트 (643 cases)

### 다른 CI (GitLab CI, Jenkins 등)

기본 명령 순서:
```bash
npm ci
npm run build
bash scripts/build-stage1.sh
bash scripts/scan-for-fl-tokens.sh stage1.js  # exit 1 if fail
bash scripts/verify-fixed-point.sh
node scripts/check-let-regressions.js
npm test
```

## 탐지 패턴

### 검사 항목

| 패턴 | 예시 | 원인 |
|------|------|------|
| 물음표 함수 | `null?`, `is-digit?` | builtin 치환 누락 |
| `return let ...` | `return let $x = 1;` | let-as-expression IIFE 미생성 |
| control-block 표기 | `[FUNC]`, `[SERVER]` | 전처리 누락 |
| FL parser 호출 | `fl_parse(...)` | 런타임 미정의 |

### 정규식 (scripts/scan-fl-tokens.js)

```javascript
const PATTERNS = [
  { name: "물음표 함수", regex: /\b[A-Za-z0-9_\-]+\?\b/g },
  { name: "null?", regex: /\bnull\?\b/g },
  { name: "is-digit?", regex: /\bis-digit\?\b/g },
  { name: "let-as-expr", regex: /return\s+let\s+[A-Za-z_\$][A-Za-z0-9_\$]*\b/g },
  { name: "control-block", regex: /\[FUNC\]|\[SERVER\]/g },
];
```

## 실패 시 디버깅

### 1. 물음표 함수 감지

```
❌ [ERROR] stage1.js:42:10
   Pattern: 물음표 함수 (FL builtin)
   Found: "null?"
   Line: if (null? (get $obj :key)) { return "ok"; }
```

**원인:** `null?` → `_fl_null_q` 치환 미완료

**해결:**
1. `src/codegen-js.ts`의 `BUILTIN_MAP`에 entry 확인
2. `flNameToJs()` 함수 확인
3. stage1.js 재생성: `bash scripts/build-stage1.sh`

### 2. let-as-expression 잔재

```
❌ [ERROR] stage1.js:156:8
   Pattern: let-as-expression 잔재 (return let ...)
   Found: "return let $x = 1;"
   Line: return let $x = 1;
```

**원인:** expression 위치에서 let이 IIFE로 변환되지 않음

**해결:**
1. `src/codegen-js.ts` genSExpr 함수에서 let case 확인
2. IIFE 래핑 로직 검증: `(() => { let ... })();`
3. wantExpression 플래그 전파 경로 추적

### 3. 고정점 불일치

```
❌ Fixed-Point Failed: 1 divergence(s) detected
stage2: abc123... ❌ (differs from stage1)
```

**원인:** codegen 변경이 비결정론적 영향

**해결:**
1. 이전 커밋과 비교: `git diff HEAD~1 src/codegen-js.ts`
2. 의도적 변경이면 baseline SHA 갱신
3. 무의도 변경이면 rollback

## 운영 팁

### 일일 체크

```bash
# 로컬에서 수동 검증
bash scripts/build-stage1.sh
bash scripts/scan-for-fl-tokens.sh stage1.js
bash scripts/verify-fixed-point.sh
npm test
```

### PR 머지 전 체크리스트

- [ ] CI 파이프라인 전부 PASS (green)
- [ ] FL token scan: ✅ All files clean
- [ ] Fixed-point: 5/5 stages matched
- [ ] Regression tests: 5/5 passed
- [ ] Jest: 643/643 passed

### Nightly 검증

cron으로 정기적 실행:
```yaml
schedule:
  - cron: '0 2 * * *'  # 매일 2시 (UTC)
```

## 참고

- **scan-fl-tokens.js**: FL 토큰 탐지 (문자열/주석 제외)
- **scan-for-fl-tokens.sh**: 쉘 래퍼 (여러 파일 순회)
- **verify-fixed-point.sh**: SHA256 체인 검증 (stage1..stage5)
- **check-let-regressions.js**: let-in-expr 회귀 테스트 (5 cases)
