# 미용실 관리 앱 개발 로드맵 (v11 기반)

> **v11 + FreeLang AI를 활용한 현실적 개발 계획**

---

## 📋 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **앱 이름** | (예: BeautySalon Manager, 예쁜샵 Pro) |
| **대상** | 1인~5명 미용실 원장 및 직원 |
| **핵심** | 예약 + 고객관리 + POS + 매출분석 |
| **개발 언어** | FreeLang v11 (100% v11) |
| **예상 기간** | 3~5개월 (MVP부터 런칭까지) |
| **예상 비용** | 자체 개발 시 거의 0 (의존성 0, 개발 시간만) |
| **타겟 가격** | 무료 ~ 월 3~5만 원 (프리미엄 플랜) |

---

## 🏗️ v11 기반 프로젝트 폴더 구조

```
beauty-salon-app/
├── bootstrap.js                 # v11 런타임
├── package.json
│
├── app/                         # 📄 프론트엔드 (고객 + 관리자 UI)
│   ├── page.fl                  # 랜딩 페이지
│   ├── layout.fl                # 루트 레이아웃 (헤더, 내비게이션)
│   ├── login/page.fl            # 로그인 페이지
│   ├── dashboard/
│   │   ├── page.fl              # 관리자 대시보드
│   │   └── layout.fl            # 대시보드 레이아웃
│   │
│   ├── reservation/             # 예약 관련
│   │   ├── page.fl              # 예약 목록 캘린더
│   │   ├── [id]/page.fl         # 예약 상세 조회
│   │   └── new/page.fl          # 새 예약 등록
│   │
│   ├── customers/               # 고객관리
│   │   ├── page.fl              # 고객 목록
│   │   ├── [id]/page.fl         # 고객 상세 정보
│   │   └── new/page.fl          # 고객 신규 등록
│   │
│   ├── pos/                     # POS & 결제
│   │   ├── page.fl              # POS 화면 (결제 입력)
│   │   └── receipt/[id]/page.fl # 영수증 조회
│   │
│   ├── analytics/               # 매출 분석
│   │   ├── page.fl              # 대시보드 (그래프)
│   │   ├── daily/page.fl        # 일별 매출
│   │   ├── monthly/page.fl      # 월별 매출
│   │   └── staff/page.fl        # 직원별 매출
│   │
│   ├── staff/                   # 직원관리 (추후)
│   │   ├── page.fl              # 직원 목록
│   │   └── [id]/page.fl         # 직원 상세
│   │
│   └── settings/                # 설정
│       ├── page.fl              # 기본설정
│       ├── services/page.fl     # 서비스 관리 (시술 종류)
│       └── backup/page.fl       # 데이터 백업
│
├── src/                         # 🔧 백엔드 로직
│   ├── main.fl                  # 진입점
│   │
│   ├── domain/                  # 도메인 로직
│   │   ├── reservation.fl       # 예약 관리 (COT, AGENT 활용)
│   │   ├── customer.fl          # 고객 관리 (CRM)
│   │   ├── pos.fl               # POS & 결제
│   │   ├── analytics.fl         # 매출 분석 (PREDICT, WISDOM)
│   │   ├── service.fl           # 서비스/상품 관리
│   │   └── staff.fl             # 직원 관리
│   │
│   ├── ai/                      # 🤖 AI 블록 활용
│   │   ├── recommend.fl         # AI 추천 (이전 시술 기반)
│   │   ├── analysis.fl          # AI 분석 (매출 예측)
│   │   └── insights.fl          # 지혜 기반 인사이트
│   │
│   ├── api/                     # API 핸들러
│   │   ├── reservation.fl       # 예약 API
│   │   ├── customer.fl          # 고객 API
│   │   ├── pos.fl               # 결제 API
│   │   └── analytics.fl         # 분석 API
│   │
│   ├── db/                      # 데이터베이스
│   │   ├── connection.fl        # DB 연결
│   │   ├── migration.fl         # 마이그레이션
│   │   └── seed.fl              # 초기 데이터
│   │
│   ├── payment/                 # 결제 연동
│   │   ├── toss.fl              # Toss Payments
│   │   ├── kakao.fl             # 카카오페이
│   │   └── handler.fl           # 결제 핸들러
│   │
│   ├── notification/            # 알림
│   │   ├── sms.fl               # SMS 발송
│   │   ├── kakao.fl             # 카카오톡 알림
│   │   └── schedule.fl          # 자동 예약 알림
│   │
│   └── utils/                   # 유틸리티
│       ├── validator.fl         # 입력 검증
│       ├── formatter.fl         # 날짜/금액 포맷팅
│       └── auth.fl              # 인증 (JWT)
│
├── tests/                       # 🧪 테스트
│   ├── reservation.test.fl      # 예약 로직 테스트
│   ├── customer.test.fl         # 고객 로직 테스트
│   ├── pos.test.fl              # POS 로직 테스트
│   └── analytics.test.fl        # 분석 로직 테스트
│
├── data/                        # 💾 데이터
│   ├── schema.sql               # DB 스키마
│   ├── seed.sql                 # 초기 데이터
│   └── migrations/              # 마이그레이션 파일
│
├── docs/                        # 📚 문서
│   ├── API.md                   # API 명세
│   ├── DEPLOY.md                # 배포 가이드
│   ├── USAGE.md                 # 사용 설명서
│   └── DEV.md                   # 개발 가이드
│
├── public/                      # 📦 정적 파일
│   ├── css/                     # 스타일시트
│   ├── js/                      # 클라이언트 스크립트
│   └── images/                  # 이미지
│
└── config/                      # ⚙️ 설정
    ├── database.fl              # DB 설정
    ├── payment.fl               # 결제 설정
    └── notification.fl          # 알림 설정
```

---

## 📅 개발 일정 (14주 = 3.5개월, MVP부터 런칭까지)

### Phase 1: 기획 & 준비 (Week 1-2)

**주 1: 방향 잡기 & 시장조사**
- [ ] 경쟁사 분석 (헤어짱, 공비서, 핸드SOS 등) → 장단점 정리
- [ ] 미용실 사장 5명 인터뷰 (꼭 필요한 기능만 선별)
- [ ] 기술 선택 확정: v11 (백엔드) + v11 (프론트) + PostgreSQL
- [ ] 디자인 톤 정하기: 파스텔/화이트 톤, 모바일 우선

**주 2: MVP 기능 정의**
- [ ] 핵심 기능 3가지 선정 (예약 > 고객관리 > POS)
- [ ] UI/UX 와이어프레임 (손그림 또는 Figma)
- [ ] 데이터 모델 설계 (고객, 예약, 영수증 테이블)
- [ ] 초기 PR 작성 (피치 자료)

---

### Phase 2: 설계 & 프로토타입 (Week 3-4)

**주 3: 데이터베이스 & API 설계**
- [ ] PostgreSQL 스키마 작성
  ```sql
  -- customers (고객)
  CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    memo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  -- services (시술 종류)
  CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    duration INT -- 소요 시간 (분)
  );
  
  -- reservations (예약)
  CREATE TABLE reservations (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    service_id INT NOT NULL,
    reserved_at TIMESTAMP NOT NULL,
    status VARCHAR(20), -- pending, confirmed, completed, cancelled
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  );
  
  -- receipts (영수증)
  CREATE TABLE receipts (
    id SERIAL PRIMARY KEY,
    reservation_id INT,
    amount INT NOT NULL,
    payment_method VARCHAR(20), -- cash, card, kakaopay, toss
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
  );
  ```

- [ ] API 엔드포인트 정의
  ```
  POST   /api/reservations         -- 예약 생성
  GET    /api/reservations         -- 예약 목록
  GET    /api/reservations/:id     -- 예약 상세
  PUT    /api/reservations/:id     -- 예약 수정
  DELETE /api/reservations/:id     -- 예약 취소
  
  GET    /api/customers            -- 고객 목록
  POST   /api/customers            -- 고객 추가
  GET    /api/customers/:id        -- 고객 상세
  
  POST   /api/receipts             -- 영수증 생성
  GET    /api/receipts             -- 영수증 목록
  
  GET    /api/analytics/daily      -- 일별 매출
  GET    /api/analytics/monthly    -- 월별 매출
  ```

**주 4: 프로토타입 & 초기 코드**
- [ ] v11 프로젝트 구조 생성 (위 폴더 구조대로)
- [ ] 페이지 스켈레톤 작성 (app/page.fl, app/dashboard/page.fl 등)
- [ ] 기본 백엔드 로직 (DB 연결, CRUD 함수)
- [ ] 로컬 개발 환경 구축 (bootstrap.js 복사, npm 설정)

---

### Phase 3: 핵심 기능 개발 (Week 5-10)

#### Week 5-6: 예약 관리 시스템
**목표**: 실시간 캘린더 + 예약 생성/수정/취소

**Week 5: 백엔드**
```lisp
;; src/domain/reservation.fl
(defn create-reservation [customer-id service-id reserved-at notes]
  ; 시간 충돌 체크 (COT 블록으로 단계적 확인)
  [COT :step "예약 가능 시간 확인"
       :step "서비스 소요시간 계산"
       :conclude (fn [$steps]
         (pg_exec "INSERT INTO reservations (customer_id, service_id, reserved_at, notes, status)
                   VALUES ($1, $2, $3, $4, 'pending')"
                  [customer-id service-id reserved-at notes]))])

(defn get-reservations-by-date [date]
  (pg_query "SELECT r.*, c.name, s.name as service_name, s.price
             FROM reservations r
             JOIN customers c ON r.customer_id = c.id
             JOIN services s ON r.service_id = s.id
             WHERE DATE(r.reserved_at) = $1
             ORDER BY r.reserved_at"
            [date]))

(defn cancel-reservation [id]
  (pg_exec "UPDATE reservations SET status = 'cancelled' WHERE id = $1" [id]))
```

**Week 5: 프론트엔드**
```lisp
;; app/reservation/page.fl
[PAGE :path "/reservation"
  :name "예약 관리"
  :render (fn []
    (do
      (var reservations (fetch "/api/reservations"))
      "<div class='calendar'>
        <h1>예약 캘린더</h1>
        <div class='schedule'>
          " (map-calendar reservations) "
        </div>
      </div>"))]
```

**Week 6: 통합 테스트**
- [ ] 예약 생성 테스트
- [ ] 시간 충돌 테스트
- [ ] 취소 시 카운트 확인

#### Week 7-8: 고객 관리 (CRM)
**목표**: 고객 프로필 + 방문 이력 + 차트 관리

```lisp
;; src/domain/customer.fl
(defn create-customer [name phone email]
  (pg_exec "INSERT INTO customers (name, phone, email, memo)
            VALUES ($1, $2, $3, '')"
           [name phone email]))

(defn get-customer-visits [customer-id]
  "고객의 모든 방문 기록 조회"
  (pg_query "SELECT r.*, s.name as service_name, s.price, rc.amount
             FROM reservations r
             JOIN services s ON r.service_id = s.id
             LEFT JOIN receipts rc ON r.id = rc.reservation_id
             WHERE r.customer_id = $1 AND r.status = 'completed'
             ORDER BY r.reserved_at DESC"
            [customer-id]))

(defn get-customer-next-recommendation [customer-id]
  "AI 기반 다음 추천 서비스"
  [COT :step "이전 시술 기록 분석"
       :step "시술 주기 계산"
       :conclude (fn [$steps]
         (let [last-visit (first (get-customer-visits customer-id))
               days-passed (- (now) (get last-visit :reserved_at))]
           (if (> days-passed 30)
             {:recommendation "매직 관리 권장" :service-id 5}
             {:recommendation "다음 시술 예정일" :days-remaining (- 30 days-passed)})))])
```

#### Week 9-10: POS & 결제
**목표**: 영수증 생성 + 결제 연동

```lisp
;; src/api/pos.fl
(defn create-receipt [reservation-id amount payment-method]
  ; Toss/카카오페이 연동 (비동기 처리)
  [AGENT :goal "결제 처리"
         :steps [(fn [] (validate-payment-method payment-method))
                 (fn [] (process-payment amount payment-method))
                 (fn [] (save-receipt reservation-id amount payment-method))]])

(defn print-receipt [receipt-id]
  "영수증 출력 (시뮬레이션)"
  (var receipt (pg_one "SELECT * FROM receipts WHERE id = $1" [receipt-id]))
  (str "=== 영수증 ===\n"
       "금액: " (format-price (get receipt :amount)) "\n"
       "결제 수단: " (get receipt :payment_method) "\n"
       "시간: " (format-time (get receipt :paid_at))))
```

---

### Phase 4: 매출 분석 & 대시보드 (Week 11-12)

**Week 11: 분석 로직**
```lisp
;; src/domain/analytics.fl
(defn get-daily-sales [date]
  "일별 매출 통계"
  (pg_query "SELECT DATE(rc.paid_at) as date, SUM(rc.amount) as total, COUNT(*) as count
             FROM receipts rc
             WHERE DATE(rc.paid_at) = $1
             GROUP BY DATE(rc.paid_at)"
            [date]))

(defn get-monthly-sales [year month]
  "월별 매출 (그래프용)"
  (pg_query "SELECT DATE_PART('day', rc.paid_at)::INT as day, SUM(rc.amount) as amount
             FROM receipts rc
             WHERE EXTRACT(YEAR FROM rc.paid_at) = $1
             AND EXTRACT(MONTH FROM rc.paid_at) = $2
             GROUP BY DATE_PART('day', rc.paid_at)
             ORDER BY day"
            [year month]))

(defn get-sales-forecast [days]
  "매출 예측 (AI - PREDICT 블록)"
  [PREDICT
   :historical-data (get-monthly-sales (get-year) (get-month))
   :horizon days
   :model "exponential-smoothing"
   :confidence 0.95])
```

**Week 12: 대시보드 UI**
```lisp
;; app/analytics/page.fl
[PAGE :path "/analytics"
  :name "매출 분석"
  :render (fn []
    (do
      (var daily-sales (fetch "/api/analytics/daily"))
      (var monthly-sales (fetch "/api/analytics/monthly"))
      "<div class='analytics'>
        <h1>매출 대시보드</h1>
        <div class='stats'>
          <div class='card'>오늘 매출: " (get daily-sales :total) "원</div>
          <div class='card'>이번 달 예약: " (get monthly-sales :count) "건</div>
        </div>
        <div class='chart'>
          " (render-sales-chart monthly-sales) "
        </div>
      </div>"))]
```

---

### Phase 5: 테스트 & 최적화 (Week 13)

- [ ] 모든 기능 로컬 테스트
- [ ] 성능 최적화 (쿼리 인덱스, 캐싱)
- [ ] 보안 점검 (SQL 인젝션, XSS)
- [ ] UI/UX 개선 (반응형, 접근성)

---

### Phase 6: 런칭 준비 (Week 14)

**배포 준비**
```bash
# 데이터베이스 마이그레이션
node bootstrap.js run src/db/migration.fl

# 앱 빌드
npm run build

# 프로덕션 배포
FL_PORT=43011 NODE_ENV=production node bootstrap.js serve app/
```

- [ ] 도메인 등록 (예: beautysalon-manager.com)
- [ ] SSL 인증서 설치
- [ ] 모니터링 설정 (로그, 에러)
- [ ] 백업 자동화
- [ ] 매뉴얼 작성

---

## 🤖 AI 블록 활용 전략 (v11의 강점!)

### 1. 예약 최적화
```lisp
; 시간 충돌 방지 + 최적 일정 제안 (COT)
[COT :step "요청된 시간 확인"
     :step "기존 예약 조회"
     :step "가능한 시간 계산"
     :conclude (fn [$steps] 
       (suggest-available-slots (get-customer :id)))]
```

### 2. 고객 추천
```lisp
; 과거 시술 기반 AI 추천 (AGENT)
[AGENT :goal "최적 시술 추천"
       :steps [(fn [] (fetch-customer-history))
               (fn [] (analyze-hair-condition))
               (fn [] (recommend-services))]]
```

### 3. 매출 예측
```lisp
; 미래 매출 예측 (PREDICT)
[PREDICT :data (get-monthly-sales)
         :horizon 30
         :confidence 0.9
         :return-forecast true]
```

### 4. 지혜 기반 인사이트
```lisp
; 경험과 판단을 합친 비즈니스 인사이트
[WISDOM :experience (get-all-sales-data)
        :judge (fn [data] 
          (if (> (get data :repeat-rate) 0.7)
            "단골 관리 우수 💯"
            "재방문율 개선 필요 ⚠️"))]
```

---

## 💰 비용 추정

| 항목 | 비용 | 비고 |
|------|------|------|
| **개발 비용** | 거의 0 | v11 의존성 0, 자체 개발 시간만 |
| **호스팅** | 월 2~5만 원 | AWS EC2 micro 또는 Vercel |
| **데이터베이스** | 월 0~2만 원 | PostgreSQL SaaS (Supabase, Railway) |
| **SMS/카카오톡** | 월 2~10만 원 | 예약 알림 발송료 |
| **결제 수수료** | 매출의 2.5~3.3% | Toss, 카카오페이 |
| **도메인** | 연 1만 원 | |
| **디자인** | 0원 | v11 기본 UI 확장 |
| **초기 총합** | 월 5~20만 원 | 런칭까지 거의 자체 개발 |

**vs 기존 앱 구축**:
- 외주 개발: 3,000~5,000만 원 이상
- 노코드 플랫폼: 월 30~100만 원
- **v11 기반**: 거의 0 (시간만!) + 월 호스팅 5만 원

---

## 📱 MVP 기능 우선순위 (꼭 해야 할 것)

| 우선순위 | 기능 | 필수도 | 구현 난이도 | 추정 시간 |
|----------|------|--------|-----------|----------|
| **1순위** | 예약 캘린더 | ⭐⭐⭐ | 중 | 2주 |
| **1순위** | 고객 정보 저장 | ⭐⭐⭐ | 하 | 1주 |
| **1순위** | POS (결제) | ⭐⭐⭐ | 중 | 2주 |
| **1순위** | 일일 매출 | ⭐⭐ | 하 | 3일 |
| **2순위** | 예약 알림 (문자) | ⭐⭐ | 중 | 1주 |
| **2순위** | 고객 방문 이력 | ⭐⭐ | 하 | 3일 |
| **2순위** | 월별 통계 | ⭐⭐ | 하 | 1주 |
| **3순위** | 직원 관리 | ⭐ | 중 | 2주 |
| **3순위** | 사진 업로드 | ⭐ | 중 | 1주 |
| **3순위** | AI 추천 | ⭐ | 상 | 1주 |

---

## 🎯 현실적 팁 & 주의사항

### ✅ DO (해야 할 것)

1. **예약 + 고객관리만 먼저 완벽히**
   - 나머지 기능은 나중에 추가해도 OK
   - 사용자가 원하는 핵심만 집중

2. **모바일 우선 설계**
   - 원장은 태블릿에서 많이 봄
   - 반응형 필수

3. **1인 테스트**
   - 실제 미용실에서 1~2주 써보기
   - 버그 + 동선 개선

4. **v11의 AI 활용**
   - 재방문 추천 (고객 이력 기반)
   - 매출 예측
   - 최적 일정 제안

5. **저렴한 마케팅**
   - 지인 미용실에 무상 제공 (피드백용)
   - 인스타그램 데모 영상
   - 미용실 커뮤니티 글 올리기

### ❌ DON'T (피해야 할 것)

1. **첫 버전에 모든 기능 넣기**
   - 예약 + 고객관리 + POS = 충분
   - 직원관리, AI, 재고는 나중에

2. **비싼 결제 연동부터 시작**
   - 처음은 현금 + 간단한 카드 수기 입력
   - 나중에 Toss/카카오페이 추가

3. **디자인에 너무 오래 시간 쓰기**
   - 깔끔하고 기능적인 UI로 충분
   - "예쁜"보다 "빠르고 편한" 우선

4. **프로토타입 없이 바로 개발**
   - 먼저 와이어프레임 또는 종이 그리기
   - 원장님 피드백 받고 시작

---

## 📞 기술 지원 & 트러블슈팅

### 자주 나올 문제들

**Q1: 예약 충돌이 자주 발생**
- 해결: 데이터베이스 트랜잭션 + 타임스탬프 검증
```lisp
(defn safe-reserve [customer-id service-id time]
  (db-transaction
    (if (is-time-available? time)
      (insert-reservation ...)
      (throw-error "예약 불가"))))
```

**Q2: 결제 후 영수증이 안 나옴**
- 해결: 결제 콜백 로직 + 재시도 메커니즘
```lisp
(defn handle-payment-callback [payment-id status]
  [AGENT :goal "결제 처리"
         :steps [(fn [] (verify-payment payment-id))
                 (fn [] (retry 3 (create-receipt ...)))]])
```

**Q3: 알림이 발송되지 않음**
- 해결: SMS 크레딧 확인 + 실패 로그 확인
```lisp
(defn send-appointment-reminder [reservation-id]
  (fl-try
    (send-sms (get-customer-phone) "예약 알림")
    :on-error (fn [e] (log-error (str "SMS 발송 실패: " e)))))
```

---

## 🚀 다음 단계 (실제 개발 시작하려면)

1. **폴더 구조 생성**
   ```bash
   mkdir beauty-salon-app
   cd beauty-salon-app
   cp /path/to/freelang-v11/bootstrap.js .
   ```

2. **DB 스키마 작성**
   - PostgreSQL 또는 SQLite 선택
   - schema.sql 작성

3. **첫 페이지 만들기**
   - app/page.fl (랜딩 페이지)
   - app/login/page.fl (로그인)
   - app/dashboard/page.fl (대시보드)

4. **API 작성**
   - src/api/reservation.fl
   - src/api/customer.fl
   - src/api/pos.fl

5. **로컬 테스트**
   ```bash
   node bootstrap.js serve app/ --port 43011
   ```

6. **Git 관리**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Beauty Salon App v11"
   git remote add origin [gogs-url]
   git push origin master
   ```

---

## 📊 모니터링 & 메트릭

런칭 후 이 지표들을 추적하면서 개선:

- **예약율**: 일일 예약 건수
- **단골율**: 재방문 고객 %
- **결제 완료율**: 결제 성공 %
- **평균 결제금액**: 거래액 추세
- **시스템 안정성**: 장애 시간 / 가용성 %

---

## 🎉 성공 시나리오

```
Week 1-2:  기획 완료 ✅
Week 3-4:  설계 & 프로토 ✅
Week 5-10: 핵심 기능 개발 ✅
Week 11-12: 분석 & 대시보드 ✅
Week 13:   테스트 & 최적화 ✅
Week 14:   런칭 🚀

3개월 후: 10~20개 미용실 사용
6개월 후: 100개 미용실 + 월 구독 수익
12개월: 500개 미용실 + 월 2,000만 원 매출
```

---

**총 정리: v11은 의존성이 0이므로, 시간만 투자하면 됩니다!**  
**예약 + 고객관리 + POS를 3개월에 완벽히 만들고, 나머지는 사용자 피드백 받아서 확장하세요.**  

화이팅! ✂️📱
