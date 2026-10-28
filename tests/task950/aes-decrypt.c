#include "runtime.h"
#include <stdio.h>
#include <string.h>

int main(void) {
    FLValue key = fl_str_val("test-key");
    FLValue encrypted = aes_encrypt(fl_str_val("payload"), key);
    FLValue plaintext = aes_decrypt(encrypted, key);
    FLValue rejected = aes_decrypt(encrypted, fl_str_val("wrong-key"));
    if (plaintext.tag != FL_STRING || !plaintext.obj) return 1;
    printf("AES_DECRYPT_ROUNDTRIP=%s\n", ((FLString *)plaintext.obj)->data);
    printf("AES_DECRYPT_BAD_KEY_NIL=%d\n", rejected.tag == FL_NIL);
    return strcmp(((FLString *)plaintext.obj)->data, "payload") != 0 || rejected.tag != FL_NIL;
}
