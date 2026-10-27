#include "runtime.h"
#include <sqlite3.h>
#include <dirent.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int failure_mode;
static int wrapped_failures;

int __real_sqlite3_exec(sqlite3 *, const char *,
                        int (*)(void *, int, char **, char **), void *, char **);

int __wrap_sqlite3_exec(sqlite3 *db, const char *sql,
                        int (*callback)(void *, int, char **, char **),
                        void *context, char **error) {
    if ((failure_mode == 2 && strcmp(sql, "SAVEPOINT fl_db_batch") == 0) ||
        (failure_mode == 3 && strcmp(sql, "RELEASE fl_db_batch") == 0)) {
        wrapped_failures++;
        return SQLITE_ERROR;
    }
    return __real_sqlite3_exec(db, sql, callback, context, error);
}

static int fd_count(void) {
    DIR *dir = opendir("/proc/self/fd");
    if (!dir) return -1;
    int count = 0;
    while (readdir(dir)) count++;
    closedir(dir);
    return count - 2;
}

int main(int argc, char **argv) {
    if (argc != 3) return 2;
    if (strcmp(argv[1], "params") == 0) failure_mode = 1;
    else if (strcmp(argv[1], "savepoint") == 0) failure_mode = 2;
    else if (strcmp(argv[1], "release") == 0) failure_mode = 3;
    else return 2;

    sqlite3 *setup = NULL;
    if (sqlite3_open(argv[2], &setup) != SQLITE_OK) return 2;
    if (sqlite3_exec(setup, "CREATE TABLE IF NOT EXISTS payload(value INTEGER)",
                     NULL, NULL, NULL) != SQLITE_OK) return 2;
    if (sqlite3_close(setup) != SQLITE_OK) return 2;

    FLValue path = fl_str_val(argv[2]);
    FLValue sql = fl_str_val(failure_mode == 1 ? "SELECT ?; SELECT 2" :
                                                "SELECT 1; SELECT 2");
    FLValue params = fl_vec_new();
    if (failure_mode == 1) params = fl_vec_push(params, fl_int(1));
    int before = fd_count();
    int caught = 0;
    for (int i = 0; i < 1000; i++) {
        int failed = setjmp(fl_try_stack[0].buf);
        if (!failed) {
            fl_try_top = 1;
            fl_db_exec(path, sql, params);
        }
        fl_try_top = 0;
        caught += failed != 0;
    }
    int after = fd_count();
    printf("DB_LEAK_PATH=%s DB_LEAK_FD_BEFORE=%d DB_LEAK_FD_AFTER=%d ERRORS=%d WRAPPED_FAILURES=%d\n",
           argv[1], before, after, caught, wrapped_failures);
    if (caught != 1000 || before < 0 || after < 0) return 1;
    if (failure_mode != 1 && wrapped_failures != 1000) return 1;
    return before == after ? 0 : 1;
}
