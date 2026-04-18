# v11 Self-Hosting 진행 현황 (2026-04-19) — 수정됨

## ⚠️ 공식 판정: **자가 컴파일 불가능**

진정한 self-hosting은 실현되지 못했습니다.

---

## ✅ 부분 달성한 것

### 1. Bootstrap 의존 컴파일
| 파일 | 라인 | 상태 |
|------|------|------|
| lexer.fl | 187 | ✅ v11로 구현됨 (bootstrap 필요) |
| parser.fl | 230 | ✅ v11로 구현됨 (bootstrap 필요) |
| codegen.fl | 856 | ✅ v11로 구현됨 (bootstrap 필요) |
| **합계** | **1273** | ⚠️ Bootstrap 없이는 동작 불가 |

### 2. Bootstrap.js 런타임에서의 컴파일
```bash
node --stack-size=8192 bootstrap.js run self/codegen.fl self/bench/hello.fl output.js
# ✅ 결과: 작동 (bootstrap.js 런타임 제공)
```

### 3. 자체 생성 컴파일러 (불안정)
```bash
node --stack-size=8192 bootstrap.js run self/codegen.fl self/codegen.fl compiler-self.js
# ⚠️ 결과: 생성은 됨 (44206 bytes)
# ❌ 하지만 standalone으로 실행 불가능
```

---

## ❌ 달성하지 못한 것: Fixed-Point (진정한 Self-Hosting)

### Double Execution Bug
```bash
# 자체 생성 컴파일러로 재컴파일 시도
node compiler-self.js self/bench/hello.fl output.js
# ❌ 결과: Lexed: 0 tokens (완전 실패)
```

**근본 원인**:
- `codegen.fl` 끝부분에 실행 코드 포함:
  ```scheme
  ((__argv__==null)?null:(let [[$input...]...]
    (file_read $input)))  ; ← 첫 번째 실행
  ```
- `main.fl`도 함께 컴파일되어 포함:
  ```javascript
  // 생성된 JS에서:
  // 첫 번째: compile_file() 호출 → 정상
  // 두 번째: __argv__ 소진 → "Lexed: 0 tokens"
  ```

**결론**: 실행 로직과 컴파일 로직이 분리되지 않음

---

## 📊 실제 진행률

```
Self-Hosting 파이프라인:
  ├─ Lexer v11: ✅ 100% (v11 코드)
  ├─ Parser v11: ✅ 100% (v11 코드)
  ├─ Codegen v11: ✅ 100% (v11 코드)
  ├─ Bootstrap 컴파일: ✅ 100% (의존성 있음)
  ├─ Standalone 실행: ❌ 0% (Double Execution 버그)
  └─ Fixed-Point: ❌ 0% (작동 불가능)

**진정한 Self-Hosting 진행률: 0% (불가능)**
```

---

## 🔧 남은 작업

### 해결책 1: 실행 로직 분리 (권장)
- [ ] `codegen.fl` 끝의 실행 코드 제거
- [ ] `main.fl`을 별도 진입점으로 운영
- [ ] `compiler-self.js`만 생성 (실행 없음)
- [ ] 실행은 `node bootstrap.js run compiler-self.js ...`로

### 해결책 2: 중복 실행 방지
- [ ] 코드 생성 후 실행 상태 변수 검사
- [ ] 두 번째 실행 경로 차단

### 현실적 평가
**→ v11 Bootstrap 의존도 필요**
- Pure v11 self-hosting: 불가능 (현재 기술로)
- Bootstrap 의존 운영: 가능 (현재 상태)

---

## 📝 기술적 근거

### 실제 상황
```
FL Source → Lexer(v11) → Parser(v11) → Codegen(v11) → JavaScript
                            (Bootstrap 런타임 필수)
```

**문제**: Codegen이 standalone으로 실행될 수 없음

### 검증 경로
1. **L0**: bootstrap.js (TypeScript) ← **필수**
2. **L1**: codegen.fl (v11 소스) ← L0 없이 불가
3. **L2**: compiler-self.js (생성됨) ← 실행 불가능
4. **L3**: 미달성

---

## 🎯 결론

**현재 상태: Bootstrap 의존 Partial Self-Hosting**

- ✅ 렉서/파서/코드젠: 모두 v11로 구현됨
- ✅ Bootstrap 컴파일: 완벽하게 작동
- ⚠️ Standalone 실행: 불가능 (Double Execution 버그)
- ❌ Fixed-Point: 달성 불가능

**다음 단계**: 
1. Double Execution 버그 수정 → bootstrap.js 의존성 제거
2. 또는 현재 상태 유지: bootstrap.js를 v11의 공식 런타임으로 선언

