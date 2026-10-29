#include "runtime.h"
#include <stdio.h>
#include <string.h>
int main(void) {
    FLValue encoded = base64_encode(fl_str_val("Hello!"));
    FLValue decoded = base64_decode(fl_str_val("SGVsbG8h"));
    int encode_ok = encoded.tag == FL_STRING && strcmp(((FLString *)encoded.obj)->data, "SGVsbG8h") == 0;
    int decode_ok = decoded.tag == FL_STRING && strcmp(((FLString *)decoded.obj)->data, "Hello!") == 0;
    printf("BASE64_ENCODE=%s BASE64_DECODE=%s\n", ((FLString *)encoded.obj)->data, ((FLString *)decoded.obj)->data);
    return !encode_ok || !decode_ok;
}
