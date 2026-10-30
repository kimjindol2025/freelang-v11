# FreeLang v11-1 배포 가이드

## 번들 구조

```
bootstrap.js          1,543KB  언어 코어 (parser, interpreter, eval, stdlib 기본)
stdlib-extensions.js      6KB  dispatcher (require() 라우팅)

stdlib-ext-http.js       44KB  HTTP 서버
stdlib-ext-db.js         47KB  DB 드라이버 (MariaDB, MongoDB, SQLite, ORM)
stdlib-ext-workflow.js   78KB  워크플로우 / 서비스 메시
stdlib-ext-ws.js         16KB  WebSocket 서버 + 클라이언트
stdlib-ext-auth.js       21KB  인증 (WebAuthn, TOTP, crypto-rsa, mail)
stdlib-ext-ai.js         10KB  AI 연동 + 감사 로그
stdlib-ext-content.js    30KB  콘텐츠 처리 (markdown, blog, table, validation)
stdlib-ext-async.js      20KB  비동기 / 동시성 (channel, queue, immutable)
stdlib-ext-compile.js   139KB  FL 컴파일러 (parser + codegen + AST — 기능 비용)
stdlib-ext-registry.js    3KB  패키지 레지스트리
```

---

## 앱별 최소 배포 구성

| 앱 유형 | 필요 번들 | 총 크기 |
|---------|-----------|---------|
| CLI / 계산 / 스크립트 | `bootstrap` | **1,543KB** |
| HTTP REST API | + `ext-http` | 1,587KB |
| HTTP + DB | + `ext-http` + `ext-db` | 1,634KB |
| HTTP + DB + 인증 | + `ext-http` + `ext-db` + `ext-auth` | 1,655KB |
| WebSocket 앱 | + `ext-ws` | 1,559KB |
| 워크플로우 / 배치 | + `ext-workflow` | 1,621KB |
| 풀스택 (HTTP + DB + WS + Auth) | + http + db + ws + auth | 1,671KB |
| AI 에이전트 앱 | + `ext-ai` + `ext-workflow` | 1,631KB |
| 콘텐츠 플랫폼 (블로그/문서) | + `ext-http` + `ext-content` + `ext-db` | 1,664KB |
| 개발 도구 (FL 컴파일) | + `ext-compile` | 1,682KB |
| 전체 | 모든 번들 | ~1,951KB |

---

## require() 모듈 → 번들 매핑

| `require(...)` | 번들 파일 |
|----------------|-----------|
| `"http-server"` | `stdlib-ext-http.js` |
| `"mariadb"` `"mongodb"` `"db"` `"orm"` | `stdlib-ext-db.js` |
| `"workflow"` `"resource"` `"service"` | `stdlib-ext-workflow.js` |
| `"ws"` `"wsc"` | `stdlib-ext-ws.js` |
| `"webauthn"` `"totp"` `"crypto-rsa"` `"mail"` | `stdlib-ext-auth.js` |
| `"ai"` `"audit"` | `stdlib-ext-ai.js` |
| `"markdown"` `"blog"` `"table"` `"validation"` `"middleware"` | `stdlib-ext-content.js` |
| `"async"` `"channel"` `"queue"` `"immutable"` | `stdlib-ext-async.js` |
| `"compile"` | `stdlib-ext-compile.js` |
| `"registry"` | `stdlib-ext-registry.js` |

---

## compile 번들 비용 설명

`stdlib-ext-compile.js`는 139KB로 가장 큰 단일 extension 번들이다.

```
stdlib-compile.ts    3KB  — fl_compile_file / fl_compile API
parser.ts          100KB  — FL 전체 문법 파서
codegen-js.ts       30KB  — AST → JavaScript 코드 생성기
ast.ts              24KB  — AST 노드 타입 정의
lexer.ts            10KB  — 토크나이저
runtime-helpers.ts  13KB  — JS 런타임 프리앰블 생성기
```

`fl_compile_file`은 FL 소스를 읽어 JS로 변환하므로 파서 전체가 필요하다.
**기능 비용이 큰 번들**이며 추가 분해는 실익이 없다.
컴파일 기능이 필요 없는 앱은 이 번들을 포함하지 않으면 된다.

---

## bootstrap.js에 포함된 것

코어 언어 엔진 전체:

- `lexer` / `parser` / `interpreter`
- `eval-builtins` (기본 연산, 제어문, 컬렉션, 문자열, 파일 I/O)
- `stdlib-loader` (기본 stdlib 자동 로드)
- `stdlib-extensions.js` dispatcher 로딩 경로

bootstrap.js 단독으로 다음이 동작한다:
- 산술/문자열/컬렉션 연산
- 파일 읽기/쓰기
- JSON 파싱
- 기본 HTTP 클라이언트 (`http-get`)
- 셸 명령 실행
- 암호화 기본 (`crypto` 모듈)
- 타입 검사 / 패턴 매칭

---

## 배포 예시

### HTTP API 서버

```bash
# 배포 파일
bootstrap.js
stdlib-extensions.js
stdlib-ext-http.js

# FL 코드
(require "http-server")
(server-start 40101)
```

### HTTP + MariaDB 앱

```bash
bootstrap.js
stdlib-extensions.js
stdlib-ext-http.js
stdlib-ext-db.js
```

### 계산/CLI 스크립트 (최소)

```bash
bootstrap.js
stdlib-extensions.js
# — extensions 번들 불필요
```
