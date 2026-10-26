# Native SQLite contract

`lib/db/db.fl` supplies the CRUD names used by `fl-sqlite-store` using the existing `db-open`, `db-close`, `db-query`, and `db-exec` primitives. The native database layer already accepts either an open handle or a SQLite file path, so these helpers do not add database C functions. Values are bound as parameters; table and column names are quoted with embedded quotes doubled. Empty update/delete filters return zero rows affected to avoid accidental whole-table writes.

`db-exec` runs multiple SQL statements in one call atomically when the parameter array is empty. A failed statement rolls back the whole batch. Parameterized calls accept one statement; use explicit `BEGIN` and `COMMIT` calls to group parameterized writes. Database strings containing zero bytes are rejected because FreeLang strings and SQLite text would otherwise round trip differently.

The compiler checks every generated C file with `gcc -fsyntax-only` before reporting success. `fl_gcc_syntax_check` is a small native process helper because the check must invoke GCC with an argv vector; passing a source path through a shell would make arbitrary output paths executable shell input. It resolves `runtime.h` from the compiler build when the current directory is outside the repository, as the native test supervisors compile from isolated temporary directories.

`lib/db/sqlite-store-compat.fl` contains the legacy store package's printf-style `str-format` bridge and the minimal `q/from`/`q/build-select` entry points needed to compile its unused query helpers. The CRUD verification passes a nil schema and does not exercise validation or the query DSL; regex validation deliberately raises an error until a native regex matcher is available.
