# dclub-auth 로드맵

> **목표**: FreeLang v11로 작동하는 OIDC IdP를 구글급(95%)까지 끌어올리고
> dclub 산하 6개+ 서비스(blog, FSM, v9, gogs, freelang-saas)의 SSO 허브로 운영.
>
> **자주권 원칙**: 외부 npm 0개. Node 표준 모듈만 stdlib을 통해 노출.

---

## 진척도 (2026-04-25 기준)

```
완료:        ████████████░░░░░░░░░░  ~80%
잔여 95%:    ░░░░░░░░░░░░░██████░░░░  WebAuthn + 이상탐지 + SDK + 클라이언트 연동
```

### 누계 통계
| 항목 | 수치 |
|---|---|
| **커밋** | 10 (feature/dclub-auth) |
| **TS 코드 추가** | ~310줄 (RSA 4 + PKCE 1 + scrypt 1 + TOTP 1 + Mail 5 = 12 함수) |
| **FreeLang 코드** | ~2400줄 |
| **외부 npm 의존** | **0개** |
| **라이브 라우트** | 22개 |
| **e2e 케이스 통과** | 39+ (10 + 7 + 9 + 13) |
| **자동 에이전트 충돌 복구** | 7회, 손실 0 |

---

## 완료된 Phase (A → I)

### ✅ Phase A — 암호 기반시설
| Phase | 산출물 | 검증 |
|---|---|---|
| A.1 | `crypto-rsa-*` TS primitive (generate/sign/verify/JWK) | 단위 8/8 PASS, self-host SHA256 일치 |
| A.2 | `jwt-rs256.fl` FL 래퍼 (sign/verify/decode) | smoke 6/6 + Node crypto cross-verify |
| A.3 | `jwks-store.fl` 키 회전 (active/rotated/revoked) | smoke 7/7 PASS |

### ✅ Phase B — OIDC 핵심 엔드포인트
| Phase | 산출물 | 검증 |
|---|---|---|
| B.1 | `/jwks.json` + `/.well-known/openid-configuration` | curl 라이브 응답 |
| B.2 | `/authorize` `/login` `/token` `/userinfo` + PKCE + refresh 회전 | e2e 10/10 PASS, RFC 7515 cross-verify |

### ✅ Phase F-Quick — 운영 강화
- scrypt 비밀번호 해싱 (RFC 7914, SHA256+salt → 산업 표준급)
- sliding-window rate limit + 5회 실패 → 15분 lockout
- 감사 로그 (`audit_log` 테이블, 표준 이벤트 코드)
- 키 자동 회전 (부팅 cron)

### ✅ Phase G — MFA TOTP
- RFC 6238/4226 자체 구현 (base32 + HMAC-SHA1)
- Google Authenticator·Authy·1Password 등 표준 클라이언트 호환
- 로그인 흐름 1단계(비번) → 2단계(TOTP) 자동 전환
- e2e 9/9 PASS

### ✅ Phase H — Self-service 흐름
- 회원가입 + 이메일 검증 (24h 일회용 토큰)
- 비밀번호 재설정 (`/forgot` `/reset`)
- 계정 존재 노출 금지 정책
- e2e 13/13 PASS

### ✅ Phase I — 메일 발송 인프라
- 파일 기반 outbox 큐 (sendmail/postfix queue 호환)
- 직접 SMTP TLS (port 465 SMTPS, AUTH LOGIN)
- signup·forgot 흐름이 진짜 메일 발송
- e2e 7/7 PASS

---

## 잔여 — 95% 도달 로드맵

### 🔜 Phase J — WebAuthn / Passkey (~2주치, +5%)
**왜**: TOTP보다 강한 phishing-resistant MFA. 모바일 사용자 UX 우월.
- ES256 (ECDSA P-256) primitive 추가 (TS, ~30줄)
- 최소 CBOR 디코더 (COSE_Key 추출용, ~80줄)
- `webauthn_credentials` 테이블 + 등록·인증 흐름
- `/webauthn/register/begin` `/webauthn/register/complete`
- `/webauthn/auth/begin` `/webauthn/auth/complete`
- 자체 검증 (Self-Attestation only — 첫 단계)
- 단계 J.2: Attestation 검증 (Apple/Yubikey 인증서 검증, 별도)

### 🔜 Phase K — JS/TS 클라이언트 SDK (~3일치, +5%)
**왜**: dclub-auth를 다른 서비스(blog, FSM, v9 등)에 5분 안에 연동 가능하게.
- `@dclub-auth/client` (FreeLang 패키지로도 배포)
- `createClient({ issuer, clientId, redirectUri })`
- `signIn()` `getUser()` `signOut()` `getAccessToken()`
- 자동 token refresh + 만료 처리
- React/Vue/Vanilla JS 어댑터 (선택)
- OpenAPI 3.0 스펙 (`docs/openapi.yaml`)
- Postman 컬렉션
- "5분 만에 dclub-auth 연동" 가이드 (블로그 시리즈)

### 🔜 Phase L — 이상로그인 탐지 (~1주치, +3%)
**왜**: 침해 조기 발견. ML 없이 룰 기반으로도 80% 효과.
- IP geo (offline GeoLite2 DB 또는 자체 분류)
- 디바이스 fingerprint (User-Agent + IP)
- "처음 보는 IP/국가/디바이스" 알림 메일
- "야간 로그인" "다른 대륙에서" 등 룰 기반 score
- 의심 시 추가 인증 단계 강제
- 운영 대시보드 (FL SSR `/admin/security`)

### 🔜 Phase M — 첫 클라이언트 연동 (blog.dclub.kr) (~3일치, +2%)
**왜**: 실전 검증. dclub-auth가 진짜 블로그 인증을 대체.
- blog.dclub.kr에 OIDC client 등록 (`client_id=blog`)
- 블로그 관리자 페이지의 `X-API-Key` 인증을 OIDC로 교체
- 블로그가 OIDC 클라이언트 SDK 사용
- 운영 검증: 매일 포스팅 흐름이 dclub-auth 경유로 작동
- 추후: FSM, v9, gogs 동일 패턴 적용 (Phase N+)

### 🔜 Phase N — 멀티 서비스 SSO (~1주치, +2%)
**왜**: "한 번 로그인 → 모든 서비스 자동 인증"의 핵심 가치 실현.
- 통합 세션 (서버사이드 session ID 쿠키, 도메인 `*.dclub.kr`)
- Back-Channel Logout (RFC 8414)
- 로그아웃 전파 (한 곳에서 로그아웃 → 모든 서비스 토큰 무효)
- FSM, v9, gogs 차례로 연동
- 운영 대시보드: 활성 세션 목록 + 강제 로그아웃

### 🔜 Phase O — 컴플라이언스·법규 (~2주치, +3%)
- GDPR 준수 (사용자 데이터 export/삭제 API)
- 개인정보처리방침 한글 문서
- 데이터 보존 정책 (비활성 90일 → 익명화)
- DB 암호화 at-rest (SQLCipher 통합 또는 동등 수준)
- 감사 로그 검색·내보내기 UI

### 🔜 Phase P — 페더레이션 (~1주치, +2%)
- 소셜 로그인 (Google/Kakao/Naver IdP-of-IdP) — 사용자가 외부 IdP로도 로그인 가능
- 매핑: 외부 sub → 우리 user_id (이메일 기준)
- 자체 가입과 소셜 가입 통합 (같은 email이면 같은 계정)

---

## 잔여 격차 vs Auth0/Keycloak (95% 시점)

| 항목 | Auth0/Keycloak | dclub-auth (95% 도달 후) | 차이 |
|---|---|---|---|
| OIDC 표준 | ✅ | ✅ | 동급 |
| MFA (TOTP/Passkey) | ✅ | ✅ | 동급 |
| 비번 정책 | ✅ | ✅ scrypt + 길이·복잡도 (Phase O) | 동급 |
| 감사·이상탐지 | ✅ | ✅ Phase L | 동급 (ML 없이 룰) |
| SSO/SLO | ✅ | ✅ Phase N | 동급 |
| 페더레이션 | ✅ | ✅ Phase P | 동급 |
| 클라이언트 SDK | ✅ 다언어 | ✅ JS/TS Phase K | 일부 (Python/Go 보너스) |
| GDPR/SOC2 인증 | ✅ 인증 보유 | 자체 준수 (인증 없음) | **Auth0 우위** (인증 비용 ~$10만+) |
| 운영 규모 | ✅ 글로벌 | 단일 노드 | **Auth0 우위** (불필요한 우위) |
| 가격 | $$$ ($240/월~ MAU 1k) | **무료** (자체호스팅) | **dclub-auth 우위** |
| 자주권 | ❌ vendor lock-in | ✅ FreeLang | **dclub-auth 우위** |

**결론**: 운영 규모·인증 자체는 Auth0 우위지만 **dclub 내부 사용 + 한국 시장 SaaS 출시**에는 충분.

---

## 시간 견적 (1세션 = 약 1주치 압축 가정)

| Phase | 견적 | 누적 |
|---|---|---|
| J — WebAuthn | 2주치 (2세션) | 95% 도달 1차 후보 |
| K — SDK | 3일치 (1세션) | 95% 도달 1차 후보 |
| L — 이상탐지 | 1주치 (1세션) | 95% 도달 |
| M — blog 연동 | 3일치 (1세션) | 95% 도달 |
| N — SSO | 1주치 (1세션) | 95%+ |
| O — 컴플라이언스 | 2주치 (2세션) | 인증 외 |
| P — 페더레이션 | 1주치 (1세션) | 보너스 |

**95% 도달 최단**: J + K + L + M = **5세션** (현재 9세션 누적 → 14세션차에 95%)

---

## 다음 우선순위 (ROI 기반)

```
1. Phase M — blog 연동 (3일치, 실전 검증 +2%)
   ├── 가장 빠른 실전 가치 입증
   └── 블로그 글쓰기 경로가 dclub-auth로 작동
2. Phase K — JS/TS SDK (3일치, +5%)
   ├── M에서 만든 패턴을 라이브러리화
   └── FSM/v9/gogs 연동 비용 0에 수렴
3. Phase J — WebAuthn (2주치, +5%)
   ├── MFA 완성도
   └── Passkey 시대 대비
4. Phase N — SSO 전파 (1주치, +2%)
5. Phase L — 이상탐지 (1주치, +3%)
6. Phase O — 컴플라이언스 (2주치, +3%)
```

---

## 운영 위치

- **저장소**: gogs.dclub.kr/kim/freelang-v11 (브랜치 `feature/dclub-auth`)
- **블로그 기록**: blog.dclub.kr (Post #541 — Phase A→H 요약)
- **현재 가동 포트**: 30100 (개발 환경)
- **운영 도메인 예정**: auth.dclub.kr

---

## 의사결정 메모

| 결정 | 시점 | 근거 |
|---|---|---|
| RS256 (RSA-SHA256) | A.1 | 클라이언트가 공개키로 자체 검증 → IdP 부하 감소 |
| SQLite (PostgreSQL 아님) | A.3 | v9 SQLite 검증 도구 활용. 단일 노드 충분. 추후 PG 마이그레이션 옵션 |
| scrypt (argon2id 아님) | F | Node 표준 crypto에 scryptSync 내장. argon2 npm 의존 회피 |
| 별도 mfa_credentials 테이블 | G | users ALTER 회피 + 향후 WebAuthn 같은 테이블 확장 |
| 직접 RFC 5321 SMTP | I | nodemailer 등 npm 의존 회피. Node tls만 사용 |
| outbox JSON 큐 우선 | I | sendmail/postfix queue 표준 호환. 운영자 도구 재사용 |

---

**Last updated**: 2026-04-25 (Phase I 완료 후)
**Next session goal**: Phase M (blog 연동) 또는 Phase K (SDK) — 실전 가치 입증 우선.
