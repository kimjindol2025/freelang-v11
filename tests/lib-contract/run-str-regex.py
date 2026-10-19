#!/usr/bin/env python3
"""Compile from an unrelated cwd; FreeLang owns assertions and counters."""
import argparse
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--compiler', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
compiler = str(Path(args.compiler).resolve())
units = ['core', 'collection', 'io', 'math', 'error', 'process', 'json',
         'db', 'http_server', 'cgc-bridge']
for name, expected in [('str', 'STR_SUMMARY=35/35'),
                       ('regex', 'REGEX_SUMMARY=67/67'),
                       ('str-legacy', 'LEGACY_STR_SUMMARY=6/6'),
                       ('str-integration', 'STR_INTEGRATION_SUMMARY=4/4')]:
    with tempfile.TemporaryDirectory(prefix='fl-string-contract-') as temp:
        work = Path(temp)
        source = root / 'tests/lib-contract' / (name + '.test.fl')
        result = subprocess.run([compiler, str(source), str(work/'out.c')],
                                cwd=work, capture_output=True, text=True, timeout=60)
        if result.returncode or '[CGC-ERR]' in result.stdout + result.stderr or '[load] 파일 없음' in result.stdout + result.stderr:
            raise RuntimeError(result.stdout + result.stderr)
        subprocess.run(['gcc', '-I', str(root/'runtime'), '-o', str(work/'test'),
                        str(work/'out.c'),
                        *[str(root/'runtime'/(unit+'.c')) for unit in units],
                        '-lm', '-lsqlite3'], check=True, timeout=60)
        result = subprocess.run([str(work/'test')], cwd=work,
                                capture_output=True, text=True, timeout=60)
        print(result.stdout, end='', flush=True)
        if result.returncode or expected not in result.stdout.splitlines():
            raise RuntimeError(f'{name}: exit={result.returncode}\n{result.stderr}')
print('STR_REGEX_CONTRACT_EXIT=0', flush=True)
