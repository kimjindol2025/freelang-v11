#include "runtime.h"
#include <stdio.h>

int main(void) {
    FLValue db = fl_db_open(fl_str_val(":memory:"));
    FLValue params = fl_vec_new();
    (void)fl_db_exec(db, fl_str_val("CREATE TABLE items (name TEXT, n INTEGER)"), params);
    (void)fl_db_exec(db, fl_str_val("INSERT INTO items VALUES ('alpha', 2), ('beta', 3)"), params);
    FLValue sql = fl_str_val("SELECT name, n FROM items ORDER BY rowid");
    FLValue actual = db_one(db, sql, params);
    FLValue reference = fl_vec_first(fl_db_query(db, sql, params));
    FLValue name = fl_map_get(actual, fl_str_val("name"));
    FLValue count = fl_map_get(actual, fl_str_val("n"));
    int same = fl_truthy(fl_eq(fl_map_get(actual, fl_str_val("name")),
                               fl_map_get(reference, fl_str_val("name")))) &&
               fl_truthy(fl_eq(fl_map_get(actual, fl_str_val("n")),
                               fl_map_get(reference, fl_str_val("n"))));
    FLValue empty = db_one(db, fl_str_val("SELECT name FROM items WHERE n < 0"), params);
    printf("DB_ONE_FIRST=%s %lld REF_EQUAL=%d\n", fl_to_str(name, (char[64]){0}, 64),
           (long long)count.i, same);
    printf("DB_ONE_EMPTY_NIL=%d\n", empty.tag == FL_NIL);
    (void)fl_db_close(db);
    return !same || empty.tag != FL_NIL || count.tag != FL_INT || count.i != 2;
}
