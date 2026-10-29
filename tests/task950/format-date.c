#define _GNU_SOURCE
#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

int main(void) {
    if (setenv("TZ", "UTC", 1) != 0) return 2;
    tzset();
    FLValue value = format_date(fl_int(0), fl_str_val("YYYY-MM-DD HH:mm:ss.SSS"));
    if (value.tag != FL_STRING || !value.obj) return 1;
    printf("FORMAT_DATE=%s\n", ((FLString *)value.obj)->data);
    return 0;
}
