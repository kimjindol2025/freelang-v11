# FreeLang v11 — 실측 현황 보고서

> **규칙**: 이 문서는 **실제 검증한 내용만** 기록합니다.  
> 미검증 주장은 "관측 안 됨" 또는 "미검증"으로 표기합니다.  
> [`TRUTH_POLICY.md`](./TRUTH_POLICY.md) 를 준수합니다.

---

## 📊 실측 상태 (2026-04-18 검증)

### 컴파일 능력

| 파일 | 컴파일 | 실행 | 결과 |
|------|--------|------|------|
| `self/bench/hello.fl` | ✅ | ✅ | "hello" 출력 |
| `self/bench/tiny.fl` | ✅ | ✅ | "42" 출력 |
| `self/bench/fib30.fl` | ✅ | ✅ | "832040" 출력 |
| `self/bench/test-time.fl` | ✅ | ✅ | "now_ms/iso/unix" 확인 |

**검증 명령어**:
```bash
cd /home/kimjin/freelang-v11
node bootstrap.js run self/codegen.fl self/bench/hello.fl output.js
node output.js
```

### 테스트 결과

```bash
npm test
```

**결과**:
```
Test Suites: 17 passed, 17 total
Tests:       637 passed, 637 total
Time:        21.097 s
```

**기록**: 2026-04-18 실제 실행 검증

### 자체 호스팅 (Self-Hosting)

| 항목 | 상태 | 근거 |
|------|------|------|
| FL 코드 → JS 변환 | ✅ 가능 | 4개 파일 컴파일 성공 |
| 생성된 JS 실행 | ✅ 가능 | 모든 출력 일치 |
| codegen.fl 자신 컴파일 (stage1) | ✅ 가능 | `--stack-size=8000`로 `self/all.fl` → 45KB JS 산출 (2026-04-20) |
| stage2 (self-compiled로 재컴파일) | ⚠️ 부분 | 산출은 되나 Lexed/Parsed 비정상 (번역 버그 잔존) |
| Fixed-point 안정성 | ❌ 미달성 | stage2→stage3 시도 실패 |

### 웹 서버 (프로덕션)

| 항목 | 상태 | 근거 |
|------|------|------|
| 서버 구동 | ✅ 가능 | 포트 30011에서 성공 |
| HTTP 응답 | ✅ 가능 | `curl http://localhost:30011/` HTML 응답 |
| 라우팅 | ✅ 작동 | app/page.fl 자동 발견 및 등록 |
| SSR 렌더링 | ✅ 작동 | HTML 페이지 생성 |

---

## 🔧 기술 스택

| 계층 | 기술 | 상태 |
|------|------|------|
| **런타임** | Node.js v25 | 필수 의존 |
| **번들** | bootstrap.js (1.1MB) | ✅ 존재 |
| **컴파일러** | codegen.fl (v11로 작성) | ✅ 작동 확인 |
| **테스트** | Jest 637개 케이스 | ✅ 모두 PASS |

---

## 미검증 항목

다음은 **검증하지 않았거나 미완성**입니다:

- [ ] 성능 벤치마크 (응답 시간 측정 안 함)
- [ ] ISR/SSG 렌더링 (SSR만 확인)
- [ ] 완전 자가 컴파일 fixed-point (stage1 성공, stage2+ 번역 버그 잔존)
- [ ] 의존성 제로 (Node.js 여전히 필수)
- [ ] 프로덕션 배포 프로세스

---

## 현재 제약사항

1. **Node.js 의존**: `node bootstrap.js` 로만 실행 가능
2. **일부 파일만 컴파일 가능**: 4개 테스트 파일 성공, 나머지 미확인
3. **자가 컴파일 실패 가능성**: codegen.fl이 자신을 컴파일하는지 미검증

---

## 다음 검증 항목

1. 모든 `self/bench/` 파일 컴파일 시도
2. codegen.fl 자신 컴파일 테스트
3. 생성 JS의 SHA256 해시 안정성 확인
4. 웹 서버 실제 구동 테스트

---

## 정정 기록

**2026-04-18 검증**:
- 과거 주장: "Tests 583/583 PASS"
- 실제: **Tests 637/637 PASS**
- 차이: +54개 테스트 (미기록)

**2026-04-18 검증**:
- 과거 주장: "Phase 15 완성"
- 실제: 부분 기능 작동, 완전성 미검증

**2026-04-20 검증** (Phase 1 self-hosting 재조사):
- 과거 주장: "codegen.fl 자신 컴파일 불가능 (Stack overflow line 54)"
- 실제: Stack overflow는 **본질 원인이 아님**. `node --stack-size=8000` 증설 시 `self/all.fl` 자가 컴파일 자체는 가능.
  진짜 블로커는 **bootstrap parser가 map-literal AST의 fields를 JS Map으로 저장하는데 FL 레벨에서 이를 열거할 introspection primitive가 없었던 것**.
  모든 map 리터럴이 자가 컴파일 산출물에서 빈 객체 `({})` 로 번역되어 lex/parse 전체가 오염됨.
- 조치: `data` stdlib 모듈에 `map-entries`/`map_entries` primitive 추가 (bootstrap.js + src/stdlib-data.ts 미러).
  `self/all.fl`의 `cg-map-entries` bootstrap 분기 1단어 치환.
- 결과:
  - stage1 자가 컴파일: ✅ 45KB JS 산출 (이전 25KB에서 확장 — map 실제 값 포함)
  - 회귀: Tests **637/637 PASS**
  - stage2→stage3 fixed-point: ❌ 추가 번역 버그 잔존 (다음 작업 단위)
- 후속 과제:
  - hello.fl 재컴파일 시 Lexed=4 (비정상) 최소 재현
  - stage2에서 Parsed=10635 (정상 156 대비) 팽창 원인 추적
  - 재빌드 시 bootstrap.js 산출물 동일성 검증 (TS 원본 패치 지속성)

