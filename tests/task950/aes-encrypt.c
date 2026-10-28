#include "runtime.h"
#include <openssl/evp.h>
#include <stdio.h>
#include <string.h>

int main(void) {
    FLValue value = aes_encrypt(fl_str_val("payload"), fl_str_val("test-key"));
    if (value.tag != FL_STRING || !value.obj) return 1;
    FLString *encoded = (FLString *)value.obj;
    unsigned char decoded[256] = {0};
    if (encoded->len > 252 || encoded->len % 4 != 0) return 1;
    int decoded_length = EVP_DecodeBlock(decoded, (const unsigned char *)encoded->data, (int)encoded->len);
    if (decoded_length < 0) return 1;
    while (encoded->len && encoded->data[encoded->len - 1] == '=') decoded_length--;
    char *decoded_text = (char *)decoded;
    char *first = memchr(decoded_text, ':', (size_t)decoded_length);
    char *last = first ? memchr(first + 1, ':', (size_t)(decoded_text + decoded_length - first - 1)) : NULL;
    if (!first || !last) return 1;
    int iv_length = (int)(first - (char *)decoded);
    int cipher_length = (int)(last - first - 1);
    int tag_length = (int)(decoded_text + decoded_length - last - 1);
    int valid = iv_length == 32 && cipher_length == 14 && tag_length == 32;
    printf("AES_ENCRYPT_FORMAT=%d IV_HEX=%d CIPHER_HEX=%d TAG_HEX=%d\n",
           valid, iv_length, cipher_length, tag_length);
    return !valid;
}
