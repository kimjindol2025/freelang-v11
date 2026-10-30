# Native HTTP worker pool

`FL_HTTP_WORKERS` selects the server process model. Its default is `0`, which
keeps the existing accept-and-fork-per-request behavior. A value from `1` to
`256` starts that many persistent workers; each inherits and accepts on the
same loopback listener. The parent supervises exits, restarts workers, and
returns `503 Retry-After: 1` when the shared active-connection limit is full.

`FL_HTTP_WORKER_MAX_REQ` sets the per-worker request retirement limit. It
defaults to `10000`; after that many accepted requests the worker exits with a
retirement status and the parent replaces it. The existing `FL_HTTP_MAX_CONN`
limit remains `256` by default and applies to both process models.
