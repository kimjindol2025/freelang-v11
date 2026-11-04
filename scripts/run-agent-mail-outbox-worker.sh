#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
: "${TMPDIR:=/home/kim/tmp}"
: "${RUN_WORK_DIR:?Set a task artifact directory under /home/kim/tmp/<run-id>}"
: "${FREELANG_HTTP_CGC:?Set the verified native FreeLang compiler}"
: "${AGENT_MAIL_DB:?Set the persistent agent-mail SQLite database path}"
: "${AGENT_MAIL_POLICY_DIR:?Set the protected approval and guard state directory}"
: "${AGENT_MAIL_SMTP_PORT:?Set the local SMTP submission port}"
: "${AGENT_MAIL_SMTP_USERNAME:?Set the local SMTP username}"
: "${AGENT_MAIL_SMTP_PASSWORD:?Set the local SMTP password}"
case "$RUN_WORK_DIR" in /home/kim/tmp/*) ;; *) echo 'RUN_WORK_DIR must be under /home/kim/tmp/<run-id>' >&2; exit 2 ;; esac
export TMPDIR
umask 077
work="$RUN_WORK_DIR/agent-mail-outbox-worker"
mkdir -p -- "$work"
"$FREELANG_HTTP_CGC" "$root/projects/agent-mail/worker/send-outbox.fl" "$work/worker.c" >"$work/compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/compile.log"; then exit 1; fi
bash "$root/scripts/build-cgc-native.sh" "$work/worker.c" "$work/worker" >"$work/build.log" 2>&1
exec "$work/worker" "$AGENT_MAIL_DB" "$AGENT_MAIL_POLICY_DIR" "$AGENT_MAIL_SMTP_PORT"
