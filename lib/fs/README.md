# Files and directories v0.1

Load `lib/fs/fs.fl`. All public operations return `{ok:true,value:...}` or
`{ok:false,error:{code,message,path}}`. Legacy `self/stdlib/file.fl` stays
compatible; load one file API per compilation unit. Public control flow,
path processing, recursive traversal, lines and JSON are FreeLang. Checked
POSIX I/O is a private runtime primitive because legacy functions discard errno
and may throw. JSON loads `lib/json/json.fl`, which reuses `self/stdlib/json.fl`.

| API | Value on success |
|---|---|
| `file-read(path)` | content string, including empty content |
| `file-write(path, content)`, `file-append(path, content)` | `true` |
| `file-read-lines(path)` | split on LF; omit one final empty field; empty file → `[]`; CR is preserved |
| `file-write-atomic(path, content)` | `true`; same-directory exclusive temporary file, checked writes, fsync, close, rename |
| `dir-list(path)` | immediate entry names, excluding `.` and `..`; OS order |
| `dir-walk(path)` | descendant paths including directories and symlinks; OS order; no descent into symlinks; depth limit 128 |
| `dir-make(path)` | `true`; create intermediate directories, existing directory succeeds |
| `dir-remove(path)` | `true`; empty directories only, symlink is not followed |
| `path-join(parent, child)` | normalized joined path; child must be relative |
| `path-base(path)`, `path-dir(path)` | final component or parent of normalized path; root stays `/`, bare relative parent is `.` |
| `path-ext(path)` | last suffix including `.`, or empty string; `.profile` has no suffix |
| `path-normalize(path)` | POSIX lexical path; collapse slash, dot and cancellable dot-dot |
| `file-exists?(path)` | boolean; ENOENT → false; other errors are retained |
| `file-size(path)` | bytes |
| `file-mtime(path)` | Unix epoch milliseconds |
| `file-read-json(path)`, `file-write-json(path, value)` | decoded JSON value or `true`; JSON error retains code/message/position and adds path |

Paths must be nonempty strings. Runtime I/O rejects embedded NUL. Contents must
be strings. Relative paths use the process working directory. Path helpers
reject `..` when there is no preceding component (`PATH_ESCAPE`), including
absolute paths above `/`. To constrain untrusted relative input, normalize that
input before joining to a trusted base. Normalization is lexical: it does not
resolve symlinks, prevent symlink races, or provide a filesystem sandbox.
I/O accepts ordinary OS paths; normalization is explicitly chosen by the caller.

Errors include `INVALID_PATH`, `INVALID_CONTENT`, `PATH_ESCAPE`, `NOT_FOUND`,
`PERMISSION`, `NOT_DIRECTORY`, `IS_DIRECTORY`, `NOT_EMPTY`, `SYMLINK_LOOP`,
`NO_SPACE`, `FILE_TOO_LARGE`, `PATH_TOO_LONG`, `DEPTH_LIMIT`, and fallback `IO`.
OS messages are preserved and depend on the environment.

Atomic writes create a temporary file with mode 0600 and replace the destination
inode, including its old permissions. Successful rename gives atomic visibility;
directory fsync and power-loss durability are not promised. Creation, partial
write, fsync, close and rename failures return errors. On failure, the operation
attempts to unlink only its own temporary file and preserves the destination.
An external directory permission change can prevent cleanup; process termination
can also leave temporary files. Ordinary writes/appends may leave partial data
on I/O failure. Reads accept regular files only. There is no recursive deletion
API; existing file deletion remains available through the legacy API.

Run `python3 tests/lib-contract/run-fs.py --compiler /path/to/cgc`. The runner
uses disposable fixtures, real mode permissions, a symlink loop and an actual
1024-byte child file-size limit for partial atomic-write failure and recovery.
