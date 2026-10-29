#!/usr/bin/env bash
set -euo pipefail
work=$1 app=$2 creator=$3 port=$4
mkdir -p "$work"
umask 077
openssl rand -hex 32 | tr -d '\n' >"$work/password"
export ERP_DB_PATH="$work/observe.sqlite" ERP_NEW_PASSWORD="$(cat "$work/password")"
ERP_NEW_USERNAME=observe-a "$creator" >/dev/null
ERP_NEW_USERNAME=observe-b "$creator" >/dev/null
ERP_DB_PATH="$work/observe.sqlite" FL_HTTP_PORT="$port" "$app" >"$work/server.out" 2>"$work/server.err" & server=$!
cleanup() { kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; }
trap cleanup EXIT
base="http://127.0.0.1:$port"
for i in $(seq 1 100); do if curl -sS --output /dev/null "$base/login"; then break; fi; sleep 0.05; done
login() {
  who=$1 jar=$2 suffix=$3
  curl -sS --cookie-jar "$jar" --output "$work/login-$suffix.html" "$base/login"
  csrf=$(sed -n 's/.*name="_csrf" value="\([^"]*\)".*/\1/p' "$work/login-$suffix.html"); printf '%s' "$csrf" >"$work/login-csrf-$suffix"
  curl -sS --cookie "$jar" --cookie-jar "$jar" --dump-header "$work/login-$suffix.hdr" --output /dev/null \
    --data-urlencode "_csrf@$work/login-csrf-$suffix" --data-urlencode "username=$who" --data-urlencode "password@$work/password" "$base/login"
  token=$(awk '$6=="erp_session"{print $7}' "$jar"); printf '%s' "$token" >"$work/session-$suffix"
}
login observe-a "$work/a.jar" a
login observe-b "$work/b.jar" b
printf 'LOGIN_SUCCESS_HEADERS_BEGIN\n'
grep -Ei '^HTTP/|^Set-Cookie:' "$work/login-a.hdr" | sed -E 's/(Set-Cookie: erp_session=)([^;]{6})[^;]*/\1\2<가림>/I'
printf 'LOGIN_SUCCESS_HEADERS_END\n'
printf 'CSRF_BEFORE='; sqlite3 "$work/observe.sqlite" 'SELECT count(*) FROM vendors;'
curl -sS --cookie "$work/a.jar" --dump-header "$work/missing.hdr" --output "$work/missing.body" \
  --data-urlencode 'name=csrf-missing' --data-urlencode 'phone=000' --data-urlencode 'memo=example' "$base/vendors"
printf 'CSRF_MISSING_STATUS='; head -1 "$work/missing.hdr" | tr -d '\r'
printf 'CSRF_MISSING_BODY_BEGIN\n'; head -5 "$work/missing.body"; printf '\nCSRF_MISSING_BODY_END\n'
printf 'CSRF_AFTER_MISSING='; sqlite3 "$work/observe.sqlite" 'SELECT count(*) FROM vendors;'
curl -sS --cookie "$work/a.jar" --dump-header "$work/cross.hdr" --output "$work/cross.body" \
  --data-urlencode "_csrf@$work/session-b" --data-urlencode 'name=csrf-cross-session' --data-urlencode 'phone=000' --data-urlencode 'memo=example' "$base/vendors"
printf 'CSRF_OTHER_SESSION_STATUS='; head -1 "$work/cross.hdr" | tr -d '\r'
printf 'CSRF_AFTER_OTHER_SESSION='; sqlite3 "$work/observe.sqlite" 'SELECT count(*) FROM vendors;'
curl -sS --cookie "$work/a.jar" --dump-header "$work/logout.hdr" --output /dev/null \
  --data-urlencode "_csrf@$work/session-a" "$base/logout"
printf 'LOGOUT_SET_COOKIE_BEGIN\n'; grep -i '^Set-Cookie:' "$work/logout.hdr" | tr -d '\r'; printf 'LOGOUT_SET_COOKIE_END\n'
printf 'CSRF_FINAL='; sqlite3 "$work/observe.sqlite" 'SELECT count(*) FROM vendors;'
