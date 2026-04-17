# FreeLang v11.1 → v11.11 — AI-first 하루치 진화 로그

**2026-04-17** · 하루 동안 v11 을 **AI 전용 언어**로 다듬은 기록.
미용실 앱(`beauty-salon-app`) 을 MariaDB 로 전환하다 발견한 결함에서
시작해, 언어 레이어의 "인간 친화 장식" 을 걷어내고 AI 에이전트의
피드백 루프를 좁히는 과정이다.

---

## TL;DR

| 버전 | 핵심 | 커밋 |
|-----|------|------|
| v11.1 | Strict `$var` throw, `let [[$x]]`→`[$x]`, `defn`, JSON body 자동 파싱 | `54350bf` |
| v11.2 | `npm run build` 복구, 에러에 `file:line`, `(get)` keyword/string 동치 | `81fb24e` |
| v11.3 | REPL persistent interpreter + `~/.fl_history` | `5391d41` |
| v11.4 | `fn-doc` CLI, `test:fast`, 에러에 파일명 | `2ece9c3` |
| v11.5 | `stdlib-mariadb` 공식 격상 (mariadb CLI 직접, socket autodetect) | `28673e8` |
| v11.6 | (친화적 한글 에러 매핑 — 9에서 롤백) | `a937d27` |
| v11.7 | regression 테스트 +48 | `5dddf01` |
| v11.8 | beauty-salon `scripts/start.sh --detach` + graceful stop | `1484921` |
| v11.9 | **AI-first 정책 선언** — 인간용 장식 전면 롤백 | `4d4a9c9` |
| v11.10 | 코드 리뷰 4종 (sql-str 이스케이프, FL_STRICT, fn-doc embed, let 혼합 throw) | `5c50e67` |
| v11.11 | XSS 방어 (`innerHTML` → DOM API), 업로드 catch, 기본 a11y | `f25c802` |

테스트: 444 → **583** (+139). 커버리지 23% → 24% (+1%p, 단위 수 대비).

---

## 출발점: Silent Failure

미용실 앱을 SQLite → MariaDB 로 옮기던 중:

```lisp
(let [name (get body "name")]
  (mariadb_exec "db"
    (str "INSERT ... VALUES ('" name "')")))
```

DB 에 `'name'` 문자열이 들어갔다. 변수 `name` 이 해소되지 않아
심볼 이름이 그대로 평가된 것. 파서는 조용히 넘어갔고 런타임도
조용히 진행했다. 1 시간 디버깅.

원인 두 가지:
1. v11 `let` 은 `[[$x expr]]` 2 차원 대괄호 + `$` 접두사 강제 — 1 차원 `[x expr]` 은 다른 AST 로 파싱되지만 에러가 아니었다.
2. `interpreter.ts` 의 심볼 resolution 이 **미해결 시 literal value 를 그대로 반환** — 즉 심볼이 변수 lookup 실패해도 문자열로 downgrade.

---

## v11.1 — 언어 레이어 수술

- **Strict Variable** (`$x` 미해결 → throw)
- **let 3 종 지원**: 기존 `[[$x expr]]` + 신규 `[$x expr]` + bare `[x expr]` (`$` 자동 추가)
- **`(defn ...)`** macro 확장 (`defn` → `define name (fn ...)`)
- **HTTP body 자동 JSON 파싱** (Content-Type 체크)

```lisp
;; 모두 동등
(let [[$x 5] [$y 10]] (+ $x $y))
(let [$x 5 $y 10]    (+ $x $y))
(let [x 5 y 10]      (+ x y))

(defn double [x] (* x 2))  ;; bare symbol OK
```

Literal symbol 은 여전히 permissive 유지. 이유: `(+ 1 2)` 의 `+`,
`(map fn-ref list)` 의 `fn-ref` 같이 연산자·함수 이름으로 eval() 에
들어오는 경우가 있기 때문. v11.10 에서 `FL_STRICT=1` opt-in 으로
이 잔여 permissive 마저 끌 수 있게 했다.

---

## v11.2 — DX 인프라

- `npm run build` 복구 (`esbuild` 의 bin wrapper 이슈 → Node API 직접 호출)
- `Undefined variable: '$x' (file.fl:3)` 에 **파일:라인 정보**
- `(get obj :key)` 와 `(get obj "key")` 동치 보장 (keyword AST 노드까지 대응)
- `docs/API.md` 자동 생성 (265 함수, 41 모듈)

---

## v11.5 — MariaDB 공식 격상

v11.1~v11.4 동안 `beauty-salon-app/bootstrap.js` 에 매번 `mariadb_exec`
CLI 함수를 수동 주입해야 했다. freelang-v11 재빌드 = 복붙 반복.

해결: `src/stdlib-mariadb.ts` 를 **mariadb CLI 직접 호출 방식**으로
재작성하고 `stdlib-loader.ts` 에 정식 등록. Socket autodetect
(Termux / Debian / RHEL / /tmp fallback) 추가.

이후 beauty-salon-app 은 `cp bootstrap.js` 한 줄로 동기화 끝.

---

## v11.6 → v11.9 — "인간용 금지"

v11.6 에서 MariaDB 에러를 친화적 한국어로 매핑했다:

```
ERROR 1366 (22007): Incorrect integer value: 'abc' for column `x`
→ 타입 불일치 — 컬럼 'x'는 INT 인데 'abc' 가 들어옴
```

사용자 피드백: **"인간용 진화 금지"**.

v11 은 AI 전용 언어. 에러 코드 원본이 기계 파싱에 더 유리하고,
한국어 요약은 AI 가 오히려 역파싱해야 하는 노이즈다.

v11.9 에서 롤백·정리:
- `friendlyError()` 함수 제거 → `stderr` 원본 passthrough
- `fn-doc` 출력 ANSI 색 제거 → **JSON stdout**
- `start.sh` 이모지·한글 → **`app=running pid=X port=Y log=...`** key=value
- `main.fl` 부팅 println 10 줄 → `app=listening port=X db=Y` 1 줄
- VS Code 확장(`v11.3` 에 추가했던) **삭제** — 인간 개발자 도구

**원칙 확정**: v11 언어·도구 레이어에 인간 친화 장식 추가 금지.
AI 친화만 유지 (JSON, key=value, error code passthrough, 파일:라인).

```
fn-doc 출력:
{"query":"mariadb_query","found":true,
 "exact":[{"name":"mariadb_query","module":"mariadb",
           "params":"db sql [params]","returns":"rows[] (SELECT)"}]}

start.sh 출력:
mariadb=running sock=/data/data/com.termux/files/usr/tmp/mysqld.sock
app=running pid=27185 port=30322 log=/tmp/beauty-salon.log

stop.sh 출력:
app=stopped pid=27185 method=sigterm waited=1s
```

**예외**: 비즈니스 도메인 UI (고객 대면 HTML 갤러리 등) 는 장식 허용.
v11 언어 장식과는 별개 레이어이기 때문.

---

## v11.10 — 코드 리뷰 4 종

오늘 쌓인 코드에 셀프 리뷰:

1. **`sql-str` 이스케이프** — `O'Brien` 같은 입력이 SQL injection
   으로 깨지지 않게 `\\` 와 `'` 이중화. (NULL byte·유니코드 제어문자
   완벽 방어는 prepared statement 필요 — mariadb CLI 한계)
2. **`FL_STRICT=1` opt-in** — Literal symbol 미해결도 strict throw,
   기본은 하위 호환 permissive.
3. **`fn-doc` 배포 대응** — `scripts/build.js` 가 빌드 전에
   `src/_stdlib-signatures.json` 생성 → esbuild json loader 로 embed.
   bootstrap.js 단독 배포 환경에서도 `fn-doc` 작동.
4. **`evalLet` 혼합 감지** — 2D `[[$x ...]]` 와 1D `[$x ...]` 혼합
   입력 시 throw. 이전에는 첫 원소만 보고 나머지 조용히 무시.

---

## v11.11 — 프론트엔드 보안

미용실 앱 홈 페이지 리뷰:

```javascript
// BEFORE (stored XSS)
d.innerHTML = '<img src="/images/' + i.filename + '"/><p>'
            + i.original_name + '</p>';

// AFTER (DOM API)
const img = document.createElement('img');
img.src = '/images/' + encodeURIComponent(i.filename);
img.alt = i.original_name || i.filename;
img.loading = 'lazy';
const p = document.createElement('p');
p.textContent = i.original_name || i.filename;
d.append(img, p);
```

검증: `<script>alert(1)</script>.jpg` 파일명으로 업로드해도
브라우저에서 텍스트로만 표시. 업로드 에러 핸들링 (`response.ok`
체크, `.catch()`, `.finally()`), 기본 a11y (`alt`, `aria-label`,
`role="status" aria-live="polite"`, `role="region"`) 추가.

---

## 회고

**잘된 것**
- Silent failure 박멸 (strict throw + FL_STRICT)
- `fn-doc` JSON + embed — AI 가 stdlib 을 grep 대신 조회
- key=value / JSON 출력 일관성
- MariaDB CLI stdlib 공식화 — 주입 반복 제거
- 583 regression 테스트로 안전망 확보

**잘못된 것**
- v11.6 친화적 한글 에러 — 되돌렸다
- v11.3 VS Code 확장 — 되돌렸다
- 두 시도 다 "도움 되는 것 같아서" 추가했다가 정책 위반으로 롤백.
  **기본값은 AI 친화, 인간 친화는 opt-in 도 금지**

**남은 것** (프로토타입 → 프로덕션 약 55% 부족)
- SQL injection NULL byte 완벽 방어 → 서버 드라이버 필요
- CSRF 토큰
- multipart upload (현재 base64)
- SSR (v11 App Router 는 있지만 미용실 앱에서 미활용)
- 테스트 커버리지 (26% → 목표 50%)
- `eval-builtins.ts` 5,540 줄의 대부분 미검증

---

## 교훈

> v11 은 **AI 가 읽고, AI 가 쓰고, AI 가 디버깅한다.**
>
> 에러 메시지도, 로그도, 도움말도 JSON/key=value 가 정답이다.
> 한국어 요약·이모지·색깔·진행바는 AI 의 스톱 워드다.

**다음 세션** 에 인계할 것:
- `memory/v11_ai_first_policy.md` — 인간용 장식 금지 규칙
- `memory/role_backend_focus.md` / `role_frontend_focus.md` — AI 역할 분리
- 프론트엔드 AI: multipart + SSR + render-\* 활용 재작성
- 백엔드 AI: 인증/권한, 테스트 커버리지 50%, NULL byte 방어

---

**커밋 범위**: `a4bfdbd..f25c802` (v11) / `6345c4c..f25c802` (beauty-salon-app)
**테스트**: 583 passed, 0 failed, 17 suites
**빌드**: 1.1 MB bootstrap.js, 67 ms esbuild
