## 📝 Pull Request

### 🎯 목적 (What & Why)

<!-- 이 PR이 해결하는 문제 또는 추가하는 기능을 간단히 설명하세요 -->

- [ ] 버그 수정
- [ ] 기능 추가
- [ ] 성능 개선
- [ ] 테스트 추가
- [ ] 리팩토링
- [ ] 문서 업데이트

### 📋 변경사항 요약

<!-- 구체적인 변경 내용을 설명하세요 -->

### 🧪 테스트 및 검증

#### Phase C — 자가호스팅 검증 체크리스트

- [ ] ✅ **FL-Token Scan**: `bash scripts/scan-for-fl-tokens.sh stage1.js`
  - 결과: `All files clean — no FL tokens found`

- [ ] ✅ **Fixed-Point Verify**: `bash scripts/verify-fixed-point.sh`
  - 예상: `stage1 == stage2 == stage3 == stage4 == stage5` (SHA 일치)

- [ ] ✅ **Let-in-Expression Regression**: `node scripts/check-let-regressions.js`
  - 예상: `5 passed, 0 failed`

- [ ] ✅ **Jest Regression (Codegen)**: `npm test -- src/__tests__/codegen.let.test.ts`
  - 예상: `5 passed`

- [ ] ✅ **Full Jest (643 tests)**: `npm test -- --silent`
  - 로컬: `npm test`
  - CI: 3 shards 병렬 실행
  - 예상: 모든 shard PASS

#### CI 상태
- PR CI Status: [![Build](https://github.com/your-org/freelang-v11/workflows/Phase%20C/badge.svg?branch=feature%2F...)](https://github.com/your-org/freelang-v11/actions)

### 🔄 로컬 검증 순서 (개발자용)

```bash
# 1. stage1 재생성
bash scripts/build-stage1.sh

# 2. 토큰 검사 (Early-fail)
bash scripts/scan-for-fl-tokens.sh stage1.js

# 3. 고정점 검증
bash scripts/verify-fixed-point.sh

# 4. 회귀 테스트
node scripts/check-let-regressions.js

# 5. Jest (단일 또는 sharded)
npm test                          # 전체 (느림)
./scripts/run-jest-shard.sh all   # 병렬 (빠름)
```

### 📊 코드 리뷰 포인트

<!-- 리뷰어가 특히 주목해야 할 부분 -->

- [ ] 새로운 symbol/encoding 추가 시: `src/codegen-js.ts` BUILTIN_MAP 및 flNameToJs 확인
- [ ] let 표현식 변경 시: genSExpr IIFE 래핑 로직 재검증
- [ ] 생성 JS 변경 시: 위의 검증 체크리스트 필수

### 🔗 관련 이슈

<!-- 관련 이슈 번호 (예: Closes #123) -->

- Closes #
- Related to #

### 📸 스크린샷 또는 로그

<!-- 필요시 output, logs, artifacts 첨부 -->

### 🚀 추가 정보

<!-- 기타 필요한 정보 -->

---

**Note**: PR이 자동으로 CI를 트리거합니다. Scan 단계 실패 시 머지 불가합니다.
