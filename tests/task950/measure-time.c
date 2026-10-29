#include "runtime.h"
#include <stdio.h>
#include <string.h>

static FLValue return_42(FLClosure *self, int argc, FLValue *argv) {
    (void)self; (void)argc; (void)argv;
    return fl_int(42);
}

int main(void) {
    FLValue result = measure_time(fl_fn_new(return_42, 0, NULL), fl_str_val("test"));
    FLValue value = fl_map_get(result, fl_str_val("result"));
    FLValue label = fl_map_get(result, fl_str_val("label"));
    FLValue duration = fl_map_get(result, fl_str_val("duration_ms"));
    if (value.tag != FL_INT || label.tag != FL_STRING || duration.tag != FL_FLOAT) return 1;
    printf("MEASURE_TIME_RESULT=%lld LABEL=%s DURATION_NONNEG=%d\n",
           (long long)value.i, ((FLString *)label.obj)->data, duration.f >= 0.0);
    return value.i != 42 || strcmp(((FLString *)label.obj)->data, "test") != 0 || duration.f < 0.0;
}
