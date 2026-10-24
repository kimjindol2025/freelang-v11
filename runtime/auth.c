#define _GNU_SOURCE
#include "runtime.h"
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/random.h>
#include <unistd.h>

static const char *auth_string(FLValue value, const char *name) {
    if (value.tag != FL_STRING || !value.obj)
        fl_throw(fl_str_val(name));
    return ((FLString *)value.obj)->data;
}

static int auth_random(void *buffer, size_t length) {
    unsigned char *p = buffer;
    while (length) {
        ssize_t n = getrandom(p, length, 0);
        if (n < 0 && errno == EINTR) continue;
        if (n < 0 && (errno == ENOSYS || errno == EPERM)) break;
        if (n <= 0) return -1;
        p += n;
        length -= (size_t)n;
    }
    if (!length) return 0;
    int fd = open("/dev/urandom", O_RDONLY | O_CLOEXEC);
    if (fd < 0) return -1;
    while (length) {
        ssize_t n = read(fd, p, length);
        if (n < 0 && errno == EINTR) continue;
        if (n <= 0) { close(fd); return -1; }
        p += n;
        length -= (size_t)n;
    }
    close(fd);
    return 0;
}

FLValue fl_auth_random_token(FLValue bytes_value) {
    if (bytes_value.tag != FL_INT || bytes_value.i < 16 || bytes_value.i > 128)
        fl_throw(fl_str_val("auth-random-token expects 16 to 128 bytes"));
    size_t size = (size_t)bytes_value.i;
    unsigned char bytes[128];
    char hex[257];
    static const char digits[] = "0123456789abcdef";
    if (auth_random(bytes, size) != 0) fl_throw(fl_str_val("secure random source failed"));
    for (size_t i = 0; i < size; i++) {
        hex[i * 2] = digits[bytes[i] >> 4];
        hex[i * 2 + 1] = digits[bytes[i] & 15];
    }
    hex[size * 2] = '\0';
    OPENSSL_cleanse(bytes, sizeof(bytes));
    return fl_str_val(hex);
}

FLValue fl_auth_pbkdf2(FLValue password_value, FLValue salt_value) {
    const char *password = auth_string(password_value, "auth-pbkdf2 expects password string");
    const char *salt = auth_string(salt_value, "auth-pbkdf2 expects salt string");
    unsigned char digest[32];
    char hex[65];
    static const char digits[] = "0123456789abcdef";
    if (strlen(password) > 4096 || strlen(salt) < 32 || strlen(salt) > 256 ||
        PKCS5_PBKDF2_HMAC(password, (int)strlen(password),
                          (const unsigned char *)salt, (int)strlen(salt),
                          100000, EVP_sha256(), sizeof(digest), digest) != 1)
        fl_throw(fl_str_val("PBKDF2-SHA256 failed"));
    for (size_t i = 0; i < sizeof(digest); i++) {
        hex[i * 2] = digits[digest[i] >> 4];
        hex[i * 2 + 1] = digits[digest[i] & 15];
    }
    hex[64] = '\0';
    OPENSSL_cleanse(digest, sizeof(digest));
    return fl_str_val(hex);
}

FLValue fl_auth_constant_time_equal(FLValue left_value, FLValue right_value) {
    const char *left = auth_string(left_value, "auth-constant-time-equal expects strings");
    const char *right = auth_string(right_value, "auth-constant-time-equal expects strings");
    size_t length = strlen(left);
    if (length != strlen(right)) return fl_bool(false);
    return fl_bool(CRYPTO_memcmp(left, right, length) == 0);
}
