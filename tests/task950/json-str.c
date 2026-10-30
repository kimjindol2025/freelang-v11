#include "runtime.h"
#include <stdio.h>
#include <string.h>

int main(void) {
    FLValue object = fl_map_set(fl_map_new(), fl_str_val("a"), fl_int(1));
    FLValue result = json_str(object);
    FLValue reference = fl_json_stringify(object);
    if (result.tag != FL_STRING || !result.obj || reference.tag != FL_STRING || !reference.obj) return 1;
    int same = strcmp(((FLString *)result.obj)->data, ((FLString *)reference.obj)->data) == 0;
    printf("JSON_STR=%s REF_EQUAL=%d\n", ((FLString *)result.obj)->data, same);
    return !same || strcmp(((FLString *)result.obj)->data, "{\"a\":1}") != 0;
}
