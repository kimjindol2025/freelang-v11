#!/usr/bin/env python3
"""Host only compiles, prepares isolated OS fixtures and supervises FL checks."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import resource
import signal

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--compiler', default=str(root.parent / 'freelang-tools/scripts/cgc-native'))
args = parser.parse_args()
modules = ['core', 'collection', 'io', 'math', 'error', 'process', 'json',
           'db', 'http_server', 'cgc-bridge']
with tempfile.TemporaryDirectory(prefix='fl-fs-test-') as directory:
    work = Path(directory)
    source = root / 'tests/lib-contract/fs.test.fl'
    generated = work / 'fs.c'
    # Deliberately compile from another cwd to verify module-relative loads.
    built = subprocess.run([args.compiler, str(source), str(generated)],
                           cwd=work, capture_output=True, text=True)
    diagnostics = built.stdout + built.stderr
    if built.returncode or '[load]' in diagnostics or '[CGC-ERR]' in diagnostics:
        raise RuntimeError(diagnostics)
    subprocess.run(['gcc', '-Wall', '-Wextra', '-Wno-unused', '-I', str(root / 'runtime'),
                    str(generated), *[str(root / 'runtime' / (m + '.c')) for m in modules],
                    '-lm', '-lsqlite3', '-o', str(work / 'fs')], check=True)
    atomic_c = work / 'atomic.c'
    built = subprocess.run([args.compiler, str(root / 'tests/lib-contract/fs-atomic-failure.test.fl'),
                            str(atomic_c)], cwd=work, capture_output=True, text=True)
    if built.returncode or '[load]' in built.stdout + built.stderr or '[CGC-ERR]' in built.stdout + built.stderr:
        raise RuntimeError(built.stdout + built.stderr)
    subprocess.run(['gcc', '-Wno-unused', '-I', str(root / 'runtime'), str(atomic_c),
                    *[str(root / 'runtime' / (m + '.c')) for m in modules],
                    '-lm', '-lsqlite3', '-o', str(work / 'atomic')], check=True)
    fixtures = work / 'fixtures'
    fixtures.mkdir()
    (fixtures / 'large').write_bytes(b'x' * 1048577)
    (fixtures / 'denied').write_text('denied')
    (fixtures / 'denied').chmod(0)
    locked = fixtures / 'locked'
    locked.mkdir()
    (locked / 'target').write_text('old')
    (fixtures / 'loop').symlink_to(fixtures, target_is_directory=True)
    # Root would bypass mode bits. Drop only the test child's identity if needed.
    child = {}
    if os.geteuid() == 0:
        import pwd
        user = pwd.getpwnam('nobody')
        for p in [work, fixtures, locked, fixtures / 'large', locked / 'target']:
            os.chown(p, user.pw_uid, user.pw_gid)
        child = dict(user=user.pw_uid, group=user.pw_gid, extra_groups=[])
    locked.chmod(0o555)
    try:
        result = subprocess.run([str(work / 'fs'), str(fixtures)], cwd=work,
                                capture_output=True, text=True, timeout=30, **child)
        print(result.stdout, end='')
        print(result.stderr, end='')
        print('FS_EXIT=' + str(result.returncode))
        assert result.returncode == 0, 'FreeLang FS checks failed'
        passes = sum(line.startswith('PASS ') for line in result.stdout.splitlines())
        assert passes >= 25 and f'FS_SUMMARY={passes}/{passes}' in result.stdout
        assert not list(fixtures.rglob('*.fs-*')), 'atomic temp leaked'
        print('FS_ATOMIC_TEMP_LEAKS=0')
        assert (fixtures / 'locked/target').read_text() == 'old'
        print('FS_ORIGINAL_PRESERVED=true')
        (fixtures / 'atomic-target').write_text('old')
        def limit_atomic_child():
            signal.signal(signal.SIGXFSZ, signal.SIG_IGN)
            resource.setrlimit(resource.RLIMIT_FSIZE, (1024, 1024))
        atomic = subprocess.run([str(work / 'atomic'), str(fixtures)], cwd=work,
                                capture_output=True, text=True, timeout=30,
                                preexec_fn=limit_atomic_child)
        print(atomic.stdout, end='')
        print(atomic.stderr, end='')
        print('FS_ATOMIC_EXIT=' + str(atomic.returncode))
        assert atomic.returncode == 0 and atomic.stdout.count('PASS ') == 4
        assert not list(fixtures.rglob('*.fs-*')), 'partial write temp leaked'
        print('FS_PARTIAL_WRITE_TEMP_LEAKS=0')
    finally:
        locked.chmod(0o755)
        (fixtures / 'denied').chmod(0o600)
