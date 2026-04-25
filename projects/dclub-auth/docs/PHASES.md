# dclub-auth Phase 상세

## Phase A — 암호 기반시설 (2~3일)

**산출물**:
- `src/stdlib-crypto-rsa.ts` (TS, ~50줄) — Node `crypto` 래핑
  - `rsa_generate_keypair() → {publicKey, privateKey}` (PEM)
  - `rsa_sign_sha256(privateKey, data) → base64url`
  - `rsa_verify_sha256(publicKey, data, sig) → bool`
  - `rsa_public_to_jwk(publicKey, kid) → JWK JSON`
- `lib/jwt-rs256.fl` — RS256 JWT sign/verify (FL)
- `lib/jwks-store.fl` — 키 생성·로딩·회전 (FL)
- `tests/test-jwt-rs256.test.fl` — RFC 7515 테스트 벡터

**검증**:
- 자가 sign → verify 100% 통과
- 외부 라이브러리(jose 등)로 서명한 JWT를 우리가 verify 가능
- JWK 출력이 jwt.io 또는 jose에서 인식

---

## Phase B — 핵심 4 엔드포인트 (1주)

**라우트**:
- `GET /.well-known/openid-configuration` — OIDC discovery
- `GET /authorize` — 임시 동의 화면 + code 발급
- `POST /token` — code → id_token + access_token + refresh_token
- `GET /userinfo` — Bearer 검증 후 프로필
- `GET /jwks.json` — 공개키 배포

**검증**:
- curl 스크립트로 PKCE 완주
- state/nonce 검증
- code 일회용 + 60초 만료 강제

---

## Phase C — UI + 사용자 관리 (1주)

- `/login` — 한글 로그인 폼 (SSR)
- `/consent` — scope별 동의 화면
- `/signup` — 회원가입
- 세션 쿠키 (HttpOnly, Secure, SameSite=Lax)

---

## Phase D — 첫 클라이언트 연동 (3일)

- blog.dclub.kr에 OIDC 클라이언트 등록
- 블로그 관리자 페이지 → "구글 스타일 dclub 로그인" 연동
- 토큰 검증 미들웨어 도입

---

## Phase E — 멀티 서비스 SSO (1주)

- FSM SaaS, v9 SQLite 도구, gogs 연동
- 통합 세션 (한 IdP 로그인 → 모든 서비스 인증)
- 로그아웃 전파 (Back-Channel Logout 또는 단순 세션 무효화)

---

## Phase F — 운영 강화 (1주)

- RSA 키 자동 회전 (kid 기반)
- refresh_token 회전 + 재사용 탐지
- 침해 시 강제 로그아웃 API
- 감사 로그 → 블로그 로그 시스템 통합
- rate limit, brute-force 방어
