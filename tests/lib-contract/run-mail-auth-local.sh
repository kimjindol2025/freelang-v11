#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set the task temporary directory}"
: "${RUN_WORK_DIR:?Set the run artifact directory under /home/kim/tmp}"
: "${FREELANG_HTTP_CGC:?Set the verified native FreeLang compiler}"
mkdir -p "$RUN_WORK_DIR"
work=$(mktemp -d "$RUN_WORK_DIR/mail-auth.XXXXXXXX")
cd "$root"
"$FREELANG_HTTP_CGC" tests/lib-contract/mail-auth.test.fl "$work/test.c" >"$work/compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/compile.log"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/test.c" "$work/test" >"$work/build.log" 2>&1
strace -f -qq -e trace=execve,connect -o "$work/auth.trace" "$work/test" "$work/mail.db"
if grep -E 'execve\("[^"]*/(node|nodejs)("|/)|execve\("[^"]*\.js"' "$work/auth.trace"; then
  echo 'NODE_JS_EXEC_COUNT=nonzero'; exit 1
fi
if grep -E 'connect\(.*AF_INET|connect\(.*AF_INET6' "$work/auth.trace"; then
  echo 'AUTH_NETWORK_CONNECT_COUNT=nonzero'; exit 1
fi
echo 'NODE_JS_EXEC_COUNT=0'
echo 'AUTH_NETWORK_CONNECT_COUNT=0'
