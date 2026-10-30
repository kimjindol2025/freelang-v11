#include "runtime.h"
#include <stdio.h>

int main(void) {
    FLValue bytes = random_bytes(fl_int(8));
    FLValue empty = random_bytes(fl_int(0));
    if (bytes.tag != FL_STRING || !bytes.obj || empty.tag != FL_STRING || !empty.obj) return 1;
    FLString *hex = (FLString *)bytes.obj;
    FLString *zero = (FLString *)empty.obj;
    int valid = hex->len == 16;
    for (uint32_t i = 0; i < hex->len; i++)
        if (!((hex->data[i] >= '0' && hex->data[i] <= '9') ||
              (hex->data[i] >= 'a' && hex->data[i] <= 'f'))) valid = 0;
    printf("RANDOM_BYTES_LEN=%u HEX=%d\n", hex->len, valid);
    printf("RANDOM_BYTES_ZERO_LEN=%u\n", zero->len);
    return !valid || zero->len != 0;
}
