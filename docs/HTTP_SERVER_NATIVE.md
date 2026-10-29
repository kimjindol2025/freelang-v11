# Native HTTP server

The native server-static root url-prefix function registers a GET route for
regular files under root. For example, (server-static "public" "/static/").
The prefix should end with /. Files are opened relative to a pinned root
directory descriptor. Each path component uses openat with O_NOFOLLOW;
encoded traversal, NUL, backslash, symlink components, and directories are
rejected. Responses are limited to 8 MiB. This route does not list directories
or serve an implicit index file.

The header and body read deadlines are configured independently:

| Environment variable | Default | Range |
| --- | ---: | ---: |
| FL_HTTP_HEADER_TIMEOUT_MS | 500 ms | 1–60000 ms |
| FL_HTTP_BODY_TIMEOUT_MS | 500 ms | 1–60000 ms |

Each deadline starts when that part is read. Invalid values prevent the server
from starting.

Both deadlines use a monotonic clock and `poll` with the remaining time, so the
timeout does not depend on the next application request. The 9-35 slow-client
cases also report total client time including their deliberate send delays;
`TIMEPREC_SUMMARY` measures the server's 408 response deadline directly.
