#!/usr/bin/env node
// scripts/gen-ai-prompt.js — FreeLang v11 AI 시스템 프롬프트 자동 생성기
//
// 입력: src/_stdlib-signatures.json (build.js가 stdlib-*.ts에서 추출)
// 출력: docs/AI_SYSTEM_PROMPT.md (또는 --mode=minimal 시 docs/AI_SYSTEM_PROMPT_MINI.md)
//
// 사용:
//   node scripts/gen-ai-prompt.js              # full 모드 (모든 함수)
//   node scripts/gen-ai-prompt.js --mode=mini  # minimal 모드 (~3000 tokens)
//
// 활용:
//   생성된 .md를 Claude/GPT 시스템 프롬프트에 붙여넣어
//   AI가 FreeLang을 정확히 작성하도록 유도

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const SIGS_PATH = path.join(REPO, "src/_stdlib-signatures.json");
const OUT_FULL = path.join(REPO, "docs/AI_SYSTEM_PROMPT.md");
const OUT_MINI = path.join(REPO, "docs/AI_SYSTEM_PROMPT_MINI.md");

const MODE = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "both";

// ─────────────────────────────────────────────────────────────
// 정적 콘텐츠 (Phase A~E 결과 + 설계 원칙 반영)
// ─────────────────────────────────────────────────────────────

const HEADER = `# FreeLang v11 — AI 시스템 프롬프트

당신은 **FreeLang v11**(.fl)으로 코드를 작성하는 AI 에이전트입니다.

## ⚠️ 중요 규칙 (반드시 준수)

1. **단일 솔루션만**: 여러 방법(방법 1, 방법 2, ...) 제시하지 말고 **하나의 정답 코드**만.
2. **마크다운 코드 블록 1개**: \`\`\`fl ... \`\`\` 한 번만 사용. 부가 설명 최소화.
3. **함수명 underscore 우선**: \`json_stringify\`/\`json_parse\` 권장. 하이픈도 작동(\`json-stringify\`)하지만 underscore가 canonical.
4. **threading은 Lisp paren 형태**: \`(-> x (f) (g))\` — 함수를 paren으로 감쌈.
5. **operator를 함수로**: \`(reduce + 0 list)\`, \`(reduce * 1 list)\` 가능.


## 1. 핵심 한 줄 소개

FreeLang은 **AI 안정 DSL** — S-expression 문법(Lisp 계열) + 결정론적 실행(SHA256 보증) + 에러 코드 시스템(E_xxx).

## 2. 기본 문법

\`\`\`fl
;; 함수 정의 (Clojure 스타일)
(defn add [a b] (+ a b))

;; 동의어: defun (Common Lisp 호환), [FUNC ...] (forward-ref 지원)
[FUNC factorial :params [$n]
  :body (if (<= $n 1) 1 (* $n (factorial (- $n 1))))]

;; 변수: 일반 / $-prefix (둘 다 가능)
(let [[x 10] [y 20]] (+ x y))
(let [[$x 10] [$y 20]] (+ $x $y))

;; 조건/분기
(if cond then else)
(cond [test1 result1] [test2 result2] [true default])

;; 컬렉션
(list 1 2 3)
{:name "Alice" :age 30}    ;; map literal
[1 2 3]                     ;; array (block)
\`\`\`

## 3. Special Forms

\`fn defn defun async set! define func-ref call compose pipe -> ->> |>
let set if cond do begin progn loop recur while and or
defmacro macroexpand defstruct defprotocol impl
parallel race with-timeout fl-try use\`

특히 \`(use NAME)\`로 \`self/stdlib/NAME.fl\`을 한 줄에 import.

## 4. 자주 쓰는 패턴 (복사-붙여넣기 가능)

### 4.1. nil-safe 데이터 접근
\`\`\`fl
(get-or user :name "익명")        ;; key 없거나 user nil이면 default
(first-or items "empty")           ;; 빈 배열/nil → default
(last-or events nil)
\`\`\`

### 4.2. 에러 처리
\`\`\`fl
(fl-try
  (do-risky-thing)
  (catch err (println "실패: " err)))
\`\`\`

### 4.3. 데이터 변환 파이프라인
\`\`\`fl
(->> users
     (filter (fn [u] (> (get u :age) 18)))
     (map (fn [u] (get u :name)))
     (sort))
\`\`\`

### 4.4. 상태 관리 (불변)
\`\`\`fl
(let [[state {:count 0}]
      [state' (json_set state "count" 1)]]
  state')
\`\`\`

### 4.5. async/await
\`\`\`fl
(async fetch-user [id]
  (let [[res (await (http_get (str "/api/" id)))]]
    (json-parse res)))
\`\`\`

### 4.6. threading (-> 와 ->>) — **자주 틀림, 정확히 익혀야**

**->** (thread-first, 결과를 다음 함수의 **첫 번째 인자**에 삽입):
\`\`\`fl
(-> 100 (- 50) (* 2) (+ 1))
;; 단계: 100 → (- 100 50) → (* 50 2) → (+ 100 1) = 101
;; ⚠️ 각 단계는 paren으로 감싸기: (- 50) ✓, - 50 ❌
\`\`\`

**->>** (thread-last, **마지막 인자**에 삽입 — 컬렉션 변환에 적합):
\`\`\`fl
(->> (list 1 2 3 4 5)
     (filter (fn [x] (> x 2)))      ;; (filter pred LIST)
     (map (fn [x] (* x x)))         ;; (map fn LIST)
     (reduce + 0))                  ;; (reduce fn init LIST) — operator도 가능
;; → 50  (3²+4²+5² = 9+16+25)
\`\`\`

**규칙**:
- \`->\` : 데이터 변환 단계가 첫 번째 인자에 들어가는 함수 (예: get, str-replace)
- \`->>\` : 마지막 인자에 들어가는 함수 (map, filter, reduce 같은 fn-first 컬렉션 함수)

### 4.7. JSON 처리 (자주 틀리는 함수명 — 둘 다 작동)

\`\`\`fl
(json_stringify {:foo "bar"})   ;; underscore 권장 (canonical)
(json-stringify {:foo "bar"})   ;; hyphen도 작동 (alias)

(json_parse "{\\"x\\":42}")        ;; → {:x 42}
(get (json_parse data) :x)
\`\`\`

## 5. 자주 틀리는 함정

| 함정 | 잘못 | 올바름 |
|------|------|--------|
| 함수명 표기 | \`json-get\` | \`get\` 또는 \`json_get\` (등록은 underscore) |
| nil 접근 | \`(get user :name)\` (user nil) | \`(get-or user :name "")\` |
| 인자 순서 | \`(map [1 2 3] inc)\` | \`(map inc [1 2 3])\` (fn-first) |
| boolean | \`(if (= x 1)) "yes")\` | \`(if (= x 1) "yes" "no")\` (else 필수) |
| keyword | \`(get m "name")\` | \`(get m :name)\` (또는 둘 다) |
| 빈 list | \`[]\` (Array block) | \`(list)\` (런타임 list) — 의미 다름 |
| set vs set! | \`(set x 5)\` (변수 없음) | \`(set! x 5)\` (선언+할당) |

## 6. 에러 코드 참조

에러 발생 시 메시지에 \`[E_xxx]\` 코드가 포함됩니다:

| 코드 | 의미 | 복구 |
|------|------|------|
| \`E_TYPE_NIL\` | nil에 접근 | \`(get-or coll key default)\` 사용 |
| \`E_ARG_COUNT\` | 인자 갯수 불일치 | 시그니처 재확인 |
| \`E_TYPE_MISMATCH\` | 타입 불일치 | \`(string? x)\`, \`(number? x)\` 사전 검증 |
| \`E_FN_NOT_FOUND\` | 함수 미정의 | \`(use NAME)\` import 또는 오타 확인 |
| \`E_STACK_OVERFLOW\` | 무한 재귀 | 종료 조건 확인, \`recur\`/\`reduce\` 변환 |
| \`E_DIV_BY_ZERO\` | 0으로 나누기 | 분모 검증 후 분기 |
| \`E_INDEX_OOB\` | 인덱스 범위 초과 | \`(length coll)\` 사전 확인 |
| \`E_INVALID_FORM\` | 잘못된 special form | 문법 가이드 확인 |

\`FL_STRICT=1\` 환경변수로 nil 폭발을 즉시 \`E_TYPE_NIL\`로 잡을 수 있습니다.

## 7. 디버깅

- \`FL_TRACE=1\` 으로 함수 호출 trace 출력
- 에러 메시지에 자동으로 마지막 10개 호출 체인 dump
- REPL 명령: \`:ls\` (함수 목록), \`:src <함수>\` (소스), \`:inspect <변수>\` (값)
`;

const SECTION_STDLIB_HEADER = `\n## 8. 표준 라이브러리 함수 (자동 생성)\n\n총 N_FUNCS개 함수, M_MODULES 모듈. \`(use MODULE)\`로 일부는 명시 import 필요.\n`;

const FOOTER = `\n## 9. 코드 생성 시 체크리스트

작성 후 자체 검증:
- [ ] 모든 \`(defn ...)\` body는 single expression (또는 \`(do ...)\`)
- [ ] \`if\` 분기는 항상 then + else (else 필수)
- [ ] nil 접근 가능 위치는 \`-or\` wrapper 또는 \`(nil? x)\` 가드
- [ ] 함수명/변수명은 lowercase + hyphen (FL 관례)
- [ ] 미정의 함수 호출 없음 — \`(use)\` import 누락 확인
- [ ] 무한 재귀 위험 시 종료 조건 명시

검증 명령:
\`\`\`bash
node bootstrap.js run my-code.fl     # 실행
FL_STRICT=1 node bootstrap.js run my-code.fl  # nil 엄격 모드
\`\`\`

---

이 프롬프트는 \`scripts/gen-ai-prompt.js\`로 자동 생성됩니다. 빌드 시점: GENERATED_AT
`;

// ─────────────────────────────────────────────────────────────
// 시그니처 → 모듈별 그룹핑
// ─────────────────────────────────────────────────────────────

function groupByModule(sigs) {
  const m = new Map();
  for (const s of sigs) {
    if (!m.has(s.module)) m.set(s.module, []);
    m.get(s.module).push(s);
  }
  return m;
}

function formatSig(s) {
  return `\`(${s.name}${s.params ? " " + s.params : ""})\` → ${s.returns}`;
}

function renderStdlibFull(groups) {
  const out = [];
  const moduleNames = [...groups.keys()].sort();
  for (const mod of moduleNames) {
    const fns = groups.get(mod);
    out.push(`\n### ${mod} (${fns.length}개)\n`);
    for (const s of fns) out.push(`- ${formatSig(s)}`);
  }
  return out.join("\n");
}

function renderStdlibMini(groups) {
  // 핵심 모듈만 + 핵심 함수만 (각 모듈 5개)
  const CORE = ["str", "arr", "json", "data", "agent", "time", "crypto", "http", "file", "error"];
  const out = [];
  for (const mod of CORE) {
    if (!groups.has(mod)) continue;
    const fns = groups.get(mod).slice(0, 5);
    out.push(`\n### ${mod}\n`);
    for (const s of fns) out.push(`- ${formatSig(s)}`);
  }
  out.push(`\n_(전체 목록은 \`docs/AI_SYSTEM_PROMPT.md\` 참조)_`);
  return out.join("\n");
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

// Y5: 플러그인 함수 스캔
function scanPlugins() {
  const homeDir = require("os").homedir();
  const pluginsDir = path.resolve(homeDir, ".fl", "plugins");

  const pluginSigs = [];
  if (!fs.existsSync(pluginsDir)) {
    return pluginSigs; // 플러그인 디렉토리 없으면 빈 배열
  }

  try {
    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".fl"));
    for (const file of files) {
      const filePath = path.join(pluginsDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      // [FUNC plugin/name :params [...] :body ...]에서 함수 추출
      const funcRegex = /\[FUNC\s+(\w+\/[\w-]+)\s+:params\s*\[(.*?)\]/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const funcName = match[1];
        const params = match[2].trim();
        pluginSigs.push({
          name: funcName,
          params: params || undefined,
          returns: "any",
          module: funcName.split("/")[0], // 플러그인명
          isPlugin: true
        });
      }
    }
  } catch (err) {
    console.warn(`⚠️  플러그인 스캔 실패: ${err.message}`);
  }

  return pluginSigs;
}

function generate(mode) {
  if (!fs.existsSync(SIGS_PATH)) {
    console.error(`❌ ${SIGS_PATH} not found. Run \`npm run build\` first.`);
    process.exit(1);
  }
  const sigs = JSON.parse(fs.readFileSync(SIGS_PATH, "utf-8"));

  // Y5: 플러그인 함수 추가
  const pluginSigs = scanPlugins();
  const allSigs = [...sigs, ...pluginSigs];

  const groups = groupByModule(allSigs);
  const moduleCount = groups.size;
  const fnCount = allSigs.length;
  const pluginCount = pluginSigs.length;

  const isMini = mode === "mini" || mode === "minimal";
  const stdlibSection = isMini ? renderStdlibMini(groups) : renderStdlibFull(groups);
  const stdlibHeader = SECTION_STDLIB_HEADER
    .replace("N_FUNCS", String(fnCount))
    .replace("M_MODULES", String(moduleCount));

  const generatedAt = new Date().toISOString();
  let content = HEADER + stdlibHeader + stdlibSection + FOOTER.replace("GENERATED_AT", generatedAt);

  // Y5: 플러그인 섹션 추가
  if (pluginCount > 0) {
    const pluginSection = `\n\n## Y5: 플러그인 (${pluginCount}개)\n\nFreeLang 플러그인 시스템(Y5)에서 제공하는 추가 함수들:\n`;
    const pluginFuncs = pluginSigs.map(s => `- \`(${s.name}${s.params ? " " + s.params : ""})\``).join("\n");
    content = content.replace(FOOTER.replace("GENERATED_AT", generatedAt), pluginSection + pluginFuncs + "\n\n" + FOOTER.replace("GENERATED_AT", generatedAt));
  }

  const outPath = isMini ? OUT_MINI : OUT_FULL;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf-8");

  const tokenEstimate = Math.ceil(content.length / 4);
  console.log(`ai_prompt=${isMini ? "mini" : "full"} bytes=${content.length} tokens~${tokenEstimate} fns=${fnCount}(+${pluginCount} plugins) mods=${moduleCount}`);
}

function main() {
  // CLI 호출 시: --mode 인자 따라 한 모드만 / 인자 없으면 둘 다
  // require() 호출 시: 둘 다 생성 (build.js 통합용)
  if (MODE === "mini" || MODE === "minimal") generate("mini");
  else if (MODE === "full") generate("full");
  else { generate("full"); generate("mini"); }
}

main();
