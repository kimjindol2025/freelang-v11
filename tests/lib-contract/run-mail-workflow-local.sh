#!/usr/bin/env bash
set -Eeuo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
: "${TMPDIR:?Set a task-specific temporary directory}"
: "${RUN_WORK_DIR:?Set the run artifact directory under /home/kim/tmp}"
: "${FREELANG_HTTP_CGC:?Set the verified native FreeLang compiler}"
mkdir -p "$RUN_WORK_DIR"
work=$(mktemp -d "$RUN_WORK_DIR/mail-workflow.XXXXXXXX")
cd "$root"
"$FREELANG_HTTP_CGC" tests/lib-contract/mail-workflow.test.fl "$work/test.c" >"$work/compile.log" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/compile.log"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/test.c" "$work/test" >"$work/build.log" 2>&1
"$FREELANG_HTTP_CGC" examples/mail-workflow-local.fl "$work/example.c" >"$work/example.compile" 2>&1
if grep -E '\[CGC-ERR\]|\[load\]' "$work/example.compile"; then exit 1; fi
bash scripts/build-cgc-native.sh "$work/example.c" "$work/example" >"$work/example.build" 2>&1
mkdir -p "$work/state"
strace -f -qq -e trace=execve,connect -o "$work/workflow.trace" "$work/test" "$work/state"
if grep -E 'execve\("[^"]*/(node|nodejs)("|/)|execve\("[^"]*\.js"' "$work/workflow.trace"; then
  echo 'NODE_JS_EXEC_COUNT=nonzero'
  exit 1
fi
if grep -E 'connect\(.*AF_INET|connect\(.*AF_INET6' "$work/workflow.trace"; then
  echo 'WORKFLOW_NETWORK_CONNECT_COUNT=nonzero'
  exit 1
fi
echo 'NODE_JS_EXEC_COUNT=0'
echo 'WORKFLOW_NETWORK_CONNECT_COUNT=0'
