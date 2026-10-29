#include "runtime.h"
#include <stdio.h>

int main(void) {
    FLValue result = hmac_sha256(fl_str_val("Jefe"), fl_str_val("what do ya want for nothing?"));
    if (result.tag != FL_STRING || !result.obj) return 1;
    printf("HMAC_SHA256=%s\n", ((FLString *)result.obj)->data);
    return 0;
}
