-- dclub-auth SQLite schema (Phase B 진입 시 사용)

-- 사용자
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,           -- UUID v4 (sub)
  username        TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  password_hash   TEXT NOT NULL,
  display_name    TEXT,
  picture         TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  disabled        INTEGER NOT NULL DEFAULT 0
);

-- 등록된 OIDC 클라이언트 (블로그, FSM, v9, gogs 등)
CREATE TABLE IF NOT EXISTS clients (
  client_id        TEXT PRIMARY KEY,
  client_secret    TEXT,                       -- public client(SPA)이면 NULL
  name             TEXT NOT NULL,
  redirect_uris    TEXT NOT NULL,              -- JSON array
  allowed_scopes   TEXT NOT NULL,              -- JSON array
  is_public        INTEGER NOT NULL DEFAULT 0, -- PKCE 강제용
  require_consent  INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL
);

-- authorization code (60초 만료, 일회용)
CREATE TABLE IF NOT EXISTS auth_codes (
  code             TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  redirect_uri     TEXT NOT NULL,
  scope            TEXT NOT NULL,
  nonce            TEXT,
  code_challenge   TEXT NOT NULL,              -- PKCE
  challenge_method TEXT NOT NULL,              -- S256
  expires_at       INTEGER NOT NULL,           -- unix ms
  used             INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

-- refresh token (회전 + family 추적)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash       TEXT PRIMARY KEY,           -- SHA256(token)
  family_id        TEXT NOT NULL,              -- 회전 체인 식별
  client_id        TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  scope            TEXT NOT NULL,
  expires_at       INTEGER NOT NULL,
  rotated_to       TEXT,                       -- 다음 토큰 hash (NULL=현역)
  revoked          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

-- 로그인 세션 (쿠키 기반)
CREATE TABLE IF NOT EXISTS sessions (
  session_id       TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  expires_at       INTEGER NOT NULL,
  ip               TEXT,
  user_agent       TEXT,
  created_at       TEXT NOT NULL,
  last_seen        TEXT NOT NULL
);

-- RSA 키 (kid 기반 회전)
CREATE TABLE IF NOT EXISTS signing_keys (
  kid              TEXT PRIMARY KEY,
  alg              TEXT NOT NULL,              -- "RS256"
  public_jwk       TEXT NOT NULL,              -- JSON
  private_pem      TEXT NOT NULL,              -- 서명용 (보호 필요)
  status           TEXT NOT NULL,              -- "active" | "rotated" | "revoked"
  created_at       TEXT NOT NULL,
  rotated_at       TEXT
);

-- 감사 로그
CREATE TABLE IF NOT EXISTS audit_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               TEXT NOT NULL,
  event            TEXT NOT NULL,              -- login.ok, login.fail, token.issue, ...
  user_id          TEXT,
  client_id        TEXT,
  ip               TEXT,
  detail           TEXT                        -- JSON
);

CREATE INDEX IF NOT EXISTS idx_codes_expires ON auth_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_user  ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts      ON audit_log(ts);
