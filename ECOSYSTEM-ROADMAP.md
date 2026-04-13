# FreeLang v9 생태계 확장 로드맵 (Phase 7~12)

## 개요

v9 언어 자체는 완성되었으나, **실제로 쓸 수 없는 이유**들을 Phase 7~12로 해결:

| 문제 | Phase | 해결책 |
|------|-------|--------|
| ❌ 프로덕션 백엔드 | 12 | 마이크로서비스 프레임워크 |
| ❌ 팀 협업 | 11 | LSP, 문서생성기, 테스트 도구 |
| ❌ 데이터 분석 | 10 | 테이블, 통계, 시각화 |
| ❌ 웹 개발 | 9 | FLNext v2 (ORM, 검증, 미들웨어) |
| ❌ 패키지 배포 | 8 | OCI 자동 빌드 |
| ❌ 패키지 서버 | 7 | npm 호환 Registry |

---

## Phase 7: Registry 통합 (npm 호환 패키지서버)

**목표**: v9 패키지를 npm과 호환되는 방식으로 배포/설치  
**기간**: 2주  
**규모**: ~300줄 v9 코드

### 구현 내용

```lisp
; registry-server.fl (150줄)
[SERVICE registry
  :routes [
    [ROUTE GET "/-/all" (list-all-packages)]
    [ROUTE PUT "/:pkg" (publish-package)]
    [ROUTE GET "/:pkg/:ver" (get-version)]
    [ROUTE DELETE "/:pkg/:ver" (delete-version)]]]

; v9-pm 통합 (50줄)
(registry/publish {:name "v9-data" :version "1.0.0" :files [...]})
(registry/search "data")
```

### 검증
- 20개 패키지 publish/install 테스트
- npm 호환성 검증
- 버전 충돌 해결

### 결과
✅ `v9-pm install @registry/package` 가능  
✅ npm과 동일한 패키지 관리 경험

---

## Phase 8: 자동 배포 (Docker → v9 native OCI)

**목표**: v9 앱을 직접 OCI 이미지로 빌드  
**기간**: 3주  
**규모**: ~400줄 v9 코드

### 구현 내용

```lisp
; v9-build-oci.fl (200줄)
[FUNC build-oci :params [app-dir output-tag]
  :body
  (do
    ; 1. v9 코드 컴파일
    (fl_compile app-dir "dist")
    
    ; 2. OCI 레이어 생성
    (oci/create-layer "base" v9-runtime)
    (oci/add-layer "app" "dist")
    
    ; 3. 이미지 빌드 & 서명
    (oci/build output-tag)
    (oci/sign output-tag))]

; CLI
(def status (oci/build "handwash-pos" "--tag" "myapp:1.0.0"))
```

### 검증
- handwash-pos를 v9 OCI로 배포
- saas-platform을 v9 OCI로 배포
- Kubernetes에서 실행
- 이미지 크기 < 50MB

### 결과
✅ `fl build --oci app.fl --tag myapp:1.0.0`  
✅ Docker 설치 불필요  
✅ 직접 registry에 push 가능

---

## Phase 9: 웹프레임워크 강화 (FLNext v2)

**목표**: Django/FastAPI 수준의 개발경험  
**기간**: 4주  
**규모**: ~400줄 v9 코드

### 구현 내용

#### 1. ORM (flnext-orm.fl)

```lisp
[MODEL User
  :table "users"
  :fields [
    {:name id :type integer :primary-key true}
    {:name email :type string :unique true}
    {:name created-at :type datetime}]
  :indexes [email]]

; 사용
(User/create {:email "kim@example.com"})
(User/find-by-email "kim@example.com")
(User/where {:age > 18})
```

#### 2. 입력 검증 (flnext-validation.fl)

```lisp
[SCHEMA RegisterRequest
  :fields {
    :name {:type string :min 1 :max 100 :required true}
    :email {:type email :required true}
    :password {:type string :min 8 :pattern "^[A-Za-z0-9]+"}}]

; 사용
(if (valid? RegisterRequest $request)
  (register-user $request)
  (error 400 "Invalid input"))
```

#### 3. 미들웨어 체인 (flnext-middleware.fl)

```lisp
[MIDDLEWARE auth-check
  :condition (has-token?)
  :on-fail (fn [] (error 401 "Unauthorized"))
  :on-success (attach-user)]

[MIDDLEWARE rate-limit
  :limit 1000
  :window "1h"
  :on-limit (fn [] (error 429 "Too many requests"))]
```

### 검증
- 30개 라우트 성공
- 1000 req/sec 처리
- 동시연결 100개 안정성
- 성능: < 100ms latency

### 결과
✅ Express/FastAPI 수준의 개발경험  
✅ 타입 안전성 (스키마 검증)  
✅ 자동 마이그레이션

---

## Phase 10: 데이터분석 라이브러리 (v9-data)

**목표**: NumPy/Pandas 수준의 데이터 분석  
**기간**: 4주  
**규모**: ~500줄 v9 코드

### 구현 내용

#### 1. 테이블 조작 (v9-table.fl)

```lisp
(def data (table/load-csv "data.csv"))

; 선택
(table/select data :cols [id name score])

; 필터링
(table/filter data (fn [$row] (> (get $row :score) 80)))

; 그룹화
(table/group-by data :category)

; 집계
(table/aggregate data :score :mean :min :max)

; 조인
(table/join data1 data2 :on :id)
```

#### 2. 통계 (v9-stats.fl)

```lisp
(stats/mean data)
(stats/median data)
(stats/stddev data)
(stats/percentile data 95)
(stats/correlation data1 data2)
(stats/ttest data1 data2)
```

#### 3. 시각화 (v9-plot.fl)

```lisp
(plot/histogram data :title "Distribution" :bins 20)
(plot/scatter x y :color-by category)
(plot/line x y :style "smooth")
(plot/heatmap matrix)
(plot/save "chart.png")
```

### 검증
- 1M 행 데이터 처리
- 성능: 100MB/sec 이상
- 50개 통계 함수
- 20개 차트 타입

### 결과
✅ Pandas와 동일한 API  
✅ 빠른 성능 (최적화)  
✅ 인메모리 + 디스크 모드

---

## Phase 11: 팀 프로젝트 도구

**목표**: 협업 가능한 개발 환경  
**기간**: 3주  
**규모**: ~450줄 v9 코드

### 구현 내용

#### 1. 자동 문서생성 (v9-doc.fl)

```lisp
; 소스 코드에서 자동 추출
[FUNC calculate-average :params [numbers]
  "평균값을 계산한다"
  :example "(calculate-average [1 2 3 4 5]) => 3"
  :body ...]

; 명령
(doc/generate "src" "docs/")
; → Markdown (GitHub 호환)
; → HTML (정적 사이트)
; → PDF (인쇄용)
```

#### 2. LSP (Language Server Protocol)

```lisp
; vpm에 LSP 바인딩 추가
(lsp/start :port 9000)

; 지원 기능
- 자동완성 (심볼 테이블 기반)
- 타입 힌트
- 에러 검출
- 코드 포매팅
- 리팩토링 제안
- 참조 찾기 (goto-definition, find-usages)

; VSCode, Vim, Emacs 플러그인
```

#### 3. 테스트 프레임워크 강화

```lisp
(deftest "user creation"
  :setup (fn [] (init-db))
  :teardown (fn [] (cleanup-db))
  (let [[user (user/create {:name "Kim"})]]
    (assert-eq (get user :name) "Kim")))

; 실행 및 리포트
(test/run-all)
; → 병렬 실행 (8 스레드)
; → 커버리지: 85%
; → CI/CD 통합 (JSON 리포트)
```

### 검증
- 50개 함수 자동 문서화
- VSCode에서 자동완성 작동
- 100개 테스트 병렬 실행 < 5초
- 99% 심볼 정확도

### 결과
✅ 문서가 자동으로 최신화됨  
✅ IDE 지원 (VSCode, Vim)  
✅ 테스트 경험 우수

---

## Phase 12: 백엔드 프레임워크 (마이크로서비스)

**목표**: 프로덕션 수준의 마이크로서비스 지원  
**기간**: 4주  
**규모**: ~600줄 v9 코드

### 구현 내용

#### 1. 서비스 정의 (v9-service.fl)

```lisp
[SERVICE user-service
  :port 3001
  :database {:type sqlite :path "users.db"}
  :routes [
    [ROUTE GET "/users/:id" 
      (fn [$req] 
        (ok (user/find (get $req :id))))]
    [ROUTE POST "/users"
      (fn [$req]
        (if (valid? UserSchema (get $req :body))
          (ok (user/create (get $req :body)))
          (err "VALIDATION_ERROR" "Invalid user data")))]
  ]]

(service/start user-service)
```

#### 2. 메시지큐 (v9-message-queue.fl)

```lisp
; 발행
(queue/publish "user.created" {:id 123 :email "kim@example.com"})

; 구독
(queue/subscribe "user.created" (fn [$msg]
  (send-welcome-email (get $msg :email))))

; 고급: 재시도, 데드레터큐
(queue/subscribe "payment.processed"
  :handler (process-payment)
  :max-retries 3
  :backoff "exponential")
```

#### 3. Circuit Breaker (장애 전파 방지)

```lisp
[CIRCUIT-BREAKER external-api
  :threshold 5  ; 5번 실패 시 차단
  :timeout 30s   ; 30초 후 복구 시도
  :fallback (fn [] (cached-response))]

; 사용
(circuit/call external-api/fetch-user (get $req :id))
```

#### 4. 모니터링 (Observability)

```lisp
; 메트릭
(observe/track-latency "api.request" (fn [] (slow-operation)))
(observe/count-errors "api.errors")
(observe/histogram "request.size" bytes)

; 로깅
(observe/log :level "info" :message "User created" :user-id 123)

; 분산 추적
(observe/span "process-order" (fn []
  (observe/span "validate" (validate-order))
  (observe/span "pay" (process-payment))
  (observe/span "ship" (ship-order))))
```

### 검증
- 5개 마이크로서비스 배포
- 1000 req/sec 처리
- 999.9ms 응답시간
- 장애 주입 테스트 (chaos engineering)
- 99.9% 가용성 확인

### 결과
✅ Netflix/Uber 수준의 마이크로서비스  
✅ 자동 재시도/서킷브레이커  
✅ 분산 추적 (distributed tracing)

---

## 생태계 완성 타임라인

```
2026-04-13: Phase 6 완료 (순수 v9 컴파일러)
2026-05-03: Phase 7 완료 (Registry)
2026-05-24: Phase 8 완료 (OCI 배포)
2026-06-21: Phase 9 완료 (웹프레임워크)
2026-07-19: Phase 10 완료 (데이터분석)
2026-08-09: Phase 11 완료 (팀 도구)
2026-09-06: Phase 12 완료 (마이크로서비스)

총 22주 (약 5~6개월)
```

---

## 최종 생태계 완성도

| 기능 | 현재 | Phase 7 | Phase 8 | Phase 9 | Phase 10 | Phase 11 | Phase 12 |
|------|------|---------|---------|---------|----------|----------|----------|
| 프로덕션 백엔드 | ❌ | 🟡 | 🟡 | 🟡 | 🟡 | ✅ | ✅ |
| 팀 협업 | ❌ | ❌ | ❌ | 🟡 | 🟡 | ✅ | ✅ |
| 데이터 분석 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| 웹 개발 | 🟡 | 🟡 | 🟡 | ✅ | ✅ | ✅ | ✅ |
| 자동 배포 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 패키지 관리 | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 핵심: 모든 도구가 v9로 구현

```
v9 언어 (Phase 150 완료)
├─ v9-pm (패키지관리)
├─ v9-build (컴파일)
├─ v9-run (런타임)
├─ v9-registry (Phase 7)
├─ v9-oci (Phase 8)
├─ flnext (Phase 9)
├─ v9-data (Phase 10)
├─ v9-lsp (Phase 11)
└─ v9-service (Phase 12)
```

**이점:**
- 외부 의존성 제로
- 버전 관리 단순 (v9 버전 = 모든 도구 버전)
- v9 학습 = 모든 도구 학습
- v9 개선 = 모든 도구 자동 개선

---

## 최종 목표: "AI가 쓸 수 있는 프로덕션 환경"

```
현재 (Phase 6 완료):
  "v9는 좋은 언어지만 쓸 수 없다" ❌

Phase 12 완료 후:
  "v9로 모든 것을 만들 수 있다" ✅
```
