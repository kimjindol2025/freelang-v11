#include "runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

time_t time(time_t *out) {
    time_t fixed = (time_t)1300819200;
    if (out) *out = fixed;
    return fixed;
}

int main(void) {
    static const unsigned char key_bytes[64] = {
        0x03,0x23,0x35,0x4b,0x2b,0x0f,0xa5,0xbc,0x83,0x7e,0x06,0x65,0x77,0x7b,0xa6,0x8f,
        0x5a,0xb3,0x28,0xe6,0xf0,0x54,0xc9,0x28,0xa9,0x0f,0x84,0xb2,0xd2,0x50,0x2e,0xbf,
        0xd3,0xfb,0x5a,0x92,0xd2,0x06,0x47,0xef,0x96,0x8a,0xb4,0xc3,0x77,0x62,0x3d,0x22,
        0x3d,0x2e,0x21,0x72,0x05,0x2e,0x4f,0x08,0xc0,0xcd,0x9a,0xf5,0x67,0xd0,0x80,0xa3
    };
    const char token[] = "eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9."
        "eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ."
        "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    FLString *key = malloc(sizeof(FLString) + sizeof(key_bytes) + 1);
    if (!key) return 2;
    key->base.type = FL_STRING; key->base.rc = 1; key->len = sizeof(key_bytes);
    memcpy(key->data, key_bytes, sizeof(key_bytes)); key->data[sizeof(key_bytes)] = 0;
    FLValue token_value = fl_str_val(token);
    FLValue decoded = fl_jwt_decode(token_value);
    FLValue claims = fl_jwt_verify(token_value, (FLValue){.tag=FL_STRING,.obj=(FLObject *)key});
    if (decoded.tag != FL_MAP || claims.tag != FL_MAP) return 1;
    free(key);
    if (claims.tag != FL_MAP || fl_map_get(claims, fl_str_val("iss")).tag != FL_STRING ||
        strcmp(((FLString *)fl_map_get(claims, fl_str_val("iss")).obj)->data, "joe")) return 1;
    puts("RFC7515_A1_HS256=PASS");
    return 0;
}
