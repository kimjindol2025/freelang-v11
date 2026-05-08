# FreeLang v11 로드맵

> **언어 정의**: AI 에이전트 실행 엔진  
> **설계 철학**: Deterministic + Self-Hosted + AI-First  
> **업데이트**: 2026-05-08

---

## 완료된 것 ✅

| 항목 | 완료일 |
|------|--------|
| L0: TypeScript bootstrap.js | 초기 |
| L1: self/all.fl → stage1.js | 2026-04 |
| L2: 17/17 의미 동등성 증명 | 2026-05-02 |
| **L3: stage1 → stage2 자기 컴파일 (클로저 검증)** | **2026-05-03** |
| AI-Native Phase 1~4 (fn-meta, effects, ^pure, property-based) | 2026-05-01 |
| P0~P1: 에러처리, 병렬실행, 보상TX, Observability | 2026-04-29 |
| MariaDB Pool + MongoDB Wire Protocol | 2026-04-30 |
| REPL 디버거 강화 | 2026-04-30 |
| npm 11.2.0 배포 | 2026-05-03 |
| **P0: Content-Type case-insensitive 수정** | **2026-05-03** |
| **P0: `freelang patch` 명령 추가** | **2026-05-03** |
| **v11.6.0: LIR-002 assoc/dissoc 키 정규화** | **2026-05-08** |
| **v11.6.0: env_get nil 반환 + env-or 헬퍼** | **2026-05-08** |
| **v11.6.0: catch 타입 분기 — code→category 직접 매핑** | **2026-05-08** |

---

## 현재 진행 중 🔧

### 테스트 93% → 100%

현재: 831/832 (99.9%)  
남은 실패: verify-self-host.sh tier2 PASS 82 → 86 기준

---

## 다음 작업 (우선순위 순)

### ~~P0 — Content-Type 헤더 강제 버그 수정~~ ✅ 완료 (2026-05-03)

**수정**: `bootstrap.js` `sendResponse` case-insensitive 헤더 탐색  
**커밋**: 77c48955

---

### ~~P0 — `freelang patch` 명령 추가~~ ✅ 완료 (2026-05-03)

**수정**: `bootstrap.js`에 `patch` 서브커맨드 구현  
**커밋**: 77c48955  
**사용법**:
```bash
freelang patch <file> --find "<text>" --replace "<text>"
freelang patch <file> --insert-after "<anchor>" --content "<block>"
```
**완료 조건**: 특수문자(백틱, ${}, 한글, JSON) 포함 문자열 안전 처리

---

### P1 — 테스트 99.9% → 100%

**남은 1개**: `verify-self-host.sh tier2` PASS 82 → 86  
**원인**: fuzz invariant crash (file_read/write 선언 충돌 해결 중)

---

### P1 — `shell_env` nil 반환 수정

**증상**: 미정의 환경변수가 `""` 반환 → `(or "" default)` 가 `""` 선택  
**수정**: 미정의 시 `nil` 반환 + `(env-or key default)` 헬퍼 추가

---

### P1 — `mariadb_pool_query` 빈 결과 `[]` 반환

**증상**: 빈 테이블 조회 시 `nil` 반환 → `(map fn nil)` 폭발  
**수정**: 빈 결과 시 `nil` 대신 `[]` 반환

---

---

## "언어가 편하려면" — 실사용 피드백 (2026-05-08)

> Claude와 실제 개발하며 발견한 불편함. Python보다 FreeLang이 편해지려면 필요한 것들.

### 현재 Python이 더 편한 이유 (솔직한 진단)

| 항목 | Python | FreeLang 현재 | 목표 |
|------|--------|---------------|------|
| 실행 속도 | 즉시 | 1-2초 (bootstrap 로딩) | < 0.3초 |
| 에러 위치 | 파일+줄+컨텍스트 | 줄번호만 | 파일+줄+3줄 컨텍스트 |
| REPL | 즉시 실험 | 있지만 무거움 | 경량 즉시 REPL |
| 파일 조작 | 내장 완전 | stdlib 있지만 인코딩 불안 | `file-replace`, `file-lines` 안정화 |
| HTTP | async 기본 | spawnSync curl (블로킹) | Node fetch 기반 async |
| 인코딩 | 자동 | 한글 주석 편집 도구 오작동 | UTF-8 완전 지원 |

### Phase "편한 언어" — 구현 순서

#### P1 — HTTP async (curl → fetch) 🔧 진행예정
**문제**: `spawnSync("curl")` → 고부하에서 직렬 병목  
**해결**: Node.js 내장 `fetch` API로 교체 (v18+ 기본 지원)  
**파일**: `src/stdlib-http.ts:31` `curlGetStatusAndBody` 함수  
**기대효과**: 동시 10 요청 기준 10배 처리량 향상

#### P1 — 모듈 캐시 🔧 진행예정
**문제**: import마다 재파싱 → 복잡한 앱에서 시작 수초 지연  
**해결**: `moduleCache: Map<path, exports>` 추가  
**파일**: `src/eval-module-system.ts:196`  
**기대효과**: 10개 모듈 앱 기준 시작 시간 80% 단축

#### P2 — 실행 속도 (bootstrap 로딩)
**문제**: `node bootstrap.js` 로딩 1-2초  
**해결**: L4 단일 바이너리 (Bun SEA) 또는 bootstrap 경량화  
**기대효과**: `./freelang run` 즉시 실행

#### P2 — 파일 조작 stdlib 안정화
**문제**: `file_read`/`file_write` 인코딩 처리 불안정  
**해결**: UTF-8 강제 + `file-lines`, `file-replace`, `file-append` 완성  
**기대효과**: Python 없이 파일 편집 가능

#### P3 — 타입 추론 강화
**문제**: 사용자 정의 함수 반환형 = "any" → 런타임까지 에러 모름  
**해결**: 함수 body에서 반환형 추론 (Hindley-Milner 경량 버전)  
**기대효과**: 컴파일 타임 에러 30% → 60%

---

### P2 — Phase L4: Bun 단일 바이너리

**목표**: `bun build --compile stage1.js --outfile freelang`  
**완료 조건**: Node.js 없이 `./freelang run app.fl` 실행  
**예상 작업량**: 1세션

---

### P2 — 에러 메시지에 파일명 + 컨텍스트

**증상**: `"line 53 col 0"` — 어느 파일인지 모름. 디버깅 2배 소요.  
**수정**: 에러 출력에 파일명 + 해당 줄 코드 3줄 컨텍스트 추가

---

### P1 — `freelang migrate` — DB 마이그레이션 관리

**배경**: Supabase에서 배운 것 — 스키마 변경 추적 없으면 "이 컬럼 언제 추가했지?" 반복  
**파일**: `bootstrap.js` CLI + `migrations/` 폴더 규칙  
**명령**:
```bash
freelang migrate create "add_status_to_orders"   # 파일 생성
freelang migrate up                               # 미적용 실행
freelang migrate down                             # 마지막 롤백
freelang migrate status                           # 적용 현황
```
**완료 조건**: MariaDB `_migrations` 테이블 + SQL 파일 기반 버전 관리

---

### P2 — `auto_rest` — DB 테이블 → REST API 자동 생성

**배경**: Supabase PostgREST 패턴 — CRUD 핸들러 반복 제거  
**사용법**:
```fl
(auto_rest "orders" {:auth :required :read :public})
; → GET /orders, POST /orders, PATCH /orders/:id, DELETE /orders/:id 자동
```
**완료 조건**: akl-crm 기존 CRUD 핸들러 50% 이상 제거 가능

---

### P3 — WebSocket / Push API / Cron 정밀화

| 기능 | 현황 | 목표 |
|------|------|------|
| WebSocket | community-ws 별도 구현 | stdlib 통합 |
| Push API 서버 측 | 미구현 | Web Push protocol |
| Cron | set_interval 60초 | "매주 월요일 9시" 수준 |

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|-----------|
| 11.6.0 | 2026-05-08 | LIR-002 키정규화, env_get nil, catch 타입분기 |
| 11.5.3 | 2026-05 | CSRF/XSS 보안 강화 |
| 11.5.0 | 2026-05-04 | kebab alias 400개 자동 등록 |
| 11.2.0 | 2026-05-03 | L3 자기 호스팅 완성, while codegen 수정 |
| 11.1.0 | 2026-05 | L2 100% 완성, AI-Native Phase 1~4 |
| 11.0.x | 2026-04 | L1 자가호스팅, P0~P1 완성, MongoDB |
