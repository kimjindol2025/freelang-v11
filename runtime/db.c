#include "runtime.h"
#include <sqlite3.h>
#include <stdint.h>
#include <limits.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>

static const char *db_string(FLValue value, const char *operation) {
    if (value.tag != FL_STRING || !value.obj) {
        char message[160];
        snprintf(message, sizeof(message), "%s expects a string", operation);
        fl_throw(fl_str_val(message));
    }
    FLString *string = (FLString *)value.obj;
    if (strlen(string->data) != string->len)
        fl_throw(fl_str_val("database strings cannot contain zero bytes"));
    return string->data;
}

typedef struct {
    sqlite3 *handle;
    bool owned;
} FLDbLease;

typedef struct FLDbEntry {
    int64_t id;
    sqlite3 *db;
    char *path;
    pid_t pid;
    struct FLDbEntry *next;
} FLDbEntry;

static FLDbEntry *db_entries;

static sqlite3 *db_open_path(const char *path, bool configure_wal) {
    sqlite3 *db = NULL;
    int code = sqlite3_open_v2(path, &db,
                               SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
                               NULL);
    if (code != SQLITE_OK) {
        char message[512];
        snprintf(message, sizeof(message), "db-exec: db-open: %s (sqlite=%d)",
                 db ? sqlite3_errmsg(db) : sqlite3_errstr(code), code);
        if (db) sqlite3_close(db);
        fl_throw(fl_str_val(message));
    }
    (void)sqlite3_busy_timeout(db, 30000);
    (void)sqlite3_exec(db, "PRAGMA foreign_keys = ON", NULL, NULL, NULL);
    if (configure_wal) {
        char *error = NULL;
        int wal_code = sqlite3_exec(db, "PRAGMA journal_mode = WAL", NULL, NULL, &error);
        if (wal_code != SQLITE_OK) {
            char wal_message[512];
            snprintf(wal_message, sizeof(wal_message), "%s (sqlite=%d)",
                     error ? error : sqlite3_errmsg(db), wal_code);
            sqlite3_free(error);
            error = NULL;
            int fallback_code = sqlite3_exec(db, "PRAGMA journal_mode = DELETE",
                                             NULL, NULL, &error);
            if (fallback_code != SQLITE_OK) {
                char message[512];
                snprintf(message, sizeof(message),
                         "db-exec: WAL and DELETE journal setup failed: %s (sqlite=%d)",
                         error ? error : sqlite3_errmsg(db), fallback_code);
                sqlite3_free(error);
                sqlite3_close(db);
                fl_throw(fl_str_val(message));
            }
            sqlite3_free(error);
            fprintf(stderr,
                    "db-open warning: WAL unavailable; using DELETE journal mode: %s\n",
                    wal_message);
        }
    }
    return db;
}

static FLDbEntry *db_entry(int64_t id) {
    for (FLDbEntry *entry = db_entries; entry; entry = entry->next)
        if (entry->id == id) return entry;
    return NULL;
}

static sqlite3 *db_reopen_after_fork(FLDbEntry *entry) {
    if (entry->pid != getpid()) {
        entry->db = db_open_path(entry->path, false);
        entry->pid = getpid();
    }
    return entry->db;
}

static FLDbLease db_acquire(FLValue value) {
    FLDbLease lease;
    if (value.tag == FL_INT && value.i != 0) {
        FLDbEntry *entry = db_entry(value.i);
        lease.handle = entry ? db_reopen_after_fork(entry)
                             : (sqlite3 *)(uintptr_t)(uint64_t)value.i;
        lease.owned = false;
        return lease;
    }
    FLValue path_value = value;
    if (value.tag == FL_MAP) {
        FLValue type = fl_map_get(value, fl_str_val("type"));
        if (type.tag == FL_STRING &&
            strcmp(((FLString *)type.obj)->data, "sqlite") != 0)
            fl_throw(fl_str_val("database type must be sqlite"));
        path_value = fl_map_get(value, fl_str_val("path"));
    }
    lease.handle = db_open_path(db_string(path_value, "database"), true);
    lease.owned = true;
    return lease;
}

static void db_error(sqlite3 *db, const char *operation, int code) {
    char message[512];
    snprintf(message, sizeof(message), "%s: %s (sqlite=%d)", operation,
             db ? sqlite3_errmsg(db) : sqlite3_errstr(code), code);
    fl_throw(fl_str_val(message));
}

static void db_lease_error(FLDbLease lease, const char *operation, int code) {
    char message[512];
    snprintf(message, sizeof(message), "%s: %s (sqlite=%d)", operation,
             sqlite3_errmsg(lease.handle), code);
    if (lease.owned) sqlite3_close(lease.handle);
    fl_throw(fl_str_val(message));
}

static int db_batch_authorizer(void *context, int action, const char *a,
                               const char *b, const char *c, const char *d) {
    (void)context; (void)a; (void)b; (void)c; (void)d;
    return action == SQLITE_TRANSACTION || action == SQLITE_SAVEPOINT
           ? SQLITE_DENY : SQLITE_OK;
}

static sqlite3_stmt *db_prepare(sqlite3 *db, FLValue sql_value,
                                FLValue params, const char *operation, const char **tail) {
    const char *sql = db_string(sql_value, operation);
    sqlite3_stmt *statement = NULL;
    int code = sqlite3_prepare_v2(db, sql, -1, &statement, tail);
    if (code != SQLITE_OK) db_error(db, operation, code);

    if (params.tag != FL_VECTOR || !params.obj) {
        sqlite3_finalize(statement);
        fl_throw(fl_str_val("database parameters must be an array"));
    }
    FLVector *values = (FLVector *)params.obj;
    int expected = sqlite3_bind_parameter_count(statement);
    if (values->len != (uint32_t)expected) {
        sqlite3_finalize(statement);
        fl_throw(fl_str_val("database parameter count does not match placeholders"));
    }
    for (uint32_t i = 0; i < values->len; i++) {
        FLValue value = values->data[i];
        switch (value.tag) {
            case FL_NIL:
                code = sqlite3_bind_null(statement, (int)i + 1);
                break;
            case FL_BOOL:
                code = sqlite3_bind_int64(statement, (int)i + 1, value.b ? 1 : 0);
                break;
            case FL_INT:
                code = sqlite3_bind_int64(statement, (int)i + 1, value.i);
                break;
            case FL_FLOAT:
                code = sqlite3_bind_double(statement, (int)i + 1, value.f);
                break;
            case FL_STRING:
                if (!value.obj) {
                    code = sqlite3_bind_null(statement, (int)i + 1);
                } else {
                    FLString *string = (FLString *)value.obj;
                    const char *text = string->data;
                    if (string->len > INT_MAX || strlen(text) != string->len) {
                        sqlite3_finalize(statement);
                        fl_throw(fl_str_val("db-exec: database string is too long or contains zero bytes"));
                    }
                    code = sqlite3_bind_text(statement, (int)i + 1, text,
                                             (int)string->len, SQLITE_TRANSIENT);
                }
                break;
            default:
                sqlite3_finalize(statement);
                fl_throw(fl_str_val("database parameter type is unsupported"));
        }
        if (code != SQLITE_OK) {
            sqlite3_finalize(statement);
            db_error(db, operation, code);
        }
    }
    return statement;
}

static FLValue db_column(sqlite3_stmt *statement, int column) {
    switch (sqlite3_column_type(statement, column)) {
        case SQLITE_INTEGER:
            return fl_int(sqlite3_column_int64(statement, column));
        case SQLITE_FLOAT:
            return fl_float(sqlite3_column_double(statement, column));
        case SQLITE_TEXT:
            return fl_str_val((const char *)sqlite3_column_text(statement, column));
        case SQLITE_NULL:
            return fl_nil();
        case SQLITE_BLOB:
            fl_throw(fl_str_val("SQLite BLOB results are unsupported"));
            return fl_nil();
        default:
            return fl_nil();
    }
}

FLValue fl_db_open(FLValue path_value) {
    const char *path = db_string(path_value, "db-open");
    sqlite3 *db = db_open_path(path, true);
    FLDbEntry *entry = fl_calloc(1, sizeof(*entry));
    if (!entry || !(entry->path = strdup(path))) {
        free(entry);
        sqlite3_close(db);
        fl_throw(fl_str_val("db-open: handle allocation failed"));
    }
    entry->id = (int64_t)(uintptr_t)db;
    entry->db = db;
    entry->pid = getpid();
    entry->next = db_entries;
    db_entries = entry;
    return fl_int(entry->id);
}

FLValue fl_db_close(FLValue handle) {
    if (handle.tag != FL_INT || handle.i == 0) return fl_bool(true);
    FLDbEntry **cursor = &db_entries;
    while (*cursor && (*cursor)->id != handle.i) cursor = &(*cursor)->next;
    FLDbEntry *entry = *cursor;
    sqlite3 *db = entry ? db_reopen_after_fork(entry)
                       : (sqlite3 *)(uintptr_t)(uint64_t)handle.i;
    int code = sqlite3_close(db);
    if (code != SQLITE_OK) db_error(db, "db-close", code);
    if (entry) {
        *cursor = entry->next;
        free(entry->path);
        free(entry);
    }
    return fl_bool(true);
}

FLValue fl_db_query(FLValue handle, FLValue sql, FLValue params) {
    FLDbLease lease = db_acquire(handle);
    sqlite3 *db = lease.handle;
    sqlite3_stmt *statement = db_prepare(db, sql, params, "db-query", NULL);
    FLValue rows = fl_vec_new();
    int columns = sqlite3_column_count(statement);
    int code;
    while ((code = sqlite3_step(statement)) == SQLITE_ROW) {
        FLValue row = fl_map_new();
        for (int i = 0; i < columns; i++) {
            if (sqlite3_column_type(statement, i) == SQLITE_TEXT &&
                memchr(sqlite3_column_text(statement, i), 0,
                       sqlite3_column_bytes(statement, i))) {
                sqlite3_finalize(statement);
                if (lease.owned) sqlite3_close(db);
                fl_throw(fl_str_val("db-query: database text contains zero bytes"));
            }
            FLValue key = fl_str_val(sqlite3_column_name(statement, i));
            row = fl_map_set(row, key, db_column(statement, i));
        }
        rows = fl_vec_push(rows, row);
    }
    sqlite3_finalize(statement);
    if (code != SQLITE_DONE) db_error(db, "db-query", code);
    if (lease.owned) sqlite3_close(db);
    return rows;
}

FLValue db_one(FLValue handle, FLValue sql, FLValue params) {
    return fl_vec_first(fl_db_query(handle, sql, params));
}

FLValue fl_db_exec(FLValue handle, FLValue sql, FLValue params) {
    FLDbLease lease = db_acquire(handle);
    sqlite3 *db = lease.handle;
    const char *tail = NULL;
    sqlite3_stmt *statement = db_prepare(db, sql, params, "db-exec", &tail);
    sqlite3_stmt *next = NULL;
    int next_code = sqlite3_prepare_v2(db, tail, -1, &next, NULL);
    bool batch = next_code != SQLITE_OK || next != NULL;
    sqlite3_finalize(next);
    if (batch) {
        sqlite3_finalize(statement);
        if (((FLVector *)params.obj)->len != 0) {
            if (lease.owned) sqlite3_close(db);
            fl_throw(fl_str_val("db-exec: multiple statements cannot use parameters"));
        }
        int code = sqlite3_exec(db, "SAVEPOINT fl_db_batch", NULL, NULL, NULL);
        if (code != SQLITE_OK) db_lease_error(lease, "db-exec", code);
        int changed_before = sqlite3_total_changes(db);
        char *error = NULL;
        void (*previous_xfsz)(int) = signal(SIGXFSZ, SIG_IGN);
        sqlite3_set_authorizer(db, db_batch_authorizer, NULL);
        code = sqlite3_exec(db, db_string(sql, "db-exec"), NULL, NULL, &error);
        sqlite3_set_authorizer(db, NULL, NULL);
        if (previous_xfsz != SIG_ERR) (void)signal(SIGXFSZ, previous_xfsz);
        if (code != SQLITE_OK) {
            char message[512];
            snprintf(message, sizeof(message), "db-exec: %s (sqlite=%d)",
                     error ? error : sqlite3_errmsg(db), code);
            sqlite3_free(error);
            (void)sqlite3_exec(db, "ROLLBACK TO fl_db_batch; RELEASE fl_db_batch", NULL, NULL, NULL);
            if (lease.owned) sqlite3_close(db);
            fl_throw(fl_str_val(message));
        }
        sqlite3_free(error);
        code = sqlite3_exec(db, "RELEASE fl_db_batch", NULL, NULL, NULL);
        if (code != SQLITE_OK) db_lease_error(lease, "db-exec", code);
        int changed = sqlite3_total_changes(db) - changed_before;
        if (lease.owned) sqlite3_close(db);
        return fl_int(changed);
    }
    int changed_before = sqlite3_total_changes(db);
    void (*previous_xfsz)(int) = signal(SIGXFSZ, SIG_IGN);
    int code = sqlite3_step(statement);
    sqlite3_finalize(statement);
    if (previous_xfsz != SIG_ERR) (void)signal(SIGXFSZ, previous_xfsz);
    int changed = sqlite3_total_changes(db) - changed_before;
    if (code != SQLITE_DONE) db_error(db, "db-exec", code);
    if (lease.owned) sqlite3_close(db);
    return fl_int(changed);
}
