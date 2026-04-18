#!/bin/bash
# Prints: parity=<weighted_avg> threshold=<x> result=<pass|fail>
# Reads parity-report.json. Exits 0 if pass, 1 if fail, 2 if missing.

set -u
REPORT="${1:-parity-report.json}"
if [ ! -f "$REPORT" ]; then
  echo "parity=0.0000 threshold=0.95 result=missing"
  exit 2
fi
python3 - "$REPORT" <<'PY'
import json, sys
with open(sys.argv[1]) as f:
    r = json.load(f)
avg = r.get("weighted_average", 0.0)
thr = r.get("threshold", 0.95)
res = "pass" if avg >= thr else "fail"
print(f"parity={avg:.4f} threshold={thr} result={res}")
sys.exit(0 if res == "pass" else 1)
PY
