#!/usr/bin/env python3
"""Compile FreeLang HTTP tests; use only the existing loopback FreeLang server."""
import argparse
import os
from pathlib import Path
import selectors
import socket
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--compiler', default=os.environ.get('FREELANG_HTTP_CGC',
    str(root.parent / 'freelang-tools/scripts/cgc-native')))
args = parser.parse_args()
modules = ['core', 'collection', 'io', 'math', 'error', 'process', 'json',
           'db', 'http_server', 'cgc-bridge']
with tempfile.TemporaryDirectory(prefix='fl-http-test-') as directory:
    work = Path(directory)
    for name, source in [('client', 'http.test.fl'), ('server', 'http-server.fl')]:
        generated = work / (name + '.c')
        built = subprocess.run([args.compiler, str(root / 'tests/lib-contract' / source),
                                str(generated)], cwd=root, capture_output=True, text=True)
        if built.returncode or '[load]' in built.stdout or '[CGC-ERR]' in built.stdout:
            raise RuntimeError(built.stdout + built.stderr)
        subprocess.run(['gcc', '-Wno-unused', '-I', str(root / 'runtime'), str(generated),
                        *[str(root / 'runtime' / (m + '.c')) for m in modules],
                        '-lm', '-lsqlite3', '-o', str(work / name)], check=True)
    server = subprocess.Popen([str(work / 'server')], stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE, text=True)
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(server.stdout, selectors.EVENT_READ)
            if not selector.select(5):
                raise RuntimeError('FreeLang HTTP server did not start')
        line = server.stdout.readline().strip()
        if not line.startswith('HTTP_LISTENING=127.0.0.1:'):
            raise RuntimeError('FreeLang HTTP server failed to bind')
        port = line.rsplit(':', 1)[1]
        print('HTTP_LISTENING=127.0.0.1:<가림>', flush=True)
        with socket.socket() as guard:
            guard.bind(('127.0.0.1', 0))
            refused = guard.getsockname()[1]
            result = subprocess.run([str(work / 'client'), 'http://127.0.0.1:' + port,
                                     'http://127.0.0.1:' + str(refused)],
                                    capture_output=True, text=True, timeout=20)
        print(result.stdout, end='')
        print(result.stderr, end='')
        print('HTTP_EXIT=' + str(result.returncode))
        print('SERVER_ALIVE=' + str(server.poll() is None))
        assert result.returncode == 0 and result.stdout.count('PASS ') == 26
        assert server.poll() is None, 'server died after client timeout'
    finally:
        server.terminate()
        try:
            server.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            server.kill()
            server.communicate()
