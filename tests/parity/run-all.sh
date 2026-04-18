#!/bin/bash
# Runs every NN-*.sh in this directory, collects RESULT lines,
# writes parity-report.json.
# Usage: bash tests/parity/run-all.sh

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT"

REPORT="$ROOT/parity-report.json"
TMP_RESULTS="$ROOT/tests/evidence/_results.txt"
mkdir -p "$ROOT/tests/evidence"
: > "$TMP_RESULTS"

# Category weights used by score.sh (mirror Stage 3 formula).
# B (React 비의존) weight = 1.0
# A (React 의존) weight = 1.0 but capped score via category-ceiling in score.sh
# Category assignment is encoded inside each individual test script (observed=category=X).

NODE_VERSION="$(node -v 2>/dev/null || echo unknown)"
GIT_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

for script in "$HERE"/[0-9][0-9]-*.sh; do
  [ -e "$script" ] || continue
  name="$(basename "$script")"
  echo "# running $name"
  output="$(bash "$script" 2>&1)" || true
  echo "$output" | grep '^RESULT ' >> "$TMP_RESULTS" || true
  echo "$output" | grep -v '^RESULT ' || true
done

echo ""
echo "# assembling parity-report.json"

python3 - "$REPORT" "$TMP_RESULTS" "$NODE_VERSION" "$GIT_COMMIT" "$NOW" <<'PY'
import json, sys, re
report_path, results_path, node_v, commit, now = sys.argv[1:6]
features = {}
with open(results_path) as f:
    for line in f:
        line = line.strip()
        if not line.startswith("RESULT "):
            continue
        m = re.match(r"RESULT feature=(\S+) pass=(\S+) score=(\S+) evidence=(\S+) observed=(.*)$", line)
        if not m:
            continue
        feat, p, sc, ev, obs = m.groups()
        obs_dict = {}
        for kv in obs.split(";"):
            if not kv or "=" not in kv:
                continue
            k, v = kv.split("=", 1)
            obs_dict[k] = v
        category = obs_dict.pop("category", "B")
        try:
            score = float(sc)
        except ValueError:
            score = 0.0
        features[feat] = {
            "category": category,
            "pass": p == "true",
            "score": score,
            "evidence": ev,
            "observed": obs_dict,
        }

# weighted average ignoring category C
scored = [f for f in features.values() if f["category"] in ("A", "B")]
if scored:
    avg = sum(f["score"] for f in scored) / len(scored)
else:
    avg = 0.0

report = {
    "generated_at": now,
    "node_version": node_v,
    "commit": commit,
    "features": features,
    "weighted_average": round(avg, 4),
    "threshold": 0.95,
    "result": "pass" if avg >= 0.95 else "fail",
}
with open(report_path, "w") as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"features={len(features)} weighted_average={report['weighted_average']} result={report['result']}")
PY
