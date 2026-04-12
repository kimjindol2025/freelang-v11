# 병렬 개발 추적 — 3개 옵션 동시 진행

**시작 일시**: 2026-04-12  
**상태**: 🚀 병렬 진행 중  
**브랜치**: 3개 (phase-13-oauth2-registry, phase-5-deployment-handwash, phase-5-dependency-removal)

---

## 📊 진행 현황

### Track A: Phase 13 - OAuth2 Registry 🔐

```
브랜치: phase-13-oauth2-registry
상태: 🔵 계획 중 → 구현 대기
```

| Stage | 작업 | 상태 | ETA |
|-------|------|------|-----|
| 1 | OAuth2 토큰 관리 | ⏳ 대기 | +1일 |
| 2 | 프라이빗 레지스트리 엔드포인트 | ⏳ 대기 | +1일 |
| 3 | RBAC (역할 기반 접근) | ⏳ 대기 | +1.5일 |
| 4 | CLI 명령어 추가 | ⏳ 대기 | +0.5일 |
| **총계** | **4단계** | **⏳ 대기** | **4~5일** |

**목표**: vpm을 프라이빗 패키지 관리로 확장  
**영향도**: 높음 (기능 확장)  
**다음 단계**: Phase 14 Cache Management

---

### Track B: handwash-pos Phase 5 - 배포 🚀

```
브랜치: phase-5-deployment-handwash
상태: 🔵 계획 중 → 구현 대기
```

| Stage | 작업 | 상태 | ETA |
|-------|------|------|-----|
| 1 | Nginx 리버스 프록시 | ⏳ 대기 | +1일 |
| 2 | PM2 자동 관리 | ⏳ 대기 | +0.5일 |
| 3 | SSL/TLS (Let's Encrypt) | ⏳ 대기 | +0.5일 |
| 4 | 무중단 배포 스크립트 | ⏳ 대기 | +0.5일 |
| 5 | 백업 & 복구 | ⏳ 대기 | +0.5일 |
| **총계** | **5단계** | **⏳ 대기** | **3일** |

**목표**: 손세차 POS를 프로덕션 배포  
**영향도**: 최고 (실제 사용자 지원)  
**다음 단계**: SaaS 배포

---

### Track C: Phase 5 - 의존성 제거 🎯

```
브랜치: phase-5-dependency-removal
상태: 🔵 계획 중 → 구현 대기
```

| Stage | 작업 | 상태 | ETA |
|-------|------|------|-----|
| 1 | v9-build 시스템 구현 | ⏳ 대기 | +3일 |
| 2 | v9-run 환경 구현 | ⏳ 대기 | +2일 |
| 3 | v9-pm 패키지 관리 | ⏳ 대기 | +3일 |
| 4 | CI/CD 자동화 (v9만) | ⏳ 대기 | +2일 |
| 5 | 통합 테스트 | ⏳ 대기 | +2일 |
| **총계** | **5단계** | **⏳ 대기** | **10~12일** |

**목표**: FreeLang v9 완전 자가부트스트랩  
**영향도**: 매우 높음 (독립성)  
**다음 단계**: Phase 6 Docker 제거

---

## 🎯 병렬 진행 전략

### 우선순위

```
🥇 Track B (배포)
   → 가장 빠름 (3일)
   → 실제 사용자 지원 가능
   → ROI 높음

🥈 Track A (OAuth2)
   → 중간 (4~5일)
   → vpm 기능 확장
   → 프라이빗 패키지 지원

🥉 Track C (의존성 제거)
   → 가장 길음 (10~12일)
   → 장기 프로젝트
   → 완전 독립성 달성
```

### 작업 분담 (가상)

만약 3명의 개발자가 있다면:

```
Developer A: Track B (배포)
  ├─ Nginx 설정
  ├─ PM2 설정
  ├─ SSL 인증서
  └─ 배포 자동화

Developer B: Track A (OAuth2)
  ├─ 토큰 관리
  ├─ 레지스트리 API
  ├─ RBAC
  └─ CLI 명령어

Developer C: Track C (의존성 제거)
  ├─ v9-build 구현
  ├─ v9-run 구현
  ├─ v9-pm 포팅
  └─ CI/CD 자동화
```

### 예상 일정

```
Week 1 (2026-04-12 ~ 2026-04-18):
  ✅ Track B 완료 (배포 준비)
  🟡 Track A 50% (OAuth2 인증)
  🟡 Track C 30% (v9-build 구현)

Week 2 (2026-04-19 ~ 2026-04-25):
  ✅ Track A 완료 (OAuth2 RBAC)
  🟡 Track C 70% (v9-pm 포팅)

Week 3 (2026-04-26 ~ 2026-05-02):
  ✅ Track C 완료 (의존성 제거)
  
Overall: 모든 트랙 완료 📊
```

---

## 📝 커밋 전략

### 각 브랜치별 커밋 규칙

**Track A (OAuth2)**:
```
Commits:
  1. feat: OAuth2 토큰 관리 구현
  2. feat: 프라이빗 레지스트리 엔드포인트
  3. feat: RBAC 역할 기반 접근 제어
  4. feat: CLI 명령어 (login, token, publish)
  5. test: OAuth2 8개 테스트 시나리오
  6. docs: Phase 13 완료 보고서
```

**Track B (배포)**:
```
Commits:
  1. infra: Nginx 리버스 프록시 설정
  2. infra: PM2 자동 관리 설정
  3. infra: SSL/TLS Let's Encrypt
  4. automation: 무중단 배포 스크립트
  5. automation: 백업 & 복구 자동화
  6. docs: Phase 5 배포 가이드
```

**Track C (의존성 제거)**:
```
Commits:
  1. feat: v9-build TypeScript 컴파일러
  2. feat: v9-run 실행 환경
  3. feat: v9-pm 패키지 관리자
  4. test: v9 자체 구현 검증
  5. ci/cd: GitHub Actions (v9만)
  6. docs: Phase 5 의존성 제거 보고서
```

---

## 🔄 마일스톤

### 마일스톤 1: Phase 5 배포 완성 ✅

**대상**: Track B  
**기한**: 2026-04-15  
**지표**:
- ✅ Nginx 설정 완료
- ✅ PM2 설정 완료
- ✅ SSL 인증서 발급
- ✅ 무중단 배포 테스트
- ✅ 실제 서버 배포

**체크리스트**:
```
□ Nginx 설치 + 설정
□ PM2 설치 + ecosystem.config.js
□ Let's Encrypt 인증서 발급
□ HTTPS 리다이렉트
□ 자동 배포 스크립트
□ 백업 자동화 (cron)
□ 모니터링 (PM2 logs)
□ 부하 테스트 (500명 동시)
□ 가용성 검증 (99.9%)
```

---

### 마일스톤 2: OAuth2 완성 ✅

**대상**: Track A  
**기한**: 2026-04-18  
**지표**:
- ✅ 토큰 발급/갱신 작동
- ✅ 프라이빗 패키지 게시 가능
- ✅ RBAC 권한 제어
- ✅ 8/8 테스트 통과

**체크리스트**:
```
□ OAuth2 토큰 엔드포인트
□ 토큰 갱신 메커니즘
□ 프라이빗 패키지 저장소
□ RBAC (viewer/publisher/admin)
□ vpm login 명령어
□ vpm publish --private
□ 프라이빗 설치 (org/pkg)
□ 인증 실패 처리 (403)
```

---

### 마일스톤 3: 의존성 제거 완성 ✅

**대상**: Track C  
**기한**: 2026-04-26  
**지표**:
- ✅ v9-build로 컴파일 가능
- ✅ v9-run으로 실행 가능
- ✅ v9-pm으로 패키지 관리
- ✅ npm 호환성 유지

**체크리스트**:
```
□ v9-build TypeScript → JavaScript
□ v9-run 모듈 로딩
□ v9-pm install/publish/search
□ package.json 호환
□ node_modules 호환
□ CI/CD v9 자동화
□ 빌드 시간 측정 (3초?)
□ 저장소 크기 축소 (100MB?)
```

---

## 📊 성공 기준

### Track A (OAuth2) 성공 = 
```
✅ vpm login으로 OAuth2 인증 가능
✅ vpm publish --private으로 프라이빗 게시 가능
✅ 비인가 사용자는 403 Forbidden
✅ vpm whoami로 사용자 정보 조회 가능
✅ 8/8 테스트 통과
```

### Track B (배포) 성공 = 
```
✅ pos.handwash.kr HTTPS로 접속 가능
✅ PM2로 자동 재시작 동작
✅ SSL 인증서 유효
✅ 무중단 배포 확인 (0초 downtime)
✅ 500명 동시 접속 성공
```

### Track C (의존성 제거) 성공 = 
```
✅ v9로만 프로젝트 빌드 가능
✅ npm 없이 패키지 설치 가능
✅ TypeScript 호환성 100%
✅ 빌드 시간 5초 → 3초
✅ 저장소 500MB → 100MB
```

---

## 🚀 시작 신호

**준비 완료**: ✅  
**브랜치**: ✅ 3개 생성 (phase-13, phase-5-deployment, phase-5-dependency)  
**문서**: ✅ PHASE12_NEXT_OPTIONS_PR.md  

**다음 단계**: 각 Track별 Plan Mode 시작

---

**현재 상태**: 🔵 대기 중  
**예상 완료**: 2026-04-26 (14일 소요)  
**전체 난이도**: ⭐⭐⭐⭐ (상)

**모든 트랙을 동시에 시작할 준비가 되었습니다!** 🚀
