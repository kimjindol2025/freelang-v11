# AKL 마이크로서비스 아키텍처 문서

**작성일**: 2026-05-07  
**언어**: FreeLang v11  
**총 서비스**: 24개 | **총 코드**: ~11,000줄 | **총 API**: ~450개 엔드포인트

---

## 1. 서비스 전체 목록

| 서비스 | 포트 | 역할 | DB | 코드 |
|--------|------|------|----|------|
| **akl-api** | 39000 | 중앙 인증 허브, 계약/고객/상품 | MariaDB | 357줄·16 라우트 |
| **akl-admin** | 39002 | 시스템 마스터 콘솔 | SQLite | 233줄·12 라우트 |
| **akl-storage** | 39001 | 파일 & 오브젝트 스토리지 | SQLite | 314줄·14 라우트 |
| **akl-audit** | 39006 | 감사 로그 센터 | **KimDB** | 151줄·7 라우트 |
| **akl-crm** | 39010 | 영업 파이프라인 관리 | **KimDB** | 1433줄·44 라우트 |
| **akl-estimate** | 39012 | 견적서 관리 | **KimDB** | 196줄·8 라우트 |
| **akl-inventory** | 39014 | 재고 & WMS | SQLite | 485줄·20 라우트 |
| **akl-project** | 39016 | 프로젝트 & 태스크 관리 | **KimDB** | 197줄·10 라우트 |
| **akl-shop** | 39020 | 쇼핑몰 (내부 운영) | **KimDB** | 187줄·10 라우트 |
| **akl-partner** | 39025 | 외주 기술자 포털 | **KimDB** | 144줄·8 라우트 |
| **akl-account** | 39026 | 통합 계정관리 (My Page) | SQLite | 153줄·8 라우트 |
| **akl-hike** | 39061 | 단체 등산 + 정복 지도 | SQLite | 346줄·30 라우트 |
| **akl-move** | 39060 | 걷기/달리기 GPS 트래커 | SQLite | 332줄·28 라우트 |
| **akl-writer** | 39043 | 장편 집필 도구 | SQLite | 527줄·35 라우트 |
| **akl-base** | 40090 | BaaS (Supabase 대체) | MariaDB | 1934줄·65 라우트 |
| **akl-aws** | 40300 | AWS Lambda/IAM 게이트웨이 | SQLite | 380줄·8 라우트 |
| **akl-aws-data** | 40301 | DynamoDB/S3 제어 | SQLite | 450줄·12 라우트 |
| **akl-aws-ai** | 40302 | Rekognition/Comprehend | SQLite | 484줄·13 라우트 |
| **akl-cloud** | 40310 | GCP/AWS/Azure 멀티클라우드 | SQLite | 533줄·17 라우트 |
| **akl-bigwash** | 40320 | BigWash AWS 통합 | SQLite | 590줄·12 라우트 |
| **akl-deploy** | 40325 | FL → Lambda CI/CD | SQLite | 629줄·14 라우트 |
| **akl-iam** | 40330 | 자체 자격증명 발급 | SQLite | 396줄·14 라우트 |
| **akl-lib** | — | 공통 라이브러리 | — | 75줄 |
| **akl-frontends** | — | React/Vue 클라이언트 | — | TS 152개 |

---

## 2. 포트 레지스트리

```
39000 — akl-api       (인증 허브)
39001 — akl-storage   (파일 스토리지)
39002 — akl-admin     (시스템 콘솔)
39006 — akl-audit     (감사 로그)
39010 — akl-crm       (영업)
39012 — akl-estimate  (견적)
39014 — akl-inventory (재고)
39016 — akl-project   (프로젝트)
39020 — akl-shop      (쇼핑몰)
39025 — akl-partner   (파트너)
39026 — akl-account   (계정)
39043 — akl-writer    (집필)
39060 — akl-move      (GPS 트래커)
39061 — akl-hike      (등산)

40090 — akl-base      (BaaS)
40300 — akl-aws       (AWS 게이트웨이)
40301 — akl-aws-data  (DynamoDB/S3)
40302 — akl-aws-ai    (AI/ML)
40310 — akl-cloud     (멀티클라우드)
40320 — akl-bigwash   (BigWash)
40325 — akl-deploy    (CI/CD)
40330 — akl-iam       (IAM)
```

**범위 규칙**:
- `39000–39999` — 비즈니스 로직 서비스
- `40000–40399` — 인프라 / 클라우드 / BaaS

---

## 3. 아키텍처 다이어그램

```
┌────────────────────────────────────────────────────┐
│              akl-frontends (React/Vue)              │
└───────────────────────┬────────────────────────────┘
                        │ HTTP/Bearer
         ┌──────────────▼──────────────┐
         │    akl-api (39000)          │  ← 인증 허브
         │    MariaDB + JWT 발급       │
         └──────────────┬──────────────┘
          ┌─────────────┼─────────────────────────┐
          │             │                         │
  ┌───────▼──────┐  ┌───▼────────────┐  ┌────────▼──────┐
  │  KimDB 계층  │  │  SQLite 계층   │  │  Cloud 계층   │
  │  (6 서비스)  │  │  (14 서비스)   │  │  (7 서비스)   │
  │              │  │                │  │               │
  │ akl-audit    │  │ akl-admin      │  │ akl-base      │
  │ akl-crm      │  │ akl-storage    │  │ akl-aws       │
  │ akl-estimate │  │ akl-account    │  │ akl-aws-data  │
  │ akl-partner  │  │ akl-inventory  │  │ akl-aws-ai    │
  │ akl-project  │  │ akl-writer     │  │ akl-cloud     │
  │ akl-shop     │  │ akl-hike       │  │ akl-bigwash   │
  └──────┬───────┘  │ akl-move       │  │ akl-deploy    │
         │          │ akl-deploy     │  │ akl-iam       │
         ▼          └────────────────┘  └───────────────┘
   localhost:40000
   (단일 장애점 ⚠️)
```

---

## 4. 공통 패턴

### 4-1. 인증 패턴 (모든 서비스 공통)

모든 서비스가 요청마다 `akl-api:39000`에 토큰 검증을 요청한다.

```lisp
(define AUTH_URL "http://localhost:39000/api/auth/userinfo")

(defn get-uid [$req]
  (let [[$auth (server_req_header $req "authorization")]]
    (if (nil? $auth) nil
      (let [[$token (substring $auth 7 (length $auth))]
            [$res (http_get_bearer AUTH_URL $token)]
            [$body (json_parse (get $res "body"))]]
        (if (get $body "success")
          (get (get $body "data") "userId")
          nil)))))
```

**문제**: 모든 인증된 API 요청 = HTTP 왕복 1회 추가 (akl-api 호출)

### 4-2. KimDB 패턴 (6개 서비스)

```lisp
(define KIMDB "http://localhost:40000/api/c")

(defn db-get [$col]
  (let [[$res (http_get (str KIMDB "/" $col))]
        [$body (json_parse (get $res "body"))]]
    (or (get $body "data") [])))

(defn db-post [$col $item]
  (http_post (str KIMDB "/" $col)
    (json_stringify {:data $item})))
```

**문제**: DB 접근 = HTTP 왕복 1회 추가 (kimdb 호출)

### 4-3. SQLite 패턴 (14개 서비스)

```lisp
(define DB (sqlite-open "./data/service.db"))

(defn db-query [$sql $params]
  (sqlite-query DB $sql $params))
```

**장점**: 로컬 접근, 네트워크 왕복 없음

---

## 5. 문제 진단 (P0~P3)

### ⚠️ P0-1: KimDB 단일 장애점

| 항목 | 내용 |
|------|------|
| **영향 서비스** | akl-audit, akl-crm, akl-estimate, akl-partner, akl-project, akl-shop |
| **위험도** | `localhost:40000` 다운 시 6개 서비스 전체 마비 |
| **현황** | KimDB = 외부 HTTP API 기반 NoSQL, 스키마 없음 |
| **해결책** | 각 서비스 → SQLite 로컬 DB 마이그레이션 |
| **공수** | 서비스당 2~4시간, 총 ~18시간 |

→ 상세: [AKL_P0_KIMDB.md](./AKL_P0_KIMDB.md)

### ⚠️ P0-2: 인증 오버헤드

| 항목 | 내용 |
|------|------|
| **영향** | 전체 24개 서비스 |
| **현황** | 모든 요청 = akl-api HTTP 왕복 (10~30ms 추가) |
| **해결책** | JWT 로컬 검증 (akl-lib에 `verify-jwt` 함수 추가) |
| **공수** | 4시간 |

→ 상세: [AKL_P0_AUTH.md](./AKL_P0_AUTH.md) *(예정)*

### P1-1: 에러 응답 포맷 불일치

서비스마다 `res-ok` / `res-err` 자체 구현. akl-lib 공통 함수 강제 사용 필요.

### P1-2: 환경 URL 하드코딩

`localhost:39000`, `localhost:40000` 하드코딩 → `.env` 또는 설정 파일로 분리 필요.

### P2: 문서화 부족

각 서비스 엔드포인트 명세 없음 → OpenAPI 자동 생성 검토.

---

## 6. 개선 로드맵

```
Phase 1 (P0) — 안정화
  ├── P0-1: KimDB → SQLite 마이그레이션 (6개 서비스)
  └── P0-2: JWT 로컬 검증 도입

Phase 2 (P1) — 표준화
  ├── P1-1: akl-lib 공통 함수 강제 (res-ok, res-err, get-uid)
  └── P1-2: 환경 변수 중앙화

Phase 3 (P2) — 문서화
  ├── 서비스별 엔드포인트 명세
  └── E2E 테스트 스위트

Phase 4 (장기) — 확장성
  ├── Redis 캐싱 (인증 토큰)
  └── 서비스 메시 검토
```

---

## 7. 현황 등급

| 항목 | 등급 | 비고 |
|------|------|------|
| 코드 품질 | A | FreeLang v11 통일, 일관된 구조 |
| 기능 완성도 | A+ | ~450 엔드포인트, 거의 모든 도메인 커버 |
| 확장성 | B+ | 마이크로서비스 분리, 의존성 관리 미흡 |
| 운영 안정성 | C+ | KimDB 단일 장애점, 인증 오버헤드 |
| 문서화 | D | 이 문서가 시작점 |
| 테스트 커버리지 | F | 0% — 별도 Sprint 필요 |
