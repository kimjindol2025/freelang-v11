#include "runtime.h"
#include <sqlite3.h>
#include <dirent.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <time.h>
#include <unistd.h>

static long long micros(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (long long)ts.tv_sec * 1000000 + ts.tv_nsec / 1000;
}

static int compare_long(const void *a, const void *b) {
    long long x = *(const long long *)a, y = *(const long long *)b;
    return (x > y) - (x < y);
}

static int fd_count(void) {
    DIR *dir = opendir("/proc/self/fd");
    if (!dir) return -1;
    int count = 0;
    while (readdir(dir)) count++;
    closedir(dir);
    return count - 2;
}

static int benchmark(const char *path) {
    sqlite3 *db = NULL;
    sqlite3_stmt *insert = NULL;
    int fds_before = fd_count();
    if (sqlite3_open(path, &db) != SQLITE_OK) return 2;
    if (sqlite3_exec(db, "CREATE TABLE big(id INTEGER PRIMARY KEY,value TEXT);BEGIN", NULL, NULL, NULL)) return 2;
    if (sqlite3_prepare_v2(db, "INSERT INTO big VALUES (?,?)", -1, &insert, NULL)) return 2;
    for (int i = 1; i <= 1000000; i++) {
        sqlite3_bind_int(insert, 1, i);
        sqlite3_bind_text(insert, 2, "data", -1, SQLITE_STATIC);
        if (sqlite3_step(insert) != SQLITE_DONE) return 2;
        sqlite3_reset(insert);
    }
    if (sqlite3_exec(db, "COMMIT", NULL, NULL, NULL)) return 2;
    sqlite3_finalize(insert);
    sqlite3_close(db);
    FLValue handle = fl_db_open(fl_str_val(path));
    long long reads[1000], writes[1000];
    for (int i = 0; i < 1000; i++) {
        FLValue args = fl_vec_new();
        args = fl_vec_push(args, fl_int(1 + i * 997));
        long long start = micros();
        fl_db_query(handle, fl_str_val("SELECT value FROM big WHERE id=?"), args);
        reads[i] = micros() - start;
        args = fl_vec_new();
        args = fl_vec_push(args, fl_int(1000001 + i));
        args = fl_vec_push(args, fl_str_val("data"));
        start = micros();
        fl_db_exec(handle, fl_str_val("INSERT INTO big VALUES (?,?)"), args);
        writes[i] = micros() - start;
    }
    qsort(reads, 1000, sizeof(*reads), compare_long);
    qsort(writes, 1000, sizeof(*writes), compare_long);
    fl_db_close(handle);
    struct rusage usage;
    if (getrusage(RUSAGE_SELF, &usage)) return 2;
    printf("BIG_ROWS=1001000 API=FreeLang READ_P99_US=%lld WRITE_P99_US=%lld MAX_RSS_KB=%ld FD_BEFORE=%d FD_AFTER=%d\n",
           reads[989], writes[989], usage.ru_maxrss, fds_before, fd_count());
    return 0;
}

static FLValue empty(void) { return fl_vec_new(); }

static void run(FLValue db, const char *sql) {
    fl_db_exec(db, fl_str_val(sql), empty());
}

static void put(FLValue db, int id, const char *value) {
    FLValue args = empty();
    args = fl_vec_push(args, fl_int(id));
    args = fl_vec_push(args, value ? fl_str_val(value) : fl_nil());
    fl_db_exec(db, fl_str_val("INSERT INTO payload(id,value) VALUES (?,?)"), args);
}

static int caught_exec(FLValue db, const char *sql, FLValue args) {
    int failed = setjmp(fl_try_stack[0].buf);
    if (!failed) {
        fl_try_top = 1;
        fl_db_exec(db, fl_str_val(sql), args);
    }
    fl_try_top = 0;
    if (failed) {
        FLValue error = fl_try_stack[0].err;
        fprintf(stderr, "%s\n", ((FLString *)error.obj)->data);
    }
    return failed;
}

int main(int argc, char **argv) {
    if (argc < 3) return 2;
    const char *mode = argv[1];
    if (!strcmp(mode, "benchmark")) return benchmark(argv[2]);
    FLValue db = fl_db_open(fl_str_val(argv[2]));
    if (!strcmp(mode, "init")) {
        run(db, "CREATE TABLE IF NOT EXISTS payload(id INTEGER PRIMARY KEY,value TEXT)");
    } else if (!strcmp(mode, "worker")) {
        if (argc != 4) return 2;
        int start = atoi(argv[3]);
        run(db, "BEGIN IMMEDIATE");
        for (int i = 0; i < 5000; i++) put(db, start + i, "worker");
        run(db, "COMMIT");
    } else if (!strcmp(mode, "crash")) {
        run(db, "BEGIN IMMEDIATE");
        for (int i = 0; i < 20; i++) put(db, 1000000 + i, "unfinished");
        puts("IN_TRANSACTION");
        fflush(stdout);
        pause();
    } else if (!strcmp(mode, "batch")) {
        int failed = caught_exec(db,
            "INSERT INTO payload VALUES (900001,'first');"
            "INSERT INTO payload VALUES (900002,'second');"
            "INSERT INTO payload VALUES (900001,'duplicate');", empty());
        printf("BATCH_FAILED=%d\n", failed);
        if (!failed) return 1;
    } else if (!strcmp(mode, "disk")) {
        struct rlimit old, limit;
        if (getrlimit(RLIMIT_FSIZE, &old)) return 2;
        limit = old;
        limit.rlim_cur = 32768;
        if (setrlimit(RLIMIT_FSIZE, &limit)) return 2;
        char *large = malloc(100001);
        if (!large) return 2;
        memset(large, 'x', 100000);
        large[100000] = 0;
        FLValue args = empty();
        args = fl_vec_push(args, fl_int(900003));
        args = fl_vec_push(args, fl_str_val(large));
        int failed = caught_exec(db, "INSERT INTO payload(id,value) VALUES (?,?)", args);
        printf("DISK_ERROR=%d\n", failed);
        if (setrlimit(RLIMIT_FSIZE, &old)) return 2;
        if (!failed) return 1;
        put(db, 900004, "recovered");
        puts("RECOVERY_WRITE=ok");
        free(large);
    } else if (!strcmp(mode, "input")) {
        put(db, 900010, "quote' ; -- \" unicode 한글");
        put(db, 900011, NULL);
        char *large = malloc(100001);
        if (!large) return 2;
        memset(large, 'L', 100000);
        large[100000] = 0;
        put(db, 900012, large);
        free(large);
        FLString *zero = malloc(sizeof(*zero) + 4);
        if (!zero) return 2;
        zero->base.type = FL_STRING;
        zero->base.rc = 1;
        zero->len = 3;
        memcpy(zero->data, "a\0b\0", 4);
        FLValue args = empty();
        args = fl_vec_push(args, fl_int(900013));
        FLValue bad = {.tag = FL_STRING, .obj = (FLObject *)zero};
        args = fl_vec_push(args, bad);
        int failed = caught_exec(db, "INSERT INTO payload(id,value) VALUES (?,?)", args);
        printf("ZERO_BYTE_REJECTED=%d\n", failed);
        if (!failed) return 1;
        sqlite3 *raw = NULL;
        if (sqlite3_open(argv[2], &raw) != SQLITE_OK) return 2;
        if (sqlite3_exec(raw, "INSERT INTO payload VALUES (900014,char(97,0,98))", NULL, NULL, NULL)) return 2;
        sqlite3_close(raw);
        failed = setjmp(fl_try_stack[0].buf);
        if (!failed) {
            fl_try_top = 1;
            fl_db_query(db, fl_str_val("SELECT value FROM payload WHERE id=900014"), empty());
        }
        fl_try_top = 0;
        printf("ZERO_BYTE_READ_REJECTED=%d\n", failed);
        if (!failed) return 1;
        puts("INPUT_WRITE=ok");
    } else if (!strcmp(mode, "hold")) {
        for (int i = 0; i < 20000; i++) {
            put(db, 2000000 + i, "wal");
            if (i == 100) { puts("WRITING"); fflush(stdout); }
        }
        puts("WAL_WRITES=20000");
        fflush(stdout);
        pause();
    } else {
        return 2;
    }
    fl_db_close(db);
    return 0;
}
