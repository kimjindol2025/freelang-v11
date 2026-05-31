#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <setjmp.h>

void fl_throw(FLValue err) {
    if (fl_try_top <= 0) {
        if (err.tag == FL_STRING && err.obj)
            fprintf(stderr, "Uncaught error: %s\n", ((FLString*)err.obj)->data);
        else if (err.tag == FL_MAP) {
            FLValue msg = fl_map_get(err, fl_str_val("message"));
            if (msg.tag == FL_STRING && msg.obj)
                fprintf(stderr, "Uncaught error: %s\n", ((FLString*)msg.obj)->data);
            else fprintf(stderr, "Uncaught error\n");
        } else fprintf(stderr, "Uncaught error\n");
        exit(1);
    }
    fl_try_stack[fl_try_top - 1].err = err;
    longjmp(fl_try_stack[fl_try_top - 1].buf, 1);
}

FLValue fl_make_error(const char* type, const char* msg) {
    FLValue m = fl_map_new();
    m = fl_map_set(m, fl_str_val("type"),    fl_str_val(type));
    m = fl_map_set(m, fl_str_val("message"), fl_str_val(msg));
    return m;
}
