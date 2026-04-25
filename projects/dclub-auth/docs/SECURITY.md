# dclub-auth 보안 결정 기록

## 알고리즘 선택

| 용도 | 선택 | 이유 |
|---|---|---|
| **id_token 서명** | RS256 (RSA-SHA256) | 공개키 배포 가능 → 클라이언트가 IdP에 매번 묻지 않고 검증 가능 |
| **access_token 서명** | RS256 동일 | id_token과 같은 키 사용 (단순화) |
| **PKCE 챌린지** | S256 (SHA256) | RFC 7636 권장 |
| **비밀번호 해싱** | SHA256+salt → argon2id (Phase F) | Phase A~E는 기존 `auth-hash-password` 사용, Phase F에서 강화 |
| **세션 쿠키** | HMAC-SHA256 서명 | 토큰과 별개, 서버 세션 ID만 담음 |
| **랜덤** | `crypto.randomBytes` | code/state/nonce 모두 ≥32바이트 |

## 토큰 수명

| 토큰 | 수명 | 갱신 |
|---|---|---|
| `authorization_code` | 60초 | 일회용, 사용 즉시 폐기 |
| `id_token` | 1시간 | 갱신 불가, 재로그인 또는 refresh |
| `access_token` | 1시간 | refresh_token으로 갱신 |
| `refresh_token` | 30일 | 회전 (rotate) — 재사용 탐지 시 family 무효화 |
| 세션 쿠키 | 14일 | sliding |

## 검증 필수 항목 (id_token 발급 시)

- `iss` = `https://auth.dclub.kr`
- `aud` = 요청한 client_id
- `sub` = 사용자 영구 고유 ID (UUID v4)
- `exp` > 현재 + 0
- `iat` 현재시각 ±60초
- `nonce` = 클라이언트가 보낸 값 (replay 방어)
- 서명 RS256 검증

## CSRF 방어

- `/authorize` 응답에 `state` 필수 — 클라이언트 검증
- 로그인 폼 자체 CSRF 토큰 (이미 `csrf.fl` stdlib 존재)

## 위협 모델

| 위협 | 대응 |
|---|---|
| code 재사용 | 일회용 + 60초 + DB unique |
| code 가로채기 | PKCE 필수 (모든 클라이언트) |
| token replay | nonce + iat 윈도우 |
| brute force 로그인 | rate limit + lockout (Phase F) |
| RSA 키 유출 | kid 회전 + 즉시 무효화 |
| refresh 도난 | rotate + family 무효화 |
