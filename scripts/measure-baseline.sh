#!/bin/bash
# 벤치마크 기준선 측정
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESULTS="$PROJECT_ROOT/benchmark-baseline.json"

echo "🔍 벤치마크 기준선 측정 중..."

cat > "$RESULTS" <<'JSON'
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "baseline": "interpreter-only (no VM)",
  "results": [
JSON

for bench_file in "$PROJECT_ROOT"/self/bench/_*.fl; do
  name=$(basename "$bench_file" .fl)
  echo "  측정 중: $name"
  
  # 컴파일
  output="/tmp/$name.js"
  node bootstrap.js run self/codegen.fl "$bench_file" "$output" 2>/dev/null || continue
  
  # 시간 측정 (3회 실행 후 평균)
  times=()
  for i in {1..3}; do
    start=$(date +%s%N)
    node "$output" >/dev/null 2>&1 || true
    end=$(date +%s%N)
    elapsed=$(( (end - start) / 1000000 ))  # ns to ms
    times+=($elapsed)
  done
  
  # 평균 계산
  sum=0
  for t in "${times[@]}"; do sum=$((sum + t)); done
  avg=$((sum / 3))
  
  echo "    $name: ${avg}ms"
done

echo "✅ 벤치마크 기준선 저장: $RESULTS"
