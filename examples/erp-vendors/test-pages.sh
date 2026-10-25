#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app="$(realpath "$1")"; creator="$(realpath "$2")"; work="$(mktemp -d)"; port=0
server=0
trap 'if (( server > 0 )); then kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; fi; rm -rf "$work"' EXIT
openssl rand -hex 24 | tr -d '\n' >"$work/password"; export ERP_DB_PATH="$work/pages.sqlite" ERP_NEW_USERNAME=page-test ERP_NEW_PASSWORD="$(cat "$work/password")"
"$creator" >/dev/null
FL_HTTP_TEST_FULL_ITEMS=1 ERP_DB_PATH="$ERP_DB_PATH" FL_HTTP_PORT="$port" "$app" >"$work/server.out" 2>"$work/server.err" & server=$!
for _ in $(seq 1 100); do
  port="$(sed -n 's/^HTTP_LISTENING=127.0.0.1://p' "$work/server.out" | head -n 1)"
  test -n "$port" && break
  sleep .05
done
test -n "$port"
base="http://127.0.0.1:$port"; jar="$work/cookies"
for _ in $(seq 1 100); do curl -fs -c "$jar" "$base/login" -o "$work/login" && break; sleep .05; done
csrf="$(sed -n 's/.*name="_csrf" value="\([^"]*\)".*/\1/p' "$work/login")"
curl -fsS -b "$jar" -c "$jar" -o /dev/null -w '%{http_code}' --data-urlencode "_csrf=$csrf" --data-urlencode username=page-test --data-urlencode "password@$work/password" "$base/login" | grep -qx 303
sqlite3 "$ERP_DB_PATH" "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<101) INSERT INTO vendors(name,phone,memo,created_at) SELECT CASE WHEN x<=51 THEN 'Needle-'||x ELSE 'Supplier-'||x END,'000','example','now' FROM n; INSERT INTO items(name,unit,vendor_id,created_at) SELECT 'Item-'||id,'ea',(SELECT min(id) FROM vendors),'now' FROM vendors;"
check=0; total=11
fetch() { curl -fsS -b "$jar" "$base$1" -o "$work/body"; }
rows() { grep -o '<td>' "$work/body" | wc -l | awk '{print $1 / 5}'; }
fetch '/items?page=1'; test "$(rows)" = 50 && check=$((check+1))
fetch '/items?page=3'; test "$(rows)" = 1 && check=$((check+1))
fetch '/items?page=99'; test "$(rows)" = 0 && check=$((check+1))
fetch '/items?page=abc'; test "$(rows)" = 50 && check=$((check+1))
fetch '/items?page=-3'; test "$(rows)" = 50 && check=$((check+1))
fetch '/vendors?q=Needle&page=1'; test "$(rows)" = 50 && grep -q "전체 $(sqlite3 "$ERP_DB_PATH" "SELECT count(*) FROM vendors WHERE name LIKE '%Needle%';")건" "$work/body" && check=$((check+1))
fetch '/vendors?q=Needle&page=2'; test "$(rows)" = 1 && grep -q '전체 51건' "$work/body" && check=$((check+1))
fetch '/items?page=1'; grep -q "전체 $(sqlite3 "$ERP_DB_PATH" 'SELECT count(*) FROM items;')건" "$work/body" && check=$((check+1))
fetch '/__test/items-all'; test "$(rows)" = 101 && check=$((check+1))
fetch '/items?page=1'; grep -q 'href="/items?page=1">이전' "$work/body" && grep -q 'href="/items?page=2">다음' "$work/body" && check=$((check+1))
fetch '/vendors?q=Needle&page=2'; grep -q 'href="/vendors?page=1&amp;q=Needle">이전' "$work/body" && grep -q 'href="/vendors?page=2&amp;q=Needle">다음' "$work/body" && check=$((check+1))
printf 'PAGE_SUMMARY=%s/%s\n' "$check" "$total"
test "$check" -eq "$total"
