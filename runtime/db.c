#include "runtime.h"
#include <sqlite3.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

static const char *db_string(FLValue value, const char *operation) {
    if (value.tag != FL_STRING || !value.obj) {
        char message[160];
        snprintf(message, sizeof(message), "%s expects a string", operation);
        fl_throw(fl_str_val(message));
    }
    return ((FLString *)value.obj)->data;
}

typedef struct {
    sqlite3 *handle;
    bool owned;
} FLDbLease;

static sqlite3 *db_open_path(const char *path) {
    sqlite3 *db = NULL;
    int code = sqlite3_open_v2(path, &db,
                               SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
                               NULL);
    if (code != SQLITE_OK) {
        char message[512];
        snprintf(message, sizeof(message), "db-open: %s (sqlite=%d)",
                 db ? sqlite3_errmsg(db) : sqlite3_errstr(code), code);
        if (db) sqlite3_close(db);
        fl_throw(fl_str_val(message));
    }
    return db;
}

static FLDbLease db_acquire(FLValue value) {
    FLDbLease lease;
    if (value.tag == FL_INT && value.i != 0) {
        lease.handle = (sqlite3 *)(uintptr_t)(uint64_t)value.i;
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
    lease.handle = db_open_path(db_string(path_value, "database"));
    lease.owned = true;
    return lease;
}

static void db_error(sqlite3 *db, const char *operation, int code) {
    char message[512];
    snprintf(message, sizeof(message), "%s: %s (sqlite=%d)", operation,
             db ? sqlite3_errmsg(db) : sqlite3_errstr(code), code);
    fl_throw(fl_str_val(message));
}

static sqlite3_stmt *db_prepare(sqlite3 *db, FLValue sql_value,
                                FLValue params, const char *operation) {
    const char *sql = db_string(sql_value, operation);
    sqlite3_stmt *statement = NULL;
    int code = sqlite3_prepare_v2(db, sql, -1, &statement, NULL);
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
                    const char *text = ((FLString *)value.obj)->data;
                    code = sqlite3_bind_text(statement, (int)i + 1, text,
                                             (int)strlen(text), SQLITE_TRANSIENT);
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
    sqlite3 *db = db_open_path(path);
    return fl_int((int64_t)(uintptr_t)db);
}

FLValue fl_db_close(FLValue handle) {
    if (handle.tag != FL_INT || handle.i == 0) return fl_bool(true);
    sqlite3 *db = (sqlite3 *)(uintptr_t)(uint64_t)handle.i;
    int code = sqlite3_close(db);
    if (code != SQLITE_OK) db_error(db, "db-close", code);
    return fl_bool(true);
}

FLValue fl_db_query(FLValue handle, FLValue sql, FLValue params) {
    FLDbLease lease = db_acquire(handle);
    sqlite3 *db = lease.handle;
    sqlite3_stmt *statement = db_prepare(db, sql, params, "db-query");
    FLValue rows = fl_vec_new();
    int columns = sqlite3_column_count(statement);
    int code;
    while ((code = sqlite3_step(statement)) == SQLITE_ROW) {
        FLValue row = fl_map_new();
        for (int i = 0; i < columns; i++) {
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

FLValue fl_db_exec(FLValue handle, FLValue sql, FLValue params) {
    FLDbLease lease = db_acquire(handle);
    sqlite3 *db = lease.handle;
    sqlite3_stmt *statement = db_prepare(db, sql, params, "db-exec");
    int changed_before = sqlite3_total_changes(db);
    int code = sqlite3_step(statement);
    sqlite3_finalize(statement);
    int changed = sqlite3_total_changes(db) - changed_before;
    if (code != SQLITE_DONE) db_error(db, "db-exec", code);
    if (lease.owned) sqlite3_close(db);
    return fl_int(changed);
}
