# FreeLang v11 — Node.js 독립 현황 (N-시리즈)

**작성일**: 2026-05-29  
**브랜치**: master (fx)  
**최신 커밋**: d484995f

---

## 목표

FreeLang v11 C 백엔드(FL → C → ELF)에서 Node.js 없이 완전한 애플리케이션을 실행한다.

```
FL 소스
  ↓ cgc-main.fl (C 코드젠)
  ↓ gcc + runtime/*.c
  ELF (Node.js 0개)
```

---

## N-시리즈 완료 현황

| 번호 | 내용 | 커밋 | 상태 |
|------|------|------|------|
| N-01/02 | 파일고급·프로세스·환경변수 C 포팅 | `538cc281` | ✅ |
| N-03 | json-parse/stringify C 구현 | `4e68c621` | ✅ |
| N-04 | crypto.c: JWT(HS256) + scrypt | `ed30d037` | ✅ |
| N-05 | HTTP 서버 C 포팅 (raw POSIX socket) | `b4fbe874` | ✅ |
| N-06 | SQLite3 DB C 포팅 + 통합 검증 | `33b51326` | ✅ |
| N-07 | stdlib 문자열 함수 8개 C 포팅 | `fb882f19` | ✅ |
| N-08 | stdlib 컬렉션 함수 18개 C 포팅 | `e6b72bea` | ✅ |

---

## runtime C 모듈 현황

| 파일 | 줄 수 | 주요 기능 |
|------|-------|----------|
| core.c | 290 | FLValue 타입 시스템, println, 기본 연산 |
| collection.c | 567 | vector/map 18종 C 포팅 |
| io.c | 125 | 파일 읽기/쓰기/존재 확인 |
| math.c | 205 | 수학 함수, fl_sleep_ms, now_ms |
| error.c | 28 | 에러 처리 |
| process.c | 108 | 환경변수, 프로세스 실행 |
| json.c | 153 | fl_json_parse / fl_json_stringify |
| crypto.c | 254 | JWT(HS256), scrypt 해싱 |
| **http.c** | **477** | HTTP 서버 (raw POSIX socket, 라우팅, 쿠키) |
| **db.c** | **132** | SQLite3 CRUD (fl_db_open/close/query/exec) |
| sqlite3.c | 9MB | SQLite amalgamation (서드파티) |

---

## cgc-main.fl dispatch 연결 현황 (1,556줄)

| 범주 | dispatch 규칙 수 | 예시 |
|------|----------------|------|
| 파일/프로세스/환경변수 | N-01/02 다수 | _fl_file_*, _fl_env_* |
| JSON | 2 | json-parse, json-stringify |
| 인증/암호화 | 5 | auth-jwt-sign/verify, auth-hash-password 등 |
| **HTTP 서버** | **9** | server-start/stop/html/json/status/redirect/html-cookie/set-cookie/route + server-get/post |
| **DB** | **4** | db-open/close/query/exec |
| 유틸 | 2 | sleep, now-ms |

---

## 통합 검증 결과 (2026-05-29)

### N-05 단독 — HTTP E2E

```
FL(test-http-server.fl) → cgc-main.fl → C → gcc → ELF

GET  /hello             → 200 HTML
GET  /api/echo?msg=x    → 200 JSON {"echo":"x","ok":true}
POST /submit            → 200 JSON {"received":{...},"ok":true}
경고 0 (프로젝트 코드)
```

### N-06 단독 — SQLite CRUD E2E

```
FL(test-sqlite-db.fl) → cgc-main.fl → C → gcc → ELF

CREATE TABLE            → OK
INSERT × 3             → OK
SELECT ORDER BY score   → count=3, first=alice
UPDATE SET score=100    → score=100 ✅
DELETE WHERE name=carol → remaining=2 ✅
경고 0 (프로젝트 코드)
```

### Gap 검증 (N-06 추가 확인)

| Gap | 내용 | 결과 |
|-----|------|------|
| Gap2 | 파일 DB close→reopen 지속성 | ✅ PASS |
| Gap3 | 없는 테이블 에러 경로 | ✅ 빈 배열 반환 |
| Gap4 | sqlite3.c 경고 출처 | ✅ 서드파티 amalgamation (프로젝트 코드 경고 0) |

### N-05 + N-06 통합 — 애플리케이션 스택 E2E

```
FL(test-http-sqlite-integration.fl)
  ↓ cgc-main.fl
  ↓ gcc (http.c + db.c + sqlite3.c + ...)
  ELF

GET  /users             → 200 JSON {users:[alice,bob], count:2}
POST /users {carol,28}  → 200 JSON {created:{name:carol,...}, ok:true}
GET  /users             → 200 JSON {users:[alice,bob,carol], count:3}
POST /users {age:99}    → 400 "name required"   (에러 경로)
=== INTEGRATION ALL PASS ===
```

---

## 현재 한계 / 미완료

| 항목 | 상태 | 비고 |
|------|------|------|
| WebSocket C 포팅 | ❌ 미구현 | JS 런타임 전용 |
| MariaDB C 포팅 | ❌ 미구현 | libmariadb 필요 |
| server-file (정적 파일) | ❌ dispatch 미연결 | http.c 구현 필요 |
| HTTP 요청 클라이언트 | ❌ 미구현 | http-get/post C 포팅 필요 |
| 멀티파트 폼 | ❌ 미구현 | 파일 업로드 불가 |
| cgc-main.fl 고정점 재검증 | ⚠️ 필요 | cgc-main.fl 수정 후 L4 SHA 갱신 필요 |

---

## 알려진 설계 결정

| 결정 | 이유 |
|------|------|
| libmicrohttpd 대신 raw POSIX socket | 외부 의존성 0 원칙 |
| sqlite3 amalgamation 단일 파일 | 외부 의존성 0 원칙 |
| cgc-main.fl dispatch (codegen-c.fl 미통합) | cgc-main.fl이 자가호스팅 진입점. codegen-c.fl은 별도 실험 파일 |
| sqlite3.c -Wall -Wextra 경고 허용 | 서드파티 코드, 수정 불가 |

---

## 다음 우선순위 후보

1. **cgc-main.fl L4 고정점 재검증** — 대규모 수정 후 SHA256 체인 갱신
2. **server-file dispatch 연결** — 정적 파일 서빙 완성
3. **HTTP 클라이언트 C 포팅** — outbound HTTP 요청 지원
4. **통합 테스트 자동화** — `make test-native` 단일 명령
