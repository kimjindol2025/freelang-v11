#!/usr/bin/env python3
"""Supervise native contracts; assertions and aggregation belong to FreeLang."""
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
cases = [('test-evidence', 0, 'TEST_EVIDENCE_SUMMARY=53/53'),
         ('test-report-pass', 0, 'PASS 1/1'),
         ('test-report-fail', 1, 'PASS 0/1')]
for name, code, summary in cases:
    with tempfile.TemporaryDirectory(prefix='fl-test-evidence-') as temp:
        work = Path(temp)
        result = subprocess.run([compiler, str(root/'tests/lib-contract'/(name+'.test.fl')),
                                 str(work/'out.c')], cwd=work, capture_output=True,
                                text=True, timeout=60)
        diagnostics = result.stdout + result.stderr
        if result.returncode or '[CGC-ERR]' in diagnostics or '[load] 파일 없음' in diagnostics:
            raise RuntimeError(diagnostics)
        subprocess.run(['gcc', '-I', str(root/'runtime'), '-o', str(work/'test'),
                        str(work/'out.c'), *[str(root/'runtime'/(u+'.c')) for u in units],
                        '-lm', '-lsqlite3'], check=True, timeout=60)
        result = subprocess.run([str(work/'test')], cwd=work, capture_output=True,
                                text=True, timeout=60)
        print(result.stdout, end='', flush=True)
        print(f'{name}: EXIT={result.returncode}', flush=True)
        if result.returncode != code or summary not in result.stdout.splitlines():
            raise RuntimeError(f'{name}: {result.stderr}')
        if name == 'test-report-fail' and 'FAIL deliberate expected=1 actual=2' not in result.stdout:
            raise RuntimeError('Missing failure details')
        if name == 'test-evidence':
            expected = subprocess.check_output(['sha256sum', '--', 'hash-input.txt'], cwd=work,
                                               text=True).split()[0]
            if expected != 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad':
                raise RuntimeError('Independent sha256sum mismatch')
print('TEST_EVIDENCE_CONTRACT_EXIT=0', flush=True)
