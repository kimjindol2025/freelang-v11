#include "runtime.h"
#include <stdio.h>

int main(void) {
    FLValue result = scrypt_kdf(fl_str_val("password"), fl_str_val("salt"));
    if (result.tag != FL_STRING || !result.obj) return 1;
    printf("SCRYPT_KDF=%s\n", ((FLString *)result.obj)->data);
    return 0;
}
