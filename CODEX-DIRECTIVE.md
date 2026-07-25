# CODEX 작업 지시서 — L2 고정점 재현 + 네이티브 cgc-bin 완성

**발행**: 2026-07-04 (Claude Code 검증 세션 기반)
**전제**: 이전 보고("atom 문제 해소, blocker가 fl_parse is not defined로 좁혀짐, L2 FAIL")를
Claude Code가 직접 재현해서 전부 사실 확인했다. 그 위에서 조사를 더 진행해 **핵심 원인을 찾았다**.

---

## 🎯 미션 — 결론부터

**`scripts/test-l2-fixpoint.sh`가 "FAIL"이라고 보고하는 것은 컴파일러 버그가 아니라
테스트 스크립트 자체의 버그였다.** 올바른 소스 파일 + 올바른 호출 방식을 쓰면
**JS 타겟 L2 고정점은 지금 이 순간 이미 통과한다** (아래 재현 명령으로 직접 확인 가능).

남은 진짜 작업은 두 가지:
1. `scripts/test-l2-fixpoint.sh`를 고쳐서 "FAIL" 오보를 없앤다 (쉬움, 우선)
2. 네이티브 C 타겟(cgc-bin)도 JS 타겟과 같은 원리로 고칠 수 있는지 확인한다 (핵심 작업)

---

## 🔬 근본 원인 분석 (재현 완료)

### 원인 1 — 잘못된 소스 파일

`self/codegen.fl` (386줄)은 `parse`/`lex`를 **호출만 하고 자체 정의하지 않는다**
(다른 파일 `self/lexer.fl`/`self/parser.fl`에 있음). 반면 `self/all.fl` (1390줄)은
`lex`(193번 줄), `parse`(607번 줄), `compile-file`(1067번 줄)을 **전부 자체 포함**한
완결된 단일 파일이다.

`bootstrap.js compile`은 **`(load "...")`나 크로스파일 참조를 인라인하지 않는다** —
단일 진입 파일 안에 정의된 것만 컴파일된 JS에 들어간다. 그래서 `self/codegen.fl`을
단독으로 컴파일하면 `parse`/`lex` 호출부만 남고 정의는 빠져서 `fl_parse is not
defined` / `parse is not defined`가 뜬다. **이건 컴파일러 버그가 아니라 애초에
`codegen.fl` 혼자서는 완결되지 않는 파일이라 생기는 당연한 결과다.**

### 원인 2 — 잘못된 호출 방식

`bootstrap.js compile`이 만드는 JS는 `module.exports`가 없는 **독립 실행 스크립트**다
(맨 끝에 `cli_main();`을 바로 호출). 그래서:

```bash
# ❌ 지금 스크립트가 쓰는 방식 — compile_file은 export된 적이 없어서 실패
node -e "require('/tmp/L1_codegen.js').compile_file('self/codegen.fl', '/tmp/L2_codegen.js')"
# → TypeError: require(...).compile_file is not a function
```

```bash
# ✅ 올바른 방식 — CLI 인자로 호출 (cli_main이 argv 파싱해서 처리)
node /tmp/L1_all.js compile self/all.fl -o /tmp/L2_all.js
# → Parsed: 222 nodes / Compiled self/all.fl -> /tmp/L2_all.js  (성공)
```

(참고: git 히스토리의 더 오래된 버전은 `node L1.js compile self/codegen.fl >
L2.js` 처럼 **stdout을 파일로 리다이렉트**하는 방식이었는데, 이것도 틀렸다 —
`compile-file`은 `println`으로 로그만 stdout에 찍고 실제 JS는 `file-write`로
디스크에 쓴다. 즉 예전 버전도, 지금 버전도 둘 다 잘못된 호출 방식이었다.)

### 재현 — 그대로 실행해서 확인할 것

```bash
cd /home/kimjin/freelang-v11

# L0 → L1
node bootstrap.js compile self/all.fl -o /tmp/L1_all.js
grep -c "^function lex\|function parse\b" /tmp/L1_all.js   # → 2 (자체 포함 확인)

# L1 → L2  (CLI 방식)
node /tmp/L1_all.js compile self/all.fl -o /tmp/L2_all.js

# L2 → L3
node /tmp/L2_all.js compile self/all.fl -o /tmp/L3_all.js

# 고정점 확인
diff /tmp/L2_all.js /tmp/L3_all.js && echo "✅ L2 == L3 (고정점 달성)"
```

**이 4단계를 그대로 실행하면 `✅ L2 == L3`이 나온다 — 2026-07-04 Claude Code
세션에서 직접 실행해서 확인함. 재검증 없이 다시 의심하지 말고, 안 되면 환경
문제(노드 버전 등)부터 의심할 것.**

---

## 할 일 — 순서대로

### 1. `scripts/test-l2-fixpoint.sh` 수정 (우선, 쉬움)

- 컴파일 대상을 `self/codegen.fl` → `self/all.fl`로 변경
- L1→L2, L2→L3 호출을 `require().compile_file()` 방식에서
  `node <L*.js> compile self/all.fl -o <출력>` CLI 방식으로 변경
- 통과 기준: `diff L2 L3`가 아무 출력 없이 exit 0

이 수정만으로 "L2 FAIL" 오보가 사라진다. **다만 이건 JS 타겟 고정점 검증이지
네이티브 cgc-bin(C 타겟) 문제를 해결하는 건 아니다 — 혼동하지 말 것.**

### 2. 네이티브 C 타겟(cgc-bin)도 같은 병이 있는지 확인 (핵심, 여기가 진짜 작업)

`self/codegen-c.fl`도 `self/codegen.fl`과 똑같이 `lex`/`parse`를 자체 정의하지
않는다 (확인 완료, grep 결과 0건). 그리고 **`self/all.fl`에 대응하는 C 타겟용
완결 파일(`all-c.fl` 같은 것)이 현재 존재하지 않는다.**

지금까지 시도한 "임시 parser.fl + codegen-c.fl + ir-validator.fl + driver 조합"
(`/tmp/cgc-main.out.js`)이 실패한 이유가 원인 1과 같은 문제(파일 조합이 불완전해서
lex/parse가 최종 산출물에 안 들어감)인지, 아니면 다른 문제(장시간 무출력으로
멈춘 것 — 무한루프나 데드락 가능성)인지 **둘 다 확인 필요**:

**2-1. 조합 완결성 확인**
```bash
grep -c "^(defn lex\|^(defn parse\b" self/lexer.fl self/parser.fl self/ast.fl self/codegen-c.fl self/ir-validator.fl self/run-cgc.fl
```
어느 파일에 lex/parse가 실제로 있는지 확인하고, `self/run-cgc.fl`이 `(load ...)`로
그것들을 참조하는 구조라면 — **`self/all.fl`을 만든 것과 같은 방식으로
lexer.fl+parser.fl+ast.fl+codegen-c.fl(+ir-validator.fl)을 손으로 이어붙인
`self/all-c.fl` 단일 파일을 만들어라.** `all.fl`의 구조(맨 끝에 `cli_main()`
호출, `compile-file`이 파일 인자 받아 처리)를 그대로 따르되 `fl->js-with-prelude`
대신 C 코드 생성 함수(codegen-c.fl의 진입 함수)를 호출하도록만 바꾸면 된다.

**2-2. 무한루프/행 원인 확인**
합친 파일을 만든 뒤 `timeout 30 node <컴파일된 JS> compile <input.fl> -o out.c`
처럼 **반드시 timeout을 걸고** 실행해서, 진짜 멈추는지 아니면 이번엔 제대로
끝나는지 확인. 멈춘다면 어느 함수에서 멈추는지 `node --prof` 또는 중간에
`println` 디버그 찍어서 격리할 것 — "장시간 무출력"이라고만 하지 말고 정확한
정지 지점을 특정해야 한다.

**2-3. 통과 기준**
- `self/all-c.fl`(가칭)을 `node bootstrap.js compile self/all-c.fl -o L1.js`로
  컴파일 → 그 L1.js로 임의의 `.fl` 파일을 C로 컴파일 → gcc로 빌드 →
  실행해서 정상 동작 확인 (fib, hello world 등 최소 재현)
- 원래 목표인 "native cgc-bin 재생성" — 이 파이프라인으로 새 `bin/cgc-bin`을
  만들고 타임스탬프 갱신 + fx2 conformance 재검증까지 가능한지 확인

---

## 검증 규율

1. **"멈췄다/안 된다"는 timeout 없이 판단하지 말 것.** 이번 세션에서도 원인이
   실제로는 "호출 방식이 틀림"이었지 "안 됨"이 아니었다 — 재현 명령을 그대로
   실행해서 정확히 어느 줄에서 어떤 에러가 나는지 잡을 것.
2. 통과 선언은 `diff`/실제 실행 결과로만. "컴파일 성공" ≠ "고정점 달성" ≠ "동작함".
3. `/tmp/*.js`, `/tmp/*.out.js` 같은 중간 산출물은 커밋 금지.
4. 이 문서에 적힌 재현 명령이 여러분 환경에서 실패하면, 먼저 그 실패 자체를
   정확히 기록하고 (에러 메시지 전체) 그 다음 진행할 것 — "안 됐다"고만 보고 금지.

## 완료 정의

- [ ] `scripts/test-l2-fixpoint.sh` 수정 → `✅ L2 == L3` 정상 출력
- [ ] C 타겟용 완결 파일(`self/all-c.fl` 또는 동등물) 작성
- [ ] 그걸로 컴파일한 JS 드라이버로 최소 재현(.fl → .c → gcc → 실행) 성공
- [ ] 네이티브 `bin/cgc-bin` 재생성 + 타임스탬프 갱신
- [ ] fx2 conformance / ssr-app 재검증 (여기 도달하기 전엔 의미 없음, 순서 지킬 것)
- [ ] Gogs 커밋 + 블로그 기록
