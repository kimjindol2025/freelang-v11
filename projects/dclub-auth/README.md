# dclub-auth — FreeLang OIDC IdP

> **목표**: 구글 스타일 OAuth 2.0 / OpenID Connect 인증 서버를 FreeLang v11로 구현.
> blog · FSM · v9 · gogs · freelang-saas 등 dclub 산하 모든 서비스의 **공통 IdP**.

---

## 아키텍처

```
auth.dclub.kr  (FreeLang OIDC IdP)
├── /authorize                       구글 /o/oauth2/v2/auth 카피
├── /token                           code/refresh → token 교환
├── /userinfo                        Bearer 토큰으로 프로필
├── /jwks.json                       RS256 공개키 배포
├── /.well-known/openid-configuration
└── /login, /consent, /signup        자체 UI (한글, SSR)
```

각 서비스는 OIDC 클라이언트로만 등록 — 비밀번호·MFA·세션 로직 없음.

---

## 디렉터리 구조

```
projects/dclub-auth/
├── app/                  # HTTP 라우트 (FreeLang)
│   ├── authorize.fl
│   ├── token.fl
│   ├── userinfo.fl
│   ├── jwks.fl
│   ├── discovery.fl      # /.well-known/openid-configuration
│   ├── login.fl
│   ├── consent.fl
│   └── signup.fl
├── lib/                  # 도메인 로직
│   ├── jwt-rs256.fl      # RS256 서명 (rsa-* primitive 래핑)
│   ├── pkce.fl           # SHA256 챌린지 검증
│   ├── jwks-store.fl     # 키 회전 관리
│   ├── client-registry.fl
│   ├── code-store.fl     # authorization code 단기 저장
│   ├── refresh-store.fl  # refresh token 회전
│   └── session.fl
├── db/
│   ├── schema.sql        # users, clients, codes, sessions, refresh_tokens, keys
│   └── seed.sql
├── docs/
│   ├── PHASES.md
│   ├── SECURITY.md
│   └── INTEGRATION.md    # 클라이언트 연동 가이드
└── tests/
    └── *.test.fl
```

---

## Phase 계획

| Phase | 목표 | 검증 기준 | 예상 |
|---|---|---|---|
| **A. 암호 기반시설** | RS256 서명/검증, JWK 변환 | RFC 7517 호환, 자가 sign/verify 일치 | 2~3일 |
| **B. 핵심 4 엔드포인트** | /authorize /token /userinfo /jwks | curl Authorization Code + PKCE 완주 | 1주 |
| **C. UI + 사용자 관리** | 로그인/동의/회원가입 | 브라우저 사람 로그인 가능 | 1주 |
| **D. 첫 클라이언트 연동** | blog.dclub.kr 연동 | 글쓰기 = OIDC 토큰 검증 | 3일 |
| **E. 멀티 서비스 SSO** | FSM · v9 · gogs 연동 | 한 번 로그인 → 모두 자동 | 1주 |
| **F. 운영 강화** | 키 회전, refresh 회전, 감사 | 침해 시뮬레이션 통과 | 1주 |

총 5~6주. Phase A 완료 시점부터 블로그 포스팅 가능.

---

## 자주권 원칙

- **언어**: 100% FreeLang v11 — TS 포트 금지
- **외부 npm**: 0개 (Node `crypto` 표준 모듈만 stdlib 통해 노출)
- **DB**: SQLite (v9 SQLite 검증된 도구 활용)
- **UI**: 한글 + 다크 + 미니멀 (블로그 디자인 통일)
- **운영**: blog.dclub.kr 동일 harness로 배포

---

## 표준 준수

| 항목 | 표준 |
|---|---|
| OAuth 2.0 | RFC 6749 |
| PKCE | RFC 7636 |
| JWT | RFC 7519 |
| JWK / JWKS | RFC 7517 |
| OpenID Connect | OIDC Core 1.0 |
| Discovery | OIDC Discovery 1.0 |

---

## 상태

- 2026-04-25: 프로젝트 골격 생성, Phase A 진입 대기
