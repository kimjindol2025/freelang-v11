# Agent Mail local API

This is the first FreeLang application slice for the agent-mail project. It listens on `127.0.0.1` only. Use it locally or behind a separately configured TLS reverse proxy; it is not a public mail server.

## Build and run

Choose a task-specific artifact directory under `/home/kim/tmp`, then run:

```sh
TMPDIR=/home/kim/tmp \
RUN_WORK_DIR=/home/kim/tmp/RUN-<id> \
FREELANG_HTTP_CGC=/path/to/verified/stage2-bin \
AGENT_MAIL_SIGNING_SECRET='<private value of at least 32 bytes>' \
AGENT_MAIL_BOOTSTRAP_EMAIL='admin@example.invalid' \
AGENT_MAIL_BOOTSTRAP_PASSWORD='<private password of at least 12 characters>' \
bash scripts/run-agent-mail-local.sh
```

The launcher compiles the FreeLang server and native runtime into the task directory, creates the SQLite database there by default, and starts the loopback HTTP listener. Set a real domain and production credentials only in a separately reviewed deployment configuration. Do not commit secrets.

## Implemented routes

All routes are under `/v1`; authenticated routes require `Authorization: Bearer <token>`.

| Method and path | Current behavior |
|---|---|
| `GET /health` | Loopback service health |
| `POST /v1/auth/login` | Password login and revocable bearer session |
| `GET /v1/auth/me` | Current user and active roles |
| `POST /v1/auth/logout` | Revoke current session |
| `POST /v1/admin/users` | Admin creates an agent or reviewer |
| `POST /v1/admin/mailboxes` | Admin creates a domain-bound logical mailbox owned by an active user |
| `GET /v1/mailboxes` | List the current user's logical mailboxes |
| `GET /v1/mailboxes/:id/messages` | List messages for an owned mailbox |
| `GET /v1/mailboxes/:id/messages/:message` | Read one message, scoped to an owned active mailbox |
| `GET /v1/mailboxes/:id/search?q=...` | Search sender, recipient, subject, and body within an owned active mailbox (up to 50 results) |
| `POST /v1/mailboxes/:id/drafts` | Validate triage output, hold risky mail, or create a pending human-review draft |
| `GET /v1/drafts` | List the current user's drafts |
| `POST /v1/drafts/:id/approve` | A different admin/reviewer approves the immutable payload; approval expires after 24 hours |
| `POST /v1/drafts/:id/send` | Consume the approval once and atomically add a durable outbox job; returns `queued` without doing SMTP I/O |
| `GET /v1/send-jobs/:id` | Read the owner/reviewer-visible submission state |

`worker/triage-local.fl` provides a separate, run-once ingestion pipeline for the local fixture: read an owned mailbox through IMAP, call the configured local HTTPS AI endpoint, persist the source message, hold risky results, and save safe drafts as pending human review. Repeated delivery of the same source skips an existing draft; if source persistence succeeded but draft persistence previously failed, a later run can restore the missing draft from the saved triage result. Configure its mailbox ID, owner ID, IMAP credentials, HTTPS URL, output directory, and database through environment variables shown in the source. It rejects non-loopback IMAP/AI hosts through the existing client modules. It is not a supervised always-on worker and does not send replies.

Approvals are recorded in SQLite with the approved payload hash. The send request consumes the approval and inserts the send job plus outbox row in one transaction. The FreeLang `worker/send-outbox.fl` claims queued work transactionally, rechecks the file-backed send guard, then submits it. Run `scripts/run-agent-mail-outbox-worker.sh` to compile and process queued work once; a service manager can schedule repeated runs after deployment review. Claimed jobs left in `submitting` after a restart become `unknown`; they are never submitted again automatically. Jobs not yet claimed remain queued. A successful local SMTP response means the SMTP peer accepted responsibility, not that the message reached a recipient's inbox.

The local integration runner checks authentication, logout revocation, user and mailbox provisioning, ownership isolation, domain validation, safe draft creation, risky-message hold, independent approval, concurrent single-use queueing and worker claims, and local TLS SMTP acceptance. It also traces the service and workers to ensure they start no Node or JavaScript process.

## Not yet an operational mail service

Logical mailbox records do not provision an MTA/IMAP account. The outbox is durable, but its worker is currently a run-once loopback SMTP prototype; automated service supervision, external inbound synchronization, search/thread/event APIs and MCP, delivery/bounce reconciliation, and a durable AI worker remain. The product also needs a reviewed MTA configuration, domain/IP/PTR/DNS data, TLS certificates, backup/restore procedures, monitoring, and a separate deployment review before public service.
