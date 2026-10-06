# Bulk request protection

Branch `feat/bulk-request-protect`.

## Landed

- `src/__tests__/body-limit-load.test.ts`
  - Content-Length over cap → 413 + `request_id`
  - header case does not bypass cap
  - concurrent 20 requests / limit 5 → 200×5 + 429×15 + `Retry-After`

## Server contract (`src/stdlib-http-server.ts`)

- `server_body_limit(bytes)` — canonical API
- `server_max_body(bytes)` — compatibility alias
- default `FL_MAX_BODY` or 1MiB
- `Content-Length` over cap → 413 before buffering
- streaming overflow → stop receiving + 413 `PAYLOAD_TOO_LARGE`
- rate limit **before** `readBody`
- `X-RateLimit-Limit` / `Remaining` / `Reset` on 200 and 429
- errors use `{ok:false, data:null, error:{code,...}, request_id}`
