#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
: "${TMPDIR:=/home/kim/tmp}"
: "${RUN_WORK_DIR:?Set a task artifact directory under /home/kim/tmp/<run-id>}"
: "${FREELANG_HTTP_CGC:?Set the verified native FreeLang compiler}"
: "${AGENT_MAIL_SIGNING_SECRET:?Set a private signing secret of at least 32 bytes}"
: "${AGENT_MAIL_BOOTSTRAP_EMAIL:?Set the initial administrator email}"
: "${AGENT_MAIL_BOOTSTRAP_PASSWORD:?Set the initial administrator password}"
case "$RUN_WORK_DIR" in /home/kim/tmp/*) ;; *) echo 'RUN_WORK_DIR must be under /home/kim/tmp/<run-id>' >&2; exit 2 ;; esac
export TMPDIR
work="$RUN_WORK_DIR/agent-mail"
mkdir -p -- "$work"
export AGENT_MAIL_DB="${AGENT_MAIL_DB:-$work/mail.db}"
export AGENT_MAIL_PORT="${AGENT_MAIL_PORT:-40125}"
export AGENT_MAIL_DOMAIN="${AGENT_MAIL_DOMAIN:-example.invalid}"
"$FREELANG_HTTP_CGC" "$root/projects/agent-mail/app/server.fl" "$work/server.c" >"$work/compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/compile.log"; then exit 1; fi
bash "$root/scripts/build-cgc-native.sh" "$work/server.c" "$work/server" >"$work/build.log" 2>&1
exec "$work/server"
