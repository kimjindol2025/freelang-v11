#!/bin/bash
# run-jest-shard.sh — Jest 샤드별 실행 (로컬/CI 겸용)
# Usage:
#   ./scripts/run-jest-shard.sh 1 3    # Shard 1/3 실행
#   ./scripts/run-jest-shard.sh all     # 전체 실행 (3 shards 병렬)

set -e

if [ $# -eq 0 ]; then
  echo "Usage: ./scripts/run-jest-shard.sh <shard> <total> [options]"
  echo "   or: ./scripts/run-jest-shard.sh all              (parallel 3 shards)"
  echo ""
  echo "Examples:"
  echo "  ./scripts/run-jest-shard.sh 1 3                  # Run shard 1/3"
  echo "  ./scripts/run-jest-shard.sh 2 3                  # Run shard 2/3"
  echo "  ./scripts/run-jest-shard.sh all                  # Run all shards in parallel"
  exit 1
fi

SHARD_MODE="$1"
TOTAL_SHARDS="${2:-3}"

if [ "$SHARD_MODE" = "all" ]; then
  echo "════════════════════════════════════════════"
  echo "  Jest Full Test Suite (3 Shards Parallel)"
  echo "════════════════════════════════════════════"
  echo ""

  # 3개 shard를 백그라운드로 실행
  for i in 1 2 3; do
    (
      echo "🔄 Shard $i/3 started..."
      npm test -- --shard=$i/3 --bail=false --silent --maxWorkers=4
      echo "✅ Shard $i/3 completed"
    ) &
    PIDS[$i]=$!
  done

  # 모든 백그라운드 job 대기
  FAILED=0
  for i in 1 2 3; do
    if ! wait ${PIDS[$i]}; then
      FAILED=$((FAILED + 1))
    fi
  done

  echo ""
  echo "════════════════════════════════════════════"
  if [ $FAILED -eq 0 ]; then
    echo "✅ All shards completed successfully"
    exit 0
  else
    echo "❌ $FAILED shard(s) failed"
    exit 1
  fi
else
  # 특정 shard 실행
  SHARD_NUM="$SHARD_MODE"

  if [ -z "$SHARD_NUM" ] || [ -z "$TOTAL_SHARDS" ]; then
    echo "❌ Invalid shard specification"
    exit 1
  fi

  echo "════════════════════════════════════════════"
  echo "  Jest Shard $SHARD_NUM/$TOTAL_SHARDS"
  echo "════════════════════════════════════════════"
  echo ""

  npm test -- \
    --shard=$SHARD_NUM/$TOTAL_SHARDS \
    --bail=false \
    --silent \
    --maxWorkers=4

  EXIT_CODE=$?
  echo ""
  if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Shard $SHARD_NUM/$TOTAL_SHARDS passed"
  else
    echo "❌ Shard $SHARD_NUM/$TOTAL_SHARDS failed (exit code: $EXIT_CODE)"
  fi

  exit $EXIT_CODE
fi
