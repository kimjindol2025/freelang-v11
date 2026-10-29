# HTTP v0.1

Load `lib/http/http.fl`. Public functions:

- `(http-get url)`
- `(http-post url body)` — string body
- `(http-request method url headers body opts)` — string method, string URL,
  string-to-string header map, string body, options map
- `(http-json method url value opts)` — uses the FreeLang JSON library at
  `self/stdlib/json.fl`; sends JSON (GET sends no body), parses response JSON.

Responses are `{ok, status, headers, body}`. `ok` means HTTP 2xx; 404 and 500
retain their status, headers and body with `ok=false`. Header keys are lowercase.
Transport/validation failures are `{ok:false, error:{code,message}}`.
JSON failures preserve the existing `json-parse` / `json-stringify` error value.

Options: `timeout-ms` defaults to **5000**, range 1–60000; `max-request-bytes`
and `max-response-bytes` default to **1048576**, range 1–16777216. All are
integers. Limits count the entire wire message including headers, in UTF-8 bytes.
The single monotonic deadline covers DNS, connect, write and read. DNS resolves
IPv4 hosts in a bounded child process which is cancelled and reaped on timeout.

**HTTPS 미지원.** No TLS library is linked. HTTP/1.0 requests use connection
close; Content-Length is checked for responses with bodies. HEAD exposes an
empty body. v0.1 supports IPv4 hosts and UTF-8 text; IPv6, URL credentials,
fragments, binary NUL, transfer encodings (including chunked), redirects and
compression are unsupported. Unsupported framing returns an error. The client
manages Host, Connection and Content-Length; callers cannot override those or
Transfer-Encoding. Header/method injection is rejected.

The only new C primitive, `_fl_http_exchange`, is needed because the native
runtime exposes no FreeLang socket byte I/O operations. It exchanges bounded raw bytes;
URL parsing, request formatting, response parsing and JSON stay in FreeLang.
The existing server also suppresses SIGPIPE so a timed-out client cannot kill it.

Server handlers use `server-redirect` for a 303 response. Its location must be
a same-origin absolute path beginning with one `/`; control characters are rejected.

Compile `tests/lib-contract/run-http.fl` with the current native compiler and
runtime, then run the executable with `--compiler <native-compiler>` (and
`--root <repository>` when running outside the repository).
It compiles both FreeLang files, runs 26 assertions against the existing native
FreeLang server on 127.0.0.1, and checks server survival. It never sends test
requests to the external Internet.

TASK 9-11 adds loopback-only `tcp-bind`, `tcp-listen`, `tcp-accept`,
`tcp-local-port`, and `tcp-close`. The supervisor holds a bind-only socket
until the client exits, preserving the original connection refusal test.
The Python supervisor was removed after byte-for-byte stdout/stderr comparison
and equal exit codes. See `docs/STDLIB_CONTRACT.md` for socket errors and limits.
