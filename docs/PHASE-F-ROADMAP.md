# Phase F 로드맵 — FreeLang AI 에이전트 최적화

## 📅 개요
- **목표**: AI 에이전트 언어 완성 (bootstrap 최소화 + 성능 프로파일링 + HTTP/DB 헬퍼)
- **기간**: 2026-05-05 ~ 05-26 (3주)
- **철학**: 인간 배제 유지, AI 중심 개선
- **예상 영향**: 에이전트 성능 30~50% 향상

---

## Phase F-2: Bootstrap 최소화 & 성능 프로파일링 (2026-05-05 ~ 05-12)

### 목표
- bootstrap.js 크기: 1.4MB → 800KB (43% 감소)
- 에이전트 초기화 시간: 200ms → 100ms
- 성능 프로파일링 stdlib 완성

### 작업 항목

#### 1️⃣ Bootstrap 최소화 (2일)
```
파일: scripts/build.js, esbuild.config.js
변경:
  ├─ esbuild 설정 minify 강화
  │  ├─ compress: {passes: 3} (2 → 3 증가)
  │  ├─ mangle: true
  │  └─ treeShaking: true
  │
  ├─ 미사용 stdlib 제거
  │  ├─ stdlib-mongodb.ts → devDependencies만
  │  ├─ stdlib-sharp.ts → 선택적 로드
  │  └─ stdlib-mariadb.ts → 조건부 컴파일
  │
  └─ 코드 스플리팅
     ├─ core.js (필수): 300KB (readline, fs, path, util)
     ├─ stdlib.js (지연 로드): 400KB
     └─ ext.js (선택): 200KB (mongodb, sharp)

검증:
  └─ npm run build && ls -lh bootstrap.js
     목표: < 900KB

예상 시간: 8h
위험도: 낮음 (기존 코드 정리만)
```

#### 2️⃣ 성능 프로파일링 Stdlib (3일)
```
파일: src/stdlib-perf.ts (신규)
추가 함수:

a) profile-fn: 함수 성능 측정
   문법: (profile-fn fn-name count)
   반환: {
     name: string
     calls: number
     total_ms: number
     avg_ms: number
     min_ms: number
     max_ms: number
     p50_ms: number
     p95_ms: number
     p99_ms: number
   }
   예:
     (profile-fn fib-memo 1000)
     → {calls: 1000, total_ms: 5.2, avg_ms: 0.0052, p99_ms: 0.012}

b) trace-expr: 표현식 추적
   문법: (trace-expr $expr :label "name")
   반환: {
     label: string
     time_ms: number
     memory_delta_kb: number
     gc_count: number
     result: any
   }
   예:
     (trace-expr (fib-memo 30) :label "fib30")
     → {label: "fib30", time_ms: 12.5, memory_delta_kb: 2048}

c) perf-stats: 전역 성능 통계
   문법: (perf-stats)
   반환: {
     uptime_ms: number
     total_time_ms: number
     gc_time_ms: number
     allocations: number
     gc_count: number
     memory_peak_kb: number
   }
   예:
     (perf-stats)
     → {uptime_ms: 5000, total_time_ms: 4500, gc_time_ms: 200}

d) monitor-fn: 실시간 모니터링
   문법: (monitor-fn fn-name :interval 100 :duration 5000)
   출력: 매 100ms마다 "fn: 45ms | mem: +512KB | gc: 2x"
   반환: 최종 통계

테스트:
  ├─ test/stdlib-perf.test.ts (8 테스트)
  │  ├─ profile-fn basic
  │  ├─ profile-fn with deep recursion
  │  ├─ trace-expr memory tracking
  │  ├─ perf-stats accuracy
  │  ├─ monitor-fn streaming
  │  └─ concurrent profiling
  │
  └─ 벤치마크:
     (profile-fn fib-memo 1000) → < 50ms
     (perf-stats) → < 10ms

예상 시간: 16h
위험도: 낮음 (신규 모듈, 기존 코드 미영향)
```

#### 3️⃣ 레이지 로드 런타임 (1일)
```
파일: src/stdlib-lazy-registry.ts (수정)
변경:
  ├─ 핵심 stdlib만 초기 로드 (20개)
  │  ├─ core: math, string, array, map, logic
  │  ├─ io: println, read-file, write-file
  │  ├─ control: if, loop, try-catch, defn
  │  └─ perf: profile-fn, trace-expr (신규)
  │
  └─ 나머지는 lazy-load
     ├─ db, http, crypto, regex → 첫 호출 시
     ├─ 로드 시간: < 100ms
     └─ 캐시: 메모리 (재로드 없음)

성능:
  ├─ 초기 로드: 200ms → 100ms
  ├─ 첫 db 호출: +150ms (레이지)
  └─ 이후 호출: 0ms (캐시)

예상 시간: 4h
위험도: 중간 (동적 로드 가능 버그)
```

### 완료 기준
- [ ] bootstrap.js < 900KB
- [ ] profile-fn 성능 측정 정확도 ±5%
- [ ] 초기 로드 시간 < 150ms
- [ ] 8개 테스트 통과
- [ ] git commit: "feat: bootstrap 최소화 + 성능 프로파일링"

### 위험 평가
- **브레이킹**: 낮음 (레이지 로드 캐시 버그 가능)
- **성능 회귀**: 매우 낮음 (기존 코드 복사)
- **대응책**: e2e 테스트 강화

---

## Phase F-3: HTTP/DB 헬퍼 & 배치 작업 (2026-05-12 ~ 05-19)

### 목표
- HTTP/DB 코드량 50% 감소
- 배치 작업 병렬 처리 (worker_threads)
- 실시간 모니터링 대시보드

### 작업 항목

#### 1️⃣ HTTP 매크로 Stdlib (2일)
```
파일: src/stdlib-http-macro.ts (신규)
추가 함수:

a) http-json: 통합 JSON 호출
   문법: (http-json :post "url" {:key "value"})
         (http-json :get "url" :headers {:auth "token"})
         (http-json :patch "url" {:update "data"})
   내부:
     ├─ JSON 자동 직렬화
     ├─ 에러 자동 처리 (retry 3회)
     ├─ 타임아웃: 30s
     └─ 반환: parsed JSON or error
   예:
     (http-json :post "https://api.example.com/data" {:name "AI"})
     → {:success true :id 123}

b) http-stream: 스트리밍 응답
   문법: (http-stream :get "url" :on-chunk (fn [chunk] ...))
   사용: 대용량 파일 다운로드
   반환: 최종 byte count

c) http-batch: 배치 요청
   문법: (http-batch [{:method :post :url "..." :body {...}} ...])
   병렬: worker_threads (4개 스레드)
   타임아웃: 60s (전체)
   반환: [결과1, 결과2, ...]

테스트:
  ├─ test/stdlib-http-macro.test.ts (10 테스트)
  │  ├─ http-json POST
  │  ├─ http-json GET with headers
  │  ├─ http-json PATCH
  │  ├─ http-json error retry
  │  ├─ http-stream large file
  │  └─ http-batch parallel 5 requests
  │
  └─ 벤치마크:
     (http-json :get "https://httpbin.org/get") → < 1000ms

예상 시간: 12h
위험도: 낮음 (새로운 래퍼)
코드 감소: 70% (기존 http-post-json 등 제거)
```

#### 2️⃣ DB 쿼리 빌더 (2일)
```
파일: src/stdlib-db-query.ts (신규)
추가 함수:

a) db-query: DSL 기반 쿼리
   문법: (db-query :select [:id :name :age]
                   :from "users"
                   :where {:age > 18 :status "active"}
                   :order-by {:created_at :desc}
                   :limit 10)
   
         (db-query :insert "users"
                   {:id 1 :name "Agent" :age 30})
   
         (db-query :update "users"
                   {:status "inactive"}
                   :where {:id 1})
   
         (db-query :delete "users"
                   :where {:age < 18})

b) db-transaction: 트랜잭션
   문법: (db-transaction
            [(db-query :insert "orders" {...})
             (db-query :update "inventory" {...})])
   반환: [결과1, 결과2] or error (모두 롤백)

c) db-batch: 배치 삽입
   문법: (db-batch :insert "users"
                   [{:id 1 :name "A"}
                    {:id 2 :name "B"}
                    {:id 3 :name "C"}])
   성능: 단일 N개 요청 → 1회 트랜잭션
   반환: {:inserted 3 :errors []}

테스트:
  ├─ test/stdlib-db-query.test.ts (12 테스트)
  │  ├─ db-query SELECT basic
  │  ├─ db-query WHERE conditions
  │  ├─ db-query INSERT
  │  ├─ db-query UPDATE
  │  ├─ db-query DELETE
  │  ├─ db-transaction success
  │  ├─ db-transaction rollback
  │  └─ db-batch insert 1000 rows
  │
  └─ 성능:
     (db-batch :insert "users" [1000 rows]) → < 100ms

예상 시간: 14h
위험도: 중간 (트랜잭션 동시성)
코드 감소: 50% (기존 db-select/db-put 등 단순화)
```

#### 3️⃣ 모니터링 대시보드 웹 UI (1.5일)
```
파일: app/monitor-dashboard.fl (신규)
기능:
  ├─ 실시간 성능 지표
  │  ├─ CPU 사용률 (process.cpuUsage)
  │  ├─ 메모리 사용률 (process.memoryUsage)
  │  ├─ GC 횟수/시간
  │  └─ 요청/초 (TPS)
  │
  ├─ 함수별 성능 추적
  │  ├─ 상위 10개 느린 함수
  │  ├─ 각 함수 호출 분포
  │  └─ 병목 지점 표시
  │
  └─ 실시간 로그
     ├─ trace-expr 결과 스트림
     ├─ 에러 로그
     └─ 성능 알림 (p99 > 1000ms)

기술:
  ├─ 백엔드: FreeLang HTTP 서버 (포트 40500)
  ├─ 프론트엔드: HTML5 (vanilla JS)
  └─ WebSocket: 실시간 업데이트 (초당 10회)

예상 시간: 8h
위험도: 낮음 (UI만, 백엔드 미영향)
```

### 완료 기준
- [ ] http-json 성공/에러/재시도 모두 테스트
- [ ] db-query SELECT/INSERT/UPDATE/DELETE 모두 지원
- [ ] db-transaction 롤백 검증
- [ ] db-batch 1000행 < 100ms
- [ ] 10개 HTTP 병렬 요청 < 5s
- [ ] 22개 테스트 통과
- [ ] 모니터링 대시보드 응답 < 100ms
- [ ] git commit: "feat: HTTP/DB 헬퍼 + 배치 작업"

### 위험 평가
- **브레이킹**: 중간 (기존 db-select 호환성)
- **성능 회귀**: 낮음 (병렬처리 추가만)
- **동시성**: 중간 (worker_threads 버그 가능)
- **대응책**: 동시성 테스트 강화

---

## Phase F-4: 선택적 npm 모듈 & 최종 검증 (2026-05-19 ~ 05-26)

### 목표
- 선택적 npm 모듈 지원 (Stripe, AWS)
- 라우팅 stdlib 강화
- 에러 추적 (sentry-like)
- 최종 성능 검증

### 작업 항목

#### 1️⃣ 선택적 npm 모듈 브릿지 (2일)
```
파일: src/stdlib-npm-bridge.ts (신규)
패턴: 사용자가 npm install stripe를 선택

a) require-optional: npm 모듈 조건부 로드
   문법: (require-optional "stripe")
   반환: module or error message
   예:
     (let [[$stripe (require-optional "stripe")]]
       (if (nil? $stripe)
         (error "Stripe 사용: npm install stripe 필수")
         ($stripe/createCharge ...)))

b) npm-list: 설치된 선택적 모듈 확인
   문법: (npm-list)
   반환: ["stripe" "aws-sdk" "twilio"]

사용 시나리오:
  ├─ 기본: 전체 npm 0 (완전 독립)
  ├─ 선택: npm install stripe (Stripe 결제만)
  └─ 플러스: npm install stripe aws-sdk (결제 + AWS)

예상 시간: 8h
위험도: 중간 (모듈 검증)
```

#### 2️⃣ 라우팅 Stdlib 강화 (1.5일)
```
파일: src/stdlib-http-server.ts (수정)
추가:

a) route-map: 라우팅 테이블
   문법: (route-map
            {:get "/" handler-fn-home}
            {:post "/api/data" handler-fn-create}
            {:put "/api/data/:id" handler-fn-update}
            {:delete "/api/data/:id" handler-fn-delete})
   기능: 자동 메서드 + 경로 매칭

b) middleware: 미들웨어 파이프라인
   문법: (middleware
            [auth-check
             log-request
             compress-response])
   실행: 요청 → auth → log → compress → handler → 응답

c) rest-crud: CRUD 자동 생성
   문법: (rest-crud "users" db-table)
   생성: GET/POST/PUT/DELETE 모두 자동
   코드: 1줄 → 20줄 자동 구현

테스트:
  ├─ route-map 5개 경로
  ├─ middleware 순서 검증
  └─ rest-crud 4개 메서드

예상 시간: 8h
위험도: 낮음 (기존 코드 래핑)
```

#### 3️⃣ 에러 추적 (Sentry-like) (1.5일)
```
파일: src/stdlib-error-tracking.ts (신규)
기능:

a) capture-error: 에러 스냅샷
   문법: (capture-error $expr :tags {:user "agent-1"})
   기록: {
     timestamp: "2026-05-20T10:30:00Z"
     error: string
     stack: [call-stack...]
     tags: {:user "agent-1"}
     context: {code_snippet: "..."}
   }

b) error-report: 생성된 에러 목록
   문법: (error-report :since "2026-05-20" :limit 100)
   반환: [에러1, 에러2, ...]

c) alert-on-error: 특정 에러 알림
   문법: (alert-on-error :pattern "Database connection"
                        :action (fn [err] (println err)))

저장: JSON 파일 (results/error-log.jsonl)

예상 시간: 6h
위험도: 낮음 (로깅만)
```

#### 4️⃣ 최종 성능 검증 (1.5일)
```
벤치마크 모음: benchmark-final.fl (신규)

테스트:
  ├─ bootstrap 초기화: < 150ms
  ├─ 에이전트 작업 (fib-memo 1000): < 50ms
  ├─ HTTP 배치 (10개 병렬): < 5s
  ├─ DB 배치 삽입 (1000행): < 100ms
  ├─ 메모리 누수: 1시간 실행 후 < 10% 증가
  └─ GC 정지 시간: < 100ms

결과: benchmark-final-results.json
  {
    "bootstrap_ms": 120,
    "fib_memo_1000_ms": 42,
    "http_batch_10_ms": 4200,
    "db_batch_1000_ms": 85,
    "memory_growth_pct": 5.2,
    "gc_pause_ms": 82,
    "status": "PASS"
  }

예상 시간: 8h
```

### 완료 기준
- [ ] require-optional 모듈 로드 성공
- [ ] route-map 5개 경로 정상 동작
- [ ] middleware 순서 검증
- [ ] rest-crud 4개 메서드 자동 생성
- [ ] capture-error 스택 추적
- [ ] 최종 성능 벤치마크 PASS
- [ ] 30개 이상 테스트 통과
- [ ] git commit: "feat: 선택적 npm + 라우팅 + 에러추적"

---

## 📊 Phase F 전체 일정

```
Week 1 (05-05 ~ 05-12): F-2 Bootstrap + 성능 프로파일링
  Mon 05-05: bootstrap 최소화 시작
  Wed 05-07: 성능 프로파일링 50% 완료
  Fri 05-09: 레이지 로드 구현
  Sat 05-10: 테스트 + 리뷰
  ✓ 완료: bootstrap 800KB, profile-fn 완성

Week 2 (05-12 ~ 05-19): F-3 HTTP/DB 헬퍼
  Mon 05-12: HTTP 매크로 시작
  Wed 05-14: DB 쿼리 빌더 50% 완료
  Fri 05-16: 배치 작업 + 모니터링
  Sat 05-17: 통합 테스트
  ✓ 완료: http-json, db-query, db-batch 완성

Week 3 (05-19 ~ 05-26): F-4 최종 검증
  Mon 05-19: 선택적 npm 모듈 시작
  Wed 05-21: 라우팅 강화
  Fri 05-23: 에러 추적 + 성능 검증
  Sat 05-24: 최종 테스트
  Sun 05-25: 문서화 + 릴리스 준비
  ✓ 완료: v11.4.0 준비

Release (05-26)
  └─ v11.4.0 tag + 배포
```

---

## 📈 예상 성과

### 성능 개선
```
초기화 시간:    200ms → 100ms (50% 단축)
에이전트 반응:  300ms → 150ms (50% 단축)
배치 처리:      병렬화 (4배 처리량)
HTTP 코드:      10줄 → 1줄 (90% 단축)
DB 코드:        15줄 → 3줄 (80% 단축)
```

### 테스트 커버리지
```
현재:   823/823 (99.8%)
목표:   900/900 (99.8%)
추가:   F-2 (8개) + F-3 (22개) + F-4 (15개) = 45개
```

### 문서화
```
현재: 62개 .md
추가: 
  ├─ stdlib-perf.md
  ├─ stdlib-http-macro.md
  ├─ stdlib-db-query.md
  ├─ PHASE-F-ROADMAP.md (이 파일)
  └─ PERFORMANCE-GUIDE.md
→ 67개
```

---

## ⚠️ 위험 평가 & 대응책

| 항목 | 위험도 | 영향 | 대응책 |
|------|--------|------|--------|
| 레이지 로드 캐시 | 중간 | 성능 회귀 | e2e 테스트 강화 |
| worker_threads 버그 | 중간 | 데드락 | 타임아웃 + 모니터링 |
| 트랜잭션 동시성 | 중간 | 데이터 손상 | 락 + 재시도 |
| 선택적 npm 검증 | 중간 | 보안 | 허용 목록 관리 |
| 성능 회귀 | 낮음 | 배포 불가 | 자동 벤치마크 |

---

## 🎯 성공 기준

### 기술적 기준
- [ ] 45개 신규 테스트 통과 (99.8% 유지)
- [ ] 성능 벤치마크 모두 PASS
- [ ] 코드 커버리지 95% 이상
- [ ] 메모리 누수 없음 (1시간 < 10% 증가)

### 인프라 기준
- [ ] Gogs + GitHub 동기화
- [ ] 3개 주요 커밋 (F-2, F-3, F-4)
- [ ] v11.4.0 태그 생성
- [ ] 변경사항 문서화

### AI 관점 기준
- [ ] 에이전트 초기화 < 150ms
- [ ] 프로파일링 오버헤드 < 10%
- [ ] HTTP/DB 코드 50% 감소
- [ ] 완전 결정론 유지

---

## 📝 다음 단계

1. ✅ 로드맵 구성 완료 (이 파일)
2. 🔜 Phase F-2 시작 (bootstrap 최소화)
3. 매주 진행상황 리뷰
4. 2026-05-26 v11.4.0 릴리스

