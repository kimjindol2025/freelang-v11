# 5분 만에 dclub-auth 연동하기

> 외부 SaaS·웹앱·SPA에 "dclub-auth로 로그인" 버튼을 추가하는 가이드.
> 표준 OIDC라 어떤 언어·프레임워크에서도 작동.

## 1. 클라이언트 등록 (운영자 1회)

```bash
sqlite3 /var/lib/dclub-auth/auth.db <<EOF
INSERT INTO clients (client_id, client_secret, name, redirect_uris,
                     allowed_scopes, is_public, require_consent, created_at)
VALUES ('myapp',
        'CHANGE-THIS-TO-RANDOM',
        'My App',
        'https://myapp.example.com/oauth/callback',
        'openid profile email',
        0, 0, datetime('now'));
EOF
```

또는 추후 추가될 admin UI 사용.

## 2. SDK 가져오기

### 옵션 A — 단일 파일 (외부 의존 0)
```html
<script type="module">
  import { createClient } from "https://auth.dclub.kr/sdk/dclub-auth-client.js";
</script>
```

### 옵션 B — 자체 호스팅
[`dclub-auth-client.js`](../sdk/dclub-auth-client.js) (~300줄) 다운로드 후 정적 자산으로 배포.

## 3. 클라이언트 초기화

```js
const auth = createClient({
  issuer: "https://auth.dclub.kr",
  clientId: "myapp",
  clientSecret: "your-client-secret",   // SPA면 생략 (public client)
  redirectUri: "https://myapp.example.com/oauth/callback",
  scope: "openid profile email",
});
```

## 4. 로그인 버튼

```html
<button id="login">dclub-auth로 로그인</button>
<script type="module">
  document.getElementById("login").onclick = () => auth.signIn();
</script>
```

`signIn()`이 PKCE verifier·state·nonce를 자동 생성하고 `/authorize`로 리다이렉트.

## 5. 콜백 처리

`/oauth/callback` 페이지에서:

```js
import { createClient } from "./dclub-auth-client.js";
const auth = createClient({ /* 동일 설정 */ });

// URL 의 ?code=... 처리 → 토큰 교환
if (new URL(window.location.href).searchParams.has("code")) {
  await auth.handleCallback();
  history.replaceState({}, "", "/");
  window.location.href = "/dashboard";
}
```

내부 동작:
1. `code_verifier` 복원, `state` CSRF 검증, `nonce` replay 검증
2. `/token` 호출 → access_token + id_token + refresh_token
3. `sessionStorage`에 보관 (브라우저)

## 6. 로그인 상태 사용

```js
if (auth.isAuthenticated()) {
  const user = await auth.getUser();   // /userinfo 호출
  console.log(user.preferred_username, user.email);

  // API 호출 시
  const token = await auth.getAccessToken();   // 자동 갱신 포함
  fetch("/api/private", {
    headers: { "Authorization": `Bearer ${token}` },
  });
}
```

## 7. 로그아웃

```js
auth.signOut();
```

## 8. 백엔드에서 토큰 검증 (옵션)

자체 백엔드가 dclub-auth 토큰을 검증하려면 JWKS 로 RS256 서명 확인.

### Node.js 예시 (외부 라이브러리 0)
```js
const crypto = require("crypto");

async function verifyToken(token) {
  const [hdr, payload, sig] = token.split(".");
  const { kid } = JSON.parse(Buffer.from(hdr, "base64url"));

  const jwks = await (await fetch("https://auth.dclub.kr/jwks.json")).json();
  const jwk = jwks.keys.find(k => k.kid === kid);
  if (!jwk) throw new Error("kid not found");

  const pub = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const ok = crypto.createVerify("RSA-SHA256")
    .update(`${hdr}.${payload}`)
    .verify(pub, Buffer.from(sig, "base64url"));
  if (!ok) throw new Error("signature invalid");

  const claims = JSON.parse(Buffer.from(payload, "base64url"));
  if (claims.iss !== "https://auth.dclub.kr") throw new Error("iss mismatch");
  if (claims.aud !== "myapp") throw new Error("aud mismatch");
  if (claims.exp < Math.floor(Date.now()/1000)) throw new Error("expired");

  return claims;   // { sub, email, name, ... }
}
```

다른 언어:
- Python: `pip install python-jose`
- Go: `github.com/golang-jwt/jwt/v5`
- Rust: `jsonwebtoken` crate
- Java: `nimbus-jose-jwt`

## 9. MFA (선택)

사용자가 자체 설정 페이지에서 MFA 활성화 가능. 로그인 흐름이 자동으로 2단계로 전환됨 — 통합 코드 변경 불필요.

## 10. 흔한 함정

| 증상 | 원인 | 해결 |
|---|---|---|
| `redirect_uri mismatch` | 등록과 정확히 다름 | trailing slash·protocol 정확히 일치 |
| `state mismatch` | sessionStorage 손실 | 같은 도메인에서 콜백 처리 |
| 401 갑자기 | access_token 만료 | `getAccessToken()` 사용 (자동 갱신) |
| `nonce mismatch` | 콜백 page reload | `handleCallback()` 1회만 |

## 11. 보안 체크리스트

- [ ] `redirect_uri` 는 HTTPS (또는 localhost 만)
- [ ] `client_secret` 은 백엔드에만 보관, 브라우저 노출 금지
- [ ] SPA는 `clientSecret` 없이 PKCE 만 (public client)
- [ ] 백엔드 토큰 검증 시 `iss` `aud` `exp` `nonce` 모두 확인
- [ ] CORS allowlist 사용

## 12. 다음 단계

- 사용자 데이터 모델 설계 (sub 를 영구 식별자로)
- 권한 시스템 (scope 기반 또는 role 매핑)
- 로그아웃 전파 (멀티 서비스 SSO — Phase N)
- 소셜 로그인 (Google/Kakao 통합 — Phase P)

---

**문의**: gogs.dclub.kr/kim/freelang-v11/issues 또는 blog.dclub.kr 게스트북
**저장소**: https://gogs.dclub.kr/kim/freelang-v11 (브랜치 `feature/dclub-auth`)
