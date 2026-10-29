#!/usr/bin/env bash
set -euo pipefail
work=$1 app=$2 creator=$3 port=$4 duration=$5
mkdir -p "$work"
umask 077
openssl rand -hex 32 | tr -d '\n' >"$work/password"
export ERP_DB_PATH="$work/soak.sqlite" ERP_NEW_PASSWORD="$(cat "$work/password")"
ERP_NEW_USERNAME=soak-example "$creator" >/dev/null
ERP_DB_PATH="$ERP_DB_PATH" ERP_SESSION_SECONDS=3600 ERP_LOCK_SECONDS=10 FL_HTTP_PORT="$port" "$app" >"$work/server.out" 2>"$work/server.err" & server=$!
cleanup() { kill -TERM "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; }
trap cleanup EXIT
base="http://127.0.0.1:$port"
for i in $(seq 1 100); do if curl -sS --output /dev/null "$base/login" 2>/dev/null; then break; fi; sleep 0.05; done
sqlite3 "$ERP_DB_PATH" "INSERT INTO vendors(name,phone,memo,created_at) VALUES('Soak Supplier','000','example',strftime('%Y-%m-%dT%H:%M:%fZ','now'));"
vendor=$(sqlite3 "$ERP_DB_PATH" 'SELECT id FROM vendors LIMIT 1;')
started=$SECONDS
end=$((started + duration))
worker() {
  w=$1 jar="$work/jar-$1" reqs=0 fails=0 five=0 adds=0 cycle=0
  request() {
    expected=$1; shift
    rc=0
    code=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$@" 2>>"$work/worker-$w.err") || { rc=$?; code=000; }
    reqs=$((reqs + 1))
    if [[ $code =~ ^5 ]]; then five=$((five + 1)); fi
    if (( rc != 0 )) || [[ "$code" != "$expected" ]]; then fails=$((fails + 1)); fi
  }
  while (( SECONDS < end )); do
    cycle=$((cycle + 1))
    rc=0
    code=$(curl --silent --show-error --cookie-jar "$jar" --output "$work/login-$w.html" --write-out '%{http_code}' "$base/login" 2>>"$work/worker-$w.err") || { rc=$?; code=000; }
    reqs=$((reqs + 1))
    if [[ $code =~ ^5 ]]; then five=$((five + 1)); fi
    if (( rc != 0 )) || [[ "$code" != 200 ]]; then fails=$((fails + 1)); fi
    sed -n 's/.*name="_csrf" value="\([^"]*\)".*/\1/p' "$work/login-$w.html" >"$work/login-csrf-$w"
    csrf=$(tr -d '\r\n' <"$work/login-csrf-$w")
    printf '_csrf=%s&username=soak-example&password=%s' "$csrf" "$(cat "$work/password")" >"$work/body-login-$w"
    request 303 --cookie "$jar" --cookie-jar "$jar" --header 'Content-Type: application/x-www-form-urlencoded' --data-binary "@$work/body-login-$w" "$base/login"
    token=$(awk '$6=="erp_session"{print $7}' "$jar")
    printf '%s' "$token" >"$work/csrf-$w"
    request 200 --cookie "$jar" "$base/items"
    name="Soak-$w-$cycle"
    printf '_csrf=%s&name=%s&unit=ea&vendor_id=%s' "$token" "$name" "$vendor" >"$work/body-item-$w"
    request 303 --cookie "$jar" --header 'Content-Type: application/x-www-form-urlencoded' --data-binary "@$work/body-item-$w" "$base/items"
    item=$(sqlite3 -cmd '.timeout 10000' "$ERP_DB_PATH" "SELECT id FROM items WHERE name='$name';")
    if [[ -n "$item" ]]; then adds=$((adds + 1));
      printf '_csrf=%s&qty=1&kind=in&memo=soak' "$token" >"$work/body-in-$w"
      request 303 --cookie "$jar" --header 'Content-Type: application/x-www-form-urlencoded' --data-binary "@$work/body-in-$w" "$base/items/$item/moves"
      printf '_csrf=%s&qty=1&kind=out&memo=soak' "$token" >"$work/body-out-$w"
      request 303 --cookie "$jar" --header 'Content-Type: application/x-www-form-urlencoded' --data-binary "@$work/body-out-$w" "$base/items/$item/moves"
    else fails=$((fails + 1)); fi
    printf '_csrf=%s' "$token" >"$work/body-logout-$w"
    request 303 --cookie "$jar" --header 'Content-Type: application/x-www-form-urlencoded' --data-binary "@$work/body-logout-$w" "$base/logout"
    sleep 0.25
  done
  printf '%s %s %s %s %s\n' "$w" "$reqs" "$fails" "$five" "$adds" >"$work/worker-$w.summary"
}
children_of_server() { ps -o pid= --ppid "$server" | awk 'NF{print $1}'; }
resource_sample() {
  set +e
  minute=$1 pids="$server $(children_of_server)" rss=0 fds=0 children=0 zombies=0
  for p in $pids; do
    [[ -r "/proc/$p/status" ]] || continue
    shopt -s nullglob
    if [[ "$p" == "$server" ]]; then
      n=$(awk '/^VmRSS:/{print $2}' "/proc/$p/status")
      rss=${n:-0}
      open=(/proc/$p/fd/*)
      fds=${#open[@]}
    fi
    shopt -u nullglob
    if [[ "$p" != "$server" ]]; then
      children=$((children + 1))
      state=$(ps -o stat= -p "$p" | tr -d ' ')
      [[ "$state" == Z* ]] && zombies=$((zombies + 1))
    fi
  done
  printf '%s %s %s %s %s\n' "$minute" "$rss" "$fds" "$children" "$zombies" >>"$work/resources.tsv"
  set -e
}
printf 'MINUTE RSS_KB_SERVER FD_COUNT_SERVER CHILD_COUNT ZOMBIE_COUNT\n'
: >"$work/resources.tsv"
worker 1 & w1=$!
worker 2 & w2=$!
resource_sample 0
if (( duration >= 1800 )); then
  for minute in 5 10 15 20 25 30; do sleep 300; resource_sample "$minute"; done
else
  sleep "$duration"
  resource_sample "$((duration / 60))"
fi
wait "$w1"; wait "$w2"
cat "$work/resources.tsv"
read -r total_requests total_failures total_5xx total_adds < <(awk '{r+=$2; f+=$3; e+=$4; a+=$5} END{print r,f,e,a}' "$work"/worker-*.summary)
actual_adds=$(sqlite3 -cmd '.timeout 10000' "$ERP_DB_PATH" 'SELECT count(*) FROM items;')
negative=$(sqlite3 -cmd '.timeout 10000' "$ERP_DB_PATH" "SELECT count(*) FROM (SELECT item_id,SUM(CASE WHEN kind='in' THEN qty ELSE -qty END) stock FROM stock_moves GROUP BY item_id HAVING stock < 0);")
printf 'SOAK_SECONDS=%s\n' "$duration"
printf 'REQUESTS=%s\n' "$total_requests"
printf 'OBSERVED_RPS=%.2f\n' "$(awk -v r="$total_requests" -v d="$duration" 'BEGIN{if(d>0)print r/d; else print 0}')"
printf 'FAILURES=%s\n5XX=%s\nADDS_SENT=%s\nITEMS_SQLITE=%s\nNEGATIVE_STOCK_ROWS=%s\n' "$total_failures" "$total_5xx" "$total_adds" "$actual_adds" "$negative"
mem_start=$(awk 'NR==1{print $2}' "$work/resources.tsv")
mem_max=$(awk 'BEGIN{m=0}{if($2>m)m=$2}END{print m}' "$work/resources.tsv")
mem_stable=$(awk -v s="$mem_start" -v m="$mem_max" 'BEGIN{if(m<=s*1.2+8192)print 1; else print 0}')
fd_start=$(awk 'NR==1{print $3}' "$work/resources.tsv")
fd_max=$(awk 'BEGIN{m=0}{if($3>m)m=$3}END{print m}' "$work/resources.tsv")
fd_stable=$((fd_max <= fd_start + 4))
zombies_max=$(awk 'BEGIN{m=0}{if($5>m)m=$5}END{print m}' "$work/resources.tsv")
(( total_failures == 0 )) && p1=1 || p1=0
(( total_5xx == 0 )) && p2=1 || p2=0
[[ "$actual_adds" == "$total_adds" ]] && p3=1 || p3=0
[[ "$negative" == 0 ]] && p4=1 || p4=0
(( mem_stable == 1 )) && p5=1 || p5=0
(( fd_stable == 1 )) && p6=1 || p6=0
[[ "$zombies_max" == 0 ]] && p7=1 || p7=0
passed=$((p1+p2+p3+p4+p5+p6+p7))
printf 'STABILITY_FLAGS=memory:%s fd:%s zombies:%s\n' "$p5" "$p6" "$p7"
printf 'SOAK_SUMMARY=%s/7\n' "$passed"
(( passed == 7 ))
