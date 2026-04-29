# A-3 자체호스팅 통합 체크리스트
**목표**: runtime-helpers.ts → stage1.js 통합 및 검증  
**상태**: 진행 중 (A-B 단계 ✅ 완료)  
**예상 소요 시간**: 1-2시간

---

## Phase 1: 빠른 선검사 (✅ 완료)

- [x] A: TypeScript 컴파일 (`tsc runtime-helpers.ts`)
  - 결과: ✅ 성공 (dist/runtime-helpers.js 생성)
  
- [x] B: esbuild 번들링 (`esbuild dist/runtime-helpers.js`)
  - 결과: ✅ 성공 (dist/stage1-bundle-test.js 6.6KB)

---

## Phase 2: 근본 통합 (진행 중)

### 2.1 codegen-js.ts 검증
- [ ] BUILTIN_MAP에 모든 36개 _fl_* 함수 확인
- [ ] generateRuntimePreamble 함수 존재 확인
- [ ] runtime-helpers import 경로 정정

### 2.2 preamble 생성 함수 구현
```typescript
// src/runtime-helpers-preamble.ts (신규)
export function generateRuntimePreamble(): string {
  return `
// Auto-generated FL runtime helpers (2026-04-29)
${RUNTIME_HELPERS_SOURCE}
`;
}
```

### 2.3 esbuild 통합
- [ ] package.json scripts 업데이트
  ```json
  "build:stage1": "esbuild src/... runtime-helpers.ts --bundle --outfile dist/stage1-new.js"
  ```
- [ ] CI/CD 파이프라인에 stage1 생성 추가

### 2.4 SHA/동작 검증
- [ ] stage1-new.js 생성 확인
- [ ] sha256sum stage1.js vs stage1-new.js
- [ ] 기본 동작 테스트 (+ 1 2 → 3)

---

## Phase 3: 자체호스팅 검증 (대기)

- [ ] bash scripts/verify-self-host.sh 실행
- [ ] 핵심 테스트 시나리오 통과
  - try-catch 정상/에러 흐름
  - template literal ${...}
  - loop 스코프 격리
  - let 바인딩
  
- [ ] 기본 자체 컴파일 테스트
  ```bash
  node dist/stage1-new.js compile self/all.fl > self/all-new.js
  sha256sum self/all.js self/all-new.js  # 비교
  ```

---

## Phase 4: 릴리즈 준비 (대기)

- [ ] release/v11.1.0-alpha 브랜치 생성
- [ ] CHANGELOG.md 업데이트
- [ ] git tag v11.1.0-alpha-rc2
- [ ] gogs push

---

## 위험 요인 및 완화

| 위험 | 완화 |
|------|------|
| 헬퍼 누락 | A-B 단계에서 검출 (타입/번들 오류) |
| SHA 불일치 | 헬퍼 최소화로 예상됨 → 동작 동등성 확인 |
| Loop/Let 버그 | 기존 테스트 797개 통과, Phase C 검증 완료 |

---

## 다음 액션 (우선순위)

1. **지금**: Phase 2.1-2.2 구현 (generateRuntimePreamble 확인/구현) — 30분
2. **바로 다음**: esbuild 통합 + stage1-new.js 생성 — 30분
3. **검증**: verify-self-host.sh 실행 — 20분
4. **릴리즈**: git commit + push — 10분

**예상 총 시간**: 1.5시간

---

## 커밋 메시지 (초안)

```
feat: A-3 자체호스팅 완성 — runtime-helpers 통합

- runtime-helpers.ts: 36개 _fl_* 헬퍼 재구현
- codegen-js.ts: preamble 자동 주입
- esbuild 통합: stage1-new.js 결정론적 생성
- verify-self-host.sh: 자체호스팅 검증 ✅
- SHA 검증: L1-L3 모두 통과

Phase A 완성 — v11.1.0-alpha 배포 준비
```

---

**진행 상황**: 약 40% 완료 (A-B 완료, Phase 2 진행 중)
