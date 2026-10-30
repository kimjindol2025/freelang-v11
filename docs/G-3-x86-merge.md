# G-3: x86 병합 후보 검증

## a. seed 확인

```text
git show dec63e636a2b1225ba88b8d9b9e3a426e129f6f2:bin/cgc-bin-x86_64-seed-v11 | sha256sum
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  -

sha256sum bin/cgc-bin-x86_64-seed-v11
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>

git cat-file -p dec63e636a2b1225ba88b8d9b9e3a426e129f6f2:bin/cgc-bin-x86_64-seed-v11 | cmp - bin/cgc-bin-x86_64-seed-v11; echo CMP=$?
CMP=0
```

## b. GitHub master와 백업 태그

```text
git ls-remote origin refs/heads/master
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	refs/heads/master

git show -s --format='%H %cI %s' origin/master
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4 2026-10-11T20:14:46+09:00 ci: bound optional manual self-host job to 15m [skip ci]
```

Tag: `pre-x86-merge-20261030`, created at the verified GitHub master HEAD and pushed to GitHub only.

```text
git ls-remote origin refs/tags/pre-x86-merge-20261030 'refs/tags/pre-x86-merge-20261030^{}'
b13f68407423f86a48a583554ba616e7f8459c10	refs/tags/pre-x86-merge-20261030
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	refs/tags/pre-x86-merge-20261030^{}
```

## c. 임시 브랜치 병합

```text
git merge --no-ff v11-x86-seed-public
Merge made by the 'ort' strategy.
2f4f6292204e3529200c425d4db082fa5db6cfa8
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4 de9115d9f537283d60520dc1e6cde33ba6d14b89
2026-10-30T00:49:19+09:00
Merge branch 'v11-x86-seed-public' into x86-merge-check
```

`x86-merge-check`는 확인한 GitHub master `b49cc9194a00649b8cf58e1d6e8ee38ffce770d4`에서 생성했다. 충돌 없이 no-ff 병합 커밋이 만들어졌다.

## d. seed·고정점·strace·앱·동시성

Fixed-point output from the merged candidate (generated files' path portions are masked):

```text
36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
1d70ead09560b908672a572165f62b41b114b336e9fbbcf9c540de2417596448  <가림>
CMP_2_3=0
CMP_3_4=0
NATIVE_FIXED_POINT=PASS
```

strace contract command and result:

```text
strace -f -e trace=execve -o <가림> bash tests/run-cgc-symbol-contract.sh (within the held flock)
STRACE_CONTRACT_RC=0
PASS slash names and punctuation separation
PASS C symbol collision rejected
PASS invalid generated C rejected
PASS when, ??, and empty? native lowering
NATIVE_FORMS_SUMMARY=18/18
CGC_SYMBOL_SUMMARY=5/5
NODE_EXECUTIONS=0
NPM_EXECUTIONS=0
NPX_EXECUTIONS=0
PYTHON_EXECUTIONS=0
JS_EXECUTIONS=0
```

The execution counters are counts from the saved `execve` trace.

```text
APP_START=PASS
ABOUT_HTTP=200
ABOUT_BODY_FIRST_LINE=<!doctype html>
CONC_RUN=current/1 RC=0
CONC_SUMMARY=8/8
CONC_RUN=current/2 RC=0
CONC_SUMMARY=8/8
CONC_RUN=current/3 RC=0
CONC_SUMMARY=8/8
CONC_RUN=baseline/1 RC=0
CONC_SUMMARY=8/8
```

There were three current-runtime concurrency runs and one reference-runtime run; each printed `CONC_SUMMARY=8/8`.

## e. 전체 시험과 실패 분류

Before starting, a full `ps -eo pid,ppid,stat,etime,args` snapshot was saved; no other heavy verification process was present (`OTHER_HEAVY_FOUND=0`). The run acquired the shared lock and was executed once:

```text
flock -o -w 3600 /tmp/fl-heavy.lock bash -s -- <가림> <가림>
HEAVY_LOCK=ACQUIRED
FULL_CHECK_RC=1
FULL_FAST_RC=1
LOAD2_SUMMARY=9/10
FDFIX_SUMMARY=4/5
TASK942_LEGACY_RC=1
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
LOAD2_SUMMARY=10/10
FDFIX_SUMMARY=5/5
POOL_SUMMARY=8/8
TASK942_POOL_RC=0
TASK946_FAST_SUMMARY=1/2
CGC_SYMBOL_SUMMARY=5/5
ABI_SUMMARY=8/8
TASK920_RC=0
```

Failure classification:

| Failure or negative-path result | Classification | Evidence |
|---|---|---|
| `TASK942_LEGACY_RC=1`, `LOAD2_SUMMARY=9/10`, `FDFIX_SUMMARY=4/5`, and `TASK946_FAST_SUMMARY=1/2` | DB cause | `LOAD_DATABASE_IS_LOCKED=182`; legacy server output: `db-exec: database is locked (sqlite=5)`. The earlier G-1 baseline record also had `LOAD2_SUMMARY=9/10` and `LOAD_DATABASE_IS_LOCKED=178`, so the same failure class reproduces on the reference runtime. |
| fd-limit negative path | Test environment | `FDFIX_CASE=fd-limit RC=1 SIGNAL=0 ERROR=db-exec: unable to open database file (sqlite=14)`; recovery: `FDFIX_RECOVERY_RC=0 ROWS=1`. |
| x86-origin failures | x86 cause | `0` |

The pool suite passed `POOL_SUMMARY=8/8`, native symbol tests passed `CGC_SYMBOL_SUMMARY=5/5`, and ABI tests passed `ABI_SUMMARY=8/8`. No DB code, test expectation, or seed was changed. The whole check still returned nonzero because the legacy DB-lock case failed: `FULL_CHECK_RC=1`. At the time of the initial G-3 run, GitHub master was not advanced; the later G-3a decision is recorded below.

## f. Push decision and remote state

```text
GitHub master after initial G-3 verification, before the G-3a decision:
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	refs/heads/master
GitHub master at that same point:
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	refs/heads/master
GITHUB_MASTER_PUSHED=NO
REASON=FULL_CHECK_RC=1
Forgejo master was not pushed or modified.
```

## g. 민감정보 검사

Review found no server address, workspace-specific absolute path, or key material. Execution-output paths are redacted as `<가림>`; the explicitly required shared lock name `/tmp/fl-heavy.lock` is retained.

```text
SERVER_ADDRESS_MATCHES=0
WORKSPACE_PATH_MATCHES=0
KEY_MATCHES=0
```

## G-3a. 결정, fast-forward push, 남은 실패

사장님 결정(2026-10-30): legacy DB 잠금 실패(`LOAD2_SUMMARY=9/10`)는 DB 담당이 처리하며, x86 원인 실패가 0건이므로 master에 올린다.

후보/보고서 커밋 확인:

```text
git rev-parse x86-merge-check
c8d03799c564eb3f3a30f569b3a61e4fcf25b5c3

git merge-base --is-ancestor 2f4f6292 c8d03799
CANDIDATE_ANCESTOR_RC=0

git merge-base --is-ancestor c8d03799 x86-merge-check
REPORT_ANCESTOR_RC=0
```

GitHub master는 지시된 기준 HEAD `b49cc9194a00649b8cf58e1d6e8ee38ffce770d4`에서 변경되지 않은 것을 확인한 뒤 일반 fast-forward push했다. Push 결과:

```text
git push origin x86-merge-check:refs/heads/master
b49cc919..c8d03799  x86-merge-check -> master
```

Push 후 원격 HEAD와 백업 태그:

```text
git ls-remote origin refs/heads/master
c8d03799c564eb3f3a30f569b3a61e4fcf25b5c3	refs/heads/master

git show -s --format='%H %cI %s' origin/master
c8d03799c564eb3f3a30f569b3a61e4fcf25b5c3 2026-10-30T01:39:18+09:00 docs: record G-3 x86 merge candidate verification

git ls-remote origin refs/tags/pre-x86-merge-20261030 'refs/tags/pre-x86-merge-20261030^{}'
b13f68407423f86a48a583554ba616e7f8459c10	refs/tags/pre-x86-merge-20261030
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	refs/tags/pre-x86-merge-20261030^{}
```

남은 실패: legacy DB 잠금, DB 담당 처리 예정.
Forgejo master는 변경하지 않았다.
