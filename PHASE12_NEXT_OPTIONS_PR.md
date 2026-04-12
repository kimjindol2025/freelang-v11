# Phase 12 완료 후 다음 단계 — 3가지 옵션 PR 보고

**작성 일시**: 2026-04-12  
**현재 상태**: Phase 12 완료 ✅  
**Gogs 커밋**: 912b23f (완료 문서 푸시)

---

## 📊 현재 상황 분석

### vpm 진행도

| Phase | 기능 | 상태 | 성능 |
|-------|------|------|------|
| **Phase 10** | Conflict Resolution | ✅ 완료 | 9/9 테스트 |
| **Phase 11** | Disk Cache | ✅ 완료 | 80% 단축 |
| **Phase 12** | Parallel Download | ✅ 완료 | 75% 단축 |
| **Phase 13** | OAuth2 Registry | 🔵 계획 중 | ? |
| **Phase 14** | Cache Management | 🔵 계획 | ? |

### 다른 프로젝트 상황

| 프로젝트 | 단계 | 상태 |
|---------|------|------|
| **handwash-pos** | Phase 4 | ✅ 90% |
| **handwash-pos** | Phase 5 | 🔵 계획 중 |
| **saas-platform** | v3.0 Phase 3 | ✅ 98% |
| **의존성 제거** | Phase 4 | ✅ Express 제거 |
| **의존성 제거** | Phase 5 | 🔵 npm/Make 제거 계획 |

---

## 🎯 옵션 1: Phase 13 - OAuth2 Registry (프라이빗 패키지)

### 개요

vpm을 **프라이빗 패키지 관리**로 확장.
현재는 공개 패키지만 지원 → OAuth2 인증 + 프라이빗 레지스트리

### 목표

- OAuth2 토큰 기반 인증
- 프라이빗 패키지 호스팅
- 토큰 만료 + 갱신 메커니즘
- 역할 기반 접근 제어 (RBAC)

### 구현 계획 (4 Stage)

#### Stage 1: OAuth2 토큰 관리
```typescript
// VpmCli 클래스에 추가
private oauth2Tokens: Map<string, OAuthToken> = new Map();

interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];  // 'publish', 'install', 'admin'
}

private async refreshOAuthToken(): Promise<void>
private async validateOAuthToken(): Promise<boolean>
```

#### Stage 2: 프라이빗 레지스트리 엔드포인트
```typescript
// vpm registry 서버에 OAuth2 인증 추가
POST /oauth/token          // 토큰 발급
POST /oauth/refresh        // 토큰 갱신
GET /private/search        // 인증된 검색
POST /private/publish      // 인증된 게시
DELETE /private/package    // 인증된 삭제
```

#### Stage 3: 역할 기반 접근 제어 (RBAC)
```
Role: viewer (읽기만)
  ├─ GET /public/search
  └─ GET /private/search (자신 패키지)

Role: publisher (게시)
  ├─ POST /private/publish
  ├─ DELETE /private/package (자신)
  └─ POST /private/docs

Role: admin (관리)
  ├─ 모든 권한
  ├─ DELETE /private/package (타인)
  └─ GET /admin/users
```

#### Stage 4: CLI 명령어 추가
```bash
vpm login <registry-url>              # OAuth2 로그인
vpm logout                            # 토큰 삭제
vpm token list                        # 발급된 토큰 목록
vpm token revoke <token-id>          # 토큰 취소
vpm whoami                            # 현재 사용자 정보
vpm publish --private                 # 프라이빗 게시
vpm install @myorg/private-pkg@1.0    # 프라이빗 설치
```

### 성능 예상

| 지표 | 값 |
|------|-----|
| OAuth2 응답 시간 | ~500ms |
| 토큰 캐싱 | 1시간 유효 |
| 동시 사용자 | 1000+ |
| 처리량 | 1000+ req/s |

### 테스트 계획

```bash
test-phase13.sh (8개 시나리오)
  TEST 1: OAuth2 로그인
  TEST 2: 토큰 갱신
  TEST 3: 프라이빗 패키지 게시
  TEST 4: 프라이빗 패키지 설치
  TEST 5: 권한 거부 (403)
  TEST 6: 토큰 만료 처리
  TEST 7: 다중 조직 지원
  TEST 8: 패키지 접근 제어
```

### 소요 시간

- 설계: 1일
- 구현: 2~3일
- 테스트: 1일
- **총 4~5일**

### 난이도

⭐⭐⭐ (중상)

---

## 🚀 옵션 2: handwash-pos Phase 5 (배포: Nginx/PM2/SSL)

### 개요

손세차 POS 시스템을 프로덕션에 배포.
현재 로컬 개발 → 실서버 배포

### 목표

- Nginx 리버스 프록시
- PM2로 Node.js 자동 관리
- SSL/TLS 인증서 (Let's Encrypt)
- 무중단 배포 (zero-downtime)
- 백업 & 복구

### 구현 계획 (5 Stage)

#### Stage 1: Nginx 설정
```bash
# /etc/nginx/sites-available/handwash-pos
upstream app {
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;  # 무중단: 두 개 프로세스
}

server {
  listen 80;
  server_name pos.handwash.kr;
  
  location / {
    proxy_pass http://app;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

#### Stage 2: PM2 설정
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'handwash-pos',
    script: 'dist/server.js',
    instances: 2,  // 무중단 배포용
    watch: false,
    max_memory_restart: '512M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
  }]
};

// 명령어
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # 부팅 자동 시작
```

#### Stage 3: SSL/TLS
```bash
# Let's Encrypt with Certbot
certbot certonly --standalone -d pos.handwash.kr

# Nginx에서 HTTPS 활성화
listen 443 ssl;
ssl_certificate /etc/letsencrypt/live/pos.handwash.kr/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/pos.handwash.kr/privkey.pem;

# HTTP → HTTPS 리다이렉트
server {
  listen 80;
  return 301 https://$host$request_uri;
}
```

#### Stage 4: 무중단 배포
```bash
# 배포 스크립트 (deploy.sh)
#!/bin/bash
git pull origin main
npm install
npm run build
pm2 reload handwash-pos --update-env  # 무중단 재시작
```

#### Stage 5: 백업 & 복구
```bash
# 일일 백업 (cron)
0 2 * * * /opt/handwash-pos/backup.sh

# 백업 내용
  ├─ SQLite DB (/data/handwash.db)
  ├─ 설정 파일 (/config)
  └─ 로그 (/logs)

# 복구 스크립트
pm2 stop handwash-pos
sqlite3 /data/handwash.db < /backups/handwash-$(date +%Y%m%d).sql
pm2 start handwash-pos
```

### 배포 체크리스트

```
✅ Nginx 설치 + 설정
✅ PM2 설치 + 설정
✅ SSL 인증서 발급
✅ 자동 배포 스크립트
✅ 백업 자동화
✅ 모니터링 (PM2+Grafana)
✅ 로깅 (ELK 또는 Loki)
✅ DB 마이그레이션
```

### 성능 예상

| 지표 | Phase 4 | Phase 5 |
|------|---------|---------|
| 응답 시간 | ~100ms | ~50ms (캐싱) |
| 동시 사용자 | 50 | 500+ |
| 가용성 | 99% | 99.9% (무중단) |
| 배포 시간 | N/A | 0초 (무중단) |

### 테스트 계획

```bash
# 배포 후 검증
TEST 1: HTTPS 접속 가능
TEST 2: 무중단 배포 (동작 유지)
TEST 3: SSL 인증서 유효성
TEST 4: 자동 재시작
TEST 5: 백업 파일 생성
TEST 6: 부하 테스트 (500명 동시)
```

### 소요 시간

- 환경 설정: 1일
- 배포 자동화: 1일
- 모니터링: 1일
- **총 3일**

### 난이도

⭐⭐ (중하)

---

## 🔧 옵션 3: 의존성 제거 Phase 5 (npm/Make 제거)

### 개요

FreeLang v9가 완전히 독립적으로 동작.
현재: Node.js + npm + Make 필요  
목표: v9 자체 빌드 시스템 + 패키지 관리자 (`v9-build`, `v9-run`)

### 목표

- v9 빌드 시스템 (Make 대체)
- v9 자체 실행환경 (Node.js 스크립팅 대체)
- v9 내 의존성 관리

### 구현 계획 (3 Stage)

#### Stage 1: v9-build 시스템

```v9
; v9-build.fl — TypeScript → JavaScript 컴파일러
[DEFUN compile-typescript [src-path dist-path]
  :body
  (let [[files (find-files src-path "*.ts")]]
    (for-each files
      (fn [file]
        (let [[code (read-file file)]
              [compiled (ts-to-js code)]]
          (write-file (replace-extension file "js" dist-path) compiled)
        )
      )
    )
  )
]

; 사용법
(compile-typescript "./src" "./dist")
```

#### Stage 2: v9-run 환경

```v9
; v9-run.fl — JavaScript 실행 및 모듈 로딩
[DEFUN run-js [file-path]
  :body
  (let [[code (read-file file-path)]
        [ctx (create-execution-context)]]
    (eval code ctx)
  )
]

; package.json 호환 방식
[DEFUN load-package [pkg-name]
  :body
  (let [[pkg-file (concat "./node_modules/" pkg-name "/package.json")]
        [pkg (parse-json (read-file pkg-file))]
        [entry (get pkg "main")]]
    (run-js (concat "./node_modules/" pkg-name "/" entry))
  )
]
```

#### Stage 3: v9-pm (패키지 매니저)

```
현재: vpm (registry 기반, npm 호환)
목표: v9-pm (v9 자체 구현)

v9-pm features:
  ├─ vpm과 호환 (node_modules, package.json)
  ├─ v9 순수 구현
  ├─ 60% 크기 감소 (TypeScript → v9)
  └─ 의존성 제로
```

### 파일 구조 변화

```
현재:
freelang-v9/
├── src/ (TypeScript)
├── dist/ (JavaScript, npm 빌드)
├── node_modules/ (npm 의존성)
└── package.json

목표:
freelang-v9/
├── src/ (v9 코드)
├── build/ (v9 자체 컴파일)
├── vpm_packages/ (로컬 의존성)
└── v9.fl (메인 프로그램)
```

### 마이그레이션 경로

```
Phase 4: Express 제거 ✅
Phase 5: npm/Make 제거 (현재)
  ├─ v9-build 구현 (Make 대체)
  ├─ v9-run 구현 (Node.js 스크립팅 대체)
  └─ v9-pm 구현 (npm 대체)

Phase 6: Docker 제거 (다음)
  └─ v9 + OCI 기반 배포

결과: FreeLang v9 자가부트스트랩 ✨
  → 필요한 것: Node.js 런타임만 (v9 컴파일을 위해)
  → v9 프로그램은 순수 v9 코드로 구성
```

### 성능 예상

| 항목 | 현재 | Phase 5 |
|------|------|---------|
| 빌드 시간 | 5초 (tsc) | 3초 (v9-build) |
| 런타임 | Node.js + npm | v9만 |
| 저장소 크기 | 500MB | 100MB |
| 부팅 시간 | 2초 | 1초 |
| 의존성 | npm 50+개 | 제로 |

### 테스트 계획

```bash
# v9 자체 구현 검증
TEST 1: v9-build로 컴파일
TEST 2: v9-run으로 실행
TEST 3: v9-pm으로 패키지 관리
TEST 4: TypeScript 호환성 (소스 비교)
TEST 5: npm 호환성 (node_modules 동일)
TEST 6: CI/CD 자동화 (v9만 사용)
```

### 소요 시간

- 설계: 2일
- v9-build 구현: 3일
- v9-run 구현: 2일
- v9-pm 구현: 3일 (기존 vpm 포팅)
- 테스트: 2일
- **총 10~12일**

### 난이도

⭐⭐⭐⭐ (상)

---

## 📋 옵션 비교

| 항목 | Phase 13 (OAuth2) | Phase 5 배포 | Phase 5 의존성 |
|------|------------------|-----------|-------------|
| 기간 | 4~5일 | 3일 | 10~12일 |
| 난이도 | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| 영향도 | 높음 (기능) | 높음 (배포) | 매우 높음 (독립성) |
| 의존성 | vpm 구조 이해 | 서버 운영 이해 | v9 언어 깊은 이해 |
| ROI | 프라이빗 패키지 | 프로덕션 운영 | 완전 자가부트 |
| 다음 | Phase 14 (Cache Mgmt) | SaaS 배포 | Phase 6 (Docker 제거) |

---

## 🎯 추천 우선순위

### Short-term (1주)
```
1️⃣ Phase 5 배포 (handwash-pos)
   → 가장 빠름 (3일), 실제 사용자 지원

2️⃣ Phase 13 OAuth2
   → 다음 빠름 (4~5일), vpm 확장
```

### Long-term (1개월)
```
3️⃣ Phase 5 의존성 제거
   → 시간 걸림 (10~12일), 완전 독립성 달성
```

---

## 💬 의견 요청

**어느 옵션부터 시작할까요?**

- ✅ 모두 진행 (병렬 처리)
- 📌 1개씩 순차 진행
- 🎯 특정 옵션 선택

**결정해주세요! 👇**

---

**작성일**: 2026-04-12  
**상태**: PR 검토 대기 중
