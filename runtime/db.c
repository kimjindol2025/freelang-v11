#include "runtime.h"
#include "sqlite3.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* SQLite3 handle을 FLValue(FL_MAP)로 래핑하여 보관
 * {"__type":"sqlite3","__ptr":<intptr>} */

static FLValue ptr_to_val(void* p) {
    return fl_int((int64_t)(intptr_t)p);
}

static void* val_to_ptr(FLValue v) {
    if (v.tag != FL_INT) return NULL;
    return (void*)(intptr_t)v.i;
}

/* ── fl_db_open(path) → map{__type,__ptr} or nil ── */
FLValue fl_db_open(FLValue path) {
    if (path.tag != FL_STRING) return fl_nil();
    const char* p = ((FLString*)path.obj)->data;
    sqlite3* db = NULL;
    int rc = sqlite3_open(p, &db);
    if (rc != SQLITE_OK) {
        if (db) sqlite3_close(db);
        return fl_nil();
    }
    sqlite3_busy_timeout(db, 5000);
    FLValue kv[4];
    kv[0] = fl_str_val("__type"); kv[1] = fl_str_val("sqlite3");
    kv[2] = fl_str_val("__ptr");  kv[3] = ptr_to_val(db);
    return fl_map_from_pairs(kv, 2);
}

static sqlite3* extract_db(FLValue handle) {
    if (handle.tag != FL_MAP) return NULL;
    FLValue ptr = fl_map_get(handle, fl_str_val("__ptr"));
    return (sqlite3*)val_to_ptr(ptr);
}

/* ── fl_db_close(handle) → nil ── */
FLValue fl_db_close(FLValue handle) {
    sqlite3* db = extract_db(handle);
    if (db) sqlite3_close(db);
    return fl_nil();
}

/* ── stmt 바인딩 헬퍼 ── */
static void bind_params(sqlite3_stmt* stmt, FLValue params) {
    if (params.tag != FL_VECTOR) return;
    FLVector* vec = (FLVector*)params.obj;
    for (uint32_t i = 0; i < vec->len; i++) {
        FLValue v = vec->data[i];
        int idx = (int)i + 1;
        switch (v.tag) {
            case FL_INT:    sqlite3_bind_int64(stmt, idx, v.i); break;
            case FL_FLOAT:  sqlite3_bind_double(stmt, idx, v.f); break;
            case FL_BOOL:   sqlite3_bind_int(stmt, idx, v.b ? 1 : 0); break;
            case FL_NIL:    sqlite3_bind_null(stmt, idx); break;
            case FL_STRING: {
                const char* s = ((FLString*)v.obj)->data;
                sqlite3_bind_text(stmt, idx, s, -1, SQLITE_TRANSIENT);
                break;
            }
            default: sqlite3_bind_null(stmt, idx); break;
        }
    }
}

/* ── 컬럼 값 → FLValue ── */
static FLValue col_to_val(sqlite3_stmt* stmt, int col) {
    switch (sqlite3_column_type(stmt, col)) {
        case SQLITE_INTEGER: return fl_int(sqlite3_column_int64(stmt, col));
        case SQLITE_FLOAT:   return fl_float(sqlite3_column_double(stmt, col));
        case SQLITE_TEXT: {
            const char* s = (const char*)sqlite3_column_text(stmt, col);
            return s ? fl_str_val(s) : fl_nil();
        }
        case SQLITE_NULL:    return fl_nil();
        case SQLITE_BLOB:    return fl_str_val("<blob>");
        default:             return fl_nil();
    }
}

/* ── fl_db_query(handle, sql, params) → vector<map> ── */
FLValue fl_db_query(FLValue handle, FLValue sql, FLValue params) {
    sqlite3* db = extract_db(handle);
    if (!db || sql.tag != FL_STRING) return fl_nil();
    const char* s = ((FLString*)sql.obj)->data;

    sqlite3_stmt* stmt = NULL;
    if (sqlite3_prepare_v2(db, s, -1, &stmt, NULL) != SQLITE_OK)
        return fl_nil();

    bind_params(stmt, params);

    FLValue result = fl_vec_new();
    int ncols = sqlite3_column_count(stmt);

    while (sqlite3_step(stmt) == SQLITE_ROW) {
        /* 행을 map으로 변환 */
        FLValue* kv = malloc(sizeof(FLValue) * ncols * 2);
        for (int c = 0; c < ncols; c++) {
            const char* name = sqlite3_column_name(stmt, c);
            kv[c*2]   = fl_str_val(name);
            kv[c*2+1] = col_to_val(stmt, c);
        }
        FLValue row = fl_map_from_pairs(kv, (uint32_t)ncols);
        free(kv);
        result = fl_vec_push(result, row);
    }
    sqlite3_finalize(stmt);
    return result;
}

/* ── fl_db_exec(handle, sql, params) → last_insert_rowid or 0 ── */
FLValue fl_db_exec(FLValue handle, FLValue sql, FLValue params) {
    sqlite3* db = extract_db(handle);
    if (!db || sql.tag != FL_STRING) return fl_int(0);
    const char* s = ((FLString*)sql.obj)->data;

    sqlite3_stmt* stmt = NULL;
    if (sqlite3_prepare_v2(db, s, -1, &stmt, NULL) != SQLITE_OK)
        return fl_int(0);

    bind_params(stmt, params);
    sqlite3_step(stmt);
    sqlite3_finalize(stmt);

    return fl_int((int64_t)sqlite3_last_insert_rowid(db));
}
