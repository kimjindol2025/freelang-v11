#include "runtime.h"
#include <stdio.h>
#include <string.h>
int main(void) {
    FLValue map = fl_map_set(fl_map_set(fl_map_new(), fl_str_val("a"), fl_int(1)), fl_str_val("b"), fl_int(2));
    FLValue keys = js_keys(map), ref = fl_map_keys(map);
    int same = keys.tag == FL_VECTOR && ref.tag == FL_VECTOR && ((FLVector *)keys.obj)->len == ((FLVector *)ref.obj)->len;
    printf("JS_KEYS_LEN=%u REF_EQUAL=%d\n", same ? ((FLVector *)keys.obj)->len : 0, same);
    return !same;
}
