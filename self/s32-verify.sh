#!/bin/bash
# S32 reproducible build verify
set -e
cd /root/kim/freelang-v11
node bootstrap.js run self/run-cgc.fl self/all.fl /tmp/s32_r1.c
node bootstrap.js run self/run-cgc.fl self/all.fl /tmp/s32_r2.c
node bootstrap.js run self/run-cgc.fl self/all.fl /tmp/s32_r3.c
H1=$(sha256sum /tmp/s32_r1.c | cut -d' ' -f1)
H2=$(sha256sum /tmp/s32_r2.c | cut -d' ' -f1)
H3=$(sha256sum /tmp/s32_r3.c | cut -d' ' -f1)
if [ "$H1" = "$H2" ] && [ "$H2" = "$H3" ]; then
  echo "PASS: C output reproducible ($H1)"
else
  echo "FAIL: non-deterministic output"
  exit 1
fi
gcc -Wall -Wextra -o /tmp/s32_b1 /tmp/s32_r1.c -I./runtime ./runtime/runtime.c -lm
gcc -Wall -Wextra -o /tmp/s32_b2 /tmp/s32_r1.c -I./runtime ./runtime/runtime.c -lm
BH1=$(sha256sum /tmp/s32_b1 | cut -d' ' -f1)
BH2=$(sha256sum /tmp/s32_b2 | cut -d' ' -f1)
if [ "$BH1" = "$BH2" ]; then
  echo "PASS: binary reproducible ($BH1)"
else
  echo "FAIL: binary non-deterministic"
  exit 1
fi
echo "S32 ALL PASS"
