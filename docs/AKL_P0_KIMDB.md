# AKL P0-1: KimDB 단일 장애점 — 분석 & 마이그레이션 가이드

**작성일**: 2026-05-07  
**우선순위**: P0 (Critical)  
**영향 서비스**: 6개  
**예상 공수**: 서비스당 2~4시간, 총 ~18시간

---

## 1. 문제 정의

### 현황

6개 서비스가 외부 HTTP API인 KimDB(`localhost:40000`)에 DB로 의존한다.

```
akl-audit   (39006) ──┐
akl-crm     (39010) ──┤
akl-estimate(39012) ──┼──▶ KimDB (localhost:40000) ← 단일 장애점
akl-partner (39025) ──┤
akl-project (39016) ──┤
akl-shop    (39020) ──┘
```

### 위험 시나리오

```
KimDB 프로세스 다운
  → 6개 서비스 모든 DB 쓰기/읽기 실패
  → HTTP 500 또는 빈 데이터 반환
  → 서비스 무응답
```

### 현재 패턴 (공통)

```lisp
(define KIMDB "http://localhost:40000/api/c")

;; 읽기: HTTP GET → JSON 파싱 → data 추출
(defn db-get [$col]
  (let [[$res (http_get (str KIMDB "/" $col))]
        [$body (json_parse (get $res "body"))]]
    (or (get $body "data") [])))

;; 쓰기: HTTP POST
(defn db-post [$col $item]
  (http_post (str KIMDB "/" $col)
    (json_stringify {:data $item})))
```

**추가 문제**: DB 접근마다 HTTP 왕복 (10~30ms) → 쿼리 누적 시 레이턴시 급증

---

## 2. 서비스별 컬렉션 목록

| 서비스 | KimDB 컬렉션 | 역할 |
|--------|------------|------|
| **akl-audit** | `audit_logs` | 감사 로그 |
| **akl-crm** | `crm_contacts`, `crm_events`, `users` | 고객, 이벤트, 사용자 |
| **akl-estimate** | `akl_estimates` | 견적서 |
| **akl-partner** | `partner_profiles`, `partner_assignments`, `partner_earnings` | 파트너 |
| **akl-project** | `proj_projects`, `proj_tasks` | 프로젝트, 태스크 |
| **akl-shop** | `shop_products`, `shop_orders`, `shop_cart` *(추정)* | 상품, 주문 |

---

## 3. 마이그레이션 전략

### 목표 아키텍처

KimDB HTTP 의존 → SQLite 로컬 파일 DB

```
각 서비스
  ├── ./data/service.db   (SQLite)
  └── app/server.fl       (db-get/db-post → sqlite-query)
```

### SQLite 헬퍼 표준 (교체 후 공통 패턴)

```lisp
;; KimDB 헬퍼 제거 후 SQLite 교체
(define DB (sqlite-open "./data/service.db"))

;; db-get: 전체 목록
(defn db-get [$table]
  (sqlite-query DB (str "SELECT * FROM " $table) []))

;; db-get-by-id: ID로 단건 조회
(defn db-get-by-id [$table $id]
  (let [[$rows (sqlite-query DB
          (str "SELECT * FROM " $table " WHERE id = ?") [$id])]]
    (if (> (length $rows) 0) (get $rows 0) nil)))

;; db-post: 삽입 (JSON blob 방식)
(defn db-post [$table $doc]
  (let [[$id (str "id-" (now_ms))]]
    (sqlite-exec DB
      (str "INSERT INTO " $table " (id, data, created_at) VALUES (?,?,?)")
      [$id (json_stringify $doc) (now_iso)])
    (assoc $doc "id" $id)))

;; db-put: 업데이트
(defn db-put [$table $id $doc]
  (sqlite-exec DB
    (str "UPDATE " $table " SET data=?, updated_at=? WHERE id=?")
    [(json_stringify $doc) (now_iso) $id])
  $doc)

;; db-delete: 삭제
(defn db-delete [$table $id]
  (sqlite-exec DB
    (str "DELETE FROM " $table " WHERE id=?") [$id])
  true)
```

### 스키마 (공통)

```sql
-- 각 컬렉션당 테이블 1개 (JSON blob 방식 — KimDB와 동일 패러다임)
CREATE TABLE IF NOT EXISTS {table_name} (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,          -- JSON blob
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);
```

---

## 4. 서비스별 마이그레이션 계획

### akl-audit (39006) — 난이도: 쉬움 ⭐

**변경 범위**: `KIMDB` define 제거, `db-get`/`db-post` 재구현  
**컬렉션**: `audit_logs` 1개  
**특이사항**: 쓰기 전용 패턴 (로그 INSERT만)

```lisp
;; Before
(define KIMDB "http://localhost:40000/api/c")

;; After
(define DB (sqlite-open "./data/audit.db"))
(sqlite-exec DB "CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, data TEXT, created_at TEXT)" [])
```

### akl-estimate (39012) — 난이도: 쉬움 ⭐

**변경 범위**: KimDB 헬퍼 3개 함수 교체  
**컬렉션**: `akl_estimates` 1개  
**특이사항**: 단순 CRUD

### akl-partner (39025) — 난이도: 보통 ⭐⭐

**변경 범위**: KimDB 헬퍼 + 관계형 쿼리 일부  
**컬렉션**: `partner_profiles`, `partner_assignments`, `partner_earnings` 3개  
**특이사항**: assignments ↔ profiles 조인 패턴 있음

### akl-project (39016) — 난이도: 보통 ⭐⭐

**변경 범위**: KimDB 헬퍼 + 필터 쿼리  
**컬렉션**: `proj_projects`, `proj_tasks` 2개  
**특이사항**: tasks의 project_id FK 관계

### akl-shop (39020) — 난이도: 보통 ⭐⭐

**변경 범위**: KimDB 헬퍼 + 재고 차감 트랜잭션  
**컬렉션**: 상품/주문/장바구니 3개  
**특이사항**: 주문 시 재고 원자성 보장 필요

### akl-crm (39010) — 난이도: 어려움 ⭐⭐⭐

**변경 범위**: KimDB 헬퍼 전면 교체  
**컬렉션**: `crm_contacts`, `crm_events`, `users` 3개  
**코드량**: 1433줄 — 가장 큼  
**특이사항**: 이벤트 집계 쿼리, 사용자 조인, 파이프라인 단계 필터

---

## 5. 마이그레이션 순서 (권장)

```
1단계: akl-audit   (가장 단순, 리스크 낮음)
2단계: akl-estimate
3단계: akl-partner
4단계: akl-project
5단계: akl-shop
6단계: akl-crm     (가장 복잡, 마지막)
```

---

## 6. 완료 기준

- [ ] 각 서비스 `KIMDB` 참조 0개
- [ ] `localhost:40000` 참조 0개
- [ ] 각 서비스 `/health` 엔드포인트 정상 응답
- [ ] 기본 CRUD 동작 확인 (수동 테스트)
- [ ] KimDB 프로세스 중단 시 서비스 정상 유지

---

## 7. 롤백 계획

마이그레이션 전 각 서비스 KimDB 데이터 덤프:

```bash
curl http://localhost:40000/api/c/audit_logs?limit=10000 > backup_audit_logs.json
curl http://localhost:40000/api/c/crm_contacts?limit=10000 > backup_crm_contacts.json
# ... 각 컬렉션별
```

문제 발생 시 `KIMDB` define 복원으로 즉시 롤백 가능.
