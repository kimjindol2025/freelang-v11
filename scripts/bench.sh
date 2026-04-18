#!/data/data/com.termux/files/usr/bin/bash
# P00/08: 성능 기준선. Phase 별 전후 측정.
# 고정 3 종: hello / fib(30) / json-parse(1MB).
#
# 출력: bench mode=ts|self case=hello ms=12
#       bench mode=ts|self case=fib30 ms=410
#       bench mode=ts|self case=json1mb ms=850

set -e
cd "$(dirname "$0")/.."

MODE="${1:-ts}"    # ts | self

mkdir -p self/bench

# 벤치 샘플이 없으면 생성
HELLO=self/bench/hello.fl
FIB=self/bench/fib30.fl
JSON=self/bench/json1mb.fl

if [ ! -f "$HELLO" ]; then
  echo '(println "hello")' > "$HELLO"
fi
if [ ! -f "$FIB" ]; then
  cat > "$FIB" <<'EOF'
(defn fib [n]
  (if (< n 2) n
    (+ (fib (- n 1)) (fib (- n 2)))))
(println (fib 30))
EOF
fi
if [ ! -f "$JSON" ]; then
  # ~1MB JSON 생성 (1회성)
  node -e "
    const arr = Array.from({length: 8000}, (_, i) => ({id: i, name: 'user' + i, email: 'user' + i + '@example.com', active: i%2===0}));
    require('fs').writeFileSync('self/bench/sample.json', JSON.stringify(arr));
  "
  cat > "$JSON" <<'EOF'
(let [s (file_read "self/bench/sample.json")
      parsed (json_parse s)]
  (println (length parsed)))
EOF
fi

time_ms() {
  local start end
  start=$(date +%s%N)
  "$@" >/dev/null 2>&1
  end=$(date +%s%N)
  echo $(( (end - start) / 1000000 ))
}

run_bench() {
  local case="$1" file="$2"
  local ms
  if [ "$MODE" = "ts" ]; then
    ms=$(time_ms node bootstrap.js run "$file")
    echo "bench mode=ts case=$case ms=$ms"
  elif [ "$MODE" = "self" ]; then
    if [ -f self/main.fl ]; then
      ms=$(time_ms node bootstrap.js run self/main.fl "$file")
      echo "bench mode=self case=$case ms=$ms"
    else
      echo "bench mode=self case=$case status=skipped reason=no_self/main.fl"
    fi
  fi
}

run_bench hello    "$HELLO"
run_bench fib30    "$FIB"
run_bench json1mb  "$JSON"
