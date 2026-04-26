# Y4-2B 재baseline — Dry Run 명세 (다음 세션 즉시 실행)

**목적**: stage1 codegen prelude 변경을 1회 작업으로 묶어 SHA256 재baseline.
**근거**: `docs/CODEGEN_IMPROVEMENTS.md` C2 (append 가변 인자) 및 향후 Y4-2 단계B (HTTP 서버 require).
**현 baseline**: `5877b9660e6fb94eb02e69c0fd17c8e070392038d138b4affef9b3262e1c737d`

---

## 변경 범위 (확정)

### 변경 A — C2: append 가변 인자

**대상**: `self/codegen.fl:797` + `self/all.fl:1426` (자동 생성, 동일 string)

**현**:
```clojure
"const _fl_append = (a, b) => (Array.isArray(b) ? [...a, ...b] : [...a, b]);"
```

**신**:
```clojure
"const _fl_append = (...xs) => (xs.length === 0 ? [] : (xs.length === 1 ? xs[0] : xs.reduce((a, b) => Array.isArray(b) ? [...a, ...b] : [...a, b])));"
```

**검증된 안전성** (2026-04-26):
- self/codegen.fl 내 (append a b) 2-arg 사용만 — 3+ arg 없음 ✅
- self/all.fl 내 (append a b) 2-arg 사용만 ✅
- → 새 prelude 가 기존 2-arg 호환 (reduce 단일 step = 동일 결과)

### 변경 B (선택) — Y4-2 단계B: HTTP 서버 require

**대상**: `self/codegen.fl` prelude 의 `_fl_server_*` stub 7개

**제안**: 변경 A 와 동시 진행하지 않음 (영향 범위 큼). C2 단독으로 1차 baseline 변경, 이후 별도 PR 에서 B 진행.

### 변경 C/D (선택) — C1, C4

**제안**: B 와 함께 다음 라운드. 이번은 C2 만.

---

## 실행 절차 (단계별)

```bash
# 1. 사전 baseline 캡처
sha256sum stage1.js > /tmp/baseline-pre.txt
cp stage1.js /tmp/stage1-pre.js
cp self/codegen.fl /tmp/codegen-pre.fl
cp self/all.fl /tmp/all-pre.fl

# 2. self/codegen.fl + self/all.fl 의 _fl_append 정의 변경 (변경 A)
#    Edit 도구로 line 797 (codegen.fl) + line 1426 (all.fl)

# 3. 현 stage1.js 로 self/all.fl 재컴파일
node --stack-size=8000 stage1.js self/all.fl stage1-new.js

# 4. 새 SHA 기록
sha256sum stage1-new.js                  # ← <new-sha>

# 5. stage1-new.js 로 다시 self/all.fl 컴파일 → stage1-new2.js
node --stack-size=8000 stage1-new.js self/all.fl stage1-new2.js
sha256sum stage1-new2.js                 # ← 같은 <new-sha> 여야 함 (fixed-point)

# 6. 차이 0 확인
diff stage1-new.js stage1-new2.js && echo "✅ fixed-point"

# 7. baseline 교체 (승인 후)
mv stage1-new.js stage1.js
rm stage1-new2.js

# 8. deep fixed-point 10단 검증
bash scripts/verify-fixed-point-deep.sh 10
# 모든 stage1~10 SHA == <new-sha> 여야 함

# 9. 회귀 검증
make property-test ARGS=--n=10           # 200/200 PASS 유지
                                          # I131 (append 3-arg) 원래 형태로 복원하면 새로 PASS
npm test                                 # 736+ PASS 유지
make verify-all                          # 4 검증 통합

# 10. 회귀 가드 — I131 invariant 복원 (option)
#     scripts/property-test.js I131:
#       (length (append (list a) (list b) (list 0)))    ← 3-arg 직접 사용
#     → 새 prelude 에서 PASS 해야 함

# 11. baseline 갱신 (문서)
sed -i 's/5877b9660e6fb94eb02e69c0fd17c8e070392038d138b4affef9b3262e1c737d/<new-sha>/g' \
  CLAUDE.md docs/Y4-2B_DRY_RUN.md scripts/property-test.js README.md
# (또는 grep 으로 찾아서 수동 교체)

# 12. commit + PR
git add stage1.js self/codegen.fl self/all.fl CLAUDE.md docs/ scripts/property-test.js
git commit -m "BREAKING: stage1 baseline SHA256 변경 (C2 append 가변 인자)

- _fl_append 정의: 2-arg → 가변 인자 (...xs)
- self/codegen.fl + self/all.fl prelude string 변경
- baseline SHA256: 5877b9660e6f → <new-sha>
- deep fixed-point 10단 검증 완료
- I131 invariant 복원 (3-arg append 직접 사용)
"
```

---

## 롤백 절차

```bash
# 변경 후 회귀 발견 시
cp /tmp/stage1-pre.js stage1.js
cp /tmp/codegen-pre.fl self/codegen.fl
cp /tmp/all-pre.fl self/all.fl
sha256sum stage1.js                      # 5877b9660e6f... 복원 확인
git checkout -- CLAUDE.md docs/         # 문서 원복
```

---

## 위험 평가

| 위험 | 발생 가능성 | 회피 |
|------|-----------|------|
| reduce 0-arg 호출 (`(append)`) | **중** | 분기 처리 (xs.length === 0 → []) ✅ 명세 반영 |
| reduce 1-arg 호출 (`(append xs)`) | **중** | 분기 처리 (xs.length === 1 → xs[0]) ✅ 명세 반영 |
| Array.isArray 체크 회귀 | 낮음 | reduce 내부에 보존 |
| stage1 자기 컴파일 실패 | 낮음 | self 내부 (append a b) 만 사용 — 검증 완료 |
| deep fixed-point 미수렴 | 낮음 | prelude 는 string literal — 안정 |

---

## 다음 라운드 묶음 (이 PR 후)

1. **변경 B**: HTTP 서버 require (Y4-2 단계B 본 작업)
2. **변경 C**: `(- a b c)` left-fold (C1)
3. **변경 D**: let-rec lazy (C4)
4. **변경 E**: `loop` RESERVED (C3)

각각 별도 PR 또는 변경 B 와 C+D 묶음.

---

생성: 2026-04-26 (Year 2 라운드 1 마무리 시점)
실행 시작: 다음 세션 (사용자 승인 후)
