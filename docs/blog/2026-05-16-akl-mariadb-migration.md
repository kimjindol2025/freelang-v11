# AKL 마이크로서비스 SQLite → MariaDB 마이그레이션 완료

**작성일**: 2026-05-16  
**완성도**: 10/10  
**영향**: 7개 서비스 정상화

---

## 문제: FreeLang v11.7.10 SQLite 미지원

FreeLang v11.7.10에서 SQLite 라이브러리(`node:sqlite`) 지원이 제거되어, 다음 함수들이 런타임 오류 발생:

```
[Error] [db_create] No such built-in module: node:sqlite
```

이로 인해 SQLite에 의존하던 7개 마이크로서비스가 **PM2 크래시**:

- akl-search
- akl-payment  
- akl-subscription
- akl-billing
- akl-social
- akl-marketing
- akl-analytics

---

## 해결: MariaDB 통합 마이그레이션

**핵심 전략**: 모든 SQLite 호출을 **MariaDB 통합 데이터베이스**(`akl` DB)로 통합.

### Before/After 비교

```lisp
;; ❌ Before: SQLite (지원 안 함)
(let [$db (db-create)]
  (db-exec $db "CREATE TABLE users (id TEXT, name TEXT)"))

;; ✅ After: MariaDB (정상)
(let [$conn (mariadb-connect DB_HOST DB_USER DB_PASS "akl")]
  (mariadb-exec $conn "CREATE TABLE users (id TEXT, name TEXT)"))
```

### 마이그레이션 패턴 (표준화)

모든 서비스에 동일한 구조 적용:

```lisp
(define DB_HOST   (or (env-get "DB_HOST")   "localhost"))
(define DB_USER   (or (env-get "DB_USER")   "akl"))
(define DB_PASS   (or (env-get "DB_PASS")   "akl_pass_2026"))
(define DB_NAME   (or (env-get "DB_NAME")   "akl"))

(defn init-db []
  (let [$conn (mariadb-connect DB_HOST DB_USER DB_PASS DB_NAME)]
    ;; CREATE TABLE, SEED DATA, etc.
    ))

(init-db)  ;; 서버 시작 시 자동 실행

(defn handle-operation [$req]
  (let [$conn (mariadb-connect DB_HOST DB_USER DB_PASS DB_NAME)]
    ;; 요청 처리
    ))
```

---

## 핵심 수정 내용

### 1. MariaDB 예약어 이스케이프 (akl-subscription)

`interval`은 MariaDB 예약어 → 백틱으로 이스케이프:

```sql
-- ❌ 오류
CREATE TABLE plans (
  price INT NOT NULL,
  interval VARCHAR(20),  -- SQL Error 1064
  features TEXT
)

-- ✅ 정상
CREATE TABLE plans (
  price INT NOT NULL,
  `interval` VARCHAR(20),  -- Backtick escape
  features TEXT
)
```

**적용 위치**:
- CREATE TABLE (line 28): `` `interval` VARCHAR(20) ``
- INSERT (lines 72-78): `` INSERT INTO plans(..., `interval`, ...) ``

### 2. 헬스 체크 API 개선 (akl-payment)

**이전**: 간단한 상태 응답만

```lisp
(defn handle-health [$req]
  (server-json {:ok true :service "akl-payment" :version "1.0.0"}))
```

**현재**: DB 쿼리 통합 + `/health` 라우트 추가

```lisp
(server-get "/health" "handle-health")  ;; 새 라우트

(defn handle-health [$req]
  (let [$conn (mariadb-connect DB_HOST DB_USER DB_PASS DB_NAME)
        $cnt  (mariadb-query $conn "SELECT COUNT(*) AS n FROM payments WHERE status='SUCCESS'" [])]
    (akl-health "akl-payment" "1.0.0"
      {:port PORT :successful_payments (get (first $cnt) "n")})))
```

---

## 7개 서비스 마이그레이션 목록

| 포트 | 서비스 | 테이블 | 변경 내용 |
|------|--------|--------|----------|
| 40312 | akl-search | `search_docs` (FTS) | SQLite FTS5 → MariaDB FULLTEXT |
| 40313 | akl-payment | `payments`, `webhooks` | `/health` 라우트 추가 |
| 40314 | akl-subscription | `plans`, `subscriptions`, `billing_history` | `` `interval` `` 백틱 추가 |
| 40315 | akl-billing | `invoices`, `invoice_items`, `tax_settings` | 기본 MariaDB 패턴 |
| 40316 | akl-social | `profiles`, `follows`, `posts`, `likes` | 기본 MariaDB 패턴 |
| 40317 | akl-marketing | `campaigns`, `contacts` | 기본 MariaDB 패턴 |
| 40318 | akl-analytics | `events`, `daily_stats` | 기본 MariaDB 패턴 |

---

## 검증 결과 (2026-05-16 16:45)

### 헬스 체크 응답

```bash
$ for port in 40312 40313 40314 40315 40316 40317 40318; do
    curl -s http://localhost:$port/health | jq .
  done
```

**결과**:

```json
{
  "ok": true,
  "service": "akl-search",
  "version": "1.0.0",
  "port": "40312"
}

{
  "ok": true,
  "service": "akl-payment",
  "version": "1.0.0",
  "port": "40313",
  "successful_payments": "0"
}

... (모두 정상)
```

### PM2 상태

```bash
$ pm2 status | grep -E "akl-(search|payment|subscription|billing|social|marketing|analytics)"
36 │ akl-subscription            │ online    ✅
37 │ akl-billing                 │ online    ✅
38 │ akl-social                  │ online    ✅
39 │ akl-marketing               │ online    ✅
40 │ akl-analytics               │ online    ✅
34 │ akl-search                  │ online    ✅
35 │ akl-payment                 │ online    ✅
```

**결론**: 모든 7개 서비스 온라인, 헬스 응답 정상.

---

## 기술 통찰

### 왜 SQLite에서 MariaDB로?

1. **통합 데이터베이스**: 여러 서비스가 같은 데이터베이스를 공유하는 아키텍처
2. **인덱싱 최적화**: MariaDB의 인덱싱이 더 강력 (FULLTEXT 포함)
3. **재배포 단순화**: 서비스 배포 시 DB 마이그레이션 불필요
4. **모니터링**: 단일 DB에서 모든 서비스 데이터 조회 가능

### 주의사항

- **예약어**: MariaDB 예약어 확인 필수 (INTERVAL, ORDER, SELECT, etc.)
- **문자열 이스케이프**: 특수 문자 처리 주의
- **null 처리**: FreeLang의 `nil` vs SQL의 `NULL` 구분

---

## 다음 단계

### Phase 1: 추가 서비스 마이그레이션 (필요시)

- **dclub-chat** (포트 30340)
- **cloud-*** 시리즈 (26개 서비스)
- **kim-cloud-*** 시리즈 (5개 서비스)

### Phase 2: API 통합 테스트

- 서비스 간 API 호출 검증
- API_CATALOG.md 업데이트
- 통합 테스트 스크립트 작성

---

## 커밋 기록

```bash
# akl-subscription
commit 8ca7d66
Author: Jindol Kim
Message: fix: akl-subscription interval 컬럼 MariaDB 예약어 문제 (백틱 이스케이프)

# akl-payment
commit 3431485
Author: Jindol Kim
Message: fix: akl-payment /health 엔드포인트 추가 및 handle-health DB 쿼리 개선
```

---

## 결론

**이전**: SQLite 미지원으로 7개 서비스 크래시  
**현재**: MariaDB 통합으로 모든 서비스 정상화  
**개선도**: 100% (크래시 → 온라인)

FreeLang v11.7.10의 방향성(SQLite 제거)이 명확한 만큼, **향후 모든 신규 서비스는 MariaDB를 기본 선택**으로 설계할 것을 권장합니다.
