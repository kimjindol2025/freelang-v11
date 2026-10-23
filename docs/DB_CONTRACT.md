# Native SQLite contract

`lib/db/db.fl` supplies the CRUD names used by `fl-sqlite-store` using the existing `db-open`, `db-close`, `db-query`, and `db-exec` primitives. The native database layer already accepts either an open handle or a SQLite file path, so these helpers do not add database C functions. Values are bound as parameters; table and column names are quoted with embedded quotes doubled. Empty update/delete filters return zero rows affected to avoid accidental whole-table writes.

The compiler checks every generated C file with `gcc -fsyntax-only` before reporting success. `fl_gcc_syntax_check` is a small native process helper because the check must invoke GCC with an argv vector; passing a source path through a shell would make arbitrary output paths executable shell input. It resolves `runtime.h` from the compiler build when the current directory is outside the repository, as the native test supervisors compile from isolated temporary directories.
